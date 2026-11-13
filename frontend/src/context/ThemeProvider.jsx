import { useLayoutEffect, useState } from 'react'
import { ThemeContext } from './ThemeContext'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const savedTheme = window.localStorage.getItem('sims-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  } catch {
    // Theme switching still works when the browser blocks local storage.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem('sims-theme', theme)
    } catch {
      // Saving is optional; applying the selected theme is not.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((currentTheme) => currentTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
