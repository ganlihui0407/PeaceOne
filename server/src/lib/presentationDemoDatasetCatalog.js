import { course, lesson, question } from './demoLearningCatalog.js';
import { RECRUITMENT_DATASET_NOTICE } from './recruitmentDatasetCatalog.js';

export const PRESENTATION_DEMO_PREFIX = 'DEMO-PRESENTATION';
export const PRESENTATION_EMAIL_DOMAIN = 'peaceone.demo';

export const STATUS_TARGETS = {
  SUBMITTED: 35,
  UNDER_REVIEW: 45,
  SHORTLISTED: 55,
  INTERVIEW: 45,
  OFFERED: 15,
  REJECTED: 55,
};

export const DATASET_TARGETS = {
  companies: 20,
  publishedJobs: 60,
  candidates: 100,
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

const NOTICE = `${RECRUITMENT_DATASET_NOTICE} Expanded PeaceOne FYP demonstration records use ${PRESENTATION_DEMO_PREFIX} identifiers.`;

const FIRST_NAMES = [
  'Amina', 'Hakim', 'Jia', 'Ravi', 'Sofea', 'Darren', 'Hana', 'Irfan', 'Mei', 'Zaid',
  'Nadia', 'Owen', 'Putri', 'Qistina', 'Rizal', 'Sabrina', 'Taufik', 'Umairah', 'Vijay', 'Wani',
  'Yusof', 'Zahra', 'Adam', 'Bella', 'Chong', 'Diyana', 'Ehsan', 'Farah', 'Gopal', 'Haziq',
];

const LAST_NAMES = [
  'Ismail', 'Lim', 'Krishnan', 'Abdullah', 'Tan', 'Rahman', 'Ng', 'Hassan', 'Chong', 'Yusof',
  'Pereira', 'Azman', 'Wong', 'Salleh', 'Teo',
];

export const TRACKS = [
  {
    key: 'software',
    role: 'JOB_SEEKER',
    occupationLabels: ['software developer', 'Software developer'],
    skillLabels: [
      { labels: ['web programming'], proficiencyLevel: 'Intermediate' },
      { labels: ['develop software prototype'], proficiencyLevel: 'Beginner' },
    ],
  },
  {
    key: 'data',
    role: 'STUDENT',
    occupationLabels: ['data analyst', 'Data analyst'],
    skillLabels: [
      { labels: ['SQL'], proficiencyLevel: 'Beginner' },
      { labels: ['perform data analysis'], proficiencyLevel: 'Beginner' },
    ],
  },
  {
    key: 'security',
    role: 'JOB_SEEKER',
    occupationLabels: ['ICT security technician', 'cyber security'],
    skillLabels: [
      { labels: ['cyber security'], proficiencyLevel: 'Beginner' },
      { labels: ['apply information security policies'], proficiencyLevel: 'Beginner' },
    ],
  },
  {
    key: 'marketing',
    role: 'STUDENT',
    occupationLabels: ['digital marketing manager', 'advertising specialist'],
    skillLabels: [
      { labels: ['digital marketing techniques'], proficiencyLevel: 'Beginner' },
      { labels: ['apply social media marketing'], proficiencyLevel: 'Beginner' },
    ],
  },
];

export const JOB_SKILL_SETS = [
  ['web programming', 'develop software prototype'],
  ['SQL', 'perform data analysis'],
  ['Python (computer programming)', 'statistics'],
  ['design user interface', 'create website wireframe'],
  ['digital marketing techniques', 'apply social media marketing'],
  ['search engine optimisation', 'digital marketing techniques'],
  ['perform business analysis', 'business intelligence'],
  ['data visualisation software', 'perform data analysis'],
  ['cyber security', 'apply information security policies'],
  ['ICT network security risks', 'cyber security'],
];

export const NEW_COMPANIES = [
  { key: 'apexstack', name: 'ApexStack Software Sdn. Bhd.', industry: 'Software Development', location: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  { key: 'pixelforge', name: 'PixelForge Interactive Sdn. Bhd.', industry: 'Software Development', location: 'Petaling Jaya, Selangor', city: 'Petaling Jaya' },
  { key: 'northernloop', name: 'Northern Loop Digital Sdn. Bhd.', industry: 'Digital Marketing and Media', location: 'George Town, Penang', city: 'Penang' },
  { key: 'harbourline', name: 'Harbourline Media Sdn. Bhd.', industry: 'Digital Marketing and Media', location: 'Melaka', city: 'Melaka' },
  { key: 'ledgerbay', name: 'LedgerBay Finance Sdn. Bhd.', industry: 'Finance and Banking', location: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  { key: 'ringgitpath', name: 'RinggitPath Banking Lab Sdn. Bhd.', industry: 'Finance and Banking', location: 'Shah Alam, Selangor', city: 'Shah Alam' },
  { key: 'insightkite', name: 'InsightKite Analytics Sdn. Bhd.', industry: 'Data Analytics and Business Intelligence', location: 'Cyberjaya, Selangor', city: 'Cyberjaya' },
  { key: 'tableflow', name: 'Tableflow Intelligence Sdn. Bhd.', industry: 'Data Analytics and Business Intelligence', location: 'Petaling Jaya, Selangor', city: 'Petaling Jaya' },
  { key: 'shieldarbor', name: 'ShieldArbor Cyber Sdn. Bhd.', industry: 'Cybersecurity and Cloud Computing', location: 'Johor Bahru, Johor', city: 'Johor Bahru' },
  { key: 'nimbuskeep', name: 'NimbusKeep Cloud Sdn. Bhd.', industry: 'Cybersecurity and Cloud Computing', location: 'Ipoh, Perak', city: 'Ipoh' },
  { key: 'precisionbay', name: 'PrecisionBay Engineering Sdn. Bhd.', industry: 'Engineering and Manufacturing', location: 'Shah Alam, Selangor', city: 'Shah Alam' },
  { key: 'riverform', name: 'Riverform Manufacturing Sdn. Bhd.', industry: 'Engineering and Manufacturing', location: 'Johor Bahru, Johor', city: 'Johor Bahru' },
  { key: 'greenquay', name: 'GreenQuay Environmental Sdn. Bhd.', industry: 'Environmental Technology', location: 'George Town, Penang', city: 'Penang' },
  { key: 'classroomorbit', name: 'ClassroomOrbit EdTech Sdn. Bhd.', industry: 'Education Technology', location: 'Kuala Lumpur', city: 'Kuala Lumpur' },
  { key: 'meridian', name: 'Meridian Advisory Sdn. Bhd.', industry: 'Business Consulting', location: 'Kuala Lumpur', city: 'Kuala Lumpur' },
];

const JOB_TITLES_BY_INDUSTRY = {
  'Software Development': ['Backend Engineer', 'Frontend Engineer', 'QA Analyst', 'DevOps Associate'],
  'Digital Marketing and Media': ['Content Strategist', 'Campaign Executive', 'SEO Analyst', 'Social Media Specialist'],
  'Finance and Banking': ['Credit Operations Analyst', 'Finance Graduate Associate', 'Risk Reporting Officer', 'Treasury Support Executive'],
  'Data Analytics and Business Intelligence': ['Junior Data Analyst', 'BI Developer', 'Analytics Associate', 'Reporting Specialist'],
  'Cybersecurity and Cloud Computing': ['SOC Analyst', 'Cloud Operations Associate', 'IT Security Coordinator', 'Infrastructure Support Engineer'],
  'Engineering and Manufacturing': ['Process Engineer', 'Quality Engineer', 'Production Planner', 'Maintenance Coordinator'],
  'Environmental Technology': ['Sustainability Analyst', 'Environmental Technician', 'ESG Reporting Associate', 'Field Monitoring Officer'],
  'Education Technology': ['Learning Content Designer', 'Instructional Technologist', 'Student Success Associate', 'EdTech Support Specialist'],
  'Business Consulting': ['Business Analyst', 'Junior Consultant', 'Research Associate', 'Client Operations Executive'],
  'Information Technology': ['IT Support Specialist', 'Systems Analyst', 'Network Technician', 'Application Support Executive'],
};

function pad(index, width = 3) {
  return String(index).padStart(width, '0');
}

export function companyRegistration(index) {
  return `${PRESENTATION_DEMO_PREFIX}-COMPANY-${pad(index)}`;
}

export function buildPresentationCompanies() {
  return NEW_COMPANIES.map((item, offset) => {
    const index = offset + 6;
    const extraStaff = offset < 10;
    const staff = [
      {
        email: `hr-${item.key}@${PRESENTATION_EMAIL_DOMAIN}`,
        fullName: `${FIRST_NAMES[offset % FIRST_NAMES.length]} ${LAST_NAMES[offset % LAST_NAMES.length]}`,
        phone: `+6012346${pad(index)}`,
        jobTitle: 'Human Resources Manager',
        department: 'People Operations',
        location: item.location,
        experienceSummary: `Demonstration HR account for ${item.name}. Synthetic PeaceOne FYP record.`,
        isHr: true,
      },
    ];
    if (extraStaff) {
      staff.push({
        email: `staff-${item.key}@${PRESENTATION_EMAIL_DOMAIN}`,
        fullName: `${FIRST_NAMES[(offset + 7) % FIRST_NAMES.length]} ${LAST_NAMES[(offset + 3) % LAST_NAMES.length]}`,
        phone: `+6012347${pad(index)}`,
        jobTitle: offset < 4 ? 'Human Resources Executive' : 'Talent Coordinator',
        department: 'People Operations',
        location: item.location,
        experienceSummary: `Additional demonstration staff account for ${item.name}.`,
        isHr: false,
      });
    }
    return {
      key: item.key,
      index,
      companyName: item.name,
      registrationNumber: companyRegistration(index),
      industry: item.industry,
      companySize: '11-50',
      website: `https://${item.key}.peaceone.demo`,
      email: staff[0].email,
      phone: `+6032100${pad(index)}`,
      location: item.location,
      address: `Demonstration Suite, ${item.location}`,
      description: `${NOTICE} ${item.name} is a fictional Malaysian organisation created for the PeaceOne FYP dataset.`,
      staff,
      jobTitles: JOB_TITLES_BY_INDUSTRY[item.industry] || JOB_TITLES_BY_INDUSTRY['Information Technology'],
    };
  });
}

export function buildPresentationJobs() {
  const companies = buildPresentationCompanies();
  const jobs = [];
  let jobIndex = 1;
  companies.forEach((company, companyOffset) => {
    const extra = companyOffset < 5 ? 4 : 3;
    const titles = company.jobTitles.slice(0, extra);
    titles.forEach((title, titleOffset) => {
      const skills = JOB_SKILL_SETS[(jobIndex - 1) % JOB_SKILL_SETS.length];
      jobs.push({
        key: `${PRESENTATION_DEMO_PREFIX}-JOB-${pad(jobIndex)}`,
        companyKey: company.key,
        title,
        description: `${NOTICE}\n\nThis ${title} vacancy at ${company.companyName} is a synthetic PeaceOne demonstration posting.\n\nResponsibilities:\n- Support the ${company.industry.toLowerCase()} team using documented PeaceOne processes.\n- Keep records accurate and labelled as demonstration data.\n- Collaborate with other synthetic staff accounts.\n\nThis is not a real employment offer.`,
        qualificationRequired: "Bachelor's degree or equivalent coursework in a related field. Demonstration qualification only.",
        experienceRequired: '0-3 years of relevant coursework or internship-style experience. Demonstration requirement only.',
        employmentType: titleOffset === 3 ? 'INTERNSHIP' : 'FULL_TIME',
        location: company.location,
        salaryMin: 3200 + (titleOffset * 200),
        salaryMax: 4800 + (titleOffset * 300),
        skillLabels: skills,
      });
      jobIndex += 1;
    });
  });
  return jobs;
}

export function buildPresentationCandidates() {
  const candidates = [];
  for (let index = 1; index <= 85; index += 1) {
    const track = TRACKS[(index - 1) % TRACKS.length];
    const first = FIRST_NAMES[(index - 1) % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor((index - 1) / FIRST_NAMES.length) % LAST_NAMES.length];
    const email = `demo-candidate-${pad(index)}@${PRESENTATION_EMAIL_DOMAIN}`;
    candidates.push({
      email,
      role: track.role,
      fullName: `${first} ${last}`,
      phone: `+6012388${pad(index)}`,
      educationLevel: "Bachelor's Degree",
      fieldOfStudy: track.key === 'data' ? 'Information Systems' : 'Computer Science',
      institution: 'PeaceOne Demonstration University',
      graduationYear: 2024 + ((index - 1) % 4),
      location: ['Kuala Lumpur', 'Petaling Jaya, Selangor', 'Penang', 'Johor Bahru, Johor', 'Ipoh, Perak'][(index - 1) % 5],
      experienceSummary: `Synthetic ${track.key} candidate in the PeaceOne FYP expansion dataset. Not a real person.`,
      occupationLabels: track.occupationLabels,
      skillLabels: track.skillLabels,
      resumeTitle: `${first} ${last} demonstration resume`,
      resume: {
        summary: `PeaceOne demonstration resume for ${first} ${last}. Academic synthetic profile only.`,
        education: [
          {
            institution: 'PeaceOne Demonstration University',
            qualification: "Bachelor's Degree",
            fieldOfStudy: track.key === 'marketing' ? 'Communications' : 'Computer Science',
            startYear: 2021,
            endYear: 2024 + ((index - 1) % 4),
          },
        ],
        experience: [
          {
            organization: 'Campus Project Studio (demonstration)',
            jobTitle: 'Project contributor',
            startDate: '2023-01-15',
            endDate: '2024-06-30',
            description: 'Classroom project work stored for PeaceOne FYP walkthroughs. Not paid employment.',
          },
        ],
      },
    });
  }
  return candidates;
}

export function buildPresentationCourses() {
  const specs = [
    { slug: 'presentation-git-collaboration', title: 'Git Collaboration Basics', category: 'SOFTWARE_DEVELOPMENT', skill: 'develop software prototype' },
    { slug: 'presentation-rest-api-hygiene', title: 'HTTP APIs for Classroom Apps', category: 'SOFTWARE_DEVELOPMENT', skill: 'web programming' },
    { slug: 'presentation-spreadsheet-analysis', title: 'Spreadsheet Analysis Habits', category: 'DATA_ANALYTICS', skill: 'perform data analysis' },
    { slug: 'presentation-sql-reporting-checks', title: 'SQL Reporting Checks', category: 'DATA_ANALYTICS', skill: 'SQL' },
    { slug: 'presentation-dashboard-labelling', title: 'Dashboard Labelling Practice', category: 'DATA_ANALYTICS', skill: 'data visualisation software' },
    { slug: 'presentation-campaign-briefs', title: 'Campaign Brief Writing', category: 'DIGITAL_MARKETING', skill: 'digital marketing techniques' },
    { slug: 'presentation-search-snippets', title: 'Honest Search Snippets', category: 'DIGITAL_MARKETING', skill: 'search engine optimisation' },
    { slug: 'presentation-access-control', title: 'Access Control for Shared Labs', category: 'CYBERSECURITY', skill: 'apply information security policies' },
    { slug: 'presentation-cloud-backups', title: 'Classroom Cloud Backups', category: 'CYBERSECURITY', skill: 'cyber security' },
    { slug: 'presentation-wireframe-critiques', title: 'Wireframe Critique Sessions', category: 'SOFTWARE_DEVELOPMENT', skill: 'create website wireframe' },
    { slug: 'presentation-project-status', title: 'Project Status Notes', category: 'SOFTWARE_DEVELOPMENT', skill: 'perform business analysis' },
    { slug: 'presentation-workplace-writing', title: 'Workplace Writing for Tickets', category: 'SOFTWARE_DEVELOPMENT', skill: 'perform business analysis' },
  ];

  return specs.map((item) => course({
    slug: item.slug,
    title: item.title,
    category: item.category,
    difficulty: 'BEGINNER',
    estimatedMinutes: 160,
    targetProficiency: 'Beginner',
    skillLabels: [item.skill],
    description: `${item.title} is original PeaceOne demonstration teaching. It is not a vendor certificate.`,
    objectives: [
      `Restate the main idea of ${item.title.toLowerCase()}`,
      'Complete a short classroom example',
      'Avoid one documented mistake from the lessons',
    ],
    lessons: [
      lesson(1, `Introduction to ${item.title}`, 35, [
        `${item.title} is taught with PeaceOne classroom examples. Treat every dataset as demonstration data.`,
        'Read the definition, then rewrite it in one sentence without copying the heading.',
      ]),
      lesson(2, `Worked example for ${item.title}`, 40, [
        `A worked example uses a 20-row PeaceOne table. Write the input, the action, and the output.`,
        'If a step cannot be shown on paper, it is not part of this demonstration course.',
      ]),
      lesson(3, `Checks and mistakes in ${item.title}`, 40, [
        'List two mistakes that look productive but hide missing evidence.',
        'PeaceOne dashboards should quote stored records, not invented scores.',
      ]),
      lesson(4, `Handoff notes for ${item.title}`, 45, [
        'Write a short handoff: what was done, what remains, and what must not be claimed.',
        'Do not describe this lesson as professional certification.',
      ]),
    ],
    quiz: {
      title: `${item.title} check`,
      passingScore: 70,
      questions: [
        question(1, `This course is…`, ['A vendor certificate', 'Original PeaceOne demonstration teaching', 'A government licence', 'A real job offer'], 1, 'The catalogue description labels it as demonstration teaching.'),
        question(2, 'A worked example should include…', ['Only a slogan', 'Input, action and output', 'A password hash', 'A MASCO code as a Career Target'], 1, 'Lesson 2 requires input, action and output.'),
        question(3, 'Dashboard numbers in PeaceOne should…', ['Be invented to look complete', 'Quote stored records', 'Hide n when n is five', 'Replace ESCO identifiers with nicknames'], 1, 'Lesson 3 forbids invented scores.'),
        question(4, 'Completing the course means…', ['You are professionally certified', 'You finished PeaceOne demonstration lessons and a quiz', 'ESCO mapped itself with AI', 'An offer was accepted'], 1, 'PeaceOne does not issue professional licences.'),
      ],
    },
  }));
}

export const PRESENTATION_COMPANIES = buildPresentationCompanies();
export const PRESENTATION_JOBS = buildPresentationJobs();
export const PRESENTATION_CANDIDATES = buildPresentationCandidates();
export const PRESENTATION_COURSES = buildPresentationCourses();
export const PRESENTATION_CANDIDATE_EMAILS = PRESENTATION_CANDIDATES.map((item) => item.email);
export const PRESENTATION_STAFF_EMAILS = PRESENTATION_COMPANIES.flatMap((company) => company.staff.map((staff) => staff.email));
export const PRESENTATION_REGISTRATIONS = PRESENTATION_COMPANIES.map((item) => item.registrationNumber);
