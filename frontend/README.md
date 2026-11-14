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

## Main Files

- [src/main.jsx](./src/main.jsx): starts React and wraps the app in BrowserRouter and the shared providers.
- [src/App.jsx](./src/App.jsx): matches URLs to pages using React Router.
- [src/pages/Login.jsx](./src/pages/Login.jsx): email/password form and automatic redirect after sign-in.
- [src/pages/Signup.jsx](./src/pages/Signup.jsx): student registration and account-created confirmation.
- [src/pages/Dashboard.jsx](./src/pages/Dashboard.jsx): basic signed-in page with account details, theme control and sign-out.
- [src/components/Navbar.jsx](./src/components/Navbar.jsx): shared signed-in navigation with branding, account name/role, theme toggle and sign-out.
- [src/components/ProtectedRoute.jsx](./src/components/ProtectedRoute.jsx): allows dashboard access only when user and token are present.
- [src/components/AuthLayout.jsx](./src/components/AuthLayout.jsx): shared header, theme switch, form panel and footer.
- [src/components/Brand.jsx](./src/components/Brand.jsx): shared SIMS branding.
- [src/context/AuthContext.js](./src/context/AuthContext.js): shared authentication context.
- [src/context/AuthProvider.jsx](./src/context/AuthProvider.jsx): sign-in/signup requests and in-memory user/token state.
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

For now, the user and token live only in React memory. Refreshing the page signs
the user out; passwords are not stored. The backend access token expires after
15 minutes. Persistent sessions, automatic expiry handling and the full
dashboard have not been implemented yet.

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
the in-memory session and theme remain available. Refreshing still clears the
in-memory session.

`ProtectedRoute` checks the shared authentication state before rendering the
dashboard. If either the user or token is missing, it redirects to `/login`
using `replace`. Sign-out clears both values, so the same guard returns the
user to `/login`. Signed-in users cannot reopen the login/signup forms unless
they sign out first. Dashboard statistics and the shared sidebar are later steps.

This frontend guard controls navigation only. It does not verify a JWT, revoke
a token on sign-out, or replace backend authorization. Protected API endpoints
must continue checking the token, account status and permissions on the server.

To check locally:

1. Without signing in, open `/dashboard`; you should arrive at `/login` without seeing account details.
2. Try an incorrect password; the error should stay on `/login`.
3. Sign in with an existing account; `/dashboard` should open automatically and show your name, email and role.
4. While signed in, use links or the browser history to visit `/login` or `/signup`; both should redirect to `/dashboard`.
5. Select **Sign out**, then try browser Back or `/dashboard`; the dashboard should remain inaccessible.
6. Sign in again and refresh `/dashboard`; this intentionally signs you out because sessions are in memory only.
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

The dashboard now uses a separate `Navbar` component. The SIMS brand links back
to `/dashboard` without reloading the page. The navbar reads the user's name
and role from `AuthContext`, reuses `ThemeToggle`, and calls the existing
`signOut` action from its sign-out icon button. The button has an accessible
label and a tooltip; signing out still returns to `/login` through the guard.

On small screens, the account details move to a second row. Long names are
truncated in the navbar, with the full value available in the title and the
dashboard welcome text. Both light and dark themes use the existing semantic
colors. Login and signup keep their existing `AuthLayout` header.

To check it, sign in and select the SIMS brand, change the theme, resize to a
phone-width screen, then hover/focus the sign-out button and select it. The
dashboard should not remain accessible after signing out. No sidebar or extra
page links have been added in this step.
