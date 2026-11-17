import { BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, RotateCw, TriangleAlert } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit' })
const statuses = {
  assigned: { label: 'Assigned', color: 'badge-info' }, active: { label: 'Active', color: 'badge-success' },
  completed: { label: 'Completed', color: 'badge-neutral' }, cancelled: { label: 'Cancelled', color: 'badge-error' },
}

export default function InternshipList({ internships, page, hasNextPage, loading, error, onRefresh, onPageChange }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="internships-heading" aria-busy={loading}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="internships-heading" className="text-base font-semibold">Internship records</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading} onClick={onRefresh}
          aria-label="Refresh internships" title="Refresh internships"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading internships...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Unable to load internships</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : internships.length === 0 ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <BriefcaseBusiness size={21} className="shrink-0" aria-hidden="true" />
        {page === 1 ? 'No internships yet.' : 'No internships on this page.'}
      </p> : <ul className="space-y-3">
        {internships.map((internship) => <li key={internship._id} className="min-w-0 rounded-lg border border-base-300 bg-base-100 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-48">
              <h3 className="break-words text-base leading-6 font-semibold">{internship.opportunity?.title || 'Opportunity unavailable'}</h3>
              <p className="mt-2 flex items-start gap-2 text-sm text-base-content/70">
                <Building2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{internship.company?.name || 'Company unavailable'}</span>
              </p>
            </div>
            <span className={`badge badge-soft shrink-0 ${statuses[internship.status].color}`}>{statuses[internship.status].label}</span>
          </div>
          <dl className="mt-5 grid min-w-0 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            {['student', 'supervisor'].map((name) => <div key={name} className="min-w-0">
              <dt className="text-xs text-base-content/60">{name === 'student' ? 'Student' : 'Academic supervisor'}</dt>
              <dd className="mt-1 break-words leading-6">
                <span className="block font-medium">{internship[name]?.name || (name === 'student' ? 'Student unavailable' : 'Supervisor unavailable')}</span>
                {internship[name] && <span className="block break-all text-xs text-base-content/70">{internship[name].email}</span>}
              </dd>
            </div>)}
            {['startDate', 'endDate'].map((name) => <div key={name} className="min-w-0">
              <dt className="text-xs text-base-content/60">{name === 'startDate' ? 'Start date' : 'End date'}</dt>
              <dd className="mt-1 text-sm"><time dateTime={internship[name].slice(0, 10)}>{dateFormatter.format(new Date(internship[name]))}</time></dd>
            </div>)}
            {internship.company && <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs text-base-content/60">Company address</dt>
              <dd className="mt-1 break-words leading-6">{internship.company.address}</dd>
            </div>}
          </dl>
        </li>)}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Internship pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1} aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)}
          disabled={loading || Boolean(error) || !hasNextPage} aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
    </section>
  )
}
