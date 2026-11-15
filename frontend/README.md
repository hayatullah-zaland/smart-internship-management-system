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
- `npm test`: run the session, dashboard API and rendering tests using Node's built-in test runner.

## Main Files

- [src/main.jsx](./src/main.jsx): starts React and wraps the app in BrowserRouter and the shared providers.
- [src/App.jsx](./src/App.jsx): matches URLs to pages using React Router.
- [src/pages/Login.jsx](./src/pages/Login.jsx): email/password form and automatic redirect after sign-in.
- [src/pages/Signup.jsx](./src/pages/Signup.jsx): student registration and account-created confirmation.
- [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx): loads role-specific counters and displays the signed-in dashboard and account details.
- [src/components/DashboardStats.jsx](./src/components/DashboardStats.jsx): summary metrics, loading placeholders, refresh and error/retry states.
- [src/context/dashboardApi.js](./src/context/dashboardApi.js): authenticated dashboard request and role/counter validation.
- [src/components/Navbar.jsx](./src/components/Navbar.jsx): shared signed-in navigation with branding, account name/role, theme toggle and sign-out.
- [src/components/NavbarClock.jsx](./src/components/NavbarClock.jsx): live date/time display using the Asia/Kabul timezone.
- [src/components/Sidebar.jsx](./src/components/Sidebar.jsx): active navigation links for the dashboard and its account-details section.
- [src/components/DashboardLayout.jsx](./src/components/DashboardLayout.jsx): shared desktop sidebar, sticky navbar, main content and mobile navigation dialog.
- [src/components/ProtectedRoute.jsx](./src/components/ProtectedRoute.jsx): allows dashboard access only when user and token are present.
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
