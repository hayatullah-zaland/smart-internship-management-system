import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, WeeklyReportForm, WeeklyReportList, WeeklyReports, App, Sidebar, Navbar, ProtectedRoute, AuthContext, ThemeContext
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-16T00:00:00.000Z',
  company: { name: 'Example Company' }, opportunity: { title: 'Frontend Intern' } }
const values = { internshipId: internship._id, weekNumber: '2', summary: 'Built a form.', learning: 'Learned validation.', challenges: '' }
const report = { _id: '507f1f77bcf86cd799439018', internship, student, weekNumber: 2, weekStart: '2026-01-08T00:00:00.000Z', weekEnd: '2026-01-14T00:00:00.000Z',
  summary: values.summary, learning: values.learning, challenges: '', status: 'draft', submittedAt: null }
const formDefaults = { values, errors: {}, internships: [internship], loading: false, optionsError: '', saving: false, disabled: false, editing: null, onChange() {}, onSubmit() {}, onCancel() {} }
const listDefaults = { reports: [report], page: 1, hasNextPage: false, loading: false, error: '', student: true, onRefresh() {}, onPageChange() {}, onEdit() {}, onSubmit() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  WeeklyReportForm = (await server.ssrLoadModule('/src/components/WeeklyReportForm.jsx')).default
  WeeklyReportList = (await server.ssrLoadModule('/src/components/WeeklyReportList.jsx')).default
  WeeklyReports = (await server.ssrLoadModule('/src/pages/WeeklyReports.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'student', token = 'test-token', path = '/weekly-reports', theme = 'light' } = {}) {
  const user = role ? { id: student._id, name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { user, token, signOut() {} } },
    h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function form(props = {}) { return render(h(WeeklyReportForm, { ...formDefaults, ...props })) }
function list(props = {}) { return render(h(WeeklyReportList, { ...listDefaults, ...props })) }
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('weekly form uses actual choices, one integer week input and bounded report fields', () => {
  const html = form()
  for (const name of ['internshipId', 'weekNumber', 'summary', 'learning', 'challenges']) assert.ok(html.includes(`name="${name}"`))
  assert.match(html, /Frontend Intern - Example Company \(2026-01-01 to 2026-01-16\)/)
  assert.match(html, /min="1" max="3" step="1"/)
  for (const limit of [5000, 3000, 2000]) assert.ok(html.includes(`maxLength="${limit}"`))
  assert.match(html, /Save draft/)
  assert.doesNotMatch(html, /type="date"|name="student"|name="status"|name="weekStart"|name="weekEnd"|Submit report/)
})

test('form previews placement-relative dates including a short final week', () => {
  assert.match(form(), /Jan 08, 2026/)
  assert.match(form(), /Jan 14, 2026/)
  const html = form({ values: { ...values, weekNumber: '3' } })
  assert.match(html, /Jan 15, 2026/)
  assert.match(html, /Jan 16, 2026/)
  assert.match(html, /dateTime="2026-01-15"/)
  assert.doesNotMatch(form({ values: { ...values, weekNumber: '' } }), /Week dates/)
})

test('editing keeps internship and week fixed and saves without submitting', () => {
  const html = form({ editing: report })
  assert.match(html, /Edit weekly report/)
  assert.match(html, /Cancel edit/)
  assert.match(html, /Save changes/)
  assert.match(html.match(/<input[^>]*id="weekly-weekNumber"[^>]*>/)[0], /readOnly=""/)
  assert.doesNotMatch(html, /<select|Save draft|Submit report/)
})

test('loading, unavailable and empty choices preserve form text without fake success', () => {
  assert.match(form({ internships: [] }), /No active internships available/)
  assert.match(form({ loading: true }), /Loading active internships/)
  assert.match(form({ optionsError: '<script>Connection failed</script>' }), /&lt;script&gt;Connection failed&lt;\/script&gt;/)
  const html = form({ internships: [] })
  assert.match(html, /Internship no longer available/)
  assert.match(html, />Built a form\.<\/textarea>/)
  assert.doesNotMatch(html, /Weekly report saved|<script>/)
})

test('an active future placement has no started weeks but its selector remains usable', () => {
  const future = { ...internship, startDate: '2999-01-01T00:00:00.000Z', endDate: '2999-02-01T00:00:00.000Z' }
  const html = form({ internships: [future] })
  assert.match(html, /No started weeks available/)
  assert.doesNotMatch(html.match(/<select[^>]*>/)[0], /disabled=""/)
  assert.match(html.match(/<input[^>]*id="weekly-weekNumber"[^>]*>/)[0], /disabled=""/)
  assert.match(html, /type="submit" disabled=""/)
  assert.doesNotMatch(html, /<fieldset[^>]*disabled=""/)
})

test('saving and shared locks disable form writes and expose accessible field errors', () => {
  const html = form({ saving: true, errors: { weekNumber: '<script>Invalid week</script>' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset[^>]*disabled=""/)
  assert.match(html, /Saving/)
  assert.match(html, /aria-describedby="weekly-weekNumber-error"/)
  assert.match(html, /&lt;script&gt;Invalid week&lt;\/script&gt;/)
  assert.match(form({ disabled: true }), /type="submit" disabled=""/)
})

test('field edits, save and cancel forward only explicit handlers', () => {
  const calls = []
  const tree = WeeklyReportForm({ ...formDefaults, editing: report, onChange: () => calls.push('change'), onSubmit: () => calls.push('save'), onCancel: () => calls.push('cancel') })
  nodes(tree, 'textarea')[0].props.onChange()
  assert.deepEqual(calls, ['change'])
  nodes(tree, 'form')[0].props.onSubmit()
  nodes(tree, 'button').find((button) => button.props.type === 'button').props.onClick()
  assert.deepEqual(calls, ['change', 'save', 'cancel'])
})

test('weekly history shows real weeks, dates, student and content using native details', () => {
  const html = list({ reports: [{ ...report, challenges: 'Slow network.' }] })
  for (const text of ['Week 2', 'Jan 08, 2026', 'Jan 14, 2026', 'Draft', 'Student One', 'student@example.com', 'Built a form.', 'Learned validation.', 'Slow network.']) assert.ok(html.includes(text), text)
  assert.match(html, /<details/)
  assert.match(html, /dateTime="2026-01-08"/)
  assert.doesNotMatch(html, /Example Company|Approve report|Request changes|reviewedBy/)
})

test('submitted records, inactive placements and admin lists do not offer editing or resubmission', () => {
  assert.match(list(), /Edit report|Submit report/)
  assert.match(list({ reports: [{ ...report, status: 'submitted', submittedAt: '2026-01-15T19:30:00.000Z' }] }), /Submitted/)
  for (const props of [{ student: false }, { reports: [{ ...report, status: 'submitted' }] },
    ...['assigned', 'completed', 'cancelled'].map((status) => ({ reports: [{ ...report, internship: { ...internship, status } }] }))]) {
    assert.doesNotMatch(list(props), /Edit report|Submit report/)
  }
})

test('submission timestamps use Kabul time while week dates remain UTC calendar days', () => {
  const html = list({ reports: [{ ...report, status: 'submitted', submittedAt: '2026-01-15T19:30:00.000Z' }] })
  assert.match(html, /Jan 16, 2026, 12:00 AM Kabul/)
  assert.match(html, /Jan 08, 2026/)
  assert.match(html, /dateTime="2026-01-15T19:30:00.000Z"/)
})

test('deleted references do not hide report text or invent a student/company identity', () => {
  const html = list({ reports: [{ ...report, student: null, internship: null }] })
  assert.match(html, /Student unavailable/)
  assert.match(html, /Internship unavailable/)
  assert.match(html, /Built a form/)
  assert.doesNotMatch(html, /Edit report|Submit report|Example Company/)
})

test('empty pages, loading and errors keep honest navigation without stale content', () => {
  assert.match(list({ reports: [] }), /No weekly reports yet/)
  const later = list({ reports: [], page: 2 })
  assert.match(later, /No weekly reports on this page/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
  const loading = list({ loading: true, hasNextPage: true })
  const error = list({ error: '<script>Connection failed</script>', hasNextPage: true })
  assert.match(loading, /Loading weekly reports/)
  assert.match(error, /&lt;script&gt;Connection failed&lt;\/script&gt;/)
  assert.match(error, /Retry/)
  for (const html of [loading, error]) {
    assert.doesNotMatch(html, /Built a form|Student One|<script>/)
    assert.match(html, /disabled="" aria-label="Next page"/)
  }
})

test('pending writes lock all actions; reconciliation locks writes while retaining refresh', () => {
  const busy = WeeklyReportList({ ...listDefaults, disabled: true, submittingId: report._id })
  for (const button of nodes(busy, 'button')) assert.equal(button.props.disabled, true)
  assert.match(list({ disabled: true, submittingId: report._id }), /Submitting/)
  for (const props of [{ actionsDisabled: true }, { editingId: report._id }]) {
    const tree = WeeklyReportList({ ...listDefaults, ...props })
    const buttons = nodes(tree, 'button')
    assert.equal(buttons.find((button) => button.props['aria-label'] === 'Refresh weekly reports').props.disabled, false)
    for (const button of buttons.filter((item) => !item.props['aria-label'])) assert.equal(button.props.disabled, true)
  }
})

test('list callbacks refresh, edit, submit and navigate only when explicitly invoked', () => {
  const calls = []
  const tree = WeeklyReportList({ ...listDefaults, page: 2, hasNextPage: true, onRefresh: () => calls.push('refresh'), onPageChange: (page) => calls.push(page),
    onEdit: (item) => calls.push(['edit', item._id]), onSubmit: (item) => calls.push(['submit', item._id]) })
  assert.deepEqual(calls, [])
  for (const button of nodes(tree, 'button')) button.props.onClick()
  assert.deepEqual(calls, ['refresh', ['edit', report._id], ['submit', report._id], 1, 3])
})

test('long report text is escaped and wraps in both existing themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(WeeklyReportList, { ...listDefaults, reports: [{ ...report, summary: '<script>unsafe</script>\n' + 'A'.repeat(1000) }] }), { theme })
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /whitespace-pre-wrap/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black/)
  }
})

test('weekly navigation and breadcrumb are available only to the backend-supported roles', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    if (['admin', 'student'].includes(role)) {
      assert.match(html, /href="\/weekly-reports"/)
      assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    } else assert.doesNotMatch(html, /href="\/weekly-reports"/)
  }
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Weekly reports<\/li>/)
})

test('URL pages restore selection, reset editor scope and keep admins without a writing form', () => {
  for (const [query, page] of [['?page=3', 3], ['?page=bad', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(WeeklyReports), { path: `/weekly-reports${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /New weekly report/)
    assert.match(html, /Loading weekly reports/)
    assert.doesNotMatch(html, /test-token|Weekly report saved/)
  }
  const admin = render(h(WeeklyReports), { role: 'admin' })
  assert.match(admin, /Loading weekly reports/)
  assert.doesNotMatch(admin, /New weekly report|Save draft|Loading active internships/)
  function ScopeProbe() {
    const tree = WeeklyReports()
    const { user, token } = useContext(AuthContext)
    assert.equal(tree.key, `${user.id}:${token}:1`)
    return tree
  }
  render(h(ScopeProbe))
})

test('the registered weekly route blocks supervisors, representatives and missing sessions', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/weekly-reports')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.deepEqual(route.props.element.props.allowedRoles, ['admin', 'student'])
  assert.equal(route.props.element.props.children.type, WeeklyReports)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ allowedRoles: route.props.element.props.allowedRoles, children: h('p', null, 'Weekly content') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (!['admin', 'student'].includes(user.role)) assert.equal(element.props.to, '/dashboard')
    return element
  }
  for (const role of ['student', 'admin']) assert.match(render(h(GuardProbe), { role }), /Weekly content/)
  for (const [role, token] of [['academic_supervisor', 'token'], ['company_representative', 'token'], [null, null], ['student', null]]) assert.doesNotMatch(render(h(GuardProbe), { role, token }), /Weekly content/)
})
