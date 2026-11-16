# PeaceOne FYP demonstration guide

Use this walkthrough for the final-year project demonstration. All organisations, people and vacancies are **synthetic**. They are not real employers or job offers.

**Do not commit real passwords to public copies of this file.** Local demonstration passwords are stored only in `server/.env` as `DEMO_SEED_PASSWORD` (default used by local seed scripts if unset). Tell the examiner the password verbally or from that private file.

## Databases

| Database | Use during the demo |
| --- | --- |
| `peaceone` | Presentation / examiner laptop app (`DATABASE_URL`). Treat as read-only unless the supervisor explicitly allows reseeding. |
| `peaceone_test` | Automated tests and isolated regression. Never point the presentation app at this database for the viva unless you intend to show the larger synthetic recruitment set. |

Start the API from `server/` (`npm run dev`) and the frontend from the repo root (`npm run dev`). The app is at `http://localhost:5173` by default.

## Roles and reserved accounts

| Role | Email | What to show |
| --- | --- | --- |
| ADMIN | `admin@peaceone.demo` | Platform totals, users, companies, reports, learning administration, Recent Activity pagination |
| COMPANY_STAFF (HR) | `hr@techcorp.demo` | TechCorp jobs, applicants, interviews, company-scoped statistics |
| COMPANY_STAFF | `staff@techcorp.demo` | Same company workspace; existing staff permissions |
| STUDENT | `student@peaceone.demo` | Career target, skill gap, learning, applications, interview |
| JOB_SEEKER | `graduate@peaceone.demo` | Job search, applications, interviews |

The login **“Login as”** selector only chooses the workspace URL after a successful login. Access is determined by the account role in PostgreSQL, not by that dropdown.

Password recovery is **not available** in this prototype (no production email). The login page states this honestly.

## Login

1. Open `/login`.
2. Enter the demonstration email and the private demonstration password.
3. Optionally set “Login as” to match the account (Student / Job Seeker / Company Staff / Admin).
4. Submit. Invalid credentials show a generic error.

## Public walkthrough

1. Homepage — product overview and sample learning/jobs cards.
2. `/jobs` — published vacancies. Search (for example `Python`) updates the URL (`?q=Python`).
3. Open a job (for example Python Developer). Unauthenticated visitors see “Sign in to apply”.
4. `/register` — registration form (do not create extra accounts during the viva unless asked).
5. `/learning` — public course catalogue (original PeaceOne teaching content; not vendor certificates).

## Student workflow (`student@peaceone.demo`)

Recommended order:

1. Dashboard.
2. My Profile.
3. Career Target (saved ESCO occupation).
4. Skill Gap Analysis (exact ESCO skill identifier overlap, not a readiness score).
5. Learning — recommendations plus related courses.
6. Open an **already enrolled** course (Learning Progress → Continue Learning). Example: Business Intelligence.
7. Open a lesson. Use Next/Previous. Avoid “enrol” on a new course unless you accept a new enrolment row.
8. Open the quiz UI. **Do not submit** unless you accept a new assessment attempt. Correct answers are not shown before submit.
9. Learning Progress — existing enrolments.
10. My Skills — recorded `UserSkill` rows (ESCO identifiers).
11. My Applications → an application detail (employer review notes are not shown to candidates).
12. My Interviews.
13. Notifications (recipient-scoped).

On presentation `peaceone`, this student already has an **OFFERED** Junior Data Analyst application and a **CONFIRMED** interview. On `peaceone_test`, the same email has additional synthetic applications from the recruitment dataset.

## Job Seeker workflow (`graduate@peaceone.demo`)

1. Dashboard.
2. Find Jobs (keyword/location; URL-synced filters).
3. My Applications → application details.
4. Interview details (HTTPS meeting links open with `rel="noopener noreferrer"`).
5. Notifications.

## Employer workflow (`hr@techcorp.demo`)

1. Dashboard — TechCorp totals only.
2. Manage Job Postings — company jobs (not other companies).
3. Applicants — search/filter; open applicant details (resume snapshot, status actions).
4. Interview Management.
5. Do **not** issue a new offer or shortlist during the viva unless you want to change stored statuses.

HR is implemented as `COMPANY_STAFF` with a `companyId`. There is no separate Prisma `HR` enum.

## Admin workflow (`admin@peaceone.demo`)

1. Dashboard — live PostgreSQL aggregates. Recent Activity pager (example: page 1 of N events, then Next).
2. User Management.
3. Companies.
4. Reports & Analysis (current aggregates; PeaceOne does not store a historical analytics warehouse).
5. Learning Content Management.

Dashboard application/interview totals do not list candidate names or resume files.

## Learning demonstration points

- Courses are original PeaceOne text, not accredited certificates.
- Recommendations use the saved career target and recorded ESCO skills.
- Enrolment, lesson progress, quizzes and optional `UserSkill` awarding follow stored rules (see technical summary).
- Quiz GET payloads omit `correctOptionId` for students.

## Recruitment demonstration points

- Presentation DB: two companies, five jobs, two applications, one interview (baseline preservation).
- Isolated test DB / enhanced seed: five companies (TechCorp, Nexa, BrightWave, FinEdge, CloudMatrix) and a larger synthetic applicant set.
- Recorded-skill overlap on jobs uses exact ESCO skill identifiers.
- Applications store a resume snapshot; employers see company applicants only.

## Limitations to state if asked

- Skill Gap is **deterministic ESCO identifier matching**, not machine-learning prediction.
- No candidate offer accept/decline workflow.
- No production password recovery / email.
- Learning content is not a professional licence or vendor certificate.
- Frontend route hiding is not security; the API enforces roles and company scope.
