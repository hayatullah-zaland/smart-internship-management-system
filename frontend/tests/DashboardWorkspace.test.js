import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'
import { dashboardFields } from '../src/context/dashboardApi.js'

let server, DashboardWorkspace
before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  DashboardWorkspace = (await server.ssrLoadModule('/src/components/DashboardWorkspace.jsx')).default
})
after(async () => { await server?.close() })

const allowed = {
  admin: ['/admin/students', '/admin/users', '/admin/companies', '/departments'],
  student: ['/applications', '/daily-reports', '/weekly-reports', '/profile'],
  academic_supervisor: ['/internships', '/daily-reports', '/evaluations', '/account'],
  company_representative: ['/opportunities', '/evaluations', '/account'],
}
const counters = (role, value) => Object.fromEntries(dashboardFields[role].map((key) => [key, value]))
function render(role, extra = {}) {
  return renderToStaticMarkup(h(MemoryRouter, null, h(DashboardWorkspace, {
    role, stats: counters(role, 0), loading: false, error: '', ...extra,
  })))
}

for (const role of Object.keys(allowed)) {
  test(`${role}: shortcuts point only to permitted pages`, () => {
    const html = render(role)
    assert.deepEqual([...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), allowed[role])
    assert.match(html, /Quick access/)
    assert.doesNotMatch(html, /\+\d+%|Last month|Recent activity|Completion rate/)
  })
  test(`${role}: real zero values keep empty bars and show an honest empty state`, () => {
    const html = render(role)
    assert.equal((html.match(/style="width:0%"/g) || []).length, 2)
    assert.match(html, /No (submitted reports\.|reports yet|active or completed internships yet)/)
    assert.doesNotMatch(html, /NaN|Infinity/)
  })
}

test('count bars compare actual values, not invented completion percentages', () => {
  const html = render('student', { stats: { ...counters('student', 0), dailyReports: 8, weeklyReports: 2 } })
  assert.match(html, /style="width:100%"/)
  assert.match(html, /style="width:25%"/)
  assert.match(html, />8<\/span>/)
  assert.match(html, />2<\/span>/)
  assert.match(html, /Your reports, all statuses/)
  assert.doesNotMatch(html, />25%|>100%|No reports yet/)
})

test('supervisor report counts do not offer a forbidden weekly report link', () => {
  const html = render('academic_supervisor', { stats: counters('academic_supervisor', 1) })
  assert.match(html, /Submitted weekly reports/)
  assert.match(html, /Your assigned internships/)
  assert.doesNotMatch(html, /href="\/weekly-reports"/)
  assert.match(render('academic_supervisor'), /No submitted reports\./)
  assert.doesNotMatch(render('academic_supervisor'), /No reports yet/)
})

test('loading and errors hide previous values but leave useful shortcuts available', () => {
  for (const extra of [{ loading: true }, { error: 'Unavailable' }]) {
    const html = render('admin', { stats: counters('admin', 123456), ...extra })
    assert.doesNotMatch(html, /123,456|width:100%|No active/)
    assert.match(html, /href="\/admin\/users"/)
    if (extra.error) assert.match(html, /Snapshot unavailable/)
  }
})

test('large exact values remain readable and bars keep finite widths', () => {
  const html = render('company_representative', { stats: counters('company_representative', Number.MAX_SAFE_INTEGER) })
  assert.match(html, /9,007,199,254,740,991/)
  assert.doesNotMatch(html, /NaN|Infinity/)
  assert.match(html, /Your represented companies/)
})
