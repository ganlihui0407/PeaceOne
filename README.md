# PeaceOne

Frontend UI/UX prototype for PeaceOne, an AI-powered career development platform.

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

FYP freeze documentation:

- [Demonstration guide](docs/FYP-DEMONSTRATION-GUIDE.md)
- [Technical summary](docs/FYP-TECHNICAL-SUMMARY.md)

## Demonstration data

The API can load a repeatable FYP demonstration dataset into the **local** PostgreSQL database without resetting it or touching non-demo users.

```bash
npm run db:seed:demo
```

Or from `server/`:

```bash
npm run db:seed:demo
```

The script refuses `NODE_ENV=production` and any `DATABASE_URL` that is not a local host (`localhost` / `127.0.0.1`). It never runs `prisma migrate reset`, `prisma db push`, `TRUNCATE`, or `DROP`.

## Databases

PeaceOne uses two PostgreSQL databases on the same local server:

| Purpose | Environment variable | Default database name |
| --- | --- | --- |
| Presentation / local app / seed scripts | `DATABASE_URL` | `peaceone` |
| Backend automated tests | `TEST_DATABASE_URL` | `peaceone_test` |

Start the API and frontend as usual (`npm run dev` in `server/` and at the repo root). Those processes keep using `DATABASE_URL` and never read `TEST_DATABASE_URL` for queries.

Initialize the isolated test database once (creates `peaceone_test` if needed, applies existing Prisma migrations, and copies ESCO/MASCO catalogues from the presentation database; it does not copy users, jobs, applications, or learning progress):

```bash
npm run test:db:init --prefix server
```

Then run backend tests:

```bash
npm test --prefix server
```

Backend tests fail closed if `TEST_DATABASE_URL` is missing, equals `DATABASE_URL`, or targets `peaceone`. They never fall back to the presentation database. Do not run `prisma migrate reset`, `prisma db push`, `DROP`, or `TRUNCATE` against `DATABASE_URL`.

Frontend `npm test` does not connect to PostgreSQL.

Set `DEMO_SEED_PASSWORD` in `server/.env` if you do not want the local default `PeaceOneDemo1`. Passwords are hashed with bcrypt before insert; plaintext is not stored.

Reserved demonstration emails:

- `admin@peaceone.demo` (ADMIN)
- `hr@techcorp.demo` (COMPANY_STAFF)
- `staff@techcorp.demo` (COMPANY_STAFF)
- `student@peaceone.demo` (STUDENT)
- `graduate@peaceone.demo` (JOB_SEEKER)

ESCO occupations and skills must already be imported (`npm run esco:import --prefix server`). Re-running the seed is idempotent.

## Occupational taxonomies

PeaceOne stores two independent occupational catalogues. They are not interchangeable.

**ESCO** is the primary taxonomy for Career Target, occupation skill requirements, Skill Gap, learning recommendations, job required skills, and recorded `UserSkill` rows. Matching uses exact ESCO skill identifiers, not occupation titles.

**MASCO 2020** is a Malaysian Standard Classification of Occupations reference catalogue for administrators (and a public list API). It currently includes 492 unit groups, 1,967 occupation records, and 41 MASCO 2013→2020 historical crosswalks. MASCO occupation codes are not used as Career Target IDs. The optional `masco_occupation_records.occupation_id` column can point at an ESCO occupation, but it is unused (all null). PeaceOne does not auto-map MASCO to ESCO by name similarity. Major / sub-major / minor groups are not stored as tables; a unit-group code is four digits and can be read left-to-right as ISCO-style hierarchy. Crosswalk admin APIs require `ADMIN`. Catalogue list/detail APIs are unauthenticated.

Demonstration learning courses (15 published PeaceOne originals) are loaded with:

```bash
npm run db:seed:learning
```

The learning seed is idempotent, does not reset the database, and does not delete student progress or Prompt 02 recruitment records.
