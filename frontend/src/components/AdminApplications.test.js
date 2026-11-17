import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let ApplicationList
let ApplicationReviewForm
let ApplicationReviewFields
let AdminApplications
let App
let Sidebar
let Navbar
let ProtectedRoute
let AuthContext
let ThemeContext
const application = {
  _id: '507f1f77bcf86cd799439013', status: 'pending', rejectionReason: '', createdAt: '2026-11-17T08:00:00.000Z',
  student: { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' },
  opportunity: { _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern', company: { name: 'Example Company' }, deadline: '2027-01-31T23:59:00.000Z' },
}
const listDefaults = { applications: [application], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {}, showStudent: true }
const fieldDefaults = { id: 'review-test', currentStatus: 'pending', values: { status: '', rejectionReason: '' }, errors: {}, disabled: false, saving: false, onChange() {}, onSubmit() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  ApplicationList = (await server.ssrLoadModule('/src/components/ApplicationList.jsx')).default
  const formModule = await server.ssrLoadModule('/src/components/ApplicationReviewForm.jsx')
  ApplicationReviewForm = formModule.default
  ApplicationReviewFields = formModule.ApplicationReviewFields
  AdminApplications = (await server.ssrLoadModule('/src/pages/AdminApplications.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'test-token', path = '/admin/applications', theme = 'light' } = {}) {
  const user = role ? { id: 'admin-id', name: 'Admin User', email: 'admin@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function list(props = {}) { return render(h(ApplicationList, { ...listDefaults, ...props })) }
function fields(props = {}) { return render(h(ApplicationReviewFields, { ...fieldDefaults, ...props })) }

test('admin list shows student name and email alongside the actual opportunity and status', () => {
  const html = list()
  for (const text of ['Student One', 'student@example.com', 'Frontend Intern', 'Example Company', 'Pending']) assert.ok(html.includes(text))
  assert.match(html, /break-all/)
  const missing = list({ applications: [{ ...application, student: null }] })
  assert.match(missing, /Student unavailable/)
  assert.doesNotMatch(missing, /student@example.com/)
})

test('student history does not acquire identity fields or admin review controls by default', () => {
  const html = list({ showStudent: false })
  assert.doesNotMatch(html, /Student One|student@example.com|Review application/)
  assert.match(html, /Frontend Intern/)
})

test('admin empty state has no student-only browse prompt and failures hide stale identities', () => {
  const empty = list({ applications: [] })
  assert.match(empty, /No applications yet/)
  assert.doesNotMatch(empty, /Browse opportunities/)
  const failed = list({ error: '<script>Read failed</script>' })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /&lt;script&gt;Read failed&lt;\/script&gt;/)
  assert.doesNotMatch(failed, /Student One|student@example.com|<script>/)
})

test('list refresh and pagination are disabled during a decision save without hiding the record', () => {
  const html = list({ page: 2, hasNextPage: true, disabled: true })
  assert.match(html, /aria-busy="true"/)
  for (const name of ['Refresh applications', 'Previous page', 'Next page']) assert.ok(html.includes(`disabled="" aria-label="${name}"`))
  assert.match(html, /Student One/)
})

test('review form starts without a decision and offers only valid transitions', () => {
  const pending = fields()
  assert.match(pending, /Choose a decision/)
  assert.match(pending, /value="under_review"/)
  assert.match(pending, /value="approved"/)
  assert.match(pending, /value="rejected"/)
  assert.doesNotMatch(pending, /value="pending"|value="withdrawn"|<textarea/)
  assert.doesNotMatch(fields({ currentStatus: 'under_review' }), /value="under_review"/)
})

test('rejecting reveals a labelled required textarea with bounded length and preserved text', () => {
  const html = fields({ values: { status: 'rejected', rejectionReason: 'Please try later.' } })
  assert.match(html, /for="review-test-reason"/)
  assert.match(html, /name="rejectionReason"/)
  assert.match(html, /maxLength="1000" required=""/)
  assert.match(html, /Please try later/)
})

test('field errors are accessible and escaped and a save disables all controls', () => {
  const html = fields({ saving: true, values: { status: 'rejected', rejectionReason: '' },
    errors: { status: 'Choose a decision', rejectionReason: '<script>A reason is required</script>' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /aria-describedby="review-test-reason-error"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /&lt;script&gt;A reason is required&lt;\/script&gt;/)
  assert.match(html, /Saving/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(fields({ disabled: true }), /<fieldset disabled=""/)
})

test('native details expose a review form only for pending and under-review applications', () => {
  for (const status of ['pending', 'under_review']) {
    const html = render(h(ApplicationReviewForm, { application: { ...application, status }, disabled: false, saving: false, onReview() {} }))
    assert.match(html, /<details\b/)
    assert.match(html, /Review application/)
    assert.match(html, /Save decision/)
    assert.doesNotMatch(html, /<details[^>]*\bopen=/)
  }
  for (const status of ['approved', 'rejected', 'withdrawn']) {
    assert.equal(render(h(ApplicationReviewForm, { application: { ...application, status }, onReview() {} })), '')
  }
})

test('field controls forward explicit submit and change actions without autosaving', () => {
  const actions = []
  const tree = ApplicationReviewFields({ ...fieldDefaults, onChange: (event) => actions.push(event.target.value), onSubmit: () => actions.push('save') })
  function find(node, type) {
    if (!node || typeof node !== 'object') return null
    if (node.type === type) return node
    return [node.props?.children].flat(Infinity).map((child) => find(child, type)).find(Boolean)
  }
  find(tree, 'select').props.onChange({ target: { value: 'approved' } })
  assert.deepEqual(actions, ['approved'])
  tree.props.onSubmit()
  assert.deepEqual(actions, ['approved', 'save'])
})

test('student names, emails and long text remain escaped and wrapping in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(ApplicationList, { ...listDefaults, applications: [{ ...application,
      student: { ...application.student, name: '<script>Student</script>' + 'A'.repeat(70), email: 'B'.repeat(240) },
    }] }), { theme })
    assert.match(html, /&lt;script&gt;Student&lt;\/script&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /break-all/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black/)
  }
})

test('only admin navigation includes the Applications URL with the correct active location', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    if (role === 'admin') {
      assert.match(html, /href="\/admin\/applications"/)
      assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
      assert.match(html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0], /href="\/admin\/applications"/)
    } else assert.doesNotMatch(html, /href="\/admin\/applications"/)
  }
})

test('admin page has status filtering, URL pagination and a loading state without fabricated records', () => {
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Applications<\/li>/)
  for (const [query, page] of [['?page=3&status=pending', 3], ['?page=abc', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(AdminApplications), { path: `/admin/applications${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /All statuses/)
    assert.match(html, /Loading applications/)
    assert.doesNotMatch(html, /test-token|Student One|Frontend Intern/)
    if (query.includes('status=pending')) assert.match(html, /value="pending" selected=""/)
  }
  const invalid = render(h(AdminApplications), { path: '/admin/applications?status=invalid' })
  assert.match(invalid, /value="" selected=""/)
})

test('the admin Applications route blocks students, supervisors, representatives and missing sessions', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/admin/applications')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'admin')
  assert.equal(route.props.element.props.children.type, AdminApplications)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ requiredRole: 'admin', children: h('p', null, 'Admin review content') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (user.role !== 'admin') assert.equal(element.props.to, '/dashboard')
    return element
  }
  assert.match(render(h(GuardProbe)), /Admin review content/)
  for (const role of ['student', 'academic_supervisor', 'company_representative', null]) {
    assert.doesNotMatch(render(h(GuardProbe), { role, token: role ? 'test-token' : null }), /Admin review content/)
  }
})
