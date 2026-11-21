import { apiRequest } from './apiRequest.js'

export const APPLICATIONS_PAGE_SIZE = 10
export const MAX_APPLICATIONS_PAGE = 1000000
const objectId = /^[a-f0-9]{24}$/i
export const APPLICATION_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'withdrawn']
const isId = (value) => typeof value === 'string' && objectId.test(value)
const isDate = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

function isStudent(student) {
  return student === null || (isId(student?._id)
    && typeof student.name === 'string' && Boolean(student.name.trim()) && student.name.length <= 100
    && typeof student.email === 'string' && Boolean(student.email.trim()) && student.email.length <= 254)
}

function isApplication(application, populatedStudent = false) {
  return isId(application?._id) && (populatedStudent ? isStudent(application.student) : isId(application.student))
    && APPLICATION_STATUSES.includes(application.status) && isDate(application.createdAt)
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

export function canReapplyApplication(application, now = Date.now()) {
  const opportunity = application?.opportunity
  return application?.status === 'rejected' && isId(opportunity?._id)
    && opportunity.status === 'open' && isDate(opportunity.deadline) && Date.parse(opportunity.deadline) > now
}

export async function createApplication(token, opportunityId, signal) {
  if (!isId(opportunityId)) throw new Error('Please choose a valid opportunity.')
  const result = await apiRequest('/api/v1/applications', token, {
    method: 'POST', values: { opportunityId }, signal,
  })
  const application = result.data?.application
  if (!isApplication(application) || application.opportunity !== opportunityId || application.status !== 'pending'
    || application.rejectionReason !== '' || application.reviewedBy != null || application.reviewedAt != null) {
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

export async function fetchAdminApplications(token, page = 1, status = '', signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_APPLICATIONS_PAGE) {
    throw new Error('Please choose a valid applications page.')
  }
  if (status !== '' && !APPLICATION_STATUSES.includes(status)) throw new Error('Please choose a valid status filter.')
  const query = new URLSearchParams({ page: String(page), limit: String(APPLICATIONS_PAGE_SIZE) })
  if (status) query.set('status', status)
  const result = await apiRequest(`/api/v1/applications?${query}`, token, { signal })
  const applications = result.data?.applications
  if (!Array.isArray(applications) || result.data.page !== page || result.data.limit !== APPLICATIONS_PAGE_SIZE
    || applications.length > APPLICATIONS_PAGE_SIZE
    || applications.some((application) => !isApplication(application, true) || !isOpportunity(application.opportunity)
      || (status && application.status !== status))
    || new Set(applications.map((application) => application._id)).size !== applications.length) {
    throw new Error('The server returned invalid application data. Please try again.')
  }
  return { applications, hasNextPage: applications.length === APPLICATIONS_PAGE_SIZE && page < MAX_APPLICATIONS_PAGE }
}

export function validateApplicationReview(values) {
  const errors = {}
  if (!['under_review', 'approved', 'rejected'].includes(values?.status)) errors.status = 'Please choose a review decision.'
  if (values?.status === 'rejected' && (typeof values.rejectionReason !== 'string'
    || !values.rejectionReason.trim() || values.rejectionReason.trim().length > 1000)) {
    errors.rejectionReason = 'Enter a rejection reason between 1 and 1000 characters.'
  }
  return errors
}

export async function reviewApplication(token, applicationId, values, signal) {
  if (!isId(applicationId)) throw new Error('Please choose a valid application.')
  const errors = validateApplicationReview(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const body = { status: values.status }
  if (values.status === 'rejected') body.rejectionReason = values.rejectionReason.trim()
  const result = await apiRequest(`/api/v1/applications/${applicationId}/decision`, token, { method: 'PATCH', values: body, signal })
  const application = result.data?.application
  if (!isApplication(application) || application._id.toLowerCase() !== applicationId.toLowerCase()
    || !isId(application.opportunity) || application.status !== values.status
    || !isId(application.reviewedBy) || !isDate(application.reviewedAt)
    || application.rejectionReason !== (body.rejectionReason || '')) {
    throw new Error('The server returned invalid application review data.')
  }
  return application
}
