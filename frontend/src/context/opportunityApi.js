import { apiRequest } from './apiRequest.js'

export const OPPORTUNITIES_PAGE_SIZE = 10
export const MAX_OPPORTUNITIES_PAGE = 1000000
const objectId = /^[a-f0-9]{24}$/i
const isId = (value) => typeof value === 'string' && objectId.test(value)
const sameId = (a, b) => isId(a) && isId(b) && a.toLowerCase() === b.toLowerCase()

export function kabulDeadlineToISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  // datetime-local has no timezone; this form always uses Kabul's UTC+04:30.
  const time = Date.parse(`${value}:00+04:30`)
  if (!Number.isFinite(time) || new Date(time + 270 * 60000).toISOString().slice(0, 16) !== value) return null
  return new Date(time).toISOString()
}

export function validateOpportunity(values, now = Date.now()) {
  const errors = {}
  if (typeof values?.companyId !== 'string' || !isId(values.companyId.trim())) errors.companyId = 'Enter a valid company ID supplied by your admin.'
  if (typeof values?.title !== 'string' || values.title.trim().length < 2 || values.title.trim().length > 150) {
    errors.title = 'Enter a title between 2 and 150 characters.'
  }
  if (typeof values?.description !== 'string' || !values.description.trim() || values.description.trim().length > 5000) {
    errors.description = 'Enter a description using 1 to 5000 characters.'
  }
  const deadline = kabulDeadlineToISO(values?.deadline)
  if (!deadline || Date.parse(deadline) <= now) errors.deadline = 'Enter a valid future deadline in Kabul time.'
  const capacity = values?.capacity
  if (!['string', 'number'].includes(typeof capacity) || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 1000) {
    errors.capacity = 'Enter a whole number between 1 and 1000.'
  }
  return errors
}

export async function createOpportunity(token, values, user, signal) {
  if (user?.role !== 'company_representative') {
    const error = new Error('Only company representatives can publish opportunities.')
    error.status = 403
    throw error
  }
  if (!isId(user.id)) {
    const error = new Error('Please sign in again.')
    error.status = 401
    throw error
  }
  const errors = validateOpportunity(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const body = { companyId: values.companyId.trim(), title: values.title.trim(), description: values.description.trim(),
    deadline: kabulDeadlineToISO(values.deadline), capacity: Number(values.capacity) }
  const result = await apiRequest('/api/v1/opportunities', token, { method: 'POST', values: body, signal })
  const opportunity = result.data?.opportunity
  if (!isId(opportunity?._id) || opportunity.title !== body.title || opportunity.description !== body.description
    || !sameId(opportunity.company, body.companyId) || !sameId(opportunity.createdBy, user.id) || opportunity.status !== 'open'
    || opportunity.capacity !== body.capacity || typeof opportunity.deadline !== 'string' || Date.parse(opportunity.deadline) !== Date.parse(body.deadline)
    || typeof opportunity.createdAt !== 'string' || !Number.isFinite(Date.parse(opportunity.createdAt))) {
    throw new Error('Publication could not be confirmed. Refresh opportunities and check the list before trying again.')
  }
  return opportunity
}

function isCompany(company) {
  return company === null || (typeof company?._id === 'string' && objectId.test(company._id)
    && typeof company.name === 'string' && company.name.trim().length >= 2 && company.name.length <= 150
    && typeof company.address === 'string' && Boolean(company.address.trim()) && company.address.length <= 300)
}

function isOpportunity(opportunity) {
  return typeof opportunity?._id === 'string' && objectId.test(opportunity._id)
    && typeof opportunity.title === 'string' && opportunity.title.trim().length >= 2 && opportunity.title.length <= 150
    && typeof opportunity.description === 'string' && Boolean(opportunity.description.trim()) && opportunity.description.length <= 5000
    && isCompany(opportunity.company) && opportunity.status === 'open'
    && Number.isInteger(opportunity.capacity) && opportunity.capacity >= 1 && opportunity.capacity <= 1000
    && typeof opportunity.deadline === 'string' && Number.isFinite(Date.parse(opportunity.deadline))
}

export async function fetchOpportunities(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_OPPORTUNITIES_PAGE) {
    throw new Error('Please choose a valid opportunities page.')
  }
  const result = await apiRequest(`/api/v1/opportunities?page=${page}&limit=${OPPORTUNITIES_PAGE_SIZE}`, token, { signal })
  const opportunities = result.data?.opportunities
  if (!Array.isArray(opportunities) || result.data.page !== page || result.data.limit !== OPPORTUNITIES_PAGE_SIZE
    || opportunities.length > OPPORTUNITIES_PAGE_SIZE || opportunities.some((opportunity) => !isOpportunity(opportunity))
    || new Set(opportunities.map((opportunity) => opportunity._id)).size !== opportunities.length) {
    throw new Error('The server returned invalid opportunity data. Please try again.')
  }
  // The API has no total count; a full page may have another page after it.
  return { opportunities, hasNextPage: opportunities.length === OPPORTUNITIES_PAGE_SIZE && page < MAX_OPPORTUNITIES_PAGE }
}
