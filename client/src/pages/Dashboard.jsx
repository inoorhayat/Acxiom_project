import { useEffect, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement,
  LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { api, getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, fmtDateTime, fmtMoney } from '../components/ui.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

const PALETTE = ['#1565c0', '#0fa3a3', '#64748b', '#f59e0b', '#15803d', '#b91c1c', '#7c3aed', '#0ea5e9'];
const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

const baseOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = { range };
    if (range === 'custom') {
      if (!from || !to) return;
      params.from = from;
      params.to = to;
    }
    api.get('/dashboard', { params })
      .then(({ data: d }) => { setData(d); setError(''); })
      .catch((err) => setError(getErrorMessage(err)));
  }, [range, from, to]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <div className="spinner">Loading dashboard...</div>;

  const k = data.kpis;
  const kpiCards = [
    { label: 'Total Customers', value: k.totalCustomers, cls: 'accent' },
    { label: 'Total Leads', value: k.totalLeads },
    { label: 'Open Leads', value: k.openLeads },
    { label: 'Total Opportunities', value: k.totalOpportunities },
    { label: 'Open Opportunities', value: k.openOpportunities, cls: 'warning' },
    { label: 'Won Opportunities', value: k.wonOpportunities, cls: 'success' },
    { label: 'Lost Opportunities', value: k.lostOpportunities, cls: 'danger' },
    { label: 'Sales Pipeline', value: fmtMoney(k.pipelineValue), cls: 'accent' },
    { label: 'Weighted Pipeline', value: fmtMoney(k.weightedPipeline), cls: 'success' },
    { label: 'Follow-Ups Pending', value: k.followUpsPending },
    { label: 'Overdue Follow-Ups', value: k.followUpsOverdue, cls: 'danger' },
  ];

  const leadChart = {
    labels: data.charts.leadStatus.labels,
    datasets: [{ label: 'Leads', data: data.charts.leadStatus.values, backgroundColor: PALETTE, borderRadius: 6 }],
  };
  const pipelineChart = {
    labels: data.charts.opportunityPipeline.labels,
    datasets: [{ label: 'Opportunities', data: data.charts.opportunityPipeline.values, backgroundColor: PALETTE }],
  };
  const salesChart = {
    labels: data.charts.monthlySales.labels,
    datasets: [{
      label: 'Won revenue (INR)', data: data.charts.monthlySales.values,
      borderColor: '#1565c0', backgroundColor: 'rgba(21,101,192,.12)', fill: true, tension: 0.35,
    }],
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {user.role === 'SalesExecutive' ? 'Your assigned customers, leads and opportunities.'
              : 'Team pipeline, leads and performance.'}
          </p>
        </div>
        <div className="filters">
          <select className="select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {range === 'custom' && (
            <>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-kpi">
        {kpiCards.map((c) => (
          <div key={c.label} className={`card kpi ${c.cls || ''}`}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-charts">
        <div className="card">
          <h2>Lead Status</h2>
          <div className="chart-box"><Bar data={leadChart} options={{ ...baseOptions, plugins: { legend: { display: false } } }} /></div>
        </div>
        <div className="card">
          <h2>Opportunity Pipeline</h2>
          <div className="chart-box"><Doughnut data={pipelineChart} options={baseOptions} /></div>
        </div>
        <div className="card">
          <h2>Monthly Sales (Won)</h2>
          <div className="chart-box"><Line data={salesChart} options={{ ...baseOptions, plugins: { legend: { display: false } } }} /></div>
        </div>
      </div>

      {data.admin && (
        <>
          <h2 className="section-title">Administration</h2>
          <div className="grid grid-kpi">
            <div className="card kpi"><div className="label">Users</div><div className="value">{data.admin.users}</div></div>
            <div className="card kpi success"><div className="label">Active Users</div><div className="value">{data.admin.activeUsers}</div></div>
            <div className="card kpi danger"><div className="label">Currently Locked</div><div className="value">{data.admin.lockedUsers}</div></div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <h2>Recent Security & Activity</h2>
            <ul className="list-plain">
              {data.admin.recentEvents.length === 0 && <li>No activity yet.</li>}
              {data.admin.recentEvents.map((ev) => (
                <li key={ev._id}>
                  <span><strong>{ev.userName}</strong> - {ev.action} ({ev.module})</span>
                  <span className="hint">{fmtDateTime(ev.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
