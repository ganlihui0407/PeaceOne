export const DEMO_LEARNING_SLUG_PREFIX = 'peaceone-demo-';

export function lesson(sortOrder, title, minutes, paragraphs) {
  const intro = paragraphs[0] || '';
  const explanation = paragraphs[1] || paragraphs[0] || '';
  const example = paragraphs[2]
    || `Practical example: apply “${title}” to a 20-row PeaceOne classroom dataset (learners, courses, enrolments). Write the input, the action, and the output in three short sentences. This is demonstration practice, not a production workload.`;
  const leftover = paragraphs.slice(3).join('\n\n');
  const summary = leftover
    || `Learning summary: you should be able to restate ${title.toLowerCase()} in your own words, give one example, and explain one mistake to avoid. PeaceOne does not treat lesson completion as professional certification.`;
  const completion = 'Completion criteria: mark this lesson complete only after you have read the introduction, worked the example on paper or in a notes file, and can answer a related quiz item without guessing.';
  return {
    sortOrder,
    title,
    estimatedMinutes: minutes,
    body: [
      `Introduction\n\n${intro}`,
      `Explanation\n\n${explanation}`,
      `Practical example\n\n${example}`,
      `Learning summary\n\n${summary}`,
      `Completion criteria\n\n${completion}`,
    ].join('\n\n'),
  };
}

export function question(sortOrder, prompt, options, correctIndex, explanation) {
  const rationale = explanation
    || 'Review the matching lesson. The correct option restates that lesson; the others contradict it.';
  const mapped = options.map((text, index) => ({
    id: `opt-${sortOrder}-${index + 1}`,
    text,
    explanation: index === correctIndex
      ? rationale
      : `This option is not correct. ${rationale}`,
  }));
  return {
    sortOrder,
    prompt,
    options: mapped,
    correctOptionId: mapped[correctIndex].id,
    explanation: rationale,
  };
}

export function course(spec) {
  return {
    slug: `${DEMO_LEARNING_SLUG_PREFIX}${spec.slug}`,
    title: spec.title,
    category: spec.category,
    difficulty: spec.difficulty,
    estimatedMinutes: spec.estimatedMinutes,
    description: spec.description,
    objectives: spec.objectives,
    skillLabels: spec.skillLabels,
    targetProficiency: spec.targetProficiency,
    lessons: spec.lessons,
    quiz: spec.quiz,
  };
}

export const DEMO_LEARNING_COURSES = [
  course({
    slug: 'sql-fundamentals',
    title: 'SQL Fundamentals',
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 180,
    targetProficiency: 'Beginner',
    skillLabels: ['SQL'],
    description:
      'A PeaceOne demonstration course on reading and shaping tabular data with SQL. It is original teaching material for academic walkthroughs, not an accredited vendor certificate.',
    objectives: [
      'Write SELECT queries with filters and sorting',
      'Join related tables using keys',
      'Aggregate rows for simple reports',
    ],
    lessons: [
      lesson(1, 'Tables, rows and the SELECT statement', 30, [
        'SQL is a language for asking questions of tables. Each table has named columns and many rows. A demonstration dataset might store learners, courses and enrolments.',
        'Start with SELECT column FROM table. Use WHERE to keep matching rows and ORDER BY to control display order. Always name the columns you need instead of relying on SELECT * in shared reports.',
      ]),
      lesson(2, 'Filtering and expressions', 35, [
        'Comparisons such as =, <>, LIKE and BETWEEN restrict result sets. Combine predicates with AND and OR, and use parentheses so the logic is unambiguous.',
        'Derived columns use expressions: round numbers, concatenate labels, or compute a duration. Aliases (AS) make those columns readable in the result.',
      ]),
      lesson(3, 'Joins', 40, [
        'Relational data is split so each fact is stored once. INNER JOIN returns rows that match on a key. LEFT JOIN keeps the left table even when the right side is missing.',
        'Practice joining a course table to enrolments, then to users. Check grain: if one learner has two enrolments, the user row will repeat unless you aggregate.',
      ]),
      lesson(4, 'GROUP BY and simple reports', 40, [
        'COUNT, SUM, AVG, MIN and MAX collapse many rows into summaries. Every non-aggregated column in SELECT must appear in GROUP BY.',
        'HAVING filters groups after aggregation. Use it for “courses with more than ten enrolments”, not for row-level filters that belong in WHERE.',
      ]),
    ],
    quiz: {
      title: 'SQL Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'What does WHERE do in a SELECT statement?', ['Sorts the result', 'Filters rows before grouping', 'Creates a new table', 'Joins two databases'], 1),
        question(2, 'Which join keeps unmatched rows from the left table?', ['INNER JOIN', 'CROSS JOIN', 'LEFT JOIN', 'RIGHT exclusive JOIN only'], 2),
        question(3, 'GROUP BY is required when you…', ['Select a single unaggregated column with COUNT', 'Use ORDER BY', 'Filter with WHERE', 'Write a comment'], 0),
      ],
    },
  }),
  course({
    slug: 'python-for-data-analysis',
    title: 'Python for Data Analysis',
    category: 'DATA_ANALYTICS',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 210,
    targetProficiency: 'Intermediate',
    skillLabels: ['Python (computer programming)', 'perform data analysis'],
    description:
      'Demonstration notebooks-style lessons on cleaning tables and computing descriptive statistics with Python. Original PeaceOne material; not a professional Python certification.',
    objectives: [
      'Load tabular data into DataFrame-like structures',
      'Clean missing values and types',
      'Compute grouped descriptive statistics',
    ],
    lessons: [
      lesson(1, 'Working with tabular collections', 40, [
        'Python lists and dictionaries can hold rows, but analysis work is easier when each column has a consistent type. Think of a DataFrame as named columns aligned by index.',
        'Read CSV text, inspect dtypes, and keep a copy of the raw extract so cleaning steps stay reversible.',
      ]),
      lesson(2, 'Cleaning and missing values', 45, [
        'Missing values appear as empty strings, sentinels, or nulls. Decide whether to drop, fill, or flag them. Filling with zero can hide real gaps in a demonstration report.',
        'Parse dates explicitly. Strip whitespace from category labels before grouping so “Kuala Lumpur” and “kuala lumpur ” do not split.',
      ]),
      lesson(3, 'Descriptive statistics', 45, [
        'Mean, median and quantiles summarise numeric columns. Prefer median when outliers dominate a small classroom sample.',
        'value_counts on categories shows imbalance. Always report the row count next to a percentage.',
      ]),
      lesson(4, 'Group-wise analysis', 40, [
        'Group by a category then aggregate. This is the Python counterpart of SQL GROUP BY.',
        'Document the grain: one row per learner versus one row per enrolment changes every total.',
      ]),
    ],
    quiz: {
      title: 'Python for Data Analysis check',
      passingScore: 67,
      questions: [
        question(1, 'Why inspect dtypes after loading a table?', ['To encrypt the file', 'To see whether numeric fields were read as text', 'To publish the notebook', 'To drop the index always'], 1),
        question(2, 'Filling every missing salary with zero can…', ['Always improve accuracy', 'Hide missingness and bias averages', 'Convert text to dates', 'Remove duplicates'], 1),
        question(3, 'A group-wise mean is closest to which SQL idea?', ['INNER JOIN', 'GROUP BY with AVG', 'UNION', 'CREATE INDEX'], 1),
      ],
    },
  }),
  course({
    slug: 'power-bi-fundamentals',
    title: 'Power BI Fundamentals',
    category: 'DATA_ANALYTICS',
    difficulty: 'BEGINNER',
    estimatedMinutes: 150,
    targetProficiency: 'Beginner',
    skillLabels: ['business intelligence', 'data visualisation software', 'perform data analysis'],
    description:
      'A conceptual PeaceOne course on shaping a star-schema model and choosing charts honestly. It does not install Microsoft software and is not an official Microsoft credential.',
    objectives: [
      'Separate facts from dimensions in a simple model',
      'Choose charts that match the question',
      'Write one clear measure definition',
    ],
    lessons: [
      lesson(1, 'Facts, dimensions and grain', 35, [
        'A fact table stores events (an enrolment, a sale). Dimension tables store descriptive attributes (course title, learner campus). Grain is the meaning of one fact row.',
        'If grain is wrong, totals double-count. Write the grain in one sentence before building visuals.',
      ]),
      lesson(2, 'Relationships and filters', 40, [
        'Filters flow from dimensions to facts along relationships. Bidirectional filters are easy to misuse in a demonstration model; keep them one-way unless you can explain the loop.',
      ]),
      lesson(3, 'Visuals that match the question', 40, [
        'Use bars for comparison, lines for time, and tables when the audience needs exact values. Avoid 3-D pie charts; they distort area.',
        'Titles should state the claim: “Monthly enrolments, 2026” not “Chart 1”.',
      ]),
    ],
    quiz: {
      title: 'Power BI Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'Grain describes…', ['The colour of a chart', 'What one fact row represents', 'A DAX error', 'A thumbnail'], 1),
        question(2, 'Filters normally flow…', ['From facts to dimensions only', 'From dimensions to facts', 'Randomly', 'Only through CSV files'], 1),
        question(3, 'A 3-D pie chart is discouraged because it…', ['Uses too few colours', 'Distorts comparison of parts', 'Cannot show time', 'Requires SQL'], 1),
      ],
    },
  }),
  course({
    slug: 'javascript-programming-fundamentals',
    title: 'JavaScript Programming Fundamentals',
    category: 'SOFTWARE_DEVELOPMENT',
    difficulty: 'BEGINNER',
    estimatedMinutes: 200,
    targetProficiency: 'Beginner',
    skillLabels: ['JavaScript'],
    description:
      'Original PeaceOne lessons on values, functions and control flow in JavaScript. Demonstration content only; not an ECMA or vendor certificate.',
    objectives: [
      'Distinguish primitives from objects',
      'Write small pure functions',
      'Use arrays and objects to model records',
    ],
    lessons: [
      lesson(1, 'Values, types and equality', 40, [
        'JavaScript has primitives (number, string, boolean, null, undefined) and objects. === compares without coercion; == does coerce and is a common source of bugs.',
        'Prefer const, then let. Avoid var in new PeaceOne demonstration code.',
      ]),
      lesson(2, 'Functions', 40, [
        'Functions take arguments and return values. Keep them small. Side effects (writing to the network) should be obvious in the name.',
        'Arrow functions inherit lexical this; classic functions have their own. For utilities, this rarely matters.',
      ]),
      lesson(3, 'Arrays and objects', 40, [
        'Objects map string keys to values. Arrays are ordered lists. map, filter and reduce transform lists without mutating the source when you return new arrays.',
      ]),
      lesson(4, 'Control flow and errors', 40, [
        'if/else and switch choose paths. throw new Error with a clear message; catch only where you can recover. Do not swallow errors in empty catch blocks.',
      ]),
    ],
    quiz: {
      title: 'JavaScript Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'Which comparison avoids type coercion?', ['==', '===', '=', '!'], 1),
        question(2, 'Array.map is used to…', ['Mutate in place only', 'Transform each item into a new array', 'Sort numbers', 'Open a socket'], 1),
        question(3, 'Empty catch blocks are risky because they…', ['Speed up V8', 'Hide failures', 'Force const', 'Disable CSS'], 1),
      ],
    },
  }),
  course({
    slug: 'react-development-essentials',
    title: 'React Development Essentials',
    category: 'SOFTWARE_DEVELOPMENT',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 220,
    targetProficiency: 'Intermediate',
    skillLabels: ['JavaScript Framework', 'JavaScript', 'implement front-end website design'],
    description:
      'Demonstration lessons on components, props, state and effects as used in PeaceOne-style screens. Not an official Meta React certification.',
    objectives: [
      'Split UI into components',
      'Lift state only as far as needed',
      'Fetch data with explicit loading and error states',
    ],
    lessons: [
      lesson(1, 'Components and props', 40, [
        'A component is a function that returns UI. Props are inputs. Do not mutate props. Name components after the domain: CourseCard, not Div1.',
      ]),
      lesson(2, 'State and events', 45, [
        'useState holds values that change after a click or a typed character. Setters replace state; they do not merge objects unless you spread the previous value.',
      ]),
      lesson(3, 'Lists and keys', 40, [
        'When rendering arrays, keys must be stable identifiers from data (course id), not the array index, if the list can reorder.',
      ]),
      lesson(4, 'Effects and server data', 50, [
        'useEffect runs after paint. For fetches, abort on unmount and store loading, error and payload separately. PeaceOne already uses this pattern on learning pages.',
      ]),
    ],
    quiz: {
      title: 'React Essentials check',
      passingScore: 67,
      questions: [
        question(1, 'Props should be treated as…', ['Mutable globals', 'Read-only inputs', 'CSS classes', 'SQL keys'], 1),
        question(2, 'List keys should usually be…', ['The array index always', 'A stable id from the record', 'Math.random()', 'The component filename'], 1),
        question(3, 'A fetch in useEffect should…', ['Ignore errors', 'Abort or ignore stale responses', 'Block CSS', 'Write to localStorage only'], 1),
      ],
    },
  }),
  course({
    slug: 'rest-api-development',
    title: 'REST API Development',
    category: 'SOFTWARE_DEVELOPMENT',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 200,
    targetProficiency: 'Intermediate',
    skillLabels: ['web programming', 'web services'],
    description:
      'PeaceOne demonstration notes on resources, status codes, validation and authorization. Original teaching text; not a cloud-vendor certificate.',
    objectives: [
      'Model resources with nouns and HTTP verbs',
      'Return honest status codes',
      'Protect mutating routes with auth and CSRF as PeaceOne does',
    ],
    lessons: [
      lesson(1, 'Resources and verbs', 40, [
        'GET reads, POST creates, PUT/PATCH update, DELETE removes. Keep URLs as nouns: /api/learning/courses/id, not /getCourse.',
      ]),
      lesson(2, 'Status codes and errors', 40, [
        '200/201 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict. Do not return 200 with {error} for failed enrolments.',
      ]),
      lesson(3, 'Validation and idempotency', 40, [
        'Validate bodies with a schema. Unique constraints prevent duplicate enrolments. Clients may retry; design POST enrol to return 409 instead of a second row.',
      ]),
      lesson(4, 'Authorization', 40, [
        'Authentication answers who; authorization answers whether they may see this enrolment. Students must only read their own progress. Admins use a separate router.',
      ]),
    ],
    quiz: {
      title: 'REST API check',
      passingScore: 67,
      questions: [
        question(1, 'A duplicate enrolment should typically be…', ['200 with a new row', '409 conflict', '500 always', '204 without a body for GET'], 1),
        question(2, '403 means…', ['The JSON is invalid', 'The caller is known but not allowed', 'The server is offline', 'The CSRF cookie is missing only'], 1),
        question(3, 'GET should not…', ['Be cacheable', 'Change stored enrolments as a side effect', 'Return JSON', 'Use query parameters'], 1),
      ],
    },
  }),
  course({
    slug: 'seo-fundamentals',
    title: 'Search Engine Optimization Fundamentals',
    category: 'DIGITAL_MARKETING',
    difficulty: 'BEGINNER',
    estimatedMinutes: 160,
    targetProficiency: 'Beginner',
    skillLabels: ['search engine optimisation', 'conduct search engine optimisation', 'digital marketing techniques'],
    description:
      'Original PeaceOne material on search intent, titles and ethical SEO. Not an endorsement of any search engine or paid ranking scheme.',
    objectives: [
      'Map a page to a search intent',
      'Write honest titles and descriptions',
      'Avoid manipulative ranking tactics',
    ],
    lessons: [
      lesson(1, 'Search intent', 35, [
        'People look for information, comparison, or a task. A demonstration course page should match “learn SQL basics”, not impersonate a bank login.',
      ]),
      lesson(2, 'Titles, headings and descriptions', 40, [
        'One H1 that names the topic. Meta descriptions summarise; they do not stuff keywords. PeaceOne pages already use clear section titles.',
      ]),
      lesson(3, 'Structure, links and accessibility', 40, [
        'Descriptive links help people and crawlers. Alt text describes images. Hidden text and purchased links are out of scope for this academic dataset.',
      ]),
    ],
    quiz: {
      title: 'SEO Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'Search intent is…', ['A paid ad budget', 'The job the searcher is trying to do', 'A CSS grid', 'A Prisma enum'], 1),
        question(2, 'Keyword stuffing is…', ['Required for HTTPS', 'A manipulative and discouraged tactic', 'An accessibility win', 'A SQL join'], 1),
        question(3, 'A page should usually have…', ['Many competing H1s', 'One clear H1 for the topic', 'No headings', 'Only images'], 1),
      ],
    },
  }),
  course({
    slug: 'social-media-marketing',
    title: 'Social Media Marketing',
    category: 'DIGITAL_MARKETING',
    difficulty: 'BEGINNER',
    estimatedMinutes: 150,
    targetProficiency: 'Beginner',
    skillLabels: ['apply social media marketing', 'social media marketing techniques', 'digital marketing techniques'],
    description:
      'Demonstration lessons on audience, message and measurement for campus-scale campaigns. Not affiliated with any social network and not a paid-ads certificate.',
    objectives: [
      'Define a specific audience',
      'Write a single-message post brief',
      'Choose one metric that matches the goal',
    ],
    lessons: [
      lesson(1, 'Audience before channel', 35, [
        'Start with who must act, not with a platform logo. A PeaceOne FYP demo might speak to final-year students in Kuala Lumpur, not “everyone online”.',
      ]),
      lesson(2, 'Message and creative brief', 40, [
        'One post, one action. State the promise, proof and ask. Do not claim external accreditation for PeaceOne demonstration courses.',
      ]),
      lesson(3, 'Measurement without vanity', 35, [
        'Likes are easy to inflate. Prefer actions: clicks to a course page, completed enrolments. Report the time window with every metric.',
      ]),
    ],
    quiz: {
      title: 'Social Media Marketing check',
      passingScore: 67,
      questions: [
        question(1, 'The first design choice is usually…', ['The filter pack', 'The audience and intended action', 'The office snack budget', 'The database host'], 1),
        question(2, 'A vanity metric is…', ['A number that looks busy but does not show the goal', 'Always illegal', 'A SQL unique key', 'A React prop'], 1),
        question(3, 'PeaceOne demo courses should…', ['Claim official vendor certificates', 'State they are demonstration teaching material', 'Hide the author', 'Skip objectives'], 1),
      ],
    },
  }),
  course({
    slug: 'digital-marketing-analytics',
    title: 'Digital Marketing Analytics',
    category: 'DIGITAL_MARKETING',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 180,
    targetProficiency: 'Intermediate',
    skillLabels: ['web analytics', 'digital marketing techniques', 'perform data analysis'],
    description:
      'PeaceOne demonstration content on funnels, attribution caveats and experiment hygiene. Original text; not a Google Analytics credential.',
    objectives: [
      'Draw a simple conversion funnel',
      'Separate correlation from campaign credit',
      'Document an experiment’s stop rule',
    ],
    lessons: [
      lesson(1, 'Funnels', 40, [
        'A funnel is a sequence: view → enrol → complete lesson. Drop-off between steps is a question, not a verdict. Small FYP samples swing wildly.',
      ]),
      lesson(2, 'Attribution limits', 40, [
        'Last-click credit is convenient and often wrong. Say “this is the last recorded touch” rather than “this ad caused the enrolment”.',
      ]),
      lesson(3, 'Experiments', 40, [
        'Change one thing, define the metric, and pre-commit a sample size or date. Peeking every hour and stopping at the first lucky spike is not analysis.',
      ]),
    ],
    quiz: {
      title: 'Digital Marketing Analytics check',
      passingScore: 67,
      questions: [
        question(1, 'A funnel describes…', ['CSS z-index', 'A sequence of steps toward an action', 'A Prisma cascade', 'A bcrypt round'], 1),
        question(2, 'Last-click attribution…', ['Proves causation', 'Assigns credit to the last recorded touch, with limits', 'Encrypts cookies', 'Replaces SQL'], 1),
        question(3, 'Stopping a test at the first lucky spike is…', ['Best practice', 'A biased procedure', 'Required by HTTP', 'A join type'], 1),
      ],
    },
  }),
  course({
    slug: 'ui-design-fundamentals',
    title: 'UI Design Fundamentals',
    category: 'UI_UX_DESIGN',
    difficulty: 'BEGINNER',
    estimatedMinutes: 160,
    targetProficiency: 'Beginner',
    skillLabels: ['design user interface', 'translate requirements into visual design'],
    description:
      'Original PeaceOne notes on hierarchy, spacing, type and contrast, aligned with the existing design language. Not a licensed design-school diploma.',
    objectives: [
      'Establish visual hierarchy',
      'Use spacing and type consistently',
      'Check contrast for text',
    ],
    lessons: [
      lesson(1, 'Hierarchy and scanning', 35, [
        'Readers scan: title, primary action, supporting text. PeaceOne pages already use po-page-title and po-section-title for this reason.',
      ]),
      lesson(2, 'Spacing and alignment', 40, [
        'A spacing scale (for example 4 / 8 / 16 / 24) beats arbitrary margins. Align labels and fields to one grid so forms feel calm.',
      ]),
      lesson(3, 'Type and contrast', 40, [
        'Body text needs contrast against the surface. Decorative grey on grey fails outdoor laptops. Do not encode meaning with colour alone.',
      ]),
    ],
    quiz: {
      title: 'UI Design Fundamentals check',
      passingScore: 67,
      questions: [
        question(1, 'Visual hierarchy helps users…', ['Compile SQL', 'Find the next action quickly', 'Hash passwords', 'Open Docker'], 1),
        question(2, 'Meaning should not rely on colour alone because…', ['CSS forbids colour', 'Some people cannot distinguish those colours', 'Browsers ignore colour', 'Prisma stores greyscale'], 1),
        question(3, 'A spacing scale is useful because it…', ['Encrypts assets', 'Keeps rhythm consistent', 'Replaces alt text', 'Creates foreign keys'], 1),
      ],
    },
  }),
  course({
    slug: 'figma-design-essentials',
    title: 'Figma Design Essentials',
    category: 'UI_UX_DESIGN',
    difficulty: 'BEGINNER',
    estimatedMinutes: 170,
    targetProficiency: 'Beginner',
    skillLabels: ['design user interface', 'Prototyping development', 'create website wireframe'],
    description:
      'Conceptual PeaceOne lessons on frames, components and handoff notes. The course does not ship Figma files and is not an official Figma certificate.',
    objectives: [
      'Structure a file with frames and components',
      'Name layers for developers',
      'Describe interaction in writing',
    ],
    lessons: [
      lesson(1, 'Frames and constraints', 40, [
        'Frames are the canvas units (a mobile screen, a card). Constraints describe how children resize. Name frames after routes, not “Frame 47”.',
      ]),
      lesson(2, 'Components and variants', 45, [
        'A Button component with primary/secondary variants matches PeaceOne’s Button.jsx. Changing the master updates instances; document exceptions.',
      ]),
      lesson(3, 'Handoff', 40, [
        'Write spacing, states (hover, disabled, loading) and empty copy. A screenshot without those notes forces developers to guess.',
      ]),
    ],
    quiz: {
      title: 'Figma Essentials check',
      passingScore: 67,
      questions: [
        question(1, 'Components exist so that…', ['SQL runs faster', 'Repeated UI stays consistent', 'Passwords hash', 'CSRF tokens refresh'], 1),
        question(2, 'Handoff notes should include…', ['Only hex codes', 'States, spacing and empty copy', 'Production secrets', 'Docker logs'], 1),
        question(3, 'Frames named Frame 47 are…', ['Ideal for search', 'Hard for teammates to find', 'Required by Figma', 'A REST verb'], 1),
      ],
    },
  }),
  course({
    slug: 'user-experience-research',
    title: 'User Experience Research',
    category: 'UI_UX_DESIGN',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 180,
    targetProficiency: 'Intermediate',
    skillLabels: [
      'execute ICT user research activities',
      'application usability',
      'combine business technology with user experience',
    ],
    description:
      'Demonstration methods for interviews, tasks and cautious claims from small samples. Academic PeaceOne content; not a professional research licence.',
    objectives: [
      'Write a research question',
      'Run a short task-based session',
      'Separate observation from interpretation',
    ],
    lessons: [
      lesson(1, 'Questions before methods', 40, [
        '“Why do students abandon skill gap?” is a question. A method (interview, task, survey) comes second. Do not start with a tool because it looks modern.',
      ]),
      lesson(2, 'Task-based sessions', 45, [
        'Give a goal (“enrol in SQL Fundamentals”), watch, and keep quiet. Count critical errors. Five classmates are a demo sample, not a national statistic.',
      ]),
      lesson(3, 'Notes and claims', 40, [
        'Write what happened, then a separate interpretation. “Two of five missed the enrol button” is an observation. “The button is invisible” is a hypothesis.',
      ]),
    ],
    quiz: {
      title: 'UX Research check',
      passingScore: 67,
      questions: [
        question(1, 'A method should follow…', ['The vendor logo', 'A written research question', 'The CSS framework', 'The loudest stakeholder only'], 1),
        question(2, 'During a task session the facilitator should…', ['Give the clicks', 'Stay quiet enough to see real trouble', 'Edit the code live', 'Hide errors'], 1),
        question(3, 'A sample of five classmates…', ['Proves national demand', 'Can reveal issues but does not generalise widely', 'Replaces analytics', 'Is a unique SQL key'], 1),
      ],
    },
  }),
  course({
    slug: 'network-security-fundamentals',
    title: 'Network Security Fundamentals',
    category: 'CYBERSECURITY',
    difficulty: 'BEGINNER',
    estimatedMinutes: 180,
    targetProficiency: 'Beginner',
    skillLabels: ['ICT network security risks', 'cyber security'],
    description:
      'Introductory PeaceOne material on trust boundaries, TLS in transit, and least privilege. Teaching text only; not a hacking course and not a security vendor badge.',
    objectives: [
      'Name common network layers in plain language',
      'Explain why HTTPS protects data in transit',
      'Apply least privilege to a demo service',
    ],
    lessons: [
      lesson(1, 'Trust boundaries', 40, [
        'A laptop, a browser, the PeaceOne API, and PostgreSQL are different trust zones. Treat input from another zone as untrusted until validated.',
      ]),
      lesson(2, 'TLS and cookies', 40, [
        'HTTPS encrypts data in transit. Session cookies still need HttpOnly and a CSRF token on mutating requests, which PeaceOne already implements.',
      ]),
      lesson(3, 'Least privilege', 40, [
        'The demo seed refuses non-local databases. Application roles (STUDENT versus ADMIN) limit routes. Do not share admin sessions on a projector longer than needed.',
      ]),
    ],
    quiz: {
      title: 'Network Security check',
      passingScore: 67,
      questions: [
        question(1, 'Input from the browser should be treated as…', ['Already trusted', 'Untrusted until validated', 'Always encrypted at rest', 'A Prisma migration'], 1),
        question(2, 'HTTPS mainly protects…', ['Data in transit', 'Disk backups', 'SQL joins', 'CSS variables'], 0),
        question(3, 'Least privilege means…', ['Everyone is admin', 'Grant only the access required for the task', 'Disable passwords', 'Log out CSRF'], 1),
      ],
    },
  }),
  course({
    slug: 'introduction-to-cybersecurity',
    title: 'Introduction to Cybersecurity',
    category: 'CYBERSECURITY',
    difficulty: 'BEGINNER',
    estimatedMinutes: 170,
    targetProficiency: 'Beginner',
    skillLabels: ['cyber security', 'apply information security policies'],
    description:
      'A PeaceOne overview of confidentiality, integrity, availability, and reporting incidents. Original academic content; not offensive-security training.',
    objectives: [
      'Define CIA in one sentence each',
      'Give an example of a threat versus a vulnerability',
      'Know where to report a suspected incident in a project team',
    ],
    lessons: [
      lesson(1, 'Confidentiality, integrity, availability', 40, [
        'Confidentiality: only the right people read it. Integrity: it was not silently changed. Availability: it is there when authorised people need it.',
      ]),
      lesson(2, 'Threats, vulnerabilities, impact', 40, [
        'A threat is a possible source of harm. A vulnerability is a weakness. Impact is what you lose. Patching without knowing impact wastes time.',
      ]),
      lesson(3, 'People and process', 40, [
        'Phishing succeeds because people are busy. Demonstration accounts use a shared classroom password—rotate it after public vivas and never reuse it on real email.',
      ]),
    ],
    quiz: {
      title: 'Introduction to Cybersecurity check',
      passingScore: 67,
      questions: [
        question(1, 'Integrity means…', ['The server is fast', 'Data is not silently altered', 'Everyone can read it', 'Cookies are large'], 1),
        question(2, 'A vulnerability is…', ['Always a person', 'A weakness that a threat might exploit', 'A published course', 'A React key'], 1),
        question(3, 'Demo passwords after a public viva should be…', ['Posted on social media', 'Rotated if they were displayed', 'Stored in the database in plaintext', 'Shared as ADMIN for all roles'], 1),
      ],
    },
  }),
  course({
    slug: 'security-awareness-and-best-practices',
    title: 'Security Awareness and Best Practices',
    category: 'CYBERSECURITY',
    difficulty: 'BEGINNER',
    estimatedMinutes: 140,
    targetProficiency: 'Beginner',
    skillLabels: ['cyber security', 'ensure information security'],
    description:
      'Practical PeaceOne habits: passwords, phishing, device sharing, and not pasting secrets into tickets. Demonstration teaching; not a compliance audit.',
    objectives: [
      'Choose unique passwords for real accounts',
      'Spot common phishing cues',
      'Keep secrets out of screenshots and git',
    ],
    lessons: [
      lesson(1, 'Passwords and sessions', 35, [
        'The classroom demo password is for .demo accounts only. Real email and banking need unique passwords and a manager. Lock the screen when you leave a viva laptop.',
      ]),
      lesson(2, 'Phishing cues', 35, [
        'Unexpected urgency, mismatched domains, and attachments you did not request. PeaceOne staff will not ask you to paste a session cookie into chat.',
      ]),
      lesson(3, 'Secrets in artefacts', 35, [
        'Do not commit .env, CSRF secrets, or production DATABASE_URL. Screenshots of admin pages should not show live personal identity numbers.',
      ]),
    ],
    quiz: {
      title: 'Security Awareness check',
      passingScore: 67,
      questions: [
        question(1, 'The PeaceOne demo password should be used for…', ['Personal email', 'Demonstration .demo accounts only', 'Banking', 'All ADMIN production systems'], 1),
        question(2, 'A phishing message often uses…', ['Unexpected urgency and odd domains', 'Valid CSRF tokens', 'Prisma migrations', 'SQL GROUP BY'], 0),
        question(3, '.env files with secrets should be…', ['Committed to git', 'Kept out of version control', 'Emailed to the class', 'Printed on posters'], 1),
      ],
    },
  }),
];
