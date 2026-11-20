import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, Settings, PasswordSettings, Sidebar, Navbar, App, ProtectedRoute, AuthContext, ThemeContext
const roles = ['student', 'admin', 'academic_supervisor', 'company_representative']
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  Settings = (await server.ssrLoadModule('/src/pages/Settings.jsx')).default
  PasswordSettings = (await server.ssrLoadModule('/src/components/PasswordSettings.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'student', theme = 'light', path = '/settings', token = 'private-settings-token' } = {}) {
  const user = role ? { id: '000000000000000000000001', name: 'Settings User', email: 'settings@example.test', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { user, token, signOut() {} } },
    h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}

test('Settings replaces the university footer for every role and is the only active link on its route', () => {
  for (const role of roles) {
    const html = render(h(Sidebar), { role })
    assert.match(html, /aria-label="Account navigation"/)
    assert.match(html, /href="\/settings"/); assert.doesNotMatch(html, /University portal|Internship management/)
    assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    assert.ok(html.indexOf('href="/settings"') > html.indexOf('href="/evaluations"'))
    assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }), { role }), /aria-current="location">Settings<\/li>/)
  }
})

test('every signed-in role has appearance, password and own-account settings without admin-only or fake preferences', () => {
  for (const role of roles) {
    const html = render(h(Settings), { role })
    for (const heading of ['Appearance', 'Security', 'Account']) assert.ok(html.includes(heading))
    assert.match(html, /href="\/account"/); assert.match(html, /Edit my account/)
    assert.equal(html.includes('My academic profile'), role === 'student')
    assert.doesNotMatch(html, /private-settings-token|Delete account|Email notifications|Two-factor|passwordHash/)
  }
})

test('appearance has exactly two named radio options reflecting the shared light/dark theme', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(Settings), { theme })
    const radios = [...html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map((match) => match[0])
    assert.equal(radios.length, 2)
    assert.equal(radios.filter((radio) => radio.includes('checked=""')).length, 1)
    assert.ok(radios.find((radio) => radio.includes('checked=""')).includes(`value="${theme}"`))
  }
})

test('password form starts blank and masked with three accessible fields and no identity/role controls', () => {
  const html = render(h(PasswordSettings))
  assert.match(html, /aria-label="Change password"/)
  assert.equal((html.match(/type="password"/g) || []).length, 3)
  assert.equal((html.match(/value=""/g) || []).length, 3)
  assert.match(html, /autoComplete="current-password"/); assert.match(html, /autoComplete="new-password"/)
  assert.match(html, /Show passwords/); assert.match(html, /Clear passwords/)
  assert.doesNotMatch(html, /Password changed successfully|name="role"|name="userId"|name="email"/)
  assert.match(html, /maxLength="72"/)
})

test('Settings is a protected route for all roles and redirects missing sessions', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/settings')
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, undefined)
  for (const role of roles) assert.match(render(h(App), { role }), /<h1[^>]*>Settings<\/h1>/)
  assert.doesNotMatch(render(h(App), { role: null, token: null }), /Color theme|Current password|Settings User/)
})
