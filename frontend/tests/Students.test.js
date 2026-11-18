import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, StudentList, Students, Sidebar, Navbar, ProtectedRoute, App, AuthContext, ThemeContext
const profile = { _id: '507f1f77bcf86cd799439011', studentNumber: 'STU-001', semester: 7, phone: '+93 700 123 456',
  user: { _id: '507f1f77bcf86cd799439012', name: 'Test Student', email: 'student@example.com', isActive: true },
  department: { _id: '507f1f77bcf86cd799439013', name: 'Computer Science', code: 'CS' } }
const props = { profiles: [profile], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  StudentList = (await server.ssrLoadModule('/src/components/StudentList.jsx')).default
  Students = (await server.ssrLoadModule('/src/pages/Students.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'admin-token', path = '/admin/students', theme = 'light' } = {}) {
  const user = role ? { id: '507f1f77bcf86cd799439099', name: 'Test Admin', email: 'admin@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return []
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('directory shows real student identity, account status and academic fields read-only', () => {
  const html = render(h(StudentList, props))
  for (const value of ['Test Student', 'student@example.com', 'Active account', 'STU-001', 'Computer Science', 'CS', 'Semester', '+93 700 123 456']) assert.ok(html.includes(value))
  assert.match(html, /href="\/admin\/users"/)
  assert.doesNotMatch(html, /<input|<select|<form|Edit|Delete|Save profile|Deactivate/)
})

test('inactive accounts remain visible without changing their saved status', () => {
  const html = render(h(StudentList, { ...props, profiles: [{ ...profile, user: { ...profile.user, isActive: false } }] }))
  assert.match(html, /Inactive account/)
  assert.match(html, /STU-001/)
  assert.doesNotMatch(html, />Active account<|Activate|Deactivate/)
})

test('deleted user or department references retain the actual academic record without invented details', () => {
  const html = render(h(StudentList, { ...props, profiles: [{ ...profile, user: null, department: null }] }))
  assert.match(html, /Student account unavailable/)
  assert.match(html, /Department unavailable/)
  assert.match(html, /STU-001/)
  assert.match(html, /\+93 700 123 456/)
  assert.doesNotMatch(html, /Test Student|student@example.com|Computer Science|Inactive account|Active account/)
})

test('loading and errors hide earlier identities and offer honest retry states', () => {
  const loading = render(h(StudentList, { ...props, loading: true }))
  assert.match(loading, /Loading student profiles/)
  assert.match(loading, /aria-busy="true"/)
  assert.equal((loading.match(/disabled=""/g) || []).length, 3)
  const error = render(h(StudentList, { ...props, error: '<server error>' }))
  assert.match(error, /&lt;server error&gt;/)
  assert.match(error, /Retry/)
  assert.doesNotMatch(loading + error, /Test Student|student@example.com|STU-001|No student profiles yet/)
})

test('empty pages describe profiles, not all registered accounts, and preserve access to Users and previous pages', () => {
  const first = render(h(StudentList, { ...props, profiles: [] }))
  assert.match(first, /No student profiles yet/)
  assert.match(first, /href="\/admin\/users"/)
  const later = render(h(StudentList, { ...props, profiles: [], page: 2 }))
  assert.match(later, /No student profiles on this page/)
  assert.doesNotMatch(later.match(/<button[^>]*aria-label="Previous page"[^>]*>/)[0], /disabled/)
  assert.doesNotMatch(first + later, /No students registered|<h3/)
})

test('refresh, retry and pagination invoke only their supplied read actions', () => {
  let refreshes = 0
  const pages = []
  const tree = StudentList({ ...props, page: 2, error: 'Unavailable', onRefresh() { refreshes += 1 }, onPageChange(page) { pages.push(page) } })
  for (const button of nodes(tree, 'button').filter((button) => !button.props.disabled)) button.props.onClick()
  assert.equal(refreshes, 2)
  assert.deepEqual(pages, [1])
  const next = StudentList({ ...props, page: 2, hasNextPage: true, onPageChange(page) { pages.push(page) } })
  nodes(next, 'button').find((button) => button.props['aria-label'] === 'Next page').props.onClick()
  assert.deepEqual(pages, [1, 3])
})

test('long student and department text remains wrapping and escaped in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(StudentList, { ...props, profiles: [{ ...profile, user: { ...profile.user, name: '<script>bad()</script>' + 'A'.repeat(70) },
      department: { ...profile.department, name: '<img src=x>' + 'B'.repeat(70) } }] }), { theme })
    assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /min-w-0/)
    assert.match(html, /break-all/)
    assert.match(html, /break-words/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('only admin navigation exposes Students and the correct breadcrumb', () => {
  const html = render(h(Sidebar))
  assert.match(html, /href="\/admin\/students"/)
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Students<\/li>/)
  for (const role of ['student', 'academic_supervisor', 'company_representative']) assert.doesNotMatch(render(h(Sidebar), { role }), /href="\/admin\/students"/)
})

test('page queries restore selection and initially show no fake or stale identities', () => {
  for (const [query, page] of [['3', 3], ['0', 1], ['-1', 1], ['1.5', 1], ['abc', 1], ['1000001', 1]]) {
    const html = render(h(Students), { path: `/admin/students?page=${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /Loading student profiles/)
    assert.doesNotMatch(html, /student@example.com|admin-token|STU-001/)
  }
})

test('the registered Students route prevents every non-admin role and missing session from seeing profiles', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/admin/students')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'admin')
  assert.equal(route.props.element.props.children.type, Students)
  function Probe() { return ProtectedRoute({ requiredRole: 'admin', children: h('p', null, 'Private students') }) }
  assert.match(render(h(Probe)), /Private students/)
  for (const options of [{ role: 'student' }, { role: 'academic_supervisor' }, { role: 'company_representative' }, { role: null, token: null }, { token: null }]) {
    assert.doesNotMatch(render(h(Probe), options), /Private students/)
  }
})
