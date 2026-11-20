import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Building2, UsersRound } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { assignCompanyRepresentative, createCompany, fetchCompanies, fetchCompanyRepresentatives, MAX_COMPANIES_PAGE, validateCompany } from '../context/companyApi'
import DashboardLayout from '../components/DashboardLayout'
import CompanyForm from '../components/CompanyForm'
import CompanyList from '../components/CompanyList'
import CompanyRepresentativeForm from '../components/CompanyRepresentativeForm'

const emptyValues = { name: '', address: '', contactEmail: '' }

export default function Companies() {
  const { user, token } = useContext(AuthContext)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= MAX_COMPANIES_PAGE ? requested : 1
  return <CompaniesWorkspace key={`${user.id}:${token}:${page}`} page={page}
    onPageChange={(next) => setParams(next === 1 ? {} : { page: String(next) })} />
}

export function CompaniesWorkspace({ page, onPageChange }) {
  const { user, token, signOut } = useContext(AuthContext)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState({ key: null, companies: [], hasNextPage: false, error: '' })
  const [people, setPeople] = useState({ key: null, representatives: [], error: '' })
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [write, setWrite] = useState({ kind: '', companyId: null, saving: false, message: '', error: false, needsRefresh: false })
  const requestRef = useRef(null)
  const loading = result.key !== refresh
  const loadingPeople = people.key !== refresh
  const representativesUnavailable = loadingPeople || Boolean(people.error)
  const blocked = user.role !== 'admin' || loading || Boolean(result.error) || write.saving || write.needsRefresh

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadCompanies() {
      try {
        const data = await fetchCompanies(token, page, controller.signal)
        if (controller.signal.aborted) return
        setResult({ key: refresh, ...data, error: '' })
        setWrite((current) => current.needsRefresh ? { ...current, needsRefresh: false, error: false,
          message: 'Companies refreshed. Check the current records before trying again.' } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setResult({ key: refresh, companies: [], hasNextPage: false, error: error.name === 'TypeError'
          ? 'Could not connect. Please try again.' : error.message || 'Unable to load companies.' })
      }
    }
    async function loadRepresentatives() {
      try {
        const representatives = await fetchCompanyRepresentatives(token, controller.signal)
        if (!controller.signal.aborted) setPeople({ key: refresh, representatives, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setPeople({ key: refresh, representatives: [], error: 'Unable to load representatives. Refresh companies to try again.' })
      }
    }
    loadCompanies()
    loadRepresentatives()
    return () => controller.abort()
  }, [token, page, refresh, signOut])

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function refreshCompanies() {
    if (!write.saving && !requestRef.current) setRefresh((count) => count + 1)
  }
  function showWriteError(error) {
    if (error.status === 401) return signOut()
    const uncertain = !error.status || error.status >= 500
    const needsRefresh = uncertain || error.status === 404 || error.status === 409
    setWrite((current) => ({ ...current, saving: false, error: true, needsRefresh,
      message: uncertain ? 'The change could not be confirmed. Refresh companies and check the records before trying again.'
        : `${error.message || 'Unable to save this change.'}${needsRefresh ? ' Refresh companies before trying again.' : ''}` }))
  }
  async function addCompany(event) {
    event.preventDefault()
    if (blocked || requestRef.current) return
    const fieldErrors = validateCompany(values)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ kind: 'create', companyId: null, saving: true, message: '', error: false, needsRefresh: false })
    try {
      const company = await createCompany(token, values, user.id, controller.signal)
      if (controller.signal.aborted) return
      setValues(emptyValues)
      setWrite({ kind: '', companyId: null, saving: false, message: `${company.name} created successfully.`, error: false, needsRefresh: false })
      setRefresh((count) => count + 1)
    } catch (error) {
      if (!controller.signal.aborted) showWriteError(error)
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }
  async function saveRepresentative(company, representative) {
    if (blocked || representativesUnavailable || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ kind: 'assign', companyId: company._id, saving: true, message: '', error: false, needsRefresh: false })
    try {
      await assignCompanyRepresentative(token, company, representative, controller.signal)
      if (controller.signal.aborted) return
      setWrite({ kind: '', companyId: null, saving: false, message: `${representative.name} assigned to ${company.name}.`, error: false, needsRefresh: false })
      setRefresh((count) => count + 1)
    } catch (error) {
      if (!controller.signal.aborted) showWriteError(error)
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-base-300 pb-7">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Administration</p>
          <h1 className="text-2xl font-semibold">Companies</h1>
        </div>
        <button type="button" className="btn btn-primary min-h-11" disabled={blocked} onClick={() => {
          document.getElementById('new-company-heading')?.scrollIntoView({ block: 'start' })
          document.getElementById('company-name')?.focus({ preventScroll: true })
        }}><Building2 size={18} aria-hidden="true" /> New company</button>
      </div>
      {write.message && <p role={write.error ? 'alert' : 'status'}
        className={`mt-5 break-words rounded-md border p-3 text-sm leading-6 ${write.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>{write.message}</p>}
      {user.role === 'admin' && <CompanyForm values={values} errors={errors} disabled={blocked} saving={write.saving && write.kind === 'create'}
        onChange={changeField} onSubmit={addCompany} />}
      <div className="pt-6">
        {loadingPeople ? <p role="status" className="text-sm text-base-content/70">Loading representatives...</p>
          : people.error ? <p role="alert" className="break-words text-sm leading-6 text-error">{people.error}</p>
            : !people.representatives.some((person) => person.isActive) && <Link className="link link-primary inline-flex items-center gap-2 text-sm" to="/admin/users">
              <UsersRound size={17} aria-hidden="true" /> Users</Link>}
      </div>
      <CompanyList companies={loading ? [] : result.companies} representatives={people.representatives} representativesUnavailable={representativesUnavailable}
        page={page} hasNextPage={!loading && result.hasNextPage} loading={loading} error={loading ? '' : result.error} disabled={write.saving}
        onRefresh={refreshCompanies} onPageChange={(next) => { if (!write.saving && !requestRef.current) onPageChange(next) }}
        renderActions={user.role === 'admin' ? (company) => <CompanyRepresentativeForm key={`${refresh}:${company._id}:${company.representative}`}
          company={company} representatives={people.representatives} unavailable={representativesUnavailable} disabled={blocked}
          saving={write.saving && write.companyId === company._id} onSave={saveRepresentative} /> : undefined} />
    </DashboardLayout>
  )
}
