import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, Account, AccountProfileForm, Navbar, ProfileAvatar, ProfileHeader, ProfileIdentity, AuthContext, ThemeContext
const user = { id: '507f1f77bcf86cd799439011', name: 'Test Account', email: 'account@example.com', role: 'student', isActive: true }
const photo = 'data:image/jpeg;base64,/9j/4AAC/9k='

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  Account = (await server.ssrLoadModule('/src/pages/Account.jsx')).default
  AccountProfileForm = (await server.ssrLoadModule('/src/components/AccountProfileForm.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProfileAvatar = (await server.ssrLoadModule('/src/components/ProfileAvatar.jsx')).default
  ProfileHeader = (await server.ssrLoadModule('/src/components/ProfileHeader.jsx')).default
  ProfileIdentity = (await server.ssrLoadModule('/src/components/ProfileIdentity.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, account = user, theme = 'light') {
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/account'] },
    h(AuthContext.Provider, { value: { user: account, token: 'private-account-token', signOut() {}, updateAccount() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}

test('all roles have their own editable account form without any role or password editor', () => {
  for (const role of ['admin', 'student', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Account), { ...user, role })
    assert.match(html, /My account/)
    assert.match(html, /name="name"/)
    assert.match(html, /name="email"/)
    assert.match(html, /type="file" accept="image\/jpeg,image\/png,image\/webp"/)
    assert.match(html, /Save account/)
    assert.doesNotMatch(html, /name="role"|name="password"|private-account-token/)
    assert.equal(html.includes('Academic profile'), role === 'student')
  }
})

test('unchanged details cannot be submitted and both themes use a responsive unframed form', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(AccountProfileForm), user, theme)
    assert.match(html, /type="submit" disabled=""/)
    assert.match(html, /sm:grid-cols-2/)
    assert.match(html, /Reset changes/)
  }
})

test('navbar photo links to My account and displays the saved image', () => {
  const html = render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }), { ...user, profileImage: photo })
  assert.match(html, /<a(?=[^>]*href="\/account")(?=[^>]*aria-label="Open my account")[^>]*>/)
  assert.ok(html.includes('src="' + photo + '"'))
  assert.match(html, /aria-current="location">My account<\/li>/)
})

test('missing or unsafe avatars fall back to a name initial instead of loading external content', () => {
  for (const profileImage of [undefined, '', 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=']) {
    const html = render(h(ProfileAvatar, { user: { ...user, profileImage } }))
    assert.match(html, />T<\/span>/)
    assert.doesNotMatch(html, /<img/)
  }
})

test('profile section links mark only the current student section and never offer fake views', () => {
  for (const academic of [false, true]) {
    const html = render(h(ProfileHeader, { user, academic }))
    assert.match(html, /aria-label="Profile sections"/)
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1)
    const current = html.match(/<a\b[^>]*aria-current="page"[^>]*>/)[0]
    assert.ok(current.includes('href="' + (academic ? '/profile' : '/account') + '"'))
    assert.doesNotMatch(html, /Verified|Security|Followers|Last login/)
  }
  for (const role of ['admin', 'academic_supervisor', 'company_representative']) {
    assert.doesNotMatch(render(h(ProfileHeader, { user: { ...user, role } })), /Profile sections|href="\/profile"/)
  }
})

test('the active badge comes from real account data and the identity safely wraps long values', () => {
  assert.match(render(h(ProfileHeader, { user })), /Active account/)
  assert.doesNotMatch(render(h(ProfileHeader, { user: { ...user, isActive: undefined } })), /Active account/)
  const html = render(h(ProfileIdentity, { user: { ...user, name: '<script>bad()</script>', email: 'long'.repeat(30) + '@example.com' } }))
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
  assert.match(html, /break-words/)
  assert.match(html, /break-all/)
  assert.match(html, /rounded-full/)
  assert.doesNotMatch(html, /<script>/)
})

test('photo and reset controls have explicit names, hints and a hidden native picker', () => {
  const html = render(h(AccountProfileForm))
  assert.match(html, /aria-label="Change profile photo"/)
  assert.match(html, /aria-label="Remove photo"/)
  assert.match(html, /aria-label="Reset changes"/)
  assert.match(html, /data-tip="Change profile photo"/)
  assert.match(html, /class="sr-only" tabindex="-1"/)
  assert.match(html, /aria-describedby="account-photo-hint"/)
  assert.doesNotMatch(html, /Unsaved changes|Account saved successfully/)
})
