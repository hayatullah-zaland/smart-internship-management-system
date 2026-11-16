import { apiRequest } from './apiRequest.js'

export const OPPORTUNITIES_PAGE_SIZE = 10
export const MAX_OPPORTUNITIES_PAGE = 1000000
const objectId = /^[a-f0-9]{24}$/i

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
