import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import Brand from './Brand'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const drawerRef = useRef(null)
  const location = useLocation()

  function closeSidebar() {
    setSidebarOpen(false)
  }

  useEffect(() => {
    const drawer = drawerRef.current
    if (!sidebarOpen) {
      if (drawer.open) drawer.close()
      return
    }

    // The native modal keeps keyboard focus inside and handles Escape.
    if (!drawer.open) drawer.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [sidebarOpen])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)')
    function closeOnDesktop() {
      if (desktop.matches) setSidebarOpen(false)
    }
    function closeOnHistory() {
      setSidebarOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    window.addEventListener('popstate', closeOnHistory)
    return () => {
      desktop.removeEventListener('change', closeOnDesktop)
      window.removeEventListener('popstate', closeOnHistory)
    }
  }, [])

  useEffect(() => {
    if (location.hash === '#account') {
      const account = document.getElementById('account')
      account?.focus({ preventScroll: true })
      account?.scrollIntoView({ block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, location.hash])

  return (
    <div className="min-h-svh bg-base-200 text-base-content lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-content focus:not-sr-only focus:fixed focus:top-4 focus:left-4">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh min-h-0 flex-col border-r border-base-300 bg-base-100 lg:flex" aria-label="Desktop sidebar">
        <div className="flex h-20 shrink-0 items-center border-b border-base-300 px-6">
          <Link to="/dashboard" aria-label="SIMS dashboard" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <Brand />
          </Link>
        </div>
        <Sidebar />
      </aside>
      <div className="min-w-0">
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl scroll-mt-44 px-5 py-8 outline-none sm:scroll-mt-36 sm:px-6 lg:px-8 lg:py-10 xl:scroll-mt-24">
          {children}
        </main>
      </div>
      <dialog ref={drawerRef} id="mobile-sidebar" className="app-drawer shadow-xl"
        aria-labelledby="mobile-navigation-heading" onClose={closeSidebar}
        onClick={(event) => { if (event.target === event.currentTarget) closeSidebar() }}>
        <div className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-base-300 px-4">
          <h2 id="mobile-navigation-heading" className="sr-only">Navigation</h2>
          <Link to="/dashboard" onClick={closeSidebar} aria-label="SIMS dashboard"
            className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Brand />
          </Link>
          <button className="btn btn-ghost btn-square shrink-0" type="button" onClick={closeSidebar}
            autoFocus aria-label="Close navigation" title="Close navigation">
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        <Sidebar onNavigate={closeSidebar} />
      </dialog>
    </div>
  )
}
