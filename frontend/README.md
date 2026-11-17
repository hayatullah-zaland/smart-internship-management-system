# SIMS Frontend

React with Vite, Tailwind CSS and daisyUI, using JavaScript.

## Start

Run these commands from this folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## Commands

- `npm run dev`: start the development server.
- `npm run build`: create a production build.
- `npm run preview`: preview the production build.
- `npm run lint`: check the JavaScript code.
- `npm test`: run session, dashboard, student-profile, department, opportunity API and rendering tests using Node's built-in test runner.

## Main Files

- [src/main.jsx](./src/main.jsx): starts React and wraps the app in BrowserRouter and the shared providers.
- [src/App.jsx](./src/App.jsx): matches URLs to pages using React Router.
- [src/pages/Login.jsx](./src/pages/Login.jsx): email/password form and automatic redirect after sign-in.
- [src/pages/Signup.jsx](./src/pages/Signup.jsx): student registration and account-created confirmation.
- [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx): loads role-specific counters and displays the signed-in dashboard and account details.
- [src/pages/StudentProfile.jsx](./src/pages/StudentProfile.jsx): loads the student's academic profile and available departments.
- [src/pages/Departments.jsx](./src/pages/Departments.jsx): admin-only department creation and list refresh.
- [src/pages/Opportunities.jsx](./src/pages/Opportunities.jsx): authenticated opportunity browsing with page URLs and refresh/retry.
- [src/components/OpportunityList.jsx](./src/components/OpportunityList.jsx): opportunity summaries, expandable descriptions and previous/next controls.
- [src/context/opportunityApi.js](./src/context/opportunityApi.js): paginated browsing requests and validation of opportunity/company data.
- [src/components/DepartmentForm.jsx](./src/components/DepartmentForm.jsx): name/code form with validation and server-confirmed creation.
- [src/components/DepartmentList.jsx](./src/components/DepartmentList.jsx): department table, loading/empty states and retry.
- [src/context/departmentApi.js](./src/context/departmentApi.js): shared department listing and admin creation requests.
- [src/context/apiRequest.js](./src/context/apiRequest.js): bearer/JSON request helper shared by profile, department and opportunity APIs.
- [src/components/StudentProfileForm.jsx](./src/components/StudentProfileForm.jsx): academic form, field validation, save/reset and empty-department state.
- [src/context/studentProfileApi.js](./src/context/studentProfileApi.js): authenticated profile requests, field validation and response normalization.
- [src/components/DashboardStats.jsx](./src/components/DashboardStats.jsx): summary metrics, loading placeholders, refresh and error/retry states.
- [src/context/dashboardApi.js](./src/context/dashboardApi.js): authenticated dashboard request and role/counter validation.
- [src/components/Navbar.jsx](./src/components/Navbar.jsx): shared signed-in navigation with branding, account name/role, theme toggle and sign-out.
- [src/components/NavbarClock.jsx](./src/components/NavbarClock.jsx): live date/time display using the Asia/Kabul timezone.
- [src/components/Sidebar.jsx](./src/components/Sidebar.jsx): dashboard/account/opportunity links, student-only My profile and admin-only Departments.
- [src/components/DashboardLayout.jsx](./src/components/DashboardLayout.jsx): shared desktop sidebar, sticky navbar, main content and mobile navigation dialog.
- [src/components/ProtectedRoute.jsx](./src/components/ProtectedRoute.jsx): requires a session and optionally restricts a route to one role.
- [src/components/AuthLayout.jsx](./src/components/AuthLayout.jsx): shared header, theme switch, form panel and footer.
- [src/components/Brand.jsx](./src/components/Brand.jsx): shared SIMS branding.
- [src/context/AuthContext.js](./src/context/AuthContext.js): shared authentication context.
- [src/context/AuthProvider.jsx](./src/context/AuthProvider.jsx): sign-in/signup, sign-out and session restoration before rendering routes.
- [src/context/authSession.js](./src/context/authSession.js): tab-scoped token storage, current-user validation and the authenticated session check.
- [src/context/ThemeProvider.jsx](./src/context/ThemeProvider.jsx): shared light/dark theme and saved preference.
- [src/components/ThemeToggle.jsx](./src/components/ThemeToggle.jsx): accessible theme switch in the header.
- [src/index.css](./src/index.css): imports Tailwind CSS, enables daisyUI and defines global styles.
- [vite.config.js](./vite.config.js): plugins and development API proxy.

Tailwind uses `tailwindcss` and `@tailwindcss/vite`. This setup does not need a
separate Tailwind configuration file or PostCSS configuration.

daisyUI is installed as a development dependency and enabled with
`@plugin "daisyui";` in the CSS file. Its component classes can be used directly
in React, for example `<button className="btn btn-primary">Sign in</button>`.

## Login

Start the backend in a separate terminal:

```bash
cd backend
npm run dev
```

Then start the frontend from this folder with `npm run dev`. Vite forwards
`/api` requests to the backend at `http://127.0.0.1:5000` during development.
If the backend uses another port, update the proxy target in the Vite config.
Production hosting will need its own API routing configuration.

Use an existing account's email and password. Sign in calls
`POST /api/v1/auth/signin`. The page supports password visibility, pending and
error states. Successful sign-in updates the shared user/token state and
automatically redirects to `/dashboard`. The dashboard shows the account's
name, email and role, and provides a sign-out button.

Successful sign-in saves only the access token under `sims-access-token` in
`sessionStorage`. It survives refreshes in the same browser tab. Account details
and passwords are not saved there. On reload, `GET /api/v1/auth/me` checks the
saved token and loads the current user's name, email, role and active status
from the backend. Routes wait for this check, avoiding an incorrect redirect
to login while the account is still loading.

HTTP 401 clears the saved token and returns to login. Connection failures,
timeouts, invalid responses and server errors keep the token and offer **Retry**
or **Sign out**. Signing out removes the stored token as well as React state.
Closing the tab normally ends its storage session; this is not a cross-tab or
permanent "remember me" feature. If storage is blocked, sign-in still works in
memory but cannot survive a reload. Use the same host and port when testing;
`localhost` and `127.0.0.1` have separate browser storage.

The backend token still expires 15 minutes after sign-in; refreshing the page
does not extend it. There is no refresh-token flow or proactive expiry timer.
This is a simple learning-project solution, not production token storage:
JavaScript can read `sessionStorage`, so XSS could steal the token. A production
deployment should use a server-managed, Secure/HttpOnly cookie design with CSRF
protection instead. See the [OWASP session-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Signup

On the login page, select **Create an account**. Enter a name, email, password
and matching password confirmation. The frontend sends only name, email and
password to `POST /api/v1/auth/signup`; the backend creates a student account.
There is no public role selector.

Registration checks password length and confirmation, shows pending/error
states and displays an account-created message on success. It does not sign in
automatically. Select **Go to sign in** to use the new credentials. Login and
signup use the same light/dark appearance and shared layout.

## Page Routing

React Router gives each page its own URL:

- `/login`: sign-in form; signed-in users are redirected to `/dashboard`.
- `/signup`: student registration; signed-in users are redirected to `/dashboard`.
- `/dashboard`: basic protected page with account details and sign-out.
- `/profile`: academic profile for signed-in students; other roles return to `/dashboard`.
- `/departments`: department list and creation form for admins; other roles return to `/dashboard`.
- `/opportunities`: open internship opportunities for every signed-in role; `?page=2` selects another page.
- `/` and unknown paths: redirect to `/login` without adding a history entry.

The login and signup pages use `Link` instead of callback buttons. Navigation
changes the URL without reloading the app, so browser Back/Forward works and
the session and theme remain available. Refreshing restores the session after
checking the saved token with the backend.

`ProtectedRoute` checks the shared authentication state before rendering the
dashboard. If either the user or token is missing, it redirects to `/login`
using `replace`. Sign-out clears both values, so the same guard returns the
user to `/login`. Signed-in users cannot reopen the login/signup forms unless
they sign out first. The dashboard now requests the signed-in role's statistics.

This frontend guard controls navigation only. It does not verify a JWT, revoke
a token on sign-out, or replace backend authorization. Protected API endpoints
must continue checking the token, account status and permissions on the server.

To check locally:

1. Without signing in, open `/dashboard`; you should arrive at `/login` without seeing account details.
2. Try an incorrect password; the error should stay on `/login`.
3. Sign in with an existing account; `/dashboard` should open automatically and show your name, email and role.
4. While signed in, use links or the browser history to visit `/login` or `/signup`; both should redirect to `/dashboard`.
5. Select **Sign out**, then try browser Back or `/dashboard`; the dashboard should remain inaccessible.
6. Sign in again and refresh `/dashboard` before the 15-minute token expiry; the session check should finish and the dashboard should remain signed in.
7. Switch themes and navigate between pages to check that the selected theme stays.

Vite supports these page URLs during development. A production web host must
serve `index.html` for frontend page routes, while keeping `/api` routed to the
backend. Otherwise opening or refreshing a page URL can return a host-level 404.

## Light and Dark Mode

The header's moon/sun button switches between the daisyUI light and dark themes.
The choice is stored under `sims-theme` in browser local storage. Without a saved
choice, the initial theme follows the device preference. If storage is blocked,
switching still works but may not survive a refresh. The auth forms and the
dashboard use theme-aware colors. Authentication data is not saved
with this appearance preference.

## Navbar

The signed-in navbar stays at the top while the page scrolls. On desktop it
shows the current workspace location; on smaller screens it shows a compact
SIMS brand and a navigation-menu button. The brand links to `/dashboard`
without reloading the app.

The navbar reads the name and role from `AuthContext`, reuses `ThemeToggle`,
and calls the existing `signOut` action from its labelled sign-out icon button.
The account initial remains visible on phones, while the full name and role
appear from medium screens upward. Long names have bounded, truncated text
with a full-value title. Screen readers can still read the account identity on
phones. Login and signup keep their existing `AuthLayout` header.

Message and notification icons sit next to the theme toggle. They are disabled,
with hover/focus tooltips indicating that they are not available yet: the project
does not currently have messaging or notification endpoints. No unread badges,
invented notifications or empty inbox results are displayed. On narrow phones
the tools use their own row below the date/time, keeping the brand, menu and
account controls in the first row without crowding the clock.

The navbar also shows the Gregorian date and a 12-hour clock with seconds in
`Asia/Kabul` time, labelled **Kabul**. The clock reads the device's current time
and updates once per second; it does not contact the backend or reload dashboard
counts. Its timer is cleared on unmount. The date and time stay side by side at
every screen size. On wide desktops they sit beside the account controls; on
smaller screens they share a separate full-width slim row. The display has
stable time-digit spacing and does not announce every tick to screen readers.

## Sidebar and Dashboard Layout

`DashboardLayout` gives signed-in pages a 248px sidebar on desktop and a
full-width content area on smaller screens. `Sidebar` shares the same links
between desktop and mobile navigation:

- **Dashboard** opens `/dashboard`.
- **Account details** opens `/dashboard#account`, scrolling and moving focus
  to the existing account section. It is not a separate profile-editing page.
- **My profile** opens `/profile` for students only, with their academic details.
- **Departments** opens `/departments` for admins only, with the department list and creation form.
- **Opportunities** opens `/opportunities` for every signed-in role, with the open-opportunity browsing list.
- **My applications** opens `/applications` for students only, with their own submitted applications and current decisions.
- **Applications** opens `/admin/applications` for admins only, with student applications and review forms.
- **Internships** opens `/internships` for admins, students and academic supervisors. Admins can assign placements; the other two roles see their scoped records.

The selected link has a visual indicator and `aria-current`. Only existing
destinations are included; no unfinished module links or fake statistics were
added. The dashboard's account details remain an unframed section.

On phones and tablets, the menu button opens a native modal `dialog` styled as
a side drawer. Native dialog behavior contains keyboard focus, makes the
background inactive, handles Escape and restores focus after closing. A close
button, backdrop click and selecting a navigation link also close the drawer.
Body scrolling is locked only while it is open and restored on close/unmount.
Browser Back/Forward and resizing to desktop also close it. A keyboard-visible
skip link moves directly to the main content.

No new dependencies were needed for this layout. The existing light/dark theme
and logout guard still apply; session restoration is described above.

To check the layout locally:

1. Sign in and inspect the sidebar, sticky navbar and account section at desktop width.
2. Follow both sidebar links and check the active indicator, URL and account-section focus.
3. Resize below 1024px, open the menu and use Tab/Shift+Tab, Escape, the close button and the backdrop.
4. Reopen the menu and select a link; it should close and return to the selected content.
5. Open the menu, then use browser Back/Forward or resize to desktop; it should close and page scrolling should return.
6. Try a long account name, both themes, a narrow phone viewport and keyboard navigation.
7. Sign out from the navbar; the protected dashboard should remain inaccessible.

Interactive browser and mobile screenshot checks require a connected browser.

## Dashboard Statistics

The dashboard calls `GET /api/v1/dashboard/stats` with the current bearer
token when it opens. Use the summary's refresh icon to request the counts again
without reloading the page or losing the current login. There is no automatic
polling, and the metric tiles are read-only until their module pages are built.

The backend decides the scope and returns different counters for each role:

- **Admin:** students, companies, departments, pending applications, active internships and completed internships. Pending applications include both pending and under-review applications.
- **Student:** the student's applications, active internships, daily reports, weekly reports and evaluations.
- **Academic supervisor:** assigned internships across all statuses, active internships, submitted daily/weekly reports for those internships, and evaluations written by the supervisor.
- **Company representative:** represented companies, open opportunities with a future deadline, active/completed company internships, and evaluations written by the representative.

Loading shows matching placeholders, not invented zero counts. Real zeros from
the database are displayed as `0`. The client rejects responses for a different
role, missing counts, negative values and non-integer counts. Very large counts
use compact notation; their full values remain in the title and accessible label.

Connection, timeout and server failures show a readable error and **Retry**.
Requests time out after 15 seconds and are cancelled when the dashboard leaves
the screen or a new request replaces them. Previous-account or older-request
results are not displayed. Any HTTP 401, including expired/invalid tokens or an
unavailable account, clears the session and returns to login through the guard.
This happens when a request is made, not automatically at the token's expiry time.
HTTP 403 and server errors show an error without treating the user as signed out.

To check locally:

1. Start the backend and frontend, then sign in with an existing account.
2. Check that the summary matches the signed-in role and the database; empty collections should produce real zeros.
3. Use **Refresh summary** to update counts without a full-page refresh.
4. Stop the backend, refresh the summary, then restore the backend and use **Retry**.
5. After a token expires, refresh the summary; the app should return to login.
6. Check both themes and narrow/wide screens, including the Account details sidebar link.

`npm test` checks token storage/clearing, blocked storage, session-response
validation, the initial restoration gate, API request headers, every role's
counters, invalid/failed responses, cancellation, timeout signals and
server-rendered UI states, including the navbar icons. It uses mock API responses
and does not modify application data. These checks do not execute browser
reloads or the React restoration effect end to end. Interactive browser testing,
mobile layout checks and a successful live login/refresh/sign-out flow require
a connected browser and existing account credentials.

To check session recovery, stop the backend after signing in, reload the page
and wait for the connection error. Restore the backend and select **Retry**;
the dashboard should reappear if the token is still valid. After **Sign out**,
reloading `/dashboard` must continue to show login. An expired token must also
return to login instead of entering a retry loop.

## Student Profile

Sign in as a **student** and choose **My profile** in the sidebar. This page
shares the existing navbar, desktop sidebar, mobile drawer and light/dark themes.
The account name and email are shown read-only; this step does not change login
details, passwords or roles.

The page uses the existing backend endpoints, with the current bearer token:

- `GET /api/v1/students/me`: load the student's academic profile. A JSON 404
  means no profile exists yet, so a blank form opens instead of an error.
- `GET /api/v1/departments?page=1&limit=100`: load department choices, following
  additional pages until all available departments have been read.
- `PUT /api/v1/students/me`: create or update the authenticated student's profile.

The saved JSON contains only these four fields:

```json
{
  "studentNumber": "STU-001",
  "departmentId": "<an existing department's MongoDB ID>",
  "semester": 3,
  "phone": "+93 700 123 456"
}
```

Student numbers accept 1-30 letters, numbers or hyphens and are trimmed and
uppercased. Semester must be a whole number from 1 to 12. Phone numbers accept
7-25 characters containing digits, spaces, `+`, `(`, `)` and `-`, with at least
7 digits. The backend still validates every submission and prevents duplicate
student numbers. A student never sends a user ID to choose another account.

**Save profile** is enabled after changes. Saving disables inputs and duplicate
submissions, preserves entered values on errors and shows success only after
the server confirms valid saved data. **Reset changes** returns to the last
loaded or successfully saved values; it does not delete a profile. GET returns
a populated department and PUT returns its ID; both are mapped into the same
form fields.

When no departments exist, student number, semester and phone remain editable.
Only department selection and saving wait for an available department. The
refresh icon beside **Department** reloads choices without clearing unsaved
form edits, and is also available when the list already has departments.
An admin can create a real department on the **Departments** page, which uses
the existing backend `POST /api/v1/departments` endpoint. Postman remains another
option. Students select an existing department; they cannot create or rename
departments from their profile form. The frontend does not invent department
options or create database seed data.

Initial loading hides the form until both requests finish. Loading failures
offer **Retry**. Save failures keep edits visible. Requests have a 15-second
timeout and are cancelled when the page/form leaves the screen. HTTP 401 clears
the session; HTTP 403, conflicts and server failures show errors without signing
the user out. The route guard and student-only sidebar are navigation controls;
backend authorization remains responsible for protecting the data.

To check locally:

1. Start the backend and frontend, then sign in as a student and open `/profile`.
2. If needed, create a department with an admin account at `/departments` (or in Postman), then use **Refresh departments** on the student form.
3. Enter a unique student number, choose a department, semester and phone, then save.
4. Reload the page while the token is valid; the saved academic details should return.
5. Edit the semester/phone and save again; use **Reset changes** to discard later unsaved edits.
6. Try an invalid semester, short phone and an already-used student number; errors must not erase edits or claim success.
7. Check both themes, a narrow viewport, mobile navigation and the active sidebar/breadcrumb.
8. Sign in as another role and open `/profile`; the frontend should return to the dashboard and the API should still enforce its student-only permissions.

Tests use mock API responses and SSR markup. They cover request contracts,
normalization, validation, missing profiles, full department pagination, failures,
timeout/cancellation, prefilled/empty forms and student-only navigation. They do
not insert application data or verify a real authenticated save or browser reload.

## Admin Departments

Sign in with an existing **admin** account and open **Departments** from the
sidebar, or visit `/departments`. The page shares the current dashboard layout,
responsive sidebar/navbar and light/dark themes. Other roles do not see this
link and the route guard sends them to their dashboard. This does not change
any account's role or replace backend permission checks.

The form accepts a department name (2-100 characters after trimming) and a code
(1-20 letters, numbers or hyphens). It calls `POST /api/v1/departments` with only
`name` and `code`. Codes are uppercased and must be unique in the database.
For example:

```json
{
  "name": "Computer Science",
  "code": "CS"
}
```

Inputs are disabled while saving. A confirmed success clears the form, shows
the created department's name/code and requests the list again. Failed saves,
including duplicate-code errors, retain entered values. A network timeout may
happen after the server has saved a department, so its error asks the user to
refresh the list before retrying; the app does not automatically repeat POSTs.

The list uses `GET /api/v1/departments?page=1&limit=100`, continuing through any
additional pages. This is the same shared function used by the student-profile
dropdown and its refresh icon. The table displays names and codes without
editing or deletion controls. Loading hides older results, an empty response
shows an empty state, and failures offer **Retry**. Its refresh button reloads
the list without discarding text currently entered into the creation form.

The GET endpoint is available to authenticated students for their profile
choices; the backend restricts POST to admins. HTTP 401 clears the session.
HTTP 403, duplicate-code conflicts and server errors remain visible errors,
not fake successes or automatic logouts. Both operations use a 15-second
timeout and abort their client requests when leaving the page.

To check locally:

1. Sign in as admin and visit `/departments`.
2. Add `Computer Science` with code `CS`, or use another unused code.
3. Check the success message and refreshed list, then reload to check persistence.
4. Submit the same code again; the backend conflict must be shown and inputs retained.
5. Try an empty/short name or invalid code, then check both themes and narrow screens.
6. Sign in as a student, open **My profile** and refresh the department choices; the new department should be available.
7. As a student, supervisor or representative, visit `/departments` directly; the admin page should remain inaccessible.

Tests cover creation payloads, validation, shared list visibility, duplicate and
permission errors, malformed responses, timeouts/cancellation, table states,
escaping, navigation and the admin route guard. They use mock API data and SSR
markup, not real database inserts or an authenticated browser workflow. No new
dependencies or backend/database changes are part of this frontend step.

## Opportunities

Sign in and open **Opportunities** from the sidebar, or visit `/opportunities`.
All four existing roles can browse, matching the backend's authenticated GET
permission. The page reuses the dashboard layout, themes and session guard.

It calls `GET /api/v1/opportunities?page=1&limit=10`. The backend returns only
open opportunities whose deadline has not passed at request time, with populated
company names and addresses. The client checks IDs, pagination, titles,
descriptions, company data, deadlines, capacities and status before displaying
results. Invalid responses show an error rather than a misleading empty list.

Each summary shows the title, company, deadline and capacity. Its native
`details`/`summary` control opens the full plain-text description and company
address without another request or a new backend detail endpoint. Text is
escaped rather than rendered as HTML. If a referenced company is unavailable,
the opportunity explicitly says so instead of inventing company information.

Deadlines are displayed in **Asia/Kabul** time with an absolute `dateTime` value.
Capacity is the opportunity's total advertised capacity, not remaining seats.
The opportunity information is a snapshot: there is no countdown, polling or automatic
deadline-expiry removal while a page stays open. **Refresh opportunities**
requests the latest backend-filtered data.

Pages use the URL query, such as `/opportunities?page=2`, so reload and browser
Back/Forward retain page selection. Invalid page query values use page one.
There is no total count in the API: Next is enabled after a full page of ten
results, so an exact multiple of ten can lead to one final empty page. Previous
remains available there. No total page count, unread count or application count
is invented.

Loading hides earlier-page/account data and disables pagination. Empty pages
show an honest empty state, while connection/server failures offer **Retry**.
Requests use the shared 15-second timeout, abort on page changes/unmount and
clear the session on HTTP 401. Other errors are shown without signing out.

This page does not publish opportunities. To see real
data, use an existing open opportunity or the existing backend's
`POST /api/v1/opportunities` as a company representative assigned to that company,
with a future deadline. No sample records are inserted by the frontend or tests.
Publishing forms remain a separate step. Students can now submit applications
from the opened opportunity details, as described below.

To check locally:

1. Sign in and visit `/opportunities`; check title, company, capacity and Kabul deadline for real records.
2. Open and close a summary by mouse or keyboard and check the full description/address.
3. With more than ten open records, use Previous/Next, reload and browser Back/Forward.
4. Check an empty page, refresh, backend connection failures and Retry.
5. Check both themes and narrow screens with long titles and descriptions.
6. Sign out and reopen the URL; the login guard must prevent access.

Tests use mock API responses and SSR markup for request contracts, field
validation, pagination boundaries, errors, cancellation/timeouts, date formatting,
escaped details, empty/loading states and role-aware navigation. They do not
execute native details interaction, browser history or an authenticated live
browsing workflow. No new dependencies or backend changes were needed.

## Student Applications

Sign in as a **student**, open an opportunity's details and select **Apply**.
The button calls the existing `POST /api/v1/applications` endpoint with only
`{ "opportunityId": "<the selected opportunity ID>" }`. The backend sets the
student identity and initial pending status; the frontend never supplies a
student ID, decision, reviewer or rejection reason. A saved academic profile is
not an additional requirement of this backend endpoint.

Apply is disabled while submitting, with a synchronous request lock against
repeated clicks. Success appears only after the response contains a valid saved
pending application for that opportunity. A duplicate HTTP 409 instead says
the student has already applied and disables that action. The backend's unique
index remains responsible for duplicate prevention, including across tabs.
On page changes, refresh or reload, action state is not persisted; trying an
already-submitted opportunity safely receives the backend's duplicate response.

Requests retain the shared 15-second timeout and are aborted on unmount. Abort
cannot undo a server write. Network, timeout, malformed-response and server
failures may happen after a save, so they do not claim success: the error asks
the student to check **My applications** before retrying. POST is never retried
automatically. Known closed/deadline, missing-opportunity and permission errors
show the backend message. HTTP 401 clears the session; other failures do not.

**My applications** is available from the student sidebar, the Apply action and
`/applications`. It calls `GET /api/v1/applications/me?page=1&limit=10` without a
student ID. The backend scopes the records to the signed-in student. The page
shows the opportunity, company, submission date, opportunity deadline and the
actual pending, under-review, approved, rejected or withdrawn status. Rejected
applications show their plain-text rejection reason when present. Missing
referenced opportunities/companies have explicit unavailable labels; old,
closed or expired opportunities do not remove applications from history.

Dates use Asia/Kabul. Pagination uses the URL query for reload/history and the
same full-page Next convention as Opportunities, since there is no total count.
Loading, empty pages, refresh, errors and Retry are separate states. Obsolete
requests are cancelled and earlier-page/account data is hidden. The student
route guard and navigation do not replace backend authorization. Other roles
can still browse opportunities but see no Apply action or My applications link.

The student page does not offer admin review controls, withdrawal, uploads, publishing
forms, automatic internship creation, new dependencies or backend changes. No
sample records or account changes are made by tests.

To check locally with real existing accounts/data:

1. Use a company representative's existing future-dated open opportunity; if none exists, create it using the backend in Postman.
2. Sign in as a student, open `/opportunities`, expand a record and choose Apply.
3. While submitting, verify repeated clicks are disabled. After success, open My applications and check the pending record.
4. Reload Opportunities and apply for the same opportunity; verify the duplicate message and only one saved application.
5. Refresh My applications, reload it and use pagination/Back/Forward when enough records exist.
6. If an admin reviews the application through the existing backend, refresh the list to check the decision/rejection reason.
7. Check both themes, long text and narrow screens. Test connection failures and expired sessions; uncertain submissions must not claim success.
8. As each non-student role, check that Apply/My applications are absent and direct `/applications` navigation returns to the dashboard.

Automated tests use mocked API responses and server-rendered markup for request
payloads, response validation, status labels, errors, cancellation/timeouts,
pagination, escaped text, action states and student-only navigation/guards.
They do not execute browser clicks, request-lock behavior, history or a real
authenticated database submission; those require an interactive browser check.

## Admin Application Review

Sign in with an existing **admin** account and open **Applications** in the
sidebar, or visit `/admin/applications`. Other roles do not see this link and
the route guard returns them to their dashboard. Backend admin authorization
still protects both endpoints; the frontend does not change account roles.

The page calls `GET /api/v1/applications?page=1&limit=10`, optionally adding a
`status` filter. All five backend statuses are available, with All statuses as
the default. Changing the filter starts at page one. Filter and page selection
are stored in the URL for reload and Back/Forward; invalid values fall back to
All statuses/page one. Pagination follows the existing no-total-count contract.

The shared application list now optionally displays student names and emails,
without changing the student history view. Missing student, company or
opportunity references are labelled unavailable rather than hiding the record.
Dates use Asia/Kabul, and data/rejection reasons remain escaped plain text.

Expand **Review application** on a pending or under-review record, choose a
decision and explicitly select **Save decision**. Pending applications can move
to Under review, Approved or Rejected. Under-review applications can only be
approved or rejected. Approved, rejected and withdrawn records have no review
form. The backend remains authoritative if another admin makes a decision.

`PATCH /api/v1/applications/:id/decision` receives only `status`, plus a trimmed
`rejectionReason` for rejection. A reason of 1-1000 characters is required.
Student IDs, reviewer identity and review timestamps are never supplied by the
form. The response must confirm the matching application, decision, reason,
reviewer and review timestamp before success is shown. No internship is created
by approving an application.

One write can run at a time, protected by a synchronous request reference.
Review fields, list refresh, pagination and the status filter are disabled while
saving. A confirmed decision refreshes the list; filtered records may disappear
if their new status no longer matches. Server validation/permission failures
keep form values. Conflict (409), missing-record (404) and uncertain network,
timeout/server or malformed-response failures require a successful list refresh
before another review. PATCH is never retried automatically. Refresh errors
remain errors, not empty success states.

Both operations reuse the existing bearer helper, 15-second timeout and abort
signals. Leaving the page or changing page/filter/account cancels obsolete
requests, hides older results/notices and cannot undo a write already accepted
by the server. HTTP 401 signs out; other failures remain readable errors.
The student can see an updated decision by refreshing **My applications**;
there are no push notifications or automatic polling.

To check locally with real existing accounts/data:

1. Submit an application from a student account, then sign in as admin and open Applications.
2. Check the student's name/email, opportunity/company and pending status; try the status filter and pagination.
3. Expand Review application, choose Under review and save; check the refreshed status.
4. Approve the record, or reject another record with a reason; terminal records must have no review form.
5. Try a blank/whitespace rejection reason and verify validation keeps the form. During saving, repeated submissions and list controls must be disabled.
6. Sign in as the student and refresh My applications; check the decision and any rejection reason.
7. Test a stale decision from two admin sessions and a connection failure; refresh the list before retrying uncertain/conflicting decisions.
8. Check both themes, narrow screens, long text, expired sessions and direct URL access from every other role.

Tests use mocked API responses and SSR markup for admin contracts, permitted
payloads, response validation, filters, pagination, reason boundaries, errors,
cancellation/timeouts, transition controls and admin-only routes/navigation.
They do not execute browser clicks, effects, simultaneous writes or real
authenticated reviews. No backend edits, new dependencies or database seeds
are included in this frontend step.

## Internship Assignments

Open **Internships** from the sidebar or `/internships`. The page is available
to admins, students and academic supervisors, matching the backend GET access.
Company representatives do not have this link and the route guard sends them
to the dashboard. The existing guards for single-role pages are unchanged.

The list calls `GET /api/v1/internships?page=1&limit=10` with the current
bearer token and no supplied identity filter. The backend returns all records
for admins, the student's own records, or the academic supervisor's assigned
records. It shows the opportunity, company/address, student, supervisor, start
and end dates, and actual assigned/active/completed/cancelled status. Missing
references have explicit unavailable labels. Dates are calendar dates displayed
in UTC, matching the backend's interpretation of date-only input rather than
shifting a placement's dates with the device timezone.

Admins additionally have a four-field **Assign internship** form:

- Approved application, loaded from the existing admin applications API with
  `status=approved`, following all pages. Records missing a student, opportunity
  or company are omitted from the choices.
- Active academic supervisor, found by reading every page of the admin users
  endpoint and filtering active `academic_supervisor` accounts locally. The
  backend does not provide a role-filtered users endpoint.
- Start date and end date, both valid `YYYY-MM-DD` calendar dates, with the end
  strictly after the start. Past dates are not blocked by this backend contract.

If an academic supervisor account does not exist, an admin can create one with
the existing `POST /api/v1/auth/create-user` endpoint in Postman, using their
admin bearer token and the usual name/email/password fields plus
`"role": "academic_supervisor"`. This step does not add account-management UI or
create/promote any accounts automatically. Approve a student application on
the **Applications** page before assigning it.

The choices refresh icon reloads both collections without discarding entered
dates or selected IDs. Missing choices show empty/unavailable states; dates
remain editable while no choices exist. Choices and saving wait for a
successful refresh after a load error. Initial loading never invents options.

`POST /api/v1/internships` sends only `applicationId`, `supervisorId`, `startDate`
and `endDate`. The server controls student, company, opportunity, creator, seat
and initial assigned status. Success requires a valid saved record matching the
chosen application, supervisor and dates. After confirmation, the form clears
and the list returns to page one and refreshes.

Approved application choices are not a guarantee of available capacity or
eligibility: already placed applications remain approved in the backend. The
backend checks active users, duplicate placements, one ongoing internship per
student, company existence and seat availability. Those conflict/validation
messages are displayed and form values are retained. The frontend does not
invent remaining seats or silently reassign an existing placement.

Requests reuse bearer authentication, the 15-second per-request timeout and
abort support. Submission has a synchronous duplicate-click lock and disables
the form while pending. Network, timeout, malformed-response and server failures
may occur after a save: they ask the user to refresh the internship list before
retrying and never claim success or automatically retry POST. Aborting cannot
undo an accepted write. HTTP 401 signs out; other failures remain errors.

The list has URL pagination, empty/loading/error states, Retry and refresh.
Students and supervisors do not fetch admin-only choices or see assignment
controls. Status changes are now available to admins as described below.
Report writing and account-management UI remain separate steps; no backend
change or new dependency was needed for these frontend features.

To check locally with existing accounts/data:

1. Submit and approve a student application, and have an active academic supervisor account available.
2. Sign in as admin, open Internships, select the application/supervisor, and enter start/end dates.
3. Assign once, then check the success message and refreshed assigned record. Reload to check persistence.
4. Try an equal/earlier end date or an impossible calendar date; validation must keep the entered values.
5. Try a duplicate application, an already placed student or full opportunity; the backend error must not erase the form or claim success.
6. Refresh choices after approving another application or creating a supervisor; existing draft dates should remain.
7. Sign in as the student and assigned supervisor; each should see only their records and no assignment form.
8. Test both themes, long names, mobile widths, pagination/history, connection failures, expired sessions and company-representative direct URL access.

Automated checks use mocked API responses and SSR markup for contracts,
calendar validation, complete choice pagination, filtering, response validation,
request errors, cancellation/timeouts, list/form states and allowed-role guards.
They do not execute browser effects/clicks or real authenticated assignments,
capacity races or mobile visual checks. Tests do not seed database records.

## Internship Status Updates

Admins can expand **Update status** on an assigned or active record in
**Internships**, select the next status and explicitly save:

- Assigned can become Active or Cancelled.
- Active can become Completed or Cancelled.
- Completed and Cancelled are terminal and have no editing form.

The form accepts an optional reason for activation/completion and requires a
nonblank cancellation reason. Reasons are trimmed and limited to 1000
characters. It calls the existing admin-only
`PATCH /api/v1/internships/:id/status` with only `status` and a nonempty reason,
never reviewer identity, timestamps, history entries or `isOngoing`. The backend
checks the current status, handles concurrent changes, and saves status,
ongoing state and history together. A completed/cancelled internship releases
the student's ongoing-placement restriction, but the existing backend still
counts historical opportunity slots when assigning capacity; the UI does not
promise a returned seat.

Success requires a matching record and status, correct ongoing flag and a valid
last history entry matching the requested transition/reason. Then the list is
refreshed. The raw PATCH references are not substituted into the populated list.
Known validation/permission failures keep the form draft; missing-record,
conflict and uncertain network/timeout/server or malformed-response failures
require a successful refresh before another write. No PATCH is automatically
retried. Cancelling a client request cannot undo a server change.

Assignment and status forms share a pending-write lock through page state;
while one is saving, other writes, list refresh and pagination are disabled.
Changing page/account or leaving aborts obsolete status requests, hides older
notices and clears interrupted saving state. HTTP 401 signs out; other errors
do not. The shared 15-second timeout still applies.

All permitted readers can open **Status history** when records contain history.
It shows the real from/to statuses, timestamp in Asia/Kabul and any plain-text
reason. No reviewer name is invented from the unpopulated `changedBy` ID.
Records without history show none, and old responses without the optional
history field remain readable. Invalid history produces a readable list error.
Students and academic supervisors have no update form; they refresh their
existing scoped list to see changes. Backend authorization remains decisive.

To check locally with existing data:

1. Sign in as admin, open an Assigned internship, choose Active and save; verify the refreshed badge and history entry.
2. Open the Active record and choose Completed, or cancel another Assigned/Active record with a reason.
3. Try a blank/whitespace cancellation reason or more than 1000 characters; validation must keep the draft and send no request.
4. Confirm Completed/Cancelled records have no update form and the dropdown never permits skipped/reversed transitions.
5. During saving, check that assignment, other status forms and list controls are disabled.
6. Test a stale record in two admin sessions and a connection failure; refresh before retrying uncertain/conflicting changes.
7. As the student and assigned supervisor, refresh Internships and inspect history/reasons without edit controls.
8. Check both themes, keyboard disclosure/form use, mobile layouts, Back/Forward, long reasons and expired sessions.

Tests use mocked API responses and SSR markup for transitions, bounded reasons,
narrow PATCH payloads, response/history validation, errors, cancellation,
timeouts, read-only history, action visibility and disabled states. They do not
execute browser effects/clicks, overlapping writes or real authenticated status
changes. No records are seeded or changed by the automated tests.
