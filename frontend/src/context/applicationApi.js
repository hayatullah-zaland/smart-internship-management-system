import { apiRequest } from './apiRequest.js'

export const APPLICATIONS_PAGE_SIZE = 10
export const MAX_APPLICATIONS_PAGE = 1000000
const objectId = /^[a-f0-9]{24}$/i
const statuses = ['pending', 'under_review', 'approved', 'rejected', 'withdrawn']
const isId = (value) => typeof value === 'string' && objectId.test(value)
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

function isApplication(application) {
  return isId(application?._id) && isId(application.student)
    && statuses.includes(application.status) && isDate(application.createdAt)
    && typeof application.rejectionReason === 'string' && application.rejectionReason.length <= 1000
}

function isOpportunity(opportunity) {
  if (opportunity === null) return true
  const company = opportunity?.company
  return isId(opportunity?._id)
    && typeof opportunity.title === 'string' && opportunity.title.trim().length >= 2 && opportunity.title.length <= 150
    && isDate(opportunity.deadline) && ['open', 'closed', 'archived'].includes(opportunity.status)
    && (company === null || (isId(company?._id)
      && typeof company.name === 'string' && company.name.trim().length >= 2 && company.name.length <= 150))
}

export async function createApplication(token, opportunityId, signal) {
  if (!isId(opportunityId)) throw new Error('Please choose a valid opportunity.')
  const result = await apiRequest('/api/v1/applications', token, {
    method: 'POST', values: { opportunityId }, signal,
  })
  const application = result.data?.application
  if (!isApplication(application) || application.opportunity !== opportunityId || application.status !== 'pending') {
    throw new Error('The server returned invalid application data.')
  }
  return application
}

export async function fetchMyApplications(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_APPLICATIONS_PAGE) {
    throw new Error('Please choose a valid applications page.')
  }
  const result = await apiRequest(`/api/v1/applications/me?page=${page}&limit=${APPLICATIONS_PAGE_SIZE}`, token, { signal })
  const applications = result.data?.applications
  if (!Array.isArray(applications) || result.data.page !== page || result.data.limit !== APPLICATIONS_PAGE_SIZE
    || applications.length > APPLICATIONS_PAGE_SIZE
    || applications.some((application) => !isApplication(application) || !isOpportunity(application.opportunity))
    || new Set(applications.map((application) => application._id)).size !== applications.length) {
    throw new Error('The server returned invalid application data. Please try again.')
  }
  return { applications, hasNextPage: applications.length === APPLICATIONS_PAGE_SIZE && page < MAX_APPLICATIONS_PAGE }
}
