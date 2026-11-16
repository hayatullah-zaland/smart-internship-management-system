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
This is a read-only snapshot: there is no countdown, polling or automatic
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

This step does not publish opportunities or submit applications. To see real
data, use an existing open opportunity or the existing backend's
`POST /api/v1/opportunities` as a company representative assigned to that company,
with a future deadline. No sample records are inserted by the frontend or tests.
Publishing forms and student application submission remain separate next steps.

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
