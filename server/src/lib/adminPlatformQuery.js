import { ACCOUNT_STATUSES, USER_ROLES, listAdminUserStats } from './adminUserQuery.js';
import { APPLICATION_STATUSES } from './applicationQuery.js';
import { JOB_STATUSES } from './jobQuery.js';
import { INTERVIEW_STATUSES } from './interviewQuery.js';
import {
  LEARNING_ENROLLMENT_STATUSES,
  LEARNING_STATUSES,
} from './learningQuery.js';

function zeroMap(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function fillGroup(rows, keys, field) {
  const result = zeroMap(keys);
  for (const row of rows) {
    result[row[field]] = row._count._all;
  }
  return result;
}

export async function listAdminPlatformStats(client) {
  const [
    users,
    companies,
    jobRows,
    applicationRows,
    interviewTotal,
    learningCourseRows,
    learningEnrollments,
    learningCompleted,
    publishedCourses,
  ] = await Promise.all([
    listAdminUserStats(client),
    client.company.count(),
    client.job.groupBy({ by: ['status'], _count: { _all: true } }),
    client.application.groupBy({ by: ['status'], _count: { _all: true } }),
    client.interview.count(),
    client.learningContent.groupBy({ by: ['status'], _count: { _all: true } }),
    client.learningEnrollment.count(),
    client.learningEnrollment.count({ where: { status: 'COMPLETED' } }),
    client.learningContent.count({ where: { status: 'PUBLISHED' } }),
  ]);

  const jobsByStatus = fillGroup(jobRows, JOB_STATUSES, 'status');
  const applicationsByStatus = fillGroup(applicationRows, APPLICATION_STATUSES, 'status');
  const coursesByStatus = fillGroup(learningCourseRows, LEARNING_STATUSES, 'status');

  return {
    users: {
      total: users.total,
      students: users.byRole.STUDENT,
      jobSeekers: users.byRole.JOB_SEEKER,
      companyStaff: users.byRole.COMPANY_STAFF,
      admins: users.byRole.ADMIN,
      byRole: users.byRole,
      byStatus: users.byStatus,
    },
    companies: { total: companies },
    jobs: {
      total: Object.values(jobsByStatus).reduce((sum, value) => sum + value, 0),
      published: jobsByStatus.PUBLISHED,
      draft: jobsByStatus.DRAFT,
      closed: jobsByStatus.CLOSED,
      suspended: jobsByStatus.SUSPENDED,
      byStatus: jobsByStatus,
    },
    applications: {
      total: Object.values(applicationsByStatus).reduce((sum, value) => sum + value, 0),
      byStatus: applicationsByStatus,
    },
    interviews: { total: interviewTotal },
    learning: {
      publishedCourses,
      enrollments: learningEnrollments,
      completed: learningCompleted,
      coursesByStatus,
    },
  };
}

export async function listAdminReports(client) {
  const [stats, enrollmentRows, interviewRows] = await Promise.all([
    listAdminPlatformStats(client),
    client.learningEnrollment.groupBy({ by: ['status'], _count: { _all: true } }),
    client.interview.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    usersByRole: stats.users.byRole,
    usersByStatus: stats.users.byStatus,
    jobsByStatus: stats.jobs.byStatus,
    applicationsByStatus: stats.applications.byStatus,
    interviews: {
      total: stats.interviews.total,
      byStatus: fillGroup(interviewRows, INTERVIEW_STATUSES, 'status'),
    },
    learning: {
      enrollments: stats.learning.enrollments,
      completed: stats.learning.completed,
      enrollmentsByStatus: fillGroup(enrollmentRows, LEARNING_ENROLLMENT_STATUSES, 'status'),
      coursesByStatus: stats.learning.coursesByStatus,
      publishedCourses: stats.learning.publishedCourses,
    },
    totals: {
      users: stats.users.total,
      candidates: stats.users.students + stats.users.jobSeekers,
      companies: stats.companies.total,
      jobs: stats.jobs.total,
      publishedJobs: stats.jobs.published,
      applications: stats.applications.total,
      offers: stats.applications.byStatus.OFFERED ?? 0,
      interviews: stats.interviews.total,
      enrollments: stats.learning.enrollments,
    },
    roles: USER_ROLES,
    accountStatuses: ACCOUNT_STATUSES,
  };
}

export async function listAdminContentMonitoring(client) {
  const [publishedJobs, suspendedJobs, publishedCourses, archivedCourses, recentJobEvents, recentCourses] =
    await Promise.all([
      client.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          company: { select: { id: true, companyName: true } },
        },
      }),
      client.job.findMany({
        where: { status: 'SUSPENDED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          company: { select: { id: true, companyName: true } },
        },
      }),
      client.learningContent.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, title: true, status: true, updatedAt: true, slug: true },
      }),
      client.learningContent.findMany({
        where: { status: 'ARCHIVED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, title: true, status: true, updatedAt: true, slug: true },
      }),
      client.jobStatusEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              status: true,
              company: { select: { companyName: true } },
            },
          },
          actor: { select: { id: true, fullName: true, role: true } },
        },
      }),
      client.learningContent.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
    ]);

  return {
    moderationQueueSupported: false,
    moderationNote:
      'PeaceOne does not store a flagged-content moderation queue. This page lists live published and suspended jobs, published and archived courses, and recent job status changes.',
    publishedJobs: publishedJobs.map(serializeMonitorJob),
    suspendedJobs: suspendedJobs.map(serializeMonitorJob),
    publishedCourses: publishedCourses.map(serializeMonitorCourse),
    archivedCourses: archivedCourses.map(serializeMonitorCourse),
    recentJobStatusEvents: recentJobEvents.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note ?? null,
      createdAt: event.createdAt.toISOString(),
      job: {
        id: event.job.id,
        title: event.job.title,
        status: event.job.status,
        companyName: event.job.company?.companyName ?? null,
      },
      actor: {
        id: event.actor.id,
        fullName: event.actor.fullName,
        role: event.actor.role,
      },
    })),
    recentCourseUpdates: recentCourses.map(serializeMonitorCourse),
  };
}

function serializeMonitorJob(job) {
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    companyName: job.company?.companyName ?? null,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeMonitorCourse(course) {
  return {
    id: course.id,
    title: course.title,
    status: course.status,
    slug: course.slug ?? null,
    updatedAt: course.updatedAt.toISOString(),
  };
}
