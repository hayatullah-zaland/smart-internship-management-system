import { apiRequest } from './apiRequest.js'
import { fetchManagedUsers, MAX_USERS_PAGE } from './userApi.js'

export const COMPANIES_PAGE_SIZE = 10
export const MAX_COMPANIES_PAGE = 1000000
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const sameId = (a, b) => isId(a) && isId(b) && a.toLowerCase() === b.toLowerCase()
const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const isCompany = (company) => isId(company?._id) && isId(company.createdBy)
  && typeof company.name === 'string' && company.name.trim().length >= 2 && company.name.length <= 150
  && typeof company.address === 'string' && Boolean(company.address.trim()) && company.address.length <= 300
  && isEmail(company.contactEmail) && (company.representative === null || isId(company.representative))
  && typeof company.createdAt === 'string' && Number.isFinite(Date.parse(company.createdAt))

export function validateCompany(values) {
  const errors = {}
  if (typeof values?.name !== 'string' || values.name.trim().length < 2 || values.name.trim().length > 150) {
    errors.name = 'Enter a company name between 2 and 150 characters.'
  }
  if (typeof values?.address !== 'string' || !values.address.trim() || values.address.trim().length > 300) {
    errors.address = 'Enter an address using 1 to 300 characters.'
  }
  if (typeof values?.contactEmail !== 'string' || !isEmail(values.contactEmail.trim())) errors.contactEmail = 'Enter a valid contact email.'
  return errors
}

export async function fetchCompanies(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_COMPANIES_PAGE) throw new Error('Choose a valid companies page.')
  const result = await apiRequest(`/api/v1/companies?page=${page}&limit=${COMPANIES_PAGE_SIZE}`, token, { signal })
  const companies = result.data?.companies
  if (!Array.isArray(companies) || result.data.page !== page || result.data.limit !== COMPANIES_PAGE_SIZE
    || companies.length > COMPANIES_PAGE_SIZE || companies.some((company) => !isCompany(company))
    || new Set(companies.map((company) => company._id.toLowerCase())).size !== companies.length) {
    throw new Error('The server returned invalid company data. Please refresh companies.')
  }
  return { companies, hasNextPage: companies.length === COMPANIES_PAGE_SIZE && page < MAX_COMPANIES_PAGE }
}

export async function fetchCompanyRepresentatives(token, signal) {
  const representatives = new Map()
  // Read every user page; later-page representatives and inactive saved links still matter.
  for (let page = 1; page <= MAX_USERS_PAGE; page += 1) {
    const data = await fetchManagedUsers(token, page, signal)
    for (const user of data.users) {
      if (user.role === 'company_representative') representatives.set(user.id.toLowerCase(), user)
    }
    if (!data.hasNextPage) return [...representatives.values()]
  }
}

export async function createCompany(token, values, adminId, signal) {
  const errors = validateCompany(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  if (!isId(adminId)) throw new Error('Please sign in again.')
  const body = { name: values.name.trim(), address: values.address.trim(), contactEmail: values.contactEmail.trim().toLowerCase() }
  const result = await apiRequest('/api/v1/companies', token, { method: 'POST', values: body, signal })
  const company = result.data?.company
  if (!isCompany(company) || company.name !== body.name || company.address !== body.address || company.contactEmail !== body.contactEmail
    || !sameId(company.createdBy, adminId) || company.representative !== null) {
    throw new Error('The new company could not be confirmed. Refresh companies before trying again.')
  }
  return company
}

export function validateCompanyRepresentative(company, representative) {
  if (!isId(company?._id) || !isId(representative?.id) || representative.role !== 'company_representative' || representative.isActive !== true) {
    return { representativeId: 'Choose an available active company representative.' }
  }
  if (sameId(company.representative, representative.id)) return { representativeId: 'This representative is already assigned.' }
  return {}
}

export async function assignCompanyRepresentative(token, company, representative, signal) {
  const errors = validateCompanyRepresentative(company, representative)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const result = await apiRequest(`/api/v1/companies/${company._id}/representative`, token, {
    method: 'PATCH', values: { representativeId: representative.id }, signal,
  })
  const saved = result.data?.company
  if (!isCompany(saved) || !sameId(saved._id, company._id) || !sameId(saved.representative, representative.id)) {
    throw new Error('The representative change could not be confirmed. Refresh companies before trying again.')
  }
  return saved
}
