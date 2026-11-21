# SIMS Beginner Backend

The reduced project covers accounts, companies, opportunities, applications,
placements, daily reports, weekly drafts/submission, student academic profiles,
departments, final evaluations and role-based dashboard counters.

## Run

Use Node.js 22.12 or newer. Keep an existing `.env`; on a new installation,
copy `.env.example` to `.env` and configure it locally with
`MONGODB_URI`, a `JWT_SECRET` of at least 32 characters, and optionally `PORT`
(default 5000) and `CLIENT_ORIGIN` (default http://localhost:5173).
Never commit passwords, connection strings or tokens.

```powershell
cd backend
npm ci
npm run dev
```

Sign in with `POST /api/v1/auth/signin`. Put the returned `data.token` in
Postman's Authorization tab as a Bearer Token. Public signup always creates a
student. Set the first admin's role directly in your own MongoDB database; later
admins can create role-based accounts using `POST /api/v1/auth/create-user`.

## Built Frontend

See the [root setup guide](../README.md) for the complete beginner workflow.
Build from the project root with `npm run build --prefix frontend`, then set
`NODE_ENV=production` and run `npm start` in this folder. Express serves both
`frontend/dist` and the API on port 5000. React route refreshes work; unknown
API paths, hidden files and missing assets never fall back to HTML. Development
mode stays API-only and uses the Vite proxy. A missing build stops production
startup before connecting to MongoDB. PORT must be an integer from 1 to 65535.

`app.js` configures the routes and middleware without opening a database
connection. `server.js` loads settings, initializes MongoDB/indexes and starts
listening only after initialization succeeds. SIGINT/SIGTERM stop accepting
connections and close MongoDB, with a ten-second shutdown limit. Startup still
backfills the existing ongoing-placement flag; back up a real database before
deploying updates. Do not use an application database for fixture tests.

## Own Account and Profile Photo

Every active role can read its own account with `GET /api/v1/auth/me` and
update it with `PATCH /api/v1/auth/me`, using the current bearer token:

```json
{ "name": "Updated Name", "email": "updated@example.com", "profileImage": "" }
```

Fields can be updated separately. An omitted photo is preserved; an empty
`profileImage` removes it. The frontend accepts JPG, PNG and WebP files up to
5 MB, resizes them to at most 256 pixels on the longest edge and converts them
to JPEG before sending. The API accepts only JPEG base64 data URLs up to 64 KB
of decoded bytes. SVGs, remote URLs, malformed encodings and oversized photos
are rejected. Only the account-profile endpoint has a 100 KB JSON-body limit;
other endpoints keep the 16 KB limit.

The small photo is saved with the user in MongoDB, not browser storage or the
JWT. It is returned by sign-in and `/auth/me`, but excluded from ordinary user
queries by default. Existing accounts need no migration. The authenticated
user ID determines ownership; role, account status, passwords and other users'
details cannot be changed through this endpoint. Duplicate emails return 409.

## Own Password

Every active signed-in role can use `PATCH /api/v1/auth/change-password` with
its bearer token and only `currentPassword` and `newPassword`. The frontend
exposes this existing endpoint under **Settings > Security**. The current
password is verified with bcrypt; a different new password of at least eight
characters and no more than 72 UTF-8 bytes is hashed before saving. Passwords
are not trimmed. Incorrect current passwords and invalid changes return 400;
missing, expired or inactive sessions return 401. The authenticated user ID,
not a body-supplied ID or role, determines which password changes.

The response is `{ "success": true, "message": "Password changed successfully." }`,
without a hash, plain password or new token. Confirmation is checked by the
frontend and is not sent. Existing access tokens are not revoked by this
endpoint; they retain their normal 15-minute expiry. This is not password
recovery, administrator password reset or remote-session management.

`tests/password-change.test.js` checks all four roles, ownership, real bcrypt
hash/compare behavior and rejected changes using mocked database methods only.
It does not change passwords in the configured application database.

## Admin User Management

Use an active admin's bearer token. The frontend page is `/admin/users`.

- `POST /api/v1/auth/create-user` creates a user with name, email, password and an explicitly chosen role.
- `PATCH /api/v1/users/:id` updates a non-admin account's `name` and `email` only. Both are required; names are trimmed, emails are lowercase and duplicate emails return 409. Roles, passwords, photos and status are not reassigned here.
- `PATCH /api/v1/users/:id/status` activates or deactivates a non-admin account using a boolean `isActive`.
- `DELETE /api/v1/users/:id` permanently deletes only an inactive, unused, non-admin account. Deactivate first. Academic profiles, applications/reviews, internships, company links, opportunities, reports/reviews and evaluations referencing the account block deletion with 409. No associated records are deleted.
- `GET /api/v1/users?page=1&limit=10` lists accounts without passwords or photos.

Account categories use an optional `role` query, for example
`GET /api/v1/users?role=student&page=1&limit=10`. Allowed roles are `student`,
`academic_supervisor`, `admin` and `company_representative`. The database query
filters by that role before sorting/pagination, including inactive accounts.
Omit `role` to retain the complete directory. Empty, repeated or unknown role
values return 400. Filtering does not change administrator-only access.

Administrator accounts cannot be deleted, deactivated or edited through these
management routes; use `/auth/me` for your own name/email/photo. The delete
query rechecks role and inactive status in case they changed after validation.
All account-management writes require a valid admin session; other roles get
403 and expired or inactive sessions get 401. No data migration is needed.

## Rejected Applications

Students use `POST /api/v1/applications` with only `opportunityId`. A first
application returns 201. If this student's application for that opportunity was
rejected, the same endpoint atomically reopens that record as `pending` and
returns 200. Its ID, student, opportunity and original creation date remain;
the old rejection reason, reviewer and review time are cleared. The existing
unique student/opportunity index stays in place, with no database migration.

Pending, under-review, approved and withdrawn applications still return 409
on duplicate submission. A closed, archived or expired opportunity cannot be
reapplied to. Identity and status remain server-controlled. Concurrent retries
can reopen a rejected record only once, and resubmission never grants approval.

Application lists sort by latest update, then ID, so a resubmitted application
returns near the top of the admin queue. Refresh the admin Applications page,
select Pending or All statuses, and review it normally. A rejected record stays
locked against admin decisions until the student explicitly resubmits it.

`tests/application-resubmission.test.js` covers repeated reject/reapply/approve
rounds, ownership, eligibility and duplicate races using mocked database methods.
The teacher daily-report workflow is separate: return for changes, student edit
and submit, then assigned-teacher approval. Its tests also exercise two rounds
and confirm that an approved report cannot be edited or submitted again.

## Departments and Student Information

An admin creates a department with `POST /api/v1/departments`:

```json
{ "name": "Computer Science", "code": "CS" }
```

Any authenticated user can list departments with `GET /api/v1/departments`.
Use the returned department `_id` in the student profile.

A student saves their complete academic profile with `PUT /api/v1/students/me`:

```json
{
  "studentNumber": "STU-001",
  "departmentId": "REPLACE_WITH_DEPARTMENT_ID",
  "semester": 7,
  "phone": "+93700123456"
}
```

Use `GET /api/v1/students/me` to read your profile. Admins can list completed
academic profiles with `GET /api/v1/students`; accounts without a saved profile
remain visible in the existing users list. Student numbers must be unique.
These are self-entered profile details, not university-verified credentials.

## Final Scores

First, an admin completes an active internship using
`PATCH /api/v1/internships/INTERNSHIP_ID/status` with `{"status":"completed"}`.

The assigned academic supervisor and the company's currently assigned
representative can each send `POST /api/v1/evaluations`:

```json
{
  "internshipId": "REPLACE_WITH_INTERNSHIP_ID",
  "score": 85,
  "comments": "Good practical work and progress."
}
```

Scores range from 0 to 100. Each internship accepts one final academic score
and one final company score. They cannot be overwritten. The server determines
the student, evaluator and evaluation type; students cannot grade themselves.
These two scores are separate assessments, not an official combined grade or
pass/fail rule.

`GET /api/v1/evaluations` returns the student's own scores, an evaluator's own
assessments, or all scores for an admin. Students cannot see another student's
grades.

## Dashboard

Send `GET /api/v1/dashboard/stats` with your token, without a body:

- Admin: students, companies, departments, pending applications and internships.
- Student: own applications, active internships, reports and evaluations.
- Academic supervisor: assigned internships and submitted report counters.
- Company representative: own companies, open opportunities and internships.

The frontend Dashboard consumes these role-scoped JSON counters.
Lists support `?page=1&limit=20` with a maximum limit of 100.

## Tests

```powershell
npm test
```

The ordinary API tests mock database methods. The real database test is opt-in:

```powershell
$env:SIMS_INTEGRATION_TEST = '1'
node --test tests/backend.integration.test.js
Remove-Item Env:SIMS_INTEGRATION_TEST
```

It reads your MongoDB connection configuration, creates its own random
`sims_test_...` database and removes only that database afterwards. The database
account must allow creating and deleting that temporary database. The test never
stores fixtures in the application's configured database.

The isolated workflow also checks an actual rejected-application retry against
the unique MongoDB index, admin approval, and two teacher correction/student
resubmission rounds before daily approval. It passed on 2026-11-20, and only
its generated test database was removed. The ordinary suite passed 53 checks
with that single opt-in case skipped. `tests/production-app.test.js` adds three
database-free checks of the complete middleware, production SPA/static routing,
API 404s, security headers, body limits and missing-build protection.

Unused cookie-parser, pino, pino-http, eslint, prettier and vitest dependencies
were removed. Tests use Node's built-in runner and Supertest; nodemon remains
for development. Existing Mongoose updates now use `returnDocument: 'after'`
instead of the deprecated `new` option. Both lockfiles remain committed for
repeatable installs; npm audit reported zero known backend vulnerabilities on
the verification date.

## Navbar Inbox

`GET /api/v1/inbox` requires a bearer token and derives recent activity from
existing project records. It accepts no recipient ID: the authenticated account
and its current role/assignments determine all filters. The response contains
`userId`, `role`, a server `through` timestamp, `messages`, `notifications`, and
unread counts. Responses are not cached. Each channel is capped at its 30 most
recent entries; unread counts describe those entries, not an unlimited archive.

- Students: current daily-report feedback returned for changes; daily/weekly submissions, daily approvals, application approval/rejection, internship status changes and final evaluation scores.
- Academic supervisors: submitted daily reports from assigned internships, plus their internship assignments/status changes. No weekly-report links are provided because that role has no weekly-report access.
- Administrators: daily/weekly submissions and pending/under-review application arrivals. Private teacher feedback is not copied to Messages.
- Company representatives: completed internships belonging to their currently assigned companies, linking to Evaluations.

`PATCH /api/v1/inbox/read` accepts only a `channel` (`messages` or
`notifications`) and the displayed server `through` timestamp. It saves a
monotonic read cursor on the current user with `$max`. Older requests cannot
move it backward, and later-dated activity stays unread. Read cursors are hidden
from ordinary account/directory queries. Existing accounts need no migration.

Messages are the latest actionable daily feedback, not a chat or permanent
review archive. Resubmitting/resolving a returned report removes it from that
message view. Weekly submission is not approval, and neither it nor daily
approval automatically completes an internship. Old status records without a
recorded transition time do not receive invented notifications. Email, push,
live sockets, direct chat and delivery guarantees remain outside this scope.

## Scope and Limitations

This is a small learning backend, not a production-complete university system.
Push/email notifications, direct chat, general file attachments, exports, certificates, refresh tokens, password recovery,
weekly supervisor review and further company/opportunity editing are deferred.
Existing weekly draft editing and submission are retained.

Daily feedback keeps the latest correction message, not a full review history.
Placement completion is a manual admin decision, not a check of academic hours
or report requirements. Old placement seats remain reserved for their original
opportunity. Student profile completion is not an application eligibility rule.
Password changes do not revoke existing access tokens; they expire after 15 minutes.

The ongoing-placement index uses an `isOngoing` boolean for compatibility with
older MongoDB versions. Startup fills this field on existing placements, and
status changes keep it synchronized. Database initialization must succeed before
the server accepts requests.
