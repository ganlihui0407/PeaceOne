import { studentProfile, jobSeekerProfile } from './candidateData.js'
import { employerStaff } from './employerStaff.js'
import { nexaDigital } from './companies.js'
import { skillsSummary } from './skills.js'
import { learningProgressSummary } from './learningProgress.js'

export const adminProfile = {
  fullName: 'Alex Tan',
  email: 'alex.tan@peaceone.test',
  phone: '011-560 2291',
  accountStatus: 'Active',
  role: 'Administrator',
}

export const userRoles = ['All', 'Student / Job Seeker', 'Company Staff', 'Admin']

export const accountStatuses = ['All', 'Active', 'Suspended', 'Inactive']

export const adminUsers = [
  {
    id: 'emily-tan',
    ...studentProfile,
    role: 'Student / Job Seeker',
    registeredDate: '12 Mar 2026',
    kind: 'candidate',
    skillsSummary: `${skillsSummary.totalSkills} skills · ${skillsSummary.verifiedSkills} verified`,
    applicationsSummary: '2 applications · 1 shortlisted',
    learningSummary: `${learningProgressSummary.inProgress} in progress · ${learningProgressSummary.completed} completed`,
    positionChangeRequest: {
      currentPosition: 'Student',
      requestedPosition: 'Job Seeker',
      status: 'Pending Review',
    },
  },
  {
    id: 'daniel-lee',
    ...jobSeekerProfile,
    role: 'Student / Job Seeker',
    registeredDate: '4 Jan 2026',
    kind: 'candidate',
    skillsSummary: '8 skills · 6 verified',
    applicationsSummary: '6 applications · 2 shortlisted · 1 interview',
    learningSummary: '2 in progress · 3 completed',
  },
  {
    id: 'sarah-lim',
    fullName: employerStaff.fullName,
    email: employerStaff.email,
    phone: employerStaff.phone,
    accountStatus: employerStaff.accountStatus,
    role: 'Company Staff',
    currentPosition: employerStaff.position,
    registeredDate: '18 Feb 2026',
    kind: 'staff',
    company: nexaDigital.companyName,
    position: employerStaff.position,
    department: employerStaff.department,
    staffStatus: employerStaff.staffStatus,
  },
  {
    id: 'alex-tan',
    ...adminProfile,
    currentPosition: 'Administrator',
    registeredDate: '8 Jan 2026',
    kind: 'admin',
  },
  {
    id: 'aisha-rahman',
    fullName: 'Aisha Rahman',
    email: 'aisha.rahman@peaceone.test',
    phone: '017-441 2290',
    accountStatus: 'Active',
    role: 'Student / Job Seeker',
    currentPosition: 'Student',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Computer Science',
    institution: 'Universiti Teknologi Malaysia',
    graduationYear: '2025',
    location: 'Johor Bahru',
    experienceSummary:
      'Graduate with coursework in databases and reporting. Internship experience includes cleaning datasets and preparing weekly packs.',
    registeredDate: '22 Apr 2026',
    kind: 'candidate',
    skillsSummary: '4 skills · 3 verified',
    applicationsSummary: '1 application · reviewed',
    learningSummary: '1 in progress · 1 completed',
  },
  {
    id: 'marcus-tan',
    fullName: 'Marcus Tan',
    email: 'marcus.tan@peaceone.test',
    phone: '012-773 1188',
    accountStatus: 'Suspended',
    role: 'Student / Job Seeker',
    currentPosition: 'Job Seeker',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Universiti Malaya',
    graduationYear: '2025',
    location: 'Kuala Lumpur',
    experienceSummary:
      'Final-year graduate with project work in reporting dashboards and introductory Python.',
    registeredDate: '9 May 2026',
    kind: 'candidate',
    skillsSummary: '3 skills · 1 verified',
    applicationsSummary: '2 applications · pending',
    learningSummary: '1 in progress',
  },
  {
    id: 'wei-chen',
    fullName: 'Wei Chen',
    email: 'wei.chen@peaceone.test',
    phone: '014-882 3301',
    accountStatus: 'Inactive',
    role: 'Company Staff',
    currentPosition: 'Talent Coordinator',
    registeredDate: '3 Nov 2025',
    kind: 'staff',
    company: nexaDigital.companyName,
    position: 'Talent Coordinator',
    department: 'Human Resources',
    staffStatus: 'Inactive',
  },
]

export const adminUserSummary = [
  { label: 'Total Users', value: '1,248' },
  { label: 'Students / Job Seekers', value: '1,120' },
  { label: 'Company Staff', value: '86' },
  { label: 'Administrators', value: '4' },
  { label: 'Suspended', value: '8' },
]

export function getAdminUser(userId) {
  return adminUsers.find((user) => user.id === userId)
}
