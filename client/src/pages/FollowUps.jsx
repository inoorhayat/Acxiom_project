import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtDate, rid } from '../components/ui.jsx';
import { api } from '../api/client.js';
import { todayStr } from '../utils/validators.js';

const STATUSES = ['Planned', 'Completed', 'Missed', 'Cancelled'];
const TYPES = ['Call', 'Meeting', 'Email', 'Task'];
const ENDPOINT_BY_TYPE = { Customer: '/customers', Lead: '/leads', Opportunity: '/opportunities' };
const LABEL_BY_TYPE = { Customer: 'customerName', Lead: 'leadName', Opportunity: 'opportunityName' };

const updateStatus = (row, status) => ({
  label: status === 'Completed' ? 'Complete' : 'Mark Missed',
  variant: status === 'Completed' ? 'success' : 'danger',
  run: async () => {
    await api.patch(`/followups/${rid(row)}/status`, { status });
    return `Follow-up marked as ${status}.`;
  },
});

const config = {
  title: 'Follow-Ups & Activities',
  subtitle: 'Calls, meetings, emails and tasks linked to customers, leads and opportunities.',
  singular: 'Follow-Up',
  endpoint: '/followups',
  searchPlaceholder: 'Search by subject...',
  filters: [
    { key: 'view', label: 'View', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'overdue', label: 'Overdue' }] },
    { key: 'status', label: 'Status', options: STATUSES },
  ],
  defaults: { followUpType: 'Call', relatedType: 'Customer', status: 'Planned', followUpDate: todayStr() },
  columns: [
    { label: 'Subject', render: (r) => (<><strong>{r.subject}</strong><div className="hint">{r.followUpType}</div></>) },
    { label: 'Related To', render: (r) => (<>{r.relatedType}: {r.relatedName}</>) },
    { label: 'Date', render: (r) => <span style={{ color: r.isOverdue ? 'var(--danger)' : undefined, fontWeight: r.isOverdue ? 600 : undefined }}>{fmtDate(r.followUpDate)}{r.isOverdue ? ' (overdue)' : ''}</span> },
    { label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
    { label: 'Assigned To', render: (r) => r.assignedTo?.name || '-' },
  ],
  fields: [
    { name: 'subject', label: 'Subject', required: true, maxLength: 150, full: true },
    { name: 'followUpType', label: 'Activity Type', type: 'select', options: TYPES },
    { name: 'relatedType', label: 'Related To', type: 'select', required: true, options: ['Customer', 'Lead', 'Opportunity'] },
    {
      name: 'relatedId',
      label: 'Related Record',
      type: 'select',
      required: true,
      source: (v) => ENDPOINT_BY_TYPE[v.relatedType] || '/customers',
      labelKey: (v) => LABEL_BY_TYPE[v.relatedType] || 'customerName',
    },
    { name: 'followUpDate', label: 'Follow-Up Date', type: 'date', required: true, hint: 'Cannot be earlier than today for planned follow-ups' },
    { name: 'status', label: 'Status', type: 'select', options: STATUSES },
    { name: 'assignedTo', label: 'Assigned To', type: 'select', source: '/users/assignable', labelKey: 'name', roles: ['Admin', 'Manager'] },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, full: true },
  ],
  extraValidate: (v, mode) => {
    const errs = {};
    if (v.followUpDate && v.status === 'Planned' && v.followUpDate < todayStr() && mode === 'create') {
      errs.followUpDate = 'Follow-up date cannot be earlier than today.';
    }
    return errs;
  },
  rowActions: (row) => (row.status === 'Planned' ? [updateStatus(row, 'Completed'), updateStatus(row, 'Missed')] : []),
};

export default function FollowUps() {
  return <ResourcePage config={config} />;
}
