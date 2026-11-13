import { useState } from 'react'
import Login from './pages/Login'
import Signup from './pages/Signup'

function App() {
  const [page, setPage] = useState('login')

  if (page === 'signup') {
    return <Signup onGoToLogin={() => setPage('login')} />
  }
  return <Login onGoToSignup={() => setPage('signup')} />
}

export default App
