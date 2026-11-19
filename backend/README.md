# SIMS Beginner Backend

The reduced project covers accounts, companies, opportunities, applications,
placements, daily reports, weekly drafts/submission, student academic profiles,
departments, final evaluations and role-based dashboard counters.

## Run

Use Node.js 22 or newer. Configure the existing `.env` locally with
`MONGODB_URI`, a `JWT_SECRET` of at least 32 characters, and optionally `PORT`
(default 5000) and `CLIENT_ORIGIN` (default http://localhost:5173).
Never commit passwords, connection strings or tokens.

```powershell
cd backend
npm install
npm run dev
```

Sign in with `POST /api/v1/auth/signin`. Put the returned `data.token` in
Postman's Authorization tab as a Bearer Token. Public signup always creates a
student. Set the first admin's role directly in your own MongoDB database; later
admins can create role-based accounts using `POST /api/v1/auth/create-user`.

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

## Admin User Management

Use an active admin's bearer token. The frontend page is `/admin/users`.

- `POST /api/v1/auth/create-user` creates a user with name, email, password and an explicitly chosen role.
- `PATCH /api/v1/users/:id` updates a non-admin account's `name` and `email` only. Both are required; names are trimmed, emails are lowercase and duplicate emails return 409. Roles, passwords, photos and status are not reassigned here.
- `PATCH /api/v1/users/:id/status` activates or deactivates a non-admin account using a boolean `isActive`.
- `DELETE /api/v1/users/:id` permanently deletes only an inactive, unused, non-admin account. Deactivate first. Academic profiles, applications/reviews, internships, company links, opportunities, reports/reviews and evaluations referencing the account block deletion with 409. No associated records are deleted.
- `GET /api/v1/users?page=1&limit=10` lists accounts without passwords or photos.

Administrator accounts cannot be deleted, deactivated or edited through these
management routes; use `/auth/me` for your own name/email/photo. The delete
query rechecks role and inactive status in case they changed after validation.
All account-management writes require a valid admin session; other roles get
403 and expired or inactive sessions get 401. No data migration is needed.

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

The response is JSON for a future frontend; this does not create a dashboard UI.
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

## Scope and Limitations

This is a small learning backend, not a production-complete university system.
Notifications, uploads, exports, certificates, refresh tokens, password recovery,
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
