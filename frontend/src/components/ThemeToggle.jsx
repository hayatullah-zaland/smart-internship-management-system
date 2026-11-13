import { useContext } from 'react'
import { Moon, Sun } from 'lucide-react'
import { ThemeContext } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext)
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <div className="tooltip tooltip-bottom" data-tip={label}>
      <button className="btn btn-ghost btn-square" type="button"
        onClick={toggleTheme} aria-label="Dark mode" aria-pressed={theme === 'dark'} title={label}>
        {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
      </button>
    </div>
  )
}
