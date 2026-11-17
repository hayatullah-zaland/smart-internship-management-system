import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let OpportunityList
let Opportunities
let Sidebar
let Navbar
let ProtectedRoute
let App
let AuthContext
let ThemeContext

const opportunity = {
  _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern', description: 'Build university tools.\nWork with the team.',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Example Company', address: 'Kabul, Afghanistan' },
  deadline: '2026-11-20T19:30:00.000Z', capacity: 3, status: 'open',
}
const defaults = { opportunities: [opportunity], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  OpportunityList = (await server.ssrLoadModule('/src/components/OpportunityList.jsx')).default
  Opportunities = (await server.ssrLoadModule('/src/pages/Opportunities.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'student', token = 'test-token', path = '/opportunities', theme = 'light' } = {}) {
  const user = role ? { id: 'user-id', name: 'Test User', email: 'user@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element)))).replace(/\u202f/g, ' ')
}

function list(props = {}) { return render(h(OpportunityList, { ...defaults, ...props })) }

test('opportunity details contain real company, description, address and total capacity', () => {
  const html = list()
  assert.match(html, /Frontend Intern/)
  assert.match(html, /Example Company/)
  assert.match(html, /Capacity: 3/)
  assert.match(html, /Build university tools\.\nWork with the team/)
  assert.match(html, /Kabul, Afghanistan/)
  assert.match(html, /<details\b/)
  assert.match(html, /<summary\b/)
  assert.doesNotMatch(html, /<details[^>]*\bopen=|Apply|seats left|Edit|Delete/)
})

test('deadline is shown in Kabul time across a UTC/local midnight boundary', () => {
  const html = list()
  assert.match(html, /Nov 21, 2026/)
  assert.match(html, /12:00 AM/)
  assert.match(html, /dateTime="2026-11-20T19:30:00.000Z"/)
  assert.match(html, /Kabul/)
})

test('empty first and later pages have honest empty states with a path back', () => {
  const first = list({ opportunities: [] })
  const later = list({ opportunities: [], page: 2 })
  assert.match(first, /No open opportunities right now/)
  assert.match(later, /No opportunities on this page/)
  assert.match(first, /disabled="" aria-label="Previous page"/)
  assert.doesNotMatch(later, /disabled="" aria-label="Previous page"/)
  assert.match(later, /disabled="" aria-label="Next page"/)
  assert.doesNotMatch(first + later, /<details\b/)
})

test('loading and errors hide previous opportunity details', () => {
  const loading = list({ loading: true })
  const failed = list({ error: '<script>Connection failed</script>' })
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /Loading opportunities/)
  assert.match(failed, /role="alert"/)
  assert.match(failed, /&lt;script&gt;Connection failed&lt;\/script&gt;/)
  assert.match(failed, /Retry/)
  assert.doesNotMatch(loading + failed, /Frontend Intern|<details\b|<script>/)
})

test('all pagination is disabled while loading and Next is disabled without another possible page', () => {
  const loading = list({ loading: true, page: 2, hasNextPage: true })
  assert.match(loading, /disabled="" aria-label="Previous page"/)
  assert.match(loading, /disabled="" aria-label="Next page"/)
  assert.match(list(), /disabled="" aria-label="Next page"/)
  assert.doesNotMatch(list({ hasNextPage: true }), /disabled="" aria-label="Next page"/)
  assert.match(list({ hasNextPage: true, error: 'Unavailable' }), /disabled="" aria-label="Next page"/)
})

test('a missing referenced company is labelled unavailable without inventing an address', () => {
  const html = list({ opportunities: [{ ...opportunity, company: null }] })
  assert.match(html, /Company unavailable/)
  assert.doesNotMatch(html, /Company address|Kabul, Afghanistan/)
})

test('long text and unexpected markup are wrapped and escaped in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(OpportunityList, { ...defaults, opportunities: [{
      ...opportunity, title: '<script>alert(1)</script>' + 'A'.repeat(100), description: '<img src=x>\n' + 'B'.repeat(4900),
    }] }), { theme })
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /whitespace-pre-wrap/)
    assert.match(html, /min-w-0/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('refresh, retry and pagination buttons call the correct actions', () => {
  let refreshes = 0
  const pages = []
  const tree = OpportunityList({ ...defaults, page: 2, hasNextPage: true, error: 'Unavailable',
    onRefresh: () => { refreshes += 1 }, onPageChange: (page) => pages.push(page) })
  function buttons(node) {
    if (!node || typeof node !== 'object') return []
    return [...(node.type === 'button' ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons)]
  }
  const actions = buttons(tree)
  for (const action of actions.filter((button) => !button.props.disabled)) action.props.onClick()
  assert.equal(refreshes, 2)
  assert.deepEqual(pages, [1])
  const nextTree = OpportunityList({ ...defaults, page: 2, hasNextPage: true, onPageChange: (page) => pages.push(page) })
  buttons(nextTree).find((button) => button.props['aria-label'] === 'Next page').props.onClick()
  assert.deepEqual(pages, [1, 3])
})

test('every supported role sees Opportunities with one correct active sidebar link', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role })
    assert.match(html, /href="\/opportunities"/)
    assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    const active = html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0]
    assert.match(active, /href="\/opportunities"/)
  }
})

test('navbar breadcrumb identifies the Opportunities page', () => {
  const html = render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }))
  assert.match(html, /aria-current="location">Opportunities<\/li>/)
})

test('page query selects the requested page and invalid query values fall back to page one', () => {
  for (const [query, page] of [['?page=3', 3], ['?page=abc', 1], ['?page=0', 1], ['?page=1000001', 1]]) {
    const html = render(h(Opportunities), { path: `/opportunities${query}` })
    assert.match(html, new RegExp(`Page ${page}<`))
    assert.match(html, /Loading opportunities/)
    assert.doesNotMatch(html, /test-token|<details\b/)
  }
})

test('the registered opportunities URL requires sign-in without restricting browsing to one role', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/opportunities')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, undefined)
  assert.equal(route.props.element.props.children.type, Opportunities)
  function GuardProbe() {
    const session = useContext(AuthContext)
    const element = ProtectedRoute({ children: h('p', null, 'Browse opportunities') })
    if (!session.user || !session.token) assert.equal(element.props.to, '/login')
    return element
  }
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    assert.match(render(h(GuardProbe), { role }), /Browse opportunities/)
  }
  assert.doesNotMatch(render(h(GuardProbe), { role: null, token: null }), /Browse opportunities/)
})
