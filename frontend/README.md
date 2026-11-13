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

- [src/App.jsx](./src/App.jsx): switches between login and signup using simple React state.
- [src/pages/Login.jsx](./src/pages/Login.jsx): email/password form and signed-in confirmation.
- [src/pages/Signup.jsx](./src/pages/Signup.jsx): student registration and account-created confirmation.
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
error states, and an account confirmation with a sign-out button.

For this first step, the user and token live only in React memory. Refreshing
the page signs the user out; passwords are not stored. The backend access token
expires after 15 minutes. Persistent sessions, expiry handling, URL routing
and dashboard screens have not been implemented yet.

## Signup

On the login page, select **Create an account**. Enter a name, email, password
and matching password confirmation. The frontend sends only name, email and
password to `POST /api/v1/auth/signup`; the backend creates a student account.
There is no public role selector.

Registration checks password length and confirmation, shows pending/error
states and displays an account-created message on success. It does not sign in
automatically. Select **Go to sign in** to use the new credentials. Login and
signup use the same light/dark appearance and shared layout.

## Light and Dark Mode

The header's moon/sun button switches between the daisyUI light and dark themes.
The choice is stored under `sims-theme` in browser local storage. Without a saved
choice, the initial theme follows the device preference. If storage is blocked,
switching still works but may not survive a refresh. Both the login form and the
signed-in confirmation use theme-aware colors. Authentication data is not saved
with this appearance preference.
