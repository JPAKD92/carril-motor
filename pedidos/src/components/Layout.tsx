import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Search, LayoutGrid, History, Upload, Users, LogOut, Truck } from 'lucide-react'

export function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const location = useLocation()

  const linkClass = (path: string) =>
    `flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap ${
      location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
        ? 'bg-gray-800 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 gap-2">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src="/logo.png" alt="Carril Motor" className="h-8" />
              <span className="text-sm font-semibold text-gray-300 hidden sm:inline">Pedidos</span>
            </Link>
            <div className="flex items-center gap-1 overflow-x-auto">
              <Link to="/" className={linkClass('/')}>
                <Search size={16} />
                Buscador
              </Link>
              <Link to="/panel" className={linkClass('/panel')}>
                <LayoutGrid size={16} />
                Panel
              </Link>
              <Link to="/historial" className={linkClass('/historial')}>
                <History size={16} />
                Historial
              </Link>
              {isAdmin && (
                <>
                  <Link to="/proveedores" className={linkClass('/proveedores')}>
                    <Truck size={16} />
                    Proveedores
                  </Link>
                  <Link to="/importar" className={linkClass('/importar')}>
                    <Upload size={16} />
                    Importar
                  </Link>
                  <Link to="/usuarios" className={linkClass('/usuarios')}>
                    <Users size={16} />
                    Usuarios
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-gray-400 hidden sm:inline">{profile?.name}</span>
            <button onClick={signOut} className="text-gray-400 hover:text-white" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
