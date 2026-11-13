import { GraduationCap } from 'lucide-react'

export default function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-content">
        <GraduationCap size={24} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg leading-6 font-bold text-base-content">SIMS</p>
        <p className="text-xs leading-5 text-base-content/65">Internship Management</p>
      </div>
    </div>
  )
}
