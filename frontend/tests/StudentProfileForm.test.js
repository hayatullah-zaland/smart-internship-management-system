import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server
let StudentProfileForm
let StudentProfile
let Sidebar
let Navbar
let ProtectedRoute
let AuthContext
let ThemeContext

const department = { _id: '507f1f77bcf86cd799439011', name: 'Computer Science', code: 'CS' }
const profile = { studentNumber: 'STU-001', departmentId: department._id, semester: 4, phone: '+93 700 123 456' }
const user = { id: 'student-id', name: 'Test Student', email: 'student@example.com', role: 'student' }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  StudentProfileForm = (await server.ssrLoadModule('/src/components/StudentProfileForm.jsx')).default
  StudentProfile = (await server.ssrLoadModule('/src/pages/StudentProfile.jsx')).default
  Sidebar = (await server.ssrLoadModule('/src/components/Sidebar.jsx')).default
  Navbar = (await server.ssrLoadModule('/src/components/Navbar.jsx')).default
  ProtectedRoute = (await server.ssrLoadModule('/src/components/ProtectedRoute.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'student', token = 'test-token', path = '/profile', theme = 'light' } = {}) {
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user: role ? { ...user, role } : null, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}

test('new profile has four labelled academic fields and actual department options', () => {
  const html = render(h(StudentProfileForm, { profile: null, departments: [department] }))
  for (const name of ['studentNumber', 'departmentId', 'semester', 'phone']) {
    assert.match(html, new RegExp(`name="${name}"`))
  }
  assert.equal((html.match(/<label /g) || []).length, 4)
  assert.match(html, /Computer Science \(CS\)/)
  assert.match(html, /min="1" max="12" step="1"/)
  assert.match(html, /type="tel"/)
  assert.match(html, /Save profile/)
  assert.match(html, /Reset changes/)
  assert.doesNotMatch(html, /name="user"|name="role"|name="password"|Profile saved successfully/)
})

test('existing profile fills every field and has no fake success state', () => {
  const html = render(h(StudentProfileForm, { profile, departments: [department] }))
  assert.match(html, /value="STU-001"/)
  assert.match(html, /value="4"/)
  assert.match(html, /value="\+93 700 123 456"/)
  assert.match(html, new RegExp(`value="${department._id}" selected=""`))
  assert.match(html, /type="submit" disabled=""/)
  assert.doesNotMatch(html, /role="status"|Profile saved successfully/)
})

test('a saved student number and department are editable with available department choices', () => {
  const anotherDepartment = { _id: '507f1f77bcf86cd799439022', name: 'Engineering', code: 'ENG' }
  const html = render(h(StudentProfileForm, { profile, departments: [department, anotherDepartment] }))
  assert.doesNotMatch(html, /<fieldset disabled=""/)
  const numberInput = html.match(/<input\b[^>]*name="studentNumber"[^>]*>/)[0]
  const departmentSelect = html.match(/<select\b[^>]*name="departmentId"[^>]*>/)[0]
  assert.doesNotMatch(numberInput, /disabled|readOnly/)
  assert.doesNotMatch(departmentSelect, /disabled/)
  assert.match(html, /Engineering \(ENG\)/)
  assert.match(html, /aria-label="Refresh departments"/)
})

test('without departments personal fields remain editable while department selection and saving wait', () => {
  const html = render(h(StudentProfileForm, { profile: null, departments: [] }))
  assert.match(html, /No departments available/)
  assert.match(html, /contact your administrator/)
  assert.match(html, /Refresh departments/)
  assert.doesNotMatch(html, /<fieldset disabled=""/)
  const inputs = html.match(/<input\b[^>]*>/g)
  assert.equal(inputs.length, 3)
  for (const input of inputs) assert.doesNotMatch(input, /disabled|readOnly/)
  assert.match(html, /<select\b[^>]*disabled=""/)
  assert.match(html, /type="button" aria-label="Refresh departments"/)
  assert.match(html, /type="submit" disabled=""/)
  assert.equal((html.match(/<option /g) || []).length, 1)
})

test('a no-longer-listed saved department remains visibly unavailable', () => {
  const html = render(h(StudentProfileForm, {
    profile: { ...profile, departmentId: '507f1f77bcf86cd799439099' }, departments: [department],
  }))
  assert.match(html, /disabled="" selected="">Unavailable department/)
})

test('department names are escaped and both themes share the same semantic form', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(StudentProfileForm, {
      profile: null, departments: [{ ...department, name: '<script>alert(1)</script>' }],
    }), { theme })
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
    assert.doesNotMatch(html, /<script>/)
    assert.match(html, /border-base-300/)
    assert.match(html, /sm:grid-cols-2/)
  }
})

test('students see only My profile marked active on the profile page', () => {
  const html = render(h(Sidebar))
  assert.match(html, /href="\/profile"/)
  assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
  const activeLink = html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0]
  assert.match(activeLink, /href="\/profile"/)
})

test('other roles do not see the student profile link', () => {
  for (const role of ['admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Sidebar), { role, path: '/dashboard' })
    assert.doesNotMatch(html, /href="\/profile"|My profile/)
    assert.match(html, /href="\/dashboard"/)
  }
})

test('dashboard and account links keep one correct active state after adding profile', () => {
  for (const [path, href] of [['/dashboard', '/dashboard'], ['/account', '/account']]) {
    const html = render(h(Sidebar), { path })
    assert.equal((html.match(/aria-current="location"/g) || []).length, 1)
    const activeLink = html.match(/<a\b[^>]*aria-current="location"[^>]*>/)[0]
    assert.ok(activeLink.includes(`href="${href}"`))
  }
})

test('navbar breadcrumb identifies the student profile instead of Dashboard', () => {
  const html = render(h(Navbar, { onOpenSidebar() {}, sidebarOpen: false }))
  assert.match(html, /aria-current="location">My profile<\/li>/)
})

test('the profile initially shows loading and never embeds credentials in HTML', () => {
  const html = render(h(StudentProfile))
  assert.match(html, /Loading your profile/)
  assert.match(html, /student@example.com/)
  assert.doesNotMatch(html, /name="studentNumber"|test-token/)
})

test('the role guard prevents other roles and unauthenticated users from rendering profile content', () => {
  function GuardProbe() {
    // Read the real context before invoking the guard to inspect its redirect target.
    const session = useContext(AuthContext)
    const element = ProtectedRoute({ requiredRole: 'student', children: h('p', null, 'Private profile') })
    if (!session.user || !session.token) assert.equal(element.props.to, '/login')
    else if (session.user.role !== 'student') assert.equal(element.props.to, '/dashboard')
    return element
  }
  assert.match(render(h(GuardProbe)), /Private profile/)
  for (const options of [{ role: 'admin' }, { role: 'academic_supervisor' },
    { role: 'company_representative' }, { role: null, token: null }, { token: null }]) {
    assert.doesNotMatch(render(h(GuardProbe), options), /Private profile/)
  }
})
