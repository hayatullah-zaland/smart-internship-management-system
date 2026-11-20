import { useContext, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { UserPlus } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { createManagedUser, deleteManagedUser, fetchManagedUsers, MAX_USERS_PAGE, updateManagedUser, updateManagedUserStatus, USER_ROLES, validateManagedUser } from '../context/userApi'
import DashboardLayout from '../components/DashboardLayout'
import UserForm from '../components/UserForm'
import UserList from '../components/UserList'
import UserActions from '../components/UserActions'
import UserCategories from '../components/UserCategories'

const emptyValues = { name: '', email: '', role: '', password: '', confirmPassword: '' }

export default function Users() {
  const { user, token } = useContext(AuthContext)
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('page') || 1)
  const page = Number.isSafeInteger(requested) && requested >= 1 && requested <= MAX_USERS_PAGE ? requested : 1
  const requestedRole = params.get('role') || ''
  const role = Object.hasOwn(USER_ROLES, requestedRole) ? requestedRole : ''
  return <UsersWorkspace key={`${user.id}:${token}:${role}:${page}`} page={page} role={role}
    onPageChange={(next, category = role) => setParams({
      ...(category ? { role: category } : {}), ...(next === 1 ? {} : { page: String(next) }),
    })} />
}

export function UsersWorkspace({ page, role = '', onPageChange }) {
  const { user, token, signOut } = useContext(AuthContext)
  const [refresh, setRefresh] = useState(0)
  const [result, setResult] = useState({ key: null, users: [], hasNextPage: false, error: '' })
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [write, setWrite] = useState({ kind: '', saving: false, userId: null, message: '', error: false, needsRefresh: false })
  const requestRef = useRef(null)
  const loading = result.key !== refresh
  const writeBlocked = user.role !== 'admin' || write.saving || write.needsRefresh
  const blocked = writeBlocked || loading || Boolean(result.error)

  useEffect(() => () => requestRef.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    async function loadUsers() {
      try {
        const data = await fetchManagedUsers(token, page, controller.signal, role)
        if (controller.signal.aborted) return
        setResult({ key: refresh, ...data, error: '' })
        setWrite((current) => current.needsRefresh ? { ...current, needsRefresh: false,
          message: 'Users refreshed. Check the current accounts before trying again.', error: false } : current)
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) return signOut()
        setResult({ key: refresh, users: [], hasNextPage: false, error: error.name === 'TypeError'
          ? 'Could not connect. Please try again.' : error.message || 'Unable to load users.' })
      }
    }
    loadUsers()
    return () => controller.abort()
  }, [token, page, role, refresh, signOut])

  function changeField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }
  function refreshUsers() {
    if (!requestRef.current && !write.saving) setRefresh((count) => count + 1)
  }
  function showWriteError(error, kind) {
    if (error.status === 401) return signOut()
    const uncertain = !error.status || error.status >= 500
    const needsRefresh = uncertain || error.status === 404 || (error.status === 409 && kind !== 'create' && kind !== 'update')
    setWrite((current) => ({ ...current, saving: false, error: true, needsRefresh,
      message: uncertain ? 'The change could not be confirmed. Refresh users and check the account before trying again.'
        : `${error.message || 'Unable to save this change.'}${needsRefresh ? ' Refresh users before trying again.' : ''}` }))
  }
  async function createAccount(event) {
    event.preventDefault()
    if (writeBlocked || requestRef.current) return
    const fieldErrors = validateManagedUser(values)
    setErrors(fieldErrors)
    const first = Object.keys(fieldErrors)[0]
    if (first) return event.currentTarget.elements.namedItem(first)?.focus()
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ kind: 'create', saving: true, userId: null, message: '', error: false, needsRefresh: false })
    try {
      const account = await createManagedUser(token, values, controller.signal)
      if (controller.signal.aborted) return
      setValues(emptyValues)
      setShowPassword(false)
      setWrite({ kind: '', saving: false, userId: null, message: `Account created for ${account.name} (${account.email}).`, error: false, needsRefresh: false })
      if (page !== 1 || (role && role !== account.role)) onPageChange(1, role ? account.role : '')
      else setRefresh((count) => count + 1)
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error.status === 409) setErrors((current) => ({ ...current, email: error.message }))
        showWriteError(error, 'create')
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }
  async function saveStatus(account, isActive) {
    if (blocked || requestRef.current || account.role === 'admin' || isActive === account.isActive) return
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ kind: 'status', saving: true, userId: account.id, message: '', error: false, needsRefresh: false })
    try {
      const saved = await updateManagedUserStatus(token, account, isActive, controller.signal)
      if (controller.signal.aborted) return
      setWrite({ kind: '', saving: false, userId: null, message: `${saved.name}'s account ${saved.isActive ? 'activated' : 'deactivated'}.`, error: false, needsRefresh: false })
      setRefresh((count) => count + 1)
    } catch (error) {
      if (!controller.signal.aborted) showWriteError(error, 'status')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  async function manageAccount(kind, account, edits) {
    if (blocked || requestRef.current || account.role === 'admin' || !['update', 'delete'].includes(kind)) return
    const controller = new AbortController()
    requestRef.current = controller
    setWrite({ kind, saving: true, userId: account.id, message: '', error: false, needsRefresh: false })
    try {
      if (kind === 'update') await updateManagedUser(token, account, edits, controller.signal)
      else await deleteManagedUser(token, account, controller.signal)
      if (controller.signal.aborted) return
      setWrite({ kind: '', saving: false, userId: null, message: kind === 'update'
        ? `Account updated for ${edits.name.trim()}.` : `Account deleted for ${account.name}.`, error: false, needsRefresh: false })
      if (kind === 'delete' && result.users.length === 1 && page > 1) onPageChange(page - 1)
      else setRefresh((count) => count + 1)
    } catch (error) {
      if (!controller.signal.aborted) showWriteError(error, kind)
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-base-300 pb-7">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Administration</p>
          <h1 className="text-2xl font-semibold">Users</h1>
        </div>
        <button type="button" className="btn btn-primary min-h-11" disabled={writeBlocked} onClick={() => {
          document.getElementById('new-user-heading')?.scrollIntoView({ block: 'start' })
          document.getElementById('user-name')?.focus({ preventScroll: true })
        }}><UserPlus size={18} aria-hidden="true" /> New user</button>
      </div>
      {write.message && (!write.error || !write.userId) && <p role={write.error ? 'alert' : 'status'}
        className={`mt-5 break-words rounded-md border p-3 text-sm leading-6 ${write.error ? 'border-error/40 bg-error/10 text-error' : 'border-success/40 bg-success/10 text-success'}`}>{write.message}</p>}
      {user.role === 'admin' && <UserForm values={values} errors={errors} disabled={writeBlocked}
        saving={write.saving && write.kind === 'create'} showPassword={showPassword} onTogglePassword={() => setShowPassword((current) => !current)}
        onChange={changeField} onSubmit={createAccount} />}
      <UserCategories role={role} disabled={write.saving || write.needsRefresh} />
      <UserList users={loading ? [] : result.users} page={page} role={role} hasNextPage={!loading && result.hasNextPage}
        loading={loading} error={loading ? '' : result.error} disabled={write.saving} onRefresh={refreshUsers}
        onPageChange={(next) => { if (!write.saving && !requestRef.current) onPageChange(next) }}
        renderActions={user.role === 'admin' ? (account) => <UserActions key={`${refresh}:${account.id}:${account.isActive}`}
          account={account} disabled={blocked} saving={write.saving && write.userId === account.id} onSaveStatus={saveStatus}
          error={write.error && write.userId === account.id ? write.message : ''}
          onUpdate={(account, edits) => manageAccount('update', account, edits)} onDelete={(account) => manageAccount('delete', account)} /> : undefined} />
    </DashboardLayout>
  )
}
