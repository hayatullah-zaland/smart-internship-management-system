import { ShieldCheck } from 'lucide-react'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'

export default function AuthLayout({ children, headingId }) {
  return (
    <div className="flex min-h-svh flex-col bg-base-200 text-base-content">
      <header className="border-b border-base-300 bg-base-100">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden items-center gap-2 text-sm text-base-content/65 sm:inline-flex">
              <ShieldCheck size={16} aria-hidden="true" /> University portal
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:py-16">
        <section className="w-full max-w-md rounded-lg border border-base-300 bg-base-100 p-6 shadow-sm sm:p-9" aria-labelledby={headingId}>
          {children}
        </section>
      </main>
      <footer className="px-5 pb-6 text-center text-xs leading-5 text-base-content/65">
        Smart Internship Management System
      </footer>
    </div>
  )
}
