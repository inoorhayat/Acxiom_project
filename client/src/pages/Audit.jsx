import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtDateTime } from '../components/ui.jsx';

const MODULES = ['Authentication', 'Security', 'Users', 'Customers', 'Leads', 'Opportunities', 'FollowUps'];
const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'ACCOUNT_LOCKED', 'LOGOUT', 'REGISTER', 'UNLOCK',
  'PASSWORD_CHANGE', 'PASSWORD_RESET', 'USER_CREATE', 'USER_STATUS', 'ROLE_CHANGE',
  'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'CONVERT',
];

// Read-only view: audit records can be filtered but never edited or deleted
const config = {
  title: 'Audit Log',
  subtitle: 'Security and business activity: who did what, when, and the result. Records are append-only.',
  singular: 'Audit Event',
  endpoint: '/audit',
  readOnly: true,
  searchPlaceholder: 'Search by user, record or details...',
  emptyText: 'No audit events match these filters.',
  filters: [
    { key: 'module', label: 'Module', options: MODULES },
    { key: 'action', label: 'Action', options: ACTIONS },
    { key: 'result', label: 'Result', options: ['Success', 'Failure'] },
  ],
  columns: [
    { label: 'Time', render: (r) => fmtDateTime(r.createdAt) },
    { label: 'User', render: (r) => r.userName || '-' },
    { label: 'Action', render: (r) => <span className="badge">{r.action}</span> },
    { label: 'Module', key: 'module' },
    { label: 'Record', render: (r) => (r.entityName ? `${r.entityName} ${r.recordId ? `(${String(r.recordId).slice(-6)})` : ''}` : '-') },
    { label: 'Result', render: (r) => <StatusBadge value={r.result} /> },
    { label: 'Details', render: (r) => r.details || '-' },
  ],
};

export default function Audit() {
  return <ResourcePage config={config} />;
}
