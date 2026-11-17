import { apiRequest } from './apiRequest.js'
import { fetchInternships } from './internshipApi.js'

export const DAILY_REPORT_ROLES = ['admin', 'student', 'academic_supervisor']
export const DAILY_REPORT_PAGE_SIZE = 10
export const MAX_DAILY_REPORT_PAGE = 1000000
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const isTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isText = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max && (!required || Boolean(value.trim()))
const canEdit = (report) => ['draft', 'changes_requested'].includes(report?.status) && isId(report.internship?._id) && report.internship.status === 'active'

function isCalendarDate(value) {
  // Report and placement dates are calendar days in UTC, not Kabul timestamps.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function content(values) {
  return { hours: Number(values.hours), tasks: values.tasks.trim(), learning: values.learning.trim(), challenges: (values.challenges || '').trim() }
}

export function validateDailyReport(values, internship, today = new Date().toISOString().slice(0, 10)) {
  const errors = {}
  if (!isId(internship?._id) || internship.status !== 'active') errors.internshipId = 'Choose an active internship.'
  if (!isCalendarDate(values?.date) || values.date > today) errors.date = 'Enter a valid report date, not in the future (UTC).'
  else if (internship && (values.date < internship.startDate?.slice(0, 10) || values.date > internship.endDate?.slice(0, 10))) {
    errors.date = 'Report date must fall within the internship dates.'
  }
  const hours = values?.hours
  if (!['number', 'string'].includes(typeof hours) || String(hours).trim() === '' || !Number.isFinite(Number(hours)) || Number(hours) < 0.25 || Number(hours) > 24) {
    errors.hours = 'Enter hours between 0.25 and 24.'
  }
  if (!isText(values?.tasks, 5000, true)) errors.tasks = 'Enter tasks using 1 to 5000 characters.'
  if (!isText(values?.learning, 3000, true)) errors.learning = 'Enter learning using 1 to 3000 characters.'
  if (values?.challenges !== undefined && !isText(values.challenges, 2000)) errors.challenges = 'Use at most 2000 characters for challenges.'
  return errors
}

function isReport(report) {
  return isId(report?._id) && ['draft', 'submitted', 'approved', 'changes_requested'].includes(report.status)
    && typeof report.date === 'string' && isCalendarDate(report.date.slice(0, 10)) && report.date === `${report.date.slice(0, 10)}T00:00:00.000Z`
    && typeof report.hours === 'number' && Number.isFinite(report.hours) && report.hours >= 0.25 && report.hours <= 24
    && isText(report.tasks, 5000, true) && isText(report.learning, 3000, true) && isText(report.challenges, 2000)
    && isText(report.feedback, 1000) && (report.submittedAt === null || isTime(report.submittedAt))
    && (report.reviewedBy === null || isId(report.reviewedBy)) && (report.reviewedAt === null || isTime(report.reviewedAt))
    && (report.status === 'draft' || isTime(report.submittedAt))
    && (!['approved', 'changes_requested'].includes(report.status) || (isId(report.reviewedBy) && isTime(report.reviewedAt)))
    && (report.status !== 'changes_requested' || Boolean(report.feedback.trim()))
}

function isPopulatedReport(report) {
  const person = report.student
  const placement = report.internship
  return (person === null || (isId(person?._id) && isText(person.name, 100, true) && isText(person.email, 254, true)))
    && (placement === null || (isId(placement?._id) && ['assigned', 'active', 'completed', 'cancelled'].includes(placement.status)
      && isTime(placement.startDate) && isTime(placement.endDate) && Date.parse(placement.endDate) > Date.parse(placement.startDate)))
}

export async function fetchDailyReports(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_DAILY_REPORT_PAGE) throw new Error('Choose a valid reports page.')
  const result = await apiRequest(`/api/v1/daily-reports?page=${page}&limit=${DAILY_REPORT_PAGE_SIZE}`, token, { signal })
  const reports = result.data?.reports
  if (!Array.isArray(reports) || result.data.page !== page || result.data.limit !== DAILY_REPORT_PAGE_SIZE
    || reports.length > DAILY_REPORT_PAGE_SIZE || reports.some((report) => !isReport(report) || !isPopulatedReport(report))
    || new Set(reports.map((report) => report._id)).size !== reports.length) {
    throw new Error('The server returned invalid daily report data. Please try again.')
  }
  return { reports, hasNextPage: reports.length === DAILY_REPORT_PAGE_SIZE && page < MAX_DAILY_REPORT_PAGE }
}

export async function fetchReportInternships(token, signal) {
  const active = new Map()
  for (let page = 1; ; page += 1) {
    const result = await fetchInternships(token, page, signal)
    for (const internship of result.internships) if (internship.status === 'active') active.set(internship._id, internship)
    if (!result.hasNextPage) return [...active.values()]
  }
}

export async function saveDailyReport(token, internship, values, report = null, signal) {
  if (report && (!isId(report._id) || !canEdit(report) || report.internship._id !== internship?._id || report.date?.slice(0, 10) !== values?.date)) {
    throw new Error('Only drafts or reports needing changes from an active internship can be edited. Refresh reports.')
  }
  const errors = validateDailyReport(values, internship)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const fields = content(values)
  const result = await apiRequest(report ? `/api/v1/daily-reports/${report._id}` : '/api/v1/daily-reports', token, {
    method: report ? 'PATCH' : 'POST', values: report ? fields : { internshipId: internship._id, date: values.date, ...fields }, signal,
  })
  const saved = result.data?.report
  if (!isReport(saved) || !isId(saved.student) || saved.internship !== internship._id || saved.date !== `${values.date}T00:00:00.000Z`
    || saved.status !== (report?.status || 'draft') || (report && (saved._id !== report._id || saved.student !== report.student?._id))
    || Object.entries(fields).some(([key, value]) => saved[key] !== value)) {
    throw new Error('The saved report could not be confirmed. Refresh reports before trying again.')
  }
  return saved
}

export async function submitDailyReport(token, report, signal) {
  if (!isId(report?._id) || !canEdit(report)) throw new Error('Only drafts or reports needing changes from an active internship can be submitted.')
  const result = await apiRequest(`/api/v1/daily-reports/${report._id}/submit`, token, { method: 'POST', signal })
  const saved = result.data?.report
  if (!isReport(saved) || saved._id !== report._id || saved.status !== 'submitted' || saved.internship !== report.internship._id
    || !isId(saved.student) || saved.student !== report.student?._id || saved.date !== report.date) {
    throw new Error('Submission could not be confirmed. Refresh reports before trying again.')
  }
  return saved
}
