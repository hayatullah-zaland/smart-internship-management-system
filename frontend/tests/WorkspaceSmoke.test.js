import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, App, Sidebar, ProtectedRoute, AuthContext, ThemeContext
const roles = ['admin', 'student', 'academic_supervisor', 'company_representative']
const allowed = {
  '/dashboard': roles,
  '/profile': ['student'],
  '/departments': ['admin'],
  '/admin/users': ['admin'],
  '/admin/students': ['admin'],
  '/admin/companies': ['admin'],
  '/opportunities': roles,
  '/applications': ['student'],
  '/admin/applications': ['admin'],
  '/internships': ['admin', 'student', 'academic_supervisor'],
  '/daily-reports': ['admin', 'student', 'academic_supervisor'],
  '/weekly-reports': ['admin', 'student'],
  '/evaluations': roles,
}

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'private-smoke-token', path = '/dashboard', theme = 'light' } = {}) {
  const user = role ? { id: '507f1f77bcf86cd799439099', name: 'Smoke Test User', email: 'smoke@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}

test('every protected URL has the intended role guard and there are no duplicate routes', () => {
  const routes = App().props.children
  assert.equal(new Set(routes.map((route) => route.props.path)).size, routes.length)
  for (const [path, permitted] of Object.entries(allowed)) {
    const route = routes.find((item) => item.props.path === path)
    assert.ok(route, path)
    assert.equal(route.props.element.type, ProtectedRoute, path)
    const props = route.props.element.props
    const actual = props.requiredRole ? [props.requiredRole] : props.allowedRoles || roles
    assert.deepEqual([...actual].sort(), [...permitted].sort(), path)
  }
})

test('all protected routes redirect unauthorized roles and missing sessions without rendering private children', () => {
  for (const [path, permitted] of Object.entries(allowed)) {
    const guard = App().props.children.find((route) => route.props.path === path).props.element
    for (const role of [...roles, null]) {
      for (const token of ['private-smoke-token', null]) {
        function Probe() {
          const child = h('p', null, 'Private route probe')
          const element = ProtectedRoute({ ...guard.props, children: child })
          if (!role || !token) assert.equal(element.props.to, '/login', `${path}: ${role}`)
          else if (!permitted.includes(role)) assert.equal(element.props.to, '/dashboard', `${path}: ${role}`)
          else assert.equal(element, child, `${path}: ${role}`)
          return h('p', null, 'Guard checked')
        }
        assert.match(render(h(Probe), { role, token, path }), /Guard checked/)
      }
    }
  }
})

test('each role sidebar links only to accessible registered routes with one active location', () => {
  for (const role of roles) {
    const html = render(h(Sidebar), { role })
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    assert.equal(new Set(links).size, links.length)
    for (const link of links) {
      const path = link.split('#')[0]
      assert.ok(allowed[path]?.includes(role), `${role}: ${link}`)
      const active = render(h(Sidebar), { role, path: link })
      assert.equal((active.match(/aria-current="location"/g) || []).length, 1, `${role}: ${link}`)
    }
  }
})

test('all permitted pages render in both themes with one main heading, unique IDs and no exposed token', () => {
  for (const [path, permitted] of Object.entries(allowed)) {
    for (const role of permitted) {
      for (const theme of ['light', 'dark']) {
        const html = render(h(App), { role, path, theme })
        assert.equal((html.match(/<main\b/g) || []).length, 1, `${path}: ${role}: ${theme}`)
        assert.equal((html.match(/<h1\b/g) || []).length, 1, `${path}: ${role}: ${theme}`)
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
        assert.equal(new Set(ids).size, ids.length, `${path}: duplicate ID`)
        assert.match(html, /id="main-content"/)
        assert.match(html, /Skip to content/)
        assert.doesNotMatch(html, /private-smoke-token|passwordHash|<script>/)
      }
    }
  }
})
