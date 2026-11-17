import { apiRequest } from './apiRequest.js'
import { fetchAdminApplications } from './applicationApi.js'

export const INTERNSHIPS_PAGE_SIZE = 10
export const MAX_INTERNSHIPS_PAGE = 1000000
export const INTERNSHIP_ROLES = ['admin', 'student', 'academic_supervisor']
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const isText = (value, max) => typeof value === 'string' && Boolean(value.trim()) && value.length <= max
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isPerson = (value) => value === null || (isId(value?._id) && isText(value.name, 100) && isText(value.email, 254))

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateInternshipAssignment(values) {
  const errors = {}
  if (!isId(values?.applicationId)) errors.applicationId = 'Choose an approved application.'
  if (!isId(values?.supervisorId)) errors.supervisorId = 'Choose an active academic supervisor.'
  if (!isDateOnly(values?.startDate)) errors.startDate = 'Enter a valid start date.'
  if (!isDateOnly(values?.endDate)) errors.endDate = 'Enter a valid end date.'
  else if (!errors.startDate && values.endDate <= values.startDate) errors.endDate = 'End date must be after start date.'
  return errors
}

function isInternship(value) {
  return isId(value?._id) && isId(value.application) && isId(value.createdBy)
    && ['assigned', 'active', 'completed', 'cancelled'].includes(value.status)
    && value.isOngoing === ['assigned', 'active'].includes(value.status)
    && isDate(value.startDate) && isDate(value.endDate) && Date.parse(value.endDate) > Date.parse(value.startDate)
}

function hasPopulatedReferences(value) {
  return isPerson(value.student) && isPerson(value.supervisor)
    && (value.company === null || (isId(value.company?._id) && isText(value.company.name, 150) && isText(value.company.address, 300)))
    && (value.opportunity === null || (isId(value.opportunity?._id) && isText(value.opportunity.title, 150)))
}

export async function fetchInternships(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_INTERNSHIPS_PAGE) throw new Error('Choose a valid internships page.')
  const result = await apiRequest(`/api/v1/internships?page=${page}&limit=${INTERNSHIPS_PAGE_SIZE}`, token, { signal })
  const internships = result.data?.internships
  if (!Array.isArray(internships) || result.data.page !== page || result.data.limit !== INTERNSHIPS_PAGE_SIZE
    || internships.length > INTERNSHIPS_PAGE_SIZE || internships.some((value) => !isInternship(value) || !hasPopulatedReferences(value))
    || new Set(internships.map((value) => value._id)).size !== internships.length) {
    throw new Error('The server returned invalid internship data. Please try again.')
  }
  return { internships, hasNextPage: internships.length === INTERNSHIPS_PAGE_SIZE && page < MAX_INTERNSHIPS_PAGE }
}

export async function fetchApprovedApplications(token, signal) {
  const applications = new Map()
  for (let page = 1; ; page += 1) {
    const data = await fetchAdminApplications(token, page, 'approved', signal)
    for (const application of data.applications) {
      if (application.student && application.opportunity?.company) applications.set(application._id, application)
    }
    if (!data.hasNextPage) return [...applications.values()]
  }
}

export async function fetchAcademicSupervisors(token, signal) {
  const supervisors = new Map()
  for (let page = 1; page <= MAX_INTERNSHIPS_PAGE; page += 1) {
    const result = await apiRequest(`/api/v1/users?page=${page}&limit=100`, token, { signal })
    const users = result.data?.users
    if (!Array.isArray(users) || result.data.page !== page || result.data.limit !== 100 || users.length > 100
      || users.some((user) => !user || !isPerson(user) || typeof user.isActive !== 'boolean'
        || !['admin', 'student', 'academic_supervisor', 'company_representative'].includes(user.role))) {
      throw new Error('The server returned invalid supervisor data. Please try again.')
    }
    for (const user of users) {
      if (user.role === 'academic_supervisor' && user.isActive) supervisors.set(user._id, user)
    }
    if (users.length < 100) return [...supervisors.values()]
  }
  throw new Error('Unable to load all academic supervisors. Please try again.')
}

export async function createInternship(token, values, signal) {
  const errors = validateInternshipAssignment(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const { applicationId, supervisorId, startDate, endDate } = values
  const result = await apiRequest('/api/v1/internships', token, {
    method: 'POST', values: { applicationId, supervisorId, startDate, endDate }, signal,
  })
  const internship = result.data?.internship
  if (!isInternship(internship) || internship.status !== 'assigned'
    || internship.application !== applicationId || internship.supervisor !== supervisorId
    || !isId(internship.student) || !isId(internship.opportunity) || !isId(internship.company)
    || internship.startDate !== `${startDate}T00:00:00.000Z` || internship.endDate !== `${endDate}T00:00:00.000Z`) {
    throw new Error('The server returned invalid assignment data. Check the internship list before trying again.')
  }
  return internship
}
