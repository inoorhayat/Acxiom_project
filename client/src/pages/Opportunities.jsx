import ResourcePage from '../components/ResourcePage.jsx';
import { StatusBadge, fmtMoney, fmtDate, rid } from '../components/ui.jsx';
import { api } from '../api/client.js';
import { todayStr } from '../utils/validators.js';

const STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const CLOSED = ['Won', 'Lost'];

// Rebuilds the full form payload from a record so a single field (stage) can be changed
const toPayload = (r) => ({
  opportunityName: r.opportunityName,
  customerId: rid(r.customerId) || r.customerId,
  stage: r.stage,
  amount: r.amount,
  probability: r.probability,
  expectedCloseDate: String(r.expectedCloseDate).slice(0, 10),
  source: r.source,
  notes: r.notes || '',
  ownerId: rid(r.ownerId) || '',
});

const setStage = (r, stage, label) => ({
  label,
  variant: stage === 'Won' ? 'success' : 'danger',
  run: async () => {
    await api.put(`/opportunities/${rid(r)}`, { ...toPayload(r), stage });
    return `Opportunity marked as ${stage}.`;
  },
});

const config = {
  title: 'Opportunities',
  subtitle: 'Sales pipeline with amount, probability and expected close date. Weighted value = Amount x Probability / 100.',
  singular: 'Opportunity',
  endpoint: '/opportunities',
  searchPlaceholder: 'Search by opportunity name...',
  filters: [{ key: 'stage', label: 'Stage', options: STAGES }],
  defaults: { stage: 'Qualification', probability: '10', source: 'Other' },
  columns: [
    { label: 'Opportunity', key: 'opportunityName' },
    { label: 'Customer', render: (r) => r.customerId?.customerName || '-' },
    { label: 'Stage', render: (r) => <StatusBadge value={r.stage} /> },
    { label: 'Amount', render: (r) => fmtMoney(r.amount) },
    { label: 'Probability', render: (r) => `${r.probability}%` },
    { label: 'Weighted', render: (r) => fmtMoney(r.weightedAmount) },
    { label: 'Expected Close', render: (r) => fmtDate(r.expectedCloseDate) },
    { label: 'Owner', render: (r) => r.ownerId?.name || '-' },
  ],
  fields: [
    { name: 'opportunityName', label: 'Opportunity Name', required: true, maxLength: 150, full: true },
    { name: 'customerId', label: 'Customer', type: 'select', required: true, source: '/customers', labelKey: 'customerName' },
    { name: 'stage', label: 'Stage', type: 'select', required: true, options: STAGES },
    { name: 'amount', label: 'Amount (INR)', type: 'number', required: true, min: 0, step: 'any', hint: 'Must be greater than 0 for open opportunities' },
    { name: 'probability', label: 'Probability (%)', type: 'number', required: true, min: 0, max: 100, step: 'any' },
    { name: 'expectedCloseDate', label: 'Expected Close Date', type: 'date', required: true },
    { name: 'source', label: 'Source', type: 'select', options: ['Website', 'Referral', 'Campaign', 'Cold Call', 'Other'] },
    { name: 'ownerId', label: 'Assigned To', type: 'select', source: '/users/assignable', labelKey: 'name', roles: ['Admin', 'Manager'] },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, full: true },
  ],
  // Business rules that depend on the stage (mirrors the server)
  extraValidate: (v) => {
    const errs = {};
    const open = !CLOSED.includes(v.stage);
    if (open && Number(v.amount) <= 0) errs.amount = 'Opportunity Amount must be greater than 0.';
    if (open && v.expectedCloseDate && v.expectedCloseDate < todayStr()) {
      errs.expectedCloseDate = 'Expected Close Date cannot be in the past for an open opportunity.';
    }
    return errs;
  },
  rowActions: (row) => (CLOSED.includes(row.stage) ? [] : [setStage(row, 'Won', 'Mark Won'), setStage(row, 'Lost', 'Mark Lost')]),
};

export default function Opportunities() {
  return <ResourcePage config={config} />;
}
