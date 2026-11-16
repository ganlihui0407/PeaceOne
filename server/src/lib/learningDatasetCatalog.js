import { DEMO_LEARNING_COURSES, course, lesson, question } from './demoLearningCatalog.js';

const FOURTH_LESSONS = {
  'peaceone-demo-power-bi-fundamentals': lesson(4, 'One honest measure', 35, [
    'A measure is a named calculation such as enrolment count or average quiz score. Write the definition in business language first: “count of distinct learners who completed SQL Fundamentals”.',
    'Implement the definition once and reuse it. Duplicate hidden calculations drift, and PeaceOne dashboards should quote the same wording the course uses.',
  ]),
  'peaceone-demo-seo-fundamentals': lesson(4, 'Titles, headings and crawlable text', 30, [
    'Search engines read titles, headings and ordinary HTML text. A PeaceOne course page should have one H1 that matches the query the learner used, not a decorative slogan.',
    'Do not hide the only explanation of a skill inside an image. If JavaScript fails, the title and description should still describe the page.',
  ]),
  'peaceone-demo-social-media-marketing': lesson(4, 'Calendar, owners and a stop rule', 30, [
    'A demonstration calendar lists the channel, the owner, the publish date and the purpose. Without an owner, posts stall; without a purpose, they become noise.',
    'Write a stop rule: if a campaign cannot name the audience and the next action, it does not publish. PeaceOne does not treat likes as employment outcomes.',
  ]),
  'peaceone-demo-digital-marketing-analytics': lesson(4, 'Attribution caution', 35, [
    'Last-click attribution gives all credit to the final link. That is a modelling choice, not a law of nature. Classroom dashboards should label the model they used.',
    'If two channels appear on one journey, say so. Do not invent a PeaceOne “conversion score” from incomplete click logs.',
  ]),
  'peaceone-demo-ui-design-fundamentals': lesson(4, 'Spacing, type and disabled states', 35, [
    'Consistent spacing and readable type matter more than decoration. Disabled buttons need a visible reason, not only a grey fill.',
    'Check a PeaceOne form at a narrow width: labels must remain next to their fields, and primary actions must stay tappable.',
  ]),
  'peaceone-demo-figma-design-essentials': lesson(4, 'From prototype to handoff notes', 35, [
    'A prototype shows the happy path and one error path. Handoff notes list spacing, states and empty copy so an implementer does not guess.',
    'Name frames after the screen, not Frame 47. PeaceOne implementers search the file the same way they search the codebase.',
  ]),
  'peaceone-demo-user-experience-research': lesson(4, 'From notes to a cautious claim', 35, [
    'Cluster observations before recommending a UI change. Two of five classmates missing a button is evidence of a local issue, not national demand.',
    'A PeaceOne report should separate what happened, the hypothesis, and the next test. Do not ship a “proven” redesign from a classroom sample.',
  ]),
  'peaceone-demo-network-security-fundamentals': lesson(4, 'Logging and incident notes', 35, [
    'Logs should record who did what, when, and from which role—without storing passwords or quiz answers. PeaceOne already hides correctOptionId on student quiz GET.',
    'If a demo session is shown on a projector, lock the screen afterwards. Least privilege continues after the lesson ends.',
  ]),
  'peaceone-demo-introduction-to-cybersecurity': lesson(4, 'Reporting a suspected incident', 35, [
    'A classroom incident report names the time, the system, what was seen, and who was told. Do not delete evidence “to tidy up”.',
    'PeaceOne demonstration accounts are for this platform only. A suspected real-account compromise is reported to the institution, not posted in a public chat.',
  ]),
  'peaceone-demo-security-awareness-and-best-practices': lesson(4, 'Devices, screenshots and shared machines', 30, [
    'Lock the viva laptop when you step away. Screenshot redaction is part of the lesson: crop identity numbers and session cookies.',
    'Shared lab machines should sign out of PeaceOne. Remaining sessions are not “extra progress”; they are someone else’s account.',
  ]),
};

const FOURTH_QUESTIONS = {
  'peaceone-demo-sql-fundamentals': question(
    4,
    'HAVING is used to…',
    ['Filter rows before aggregation', 'Filter groups after aggregation', 'Create a table', 'Join two databases'],
    1,
    'WHERE filters rows; HAVING filters groups after GROUP BY. The SQL Fundamentals lesson on reports makes that split explicit.',
  ),
  'peaceone-demo-python-for-data-analysis': question(
    4,
    'Why report the row count next to a percentage?',
    ['It encrypts the notebook', 'A percentage without n can hide a tiny sample', 'It converts dtypes', 'It drops the index'],
    1,
    'Descriptive statistics on a classroom extract can look impressive at 80% when n is five. The lesson requires n beside the percentage.',
  ),
  'peaceone-demo-power-bi-fundamentals': question(
    4,
    'A measure definition should be…',
    ['Hidden in three copies of the same formula', 'Written once in business language and reused', 'A 3-D pie chart', 'A thumbnail URL'],
    1,
    'One named definition prevents drift. Duplicate hidden calculations are how demonstration dashboards disagree.',
  ),
  'peaceone-demo-javascript-programming-fundamentals': question(
    4,
    'Prefer const then let because…',
    ['var is required by ESCO', 'Unintended reassignment is harder with const', 'const encrypts strings', 'let disables ==='],
    1,
    'The values-and-types lesson asks for const by default so demonstration code does not silently overwrite bindings.',
  ),
  'peaceone-demo-react-development-essentials': question(
    4,
    'PeaceOne-style data fetching should store…',
    ['Only the payload', 'Loading, error and payload as separate states', 'The password hash', 'Math.random keys'],
    1,
    'The effects lesson separates loading, error and payload so a failed request cannot be mistaken for an empty catalogue.',
  ),
  'peaceone-demo-rest-api-development': question(
    4,
    'Authorization answers…',
    ['Whether JSON is valid', 'Whether this caller may access this enrolment', 'The database host name', 'The CSS framework'],
    1,
    'Authentication is who you are; authorization is whether you may see this learner’s progress. Students only read their own rows.',
  ),
  'peaceone-demo-seo-fundamentals': question(
    4,
    'The main heading of a course page should…',
    ['Be a decorative slogan only', 'Match the topic a learner searched for', 'Be stored as an image of text', 'Repeat the CSRF token'],
    1,
    'Crawlable text and a single honest H1 are the SEO lesson’s implementation rule for PeaceOne pages.',
  ),
  'peaceone-demo-social-media-marketing': question(
    4,
    'A campaign without a named audience and next action should…',
    ['Publish anyway', 'Not publish (stop rule)', 'Use every channel at once', 'Store likes as UserSkills'],
    1,
    'The calendar lesson requires a stop rule. Likes are not employment outcomes and are not recorded as ESCO skills.',
  ),
  'peaceone-demo-digital-marketing-analytics': question(
    4,
    'Last-click attribution is…',
    ['The only scientifically true model', 'A modelling choice that must be labelled', 'A SQL JOIN type', 'A MASCO unit group'],
    1,
    'The attribution lesson treats last-click as a labelled choice, not a hidden law. Incomplete click logs must not invent a PeaceOne score.',
  ),
  'peaceone-demo-ui-design-fundamentals': question(
    4,
    'A disabled button should…',
    ['Be grey with no explanation', 'Show why it cannot be used', 'Submit the form anyway', 'Hide the label'],
    1,
    'The spacing-and-states lesson requires a visible reason for disabled actions so learners are not stuck on a grey control.',
  ),
  'peaceone-demo-figma-design-essentials': question(
    4,
    'Prototype frames should be named…',
    ['Frame 47', 'After the screen they represent', 'Using Math.random()', 'As SQL table names only'],
    1,
    'Handoff and search fail when every frame is Frame 47. Name screens the way the PeaceOne route is named.',
  ),
  'peaceone-demo-user-experience-research': question(
    4,
    'A classroom sample of five people can…',
    ['Prove national demand', 'Reveal local issues without wide generalisation', 'Replace analytics entirely', 'Award Advanced UserSkills automatically'],
    1,
    'The research lesson allows small samples to surface issues and forbids treating them as national proof or as skill awards.',
  ),
  'peaceone-demo-network-security-fundamentals': question(
    4,
    'Application logs should omit…',
    ['Timestamps', 'Passwords and quiz correctOptionId values', 'Role names', 'Request paths'],
    1,
    'The logging lesson keeps secrets and quiz answers out of logs. PeaceOne already withholds correctOptionId on student quiz GET.',
  ),
  'peaceone-demo-introduction-to-cybersecurity': question(
    4,
    'A suspected incident report should include…',
    ['Only a joke in chat', 'Time, system, what was seen, and who was told', 'The production DATABASE_URL', 'A new ADMIN password posted publicly'],
    1,
    'The reporting lesson requires a factual note, not deleted evidence and not public posting of credentials.',
  ),
  'peaceone-demo-security-awareness-and-best-practices': question(
    4,
    'After using a shared lab machine you should…',
    ['Leave the PeaceOne session open', 'Sign out of the PeaceOne workspace', 'Commit the .env file', 'Email the CSRF secret to the class'],
    1,
    'The device lesson treats leftover sessions as another person’s account, not as bonus progress.',
  ),
};

const EXTRA_COURSES = [
  course({
    slug: 'business-intelligence',
    title: 'Business Intelligence',
    category: 'DATA_ANALYTICS',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 180,
    targetProficiency: 'Intermediate',
    skillLabels: ['business intelligence', 'perform business analysis', 'perform data analysis'],
    description:
      'Original PeaceOne teaching on turning operational questions into trusted reports. Academic demonstration content; not a vendor BI certificate and not an accredited analyst licence.',
    objectives: [
      'Translate a business question into a grain and a metric',
      'Separate operational data from a reporting model',
      'Publish a definition that other people can reuse',
    ],
    lessons: [
      lesson(1, 'Questions before dashboards', 40, [
        '“How many learners completed SQL Fundamentals last month?” is a question. A dashboard without a question is decoration.',
        'Write the decision the report should support. If nobody will change an action after reading it, do not build it for the PeaceOne classroom.',
      ]),
      lesson(2, 'From operations to a reporting model', 45, [
        'Enrolment rows are operational. A reporting table might be one row per learner-month. Copying every column from production into a dashboard creates conflicting totals.',
        'Agree the grain, the filters (published courses only), and the owner of the definition.',
      ]),
      lesson(3, 'Quality rules', 40, [
        'A trusted report names its source, refresh time, and known gaps. Missing quiz attempts are not zero scores unless you document that choice.',
        'PeaceOne does not invent a competence index from incomplete BI extracts.',
      ]),
      lesson(4, 'Publishing a definition', 40, [
        'Put the metric name, formula, and grain in one paragraph that a non-developer can read. Reuse that paragraph in the dashboard title.',
        'When the definition changes, version it. Silent edits are how two teams argue about “the same” completion rate.',
      ]),
    ],
    quiz: {
      title: 'Business Intelligence check',
      passingScore: 67,
      questions: [
        question(1, 'A dashboard should start from…', ['A colour palette', 'A decision-supporting question', 'Every production column', 'A MASCO code'], 1, 'The first lesson forbids decoration-first dashboards.'),
        question(2, 'Reporting grain is…', ['The CSS grid', 'The meaning of one report row', 'A bcrypt hash', 'An interview status'], 1, 'Operational enrolment rows and learner-month rows are different grains.'),
        question(3, 'Missing quiz attempts should be treated as zero only if…', ['The chart looks nicer', 'You document that modelling choice', 'SQL requires it', 'ESCO demands it'], 1, 'Quality rules require documented treatment of missingness.'),
        question(4, 'When a metric definition changes you should…', ['Edit it silently', 'Version the wording so readers notice', 'Delete the dashboard', 'Award UserSkills'], 1, 'Silent edits create two competing “official” rates.'),
      ],
    },
  }),
  course({
    slug: 'data-visualisation-techniques',
    title: 'Data Visualisation Techniques',
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 160,
    targetProficiency: 'Beginner',
    skillLabels: ['data visualisation software', 'perform data analysis'],
    description:
      'PeaceOne lessons on matching chart types to questions and labelling axes honestly. Original classroom material; it does not certify you on a commercial visualisation product.',
    objectives: [
      'Choose bars, lines or tables for the question at hand',
      'Label axes with units and time range',
      'Avoid encodings that hide uncertainty',
    ],
    lessons: [
      lesson(1, 'Match the encoding to the question', 40, [
        'Comparison of categories uses bars. Change over time uses lines. Exact lookup uses a table. 3-D effects do not add information.',
        'If the audience must quote a number, show the table even if a chart exists beside it.',
      ]),
      lesson(2, 'Axes, units and baselines', 40, [
        'Write the unit on the axis: learners, ringgit, minutes. A truncated baseline can exaggerate a small change in enrolments.',
        'PeaceOne demonstration charts should start at zero unless you state why a zoomed axis is required.',
      ]),
      lesson(3, 'Colour and accessibility', 40, [
        'Do not rely on red/green alone. Label the series in the chart, not only in a colour key that fails in greyscale printing.',
        'Classroom projectors wash out pale greys. Prefer contrast that still works on a faded slide.',
      ]),
      lesson(4, 'Uncertainty and small n', 40, [
        'A bar of 80% with n=5 is a different claim than 80% with n=500. Annotate small samples.',
        'Do not animate PeaceOne progress rings as if they were statistically significant employment forecasts.',
      ]),
    ],
    quiz: {
      title: 'Data Visualisation Techniques check',
      passingScore: 67,
      questions: [
        question(1, 'Bars are usually best for…', ['Exact lookup of many decimals', 'Comparing categories', 'Showing a CSS animation', 'Storing UserSkills'], 1, 'The encoding lesson assigns bars to categorical comparison.'),
        question(2, 'Axis labels should include…', ['Only the brand colour', 'Units and, where relevant, the time range', 'The CSRF token', 'The database password'], 1, 'Units and time range are part of an honest axis.'),
        question(3, 'A truncated baseline can…', ['Encrypt the CSV', 'Exaggerate a small change', 'Fix colour blindness', 'Publish a course'], 1, 'Zoomed axes must be justified; they easily overstate enrolment changes.'),
        question(4, 'An 80% bar with n=5 should…', ['Be treated like n=500', 'Be annotated as a small sample', 'Hide n to look cleaner', 'Award Advanced proficiency'], 1, 'Small-n annotation is the uncertainty lesson’s required practice.'),
      ],
    },
  }),
  course({
    slug: 'database-design-fundamentals',
    title: 'Database Design Fundamentals',
    category: 'SOFTWARE_DEVELOPMENT',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 190,
    targetProficiency: 'Intermediate',
    skillLabels: ['design database scheme', 'data models', 'create data models'],
    description:
      'Original PeaceOne material on entities, keys and normalisation using the learning schema as a worked example. Not a vendor DBA certification.',
    objectives: [
      'Name entities, keys and relationships for a small domain',
      'Explain why enrolments are unique on (user, course)',
      'Normalise a repeating group without losing history',
    ],
    lessons: [
      lesson(1, 'Entities, attributes and keys', 45, [
        'An entity is a thing you store once: User, Course, Enrolment. A key identifies a row. PeaceOne uses UUIDs as surrogate keys and still enforces natural uniqueness where it matters.',
        'Email is unique on users. Slug is unique on courses. Those are natural keys living beside the UUID.',
      ]),
      lesson(2, 'Relationships and uniqueness', 50, [
        'LearningEnrollment is unique on (userId, contentId) so a student cannot hold two enrolments for SQL Fundamentals. That is a business rule encoded as a unique constraint.',
        'OccupationSkillRelation is unique on (occupation, skill, relationType). Duplicating the triple would double-count skill gap coverage.',
      ]),
      lesson(3, 'Normalisation and history', 45, [
        'Repeating quiz answers inside the course row would mix catalogue data with one learner’s attempt. Attempts live in LearningAttempt so history can grow without rewriting the course.',
        'Do not store the current application status only; ApplicationStatusEvent keeps the path that produced OFFERED.',
      ]),
      lesson(4, 'Integrity you can test', 50, [
        'Foreign keys reject orphan lesson progress. OnDelete choices differ: cascading a deleted course’s lessons is not the same as restricting job deletion while applications exist.',
        'A PeaceOne classroom check is: count orphans, count duplicate enrolments, and confirm they stay at zero after seeding.',
      ]),
    ],
    quiz: {
      title: 'Database Design Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'A unique constraint on (userId, contentId) prevents…', ['SQL SELECT', 'Two enrolments for the same learner and course', 'ESCO imports', 'CSS overlap'], 1, 'The relationship lesson uses PeaceOne LearningEnrollment as the worked uniqueness rule.'),
        question(2, 'Quiz attempts are stored separately so that…', ['The course row can hold one learner only', 'History can grow without rewriting the catalogue course', 'Passwords stay in plaintext', 'MASCO maps to ESCO'], 1, 'Normalisation keeps catalogue data apart from attempt history.'),
        question(3, 'A foreign key on lesson progress rejects…', ['Published courses', 'Orphan rows pointing at missing lessons', 'Exact ESCO identifiers', 'Pagination'], 1, 'Integrity tests count orphans; FKs are how the database refuses them.'),
        question(4, 'Status events exist because…', ['The current status is enough for history', 'You need the path that produced the current status', 'Prisma cannot store enums', 'JWT replaces sessions'], 1, 'ApplicationStatusEvent and interview events keep the path, not only the latest value.'),
      ],
    },
  }),
];

function mergeCourse(spec) {
  const extraLesson = FOURTH_LESSONS[spec.slug];
  const extraQuestion = FOURTH_QUESTIONS[spec.slug];
  const hasFourthLesson = spec.lessons.some((item) => item.sortOrder === 4);
  return {
    ...spec,
    lessons: extraLesson && !hasFourthLesson ? [...spec.lessons, extraLesson] : spec.lessons,
    quiz: {
      ...spec.quiz,
      questions: extraQuestion
        ? [...spec.quiz.questions.filter((item) => item.sortOrder !== extraQuestion.sortOrder), extraQuestion]
        : spec.quiz.questions,
    },
  };
}

export const LEARNING_DATASET_COURSES = [
  ...DEMO_LEARNING_COURSES.map(mergeCourse),
  ...EXTRA_COURSES,
];

export const LEARNING_DATASET_PROTECTED_SLUGS = [
  'peaceone-demo-sql-fundamentals',
  'peaceone-demo-javascript-programming-fundamentals',
  'peaceone-demo-react-development-essentials',
  'peaceone-demo-python-for-data-analysis',
];
