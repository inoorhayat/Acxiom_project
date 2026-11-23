import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtDateTime, rid } from '../components/ui.jsx';
import { api } from '../api/client.js';
import { passwordErrors } from '../utils/validators.js';

const ROLES = ['Admin', 'Manager', 'SalesExecutive'];
const ROLE_LABEL = { Admin: 'Admin', Manager: 'Manager', SalesExecutive: 'Sales Executive' };

const config = {
  title: 'Users & Roles',
  subtitle: 'Create users, assign roles, activate or deactivate accounts, unlock accounts and reset passwords.',
  singular: 'User',
  endpoint: '/users',
  searchPlaceholder: 'Search by name or email...',
  filters: [{ key: 'role', label: 'Role', options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) }],
  defaults: { role: 'SalesExecutive' },
  canDelete: false, // accounts are deactivated, never deleted (keeps audit history intact)
  columns: [
    { label: 'Name', key: 'name' },
    { label: 'Email', key: 'email' },
    { label: 'Role', render: (r) => <span className="badge info">{ROLE_LABEL[r.role] || r.role}</span> },
    { label: 'Account', render: (r) => <StatusBadge value={r.isActive ? 'Active' : 'Inactive'} /> },
    { label: 'Lockout', render: (r) => (r.isLocked ? <span className="badge danger">Locked</span> : <span className="hint">-</span>) },
    { label: 'Last Login', render: (r) => fmtDateTime(r.lastLoginAt) },
  ],
  fields: [
    { name: 'name', label: 'Full Name', required: true, maxLength: 100 },
    { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 150 },
    { name: 'role', label: 'Role', type: 'select', required: true, options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
    { name: 'password', label: 'Initial Password', type: 'password', required: true, onlyCreate: true, hint: '8+ characters with upper, lower, number and special character' },
  ],
  extraValidate: (v, mode) => {
    if (mode !== 'create') return {};
    const pw = passwordErrors(v.password);
    return pw.length ? { password: pw[0] } : {};
  },
  rowActions: (row) => {
    const actions = [{
      label: row.isActive ? 'Deactivate' : 'Activate',
      variant: row.isActive ? 'danger' : 'success',
      run: async () => {
        await api.patch(`/users/${rid(row)}/status`, { isActive: !row.isActive });
        return `${row.name} ${row.isActive ? 'deactivated' : 'activated'}.`;
      },
    }];
    if (row.isLocked) {
      actions.push({
        label: 'Unlock',
        variant: 'success',
        run: async () => {
          await api.post(`/users/${rid(row)}/unlock`);
          return `${row.name} unlocked.`;
        },
      });
    }
    actions.push({
      label: 'Reset Password',
      run: async () => {
        const pw = window.prompt(`Enter a new temporary password for ${row.name}.\n(8+ characters, upper, lower, number and special character)`);
        if (!pw) return 'Password reset cancelled.';
        await api.post(`/users/${rid(row)}/reset-password`, { newPassword: pw });
        return `Password reset for ${row.name}.`;
      },
    });
    return actions;
  },
};

export default function Users() {
  return <ResourcePage config={config} />;
}
