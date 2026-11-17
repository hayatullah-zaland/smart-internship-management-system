import { apiRequest } from './apiRequest.js'
import { fetchInternships } from './internshipApi.js'

export const EVALUATION_ROLES = ['admin', 'student', 'academic_supervisor', 'company_representative']
export const EVALUATOR_ROLES = ['academic_supervisor', 'company_representative']
export const EVALUATIONS_PAGE_SIZE = 10
export const MAX_EVALUATIONS_PAGE = 1000000
const isId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)
const sameId = (a, b) => isId(a) && isId(b) && a.toLowerCase() === b.toLowerCase()
const isText = (value, max) => typeof value === 'string' && Boolean(value.trim()) && value.length <= max
const isTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isScore = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100

export function validateEvaluation(values) {
  const errors = {}
  if (!isId(values?.internshipId)) errors.internshipId = 'Choose a completed internship or enter its valid ID.'
  const score = values?.score
  if (!['string', 'number'].includes(typeof score) || String(score).trim() === '' || !isScore(Number(score))) {
    errors.score = 'Enter a score between 0 and 100.'
  }
  if (typeof values?.comments !== 'string' || !values.comments.trim() || values.comments.trim().length > 2000) {
    errors.comments = 'Enter comments using 1 to 2000 characters.'
  }
  return errors
}

function isEvaluation(value) {
  return isId(value?._id) && isId(value.internship) && ['academic', 'company'].includes(value.type)
    && isScore(value.score) && isText(value.comments, 2000) && isTime(value.createdAt)
}

function hasPopulatedPeople(value) {
  return (value.student === null || (isId(value.student?._id) && isText(value.student.name, 100) && isText(value.student.email, 254)))
    && (value.evaluator === null || (isId(value.evaluator?._id) && isText(value.evaluator.name, 100)))
}

export async function fetchEvaluations(token, page = 1, signal) {
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_EVALUATIONS_PAGE) throw new Error('Choose a valid evaluations page.')
  const result = await apiRequest(`/api/v1/evaluations?page=${page}&limit=${EVALUATIONS_PAGE_SIZE}`, token, { signal })
  const evaluations = result.data?.evaluations
  if (!Array.isArray(evaluations) || result.data.page !== page || result.data.limit !== EVALUATIONS_PAGE_SIZE
    || evaluations.length > EVALUATIONS_PAGE_SIZE || evaluations.some((value) => !isEvaluation(value) || !hasPopulatedPeople(value))
    || new Set(evaluations.map((value) => value._id)).size !== evaluations.length) {
    throw new Error('The server returned invalid evaluation data. Please try again.')
  }
  return { evaluations, hasNextPage: evaluations.length === EVALUATIONS_PAGE_SIZE && page < MAX_EVALUATIONS_PAGE }
}

export async function fetchCompletedEvaluationInternships(token, supervisorId, signal) {
  if (!isId(supervisorId)) throw new Error('Please sign in again.')
  const completed = new Map()
  for (let page = 1; ; page += 1) {
    const data = await fetchInternships(token, page, signal)
    for (const internship of data.internships) {
      if (internship.status === 'completed' && internship.student && sameId(internship.supervisor?._id, supervisorId)) {
        completed.set(internship._id, internship)
      }
    }
    if (!data.hasNextPage) return [...completed.values()]
  }
}

export async function createEvaluation(token, values, user, internship = null, signal) {
  if (!isId(user?.id) || !EVALUATOR_ROLES.includes(user.role)) throw new Error('Only assigned evaluators can record final evaluations.')
  const errors = validateEvaluation(values)
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const academic = user.role === 'academic_supervisor'
  if (academic && (!sameId(internship?._id, values.internshipId) || internship.status !== 'completed'
    || !sameId(internship.supervisor?._id, user.id) || !isId(internship.student?._id))) {
    throw new Error('Choose a completed internship assigned to you.')
  }
  // The company representative supplies an ID; backend ownership/completion checks remain decisive.
  const body = { internshipId: values.internshipId, score: Number(values.score), comments: values.comments.trim() }
  const result = await apiRequest('/api/v1/evaluations', token, { method: 'POST', values: body, signal })
  const saved = result.data?.evaluation
  if (!isEvaluation(saved) || !sameId(saved.internship, body.internshipId) || !sameId(saved.evaluator, user.id) || !isId(saved.student)
    || saved.type !== (academic ? 'academic' : 'company') || saved.score !== body.score || saved.comments !== body.comments
    || (academic && !sameId(saved.student, internship.student._id))) {
    throw new Error('The evaluation could not be confirmed. Refresh evaluations before trying again.')
  }
  return saved
}
