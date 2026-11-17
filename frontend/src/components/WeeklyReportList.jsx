import { ChevronDown, ChevronLeft, ChevronRight, FileText, Pencil, RotateCw, Send, TriangleAlert } from 'lucide-react'
import { canEditWeeklyReport } from '../context/weeklyReportApi'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })

export default function WeeklyReportList({ reports, page, hasNextPage, loading, error, disabled = false, actionsDisabled = false, student = false, submittingId, editingId, onRefresh, onPageChange, onEdit, onSubmit }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="weekly-reports-heading" aria-busy={loading || disabled}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="weekly-reports-heading" className="text-base font-semibold">Weekly reports</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={onRefresh} disabled={loading || disabled}
          aria-label="Refresh weekly reports" title="Refresh weekly reports"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading weekly reports...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Unable to load weekly reports</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" disabled={disabled} onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : !reports.length ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <FileText size={21} className="shrink-0" aria-hidden="true" /> {page === 1 ? 'No weekly reports yet.' : 'No weekly reports on this page.'}
      </p> : <ul className="space-y-3">
        {reports.map((report) => <li key={report._id} className="min-w-0 rounded-lg border border-base-300 bg-base-100 p-4 sm:p-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 basis-40">
                <span className="block text-base font-semibold">Week {report.weekNumber}</span>
                <span className="mt-1 block break-words text-sm leading-6 text-base-content/70">
                  <time dateTime={report.weekStart.slice(0, 10)}>{dateFormatter.format(new Date(report.weekStart))}</time>
                  {' to '}<time dateTime={report.weekEnd.slice(0, 10)}>{dateFormatter.format(new Date(report.weekEnd))}</time>
                </span>
              </span>
              <span className={`badge badge-soft shrink-0 ${report.status === 'draft' ? 'badge-neutral' : 'badge-info'}`}>{report.status === 'draft' ? 'Draft' : 'Submitted'}</span>
              <ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <dl className="mt-5 grid min-w-0 gap-4 border-t border-base-300 pt-5 text-sm sm:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs text-base-content/60">Student</dt><dd className="mt-1 break-words leading-6">
                {report.student?.name || 'Student unavailable'}{report.student && <span className="block break-all text-xs text-base-content/70">{report.student.email}</span>}
              </dd></div>
              <div className="min-w-0"><dt className="text-xs text-base-content/60">Internship dates</dt><dd className="mt-1 break-words leading-6">
                {report.internship ? `${dateFormatter.format(new Date(report.internship.startDate))} to ${dateFormatter.format(new Date(report.internship.endDate))}` : 'Internship unavailable'}
              </dd></div>
              {[['summary', 'Weekly summary'], ['learning', 'What I learned'], ['challenges', 'Challenges']].map(([name, label]) => report[name] && <div key={name} className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-base-content/60">{label}</dt><dd className="mt-1 break-words leading-6 whitespace-pre-wrap">{report[name]}</dd>
              </div>)}
              {report.submittedAt && <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-base-content/60">Submitted</dt><dd className="mt-1 leading-6">
                <time dateTime={report.submittedAt}>{timeFormatter.format(new Date(report.submittedAt))} Kabul</time>
              </dd></div>}
            </dl>
          </details>
          {student && canEditWeeklyReport(report) && <div className="mt-5 flex flex-wrap gap-2 border-t border-base-300 pt-4">
            <button className="btn btn-outline btn-sm" type="button" disabled={disabled || actionsDisabled || Boolean(editingId)} onClick={() => onEdit(report)}><Pencil size={15} aria-hidden="true" /> Edit report</button>
            <button className="btn btn-primary btn-sm min-w-36" type="button" disabled={disabled || actionsDisabled || Boolean(editingId)} onClick={() => onSubmit(report)}>
              {submittingId === report._id ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Submitting...</>
                : <><Send size={15} aria-hidden="true" /> Submit report</>}
            </button>
          </div>}
        </li>)}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Weekly report pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || disabled || page <= 1}
          aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || disabled || Boolean(error) || !hasNextPage}
          aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
    </section>
  )
}
