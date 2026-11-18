import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, OpportunityForm, OpportunityList, Opportunities, OpportunitiesWorkspace, OpportunityApply, AuthContext, ThemeContext
const values = { companyId: '', title: '', description: '', deadline: '', capacity: '' }
const props = { values, errors: {}, disabled: false, saving: false, onChange() {}, onSubmit() {} }
const opportunity = { _id: '507f1f77bcf86cd799439011', title: 'Frontend Intern', description: 'Build university tools.',
  company: { _id: '507f1f77bcf86cd799439012', name: 'Test Company', address: 'Kabul' }, deadline: '2027-01-31T19:29:00.000Z', capacity: 3, status: 'open' }
const listProps = { opportunities: [opportunity], page: 2, hasNextPage: true, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  OpportunityForm = (await server.ssrLoadModule('/src/components/OpportunityForm.jsx')).default
  OpportunityList = (await server.ssrLoadModule('/src/components/OpportunityList.jsx')).default
  const page = await server.ssrLoadModule('/src/pages/Opportunities.jsx')
  Opportunities = page.default
  OpportunitiesWorkspace = page.OpportunitiesWorkspace
  OpportunityApply = (await server.ssrLoadModule('/src/components/OpportunityApply.jsx')).default
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })

function render(element, { role = 'company_representative', token = 'test-token', path = '/opportunities', theme = 'light' } = {}) {
  const user = { id: '507f1f77bcf86cd799439099', name: 'Test User', email: 'test@example.com', role }
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(AuthContext.Provider, { value: { user, token, signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function nodes(node, type) {
  if (!node || typeof node !== 'object') return []
  return [...(node.type === type ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('publication form has five labelled fields, explicit Company ID and no unavailable company dropdown', () => {
  const tree = OpportunityForm(props)
  const html = render(h(OpportunityForm, props))
  assert.equal((html.match(/<label /g) || []).length, 5)
  const fields = [...nodes(tree, 'input'), ...nodes(tree, 'textarea')]
  assert.deepEqual(fields.map((field) => field.props.name).sort(), ['capacity', 'companyId', 'deadline', 'description', 'title'])
  assert.equal(fields.find((field) => field.props.name === 'companyId').props.maxLength, 24)
  assert.equal(fields.find((field) => field.props.name === 'title').props.maxLength, 150)
  assert.equal(fields.find((field) => field.props.name === 'description').props.maxLength, 5000)
  assert.doesNotMatch(html, /<select|name="createdBy"|name="status"|name="role"|Opportunity published/)
})

test('deadline is a minute-precision Kabul input and capacity uses bounded integer controls', () => {
  const fields = nodes(OpportunityForm(props), 'input')
  const deadline = fields.find((field) => field.props.name === 'deadline')
  assert.equal(deadline.props.type, 'datetime-local')
  assert.equal(deadline.props.step, 60)
  const capacity = fields.find((field) => field.props.name === 'capacity')
  assert.equal(capacity.props.type, 'number')
  assert.equal(capacity.props.min, 1)
  assert.equal(capacity.props.max, 1000)
  assert.equal(capacity.props.step, 1)
  assert.match(render(h(OpportunityForm, props)), /Deadline \(Kabul, UTC\+04:30\)/)
})

test('publication errors have accessible field targets and preserve the entered draft', () => {
  const html = render(h(OpportunityForm, { ...props, values: { ...values, title: 'My draft', description: '<draft text>' }, errors: { deadline: '<invalid time>', capacity: 'Whole numbers only' } }))
  assert.match(html, /value="My draft"/)
  assert.match(html, /&lt;draft text&gt;/)
  assert.match(html, /aria-invalid="true" aria-describedby="opportunity-deadline-error"/)
  assert.match(html, /&lt;invalid time&gt;/)
  assert.match(html, /id="opportunity-capacity-error"/)
})

test('pending publication and reconciliation locks disable editing and publishing without claiming success', () => {
  for (const changed of [{ saving: true }, { disabled: true }]) {
    const html = render(h(OpportunityForm, { ...props, ...changed }))
    assert.match(html, /fieldset[^>]*disabled=""/)
    assert.match(html.match(/<button[^>]*type="submit"[^>]*>/)[0], /disabled/)
    assert.doesNotMatch(html, /Opportunity published/)
  }
  assert.match(render(h(OpportunityForm, { ...props, saving: true })), /aria-busy="true"/)
  assert.match(render(h(OpportunityForm, { ...props, saving: true })), /Publishing/)
})

test('field changes never publish before the explicit form callback', () => {
  let changes = 0, submits = 0
  const tree = OpportunityForm({ ...props, onChange() { changes += 1 }, onSubmit() { submits += 1 } })
  for (const field of [...nodes(tree, 'input'), ...nodes(tree, 'textarea')]) field.props.onChange({ target: { name: field.props.name, value: 'test' } })
  assert.equal(changes, 5)
  assert.equal(submits, 0)
  nodes(tree, 'form')[0].props.onSubmit({ preventDefault() {} })
  assert.equal(submits, 1)
})

test('only representatives get a publishing form while all roles retain the original browsing list', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(Opportunities), { role })
    assert.match(html, /Loading opportunities/)
    if (role === 'company_representative') {
      assert.match(html, /New opportunity/)
      assert.match(html, /Publish opportunity/)
    } else assert.doesNotMatch(html, /New opportunity|Publish opportunity|Company ID/)
    assert.doesNotMatch(html, /test-token|Opportunity published/)
  }
})

test('student Apply actions remain student-only after adding publication', () => {
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    function Probe() {
      const tree = OpportunitiesWorkspace({ page: 1, onPageChange() {} })
      const list = nodes(tree, OpportunityList)[0]
      if (role === 'student') assert.equal(list.props.renderActions(opportunity).type, OpportunityApply)
      else assert.equal(list.props.renderActions, undefined)
      return h('p', null, 'Checked role')
    }
    assert.match(render(h(Probe), { role }), /Checked role/)
  }
})

test('pending publication locks refresh and all page controls while preserving actual records', () => {
  const html = render(h(OpportunityList, { ...listProps, disabled: true }))
  assert.match(html, /Frontend Intern/)
  assert.match(html, /aria-busy="true"/)
  assert.equal((html.match(/disabled=""/g) || []).length, 3)
  const failed = render(h(OpportunityList, { ...listProps, error: 'Unavailable', disabled: true }))
  assert.equal((failed.match(/disabled=""/g) || []).length, 4)
})

test('draft text remains escaped and constrained in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(OpportunityForm, { ...props, values: { ...values, title: '<script>bad()</script>', description: '<img src=x>' + 'A'.repeat(4900) } }), { theme })
    assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/)
    assert.match(html, /&lt;img src=x&gt;/)
    assert.match(html, /min-w-0/)
    assert.doesNotMatch(html, /<script>|<img|bg-white|text-black/)
  }
})

test('page, account and token scope remount the editor rather than reusing a previous draft', () => {
  function Probe() {
    const session = useContext(AuthContext)
    const element = Opportunities()
    assert.equal(element.key, `${session.user.id}:${session.token}:${element.props.page}`)
    return h('p', null, `Page ${element.props.page}`)
  }
  assert.match(render(h(Probe), { path: '/opportunities?page=3' }), /Page 3/)
  for (const page of ['0', '-1', '1.5', 'abc', '1000001']) assert.match(render(h(Probe), { path: `/opportunities?page=${page}` }), /Page 1/)
})
