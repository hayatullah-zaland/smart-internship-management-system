import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { searchWorkspacePages } from './workspaceNavigation'

export default function NavbarSearch({ role }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const matches = searchWorkspacePages(role, query)
  const expanded = open && Boolean(query.trim())

  useEffect(() => {
    function dismiss(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  useEffect(() => {
    if (expanded && active >= 0) containerRef.current?.querySelector(`#workspace-search-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, expanded])

  function choose(link) {
    setOpen(false)
    setQuery('')
    setActive(-1)
    navigate(link.to)
  }

  function keyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key) && query.trim()) {
      event.preventDefault()
      setOpen(true)
      if (matches.length) setActive((current) => event.key === 'ArrowDown'
        ? (current + 1) % matches.length : (current <= 0 ? matches.length : current) - 1)
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <form role="search" aria-label="Workspace pages" autoComplete="off" onSubmit={(event) => {
        event.preventDefault()
        const match = matches[active < 0 ? 0 : active]
        if (match) choose(match)
        else setOpen(true)
      }}>
        <label htmlFor="workspace-search" className="sr-only">Search workspace pages</label>
        <div className="relative">
          <Search size={17} className="pointer-events-none absolute top-3.5 left-3 z-10 text-base-content/50" aria-hidden="true" />
          <input ref={inputRef} id="workspace-search" name="workspaceSearch" type="search" role="combobox"
            className={`input navbar-search-input h-11 w-full min-w-0 border-base-300 bg-base-200/60 pl-9 text-sm focus:border-primary ${query ? 'pr-10' : 'pr-3'}`}
            placeholder="Search pages" maxLength={80} value={query} onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true) }}
            onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown} aria-autocomplete="list" aria-expanded={expanded}
            aria-controls={expanded ? 'workspace-search-results' : undefined}
            aria-activedescendant={expanded && matches[active] ? `workspace-search-option-${active}` : undefined} />
          {query && <button type="button" className="btn btn-ghost btn-square btn-sm absolute top-1.5 right-1 z-10" aria-label="Clear search" title="Clear search"
            onClick={() => { setQuery(''); setActive(-1); setOpen(false); inputRef.current?.focus() }}><X size={16} aria-hidden="true" /></button>}
        </div>
      </form>
      {expanded && <div className="navbar-search-results absolute top-full left-0 z-40 mt-2 overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-lg">
        <p className="border-b border-base-300 px-3 py-2 text-xs font-medium text-base-content/65">Pages</p>
        <ul id="workspace-search-results" role="listbox" aria-label="Workspace page results" className="max-h-72 overflow-y-auto overscroll-contain p-1.5">
          {matches.map((link, index) => <li key={link.to} role="presentation">
            <button type="button" id={`workspace-search-option-${index}`} role="option" aria-selected={active === index} tabIndex={-1}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${active === index ? 'bg-primary/10 text-primary' : 'text-base-content hover:bg-base-200'}`}
              onMouseEnter={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(link)}>
              <link.Icon size={18} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{link.label}</span>
            </button>
          </li>)}
        </ul>
        {matches.length === 0 && <p role="status" className="px-4 pt-1 pb-4 text-sm text-base-content/70">No matching pages.</p>}
      </div>}
    </div>
  )
}
