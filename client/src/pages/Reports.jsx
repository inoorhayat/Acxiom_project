import { useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Pagination } from '../components/ui.jsx';

const REPORTS = [
  { key: 'customers', label: 'Customer Report' },
  { key: 'leads', label: 'Lead Report' },
  { key: 'followups', label: 'Follow-Up Report' },
  { key: 'opportunities', label: 'Opportunity Report' },
  { key: 'pipeline', label: 'Pipeline Report (stage & owner)' },
  { key: 'conversion', label: 'Sales / Conversion Report' },
  { key: 'user-activity', label: 'User Activity Report', roles: ['Admin', 'Manager'] },
  { key: 'audit', label: 'Audit Report', roles: ['Admin'] },
];

export default function Reports() {
  const { hasRole } = useAuth();
  const available = REPORTS.filter((r) => !r.roles || hasRole(...r.roles));

  const [type, setType] = useState(available[0].key);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState({ items: [], total: 0, pages: 1 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const params = () => ({ from: from || undefined, to: to || undefined });

  useEffect(() => {
    setLoading(true);
    api.get(`/reports/${type}`, { params: { ...params(), page, limit: 10 } })
      .then(({ data }) => { setReport(data); setError(''); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, page, from, to]);

  // CSV download needs the auth header, so fetch as a blob and trigger a download
  const downloadCsv = async () => {
    try {
      const res = await api.get(`/reports/${type}`, { params: { ...params(), format: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const columns = report.items[0] ? Object.keys(report.items[0]) : [];
  const current = REPORTS.find((r) => r.key === type);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Filter, review and export. Data shown is limited to your role and scope.</p>
        </div>
        <button className="btn secondary" onClick={downloadCsv} disabled={!report.items.length}>Export CSV</button>
      </div>

      <div className="toolbar">
        <select className="select" style={{ width: 'auto', minWidth: 260 }} value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Report type">
          {available.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <input className="input" style={{ width: 'auto' }} type="date" value={from} aria-label="From"
          onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input className="input" style={{ width: 'auto' }} type="date" value={to} aria-label="To"
          onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        {(from || to) && <button className="btn secondary small" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</button>}
      </div>

      <h2 className="section-title">{current?.label}</h2>
      {error && <Alert>{error}</Alert>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c.replace(/([A-Z])/g, ' $1').trim()}</th>)}</tr>
          </thead>
          <tbody>
            {loading && <tr><td className="empty">Loading report...</td></tr>}
            {!loading && report.items.length === 0 && <tr><td className="empty">No data for the selected filters.</td></tr>}
            {!loading && report.items.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c}>{row[c] === '' || row[c] === null || row[c] === undefined ? '-' : String(row[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.pages > 1 && <Pagination page={page} pages={report.pages} total={report.total} onChange={setPage} />}
    </>
  );
}
