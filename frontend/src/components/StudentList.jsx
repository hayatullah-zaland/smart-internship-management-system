import { ChevronLeft, ChevronRight, GraduationCap, RotateCw, TriangleAlert, UsersRound } from 'lucide-react'
import { Link } from 'react-router'

export default function StudentList({ profiles, page, hasNextPage, loading, error, onRefresh, onPageChange }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="students-heading" aria-busy={loading}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="students-heading" className="min-w-0 text-base font-semibold">Student profiles</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading} onClick={onRefresh}
          aria-label="Refresh students" title="Refresh students"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading student profiles...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Unable to load students</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : !profiles.length ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <GraduationCap size={21} className="shrink-0" aria-hidden="true" /> {page === 1 ? 'No student profiles yet.' : 'No student profiles on this page.'}
      </p> : <ul className="divide-y divide-base-300">
        {profiles.map((profile) => <li key={profile._id} className="grid min-w-0 gap-5 py-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0"><h3 className="break-words text-sm font-semibold">{profile.user?.name || 'Student account unavailable'}</h3>
            {profile.user && <><p className="mt-1 break-all text-sm leading-6 text-base-content/70">{profile.user.email}</p>
              <span className={`badge badge-soft mt-3 ${profile.user.isActive ? 'badge-success' : 'badge-warning'}`}>{profile.user.isActive ? 'Active account' : 'Inactive account'}</span></>}
          </div>
          <dl className="min-w-0 space-y-4 text-sm">
            <div><dt className="text-xs text-base-content/60">Student number</dt><dd className="mt-1 break-all font-mono leading-6">{profile.studentNumber}</dd></div>
            <div><dt className="text-xs text-base-content/60">Semester</dt><dd className="mt-1 leading-6 tabular-nums">{profile.semester}</dd></div>
          </dl>
          <dl className="min-w-0 space-y-4 text-sm">
            <div><dt className="text-xs text-base-content/60">Department</dt><dd className="mt-1 break-words leading-6">
              {profile.department ? <>{profile.department.name}<span className="mt-1 block break-all font-mono text-xs text-base-content/65">{profile.department.code}</span></> : 'Department unavailable'}
            </dd></div>
            <div><dt className="text-xs text-base-content/60">Phone</dt><dd className="mt-1 break-all leading-6">{profile.phone}</dd></div>
          </dl>
        </li>)}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Student pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}
          aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || Boolean(error) || !hasNextPage}
          aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
      <Link className="link link-primary mt-6 inline-flex items-center gap-2 text-sm" to="/admin/users"><UsersRound size={17} aria-hidden="true" /> Users</Link>
    </section>
  )
}
