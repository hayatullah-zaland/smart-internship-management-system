import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let ApplicationList
let ApplicationAction
let OpportunityApply
let OpportunityList
let MyApplications
let Sidebar
let Navbar
let App
let ProtectedRoute
let AuthContext
let ThemeContext

const opportunity = {
  _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern', description: 'Build useful tools.',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company', address: 'Kabul' },
  deadline: '2027-01-31T23:59:00.000Z', status: 'open', capacity: 3,
}
const application = {
  _id: '507f1f77bcf86cd799439013', student: '507f1f77bcf86cd799439014',
  opportunity, status: 'pending', createdAt: '2026-11-16T19:30:00.000Z', rejectionReason: '',
}
const defaults = { applications: [application], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  ApplicationList = (await server.ssrLoadModule('/src/components/ApplicationList.jsx')).default
  const applyModule = await server.ssrLoadModule('/src/components/OpportunityApply.jsx')
  ApplicationAction = applyModule.ApplicationAction
  OpportunityApply = applyModule.default
  OpportunityList = (await server.ssrLoadModule('/src/components/OpportunityList.jsx')).default
  MyApplications = (await server.ssrLoadModule('/src/pages/MyApplications.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'student', token = 'test-token', path = '/applications', theme = 'light' } = {}) {
  const user = role ? { id: application.student, name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element)))).replace(/\u202f/g, ' ')
}
function list(props = {}) { return render(h(ApplicationList, { ...defaults, ...props })) }
function action(props = {}) { return render(h(ApplicationAction, { opportunityTitle: opportunity.title, onApply() {}, ...props })) }

test('application history shows real opportunity, company, status and Kabul dates', () => {
  const html = list()
  assert.match(html, /Frontend Intern/)
  assert.match(html, /Example Company/)
  assert.match(html, /Pending/)
  assert.match(html, /Nov 17, 2026/)
  assert.match(html, /12:00 AM/)
  assert.match(html, /dateTime="2026-11-16T19:30:00.000Z"/)
  assert.match(html, /Opportunity deadline/)
  assert.match(html, /Kabul/)
  assert.doesNotMatch(html, /Approve|Reject application|Withdraw application|Edit|Delete/)
})

test('all five application statuses have explicit readable labels', () => {
  for (const [status, label] of Object.entries({ pending: 'Pending', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn' })) {
    assert.match(list({ applications: [{ ...application, status }] }), new RegExp(`>${label}<`))
  }
})

test('rejection reasons are visible only for rejected applications and remain plain text', () => {
  const item = { ...application, rejectionReason: '<script>Reason</script>\nPlease try later.' }
  const html = list({ applications: [{ ...item, status: 'rejected' }] })
  assert.match(html, /Rejection reason/)
  assert.match(html, /&lt;script&gt;Reason&lt;\/script&gt;/)
  assert.match(html, /whitespace-pre-wrap/)
  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(list({ applications: [item] }), /Rejection reason|Reason/)
})

test('deleted opportunities and companies do not hide application history', () => {
  const missing = list({ applications: [{ ...application, opportunity: null }] })
  assert.match(missing, /Opportunity unavailable/)
  assert.match(missing, /Company unavailable/)
  assert.match(missing, /Pending/)
  assert.doesNotMatch(missing, /Opportunity deadline|Frontend Intern/)
  const company = list({ applications: [{ ...application, opportunity: { ...opportunity, company: null } }] })
  assert.match(company, /Frontend Intern/)
  assert.match(company, /Company unavailable/)
})

test('first and later empty pages are honest and keep pagination back available', () => {
  const first = list({ applications: [] })
  const later = list({ applications: [], page: 2 })
  assert.match(first, /No applications yet/)
  assert.match(first, /href="\/opportunities"/)
  assert.match(first, /disabled="" aria-label="Previous page"/)
  assert.match(later, /No applications on this page/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
  assert.match(later, /disabled="" aria-label="Next page"/)
})

test('loading and failure states hide earlier results and disable unsafe page changes', () => {
  const loading = list({ page: 2, loading: true, hasNextPage: true })
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /Loading applications/)
  assert.match(loading, /disabled="" aria-label="Previous page"/)
  assert.match(loading, /disabled="" aria-label="Next page"/)
  const failed = list({ error: '<img src=x>Connection failed', hasNextPage: true })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /&lt;img src=x&gt;/)
  assert.match(failed, /Retry/)
  assert.match(failed, /disabled="" aria-label="Next page"/)
  assert.doesNotMatch(loading + failed, /Frontend Intern|Example Company|<img/)
})

test('refresh, retry and page controls call the supplied actions', () => {
  let refreshes = 0
  const pages = []
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]
  }
  const tree = ApplicationList({ ...defaults, page: 2, hasNextPage: true, error: 'Unavailable',
    onRefresh: () => { refreshes += 1 }, onPageChange: (page) => pages.push(page) })
  for (const button of buttons(tree).filter((entry) => !entry.props.disabled)) button.props.onClick()
  assert.equal(refreshes, 2)
  assert.deepEqual(pages, [1])
  const next = ApplicationList({ ...defaults, page: 2, hasNextPage: true, onPageChange: (page) => pages.push(page) })
  buttons(next).find((button) => button.props['aria-label'] === 'Next page').props.onClick()
  assert.deepEqual(pages, [1, 3])
})

test('long titles, companies and rejection reasons wrap in both existing themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(ApplicationList, { ...defaults, applications: [{ ...application, status: 'rejected',
      rejectionReason: 'A'.repeat(1000), opportunity: { ...opportunity, title: '<img>' + 'B'.repeat(140),
        company: { ...opportunity.company, name: 'C'.repeat(150) } } }] }), { theme })
    assert.match(html, /&lt;img&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /min-w-0/)
    assert.doesNotMatch(html, /<img|bg-white|text-black/)
  }
})

test('Apply is an explicit command and links to My applications', () => {
  const html = action()
  assert.match(html, /aria-label="Apply for Frontend Intern"/)
  assert.match(html, />\s*Apply<\/button>/)
  assert.match(html, /href="\/applications"/)
  assert.doesNotMatch(html, /disabled=|Application submitted successfully/)
})

test('pending submission disables Apply and does not claim success', () => {
  const html = action({ status: 'submitting' })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /disabled=""/)
  assert.match(html, /Applying/)
  assert.doesNotMatch(html, /Application submitted successfully/)
})

test('confirmed and duplicate applications cannot be resubmitted from their action', () => {
  const submitted = action({ status: 'submitted' })
  const duplicate = action({ status: 'duplicate' })
  for (const html of [submitted, duplicate]) {
    assert.match(html, /disabled=""/)
    assert.match(html, />\s*Applied<\/button>/)
    assert.match(html, /aria-label="Applied for Frontend Intern"/)
    assert.match(html, /role="status"/)
  }
  assert.match(submitted, /Application submitted successfully/)
  assert.match(duplicate, /You have already applied/)
  assert.doesNotMatch(duplicate, /Application submitted successfully/)
})

test('failed or uncertain submissions offer the real error and application history without claiming success', () => {
  const html = action({ status: 'error', message: '<script>Could not confirm</script>. Check My applications before trying again.' })
  assert.match(html, /role="alert"/)
  assert.match(html, /&lt;script&gt;Could not confirm&lt;\/script&gt;/)
  assert.match(html, /href="\/applications"/)
  assert.doesNotMatch(html, /disabled=|Application submitted successfully|<script>/)
})

test('only students see Apply and it is outside the clickable summary', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(OpportunityList, { opportunities: [opportunity], page: 1, loading: false, hasNextPage: false,
      onRefresh() {}, onPageChange() {}, renderActions: (item) => h(OpportunityApply, { opportunityId: item._id, opportunityTitle: item.title }) }), { role })
    if (role === 'student') {
      assert.match(html, /aria-label="Apply for Frontend Intern"/)
      assert.doesNotMatch(html.match(/<summary\b[\s\S]*?<\/summary>/)[0], /<button/)
    } else {
      assert.doesNotMatch(html, /Apply for|href="\/applications"/)
    }
  }
})

test('only the student sidebar has My applications and its active location is correct', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    if (role === 'student') {
      assert.match(html, /href="\/applications"/)
      assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
      assert.match(html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0], /href="\/applications"/)
    } else assert.doesNotMatch(html, /href="\/applications"/)
  }
})

test('navbar and URL page query identify My applications, with invalid pages falling back to one', () => {
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">My applications<\/li>/)
  for (const [query, page] of [['?page=3', 3], ['?page=abc', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(MyApplications), { path: `/applications${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /Loading applications/)
    assert.doesNotMatch(html, /test-token|Frontend Intern/)
  }
})

test('the My applications route requires a signed-in student', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/applications')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'student')
  assert.equal(route.props.element.props.children.type, MyApplications)
  function GuardProbe() {
    const { user, token } = useContext(AuthContext)
    const element = ProtectedRoute({ requiredRole: 'student', children: h('p', null, 'Student applications') })
    if (!user || !token) assert.equal(element.props.to, '/login')
    else if (user.role !== 'student') assert.equal(element.props.to, '/dashboard')
    return element
  }
  assert.match(render(h(GuardProbe)), /Student applications/)
  for (const role of ['admin', 'academic_supervisor', 'company_representative', null]) {
    assert.doesNotMatch(render(h(GuardProbe), { role, token: role ? 'test-token' : null }), /Student applications/)
  }
})
