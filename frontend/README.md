# SIMS Frontend

React with Vite and Tailwind CSS, using JavaScript.

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

- [src/App.jsx](./src/App.jsx): the starting React component.
- [src/index.css](./src/index.css): imports Tailwind CSS and global styles.
- [vite.config.js](./vite.config.js): enables the React and Tailwind Vite plugins.

Tailwind uses `tailwindcss` and `@tailwindcss/vite`. This setup does not need a
separate Tailwind configuration file or PostCSS configuration.

This is the initial setup only. Authentication pages and backend integration
will be added in later steps.
