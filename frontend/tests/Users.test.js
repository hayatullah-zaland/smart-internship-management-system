import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, UserForm, UserList, UserStatusForm, UserStatusFields, UserActions, Users, Sidebar, Navbar, ProtectedRoute, App, AuthContext, ThemeContext
const account = { id: '507f1f77bcf86cd799439011', name: 'Test Teacher', email: 'teacher@example.com', role: 'academic_supervisor', isActive: true, createdAt: '2026-11-16T22:00:00.000Z' }
const values = { name: '', email: '', role: '', password: '', confirmPassword: '' }
const formProps = { values, errors: {}, disabled: false, saving: false, showPassword: false, onTogglePassword() {}, onChange() {}, onSubmit() {} }
const listProps = { users: [account], page: 1, hasNextPage: true, loading: false, error: '', disabled: false, onRefresh() {}, onPageChange() {} }
const statusProps = { id: 'access-one', account, isActive: true, disabled: false, saving: false, onChange() {}, onSubmit() {}, onCancel() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  UserForm = (await server.ssrLoadModule('/src/components/UserForm.jsx')).default
  UserList = (await server.ssrLoadModule('/src/components/UserList.jsx')).default
  const statusModule = await server.ssrLoadModule('/src/components/UserStatusForm.jsx')
  UserStatusForm = statusModule.default
  UserStatusFields = statusModule.UserStatusFields
  UserActions = (await server.ssrLoadModule('/src/components/UserActions.jsx')).default
  Users = (await server.ssrLoadModule('/src/pages/Users.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  App = (await server.ssrLoadModule('/src/App.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'admin', token = 'admin-token', path = '/admin/users', theme = 'light' } = {}) {
  const user = role ? { id: '507f1f77bcf86cd799439099', name: 'Test Admin', role, email: 'admin@example.com' } : null
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return []
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('new account form has labelled identity, role and matching-password fields without default privileges', () => {
  const html = render(h(UserForm, formProps))
  assert.equal((html.match(/<label /g) || []).length, 5)
  for (const name of ['name', 'email', 'role', 'password', 'confirmPassword']) assert.match(html, new RegExp(`name="${name}"`))
  assert.match(html, /minLength="2" maxLength="100"/)
  assert.match(html, /type="email"[^>]*maxLength="254"/)
  assert.match(html, /value="" disabled="" selected="">Choose a role/)
  for (const role of ['student', 'academic_supervisor', 'company_representative', 'admin']) assert.match(html, new RegExp(`value="${role}"`))
  assert.equal((html.match(/type="password"/g) || []).length, 2)
  assert.equal((html.match(/autoComplete="new-password"/g) || []).length, 2)
  assert.doesNotMatch(html, /name="isActive"|name="id"|Account created|administrator access/)
})

test('password visibility is explicit and selecting admin exposes the privilege warning', () => {
  const html = render(h(UserForm, { ...formProps, values: { ...values, role: 'admin' }, showPassword: true }))
  assert.match(html, /Hide passwords/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /This account will have administrator access/)
  assert.doesNotMatch(html, /type="password"/)
})

test('form errors are accessible and saving or shared locks disable all account writes', () => {
  const html = render(h(UserForm, { ...formProps, errors: { email: '<invalid>' }, saving: true }))
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /fieldset[^>]*disabled=""/)
  assert.match(html, /aria-invalid="true" aria-describedby="user-email-error"/)
  assert.match(html, /&lt;invalid&gt;/)
  assert.match(html, /Creating/)
  assert.match(render(h(UserForm, { ...formProps, disabled: true })), /fieldset[^>]*disabled=""/)
})

test('changing fields and revealing passwords have separate callbacks from explicit creation', () => {
  let changes = 0, toggles = 0, submits = 0
  const tree = UserForm({ ...formProps, onChange() { changes += 1 }, onTogglePassword() { toggles += 1 }, onSubmit() { submits += 1 } })
  for (const input of nodes(tree, 'input')) input.props.onChange({ target: { name: input.props.name, value: 'test' } })
  nodes(tree, 'select')[0].props.onChange({ target: { name: 'role', value: 'academic_supervisor' } })
  nodes(tree, 'button').find((node) => node.props.type === 'button').props.onClick()
  assert.equal(changes, 5)
  assert.equal(toggles, 1)
  assert.equal(submits, 0)
  nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(submits, 1)
})

test('saved account access uses an accessible switch without an automatic write or initial confirmation', () => {
  const html = render(h(UserStatusForm, { account, onSave() {} }))
  assert.match(html, /role="switch"/)
  assert.match(html, /Active account for Test Teacher/)
  assert.match(html, /checked=""/)
  assert.doesNotMatch(html, /Deactivate Test Teacher\?|type="submit"|Cancel status change/)
})

test('activation and deactivation each require a named confirmation with separate cancel and submit callbacks', () => {
  for (const isActive of [true, false]) {
    const saved = { ...account, isActive: !isActive }
    const html = render(h(UserStatusFields, { ...statusProps, account: saved, isActive }))
    assert.match(html, new RegExp(`${isActive ? 'Activate' : 'Deactivate'} Test Teacher\\?`))
    assert.match(html, /aria-describedby="access-one-confirmation"/)
    assert.match(html, /type="submit"/)
    assert.match(html, /Cancel status change/)
  }
  let changes = 0, saves = 0, cancels = 0
  const tree = UserStatusFields({ ...statusProps, isActive: false, onChange() { changes += 1 }, onSubmit() { saves += 1 }, onCancel() { cancels += 1 } })
  nodes(tree, 'input')[0].props.onChange({ target: { checked: false } })
  assert.equal(changes, 1)
  assert.equal(saves, 0)
  nodes(tree, 'button').find((node) => node.props.type === 'button').props.onClick()
  assert.equal(cancels, 1)
  nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(saves, 1)
})

test('admin account access is protected and never offers a switch or status command', () => {
  for (const isActive of [true, false]) {
    const html = render(h(UserStatusForm, { account: { ...account, role: 'admin', isActive }, onSave() {} }))
    assert.match(html, /Administrator access protected/)
    assert.doesNotMatch(html, /<input|<form|<button/)
  }
})

test('pending status changes disable switches and confirmation commands while retaining the target', () => {
  const html = render(h(UserStatusFields, { ...statusProps, isActive: false, saving: true }))
  assert.match(html, /aria-busy="true"/)
  assert.equal((html.match(/disabled=""/g) || []).length, 3)
  assert.match(html, /Deactivate Test Teacher\?/)
  assert.match(html, /Saving/)
})

test('registered users show real roles, saved status and Kabul join dates without editing identity or roles', () => {
  const html = render(h(UserList, { ...listProps, renderActions: (value) => h(UserStatusForm, { account: value, onSave() {} }) }))
  assert.match(html, /Test Teacher/)
  assert.match(html, /teacher@example.com/)
  assert.match(html, /Academic supervisor/)
  assert.match(html, /Saved status: Active/)
  assert.match(html, /dateTime="2026-11-16T22:00:00.000Z">Nov 17, 2026 Kabul/)
  assert.doesNotMatch(html, /Delete|Edit user|name="role"|passwordHash/)
})

test('non-admin rows expose named edit/delete icons without writing or confirming on render', () => {
  const html = render(h(UserActions, { account, onSaveStatus() {}, onUpdate() {}, onDelete() {} }))
  assert.match(html, /aria-label="Edit user Test Teacher"/)
  assert.match(html, /aria-label="Delete user Test Teacher"/)
  assert.match(html, /Active account for Test Teacher/)
  assert.doesNotMatch(html, /Permanently delete|Save changes|name="password"|name="role"/)
})

test('administrator rows never offer edit, delete or status-changing controls', () => {
  const html = render(h(UserActions, { account: { ...account, role: 'admin' }, onSaveStatus() {}, onUpdate() {}, onDelete() {} }))
  assert.match(html, /Administrator access protected/)
  assert.doesNotMatch(html, /<button|<input|<form/)
})

test('loading, error and empty pages hide stale identities and never fabricate records or totals', () => {
  const loading = render(h(UserList, { ...listProps, loading: true }))
  assert.match(loading, /Loading users/)
  assert.doesNotMatch(loading, /Test Teacher|teacher@example.com|No users yet/)
  const error = render(h(UserList, { ...listProps, error: '<server failure>' }))
  assert.match(error, /&lt;server failure&gt;/)
  assert.match(error, /Retry/)
  assert.doesNotMatch(error, /Test Teacher|<server failure>/)
  assert.match(render(h(UserList, { ...listProps, users: [] })), /No users yet/)
  const later = render(h(UserList, { ...listProps, users: [], page: 2 }))
  assert.match(later, /No users on this page/)
  assert.doesNotMatch(later.match(/<button[^>]*aria-label="Previous page"[^>]*>/)[0], /disabled/)
})

test('pending writes lock pagination and refresh while keeping actual account information visible', () => {
  const html = render(h(UserList, { ...listProps, page: 2, disabled: true }))
  assert.match(html, /Test Teacher/)
  assert.equal((html.match(/disabled=""/g) || []).length, 3)
  assert.match(html, /aria-busy="true"/)
})

test('refresh, retry and pagination only forward explicit supplied callbacks', () => {
  let refreshes = 0
  const pages = []
  const tree = UserList({ ...listProps, page: 2, error: 'Unavailable', onRefresh() { refreshes += 1 }, onPageChange(page) { pages.push(page) } })
  for (const button of nodes(tree, 'button')) button.props.onClick()
  assert.equal(refreshes, 2)
  assert.deepEqual(pages, [1, 3])
})

test('long account text and status confirmations wrap and escape HTML in both themes', () => {
  const unsafe = { ...account, name: '<script>bad()</script>' + 'A'.repeat(70), email: '<img src=x>@example.com' }
  for (const theme of ['light', 'dark']) {
    const html = render(h(UserList, { ...listProps, users: [unsafe], renderActions: (value) => h(UserStatusFields, { ...statusProps, account: value, isActive: false }) }), { theme })
    assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /min-w-0/)
    assert.match(html, /break-all/)
    assert.match(html, /break-words/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('only admin navigation includes Users and its breadcrumb identifies the route', () => {
  const html = render(h(Sidebar))
  assert.match(html, /href="\/admin\/users"/)
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  assert.match(render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false })), /aria-current="location">Users<\/li>/)
  for (const role of ['student', 'academic_supervisor', 'company_representative']) {
    assert.doesNotMatch(render(h(Sidebar), { role }), /href="\/admin\/users"/)
  }
})

test('users page keeps the blank create form available while the directory loads', () => {
  const html = render(h(Users))
  assert.match(html, /Administration/)
  assert.match(html, /New user/)
  assert.match(html, /Loading users/)
  assert.doesNotMatch(html, /fieldset[^>]*disabled=""/)
  assert.doesNotMatch(html, /teacher@example.com|Account created|admin-token/)
})

test('page query validation and account scope follow the existing keyed workspace pattern', () => {
  function ScopeProbe() {
    const session = useContext(AuthContext)
    const element = Users()
    assert.equal(element.key, `${session.user.id}:${session.token}:${element.props.page}`)
    return h('p', null, `Selected page ${element.props.page}`)
  }
  assert.match(render(h(ScopeProbe), { path: '/admin/users?page=3' }), /Selected page 3/)
  for (const page of ['0', '-1', '1.5', 'abc', '1000001']) {
    assert.match(render(h(ScopeProbe), { path: `/admin/users?page=${page}` }), /Selected page 1/)
  }
})

test('the actual Users route is admin-only and rejects every other role or missing session', () => {
  const route = App().props.children.find((entry) => entry.props.path === '/admin/users')
  assert.ok(route)
  assert.equal(route.props.element.type, ProtectedRoute)
  assert.equal(route.props.element.props.requiredRole, 'admin')
  assert.equal(route.props.element.props.children.type, Users)
  function GuardProbe() {
    return ProtectedRoute({ requiredRole: 'admin', children: h('p', null, 'Private users') })
  }
  assert.match(render(h(GuardProbe)), /Private users/)
  for (const options of [{ role: 'student' }, { role: 'academic_supervisor' }, { role: 'company_representative' }, { role: null, token: null }, { token: null }]) {
    assert.doesNotMatch(render(h(GuardProbe), options), /Private users/)
  }
})
