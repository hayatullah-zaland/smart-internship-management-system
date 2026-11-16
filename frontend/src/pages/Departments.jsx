import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import { fetchDepartments } from '../context/departmentApi'
import DashboardLayout from '../components/DashboardLayout'
import DepartmentForm from '../components/DepartmentForm'
import DepartmentList from '../components/DepartmentList'

export default function Departments() {
  const { user, token, signOut } = useContext(AuthContext)
  const [refreshCount, setRefreshCount] = useState(0)
  const [result, setResult] = useState({ key: null, departments: [], error: '' })
  const requestKey = `${user.id}:${token}:${refreshCount}`
  const loading = result.key !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    async function loadDepartments() {
      try {
        const departments = await fetchDepartments(token, controller.signal)
        if (!controller.signal.aborted) setResult({ key: requestKey, departments, error: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.status === 401) {
          signOut()
          return
        }
        let message = error.message || 'Unable to load departments. Please try again.'
        if (error.name === 'TypeError') message = 'Could not connect. Please try again in a moment.'
        if (error.name === 'TimeoutError' || error.name === 'AbortError') message = 'Loading took too long. Please try again.'
        setResult({ key: requestKey, departments: [], error: message })
      }
    }
    loadDepartments()
    return () => controller.abort()
  }, [token, requestKey, signOut])

  function refreshDepartments() {
    setRefreshCount((current) => current + 1)
  }

  return (
    <DashboardLayout>
      <div className="border-b border-base-300 pb-7">
        <p className="mb-2 text-sm font-medium text-primary">Administration</p>
        <h1 className="text-2xl font-semibold">Departments</h1>
      </div>
      <DepartmentForm key={`${user.id}:${token}`} onCreated={refreshDepartments} />
      <DepartmentList departments={loading ? [] : result.departments} loading={loading}
        error={loading ? '' : result.error} onRefresh={refreshDepartments} />
    </DashboardLayout>
  )
}
