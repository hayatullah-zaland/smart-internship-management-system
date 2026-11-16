import { BriefcaseBusiness, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, MapPin, RotateCw, TriangleAlert, UsersRound } from 'lucide-react'

const deadlineFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: true,
})

export default function OpportunityList({ opportunities, page, hasNextPage, loading, error, onRefresh, onPageChange, renderActions }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="opportunities-heading" aria-busy={loading}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="opportunities-heading" className="min-w-0 text-base font-semibold">Open opportunities</h2>
        <div className="tooltip tooltip-left" data-tip="Refresh opportunities">
          <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading} onClick={onRefresh}
            aria-label="Refresh opportunities" title="Refresh opportunities">
            <RotateCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading opportunities...
        </p>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Unable to load opportunities</p>
            <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
            <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}>
              <RotateCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      ) : opportunities.length === 0 ? (
        <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
          <BriefcaseBusiness size={21} className="shrink-0" aria-hidden="true" />
          {page === 1 ? 'No open opportunities right now.' : 'No opportunities on this page.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {opportunities.map((opportunity) => (
            <li key={opportunity._id} className="min-w-0">
              <details className="group min-w-0 rounded-lg border border-base-300 bg-base-100">
                <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block break-words text-base leading-6 font-semibold">{opportunity.title}</span>
                    <span className="mt-2 flex items-start gap-2 text-sm text-base-content/70">
                      <Building2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{opportunity.company?.name || 'Company unavailable'}</span>
                    </span>
                  </span>
                  <ChevronDown size={19} className="mt-1 shrink-0 text-base-content/60 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                  <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3 text-xs text-base-content/70">
                    <span className="flex min-w-0 items-start gap-2">
                      <CalendarDays size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">Deadline: <time dateTime={opportunity.deadline} title={opportunity.deadline}>
                        {deadlineFormatter.format(new Date(opportunity.deadline))} Kabul
                      </time></span>
                    </span>
                    <span className="flex items-center gap-2">
                      <UsersRound size={15} className="shrink-0" aria-hidden="true" /> Capacity: {opportunity.capacity}
                    </span>
                  </span>
                </summary>
                <div className="min-w-0 border-t border-base-300 p-4 sm:p-5">
                  <h3 className="text-sm font-semibold">Description</h3>
                  <p className="mt-3 break-words text-sm leading-7 whitespace-pre-wrap text-base-content/80">{opportunity.description}</p>
                  {opportunity.company && (
                    <div className="mt-5 flex items-start gap-2 text-sm">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-base-content/60" aria-hidden="true" />
                      <dl className="min-w-0">
                        <dt className="text-xs text-base-content/70">Company address</dt>
                        <dd className="mt-1 break-words leading-6">{opportunity.company.address}</dd>
                      </dl>
                    </div>
                  )}
                  {renderActions?.(opportunity)}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Opportunity pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1} aria-label="Previous page" title="Previous page">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)}
          disabled={loading || Boolean(error) || !hasNextPage} aria-label="Next page" title="Next page">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
