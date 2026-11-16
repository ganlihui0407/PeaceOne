export {
  DATASET_TARGETS,
  PRESENTATION_CANDIDATES,
  PRESENTATION_CANDIDATE_EMAILS,
  PRESENTATION_COMPANIES,
  PRESENTATION_COURSES,
  PRESENTATION_JOBS,
  PRESENTATION_REGISTRATIONS,
  PRESENTATION_STAFF_EMAILS,
  STATUS_TARGETS,
  TRACKS,
  JOB_SKILL_SETS,
} from './presentationDemoDatasetCatalog.js';

export {
  DATASET_APPLICATIONS,
  DATASET_CANDIDATES,
  DATASET_CANDIDATE_EMAILS,
  DATASET_COMPANIES,
  DATASET_COMPANY_REGISTRATIONS,
  DATASET_JOBS,
  PROTECTED_DEMO_EMAILS,
  BASE_DEMO_ACCOUNTS,
} from './recruitmentDatasetCatalog.js';

export { LEARNING_DATASET_COURSES } from './learningDatasetCatalog.js';

export const PROTECTED_FULL_NAMES = {
  'admin@peaceone.demo': 'Nurul Izzah',
  'student@peaceone.demo': 'Aisyah Rahman',
  'graduate@peaceone.demo': 'Tan Wei Jie',
  'hr@techcorp.demo': 'Priya Nair',
  'staff@techcorp.demo': 'Daniel Wong',
};

export const PROTECTED_ROLES = {
  'admin@peaceone.demo': 'ADMIN',
  'student@peaceone.demo': 'STUDENT',
  'graduate@peaceone.demo': 'JOB_SEEKER',
  'hr@techcorp.demo': 'COMPANY_STAFF',
  'staff@techcorp.demo': 'COMPANY_STAFF',
};

export const WRITE_REFUSAL =
  'Refusing presentation expansion write: dedicated presentation CLI approval is required. Do not seed peaceone from tests or peaceone_test.';

export const PRESENTATION_WRITE_APPROVAL = 'PROMPT-28-AUTHORISED-PEACEONE-POPULATION';

export const PHASE2_BACKUP_RELATIVE_PATH = 'backups/peaceone-pre-phase2-20261116-214833.dump';
export const PHASE2_BACKUP_SHA256 =
  'FA4A0237FD7C6D786AB62D625A73B01C6E96B25C46E0C2E3B74F7742F0743192';

export const PHASE2_ISOLATED_DATABASE_NAME = 'peaceone_phase2_seed_test';

export const PRESENTATION_EXPANSION_TARGETS = {
  companies: 21,
  publishedJobs: 61,
  candidates: 107,
  applications: 250,
  interviews: 60,
  offers: 15,
  publishedCourses: 30,
  lessons: 120,
  enrolments: 150,
  lessonProgressMin: 400,
  lessonProgressMax: 450,
  assessmentAttempts: 180,
  notificationsMin: 500,
  completedCoursesMin: 45,
  completedCoursesMax: 60,
};

export const SKILL_LABEL_ALIASES = {
  Python: 'Python (computer programming)',
};

export const KNOWN_MISSING_OCCUPATION_LABELS = ['cyber security', 'ICT security specialist'];
