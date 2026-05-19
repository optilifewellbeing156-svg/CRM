import { useState, useEffect } from "react";
import { UserPlus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { SlideOver } from "@/components/ui/SlideOver";
import { PERMISSIONS, type Me } from "@/types";
import type { User } from "@/types";
import { useMe } from "@/hooks/useMe";

type UserForm = {
  username: string;
  password: string;
  role: "SUPER_ADMIN" | "ADMIN" | "USER";
  commissionRate: string;
  permissions: string[];
  isActive: boolean;
};
const emptyForm: UserForm = { username: "", password: "", role: "USER", commissionRate: "0", permissions: [], isActive: true };

const ROLE_BADGE: Record<string, "default" | "success" | "warning"> = {
  SUPER_ADMIN: "warning",
  ADMIN: "default",
  USER: "success",
};

export default function UsersPage() {
  const me = useMe() as Me;
  const isSuperAdmin = me?.role === "SUPER_ADMIN";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/users", { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: User[]) => { setError(false); setUsers(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  };

  useEffect(() => { fetchUsers(); }, []);

  function openCreate() {
    setEditUser(null); setForm(emptyForm); setFormError(""); setSlideOpen(true);
  }
  function openEdit(u: User) {
    setEditUser(u);
    setForm({ username: u.username, password: "", role: u.role, commissionRate: String(Number(u.commissionRate)), permissions: u.permissions ?? [], isActive: u.isActive });
    setFormError(""); setSlideOpen(true);
  }

  async function handleSave() {
    setSaving(true); setFormError("");
    const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
    const method = editUser ? "PUT" : "POST";
    const body = editUser
      ? { username: form.username, role: form.role, commissionRate: Number(form.commissionRate), permissions: form.permissions, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) }
      : { username: form.username, password: form.password, role: form.role, commissionRate: Number(form.commissionRate), permissions: form.permissions };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setFormError(data.error ?? "Failed"); return; }
    setSlideOpen(false); fetchUsers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false); setDeleteTarget(null); fetchUsers();
  }

  function togglePermission(key: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  }

  if (error) return <p className="text-center py-20 text-sm text-red-500">Failed to load users.</p>;

  const permissionGroups = PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS[number][]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        {isSuperAdmin && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <UserPlus size={16} /> Add User
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No users yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
              <tr>
                {["Username", "Role", "Status", "Commission", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_BADGE[u.role] ?? "success"}>
                      {u.role === "SUPER_ADMIN" ? "Owner" : u.role === "ADMIN" ? "Admin" : "User"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Active</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={12} /> Inactive</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500">{Number(u.commissionRate)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-primary"><Pencil size={15} /></button>
                      {isSuperAdmin && u.role !== "SUPER_ADMIN" && (
                        <button onClick={() => setDeleteTarget(u)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SlideOver open={slideOpen} title={editUser ? "Edit User" : "Add User"} onClose={() => setSlideOpen(false)}>
        <div className="space-y-4">
          <Input label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
          <Input label={editUser ? "New Password (leave blank to keep)" : "Password"} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />

          {isSuperAdmin && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserForm["role"] }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          )}

          <Input label="Commission Rate (%)" type="number" step="0.01" min="0" value={form.commissionRate} onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))} />

          {editUser && (
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Active</span>
            </div>
          )}

          {isSuperAdmin && form.role !== "SUPER_ADMIN" && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Permissions</label>
              <div className="space-y-3">
                {Object.entries(permissionGroups).map(([group, perms]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{group}</p>
                    {perms.map((p) => (
                      <label key={p.key} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePermission(p.key)} className="rounded" />
                        <span className="text-sm text-gray-700">{p.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <Button onClick={handleSave} loading={saving} className="w-full">
            {editUser ? "Update User" : "Create User"}
          </Button>
        </div>
      </SlideOver>

      <Modal open={!!deleteTarget} title="Delete User" onClose={() => setDeleteTarget(null)}>
        <p className="text-sm text-gray-600 mb-4">Delete user <strong>{deleteTarget?.username}</strong>?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
