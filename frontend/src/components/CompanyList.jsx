import { Building2, ChevronLeft, ChevronRight, RotateCw, TriangleAlert } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit' })

export default function CompanyList({ companies, representatives, representativesUnavailable, page, hasNextPage, loading, error, disabled, onRefresh, onPageChange, renderActions }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="companies-heading" aria-busy={loading || disabled}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="companies-heading" className="text-base font-semibold">Registered companies</h2>
        <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading || disabled} onClick={onRefresh}
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
      </p> : <ul className="divide-y divide-base-300">
        {companies.map((company) => {
          const representative = !representativesUnavailable && representatives.find((person) => person.id.toLowerCase() === company.representative?.toLowerCase())
          return <li key={company._id} className="grid min-w-0 gap-6 py-6 lg:grid-cols-2">
            <div className="min-w-0"><h3 className="break-words text-base font-semibold">{company.name}</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-xs text-base-content/60">Contact email</dt><dd className="mt-1 break-all leading-6">{company.contactEmail}</dd></div>
                <div><dt className="text-xs text-base-content/60">Address</dt><dd className="mt-1 break-words leading-6 whitespace-pre-wrap">{company.address}</dd></div>
                <div><dt className="text-xs text-base-content/60">Company ID</dt><dd className="mt-1 break-all font-mono text-xs leading-6">{company._id}</dd></div>
                <div><dt className="text-xs text-base-content/60">Registered</dt><dd className="mt-1 leading-6"><time dateTime={company.createdAt}>{dateFormatter.format(new Date(company.createdAt))} Kabul</time></dd></div>
              </dl>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-base-content/60">Current representative</p>
              <div className="mt-2 mb-5 text-sm leading-6">
                {!company.representative ? <p>Not assigned</p> : <>
                  <p className="break-words font-medium">{representative ? representative.name : representativesUnavailable ? 'Representative details unavailable' : 'Representative account unavailable'}</p>
                  {representative && <><p className="break-all text-base-content/70">{representative.email}</p>
                    {!representative.isActive && <p className="text-warning">Inactive account</p>}</>}
                  <p className="break-all font-mono text-xs text-base-content/60">{company.representative}</p>
                </>}
              </div>
              {renderActions?.(company)}
            </div>
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
