import { Building2, CalendarDays, ChevronLeft, ChevronRight, Hash, Mail, MapPin, RotateCw, TriangleAlert, UserRound } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit' })
const accents = [
  { icon: 'bg-primary/10 text-primary', border: 'border-t-primary/60' },
  { icon: 'bg-info/10 text-info', border: 'border-t-info/60' },
  { icon: 'bg-secondary/10 text-secondary', border: 'border-t-secondary/60' },
  { icon: 'bg-warning/10 text-warning', border: 'border-t-warning/60' },
]

export default function CompanyList({ companies, representatives, representativesUnavailable, page, hasNextPage, loading, error, disabled, onRefresh, onPageChange, renderActions }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="companies-heading" aria-busy={loading || disabled}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 id="companies-heading" className="min-w-0 text-base font-semibold">Registered companies</h2>
        <button className="btn btn-ghost btn-square btn-sm shrink-0" type="button" disabled={loading || disabled} onClick={onRefresh}
          aria-label="Refresh companies and representatives" title="Refresh companies and representatives"><RotateCw size={17} aria-hidden="true" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading companies...
      </p> : error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
        <div className="min-w-0"><p className="text-sm font-semibold">Unable to load companies</p>
          <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
          <button className="btn btn-outline btn-sm mt-3" type="button" disabled={disabled} onClick={onRefresh}><RotateCw size={15} aria-hidden="true" /> Retry</button>
        </div>
      </div> : !companies.length ? <p role="status" className="flex items-center gap-3 py-6 text-sm text-base-content/70">
        <Building2 size={21} className="shrink-0" aria-hidden="true" /> {page === 1 ? 'No companies yet.' : 'No companies on this page.'}
      </p> : <ul className="grid min-w-0 gap-5 xl:grid-cols-2">
        {companies.map((company, index) => {
          const representative = !representativesUnavailable && representatives.find((person) => person.id.toLowerCase() === company.representative?.toLowerCase())
          const accent = accents[index % accents.length]
          return <li key={company._id} className="min-w-0">
            <article aria-labelledby={`company-${company._id}-heading`}
              className={`company-record flex h-full min-w-0 flex-col rounded-lg border border-base-300 border-t-2 bg-base-100 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none ${accent.border}`}>
              <div className="min-w-0 flex-1 p-5 sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex size-12 shrink-0 items-center justify-center rounded-md ${accent.icon}`}><Building2 size={24} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-medium text-base-content/60">Company</p>
                    <h3 id={`company-${company._id}-heading`} className="break-words text-lg leading-7 font-semibold">{company.name}</h3>
                  </div>
                </div>
                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    <Mail size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
                    <div className="min-w-0"><dt className="text-xs text-base-content/65">Contact email</dt>
                      <dd className="mt-1 break-all leading-6"><a href={`mailto:${encodeURIComponent(company.contactEmail)}`} className="rounded-sm hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{company.contactEmail}</a></dd>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0"><dt className="text-xs text-base-content/65">Address</dt>
                      <dd className="mt-1 break-words leading-6 whitespace-pre-wrap">{company.address}</dd>
                    </div>
                  </div>
                </dl>
                <dl className="mt-5 grid min-w-0 gap-4 border-t border-base-300 pt-5 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="flex items-center gap-2 text-base-content/65"><Hash size={14} aria-hidden="true" /> Company ID</dt>
                    <dd className="mt-2 break-all font-mono leading-5">{company._id}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="flex items-center gap-2 text-base-content/65"><CalendarDays size={14} aria-hidden="true" /> Registered</dt>
                    <dd className="mt-2 leading-5"><time dateTime={company.createdAt}>{dateFormatter.format(new Date(company.createdAt))} Kabul</time></dd>
                  </div>
                </dl>
                <div className="mt-5 flex min-w-0 items-start gap-3 border-t border-base-300 pt-5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-base-200 text-base-content/65"><UserRound size={16} aria-hidden="true" /></span>
                  <div className="min-w-0 text-sm leading-6">
                    <p className="mb-1 text-xs text-base-content/65">Current representative</p>
                    {!company.representative ? <p className="text-base-content/70">Not assigned</p> : <>
                      <p className="break-words font-medium">{representative ? representative.name : representativesUnavailable ? 'Representative details unavailable' : 'Representative account unavailable'}</p>
                      {representative && <><p className="break-all text-base-content/70">{representative.email}</p>
                        {!representative.isActive && <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-base-content"><span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" /> Inactive account</p>}</>}
                      <p className="mt-1 break-all font-mono text-xs text-base-content/65">{company.representative}</p>
                    </>}
                  </div>
                </div>
              </div>
              {renderActions && <div className="min-w-0 border-t border-base-300 bg-base-200/40 p-5 sm:p-6">{renderActions(company)}</div>}
            </article>
          </li>
        })}
      </ul>}
      <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Company pages">
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || disabled || page <= 1}
          aria-label="Previous page" title="Previous page"><ChevronLeft size={18} aria-hidden="true" /></button>
        <span className="w-32 text-center text-sm tabular-nums" aria-current="page">Page {page}</span>
        <button className="btn btn-ghost btn-square btn-sm" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || disabled || Boolean(error) || !hasNextPage}
          aria-label="Next page" title="Next page"><ChevronRight size={18} aria-hidden="true" /></button>
      </nav>
    </section>
  )
}
