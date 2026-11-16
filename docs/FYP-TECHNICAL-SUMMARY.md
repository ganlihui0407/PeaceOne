# PeaceOne technical summary (implementation-based)

This document describes the system **as implemented**. It does not invent extra algorithms or undeployed services.

## A. System overview

PeaceOne is an academic prototype for career development and recruitment:

- Students and job seekers record ESCO skills, set an ESCO career target, review skill gaps, follow original learning content, and apply to published jobs.
- Company staff manage jobs, applicants, interviews and offers for **their** company.
- Administrators oversee users, companies, catalogues, learning content and live aggregates.

**User roles (Prisma `UserRole`):** `STUDENT`, `JOB_SEEKER`, `COMPANY_STAFF`, `ADMIN`. Account status is `ACTIVE` or `SUSPENDED`. “HR” in the product copy is company staff with `companyId`.

Modules: authentication, profile, ESCO/MASCO catalogues, `UserSkill`, career target, skill gap, learning, resumes, jobs, applications, interviews, notifications, admin platform.

## B. System architecture

- **Frontend:** React 19, Vite, React Router, Tailwind CSS 4. Lazy-loaded route pages. `credentials: 'include'` for session cookies. No JWT in `localStorage`.
- **Backend:** Node.js (Express) in `server/`. JSON APIs under `/api`. CSRF (`csrf-csrf`) plus `peaceone.sid` sessions (`express-session` + `connect-pg-simple`).
- **Database:** PostgreSQL. Prisma ORM (`@prisma/client` with the pg adapter).
- **Integrations:** Official ESCO occupation/skill CSV import; MASCO 2020 catalogue and historical crosswalks. No external LLM is required for Skill Gap or job–skill overlap.

Two local databases: presentation `peaceone` (`DATABASE_URL`) and isolated tests `peaceone_test` (`TEST_DATABASE_URL`). Backend tests fail closed if isolation cannot be proven.

## C. Database

Main entities (Prisma models → tables):

| Entity | Role |
| --- | --- |
| `User` | Account, role, optional `companyId`, optional `targetOccupationId` |
| `Company` | Employer organisation |
| `Session` | Server-side session store |
| `Occupation` / `Skill` / `OccupationSkillRelation` | ESCO catalogue |
| `UserSkill` | Recorded candidate skills (unique per user+skill) |
| `MascoUnitGroup` / `MascoOccupationRecord` / `MascoHistoricalCrosswalk` | MASCO reference |
| `Resume` / `ResumeFile` / snapshot tables | Structured resume + private files |
| `Job` / `JobSkill` / `JobStatusEvent` | Vacancies |
| `Application` / `ApplicationResumeSnapshot` / `ApplicationStatusEvent` | Applications |
| `Interview` / `InterviewEvent` | Interviews |
| `Notification` | Recipient-scoped events |
| `LearningContent` / `LearningLesson` / `LearningContentSkill` / `LearningEnrollment` / `LearningLessonProgress` / `LearningAssessment` / `LearningQuestion` / `LearningAttempt` | Learning |

Important foreign keys: user → company (restrict), user → occupation (set null), job → company, application → job + applicant, interview → application + company, learning progress → user + content/lesson.

ERD-ready description: a User optionally belongs to one Company and one Career Target Occupation; UserSkills point at Skills; Jobs belong to Companies and require JobSkills; Applications join Users to Jobs and copy a Resume snapshot; Interviews hang off Applications; Notifications point at a recipient User; Learning enrollments join Users to LearningContent that maps to Skills via LearningContentSkill.

## D. Learning module

1. **Career Target** — stored `users.target_occupation_id` (ESCO occupation UUID).
2. **Skill Gap** — compares recorded `UserSkill.esco` identifiers with occupation-linked ESCO skills. Counts “recorded vs not recorded”. **Not** a neural model, **not** a readiness score, **not** fuzzy title matching.
3. **Recommendations** — learning content whose linked ESCO skills relate to the target occupation / unrecorded skills (deterministic catalogue rules).
4. **Enrolment** — unique user+content; statuses `ENROLLED` / `IN_PROGRESS` / `COMPLETED`.
5. **Lessons** — ordered lessons; progress rows per user+lesson.
6. **Assessment** — questions with options; student GET omits `correctOptionId`; submit scores server-side.
7. **UserSkill awarding** — on course completion, skills may be recorded according to existing learning rules (exact ESCO ids). Learning text is original PeaceOne material, not a professional certificate.

## E. Recruitment module

- Companies own jobs. Create/update uses **authenticated** `user.companyId`, not a client-supplied company id.
- Candidates browse **published** jobs; overlap with recorded skills uses exact ESCO identifiers.
- Applications: unique applicant+job pair; status machine includes SUBMITTED through OFFERED / REJECTED / WITHDRAWN.
- Interviews: company-scoped for staff; candidate sees own interviews. Meeting links must be HTTPS URLs.
- Offers are application status `OFFERED`. There is **no** candidate accept/decline feature.
- Notifications are written to the correct recipient and listed only for the session user.

## F. Security

- Passwords hashed with **bcryptjs, 12 rounds**. Hashes are never returned on APIs.
- Sessions: HttpOnly `peaceone.sid`, SameSite=lax. Logout destroys the session.
- CSRF double-submit on mutating API routes. Rate limits on auth and general API.
- `requireAuth` / `requireRole`; suspended accounts cannot use the session.
- Company isolation on employer job/applicant/interview/stats/notifications.
- Resume files: type/size/MIME/magic-byte checks, private storage, owner or authorised employer/admin download.
- Zod (including `.strict()` on login/register) and domain validators. Prisma tagged SQL.
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store`.
- No production email; password recovery is not implemented.

This is **not** an external penetration test or production certification.

## G. Testing (final freeze baseline)

Executed on the freeze date:

| Suite | Result |
| --- | --- |
| Backend `npm test` | 296 passed, 0 failed, exit 0 |
| Frontend `npm test` | 234 passed, 0 failed, exit 0 |
| `prisma validate` | valid |
| `prisma migrate status` (`peaceone`) | 16 migrations, up to date |
| `npm run build` | exit 0 |
| `node --check src/index.js` | exit 0 |
| Database safety tests | isolation fail-closed |
| Browser | Isolated `peaceone_test` walkthrough (public, student, job seeker, employer, admin) |

## H. Known limitations

- No professional certification of learners.
- No offer accept/decline.
- No production password recovery / email infrastructure.
- Exact ESCO identifier matching, not machine learning.
- No Content-Security-Policy header (baseline headers only).
- MASCO is a reference catalogue; Career Target IDs are ESCO.
- Presentation vs test datasets differ by design (smaller preserved presentation vs enhanced test recruitment/learning seeds).
