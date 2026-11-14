import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import Navbar from '../components/Navbar'

export default function Dashboard() {
  const { user } = useContext(AuthContext)

  return (
    <div className="min-h-svh bg-base-200 text-base-content">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <h1 className="border-b border-base-300 pb-6 text-2xl font-semibold">Dashboard</h1>
        <p className="mt-6 break-words text-lg font-medium">Welcome, {user.name}.</p>
        <dl className="mt-6 grid gap-6 border-b border-base-300 pb-6 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="mb-1 text-base-content/65">Email</dt>
            <dd className="break-all font-medium">{user.email}</dd>
          </div>
          <div className="min-w-0">
            <dt className="mb-1 text-base-content/65">Account role</dt>
            <dd className="break-words font-medium capitalize">{user.role.replaceAll('_', ' ')}</dd>
          </div>
        </dl>
      </main>
    </div>
  )
}
