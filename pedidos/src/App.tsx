import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'
import { Buscador } from './pages/Buscador'
import { Panel } from './pages/Panel'
import { Historial } from './pages/Historial'
import { Importar } from './pages/Importar'
import { Usuarios } from './pages/Usuarios'
import { Layout } from './components/Layout'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Cargando...</div>
  if (!session) return <Navigate to="/login" />
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/" />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Buscador />} />
            <Route path="panel" element={<Panel />} />
            <Route path="historial" element={<Historial />} />
            <Route path="importar" element={<AdminRoute><Importar /></AdminRoute>} />
            <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
