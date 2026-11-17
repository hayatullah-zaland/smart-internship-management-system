import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { createServer } from 'vite'

let server, DailyReportReviewForm, DailyReportReviewFields, DailyReportList, DailyReportsWorkspace, AuthContext, ThemeContext
const supervisorId = '507f1f77bcf86cd799439016'
const internship = { _id: '507f1f77bcf86cd799439017', supervisor: supervisorId, status: 'active', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-10-01T00:00:00.000Z' }
const report = { _id: '507f1f77bcf86cd799439018', internship, student: { _id: '507f1f77bcf86cd799439014', name: 'Student One', email: 'student@example.com' },
  date: '2026-01-02T00:00:00.000Z', hours: 7.5, tasks: 'Built a form.', learning: 'Learned validation.', challenges: '', status: 'submitted',
  submittedAt: '2026-01-03T10:00:00.000Z', reviewedBy: null, reviewedAt: null, feedback: '' }
const fieldDefaults = { id: 'review-test', values: { status: '', feedback: '' }, errors: {}, disabled: false, saving: false, onChange() {}, onSubmit() {} }
const listDefaults = { reports: [report], page: 1, hasNextPage: false, loading: false, error: '', onRefresh() {}, onPageChange() {} }

before(async () => {
  server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  const form = await server.ssrLoadModule('/src/components/DailyReportReviewForm.jsx')
  DailyReportReviewForm = form.default
  DailyReportReviewFields = form.DailyReportReviewFields
  DailyReportList = (await server.ssrLoadModule('/src/components/DailyReportList.jsx')).default
  DailyReportsWorkspace = (await server.ssrLoadModule('/src/pages/DailyReports.jsx')).DailyReportsWorkspace
  AuthContext = (await server.ssrLoadModule('/src/context/AuthContext.js')).AuthContext
  ThemeContext = (await server.ssrLoadModule('/src/context/ThemeContext.js')).ThemeContext
})
after(async () => { await server?.close() })
function render(element, { role = 'academic_supervisor', id = supervisorId, theme = 'light' } = {}) {
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/daily-reports'] },
    h(AuthContext.Provider, { value: { user: { id, name: 'Test User', email: 'user@example.com', role }, token: 'test-token', signOut() {} } },
      h(ThemeContext.Provider, { value: { theme, toggleTheme() {} } }, element))))
}
function fields(props = {}) { return render(h(DailyReportReviewFields, { ...fieldDefaults, ...props })) }
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return []
  return [...(tree.type === type ? [tree] : []), ...[tree.props?.children].flat(Infinity).flatMap((child) => nodes(child, type))]
}

test('review starts without a default decision and offers only approve or request changes', () => {
  const html = fields()
  assert.match(html, /Choose a decision/)
  assert.match(html, /value="approved"/)
  assert.match(html, /value="changes_requested"/)
  assert.match(html, /value="" disabled="" selected=""/)
  assert.doesNotMatch(html, /value="draft"|value="submitted"|value="rejected"|<textarea/)
})

test('requesting changes reveals labelled, required and bounded feedback without identity inputs', () => {
  const html = fields({ values: { status: 'changes_requested', feedback: 'Please add details.' } })
  assert.match(html, /for="review-test-feedback"/)
  assert.match(html, /name="feedback"[^>]*maxLength="1000" required=""/)
  assert.match(html, /Please add details/)
  assert.doesNotMatch(html, /name="student"|name="reviewedBy"|name="reviewedAt"|name="hours"/)
  assert.doesNotMatch(fields({ values: { status: 'approved', feedback: 'Retained draft feedback' } }), /<textarea|Retained draft feedback/)
})

test('validation messages are accessible and saving or the shared lock disables review fields', () => {
  const html = fields({ values: { status: 'changes_requested', feedback: '' }, saving: true,
    errors: { status: 'Choose a decision', feedback: '<script>Feedback required</script>' } })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /aria-describedby="review-test-feedback-error"/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /&lt;script&gt;Feedback required&lt;\/script&gt;/)
  assert.match(html, /Saving/)
  assert.match(fields({ disabled: true }), /type="submit" disabled=""/)
})

test('review form exists only for submitted reports and never shows a saved decision initially', () => {
  const html = render(h(DailyReportReviewForm, { report, onReview() {} }))
  assert.match(html, /Review report/)
  assert.match(html, /Save review/)
  assert.doesNotMatch(html, /Daily report approved|returned for changes/)
  for (const status of ['draft', 'approved', 'changes_requested', 'unknown']) assert.equal(render(h(DailyReportReviewForm, { report: { ...report, status }, onReview() {} })), '')
})

test('changing a decision never saves until the explicit form submit callback', () => {
  const calls = []
  const tree = DailyReportReviewFields({ ...fieldDefaults, onChange: (event) => calls.push(event.target.value), onSubmit: () => calls.push('save') })
  nodes(tree, 'select')[0].props.onChange({ target: { value: 'approved' } })
  assert.deepEqual(calls, ['approved'])
  tree.props.onSubmit()
  assert.deepEqual(calls, ['approved', 'save'])
})

test('each report review form has unique label and error target IDs', () => {
  const html = render(h('div', null, h(DailyReportReviewForm, { report, onReview() {} }), h(DailyReportReviewForm, { report, onReview() {} })))
  const ids = [...html.matchAll(/<select id="([^"]+)"/g)].map((match) => match[1])
  assert.equal(ids.length, 2)
  assert.notEqual(ids[0], ids[1])
  for (const id of ids) assert.ok(html.includes(`for="${id}"`))
})

test('review form follows the actual report content inside the report disclosure, not its summary', () => {
  const html = render(h(DailyReportList, { ...listDefaults, renderReview: (item) => h(DailyReportReviewForm, { report: item, onReview() {} }) }))
  assert.ok(html.indexOf('</summary>') < html.indexOf('Built a form.'))
  assert.ok(html.indexOf('Built a form.') < html.indexOf('Daily report review'))
  assert.ok(html.indexOf('</form>') < html.indexOf('</details>'))
  assert.doesNotMatch(html, /<details[^>]*\bopen=|Edit report|Submit report/)
})

test('only the assigned supervisor page supplies review controls; other roles stay read-only', () => {
  function PageProbe() {
    const tree = DailyReportsWorkspace({ page: 1, onPageChange() {} })
    const list = tree.props.children.find((child) => child?.type === DailyReportList)
    return h(DailyReportList, { ...listDefaults, renderReview: list.props.renderReview })
  }
  for (const role of ['student', 'admin', 'academic_supervisor', 'company_representative']) {
    const html = render(h(PageProbe), { role })
    assert.match(html, /Built a form/)
    if (role === 'academic_supervisor') assert.match(html, /Save review/)
    else assert.doesNotMatch(html, /Save review|Review report/)
  }
  assert.doesNotMatch(render(h(PageProbe), { id: report.student._id }), /Save review|Review report/)
})

test('review actions disappear for terminal/returned reports or deleted/reassigned internships', () => {
  let current
  function PageProbe() {
    const tree = DailyReportsWorkspace({ page: 1, onPageChange() {} })
    const list = tree.props.children.find((child) => child?.type === DailyReportList)
    return h(DailyReportList, { ...listDefaults, reports: [current], renderReview: list.props.renderReview })
  }
  for (const item of [{ ...report, status: 'draft' }, { ...report, status: 'approved' }, { ...report, status: 'changes_requested' },
    { ...report, internship: null }, { ...report, internship: { ...internship, supervisor: report.student._id } }]) {
    current = item
    assert.doesNotMatch(render(h(PageProbe)), /Save review|Review report/)
  }
  current = { ...report, internship: { ...internship, status: 'completed' } }
  assert.match(render(h(PageProbe)), /Save review/)
})

test('pending and reconciliation locks disable review without hiding report content', () => {
  const html = render(h(DailyReportList, { ...listDefaults, disabled: true,
    renderReview: (item) => h(DailyReportReviewForm, { report: item, disabled: true, saving: true, onReview() {} }) }))
  assert.match(html, /Built a form/)
  assert.match(html, /<fieldset disabled=""/)
  assert.match(html, /Saving/)
  assert.match(html, /disabled="" aria-label="Refresh daily reports"/)
  const reconciliation = render(h(DailyReportList, { ...listDefaults,
    renderReview: (item) => h(DailyReportReviewForm, { report: item, disabled: true, onReview() {} }) }))
  assert.match(reconciliation, /<fieldset disabled=""/)
  assert.doesNotMatch(reconciliation, /disabled="" aria-label="Refresh daily reports"/)
})

test('feedback is escaped and uses responsive semantic theme styles', () => {
  for (const theme of ['light', 'dark']) {
    const html = render(h(DailyReportReviewFields, { ...fieldDefaults, values: { status: 'changes_requested', feedback: '<script>unsafe</script>\n' + 'A'.repeat(900) } }), { theme })
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/)
    assert.match(html, /w-full min-w-0/)
    assert.doesNotMatch(html, /<script>|bg-white|text-black|rounded-2xl/)
  }
})
