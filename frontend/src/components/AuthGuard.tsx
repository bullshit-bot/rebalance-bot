// Route guard — redirects unauthenticated users to /login
// Checks for an API key in localStorage set by LoginPage

import { Navigate } from 'react-router-dom'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const apiKey = localStorage.getItem('apiKey')
  if (!apiKey) return <Navigate to="/login" replace />
  return <>{children}</>
}
