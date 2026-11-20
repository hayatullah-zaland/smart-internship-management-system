import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let NavbarClock
let Navbar
let AuthContext
let ThemeContext

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  NavbarClock = (await server.ssrLoadModule('/src/components/NavbarClock.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function renderAt(instant, element = h(NavbarClock)) {
  const RealDate = globalThis.Date
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])) }
    static now() { return new RealDate(instant).getTime() }
  }
  try {
    return renderToStaticMarkup(element).replace(/\u202f/g, ' ')
  } finally {
    globalThis.Date = RealDate
  }
}

test('clock displays Kabul date and 12-hour time with a valid absolute datetime', () => {
  const html = renderAt('2026-11-15T08:00:01.000Z')
  assert.match(html, /Nov 15, 2026/)
  assert.match(html, /12:30:01 PM/)
  assert.match(html, /dateTime="2026-11-15T08:00:01.000Z"/)
  assert.match(html, /Kabul time \(Asia\/Kabul\)/)
  assert.match(html, /aria-live="off"/)
})

test('the date rolls over at Kabul midnight, not UTC midnight', () => {
  const beforeMidnight = renderAt('2026-11-14T19:29:59.000Z')
  const afterMidnight = renderAt('2026-11-14T19:30:00.000Z')
  assert.match(beforeMidnight, /Nov 14, 2026/)
  assert.match(beforeMidnight, /11:59:59 PM/)
  assert.match(afterMidnight, /Nov 15, 2026/)
  assert.match(afterMidnight, /12:00:00 AM/)
})

test('Kabul year rollover uses the correct local calendar date', () => {
  const html = renderAt('2026-12-31T19:30:00.000Z')
  assert.match(html, /Jan 01, 2027/)
  assert.match(html, /12:00:00 AM/)
})

test('second values change while the time slot retains fixed-width digits', () => {
  const first = renderAt('2026-11-15T08:00:01.000Z')
  const second = renderAt('2026-11-15T08:00:02.000Z')
  assert.match(first, /12:30:01 PM/)
  assert.match(second, /12:30:02 PM/)
  assert.ok(first.includes('w-[11ch]'))
  assert.match(second, /tabular-nums/)
})

test('date and time remain side by side at every responsive breakpoint', () => {
  const html = renderAt('2026-11-15T08:00:01.000Z')
  const clockClasses = html.match(/<time[^>]*class="([^"]+)"/)[1]
  assert.match(clockClasses, /\bflex\b/)
  assert.match(clockClasses, /\bitems-center\b/)
  assert.doesNotMatch(clockClasses, /flex-col|flex-wrap/)
  assert.match(html, /Nov 15, 2026/)
  assert.match(html, /12:30:01 PM/)
})

test('navbar includes one clock and retains its account, theme, message, notification and menu controls', () => {
  const user = { name: 'Test Student', role: 'student' }
  const element = h(MemoryRouter, null,
    h(AuthContext.Provider, { value: { user, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme: 'dark', toggleTheme() {} } },
        h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }))))
  const html = renderAt('2026-11-15T08:00:01.000Z', element)
  assert.equal((html.match(/<time\b/g) || []).length, 1)
  assert.match(html, /aria-label="Open navigation"/)
  assert.match(html, /aria-label="Sign out"/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /aria-label="Messages"/)
  assert.match(html, /aria-label="Notifications"/)
  assert.match(html, /id="navbar-inbox"/)
  assert.match(html, /aria-label="Workspace tools"/)
  assert.match(html, /Test Student/)
  assert.match(html, /navbar-shell/)
  assert.match(html, /Search workspace pages/)
  assert.match(html, /aria-describedby="navbar-account-identity"/)
})
