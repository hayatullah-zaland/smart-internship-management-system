import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, CompanyForm, CompanyList, CompanyRepresentativeForm, CompanyRepresentativeFields, Companies, Sidebar, Navbar, ProtectedRoute, App, AuthContext, ThemeContext
const company = { _id: '507f1f77bcf86cd799439011', name: 'Test Company', address: 'Kabul, Afghanistan', contactEmail: 'office@example.com', createdBy: '507f1f77bcf86cd799439099', representative: null, createdAt: '2026-11-16T22:00:00.000Z' }
const representative = { id: '507f1f77bcf86cd799439012', name: 'Test Representative', email: 'rep@example.com', role: 'company_representative', isActive: true }
const formProps = { values: { name: '', address: '', contactEmail: '' }, errors: {}, disabled: false, saving: false, onChange() {}, onSubmit() {} }
const listProps = { companies: [company], representatives: [representative], representativesUnavailable: false, page: 1, hasNextPage: true, loading: false, error: '', disabled: false, onRefresh() {}, onPageChange() {} }
const assignmentProps = { id: 'company-rep', company, representatives: [representative], representativeId: '', error: '', unavailable: false, disabled: false, saving: false, onChange() {}, onSubmit() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  CompanyForm = (await server.ssrLoadModule('/src/components/CompanyForm.jsx')).default
  CompanyList = (await server.ssrLoadModule('/src/components/CompanyList.jsx')).default
  const assignment = await server.ssrLoadModule('/src/components/CompanyRepresentativeForm.jsx')
  CompanyRepresentativeForm = assignment.default
  CompanyRepresentativeFields = assignment.CompanyRepresentativeFields
  Companies = (await server.ssrLoadModule('/src/pages/Companies.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'admin-token', path = '/admin/companies', theme = 'light' } = {}) {
  const user = role ? { id: company.createdBy, name: 'Test Admin', email: 'admin@example.com', role } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return []
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('company creation has three labelled backend-aligned fields without identity or representative inputs', () => {
  const html = render(h(CompanyForm, formProps))
  assert.equal((html.match(/<label /g) || []).length, 3)
  assert.match(html, /name="name"/)
  assert.match(html, /minLength="2" maxLength="150"/)
  assert.equal(nodes(CompanyForm(formProps), 'input').find((input) => input.props.name === 'contactEmail').props.type, 'email')
  assert.match(html, /maxLength="254"/)
  assert.match(html, /name="address" rows="3" maxLength="300"/)
  assert.match(html, /Create company/)
  assert.doesNotMatch(html, /name="createdBy"|name="representative"|created successfully/)
})

test('company validation messages are accessible and pending/shared locks disable creation', () => {
  const html = render(h(CompanyForm, { ...formProps, saving: true, errors: { address: '<invalid>' } }))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /fieldset[^>]*disabled=""/)
  assert.match(html, /aria-invalid="true" aria-describedby="company-address-error"/)
  assert.match(html, /&lt;invalid&gt;/)
  assert.match(html, /Creating/)
  assert.match(render(h(CompanyForm, { ...formProps, disabled: true })), /fieldset[^>]*disabled=""/)
})

test('creation field changes never submit until the explicit supplied form action', () => {
  let changes = 0, submits = 0
  const tree = CompanyForm({ ...formProps, onChange() { changes += 1 }, onSubmit() { submits += 1 } })
  for (const input of [...nodes(tree, 'input'), ...nodes(tree, 'textarea')]) input.props.onChange({ target: { name: input.props.name, value: 'test' } })
  assert.equal(changes, 3)
  assert.equal(submits, 0)
  nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(submits, 1)
})

test('representative form starts unselected and offers only active company-representative accounts', () => {
  const people = [representative, { ...representative, id: 'inactive', name: 'Inactive Person', isActive: false },
    { ...representative, id: 'student', name: 'Student Person', role: 'student' }]
  const html = render(h(CompanyRepresentativeForm, { company, representatives: people, onSave() {} }))
  assert.match(html, /Representative for Test Company/)
  assert.match(html, /value="" disabled="" selected="">Choose a representative/)
  assert.match(html, /Test Representative \(rep@example.com\)/)
  assert.doesNotMatch(html, /Inactive Person|Student Person|name="companyId"|assigned successfully/)
  assert.match(html.match(/<button[^>]*type="submit"[^>]*>/)[0], /disabled/)
})

test('replacing a saved representative is explicit and choosing the same person cannot be submitted', () => {
  const current = { ...company, representative: '507f1f77bcf86cd799439013' }
  const html = render(h(CompanyRepresentativeFields, { ...assignmentProps, company: current, representativeId: representative.id }))
  assert.match(html, /New representative/)
  assert.match(html, /This replaces the current representative/)
  assert.match(html, /Replace representative/)
  assert.doesNotMatch(html.match(/<button[^>]*type="submit"[^>]*>/)[0], /disabled/)
  const same = render(h(CompanyRepresentativeFields, { ...assignmentProps, company: { ...company, representative: representative.id }, representativeId: representative.id }))
  assert.match(same.match(/<button[^>]*type="submit"[^>]*>/)[0], /disabled/)
  assert.doesNotMatch(same, /This replaces the current representative/)
})

test('missing choices, loading, errors and pending writes keep representative assignment disabled', () => {
  assert.match(render(h(CompanyRepresentativeFields, { ...assignmentProps, representatives: [] })), /No active company representatives available/)
  for (const changed of [{ unavailable: true }, { disabled: true }, { saving: true }]) {
    const html = render(h(CompanyRepresentativeFields, { ...assignmentProps, representativeId: representative.id, ...changed }))
    assert.equal((html.match(/disabled=""/g) || []).length, 3)
    assert.match(html, /Test Representative/)
  }
  const missing = render(h(CompanyRepresentativeFields, { ...assignmentProps, representatives: [], representativeId: representative.id, error: '<unavailable>' }))
  assert.match(missing, /Representative unavailable/)
  assert.match(missing, /aria-describedby="company-rep-error"/)
  assert.match(missing, /&lt;unavailable&gt;/)
})

test('representative selection never saves before the separate explicit form submission', () => {
  let changes = 0, saves = 0
  const tree = CompanyRepresentativeFields({ ...assignmentProps, representativeId: representative.id, onChange() { changes += 1 }, onSubmit() { saves += 1 } })
  nodes(tree, 'select')[0].props.onChange({ target: { value: representative.id } })
  assert.equal(changes, 1)
  assert.equal(saves, 0)
  nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(saves, 1)
})

test('company list shows actual contact data, ID and Kabul registration date without edit/delete actions', () => {
  const html = render(h(CompanyList, listProps))
  for (const text of [company.name, company.contactEmail, company.address, company._id]) assert.ok(html.includes(text))
  assert.match(html, /dateTime="2026-11-16T22:00:00.000Z">Nov 17, 2026 Kabul/)
  assert.match(html, /Not assigned/)
  assert.doesNotMatch(html, /Delete|Edit company|Test Representative/)
})

test('every company is a separate named card with unique heading IDs and responsive columns', () => {
  const companies = [company, { ...company, _id: '507f1f77bcf86cd799439013', name: 'Second Company' }]
  const html = render(h(CompanyList, { ...listProps, companies }))
  assert.equal((html.match(/<article\b/g) || []).length, 2)
  for (const item of companies) {
    assert.ok(html.includes(`aria-labelledby="company-${item._id}-heading"`))
    assert.ok(html.includes(`id="company-${item._id}-heading"`))
  }
  assert.match(html, /xl:grid-cols-2/)
  assert.match(html, /rounded-lg border border-base-300/)
  assert.match(html, /bg-primary\/10 text-primary/)
  assert.match(html, /bg-info\/10 text-info/)
  assert.doesNotMatch(html, /Verified|Active company|Total internships|<img/)
})

test('each representative action stays inside its own company card', () => {
  const companies = [company, { ...company, _id: '507f1f77bcf86cd799439013', name: 'Second Company' }]
  const called = []
  const html = render(h(CompanyList, { ...listProps, companies, renderActions: (item) => {
    called.push(item._id)
    return h('button', null, 'Manage ' + item.name)
  } }))
  assert.deepEqual(called, companies.map((item) => item._id))
  const cards = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((match) => match[0])
  assert.ok(cards[0].includes('Manage Test Company'))
  assert.ok(!cards[0].includes('Manage Second Company'))
  assert.ok(cards[1].includes('Manage Second Company'))
})

test('company contact links encode special characters in the actual email', () => {
  const html = render(h(CompanyList, { ...listProps, companies: [{ ...company, contactEmail: 'office+training@example.com' }] }))
  assert.match(html, /href="mailto:office%2Btraining%40example.com"/)
  assert.match(html, /office\+training@example.com/)
})

test('saved raw representative IDs resolve to real names and inactive accounts stay visible', () => {
  const html = render(h(CompanyList, { ...listProps, companies: [{ ...company, representative: representative.id }], representatives: [{ ...representative, isActive: false }] }))
  assert.match(html, /Test Representative/)
  assert.match(html, /rep@example.com/)
  assert.match(html, /Inactive account/)
  assert.match(html, new RegExp(representative.id))
})

test('deleted representatives and failed lookups never invent names or hide the saved link', () => {
  for (const representativesUnavailable of [false, true]) {
    const html = render(h(CompanyList, { ...listProps, companies: [{ ...company, representative: representative.id }], representatives: [], representativesUnavailable }))
    assert.match(html, representativesUnavailable ? /Representative details unavailable/ : /Representative account unavailable/)
    assert.match(html, new RegExp(representative.id))
    assert.doesNotMatch(html, /Test Representative|Not assigned/)
  }
})

test('loading, errors and empty company pages hide stale records and retain a way back', () => {
  const loading = render(h(CompanyList, { ...listProps, loading: true }))
  assert.match(loading, /Loading companies/)
  assert.doesNotMatch(loading, /Test Company|office@example.com|No companies yet/)
  const error = render(h(CompanyList, { ...listProps, error: '<failure>' }))
  assert.match(error, /&lt;failure&gt;/)
  assert.match(error, /Retry/)
  assert.doesNotMatch(error, /Test Company|<failure>/)
  assert.match(render(h(CompanyList, { ...listProps, companies: [] })), /No companies yet/)
  const later = render(h(CompanyList, { ...listProps, companies: [], page: 2 }))
  assert.match(later, /No companies on this page/)
  assert.doesNotMatch(later.match(/<button[^>]*aria-label="Previous page"[^>]*>/)[0], /disabled/)
})

test('a shared write lock disables refresh and pagination without hiding company details', () => {
  const html = render(h(CompanyList, { ...listProps, page: 2, disabled: true }))
  assert.match(html, /Test Company/)
  assert.equal((html.match(/disabled=""/g) || []).length, 3)
  assert.match(html, /aria-busy="true"/)
})

test('company refresh/retry and page buttons only call explicit supplied actions', () => {
  let refreshes = 0
  const pages = []
  const tree = CompanyList({ ...listProps, page: 2, error: 'Unavailable', onRefresh() { refreshes += 1 }, onPageChange(page) { pages.push(page) } })
  for (const button of nodes(tree, 'button')) button.props.onClick()
  assert.equal(refreshes, 2)
  assert.deepEqual(pages, [1, 3])
})

test('company and representative text wraps and remains escaped in both existing themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(CompanyList, { ...listProps, companies: [{ ...company, name: '<script>bad()</script>' + 'A'.repeat(100),
      address: '<img src=x>' + 'A'.repeat(200), representative: representative.id }], representatives: [{ ...representative, name: '<script>rep()</script>' }] }), { theme })
    assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /&lt;script&gt;rep\(\)&lt;\/script&gt;/)
    assert.match(html, /break-words/)
    assert.match(html, /break-all/)
    assert.match(html, /min-w-0/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('only admin navigation includes Companies and the navbar identifies its route', () => {
  const html = render(h(Sidebar))
  assert.match(html, /href="\/admin\/companies"/)
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Companies<\/li>/)
  for (const role of ['student', 'academic_supervisor', 'company_representative']) assert.doesNotMatch(render(h(Sidebar), { role }), /href="\/admin\/companies"/)
})

test('Companies initially shows a blank disabled form and separate loading states without fake data', () => {
  const html = render(h(Companies))
  assert.match(html, /New company/)
  assert.match(html, /Loading companies/)
  assert.match(html, /Loading representatives/)
  assert.match(html, /id="new-company-heading"[\s\S]*id="companies-heading"/)
  assert.match(html, /fieldset[^>]*disabled=""/)
  assert.doesNotMatch(html, /office@example.com|Test Company|created successfully|admin-token/)
})

test('company page queries and account/token changes use the existing keyed workspace scope', () => {
  function Probe() {
    const session = useContext(AuthContext)
    const element = Companies()
    assert.equal(element.key, `${session.user.id}:${session.token}:${element.props.page}`)
    return h('p', null, `Page ${element.props.page}`)
  }
  assert.match(render(h(Probe), { path: '/admin/companies?page=3' }), /Page 3/)
  for (const page of ['0', '-1', '1.5', 'abc', '1000001']) assert.match(render(h(Probe), { path: `/admin/companies?page=${page}` }), /Page 1/)
})

test('the registered Companies route blocks other roles and missing sessions', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/admin/companies')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'admin')
  assert.equal(route.props.element.props.children.type, Companies)
  function Probe() { return ProtectedRoute({ requiredRole: 'admin', children: h('p', null, 'Private companies') }) }
  assert.match(render(h(Probe)), /Private companies/)
  for (const options of [{ role: 'student' }, { role: 'academic_supervisor' }, { role: 'company_representative' }, { role: null, token: null }, { token: null }]) {
    assert.doesNotMatch(render(h(Probe), options), /Private companies/)
  }
})
