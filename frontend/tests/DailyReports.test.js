import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, DailyReportForm, DailyReportList, DailyReports, App, Sidebar, Navbar, ProtectedRoute, AuthContext, ThemeContext
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z',
  company: { name: 'Example Company' }, opportunity: { title: 'Frontend Intern' } }
const values = { internshipId: internship._id, date: '2026-01-02', hours: '7.5', tasks: 'Built a form.', learning: 'Learned validation.', challenges: '' }
const report = { _id: '507f1f77bcf86cd799439018', internship, student, date: '2026-01-02T00:00:00.000Z', hours: 7.5,
  tasks: values.tasks, learning: values.learning, challenges: '', status: 'draft', submittedAt: null, reviewedAt: null, reviewedBy: null, feedback: '' }
const formDefaults = { values, errors: {}, internships: [internship], loading: false, optionsError: '', saving: false, disabled: false, editing: null, onChange() {}, onSubmit() {}, onCancel() {} }
const listDefaults = { reports: [report], page: 1, hasNextPage: false, loading: false, error: '', student: true, onRefresh() {}, onPageChange() {}, onEdit() {}, onSubmit() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  DailyReportForm = (await server.ssrLoadModule('/src/components/DailyReportForm.jsx')).default
  DailyReportList = (await server.ssrLoadModule('/src/components/DailyReportList.jsx')).default
  DailyReports = (await server.ssrLoadModule('/src/pages/DailyReports.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'student', token = 'test-token', path = '/daily-reports', theme = 'light' } = {}) {
  const user = role ? { id: 'test-user', name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { user, token, signOut() {} } },
    h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function renderForm(props = {}) { return render(h(DailyReportForm, { ...formDefaults, ...props })) }
function list(props = {}) { return render(h(DailyReportList, { ...listDefaults, ...props })) }
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('new report form uses labelled academic fields, real placement choices and bounded text', () => {
  const html = renderForm()
  for (const name of ['internshipId', 'date', 'hours', 'tasks', 'learning', 'challenges']) assert.ok(html.includes(`name="${name}"`))
  assert.match(html, /Frontend Intern - Example Company \(2026-01-01 to 2026-10-01\)/)
  assert.match(html, /min="0.25" max="24" step="any"/)
  for (const limit of [5000, 3000, 2000]) assert.ok(html.includes(`maxLength="${limit}"`))
  assert.match(html, /Save draft/)
  assert.doesNotMatch(html, /name="student"|name="status"|name="reviewedBy"|Submit report/)
})

test('edit form keeps the report date readonly and never offers a new internship or automatic submission', () => {
  const html = renderForm({ editing: report })
  assert.match(html, /Edit daily report/)
  assert.match(html, /Cancel edit/)
  assert.match(html, /Save changes/)
  assert.match(html.match(/<input[^>]*id="report-date"[^>]*>/)[0], /readOnly=""/)
  assert.doesNotMatch(html, /<select|Save draft|Submit report/)
})

test('missing, loading and failed placement choices are honest and retain the draft', () => {
  assert.match(renderForm({ internships: [] }), /No active internships available/)
  assert.match(renderForm({ loading: true }), /Loading active internships/)
  assert.match(renderForm({ optionsError: '<script>Connection failed</script>' }), /&lt;script&gt;Connection failed&lt;\/script&gt;/)
  const html = renderForm({ internships: [] })
  assert.match(html, /Internship no longer available/)
  assert.match(html, /value="2026-01-02"/)
  assert.match(html, />Built a form\.<\/textarea>/)
  assert.doesNotMatch(html, /Daily report saved|<script>/)
})

test('saving and field errors are accessible and disable report writes', () => {
  const html = renderForm({ saving: true, errors: { tasks: '<script>Required</script>' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset[^>]*disabled=""/)
  assert.match(html, /Saving/)
  assert.match(html, /aria-describedby="report-tasks-error"/)
  assert.match(html, /&lt;script&gt;Required&lt;\/script&gt;/)
  assert.match(renderForm({ disabled: true }), /type="submit" disabled=""/)
})

test('form submits and cancels only through explicit supplied handlers', () => {
  const calls = []
  const tree = DailyReportForm({ ...formDefaults, editing: report, onSubmit: () => calls.push('save'), onCancel: () => calls.push('cancel'), onChange: () => calls.push('change') })
  nodes(tree, 'input')[1].props.onChange()
  assert.deepEqual(calls, ['change'])
  nodes(tree, 'form')[0].props.onSubmit()
  nodes(tree, 'button').find((button) => button.props.type === 'button').props.onClick()
  assert.deepEqual(calls, ['change', 'save', 'cancel'])
})

test('report cards show real calendar days and content in native details without fake company names', () => {
  const html = list({ reports: [{ ...report, challenges: 'Slow network.' }] })
  for (const text of ['Jan 02, 2026', '7.5 hours', 'Draft', 'Student One', 'student@example.com', 'Built a form.', 'Learned validation.', 'Slow network.', 'Jan 01, 2026 to Oct 01, 2026']) assert.ok(html.includes(text), text)
  assert.match(html, /<details/)
  assert.match(html, /dateTime="2026-01-02"/)
  assert.doesNotMatch(html, /Company name|Example Company|reviewedBy/)
})

test('every status is readable and only editable active student reports offer edit and submit', () => {
  for (const [status, label] of Object.entries({ draft: 'Draft', submitted: 'Submitted', approved: 'Approved', changes_requested: 'Changes requested' })) {
    const html = list({ reports: [{ ...report, status }] })
    assert.ok(html.includes(label))
    if (['draft', 'changes_requested'].includes(status)) assert.match(html, /Edit report|Submit report/)
    else assert.doesNotMatch(html, /Edit report|Submit report/)
  }
  for (const status of ['assigned', 'completed', 'cancelled']) assert.doesNotMatch(list({ reports: [{ ...report, internship: { ...internship, status } }] }), /Edit report|Submit report/)
  assert.doesNotMatch(list({ student: false }), /Edit report|Submit report|Approve report|Request changes/)
})

test('last submission and review use Kabul timestamps while retained feedback remains plain text', () => {
  const html = list({ reports: [{ ...report, status: 'changes_requested', submittedAt: '2026-01-02T19:30:00.000Z', reviewedAt: '2026-01-03T05:00:00.000Z',
    reviewedBy: student._id, feedback: '<script>Add details</script>' }] })
  assert.match(html, /Jan 03, 2026, 12:00 AM Kabul/)
  assert.match(html, /Last reviewed/)
  assert.match(html, /Last review feedback/)
  assert.match(html, /&lt;script&gt;Add details&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>|507f1f77/)
})

test('deleted references and empty pages do not hide history or fabricate reports', () => {
  const html = list({ reports: [{ ...report, student: null, internship: null }] })
  assert.match(html, /Student unavailable/)
  assert.match(html, /Internship unavailable/)
  assert.match(html, /Built a form/)
  assert.doesNotMatch(html, /Edit report|Submit report/)
  assert.match(list({ reports: [] }), /No daily reports yet/)
  const later = list({ reports: [], page: 2 })
  assert.match(later, /No daily reports on this page/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
})

test('loading and failures hide stale reports and expose readable retry controls', () => {
  const loading = list({ loading: true, hasNextPage: true })
  const failed = list({ error: '<script>Unable to connect</script>', hasNextPage: true })
  assert.match(loading, /Loading daily reports/)
  assert.match(loading, /aria-busy="true"/)
  assert.match(failed, /Retry/)
  assert.match(failed, /&lt;script&gt;Unable to connect&lt;\/script&gt;/)
  for (const html of [loading, failed]) {
    assert.doesNotMatch(html, /Built a form|Student One|<script>/)
    assert.match(html, /disabled="" aria-label="Next page"/)
  }
})

test('pending writes lock all list actions while reconciliation only locks writes and keeps refresh available', () => {
  const busyTree = DailyReportList({ ...listDefaults, disabled: true, submittingId: report._id })
  for (const button of nodes(busyTree, 'button')) assert.equal(button.props.disabled, true)
  assert.match(list({ disabled: true, submittingId: report._id }), /Submitting/)
  for (const props of [{ actionsDisabled: true }, { editingId: report._id }]) {
    const tree = DailyReportList({ ...listDefaults, ...props })
    const buttons = nodes(tree, 'button')
    assert.equal(buttons.find((button) => button.props['aria-label'] === 'Refresh daily reports').props.disabled, false)
    for (const button of buttons.filter((item) => !item.props['aria-label'])) assert.equal(button.props.disabled, true)
  }
})

test('list refresh, pagination, edit and submit forward only explicit user actions', () => {
  const calls = []
  const tree = DailyReportList({ ...listDefaults, page: 2, hasNextPage: true, onRefresh: () => calls.push('refresh'), onPageChange: (page) => calls.push(page),
    onEdit: (item) => calls.push(['edit', item._id]), onSubmit: (item) => calls.push(['submit', item._id]) })
  assert.deepEqual(calls, [])
  for (const button of nodes(tree, 'button')) button.props.onClick()
  assert.deepEqual(calls, ['refresh', ['edit', report._id], ['submit', report._id], 1, 3])
})

test('report text and feedback wrap and escape HTML in both existing themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(DailyReportList, { ...listDefaults, reports: [{ ...report, tasks: '<script>unsafe</script>' + 'A'.repeat(1000), feedback: '<img src=x>' }] }), { theme })
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /whitespace-pre-wrap/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('daily report navigation and breadcrumb follow backend role visibility', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    if (role === 'company_representative') assert.doesNotMatch(html, /href="\/daily-reports"/)
    else {
      assert.match(html, /href="\/daily-reports"/)
      assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    }
  }
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Daily reports<\/li>/)
})

test('URL pages restore selection, account scopes reset state and readers have no writing form', () => {
  for (const [query, page] of [['?page=3', 3], ['?page=bad', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(DailyReports), { path: `/daily-reports${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /New daily report/)
    assert.match(html, /Loading daily reports/)
    assert.doesNotMatch(html, /test-token|Daily report saved/)
  }
  for (const role of ['admin', 'academic_supervisor']) {
    const html = render(h(DailyReports), { role })
    assert.match(html, /Loading daily reports/)
    assert.doesNotMatch(html, /New daily report|Save draft|Loading active internships/)
  }
  function ScopeProbe() {
    const tree = DailyReports()
    const { user, token } = useContext(AuthContext)
    assert.equal(tree.key, `${user.id}:${token}:1`)
    return tree
  }
  render(h(ScopeProbe))
})

test('the registered daily reports route blocks unauthorized roles and missing sessions', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/daily-reports')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.deepEqual(route.props.element.props.allowedRoles, ['admin', 'student', 'academic_supervisor'])
  assert.equal(route.props.element.props.children.type, DailyReports)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ allowedRoles: route.props.element.props.allowedRoles, children: h('p', null, 'Reports content') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (user.role === 'company_representative') assert.equal(element.props.to, '/dashboard')
    return element
  }
  for (const role of ['student', 'admin', 'academic_supervisor']) assert.match(render(h(GuardProbe), { role }), /Reports content/)
  for (const [role, token] of [['company_representative', 'token'], [null, null], ['student', null]]) assert.doesNotMatch(render(h(GuardProbe), { role, token }), /Reports content/)
})
