import { ArrowLeft, Check, ClipboardCheck } from 'lucide-react'

export default function EvaluationForm({ values, errors, internships, academic, loading, optionsError, disabled, saving, confirming, onChange, onReview, onConfirm, onBack }) {
  const selected = internships.find((item) => item._id === values.internshipId)
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="evaluation-form-heading">
      <h2 id="evaluation-form-heading" className="text-base font-semibold">{confirming ? 'Confirm final evaluation' : 'New final evaluation'}</h2>
      {confirming ? <form className="mt-5 max-w-3xl" aria-label="Confirm final evaluation" aria-busy={saving} onSubmit={onConfirm}>
        <dl className="grid min-w-0 gap-5 text-sm sm:grid-cols-2">
          {academic && selected && <div className="min-w-0"><dt className="text-xs text-base-content/60">Student</dt>
            <dd className="mt-1 break-words leading-6">{selected.student.name}<span className="block break-all text-xs text-base-content/70">{selected.student.email}</span></dd></div>}
          <div className="min-w-0"><dt className="text-xs text-base-content/60">Internship ID</dt><dd className="mt-1 break-all font-mono text-xs leading-6">{values.internshipId}</dd></div>
          <div className="min-w-0"><dt className="text-xs text-base-content/60">Score</dt><dd className="mt-1 break-all text-lg font-semibold tabular-nums">{Number(values.score)} / 100</dd></div>
          <div className="min-w-0"><dt className="text-xs text-base-content/60">Evaluation type</dt><dd className="mt-1 leading-6">{academic ? 'Academic' : 'Company'}</dd></div>
          <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-base-content/60">Comments</dt><dd className="mt-1 break-words leading-6 whitespace-pre-wrap">{values.comments.trim()}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-outline" type="button" disabled={disabled || saving} onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back</button>
          <button className="btn btn-primary min-w-44" type="submit" disabled={disabled || saving}>
            {saving ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Recording...</>
              : <><Check size={17} aria-hidden="true" /> Record evaluation</>}
          </button>
        </div>
      </form> : <>
        {academic && loading && <p role="status" className="mt-4 text-sm text-base-content/70">Loading completed internships...</p>}
        {academic && optionsError && <p role="alert" className="mt-4 break-words text-sm text-error">{optionsError}</p>}
        {academic && !loading && !optionsError && !internships.length && <p role="status" className="mt-4 text-sm text-base-content/70">No completed internships available.</p>}
        <form className="mt-5 max-w-3xl" aria-label="New final evaluation" onSubmit={onReview} noValidate>
          <fieldset disabled={disabled || saving} className="grid min-w-0 gap-5 sm:grid-cols-2">
            <legend className="sr-only">Final evaluation details</legend>
            <div className="min-w-0 sm:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="evaluation-internshipId">{academic ? 'Completed internship' : 'Internship ID'}</label>
              {academic ? <select id="evaluation-internshipId" name="internshipId" className={`select w-full ${errors.internshipId ? 'select-error' : ''}`}
                value={values.internshipId} onChange={onChange} required disabled={loading || Boolean(optionsError) || !internships.length}
                aria-invalid={Boolean(errors.internshipId)} aria-describedby={errors.internshipId ? 'evaluation-internshipId-error' : undefined}>
                <option value="" disabled>Choose a completed internship</option>
                {values.internshipId && !selected && <option value={values.internshipId} disabled>Internship no longer available</option>}
                {internships.map((item) => <option key={item._id} value={item._id}>{item.student.name} ({item.student.email}) - {item.opportunity?.title || 'Opportunity unavailable'} - {item.company?.name || 'Company unavailable'}</option>)}
              </select> : <input id="evaluation-internshipId" name="internshipId" className={`input w-full min-w-0 font-mono text-sm ${errors.internshipId ? 'input-error' : ''}`}
                value={values.internshipId} onChange={onChange} required minLength={24} maxLength={24} autoCapitalize="none" spellCheck={false}
                aria-invalid={Boolean(errors.internshipId)} aria-describedby={errors.internshipId ? 'evaluation-internshipId-error' : undefined} />}
              {errors.internshipId && <p id="evaluation-internshipId-error" className="mt-2 text-xs text-error">{errors.internshipId}</p>}
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium" htmlFor="evaluation-score">Score / 100</label>
              <input id="evaluation-score" name="score" type="number" min={0} max={100} step="any" required className={`input w-full min-w-0 ${errors.score ? 'input-error' : ''}`}
                value={values.score} onChange={onChange} aria-invalid={Boolean(errors.score)} aria-describedby={errors.score ? 'evaluation-score-error' : undefined} />
              {errors.score && <p id="evaluation-score-error" className="mt-2 text-xs text-error">{errors.score}</p>}
            </div>
            <div className="min-w-0 sm:col-span-2">
              <label className="mb-2 block text-sm font-medium" htmlFor="evaluation-comments">Comments</label>
              <textarea id="evaluation-comments" name="comments" rows={4} maxLength={2000} required className={`textarea w-full min-w-0 leading-6 ${errors.comments ? 'textarea-error' : ''}`}
                value={values.comments} onChange={onChange} aria-invalid={Boolean(errors.comments)} aria-describedby={errors.comments ? 'evaluation-comments-error' : undefined} />
              {errors.comments && <p id="evaluation-comments-error" className="mt-2 text-xs text-error">{errors.comments}</p>}
            </div>
          </fieldset>
          <button className="btn btn-primary mt-6" type="submit" disabled={disabled || saving}><ClipboardCheck size={17} aria-hidden="true" /> Review evaluation</button>
        </form>
      </>}
    </section>
  )
}
