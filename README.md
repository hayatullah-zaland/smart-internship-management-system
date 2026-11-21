# Smart Internship Management System

A beginner-friendly university internship portal built with React, Vite,
Tailwind CSS, DaisyUI, Express and MongoDB. It supports four account roles:
administrator, student, academic supervisor (teacher) and company representative.

## Included Workflows

- Sign up/sign in, session restoration, account photo/profile, password changes and Light/Dark themes.
- Admin user categories, account creation/editing/status, guarded deletion, departments and student directory.
- Companies, representative assignment, opportunity publication and student applications.
- Application review, rejected-application resubmission, internship assignment and status history.
- Student daily reports, teacher feedback/corrections/approval and weekly draft/submission.
- Final academic/company evaluations, role-based dashboards, messages and notifications.
- Responsive navigation, page search and phone/tablet/desktop layouts.

## Requirements

- Node.js 22.12 or newer (Node.js 24 was used for verification) and npm.
- A running MongoDB server or an Atlas connection string.
- An existing admin account, or database access to promote your first account.
- Microsoft Edge for the default local browser tests; Chromium can also be used.

## Local Setup

Run these commands from the project root:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

If `backend/.env` already exists, keep it. For a new installation only:

```powershell
Copy-Item backend/.env.example backend/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET` inside `backend/.env`. Set
`MONGODB_URI` to your own database. Never publish this file or the secret.
The example uses local MongoDB, port 5000 and the frontend on port 5173.

Start the backend in one terminal:

```powershell
npm run dev --prefix backend
```

Start the frontend in another:

```powershell
npm run dev --prefix frontend
```

Open **http://localhost:5173**. The API health URL is
**http://localhost:5000/api/v1/health**. Health confirms that the server started;
it is not a continuous database-readiness check. Vite forwards `/api` to port
5000. If that port changes, update `frontend/vite.config.js` too.

## First Admin and Data Entry

1. Register your own account using Sign up. Public registration always creates a student; typing a different role in a request cannot create an admin.
2. For a new database, use MongoDB Compass to open that exact database's `users` collection, find your account by its email, and change only its `role` to `admin`. Do not change its password hash or delete other fields. Existing installations with an admin can skip this step.
3. Sign out and sign in again. Under Users, the admin can create teachers, company representatives, other admins and students.
4. Create departments. Students sign in and save their academic profiles, including student number and department.
5. Create companies and assign their representative accounts.
6. Representatives publish open opportunities with future deadlines. Students apply.
7. Admin reviews applications and assigns approved students to internships with a teacher and dates. Activate the internship when work begins.
8. Students save and then submit daily/weekly reports. Teachers can approve daily reports or return them for corrections. After editing, students must save and explicitly submit again.
9. Admin completes the internship. The assigned teacher and current company representative can submit their separate final evaluations.

If an application is rejected, the student can use **My applications > Apply
again** while the opportunity remains open and unexpired. Admin then refreshes
Applications and selects Pending or All statuses before reviewing it again.

The [Pashto data-entry guide](output/pdf/SIMS_Pashto_Data_Entry_Guide.pdf) remains
available. See [backend API details](backend/README.md) and
[frontend workflows](frontend/README.md) for endpoint and permission details.

## Run the Built Project

Build the frontend first:

```powershell
npm run build --prefix frontend
```

Then, in PowerShell with your backend environment configured:

```powershell
$env:NODE_ENV = "production"
npm start --prefix backend
```

Open **http://localhost:5000**. In production mode Express serves the built
frontend and API together, so refreshing `/dashboard` or another React URL
works without a separate Vite process. Missing API routes and missing asset
files remain JSON 404s, not HTML. Startup refuses a missing frontend build.
Stop an existing backend on port 5000 before starting this instance.

Use `Remove-Item Env:NODE_ENV` in that terminal before returning to development,
or set `NODE_ENV=production` in the deployment environment instead. After any
frontend changes, rebuild; `frontend/dist` is generated and is not committed.

For public internet hosting, configure HTTPS, MongoDB access restrictions and
backups, process monitoring, and login/signup rate limiting at your reverse
proxy or hosting platform. Serve both the app and API through the same origin.
There is no built-in email verification or forgotten-password recovery, and
changing a password does not revoke already issued 15-minute access tokens.
These limits matter before admitting real users on a public server. No hosting
or production deployment has been performed by this cleanup.

## Checks

```powershell
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
npm run test:browser --prefix frontend
npm run test:browser:production --prefix frontend
```

Ordinary backend tests mock database methods. Browser tests intercept all API
requests, so they never modify your real accounts. They reuse Vite on port
5173 or start a temporary test Vite server. Do not run against an unrelated app
on that port. For browsers other than Edge, see the frontend test instructions.
The production browser command requires a fresh build and both folders'
dependencies; it tests Express-hosted pages on the reserved test port 5180
without connecting to MongoDB. It does not reuse an existing server there.

The optional real-MongoDB workflow is documented in the backend README. It
creates and removes only its own randomly named test database, never the
configured application database. Use credentials permitted to create that
separate database. GitHub Actions runs the ordinary tests, lint, build and
mocked browser suite without requiring your `.env` or database credentials.

## Repository Cleanup

Release verification: 568 frontend tests, 53 ordinary backend checks, all 96
built-app browser cases, and the separate isolated real-MongoDB workflow passed.
Frontend lint and the production build passed without warnings. npm audit
reported no known vulnerabilities in either folder. Public hosting setup and
testing against your real accounts remain the operator's responsibility.

Keep source, lockfiles, tests, environment examples, requirements and the Pashto
guide. Dependencies, production builds, logs, credentials and browser test
outputs are local/generated files and stay ignored. Six unused backend
dependencies were removed; the project uses Node's built-in test runner.
No accounts, photos, reports, company records or other application data are
removed by this cleanup. Do not delete your database to install an update.
