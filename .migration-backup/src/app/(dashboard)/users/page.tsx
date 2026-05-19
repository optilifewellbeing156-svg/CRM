'use client'
import { useState, useEffect } from 'react'
import { UserPlus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { SlideOver } from '@/components/ui/SlideOver'
import { PERMISSIONS } from '@/lib/constants'

type User = {
  id: string
  username: string
  role: 'ADMIN' | 'USER'
  isActive: boolean
  commissionRate: string
  permissions: string[]
  createdAt: string
}

type UserForm = {
  username: string
  password: string
  role: 'ADMIN' | 'USER'
  commissionRate: string
  permissions: string[]
}

const emptyForm: UserForm = { username: '', password: '', role: 'USER', commissionRate: '0', permissions: [] }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/users')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: User[]) => { setError(false); setUsers(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetchUsers() }, [])

  function openCreate() {
    setEditUser(null)
    setForm(emptyForm)
    setFormError('')
    setSlideOpen(true)
  }

  function openEdit(u: User) {
    setEditUser(u)
    setForm({ username: u.username, password: '', role: u.role, commissionRate: String(Number(u.commissionRate)), permissions: u.permissions ?? [] })
    setFormError('')
    setSlideOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setFormError('')
    const url = editUser ? `/api/users/${editUser.id}` : '/api/users'
    const method = editUser ? 'PUT' : 'POST'
    const body = editUser
      ? {
          username: form.username,
          role: form.role,
          commissionRate: Number(form.commissionRate),
          permissions: form.permissions,
          ...(form.password ? { password: form.password } : {}),
        }
      : { username: form.username, password: form.password, role: form.role, commissionRate: Number(form.commissionRate), permissions: form.permissions }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(data.error || 'Something went wrong'); return }
    setSlideOpen(false)
    fetchUsers()
  }

  async function handleToggleActive(u: User) {
    await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    fetchUsers()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchUsers()
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <p className="text-center py-20 text-sm text-red-500">Failed to load users.</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <UserPlus size={16} /> Add User
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No users yet. Add your first user.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Username</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Commission</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'ADMIN' ? 'warning' : 'default'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">{Number(u.commissionRate).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {u.isActive ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit SlideOver */}
      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editUser ? 'Edit User' : 'Add User'}>
        <div className="space-y-4">
          <Input
            label="Username"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
          />
          {!editUser ? (
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          ) : (
            <Input
              label="New Password (leave blank to keep current)"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as 'ADMIN' | 'USER' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
            {form.role === 'ADMIN' ? (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-xs text-gray-500 italic">ADMIN has full access — no restrictions</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                {/* Group permissions by section */}
                {Array.from(new Set(PERMISSIONS.map(p => p.group))).map(group => {
                  const groupPerms = PERMISSIONS.filter(p => p.group === group)
                  const allChecked = groupPerms.every(p => form.permissions.includes(p.key))
                  const someChecked = groupPerms.some(p => form.permissions.includes(p.key))
                  return (
                    <div key={group} className="border-b border-gray-200 last:border-b-0">
                      {/* Group header with select-all */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-100">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group}</span>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            permissions: allChecked
                              ? f.permissions.filter(k => !groupPerms.map(p => p.key).includes(k as any))
                              : Array.from(new Set([...f.permissions, ...groupPerms.map(p => p.key)]))
                          }))}
                          className="text-xs text-primary hover:underline"
                        >
                          {allChecked ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                      {/* Permission checkboxes */}
                      <div className="px-3 py-2 space-y-2">
                        {groupPerms.map(p => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(p.key)}
                              onChange={e => setForm(f => ({
                                ...f,
                                permissions: e.target.checked
                                  ? [...f.permissions, p.key]
                                  : f.permissions.filter(x => x !== p.key)
                              }))}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm text-gray-700">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <Input
            label="Commission Rate (%)"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.commissionRate}
            onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editUser ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </SlideOver>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete User">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{deleteTarget?.username}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
