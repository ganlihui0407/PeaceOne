import { z } from 'zod';
import { ACCOUNT_STATUSES, USER_ROLES, listAdminUserStats } from './adminUserQuery.js';
import { APPLICATION_STATUSES } from './applicationQuery.js';
import { paginationMeta } from './escoQuery.js';
import { JOB_STATUSES } from './jobQuery.js';
import { INTERVIEW_STATUSES } from './interviewQuery.js';
import {
  LEARNING_ENROLLMENT_STATUSES,
  LEARNING_STATUSES,
} from './learningQuery.js';

const ADMIN_ACTIVITY_PAGE = 1;
const ADMIN_ACTIVITY_LIMIT = 10;

function singleQueryValue(value) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return String(value);
}

export const adminActivityQuerySchema = z.object({
  page: z.preprocess((value) => {
    const normalized = singleQueryValue(value);
    return normalized === undefined ? String(ADMIN_ACTIVITY_PAGE) : normalized;
  }, z.string().regex(/^[1-9]\d{0,6}$/).transform((value) => Number.parseInt(value, 10))),
  limit: z.preprocess((value) => {
    const normalized = singleQueryValue(value);
    return normalized === undefined ? String(ADMIN_ACTIVITY_LIMIT) : normalized;
  }, z.string().regex(/^[1-9]\d{0,2}$/).transform((value) => Number.parseInt(value, 10)).refine((value) => value <= 50)),
});

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
    recentActivity: await listAdminRecentActivity(client, {
      page: ADMIN_ACTIVITY_PAGE,
      limit: ADMIN_ACTIVITY_LIMIT,
    }),
  };
}

function serializeActivityRow(row) {
  return {
    id: `${row.type}:${row.source_id}`,
    type: row.type,
    occurredAt: row.occurred_at instanceof Date
      ? row.occurred_at.toISOString()
      : new Date(row.occurred_at).toISOString(),
    title: row.title,
    description: row.description,
  };
}

export async function listAdminRecentActivity(client, { page = ADMIN_ACTIVITY_PAGE, limit = ADMIN_ACTIVITY_LIMIT } = {}) {
  const skip = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    client.$queryRaw`
      SELECT source_id, type, occurred_at, title, description
      FROM (
        SELECT u.id::text AS source_id,
               'USER_REGISTERED'::text AS type,
               u.created_at AS occurred_at,
               'New user registration'::text AS title,
               (u.full_name || ' registered as ' || replace(u.role::text, '_', ' ')) AS description
        FROM users u
        UNION ALL
        SELECT c.id::text,
               'COMPANY_REGISTERED'::text,
               c.created_at,
               'New company registration'::text,
               c.company_name
        FROM companies c
        UNION ALL
        SELECT e.id::text,
               'JOB_PUBLISHED'::text,
               e.created_at,
               'Job published'::text,
               (j.title || ' at ' || c.company_name)
        FROM job_status_events e
        JOIN jobs j ON j.id = e.job_id
        JOIN companies c ON c.id = j.company_id
        WHERE e.to_status = 'PUBLISHED'
        UNION ALL
        SELECT e.id::text,
               'APPLICATION_SUBMITTED'::text,
               e.created_at,
               'Application submitted'::text,
               (j.title || ' at ' || c.company_name)
        FROM application_status_events e
        JOIN applications a ON a.id = e.application_id
        JOIN jobs j ON j.id = a.job_id
        JOIN companies c ON c.id = j.company_id
        WHERE e.to_status = 'SUBMITTED'
        UNION ALL
        SELECT e.id::text,
               'INTERVIEW_INVITED'::text,
               e.created_at,
               'Interview invitation'::text,
               (j.title || ' at ' || c.company_name)
        FROM interview_events e
        JOIN interviews i ON i.id = e.interview_id
        JOIN jobs j ON j.id = i.job_id
        JOIN companies c ON c.id = j.company_id
        WHERE e.event_type = 'CREATED'
        UNION ALL
        SELECT e.id::text,
               'OFFER_ISSUED'::text,
               e.created_at,
               'Offer issued'::text,
               (j.title || ' at ' || c.company_name)
        FROM application_status_events e
        JOIN applications a ON a.id = e.application_id
        JOIN jobs j ON j.id = a.job_id
        JOIN companies c ON c.id = j.company_id
        WHERE e.to_status = 'OFFERED'
        UNION ALL
        SELECT e.id::text,
               'LEARNING_COURSE_COMPLETED'::text,
               e.completed_at,
               'Learning course completion'::text,
               lc.title
        FROM learning_enrollments e
        JOIN learning_contents lc ON lc.id = e.content_id
        WHERE e.status = 'COMPLETED' AND e.completed_at IS NOT NULL
      ) activity
      ORDER BY occurred_at DESC, source_id DESC
      LIMIT ${limit} OFFSET ${skip}
    `,
    client.$queryRaw`
      SELECT COUNT(*)::int AS n
      FROM (
        SELECT u.id FROM users u
        UNION ALL
        SELECT c.id FROM companies c
        UNION ALL
        SELECT e.id FROM job_status_events e WHERE e.to_status = 'PUBLISHED'
        UNION ALL
        SELECT e.id FROM application_status_events e WHERE e.to_status = 'SUBMITTED'
        UNION ALL
        SELECT e.id FROM interview_events e WHERE e.event_type = 'CREATED'
        UNION ALL
        SELECT e.id FROM application_status_events e WHERE e.to_status = 'OFFERED'
        UNION ALL
        SELECT e.id FROM learning_enrollments e
        WHERE e.status = 'COMPLETED' AND e.completed_at IS NOT NULL
      ) activity
    `,
  ]);

  const total = countRows[0]?.n ?? 0;
  return {
    items: rows.map(serializeActivityRow),
    ...paginationMeta(page, limit, total),
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
