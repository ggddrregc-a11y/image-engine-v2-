
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminUser, UserRole } from '@/lib/admin-types';
import {
  AdminCard,
  AdminButton,
  AdminInput,
  AdminLabel,
  AdminSelect,
  AdminBadge,
  AdminLoading,
  AdminEmptyState,
  AdminToggle,
} from '../shared';
import { cn } from '@/lib/utils';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'user', label: 'User' },
  { value: 'guest', label: 'Guest' },
];

const PERMISSIONS = [
  { key: 'can_generate', label: 'Can Generate' },
  { key: 'can_view_gallery', label: 'Can View Gallery' },
  { key: 'can_edit_templates', label: 'Can Edit Templates' },
  { key: 'can_manage_models', label: 'Can Manage Models' },
  { key: 'can_manage_providers', label: 'Can Manage Providers' },
  { key: 'can_view_logs', label: 'Can View Logs' },
  { key: 'can_manage_users', label: 'Can Manage Users' },
  { key: 'can_delete_images', label: 'Can Delete Images' },
];

const ROLE_COLORS: Record<UserRole, 'primary' | 'success' | 'warning' | 'default' | 'error'> = {
  super_admin: 'primary',
  admin: 'success',
  moderator: 'warning',
  user: 'default',
  guest: 'default',
};

const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  super_admin: Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])),
  admin: Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])),
  moderator: { can_generate: true, can_view_gallery: true, can_edit_templates: true, can_view_logs: true, can_delete_images: true, can_manage_models: false, can_manage_providers: false, can_manage_users: false },
  user: { can_generate: true, can_view_gallery: true, can_edit_templates: false, can_manage_models: false, can_manage_providers: false, can_view_logs: false, can_manage_users: false, can_delete_images: false },
  guest: { can_generate: false, can_view_gallery: true, can_edit_templates: false, can_manage_models: false, can_manage_providers: false, can_view_logs: false, can_manage_users: false, can_delete_images: false },
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as AdminUser[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async (u: Partial<AdminUser> & { role: UserRole }) => {
    const perms = u.permissions ?? DEFAULT_PERMS[u.role];
    if (editing) {
      await supabase.from('admin_users').update({
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status ?? 'active',
        permissions: perms,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
    } else {
      await supabase.from('admin_users').insert({
        name: u.name,
        email: u.email,
        role: u.role,
        status: 'active',
        permissions: perms,
      });
    }
    setShowForm(false);
    setEditing(null);
    fetchUsers();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('admin_users').delete().eq('id', id);
    fetchUsers();
  };

  const handleToggleStatus = async (u: AdminUser) => {
    await supabase.from('admin_users').update({
      status: u.status === 'active' ? 'suspended' : 'active',
    }).eq('id', u.id);
    fetchUsers();
  };

  if (loading) return <AdminLoading label="Loading users..." />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} users</p>
        <AdminButton variant="primary" size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" />
          Add User
        </AdminButton>
      </div>

      <AnimatePresence>
        {showForm && (
          <UserForm
            key="form"
            user={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>

      {users.length === 0 && !showForm ? (
        <AdminCard>
          <AdminEmptyState
            icon={Users}
            title="No users configured"
            description="Add users and assign roles to manage access"
            action={
              <AdminButton variant="primary" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" /> Add User
              </AdminButton>
            }
          />
        </AdminCard>
      ) : (
        <AdminCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Permissions</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn(
                      'transition-colors hover:bg-secondary/20',
                      i !== users.length - 1 && 'border-b border-border/50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-amber text-xs font-bold text-black">
                          {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge variant={ROLE_COLORS[u.role as UserRole] ?? 'default'}>
                        {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </AdminBadge>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleStatus(u)}>
                        <span className={cn(
                          'flex items-center gap-1.5 text-xs font-medium',
                          u.status === 'active' ? 'text-success' : 'text-destructive',
                        )}>
                          <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            u.status === 'active' ? 'bg-success' : 'bg-destructive',
                          )} />
                          {u.status}
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {PERMISSIONS.filter((p) => u.permissions?.[p.key]).slice(0, 3).map((p) => (
                          <span key={p.key} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {p.label.replace('Can ', '')}
                          </span>
                        ))}
                        {Object.values(u.permissions ?? {}).filter(Boolean).length > 3 && (
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{Object.values(u.permissions ?? {}).filter(Boolean).length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditing(u); setShowForm(true); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

function UserForm({
  user,
  onSave,
  onCancel,
}: {
  user: AdminUser | null;
  onSave: (u: Partial<AdminUser> & { role: UserRole }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role as UserRole ?? 'user');
  const [perms, setPerms] = useState<Record<string, boolean>>(
    user?.permissions ?? DEFAULT_PERMS[user?.role as UserRole ?? 'user'],
  );

  const handleRoleChange = (r: UserRole) => {
    setRole(r);
    setPerms(DEFAULT_PERMS[r]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AdminCard className="overflow-hidden border-primary/30 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{user ? 'Edit User' : 'New User'}</h3>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <AdminLabel>Name</AdminLabel>
            <AdminInput value={name} onChange={setName} placeholder="John Doe" />
          </div>
          <div>
            <AdminLabel>Email</AdminLabel>
            <AdminInput value={email} onChange={setEmail} placeholder="john@example.com" type="email" />
          </div>
          <div>
            <AdminLabel>Role</AdminLabel>
            <AdminSelect
              value={role}
              onChange={(v) => handleRoleChange(v as UserRole)}
              options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Permissions</h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PERMISSIONS.map((p) => (
              <div key={p.key} className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2.5">
                <span className="text-xs font-medium">{p.label}</span>
                <AdminToggle
                  checked={perms[p.key] ?? false}
                  onChange={(v) => setPerms((prev) => ({ ...prev, [p.key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <AdminButton variant="ghost" size="sm" onClick={onCancel}>Cancel</AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => onSave({ name, email, role, permissions: perms })}
            disabled={!name.trim() || !email.trim()}
          >
            <Check className="h-4 w-4" />
            {user ? 'Save Changes' : 'Add User'}
          </AdminButton>
        </div>
      </AdminCard>
    </motion.div>
  );
}
