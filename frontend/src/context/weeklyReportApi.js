import { apiRequest } from './apiRequest.js'

export const WEEKLY_REPORT_ROLES = ['admin', 'student']
export const WEEKLY_REPORT_PAGE_SIZE = 10
export const MAX_WEEKLY_REPORT_PAGE = 1000000
const DAY = 86400000
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const isTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isText = (value, max, required = false) => typeof value === 'string' && value.trim().length <= max && (!required || Boolean(value.trim()))
const isWeekNumber = (value) => Number.isInteger(value) && value >= 1 && value <= 10000
const toWeekNumber = (value) => ['number', 'string'].includes(typeof value) && String(value).trim() ? Number(value) : NaN

export function getWeeklyReportDates(internship, weekNumber) {
  const number = toWeekNumber(weekNumber)
  if (!isWeekNumber(number) || !isTime(internship?.startDate) || !isTime(internship?.endDate)) return null
  const start = Date.parse(internship.startDate)
  const end = Date.parse(internship.endDate)
  // Match the backend's placement-relative seven-day weeks, including a short final week.
  const weekStart = start + (number - 1) * 7 * DAY
  if (end <= start || weekStart > end) return null
  return { weekStart: new Date(weekStart).toISOString(), weekEnd: new Date(Math.min(weekStart + 6 * DAY, end)).toISOString() }
}

export function getStartedWeekCount(internship, today = new Date().toISOString().slice(0, 10)) {
  if (!getWeeklyReportDates(internship, 1) || typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 0
  const day = new Date(`${today}T00:00:00.000Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== today) return 0
  const latest = Math.min(Date.parse(internship.endDate), day.getTime() + DAY - 1)
  return Math.max(0, Math.min(10000, Math.floor((latest - Date.parse(internship.startDate)) / (7 * DAY)) + 1))
}

export function validateWeeklyReport(values, internship, today) {
  const errors = {}
  if (!isId(internship?._id) || internship.status !== 'active') errors.internshipId = 'Choose an active internship.'
  const number = toWeekNumber(values?.weekNumber)
  if (!isWeekNumber(number)) errors.weekNumber = 'Enter a whole week number between 1 and 10000.'
  else if (internship && number > getStartedWeekCount(internship, today)) errors.weekNumber = 'Choose a week within the internship that has already started (UTC).'
  if (!isText(values?.summary, 5000, true)) errors.summary = 'Enter a summary using 1 to 5000 characters.'
  if (!isText(values?.learning, 3000, true)) errors.learning = 'Enter learning using 1 to 3000 characters.'
  if (values?.challenges !== undefined && !isText(values.challenges, 2000)) errors.challenges = 'Use at most 2000 characters for challenges.'
  return errors
}

export function canEditWeeklyReport(report) {
  return isId(report?._id) && report.status === 'draft' && isId(report.internship?._id) && report.internship.status === 'active'
}

function isReport(report) {
  return isId(report?._id) && isWeekNumber(report.weekNumber) && isTime(report.weekStart) && isTime(report.weekEnd)
    && Date.parse(report.weekEnd) >= Date.parse(report.weekStart) && Date.parse(report.weekEnd) - Date.parse(report.weekStart) <= 6 * DAY
    && isText(report.summary, 5000, true) && isText(report.learning, 3000, true) && isText(report.challenges, 2000)
    && ['draft', 'submitted'].includes(report.status)
    && (report.status === 'draft' ? report.submittedAt === null : isTime(report.submittedAt))
}

function hasPopulatedReferences(report) {
  const person = report.student
  const placement = report.internship
  const dates = getWeeklyReportDates(placement, report.weekNumber)
  return (person === null || (isId(person?._id) && isText(person.name, 100, true) && isText(person.email, 254, true)))
    && (placement === null || (isId(placement?._id) && ['assigned', 'active', 'completed', 'cancelled'].includes(placement.status)
      && dates?.weekStart === report.weekStart && dates.weekEnd === report.weekEnd))
}

export async function fetchWeeklyReports(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_WEEKLY_REPORT_PAGE) throw new Error('Choose a valid weekly reports page.')
  const result = await apiRequest(`/api/v1/weekly-reports?page=${page}&limit=${WEEKLY_REPORT_PAGE_SIZE}`, token, { signal })
  const reports = result.data?.reports
  if (!Array.isArray(reports) || result.data.page !== page || result.data.limit !== WEEKLY_REPORT_PAGE_SIZE
    || reports.length > WEEKLY_REPORT_PAGE_SIZE || reports.some((report) => !isReport(report) || !hasPopulatedReferences(report))
    || new Set(reports.map((report) => report._id)).size !== reports.length) {
    throw new Error('The server returned invalid weekly report data. Please try again.')
  }
  return { reports, hasNextPage: reports.length === WEEKLY_REPORT_PAGE_SIZE && page < MAX_WEEKLY_REPORT_PAGE }
}

export async function saveWeeklyReport(token, internship, values, report = null, signal) {
  if (report && (!isReport(report) || !canEditWeeklyReport(report) || report.internship._id !== internship?._id || report.weekNumber !== toWeekNumber(values?.weekNumber))) {
    throw new Error('Only drafts from an active internship can be edited. Keep the original week and internship.')
  }
  const errors = validateWeeklyReport(values, internship)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const weekNumber = toWeekNumber(values.weekNumber)
  const fields = { summary: values.summary.trim(), learning: values.learning.trim(), challenges: (values.challenges || '').trim() }
  const dates = getWeeklyReportDates(internship, weekNumber)
  const result = await apiRequest(report ? `/api/v1/weekly-reports/${report._id}` : '/api/v1/weekly-reports', token, {
    method: report ? 'PATCH' : 'POST', values: report ? fields : { internshipId: internship._id, weekNumber, ...fields }, signal,
  })
  const saved = result.data?.report
  if (!isReport(saved) || !isId(saved.student) || saved.internship !== internship._id || saved.status !== 'draft'
    || saved.weekNumber !== weekNumber || saved.weekStart !== dates.weekStart || saved.weekEnd !== dates.weekEnd
    || (report && (saved._id !== report._id || saved.student !== report.student?._id))
    || Object.entries(fields).some(([key, value]) => saved[key] !== value)) {
    throw new Error('The saved weekly report could not be confirmed. Refresh weekly reports before trying again.')
  }
  return saved
}

export async function submitWeeklyReport(token, report, signal) {
  if (!isReport(report) || !hasPopulatedReferences(report) || !canEditWeeklyReport(report)) {
    throw new Error('Only drafts from an active internship can be submitted.')
  }
  const result = await apiRequest(`/api/v1/weekly-reports/${report._id}/submit`, token, { method: 'POST', signal })
  const saved = result.data?.report
  if (!isReport(saved) || saved._id !== report._id || saved.status !== 'submitted' || saved.internship !== report.internship._id
    || !isId(saved.student) || saved.student !== report.student?._id
    || ['weekNumber', 'weekStart', 'weekEnd', 'summary', 'learning', 'challenges'].some((field) => saved[field] !== report[field])) {
    throw new Error('Submission could not be confirmed. Refresh weekly reports before trying again.')
  }
  return saved
}
