import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtDate } from '../components/ui.jsx';
import { api } from '../api/client.js';

const config = {
  title: 'Customers',
  subtitle: 'Customer master data, contacts, ownership and history.',
  singular: 'Customer',
  endpoint: '/customers',
  searchPlaceholder: 'Search by name, email, phone or company...',
  deleteLabel: 'Deactivate',
  deleteVerb: 'deactivate',
  deleteMessage: 'Customer deactivated.',
  filters: [{ key: 'status', label: 'Status', options: ['Active', 'Inactive', 'Prospect'] }],
  defaults: { status: 'Active' },
  columns: [
    { label: 'Customer', render: (r) => (<><strong>{r.customerName}</strong><div className="hint">{r.companyName || '-'}</div></>) },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'City', render: (r) => r.city || '-' },
    { label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { label: 'Owner', render: (r) => r.ownerId?.name || '-' },
    { label: 'Created', render: (r) => fmtDate(r.createdAt) },
  ],
  fields: [
    { name: 'customerName', label: 'Customer Name', required: true, maxLength: 120 },
    { name: 'email', label: 'Email', type: 'email', required: true, maxLength: 150 },
    { name: 'phone', label: 'Phone', type: 'tel', required: true, hint: 'Indian mobile number, e.g. 9876543210' },
    { name: 'companyName', label: 'Company', maxLength: 150 },
    { name: 'city', label: 'City', maxLength: 80 },
    { name: 'state', label: 'State', maxLength: 80 },
    { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Prospect'] },
    { name: 'ownerId', label: 'Assigned To', type: 'select', source: '/users/assignable', labelKey: 'name', roles: ['Admin', 'Manager'] },
    { name: 'address', label: 'Address', type: 'textarea', maxLength: 300, full: true },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, full: true },
  ],
  // Shows a quick history summary (opportunities and follow-ups) for the customer
  rowActions: (row) => [{
    label: 'History',
    run: async () => {
      const { data } = await api.get(`/customers/${row._id}`);
      const n = data.opportunities.length;
      return `${row.customerName}: ${n} opportunit${n === 1 ? 'y' : 'ies'}, ${data.followUps.length} follow-up(s).`;
    },
  }],
};

export default function Customers() {
  return <ResourcePage config={config} />;
}
