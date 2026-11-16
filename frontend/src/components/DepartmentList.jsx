import { GraduationCap, RotateCw, TriangleAlert } from 'lucide-react'

export default function DepartmentList({ departments, loading, error, onRefresh }) {
  return (
    <section className="border-b border-base-300 py-8" aria-labelledby="department-list-heading" aria-busy={loading}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="department-list-heading" className="min-w-0 text-base font-semibold">Registered departments</h2>
        <div className="tooltip tooltip-left" data-tip="Refresh departments">
          <button className="btn btn-ghost btn-square btn-sm" type="button" disabled={loading} onClick={onRefresh}
            aria-label="Refresh department list" title="Refresh departments">
            <RotateCw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-3 py-5 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" aria-hidden="true" /> Loading departments...
        </p>
      ) : error ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-error/40 bg-error/10 p-4">
          <TriangleAlert size={20} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Unable to load departments</p>
            <p className="mt-1 break-words text-sm leading-6 text-base-content/75">{error}</p>
            <button className="btn btn-outline btn-sm mt-3" type="button" onClick={onRefresh}>
              <RotateCw size={15} aria-hidden="true" /> Retry
            </button>
          </div>
        </div>
      ) : departments.length === 0 ? (
        <p role="status" className="flex items-center gap-3 py-5 text-sm text-base-content/70">
          <GraduationCap size={21} className="shrink-0" aria-hidden="true" /> No departments yet.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="table w-full table-fixed text-sm">
            <caption className="sr-only">{departments.length} registered {departments.length === 1 ? 'department' : 'departments'}</caption>
            <thead>
              <tr className="border-base-300 text-base-content/70">
                <th scope="col" className="font-medium">Department</th>
                <th scope="col" className="w-24 font-medium sm:w-36">Code</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department._id} className="border-base-300">
                  <td className="break-words whitespace-normal font-medium">{department.name}</td>
                  <td className="break-all whitespace-normal font-mono text-xs">{department.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
