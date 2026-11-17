import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, InternshipList, InternshipAssignmentForm, InternshipAssignmentFields, Internships, App, Sidebar, Navbar, ProtectedRoute, AuthContext, ThemeContext
const student = { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' }
const supervisor = { _id: '507f1f77bcf86cd799439016', name: 'Supervisor One', email: 'supervisor@example.com' }
const internship = { _id: '507f1f77bcf86cd799439017', status: 'assigned', student, supervisor,
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company', address: 'Kabul, Afghanistan' },
  opportunity: { _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern' }, startDate: '2026-12-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z' }
const application = { _id: '507f1f77bcf86cd799439013', student, opportunity: { ...internship.opportunity, company: internship.company } }
const listDefaults = { internships: [internship], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }
const fieldDefaults = { values: { applicationId: '', supervisorId: '', startDate: '', endDate: '' }, errors: {}, applications: [application], supervisors: [supervisor], loadingOptions: false, optionsError: '', saving: false, onChange() {}, onSubmit() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  InternshipList = (await server.ssrLoadModule('/src/components/InternshipList.jsx')).default
  const form = await server.ssrLoadModule('/src/components/InternshipAssignmentForm.jsx')
  InternshipAssignmentForm = form.default
  InternshipAssignmentFields = form.InternshipAssignmentFields
  Internships = (await server.ssrLoadModule('/src/pages/Internships.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'admin', token = 'test-token', path = '/internships', theme = 'light' } = {}) {
  const user = role ? { id: 'test-user', name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(AuthContext.Provider, { value: { user, token, signOut() {} } },
    h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function list(props = {}) { return render(h(InternshipList, { ...listDefaults, ...props })) }
function fields(props = {}) { return render(h(InternshipAssignmentFields, { ...fieldDefaults, ...props })) }

test('internship records show actual people, company, calendar dates and status without lifecycle controls', () => {
  const html = list()
  for (const text of ['Student One', 'student@example.com', 'Supervisor One', 'supervisor@example.com', 'Example Company', 'Kabul, Afghanistan', 'Frontend Intern', 'Assigned', 'Dec 01, 2026', 'Feb 01, 2027']) assert.ok(html.includes(text), text)
  assert.match(html, /dateTime="2026-12-01"/)
  assert.doesNotMatch(html, /Activate|Cancel internship|Complete internship|Delete|remaining seats/)
})

test('all four internship statuses have readable labels and missing references remain explicit', () => {
  for (const [status, label] of Object.entries({ assigned: 'Assigned', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' })) {
    assert.match(list({ internships: [{ ...internship, status }] }), new RegExp(`>${label}<`))
  }
  const html = list({ internships: [{ ...internship, student: null, supervisor: null, company: null, opportunity: null }] })
  for (const label of ['Student unavailable', 'Supervisor unavailable', 'Company unavailable', 'Opportunity unavailable']) assert.ok(html.includes(label))
  assert.doesNotMatch(html, /Company address|student@example.com/)
})

test('first and later empty pages have a way back without invented records', () => {
  const first = list({ internships: [] })
  const later = list({ internships: [], page: 2 })
  assert.match(first, /No internships yet/)
  assert.match(later, /No internships on this page/)
  assert.match(first, /disabled="" aria-label="Previous page"/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
  assert.match(later, /disabled="" aria-label="Next page"/)
})

test('loading and error states hide previous results and disable inappropriate navigation', () => {
  const loading = list({ loading: true, page: 2, hasNextPage: true })
  assert.match(loading, /Loading internships/)
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /disabled="" aria-label="Previous page"/)
  const failed = list({ error: '<script>Connection failed</script>', hasNextPage: true })
  assert.match(failed, /&lt;script&gt;Connection failed&lt;\/script&gt;/)
  assert.match(failed, /Retry/)
  assert.match(failed, /disabled="" aria-label="Next page"/)
  assert.doesNotMatch(loading + failed, /Student One|Frontend Intern|<script>/)
})

test('refresh, retry and pagination use the supplied callbacks', () => {
  const calls = []
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]
  }
  const tree = InternshipList({ ...listDefaults, page: 2, error: 'Unavailable', onRefresh: () => calls.push('refresh'), onPageChange: (page) => calls.push(page) })
  for (const button of buttons(tree).filter((item) => !item.props.disabled)) button.props.onClick()
  assert.deepEqual(calls, ['refresh', 'refresh', 1])
  const next = InternshipList({ ...listDefaults, hasNextPage: true, onPageChange: (page) => calls.push(page) })
  buttons(next).find((button) => button.props['aria-label'] === 'Next page').props.onClick()
  assert.equal(calls.at(-1), 2)
})

test('assignment fields use real choices and four labelled inputs without client-controlled identity/status', () => {
  const html = fields()
  for (const name of ['applicationId', 'supervisorId', 'startDate', 'endDate']) assert.ok(html.includes(`name="${name}"`))
  assert.match(html, /Student One \(student@example.com\) - Frontend Intern - Example Company/)
  assert.match(html, /Supervisor One \(supervisor@example.com\)/)
  assert.equal((html.match(/type="date"/g) || []).length, 2)
  assert.doesNotMatch(html, /name="student"|name="status"|name="slot"|selected=""[^>]*>Supervisor One/)
})

test('empty options disable selection and assignment but leave date entry available', () => {
  const html = fields({ applications: [], supervisors: [] })
  assert.match(html, /No approved applications available/)
  assert.match(html, /No active academic supervisors available/)
  assert.equal((html.match(/disabled=""/g) || []).length >= 3, true)
  for (const input of html.match(/<input\b[^>]*>/g)) assert.doesNotMatch(input, /disabled=/)
  assert.doesNotMatch(html, /<fieldset disabled=/)
})

test('missing saved choices and refresh/error states preserve entered values without pretending choices are valid', () => {
  const html = fields({ values: { applicationId: 'missing-application', supervisorId: 'missing-supervisor', startDate: '2026-12-01', endDate: '2027-02-01' }, applications: [], supervisors: [], optionsError: 'Unavailable' })
  assert.match(html, /Unavailable application/)
  assert.match(html, /Unavailable supervisor/)
  assert.match(html, /value="2026-12-01"/)
  assert.match(html, /value="2027-02-01"/)
  assert.match(fields({ loadingOptions: true }), /name="applicationId"[\s\S]*?disabled=""/)
})

test('saving disables the form and field errors are labelled and escaped', () => {
  const html = fields({ saving: true, errors: { startDate: '<script>Invalid date</script>' } })
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Assigning/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /aria-describedby="assignment-startDate-error"/)
  assert.match(html, /&lt;script&gt;Invalid date&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('assignment form is visible only to admin and does not fake initial options or success', () => {
  assert.match(render(h(InternshipAssignmentForm, { onAssigned() {} })), /Loading assignment choices/)
  assert.doesNotMatch(render(h(InternshipAssignmentForm, { onAssigned() {} })), /Internship assigned successfully|Student One/)
  for (const role of ['student', 'academic_supervisor', 'company_representative']) {
    assert.equal(render(h(InternshipAssignmentForm, { onAssigned() {} }), { role }), '')
  }
})

test('long text is wrapped and escaped in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(InternshipList, { ...listDefaults, internships: [{ ...internship, student: { ...student, name: '<script>Student</script>', email: 'A'.repeat(254) },
      company: { ...internship.company, address: 'B'.repeat(300) } }] }), { theme })
    assert.match(html, /&lt;script&gt;Student&lt;\/script&gt;/)
    assert.match(html, /break-all/)
    assert.match(html, /break-words/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black/)
  }
})

test('internship navigation matches the three backend roles and has one active link', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    if (role === 'company_representative') assert.doesNotMatch(html, /href="\/internships"/)
    else {
      assert.match(html, /href="\/internships"/)
      assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    }
  }
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Internships<\/li>/)
})

test('URL pages restore selection, invalid pages use one, and only admin gets the assignment form', () => {
  for (const [query, page] of [['?page=3', 3], ['?page=bad', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(Internships), { path: `/internships${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /Loading internships/)
    assert.doesNotMatch(html, /test-token|Student One/)
  }
  for (const role of ['student', 'academic_supervisor']) {
    const html = render(h(Internships), { role })
    assert.match(html, /Loading internships/)
    assert.doesNotMatch(html, /assignment-application|Assign internship/)
  }
})

test('the internships route guard admits only admins, students and academic supervisors', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/internships')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.deepEqual(route.props.element.props.allowedRoles, ['admin', 'student', 'academic_supervisor'])
  assert.equal(route.props.element.props.children.type, Internships)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ allowedRoles: ['admin', 'student', 'academic_supervisor'], children: h('p', null, 'Internship content') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (user.role === 'company_representative') assert.equal(element.props.to, '/dashboard')
    return element
  }
  for (const role of ['admin', 'student', 'academic_supervisor']) assert.match(render(h(GuardProbe), { role }), /Internship content/)
  for (const [role, token] of [['company_representative', 'token'], [null, null], ['student', null]]) {
    assert.doesNotMatch(render(h(GuardProbe), { role, token }), /Internship content/)
  }
})
