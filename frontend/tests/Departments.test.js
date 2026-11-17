import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let DepartmentForm
let DepartmentList
let Departments
let Sidebar
let Navbar
let ProtectedRoute
let App
let AuthContext
let ThemeContext

const department = { _id: '507f1f77bcf86cd799439011', name: 'Computer Science', code: 'CS' }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  DepartmentForm = (await server.ssrLoadModule('/src/components/DepartmentForm.jsx')).default
  DepartmentList = (await server.ssrLoadModule('/src/components/DepartmentList.jsx')).default
  Departments = (await server.ssrLoadModule('/src/pages/Departments.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'admin-token', path = '/departments', theme = 'light' } = {}) {
  const user = role ? { id: 'admin-id', name: 'Test Admin', role, email: 'admin@example.com' } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}

test('department form contains only name and code with backend-aligned constraints', () => {
  const html = render(h(DepartmentForm, { onCreated() {} }))
  assert.equal((html.match(/<label /g) || []).length, 2)
  assert.match(html, /name="name"/)
  assert.match(html, /minLength="2" maxLength="100"/)
  assert.match(html, /name="code"/)
  assert.match(html, /maxLength="20"/)
  assert.match(html, /Add department/)
  assert.doesNotMatch(html, /created successfully|name="role"|name="user"|name="_id"/)
})

test('empty list has an honest empty state without fake rows or edit/delete actions', () => {
  const html = render(h(DepartmentList, { departments: [], loading: false, error: '', onRefresh() {} }))
  assert.match(html, /No departments yet/)
  assert.doesNotMatch(html, /<table|<td|Edit|Delete/)
})

test('loading hides previous rows and announces progress', () => {
  const html = render(h(DepartmentList, { departments: [department], loading: true, error: '', onRefresh() {} }))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /Loading departments/)
  assert.match(html, /disabled=""/)
  assert.doesNotMatch(html, /Computer Science|No departments yet|<table/)
})

test('list failure is escaped and offers retry without stale rows', () => {
  const html = render(h(DepartmentList, { departments: [department], loading: false, error: '<script>Failure</script>', onRefresh() {} }))
  assert.match(html, /role="alert"/)
  assert.match(html, /&lt;script&gt;Failure&lt;\/script&gt;/)
  assert.match(html, /Retry/)
  assert.doesNotMatch(html, /<script>|Computer Science|<table/)
})

test('successful rows have table headings and bounded wrapping in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(DepartmentList, { departments: [department], loading: false, error: '', onRefresh() {} }), { theme })
    assert.match(html, /1 registered department<\/caption>/)
    assert.equal((html.match(/scope="col"/g) || []).length, 2)
    assert.match(html, /Computer Science/)
    assert.match(html, />CS<\/td>/)
    assert.match(html, /table-fixed/)
    assert.match(html, /break-words whitespace-normal/)
    assert.match(html, /break-all whitespace-normal/)
    assert.doesNotMatch(html, /Edit|Delete|bg-white|text-black/)
  }
})

test('long names and unexpected HTML in department records are escaped, not executed', () => {
  const html = render(h(DepartmentList, {
    departments: [{ ...department, name: '<script>alert(1)</script>' + 'A'.repeat(70), code: '<img src=x>' }],
    loading: false, error: '', onRefresh() {},
  }))
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /&lt;img src=x&gt;/)
  assert.doesNotMatch(html, /<script>|<img/)
})

test('refresh and retry use the supplied refresh callback', () => {
  let calls = 0
  const tree = DepartmentList({ departments: [], loading: false, error: 'Unavailable', onRefresh: () => { calls += 1 } })
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]
  }
  const actions = buttons(tree)
  assert.equal(actions.length, 2)
  for (const action of actions) action.props.onClick()
  assert.equal(calls, 2)
})

test('admin sidebar exposes one active Departments link without the student profile link', () => {
  const html = render(h(Sidebar))
  assert.match(html, /href="\/departments"/)
  assert.doesNotMatch(html, /href="\/profile"/)
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  const activeLink = html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0]
  assert.match(activeLink, /href="\/departments"/)
})

test('students and supervisor/representative roles do not get the admin navigation link', () => {
  for (const role of ['student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role, path: '/dashboard' })
    assert.doesNotMatch(html, /href="\/departments"/)
    if (role === 'student') assert.match(html, /href="\/profile"/)
  }
})

test('navbar breadcrumb names the Departments page', () => {
  const html = render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }))
  assert.match(html, /aria-current="location">Departments<\/li>/)
})

test('departments page includes the form and starts with a loading list, not invented records', () => {
  const html = render(h(Departments))
  assert.match(html, /Administration/)
  assert.match(html, /New department/)
  assert.match(html, /Loading departments/)
  assert.doesNotMatch(html, /<td|admin-token|No departments yet/)
})

test('the departments URL is actually registered behind the admin role guard', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/departments')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'admin')
  assert.equal(route.props.element.props.children.type, Departments)
})

test('role guard blocks all other roles and missing sessions from admin content', () => {
  function GuardProbe() {
    const session = useContext(AuthContext)
    const element = ProtectedRoute({ requiredRole: 'admin', children: h('p', null, 'Private departments') })
    if (!session.user || !session.token) assert.equal(element.props.to, '/login')
    else if (session.user.role !== 'admin') assert.equal(element.props.to, '/dashboard')
    return element
  }
  assert.match(render(h(GuardProbe)), /Private departments/)
  for (const options of [{ role: 'student' }, { role: 'academic_supervisor' },
    { role: 'company_representative' }, { role: null, token: null }, { token: null }]) {
    assert.doesNotMatch(render(h(GuardProbe), options), /Private departments/)
  }
})
