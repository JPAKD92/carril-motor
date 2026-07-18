import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
import { Plus } from 'lucide-react'

export function Usuarios() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createUser() {
    if (!email || !name || !password) return
    setSaving(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { setError(signUpError.message); setSaving(false); return }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id, email, name, role,
      })
    }

    setShowForm(false)
    setEmail(''); setName(''); setPassword(''); setRole('operator')
    setSaving(false)
    load()
  }

  if (loading) return <div className="text-center text-gray-500 py-12">Cargando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800">
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3 text-sm">{error}</div>}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Rol</label>
                <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'operator')}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button onClick={createUser} disabled={saving} className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {saving ? '...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {users.map(u => (
          <div key={u.id} className="flex items-center px-4 py-3 gap-4 text-sm">
            <span className="font-medium text-gray-900 flex-1">{u.name}</span>
            <span className="text-gray-500">{u.email}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
              {u.role === 'admin' ? 'Administrador' : 'Operador'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
