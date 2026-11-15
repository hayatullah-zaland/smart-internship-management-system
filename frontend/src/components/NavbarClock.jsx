import { useEffect, useState } from 'react'
import { CalendarDays, Clock3 } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kabul', year: 'numeric', month: 'short', day: '2-digit',
})
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kabul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
})

export default function NavbarClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time dateTime={now.toISOString()} aria-live="off" title="Kabul time (Asia/Kabul)"
      className="flex h-9 w-full min-w-0 items-center justify-between gap-3 xl:w-auto xl:justify-start xl:gap-4">
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-base-content/70">
        <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
        {dateFormatter.format(now)}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Clock3 size={14} className="text-base-content/70" aria-hidden="true" />
        <span className="inline-block w-[11ch] whitespace-nowrap text-right text-sm font-medium tabular-nums">
          {timeFormatter.format(now)}
        </span>
        <span className="text-xs text-base-content/70">Kabul</span>
      </span>
    </time>
  )
}
