// Small shared UI building blocks

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${type}`} role="alert">{children}</div>;
}

export function Field({ label, error, hint, children, full }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

const BADGE = {
  Active: 'success', Converted: 'success', Won: 'success', Completed: 'success', Qualified: 'info',
  Contacted: 'info', New: 'info', Planned: 'info', Prospect: 'warning', Proposal: 'info',
  Negotiation: 'warning', Qualification: 'info', Lost: 'danger', Missed: 'danger', Unqualified: 'danger',
  Inactive: 'danger', Cancelled: 'danger', Failure: 'danger', Success: 'success', High: 'danger', Medium: 'warning', Low: 'info',
};

export function StatusBadge({ value }) {
  if (!value) return null;
  return <span className={`badge ${BADGE[value] || ''}`}>{value}</span>;
}

export function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="pagination">
      <span>{total} record{total === 1 ? '' : 's'}</span>
      <button className="btn secondary small" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn secondary small" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

export const rid = (r) => r?._id ?? r?.id;
