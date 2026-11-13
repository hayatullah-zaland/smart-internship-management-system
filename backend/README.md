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
