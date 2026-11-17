import { Building2, ChevronLeft, ChevronRight, ClipboardList, RotateCw, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: true,
})
const statuses = {
  pending: { label: 'Pending', color: 'badge-warning' },
  under_review: { label: 'Under review', color: 'badge-info' },
  approved: { label: 'Approved', color: 'badge-success' },
  rejected: { label: 'Rejected', color: 'badge-error' },
  withdrawn: { label: 'Withdrawn', color: 'badge-neutral' },
}

export default function ApplicationList({ applications, page, hasNextPage, loading, error, onRefresh, onPageChange, showStudent = false, renderActions, disabled = false }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="applications-heading" aria-busy={loading || disabled}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="applications-heading" className="text-base font-semibold">Submitted applications</h2>
        <div className="tooltip tooltip-left" data-tip="Refresh applications">
          <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading || disabled} onClick={onRefresh}
            aria-label="Refresh applications" title="Refresh applications">
            <RotateCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading applications...
        </p>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Unable to load applications</p>
            <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
            <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}>
              <RotateCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div role="status" className="py-6 text-sm text-base-content/70">
          <p className="flex items-center gap-3">
            <ClipboardList size={21} className="shrink-0" aria-hidden="true" />
            {page === 1 ? 'No applications yet.' : 'No applications on this page.'}
          </p>
          {page === 1 && !showStudent && <Link className="link link-primary mt-4 inline-block" to="/opportunities">Browse opportunities</Link>}
        </div>
      ) : (
        <ul className="space-y-3">
          {applications.map((application) => {
            const opportunity = application.opportunity
            const status = statuses[application.status]
            return (
              <li key={application._id} className="min-w-0 rounded-lg border border-base-300 bg-base-100 p-4 sm:p-5">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <h3 className="break-words text-base leading-6 font-semibold">{opportunity?.title || 'Opportunity unavailable'}</h3>
                    <p className="mt-2 flex items-start gap-2 text-sm text-base-content/70">
                      <Building2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">{opportunity?.company?.name || 'Company unavailable'}</span>
                    </p>
                  </div>
                  <span className={`badge badge-soft shrink-0 ${status.color}`}>{status.label}</span>
                </div>
                <dl className={`mt-5 grid min-w-0 gap-x-8 gap-y-3 text-xs sm:grid-cols-2 ${showStudent ? 'lg:grid-cols-3' : ''}`}>
                  {showStudent && <div className="min-w-0">
                    <dt className="text-base-content/60">Student</dt>
                    <dd className="mt-1 break-words leading-5">
                      <span className="block font-medium">{application.student?.name || 'Student unavailable'}</span>
                      {application.student && <span className="block break-all text-base-content/70">{application.student.email}</span>}
                    </dd>
                  </div>}
                  <div className="min-w-0">
                    <dt className="text-base-content/60">Applied</dt>
                    <dd className="mt-1 leading-5"><time dateTime={application.createdAt}>
                      {dateFormatter.format(new Date(application.createdAt))} Kabul
                    </time></dd>
                  </div>
                  {opportunity && <div className="min-w-0">
                    <dt className="text-base-content/60">Opportunity deadline</dt>
                    <dd className="mt-1 leading-5"><time dateTime={opportunity.deadline}>
                      {dateFormatter.format(new Date(opportunity.deadline))} Kabul
                    </time></dd>
                  </div>}
                </dl>
                {application.status === 'rejected' && application.rejectionReason && (
                  <div className="mt-4 border-t border-base-300 pt-4 text-sm">
                    <p className="font-medium">Rejection reason</p>
                    <p className="mt-2 break-words leading-6 whitespace-pre-wrap text-base-content/75">{application.rejectionReason}</p>
                  </div>
                )}
                {renderActions?.(application)}
              </li>
            )
          })}
        </ul>
      )}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Application pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)}
          disabled={loading || disabled || page <= 1} aria-label="Previous page" title="Previous page">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)}
          disabled={loading || disabled || Boolean(error) || !hasNextPage} aria-label="Next page" title="Next page">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </nav>
    </section>
  )
}
