import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, EvaluationForm, EvaluationList, Evaluations, InternshipList, App, Sidebar, Navbar, ProtectedRoute, AuthContext, ThemeContext
const supervisor = { _id: '507f1f77bcf86cd799439016', name: 'Supervisor One', email: 'supervisor@example.com' }
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', status: 'completed', student, supervisor,
  company: { name: 'Example Company', address: 'Kabul' }, opportunity: { title: 'Frontend Intern' }, startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z' }
const values = { internshipId: internship._id, score: '0', comments: 'Final assessment comments.' }
const evaluation = { _id: '507f1f77bcf86cd799439020', internship: internship._id, student, evaluator: { _id: supervisor._id, name: supervisor.name },
  type: 'academic', score: 0, comments: values.comments, createdAt: '2026-11-17T19:30:00.000Z' }
const formDefaults = { values, errors: {}, internships: [internship], academic: true, loading: false, optionsError: '', disabled: false, saving: false, confirming: false,
  onChange() {}, onReview() {}, onConfirm() {}, onBack() {} }
const listDefaults = { evaluations: [evaluation], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  EvaluationForm = (await server.ssrLoadModule('/src/components/EvaluationForm.jsx')).default
  EvaluationList = (await server.ssrLoadModule('/src/components/EvaluationList.jsx')).default
  Evaluations = (await server.ssrLoadModule('/src/pages/Evaluations.jsx')).default
  InternshipList = (await server.ssrLoadModule('/src/components/InternshipList.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'academic_supervisor', token = 'test-token', path = '/evaluations', theme = 'light' } = {}) {
  const user = role ? { id: supervisor._id, name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { user, token, signOut() {} } },
    h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function form(props = {}) { return render(h(EvaluationForm, { ...formDefaults, ...props })) }
function list(props = {}) { return render(h(EvaluationList, { ...listDefaults, ...props })) }
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('academic form uses actual completed choices and labelled score/comments fields', () => {
  const html = form()
  assert.match(html, /Student One \(student@example.com\) - Frontend Intern - Example Company/)
  for (const name of ['internshipId', 'score', 'comments']) assert.ok(html.includes(`name="${name}"`))
  assert.match(html, /min="0" max="100" step="any"/)
  assert.match(html, /maxLength="2000" required=""/)
  assert.match(html, /Review evaluation/)
  assert.doesNotMatch(html, /Record evaluation|name="student"|name="evaluator"|name="type"/)
})

test('company form uses an explicit ID input without pretending a private internship list was loaded', () => {
  const html = form({ academic: false, internships: [] })
  assert.match(html, /Internship ID/)
  assert.match(html, /minLength="24" maxLength="24"/)
  assert.doesNotMatch(html, /<select|No completed internships|Student One|Loading completed internships/)
})

test('loading, errors and empty academic choices remain explicit and preserve score/comments', () => {
  assert.match(form({ loading: true }), /Loading completed internships/)
  assert.match(form({ internships: [] }), /No completed internships available/)
  assert.match(form({ optionsError: '<script>Unavailable</script>' }), /&lt;script&gt;Unavailable&lt;\/script&gt;/)
  const html = form({ internships: [] })
  assert.match(html, /Internship no longer available/)
  assert.match(html, /value="0"/)
  assert.match(html, /Final assessment comments/)
  assert.doesNotMatch(html, /Final evaluation recorded|<script>/)
})

test('validation errors have accessible targets and external locks disable the entry form', () => {
  const html = form({ disabled: true, errors: { score: '<script>Enter score</script>' } })
  assert.match(html, /<fieldset[^>]*disabled=""/)
  assert.match(html, /aria-describedby="evaluation-score-error"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /&lt;script&gt;Enter score&lt;\/script&gt;/)
  assert.match(html, /type="submit" disabled=""/)
})

test('confirmation displays the exact zero score, student, ID, type and comments without editable fields', () => {
  const html = form({ confirming: true })
  for (const text of ['Confirm final evaluation', 'Student One', 'student@example.com', internship._id, '0 / 100', 'Academic', values.comments, 'Record evaluation', 'Back']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /<input|<select|<textarea|Review evaluation/)
  const company = form({ confirming: true, academic: false, internships: [] })
  assert.match(company, /Company/)
  assert.doesNotMatch(company, /Student One|student@example.com/)
})

test('recording locks confirmation commands and exposes a pending state without claiming success', () => {
  const html = form({ confirming: true, saving: true })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /Recording/)
  for (const button of html.match(/<button\b[^>]*>/g)) assert.match(button, /disabled=""/)
  assert.doesNotMatch(html, /Final evaluation recorded/)
})

test('review, back and final record have separate explicit callbacks without automatic recording', () => {
  const calls = []
  const props = { ...formDefaults, onChange: () => calls.push('change'), onReview: () => calls.push('review'), onConfirm: () => calls.push('record'), onBack: () => calls.push('back') }
  const entry = EvaluationForm(props)
  nodes(entry, 'input')[0].props.onChange()
  nodes(entry, 'form')[0].props.onSubmit()
  assert.deepEqual(calls, ['change', 'review'])
  const confirmation = EvaluationForm({ ...props, confirming: true })
  nodes(confirmation, 'button').find((button) => button.props.type === 'button').props.onClick()
  assert.deepEqual(calls, ['change', 'review', 'back'])
  nodes(confirmation, 'form')[0].props.onSubmit()
  assert.deepEqual(calls, ['change', 'review', 'back', 'record'])
})

test('list shows actual zero scores and distinct assessment types without invented pass marks or averages', () => {
  const html = list()
  for (const text of ['Student One', 'student@example.com', 'Supervisor One', 'Academic', values.comments, internship._id]) assert.ok(html.includes(text), text)
  assert.match(html, />0<span[^>]*> \/ 100/)
  assert.match(list({ evaluations: [{ ...evaluation, type: 'company', score: 72.5 }] }), /Company/)
  assert.match(list({ evaluations: [{ ...evaluation, type: 'company', score: 72.5 }] }), /72.5/)
  assert.doesNotMatch(html, /Passed|Failed|Average|Company name|Frontend Intern/)
})

test('recording times use Kabul dates and deleted people never hide the grade or create fake names', () => {
  const html = list({ evaluations: [{ ...evaluation, student: null, evaluator: null }] })
  assert.match(html, /Nov 18, 2026, 12:00 AM Kabul/)
  assert.match(html, /dateTime="2026-11-17T19:30:00.000Z"/)
  assert.match(html, /Student unavailable/)
  assert.match(html, /Evaluator unavailable/)
  assert.match(html, /Final assessment comments/)
  assert.doesNotMatch(html, /Supervisor One|Student One/)
})

test('recorded grades are read-only and have no edit/delete actions', () => {
  const html = list()
  assert.doesNotMatch(html, /Edit evaluation|Delete evaluation|Update score|Record evaluation|<input|<textarea/)
  const tree = EvaluationList(listDefaults)
  assert.equal(nodes(tree, 'button').length, 3)
})

test('empty, later, loading and failed pages do not fabricate grades or expose stale records', () => {
  assert.match(list({ evaluations: [] }), /No evaluations yet/)
  const later = list({ evaluations: [], page: 2 })
  assert.match(later, /No evaluations on this page/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
  const loading = list({ loading: true, hasNextPage: true })
  const failed = list({ error: '<script>Unavailable</script>', hasNextPage: true })
  assert.match(loading, /Loading evaluations/)
  assert.match(failed, /Retry/)
  assert.match(failed, /&lt;script&gt;Unavailable&lt;\/script&gt;/)
  for (const html of [loading, failed]) {
    assert.doesNotMatch(html, /Student One|Final assessment comments|<script>/)
    assert.match(html, /disabled="" aria-label="Next page"/)
  }
})

test('pending records disable refresh/navigation without hiding actual evaluations', () => {
  const html = list({ disabled: true, page: 2, hasNextPage: true })
  assert.match(html, /Student One/)
  assert.match(html, /aria-busy="true"/)
  for (const label of ['Refresh evaluations', 'Previous page', 'Next page']) assert.ok(html.includes(`disabled="" aria-label="${label}"`))
})

test('list refresh, retry and pagination forward explicit supplied callbacks', () => {
  const calls = []
  const tree = EvaluationList({ ...listDefaults, page: 2, hasNextPage: true, onRefresh: () => calls.push('refresh'), onPageChange: (page) => calls.push(page) })
  for (const button of nodes(tree, 'button')) button.props.onClick()
  assert.deepEqual(calls, ['refresh', 1, 3])
  const failed = EvaluationList({ ...listDefaults, error: 'Unavailable', onRefresh: () => calls.push('retry') })
  nodes(failed, 'button').filter((button) => !button.props['aria-label'])[0].props.onClick()
  assert.equal(calls.at(-1), 'retry')
})

test('long comments, IDs and high precision scores wrap and escape HTML in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(EvaluationList, { ...listDefaults, evaluations: [{ ...evaluation, score: 0.0000012345678901234567, comments: '<script>unsafe</script>\n' + 'A'.repeat(1000) }] }), { theme })
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/)
    assert.match(html, /break-all/)
    assert.match(html, /break-words/)
    assert.match(html, /whitespace-pre-wrap/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black/)
  }
  assert.match(form({ confirming: true, values: { ...values, comments: '<script>unsafe</script>' } }), /&lt;script&gt;unsafe&lt;\/script&gt;/)
})

test('internship records expose their actual ID for the admin-to-representative handoff', () => {
  const html = render(h(InternshipList, { internships: [internship], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }))
  assert.match(html, /Internship ID/)
  assert.match(html, new RegExp(internship._id))
  assert.match(html, /break-all font-mono text-xs/)
})

test('every supported role has one active evaluations navigation link and the right breadcrumb', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    assert.match(html, /href="\/evaluations"/)
    assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  }
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Evaluations<\/li>/)
})

test('page gives writing forms only to evaluators and restores URL/account scopes without fake results', () => {
  for (const [query, page] of [['?page=3', 3], ['?page=bad', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(Evaluations), { path: `/evaluations${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /New final evaluation/)
    assert.doesNotMatch(html, /test-token|Final evaluation recorded/)
  }
  for (const role of ['student', 'admin']) assert.doesNotMatch(render(h(Evaluations), { role }), /New final evaluation|Review evaluation|Loading completed internships/)
  const company = render(h(Evaluations), { role: 'company_representative' })
  assert.match(company, /New final evaluation/)
  assert.doesNotMatch(company, /Loading completed internships|<select/)
  function ScopeProbe() {
    const tree = Evaluations()
    const { user, token } = useContext(AuthContext)
    assert.equal(tree.key, `${user.id}:${token}:1`)
    return tree
  }
  render(h(ScopeProbe))
})

test('the registered evaluation route admits valid roles and rejects missing sessions or unknown roles', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/evaluations')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.deepEqual(route.props.element.props.allowedRoles, ['admin', 'student', 'academic_supervisor', 'company_representative'])
  assert.equal(route.props.element.props.children.type, Evaluations)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ allowedRoles: route.props.element.props.allowedRoles, children: h('p', null, 'Evaluation content') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (user.role === 'unknown') assert.equal(element.props.to, '/dashboard')
    return element
  }
  for (const role of route.props.element.props.allowedRoles) assert.match(render(h(GuardProbe), { role }), /Evaluation content/)
  for (const [role, token] of [[null, null], ['student', null], ['unknown', 'token']]) assert.doesNotMatch(render(h(GuardProbe), { role, token }), /Evaluation content/)
})
