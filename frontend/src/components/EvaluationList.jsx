import { ChevronLeft, ChevronRight, ClipboardCheck, RotateCw, TriangleAlert } from 'lucide-react'

const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })

export default function EvaluationList({ evaluations, page, hasNextPage, loading, error, disabled = false, onRefresh, onPageChange }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="evaluations-heading" aria-busy={loading || disabled}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="evaluations-heading" className="text-base font-semibold">Final evaluations</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading || disabled} onClick={onRefresh}
          aria-label="Refresh evaluations" title="Refresh evaluations"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading evaluations...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Unable to load evaluations</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" disabled={disabled} onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : !evaluations.length ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <ClipboardCheck size={21} className="shrink-0" aria-hidden="true" /> {page === 1 ? 'No evaluations yet.' : 'No evaluations on this page.'}
      </p> : <ul className="space-y-3">
        {evaluations.map((evaluation) => <li key={evaluation._id} className="min-w-0 rounded-lg border border-base-300 bg-base-100 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-40"><h3 className="break-words text-base font-semibold">{evaluation.student?.name || 'Student unavailable'}</h3>
              {evaluation.student && <p className="mt-1 break-all text-xs leading-6 text-base-content/70">{evaluation.student.email}</p>}
              <span className={`badge badge-soft mt-2 ${evaluation.type === 'academic' ? 'badge-info' : 'badge-neutral'}`}>{evaluation.type === 'academic' ? 'Academic' : 'Company'}</span>
            </div>
            <p className="min-w-24 max-w-full break-all text-right text-lg leading-7 font-semibold tabular-nums">{evaluation.score}<span className="text-sm font-normal text-base-content/60"> / 100</span></p>
          </div>
          <dl className="mt-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0"><dt className="text-xs text-base-content/60">Evaluator</dt><dd className="mt-1 break-words leading-6">{evaluation.evaluator?.name || 'Evaluator unavailable'}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-base-content/60">Recorded</dt><dd className="mt-1 leading-6">
              <time dateTime={evaluation.createdAt}>{timeFormatter.format(new Date(evaluation.createdAt))} Kabul</time>
            </dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-base-content/60">Internship ID</dt><dd className="mt-1 break-all font-mono text-xs leading-6">{evaluation.internship}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-base-content/60">Comments</dt><dd className="mt-1 break-words leading-6 whitespace-pre-wrap">{evaluation.comments}</dd></div>
          </dl>
        </li>)}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Evaluation pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || disabled || page <= 1}
          aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || disabled || Boolean(error) || !hasNextPage}
          aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
    </section>
  )
}
