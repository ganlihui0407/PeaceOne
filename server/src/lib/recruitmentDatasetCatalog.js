export const RECRUITMENT_DATASET_NOTICE =
  'PeaceOne demonstration recruitment dataset. All organisations, people, registration numbers, and vacancies are synthetic academic walkthroughs. They are not real employers or job offers.';

export const PROTECTED_DEMO_EMAILS = [
  'admin@peaceone.demo',
  'hr@techcorp.demo',
  'staff@techcorp.demo',
  'student@peaceone.demo',
  'graduate@peaceone.demo',
];

export const BASE_DEMO_ACCOUNTS = [
  {
    key: 'admin',
    email: 'admin@peaceone.demo',
    role: 'ADMIN',
    fullName: 'Nurul Izzah',
    phone: '+60123450001',
    jobTitle: 'Platform Administrator',
    department: 'PeaceOne Operations',
    location: 'Kuala Lumpur',
    experienceSummary: 'PeaceOne demonstration administrator account for academic FYP walkthroughs.',
  },
  {
    key: 'hr',
    email: 'hr@techcorp.demo',
    role: 'COMPANY_STAFF',
    fullName: 'Priya Nair',
    phone: '+60123450002',
    jobTitle: 'Human Resources Manager',
    department: 'People Operations',
    location: 'Petaling Jaya, Selangor',
    experienceSummary: 'Leads hiring for TechCorp Solutions demonstration jobs in the PeaceOne FYP environment.',
    companyKey: 'techcorp',
  },
  {
    key: 'staff',
    email: 'staff@techcorp.demo',
    role: 'COMPANY_STAFF',
    fullName: 'Daniel Wong',
    phone: '+60123450003',
    jobTitle: 'Talent Coordinator',
    department: 'People Operations',
    location: 'Petaling Jaya, Selangor',
    experienceSummary: 'Supports TechCorp recruitment operations in the PeaceOne demonstration dataset.',
    companyKey: 'techcorp',
  },
  {
    key: 'student',
    email: 'student@peaceone.demo',
    role: 'STUDENT',
    fullName: 'Aisyah Rahman',
    phone: '+60123450004',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Information Systems',
    institution: 'Tunku Abdul Rahman University of Management and Technology',
    graduationYear: 2027,
    location: 'Setapak, Kuala Lumpur',
    experienceSummary:
      'Final-year information systems student exploring data analysis roles. Demonstration profile only; no external certificates are claimed.',
    track: 'data',
    occupationLabels: ['data analyst', 'Data analyst'],
  },
  {
    key: 'graduate',
    email: 'graduate@peaceone.demo',
    role: 'JOB_SEEKER',
    fullName: 'Tan Wei Jie',
    phone: '+60123450005',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Software Engineering',
    institution: 'Universiti Malaya',
    graduationYear: 2025,
    location: 'Subang Jaya, Selangor',
    experienceSummary:
      'Recent software engineering graduate seeking a first developer role. Demonstration profile only; no external certificates are claimed.',
    track: 'software',
    occupationLabels: ['software developer', 'Software developer'],
  },
];

export const DATASET_COMPANIES = [
  {
    key: 'techcorp',
    companyName: 'TechCorp Solutions Sdn. Bhd.',
    registrationNumber: 'DEMO-TECHCORP-2026',
    industry: 'Information technology',
    companySize: '51-200',
    website: 'https://techcorp.demo',
    email: 'hr@techcorp.demo',
    phone: '+60321000000',
    location: 'Petaling Jaya, Selangor',
    address: 'Level 12, TechCorp Tower, Jalan Utara, 46200 Petaling Jaya, Selangor',
    description:
      'Demonstration employer used in the PeaceOne FYP environment. TechCorp Solutions Sdn. Bhd. is a synthetic company for academic walkthroughs of job posting, applications, and interviews.',
    staff: [],
  },
  {
    key: 'nexa',
    companyName: 'Nexa Digital Solutions Sdn. Bhd.',
    registrationNumber: 'DEMO-NEXA-2026',
    industry: 'Software and digital products',
    companySize: '11-50',
    website: 'https://nexa.peaceone.demo',
    email: 'hr@nexa.peaceone.demo',
    phone: '+60321001001',
    location: 'Bangsar South, Kuala Lumpur',
    address: 'Unit 8, Nexa Studio, Bangsar South, 59200 Kuala Lumpur',
    description:
      'Fictional product studio in the PeaceOne demonstration dataset. Nexa Digital Solutions Sdn. Bhd. does not exist outside this academic environment.',
    staff: [
      {
        email: 'hr@nexa.peaceone.demo',
        fullName: 'Lina Abdullah',
        phone: '+60123451001',
        jobTitle: 'People Partner',
        department: 'People',
        location: 'Bangsar South, Kuala Lumpur',
        experienceSummary: 'Demonstration HR account for Nexa Digital Solutions.',
      },
    ],
  },
  {
    key: 'brightwave',
    companyName: 'BrightWave Media Sdn. Bhd.',
    registrationNumber: 'DEMO-BRIGHTWAVE-2026',
    industry: 'Digital media and marketing',
    companySize: '11-50',
    website: 'https://brightwave.peaceone.demo',
    email: 'hr@brightwave.peaceone.demo',
    phone: '+60321001002',
    location: 'George Town, Penang',
    address: 'Level 3, Wave House, Jalan Sultan Ahmad Shah, 10050 George Town, Penang',
    description:
      'Fictional media agency used only for PeaceOne recruitment walkthroughs. BrightWave Media Sdn. Bhd. is not a real registered business.',
    staff: [
      {
        email: 'hr@brightwave.peaceone.demo',
        fullName: 'Marcus Goh',
        phone: '+60123451002',
        jobTitle: 'Talent Lead',
        department: 'People',
        location: 'George Town, Penang',
        experienceSummary: 'Demonstration HR account for BrightWave Media.',
      },
    ],
  },
  {
    key: 'finedge',
    companyName: 'FinEdge Analytics Sdn. Bhd.',
    registrationNumber: 'DEMO-FINEDGE-2026',
    industry: 'Analytics and business intelligence',
    companySize: '51-200',
    website: 'https://finedge.peaceone.demo',
    email: 'hr@finedge.peaceone.demo',
    phone: '+60321001003',
    location: 'Cyberjaya, Selangor',
    address: 'Block B, FinEdge Park, 63000 Cyberjaya, Selangor',
    description:
      'Fictional analytics consultancy in the PeaceOne demonstration dataset. FinEdge Analytics Sdn. Bhd. makes no real-world hiring claims.',
    staff: [
      {
        email: 'hr@finedge.peaceone.demo',
        fullName: 'Siti Mariam',
        phone: '+60123451003',
        jobTitle: 'Recruitment Manager',
        department: 'People',
        location: 'Cyberjaya, Selangor',
        experienceSummary: 'Demonstration HR account for FinEdge Analytics.',
      },
    ],
  },
  {
    key: 'cloudmatrix',
    companyName: 'CloudMatrix Technologies Sdn. Bhd.',
    registrationNumber: 'DEMO-CLOUDMATRIX-2026',
    industry: 'Cloud infrastructure and security',
    companySize: '51-200',
    website: 'https://cloudmatrix.peaceone.demo',
    email: 'hr@cloudmatrix.peaceone.demo',
    phone: '+60321001004',
    location: 'Johor Bahru, Johor',
    address: 'Level 5, Matrix Tower, Jalan Wong Ah Fook, 80000 Johor Bahru, Johor',
    description:
      'Fictional infrastructure firm used for PeaceOne IT support and cybersecurity demonstration vacancies. CloudMatrix Technologies Sdn. Bhd. is synthetic.',
    staff: [
      {
        email: 'hr@cloudmatrix.peaceone.demo',
        fullName: 'Rachel Chong',
        phone: '+60123451004',
        jobTitle: 'HR Specialist',
        department: 'People',
        location: 'Johor Bahru, Johor',
        experienceSummary: 'Demonstration HR account for CloudMatrix Technologies.',
      },
    ],
  },
];

export const DATASET_JOBS = [
  {
    companyKey: 'techcorp',
    title: 'Junior Data Analyst',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: clean classroom-scale tables, write SQL filters, document assumptions, and prepare descriptive charts for demonstration stakeholders.

Qualifications: diploma or bachelor's study in a quantitative or computing field. Internships and final-year projects are welcome.

This vacancy exists only inside the PeaceOne FYP environment.`,
    qualificationRequired: "Diploma or bachelor's degree in a quantitative, computing, or related field.",
    experienceRequired: '0–2 years. Internships, final-year projects, or course assignments are welcome.',
    employmentType: 'FULL_TIME',
    location: 'Petaling Jaya, Selangor (hybrid)',
    salaryMin: 3500,
    salaryMax: 4800,
    skillLabels: ['SQL', 'Python (computer programming)', 'perform data analysis', 'statistics'],
  },
  {
    companyKey: 'techcorp',
    title: 'Software Developer',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: maintain internal web services, review JavaScript changes, use version control, and write short implementation notes.

Qualifications: bachelor's study in software engineering or computer science, or equivalent academic projects.

Demonstration posting only.`,
    qualificationRequired: "Bachelor's degree in software engineering, computer science, or equivalent project experience.",
    experienceRequired: '0–3 years, including internships or substantial personal/academic projects.',
    employmentType: 'FULL_TIME',
    location: 'Kuala Lumpur',
    salaryMin: 4200,
    salaryMax: 6200,
    skillLabels: ['JavaScript', 'develop software prototype', 'web programming'],
  },
  {
    companyKey: 'nexa',
    title: 'Python Developer',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: write Python services, cover edge cases with tests, and document APIs for demonstration product teams.

Qualifications: bachelor's study or equivalent project portfolio with Python.`,
    qualificationRequired: "Bachelor's degree in computing or equivalent Python project experience.",
    experienceRequired: '0–3 years including internships.',
    employmentType: 'FULL_TIME',
    location: 'Bangsar South, Kuala Lumpur (hybrid)',
    salaryMin: 4500,
    salaryMax: 6800,
    skillLabels: ['Python (computer programming)', 'develop software prototype', 'web programming'],
  },
  {
    companyKey: 'nexa',
    title: 'UI/UX Designer',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: produce wireframes, check empty and error states, and hand off spacing notes to implementers.

Qualifications: diploma or bachelor's study in design, HCI, or a related field, plus a small academic portfolio.`,
    qualificationRequired: "Diploma or bachelor's degree in design, HCI, or related study.",
    experienceRequired: '0–2 years including studio projects.',
    employmentType: 'FULL_TIME',
    location: 'Bangsar South, Kuala Lumpur',
    salaryMin: 3800,
    salaryMax: 5500,
    skillLabels: ['design user interface', 'translate requirements into visual design', 'create website wireframe'],
  },
  {
    companyKey: 'brightwave',
    title: 'Digital Marketing Executive',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: plan channel calendars, write campaign briefs, and report reach with sample size, not vanity metrics.

Qualifications: diploma or bachelor's study in marketing or communications.`,
    qualificationRequired: "Diploma or bachelor's degree in marketing, communications, or a related field.",
    experienceRequired: '0–2 years in digital marketing, campus media, or related project work.',
    employmentType: 'FULL_TIME',
    location: 'George Town, Penang',
    salaryMin: 3200,
    salaryMax: 4500,
    skillLabels: ['digital marketing techniques', 'apply social media marketing', 'social media marketing techniques'],
  },
  {
    companyKey: 'brightwave',
    title: 'SEO Specialist',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: audit titles and headings, propose crawlable copy, and report ranking changes with caveats.

Qualifications: diploma or bachelor's study plus evidence of search-optimisation coursework.`,
    qualificationRequired: "Diploma or bachelor's degree in marketing, communications, or related study.",
    experienceRequired: '0–2 years including academic SEO projects.',
    employmentType: 'FULL_TIME',
    location: 'George Town, Penang (remote-friendly)',
    salaryMin: 3400,
    salaryMax: 5000,
    skillLabels: ['search engine optimisation', 'conduct search engine optimisation', 'digital marketing techniques'],
  },
  {
    companyKey: 'finedge',
    title: 'Business Analyst',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: interview demonstration stakeholders, write acceptance criteria, and separate facts from recommendations.

Qualifications: bachelor's study in information systems, business, or related field.`,
    qualificationRequired: "Bachelor's degree in information systems, business, or a related field.",
    experienceRequired: '0–3 years including internships.',
    employmentType: 'FULL_TIME',
    location: 'Cyberjaya, Selangor',
    salaryMin: 4000,
    salaryMax: 6000,
    skillLabels: ['perform business analysis', 'perform data analysis', 'business intelligence'],
  },
  {
    companyKey: 'finedge',
    title: 'Power BI Analyst',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: model demonstration tables, write one named measure per metric, and label chart caveats.

Qualifications: diploma or bachelor's study with evidence of dashboard coursework.`,
    qualificationRequired: "Diploma or bachelor's degree in a quantitative or computing field.",
    experienceRequired: '0–2 years including academic dashboards.',
    employmentType: 'FULL_TIME',
    location: 'Cyberjaya, Selangor (hybrid)',
    salaryMin: 3800,
    salaryMax: 5600,
    skillLabels: ['data visualisation software', 'business intelligence', 'perform data analysis'],
  },
  {
    companyKey: 'cloudmatrix',
    title: 'IT Support Specialist',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: triage demonstration tickets, document reproduction steps, and escalate security-sensitive issues.

Qualifications: diploma in ICT or equivalent helpdesk internship.`,
    qualificationRequired: 'Diploma in ICT, computer science, or equivalent support experience.',
    experienceRequired: '0–2 years including campus IT support.',
    employmentType: 'FULL_TIME',
    location: 'Johor Bahru, Johor',
    salaryMin: 3000,
    salaryMax: 4200,
    skillLabels: ['ICT help platforms', 'SQL', 'web programming'],
  },
  {
    companyKey: 'cloudmatrix',
    title: 'Cybersecurity Analyst',
    description: `${RECRUITMENT_DATASET_NOTICE}

Responsibilities: review access logs, write incident notes, and check least-privilege on demonstration accounts.

Qualifications: bachelor's study in cybersecurity, computer science, or related field.`,
    qualificationRequired: "Bachelor's degree in cybersecurity, computer science, or related study.",
    experienceRequired: '0–3 years including academic security labs.',
    employmentType: 'FULL_TIME',
    location: 'Johor Bahru, Johor (hybrid)',
    salaryMin: 4500,
    salaryMax: 7000,
    skillLabels: ['cyber security', 'ICT network security risks', 'apply information security policies'],
  },
];

function candidate(spec) {
  return {
    ...spec,
    email: spec.email,
    role: spec.role || 'JOB_SEEKER',
  };
}

export const DATASET_CANDIDATES = [
  {
    email: 'student@peaceone.demo',
    preserveExisting: true,
    resumeTitle: 'Demonstration Resume — Aisyah Rahman',
    skillLabels: [
      { labels: ['SQL'], proficiencyLevel: 'Intermediate' },
      { labels: ['Python (computer programming)', 'Python'], proficiencyLevel: 'Beginner' },
      { labels: ['perform data analysis'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['data analyst', 'Data analyst'],
    resume: {
      summary:
        'Final-year information systems student (demonstration). Comfortable with SQL filters and small Python notebooks. Not a professional credential.',
      education: [
        {
          institution: 'Tunku Abdul Rahman University of Management and Technology',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Information Systems',
          startYear: 2023,
          endYear: 2027,
          notes: 'PeaceOne demonstration education record.',
        },
      ],
      experience: [
        {
          jobTitle: 'Analytics intern (demonstration)',
          organization: 'Campus data lab (fictional)',
          location: 'Kuala Lumpur',
          startDate: '2025-06-01',
          endDate: '2025-08-31',
          description: 'Cleaned a 20-row enrolment extract and wrote SQL filters for a classroom dashboard.',
        },
      ],
    },
  },
  {
    email: 'graduate@peaceone.demo',
    preserveExisting: true,
    resumeTitle: 'Demonstration Resume — Tan Wei Jie',
    skillLabels: [
      { labels: ['JavaScript'], proficiencyLevel: 'Intermediate' },
      { labels: ['develop software prototype'], proficiencyLevel: 'Beginner' },
      { labels: ['web programming'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['software developer', 'Software developer'],
    resume: {
      summary:
        'Recent software engineering graduate (demonstration) seeking a first developer role. Academic projects only.',
      education: [
        {
          institution: 'Universiti Malaya',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Software Engineering',
          startYear: 2021,
          endYear: 2025,
          notes: 'PeaceOne demonstration education record.',
        },
      ],
      experience: [
        {
          jobTitle: 'Software intern (demonstration)',
          organization: 'Campus web studio (fictional)',
          location: 'Kuala Lumpur',
          startDate: '2024-05-01',
          endDate: '2024-08-15',
          description: 'Maintained a JavaScript form wizard and wrote Git commit notes for a class project.',
        },
      ],
    },
  },
  candidate({
    email: 'p17-nurul.huda@peaceone.demo',
    fullName: 'Nurul Huda Ismail',
    phone: '+60123452001',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Statistics',
    institution: 'Universiti Sains Malaysia',
    graduationYear: 2025,
    location: 'Gelugor, Penang',
    experienceSummary: 'Demonstration graduate with coursework in descriptive statistics and SQL.',
    resumeTitle: 'PeaceOne demonstration resume — Nurul Huda Ismail',
    skillLabels: [
      { labels: ['SQL'], proficiencyLevel: 'Advanced' },
      { labels: ['statistics'], proficiencyLevel: 'Intermediate' },
      { labels: ['perform data analysis'], proficiencyLevel: 'Intermediate' },
      { labels: ['data visualisation software'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['data analyst', 'Data analyst'],
    resume: {
      summary: 'Statistics graduate (demonstration) who prefers labelled measures over decorative charts.',
      education: [
        {
          institution: 'Universiti Sains Malaysia',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Statistics',
          startYear: 2021,
          endYear: 2025,
        },
      ],
      experience: [
        {
          jobTitle: 'Research assistant (demonstration)',
          organization: 'Faculty statistics clinic (fictional)',
          location: 'Penang',
          startDate: '2024-09-01',
          endDate: '2025-03-31',
          description: 'Helped classmates write SQL extracts and report n beside percentages.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-lim.junhao@peaceone.demo',
    fullName: 'Lim Jun Hao',
    phone: '+60123452002',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Computer Science',
    institution: 'Universiti Teknologi Malaysia',
    graduationYear: 2024,
    location: 'Skudai, Johor',
    experienceSummary: 'Demonstration software graduate with JavaScript and Git coursework.',
    resumeTitle: 'PeaceOne demonstration resume — Lim Jun Hao',
    skillLabels: [
      { labels: ['JavaScript'], proficiencyLevel: 'Advanced' },
      { labels: ['web programming'], proficiencyLevel: 'Intermediate' },
      { labels: ['develop software prototype'], proficiencyLevel: 'Intermediate' },
      { labels: ['Python (computer programming)'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['software developer', 'Software developer'],
    resume: {
      summary: 'Computer science graduate (demonstration) focused on readable JavaScript and small APIs.',
      education: [
        {
          institution: 'Universiti Teknologi Malaysia',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Computer Science',
          startYear: 2020,
          endYear: 2024,
        },
      ],
      experience: [
        {
          jobTitle: 'Teaching assistant (demonstration)',
          organization: 'UTM programming lab (fictional)',
          location: 'Johor',
          startDate: '2023-09-01',
          endDate: '2024-05-31',
          description: 'Reviewed student Git history and explained failing tests without rewriting their work.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-priya.sundaram@peaceone.demo',
    fullName: 'Priya Sundaram',
    phone: '+60123452003',
    role: 'STUDENT',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Software Engineering',
    institution: 'Multimedia University',
    graduationYear: 2027,
    location: 'Cyberjaya, Selangor',
    experienceSummary: 'Demonstration student combining software projects with interface sketches.',
    resumeTitle: 'PeaceOne demonstration resume — Priya Sundaram',
    skillLabels: [
      { labels: ['JavaScript'], proficiencyLevel: 'Intermediate' },
      { labels: ['design user interface'], proficiencyLevel: 'Beginner' },
      { labels: ['develop software prototype'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['software developer', 'Software developer'],
    resume: {
      summary: 'Software engineering student (demonstration) with a small UI sketchbook and JavaScript coursework.',
      education: [
        {
          institution: 'Multimedia University',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Software Engineering',
          startYear: 2023,
          endYear: 2027,
        },
      ],
      experience: [],
    },
  }),
  candidate({
    email: 'p17-amira.zakaria@peaceone.demo',
    fullName: 'Amira Zakaria',
    phone: '+60123452004',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Mass Communication',
    institution: 'Universiti Teknologi MARA',
    graduationYear: 2025,
    location: 'Shah Alam, Selangor',
    experienceSummary: 'Demonstration marketer with campus media and search-copy coursework.',
    resumeTitle: 'PeaceOne demonstration resume — Amira Zakaria',
    skillLabels: [
      { labels: ['digital marketing techniques'], proficiencyLevel: 'Intermediate' },
      { labels: ['apply social media marketing'], proficiencyLevel: 'Intermediate' },
      { labels: ['search engine optimisation'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['digital marketing manager', 'Digital marketing manager'],
    resume: {
      summary: 'Mass communication graduate (demonstration) who writes campaign briefs with a stop rule.',
      education: [
        {
          institution: 'Universiti Teknologi MARA',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Mass Communication',
          startYear: 2021,
          endYear: 2025,
        },
      ],
      experience: [
        {
          jobTitle: 'Campus media intern (demonstration)',
          organization: 'UiTM student media (fictional)',
          location: 'Shah Alam',
          startDate: '2024-01-08',
          endDate: '2024-06-30',
          description: 'Scheduled posts and labelled which audience each item was for.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-kevin.ong@peaceone.demo',
    fullName: 'Kevin Ong',
    phone: '+60123452005',
    educationLevel: 'Diploma',
    fieldOfStudy: 'Digital Marketing',
    institution: 'SEGi College',
    graduationYear: 2024,
    location: 'Subang Jaya, Selangor',
    experienceSummary: 'Demonstration diploma holder focused on search copy rather than paid ads.',
    resumeTitle: 'PeaceOne demonstration resume — Kevin Ong',
    skillLabels: [
      { labels: ['search engine optimisation'], proficiencyLevel: 'Intermediate' },
      { labels: ['conduct search engine optimisation'], proficiencyLevel: 'Beginner' },
      { labels: ['digital marketing techniques'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['digital marketing manager', 'Digital marketing manager'],
    resume: {
      summary: 'Digital marketing diploma (demonstration). Prefers crawlable titles over slogan-only pages.',
      education: [
        {
          institution: 'SEGi College',
          qualification: 'Diploma',
          fieldOfStudy: 'Digital Marketing',
          startYear: 2022,
          endYear: 2024,
        },
      ],
      experience: [],
    },
  }),
  candidate({
    email: 'p17-sofia.lee@peaceone.demo',
    fullName: 'Sofia Lee',
    phone: '+60123452006',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Graphic Design',
    institution: 'The One Academy',
    graduationYear: 2024,
    location: 'Bandar Sunway, Selangor',
    experienceSummary: 'Demonstration designer with wireframe and empty-state coursework.',
    resumeTitle: 'PeaceOne demonstration resume — Sofia Lee',
    skillLabels: [
      { labels: ['design user interface'], proficiencyLevel: 'Advanced' },
      { labels: ['create website wireframe'], proficiencyLevel: 'Intermediate' },
      { labels: ['translate requirements into visual design'], proficiencyLevel: 'Intermediate' },
    ],
    occupationLabels: ['user interface designer', 'User interface designer'],
    resume: {
      summary: 'Graphic design graduate (demonstration) who documents disabled states before decoration.',
      education: [
        {
          institution: 'The One Academy',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Graphic Design',
          startYear: 2021,
          endYear: 2024,
        },
      ],
      experience: [
        {
          jobTitle: 'Studio intern (demonstration)',
          organization: 'Classroom design studio (fictional)',
          location: 'Sunway',
          startDate: '2023-06-01',
          endDate: '2023-09-01',
          description: 'Produced three mobile wireframes and a handoff note for spacing.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-mei.ling.chong@peaceone.demo',
    fullName: 'Chong Mei Ling',
    phone: '+60123452007',
    role: 'STUDENT',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Advertising',
    institution: 'Taylor\'s University',
    graduationYear: 2026,
    location: 'Subang Jaya, Selangor',
    experienceSummary: 'Demonstration student exploring marketing and light interface work.',
    resumeTitle: 'PeaceOne demonstration resume — Chong Mei Ling',
    skillLabels: [
      { labels: ['digital marketing techniques'], proficiencyLevel: 'Beginner' },
      { labels: ['design user interface'], proficiencyLevel: 'Beginner' },
      { labels: ['apply social media marketing'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['digital marketing manager', 'Digital marketing manager'],
    resume: {
      summary: 'Advertising student (demonstration) with campus campaign coursework.',
      education: [
        {
          institution: "Taylor's University",
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Advertising',
          startYear: 2023,
          endYear: 2026,
        },
      ],
      experience: [],
    },
  }),
  candidate({
    email: 'p17-hafiz.rahman@peaceone.demo',
    fullName: 'Hafiz Rahman',
    phone: '+60123452008',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Cybersecurity',
    institution: 'Universiti Putra Malaysia',
    graduationYear: 2025,
    location: 'Serdang, Selangor',
    experienceSummary: 'Demonstration cybersecurity graduate with logging and incident-note labs.',
    resumeTitle: 'PeaceOne demonstration resume — Hafiz Rahman',
    skillLabels: [
      { labels: ['cyber security'], proficiencyLevel: 'Intermediate' },
      { labels: ['ICT network security risks'], proficiencyLevel: 'Intermediate' },
      { labels: ['apply information security policies'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['ICT security technician', 'ICT security specialist'],
    resume: {
      summary: 'Cybersecurity graduate (demonstration). Writes incident notes; does not claim vendor certificates.',
      education: [
        {
          institution: 'Universiti Putra Malaysia',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Cybersecurity',
          startYear: 2021,
          endYear: 2025,
        },
      ],
      experience: [
        {
          jobTitle: 'SOC observer intern (demonstration)',
          organization: 'Campus security lab (fictional)',
          location: 'Serdang',
          startDate: '2024-07-01',
          endDate: '2024-10-31',
          description: 'Reviewed access logs and practised least-privilege checklists on demo accounts.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-jasmine.teo@peaceone.demo',
    fullName: 'Jasmine Teo',
    phone: '+60123452009',
    educationLevel: 'Diploma',
    fieldOfStudy: 'Information Technology',
    institution: 'Politeknik Sultan Salahuddin Abdul Aziz Shah',
    graduationYear: 2024,
    location: 'Shah Alam, Selangor',
    experienceSummary: 'Demonstration diploma holder interested in support and security hygiene.',
    resumeTitle: 'PeaceOne demonstration resume — Jasmine Teo',
    skillLabels: [
      { labels: ['cyber security'], proficiencyLevel: 'Beginner' },
      { labels: ['SQL'], proficiencyLevel: 'Beginner' },
      { labels: ['web programming'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['ICT security technician', 'ICT security specialist'],
    resume: {
      summary: 'IT diploma graduate (demonstration) documenting tickets before escalating them.',
      education: [
        {
          institution: 'Politeknik Sultan Salahuddin Abdul Aziz Shah',
          qualification: 'Diploma',
          fieldOfStudy: 'Information Technology',
          startYear: 2021,
          endYear: 2024,
        },
      ],
      experience: [
        {
          jobTitle: 'Helpdesk intern (demonstration)',
          organization: 'Polytechnic ICT unit (fictional)',
          location: 'Shah Alam',
          startDate: '2023-11-01',
          endDate: '2024-02-28',
          description: 'Logged reproduction steps for classroom Wi-Fi issues.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-arjun.nair@peaceone.demo',
    fullName: 'Arjun Nair',
    phone: '+60123452010',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Business Information Systems',
    institution: 'Sunway University',
    graduationYear: 2025,
    location: 'Bandar Sunway, Selangor',
    experienceSummary: 'Demonstration analyst who writes acceptance criteria from interviews.',
    resumeTitle: 'PeaceOne demonstration resume — Arjun Nair',
    skillLabels: [
      { labels: ['perform business analysis'], proficiencyLevel: 'Intermediate' },
      { labels: ['perform data analysis'], proficiencyLevel: 'Beginner' },
      { labels: ['business intelligence'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['business analyst', 'Business analyst'],
    resume: {
      summary: 'BIS graduate (demonstration) separating stakeholder wants from measurable acceptance tests.',
      education: [
        {
          institution: 'Sunway University',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Business Information Systems',
          startYear: 2021,
          endYear: 2025,
        },
      ],
      experience: [
        {
          jobTitle: 'Process intern (demonstration)',
          organization: 'Faculty operations desk (fictional)',
          location: 'Sunway',
          startDate: '2024-03-01',
          endDate: '2024-08-31',
          description: 'Mapped enrolment request steps and listed one exception path.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-wei.shan.tan@peaceone.demo',
    fullName: 'Tan Wei Shan',
    phone: '+60123452011',
    educationLevel: 'Diploma',
    fieldOfStudy: 'Computer Networking',
    institution: 'Asia Pacific University',
    graduationYear: 2023,
    location: 'Bukit Jalil, Kuala Lumpur',
    experienceSummary: 'Demonstration support specialist with networking diploma coursework.',
    resumeTitle: 'PeaceOne demonstration resume — Tan Wei Shan',
    skillLabels: [
      { labels: ['ICT help platforms'], proficiencyLevel: 'Intermediate' },
      { labels: ['SQL'], proficiencyLevel: 'Beginner' },
      { labels: ['web programming'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['software developer', 'Software developer'],
    resume: {
      summary: 'Networking diploma holder (demonstration) applying for IT support walkthroughs.',
      education: [
        {
          institution: 'Asia Pacific University',
          qualification: 'Diploma',
          fieldOfStudy: 'Computer Networking',
          startYear: 2021,
          endYear: 2023,
        },
      ],
      experience: [
        {
          jobTitle: 'Campus support intern (demonstration)',
          organization: 'APU ICT desk (fictional)',
          location: 'Kuala Lumpur',
          startDate: '2023-01-09',
          isCurrent: true,
          description: 'Triages printer and account-lock tickets for a fictional lab.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-danial.aziz@peaceone.demo',
    fullName: 'Danial Aziz',
    phone: '+60123452012',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Accounting and Finance',
    institution: 'Universiti Malaya',
    graduationYear: 2024,
    location: 'Petaling Jaya, Selangor',
    experienceSummary: 'Demonstration finance graduate pivoting into business analysis.',
    resumeTitle: 'PeaceOne demonstration resume — Danial Aziz',
    skillLabels: [
      { labels: ['perform business analysis'], proficiencyLevel: 'Beginner' },
      { labels: ['perform data analysis'], proficiencyLevel: 'Intermediate' },
      { labels: ['SQL'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['business analyst', 'Business analyst'],
    resume: {
      summary: 'Accounting graduate (demonstration) documenting assumptions before recommending a process change.',
      education: [
        {
          institution: 'Universiti Malaya',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Accounting and Finance',
          startYear: 2020,
          endYear: 2024,
        },
      ],
      experience: [
        {
          jobTitle: 'Audit intern (demonstration)',
          organization: 'Campus finance office (fictional)',
          location: 'Kuala Lumpur',
          startDate: '2023-06-01',
          endDate: '2023-09-30',
          description: 'Reconciled a 30-row demonstration ledger and listed unmatched items.',
        },
      ],
    },
  }),
  candidate({
    email: 'p17-farah.izani@peaceone.demo',
    fullName: 'Farah Izani',
    phone: '+60123452013',
    role: 'STUDENT',
    educationLevel: "Bachelor's Degree",
    fieldOfStudy: 'Interaction Design',
    institution: 'Universiti Malaysia Sarawak',
    graduationYear: 2027,
    location: 'Kota Samarahan, Sarawak',
    experienceSummary: 'Demonstration design student with wireframe coursework.',
    resumeTitle: 'PeaceOne demonstration resume — Farah Izani',
    skillLabels: [
      { labels: ['design user interface'], proficiencyLevel: 'Intermediate' },
      { labels: ['create website wireframe'], proficiencyLevel: 'Beginner' },
      { labels: ['translate requirements into visual design'], proficiencyLevel: 'Beginner' },
    ],
    occupationLabels: ['user interface designer', 'User interface designer'],
    resume: {
      summary: 'Interaction design student (demonstration) practising empty states and readable type.',
      education: [
        {
          institution: 'Universiti Malaysia Sarawak',
          qualification: "Bachelor's Degree",
          fieldOfStudy: 'Interaction Design',
          startYear: 2023,
          endYear: 2027,
        },
      ],
      experience: [],
    },
  }),
];

export const DATASET_APPLICATIONS = [
  {
    candidateEmail: 'student@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Junior Data Analyst',
    actions: ['shortlist'],
    interview: { title: 'Junior Data Analyst — first-round interview', flow: 'accept', daysAhead: 14, hour: 10 },
  },
  {
    candidateEmail: 'graduate@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Software Developer',
    actions: [],
  },
  {
    candidateEmail: 'student@peaceone.demo',
    companyKey: 'finedge',
    jobTitle: 'Power BI Analyst',
    actions: ['review'],
  },
  {
    candidateEmail: 'student@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'Python Developer',
    actions: [],
  },
  {
    candidateEmail: 'graduate@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'Python Developer',
    actions: ['shortlist'],
    interview: { title: 'Python Developer — screening', flow: 'accept', daysAhead: 16, hour: 11 },
  },
  {
    candidateEmail: 'graduate@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Junior Data Analyst',
    actions: [],
  },
  {
    candidateEmail: 'p17-nurul.huda@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Junior Data Analyst',
    actions: ['shortlist'],
  },
  {
    candidateEmail: 'p17-nurul.huda@peaceone.demo',
    companyKey: 'finedge',
    jobTitle: 'Power BI Analyst',
    actions: ['shortlist', 'offer'],
  },
  {
    candidateEmail: 'p17-lim.junhao@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Software Developer',
    actions: ['review'],
  },
  {
    candidateEmail: 'p17-lim.junhao@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'Python Developer',
    actions: ['shortlist'],
    interview: { title: 'Python Developer — proposed screen', flow: 'propose', daysAhead: 18, hour: 9 },
  },
  {
    candidateEmail: 'p17-priya.sundaram@peaceone.demo',
    companyKey: 'techcorp',
    jobTitle: 'Software Developer',
    actions: ['reject'],
  },
  {
    candidateEmail: 'p17-priya.sundaram@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'UI/UX Designer',
    actions: [],
  },
  {
    candidateEmail: 'p17-amira.zakaria@peaceone.demo',
    companyKey: 'brightwave',
    jobTitle: 'Digital Marketing Executive',
    actions: ['shortlist'],
  },
  {
    candidateEmail: 'p17-amira.zakaria@peaceone.demo',
    companyKey: 'brightwave',
    jobTitle: 'SEO Specialist',
    actions: ['review'],
  },
  {
    candidateEmail: 'p17-kevin.ong@peaceone.demo',
    companyKey: 'brightwave',
    jobTitle: 'Digital Marketing Executive',
    actions: [],
  },
  {
    candidateEmail: 'p17-kevin.ong@peaceone.demo',
    companyKey: 'brightwave',
    jobTitle: 'SEO Specialist',
    actions: ['reject'],
  },
  {
    candidateEmail: 'p17-sofia.lee@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'UI/UX Designer',
    actions: ['shortlist'],
    interview: { title: 'UI/UX Designer — portfolio review', flow: 'complete', daysAhead: 21, hour: 14 },
  },
  {
    candidateEmail: 'p17-farah.izani@peaceone.demo',
    companyKey: 'nexa',
    jobTitle: 'UI/UX Designer',
    actions: [],
  },
  {
    candidateEmail: 'p17-mei.ling.chong@peaceone.demo',
    companyKey: 'brightwave',
    jobTitle: 'Digital Marketing Executive',
    actions: [],
  },
  {
    candidateEmail: 'p17-hafiz.rahman@peaceone.demo',
    companyKey: 'cloudmatrix',
    jobTitle: 'Cybersecurity Analyst',
    actions: ['shortlist'],
    interview: { title: 'Cybersecurity Analyst — cancelled screen', flow: 'cancel', daysAhead: 12, hour: 15 },
  },
  {
    candidateEmail: 'p17-hafiz.rahman@peaceone.demo',
    companyKey: 'cloudmatrix',
    jobTitle: 'IT Support Specialist',
    actions: [],
  },
  {
    candidateEmail: 'p17-jasmine.teo@peaceone.demo',
    companyKey: 'cloudmatrix',
    jobTitle: 'Cybersecurity Analyst',
    actions: ['review'],
  },
  {
    candidateEmail: 'p17-arjun.nair@peaceone.demo',
    companyKey: 'finedge',
    jobTitle: 'Business Analyst',
    actions: ['shortlist'],
    interview: { title: 'Business Analyst — case discussion', flow: 'reschedule', daysAhead: 19, hour: 10 },
  },
  {
    candidateEmail: 'p17-wei.shan.tan@peaceone.demo',
    companyKey: 'cloudmatrix',
    jobTitle: 'IT Support Specialist',
    actions: [],
  },
  {
    candidateEmail: 'p17-danial.aziz@peaceone.demo',
    companyKey: 'finedge',
    jobTitle: 'Business Analyst',
    actions: ['shortlist', 'offer'],
  },
];

export const DATASET_CANDIDATE_EMAILS = DATASET_CANDIDATES.map((item) => item.email);
export const DATASET_COMPANY_REGISTRATIONS = DATASET_COMPANIES.map((item) => item.registrationNumber);
export const DATASET_STAFF_EMAILS = [
  'hr@techcorp.demo',
  'staff@techcorp.demo',
  ...DATASET_COMPANIES.flatMap((company) => company.staff.map((staff) => staff.email)),
];
