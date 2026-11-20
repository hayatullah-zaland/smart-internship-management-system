import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import { getWorkspaceLinks, searchWorkspacePages } from '../src/components/workspaceNavigation.js'

let server, NavbarSearch, NavbarAccount
const roles = ['admin', 'student', 'academic_supervisor', 'company_representative']
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  NavbarSearch = (await server.ssrLoadModule('/src/components/NavbarSearch.jsx')).default
  NavbarAccount = (await server.ssrLoadModule('/src/components/NavbarAccount.jsx')).default
})
after(async () => { await server?.close() })
const render = (element) => renderToStaticMarkup(h(MemoryRouter, null, element))

test('shared navigation preserves all role destinations and keeps Settings in the footer', () => {
  for (const [role, count] of [['admin', 13], ['student', 10], ['academic_supervisor', 7], ['company_representative', 5]]) {
    const links = getWorkspaceLinks(role)
    assert.equal(links.length, count)
    assert.equal(new Set(links.map((link) => link.to)).size, count)
    assert.deepEqual(links.filter((link) => link.footer).map((link) => link.to), ['/settings'])
    assert.ok(links.every((link) => link.Icon && link.roles.includes(role)))
    if (role !== 'admin') assert.ok(links.every((link) => !link.to.startsWith('/admin/') && link.to !== '/departments'))
  }
  for (const role of [null, 'owner', '__proto__', 'toString']) assert.deepEqual(getWorkspaceLinks(role), [])
})

test('page search is case-insensitive, matches all words and includes useful settings/report aliases', () => {
  for (const role of roles) {
    assert.deepEqual(searchWorkspacePages(role, '  PASSword  ').map((link) => link.to), ['/settings'])
    assert.deepEqual(searchWorkspacePages(role, 'DARK THEME').map((link) => link.to), ['/settings'])
  }
  assert.equal(searchWorkspacePages('student', 'daily feedback')[0].to, '/daily-reports')
  assert.equal(searchWorkspacePages('admin', 'company directory')[0].to, '/admin/companies')
  assert.equal(searchWorkspacePages('student', 'academic student')[0].to, '/profile')
  assert.deepEqual(searchWorkspacePages('company_representative', 'daily reports'), [])
})

test('search results are bounded, prioritize matching page titles and never include inaccessible routes', () => {
  for (const role of roles) {
    const allowed = getWorkspaceLinks(role).map((link) => link.to)
    for (const query of ['a', 'e', 'company', 'student', 'teacher', 'profile', 'report']) {
      const matches = searchWorkspacePages(role, query)
      assert.ok(matches.length <= 8)
      assert.ok(matches.every((link) => allowed.includes(link.to)))
    }
  }
  assert.equal(searchWorkspacePages('admin', 'companies')[0].to, '/admin/companies')
  assert.deepEqual(searchWorkspacePages('student', 'users'), [])
  for (const query of ['', '  ', null, 123, '<script>bad</script>']) assert.deepEqual(searchWorkspacePages('admin', query), [])
})

test('the search starts empty with a named combobox and no fabricated records or open results', () => {
  const html = render(h(NavbarSearch, { role: 'student' }))
  assert.match(html, /role="search" aria-label="Workspace pages"/)
  assert.match(html, /Search workspace pages/)
  assert.match(html, /role="combobox"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /maxLength="80"/)
  assert.match(html, /value=""/)
  assert.doesNotMatch(html, /role="listbox"|No matching pages|Clear search|Search all records/)
})

test('navbar identity shows friendly roles, the full accessible name and a working own-account link', () => {
  for (const [role, label] of [['student', 'Student'], ['admin', 'Administrator'], ['academic_supervisor', 'Academic supervisor'], ['company_representative', 'Company representative']]) {
    const html = render(h(NavbarAccount, { user: { name: 'Test <User>', role } }))
    assert.match(html, /href="\/account"/)
    assert.match(html, /aria-label="Open my account"/)
    assert.match(html, /aria-describedby="navbar-account-identity"/)
    assert.ok(html.includes(`Test &lt;User&gt;, ${label}`))
    assert.match(html, /truncate/)
    assert.doesNotMatch(html, /Online|Verified|academic_supervisor|company_representative/)
  }
})
