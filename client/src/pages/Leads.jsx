import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtMoney, fmtDate, rid } from '../components/ui.jsx';
import { api } from '../api/client.js';

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
const SOURCES = ['Website', 'Referral', 'Campaign', 'Cold Call', 'Other'];

const config = {
  title: 'Leads',
  subtitle: 'Capture prospects, qualify them and convert qualified leads into customers and opportunities.',
  singular: 'Lead',
  endpoint: '/leads',
  searchPlaceholder: 'Search by lead name, company or email...',
  filters: [
    { key: 'status', label: 'Status', options: LEAD_STATUSES },
    { key: 'source', label: 'Source', options: SOURCES },
  ],
  defaults: { status: 'New', source: 'Website', priority: 'Medium', expectedValue: '' },
  columns: [
    { label: 'Lead', render: (r) => (<><strong>{r.leadName}</strong><div className="hint">{r.companyName || '-'}</div></>) },
    { label: 'Source', key: 'source' },
    { label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { label: 'Priority', render: (r) => <StatusBadge value={r.priority} /> },
    { label: 'Expected Value', render: (r) => fmtMoney(r.expectedValue) },
    { label: 'Owner', render: (r) => r.ownerId?.name || '-' },
    { label: 'Created', render: (r) => fmtDate(r.createdAt) },
  ],
  fields: [
    { name: 'leadName', label: 'Lead Name', required: true, maxLength: 120 },
    { name: 'email', label: 'Email', type: 'email', maxLength: 150 },
    { name: 'phone', label: 'Phone', type: 'tel', hint: 'Indian mobile number, e.g. 9876543210' },
    { name: 'companyName', label: 'Company', maxLength: 150 },
    { name: 'source', label: 'Lead Source', type: 'select', options: SOURCES },
    { name: 'status', label: 'Status', type: 'select', options: LEAD_STATUSES },
    { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
    { name: 'expectedValue', label: 'Expected Value (INR)', type: 'number', min: 0, max: 1e12, step: 'any' },
    { name: 'ownerId', label: 'Assigned To', type: 'select', source: '/users/assignable', labelKey: 'name', roles: ['Admin', 'Manager'] },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, full: true },
  ],
  // Qualified leads can be converted into a Customer and an Opportunity (server enforces the rule)
  rowActions: (row) => (row.status === 'Qualified'
    ? [{
      label: 'Convert',
      variant: 'success',
      run: async () => {
        const { data } = await api.post(`/leads/${rid(row)}/convert`, {});
        return data.message;
      },
    }]
    : []),
};

export default function Leads() {
  return <ResourcePage config={config} />;
}
