import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import Opportunity from '../models/Opportunity.js';
import FollowUp from '../models/FollowUp.js';
import AuditLog from '../models/AuditLog.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { scopeFilter, aggScope, isFullAccess, dateRange } from '../utils/scope.js';
import { startOfToday } from '../utils/validators.js';
import { CLOSED_STAGES } from '../config/constants.js';

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Protects CSV exports against spreadsheet formula injection
const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.map(csvCell).join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
};

const dateFilter = (field, q) => {
  if (!q.from && !q.to) return {};
  const { from, to } = dateRange('custom', q.from || q.to, q.to || q.from);
  return { [field]: { $gte: from, $lte: to } };
};

// Each report returns an array of plain row objects; the same rows feed JSON and CSV output
async function buildRows(type, user, q) {
  const scope = scopeFilter(user);
  const aggMatch = aggScope(user);
  const today = startOfToday();

  switch (type) {
    case 'customers': {
      const f = { ...scope, ...dateFilter('createdAt', q), ...(q.status && { status: q.status }) };
      const docs = await Customer.find(f).populate('ownerId', 'name').sort({ createdAt: -1 }).lean();
      return docs.map((c) => ({ Name: c.customerName, Email: c.email, Phone: c.phone, Company: c.companyName, Status: c.status, Owner: c.ownerId?.name || '', Created: fmt(c.createdAt) }));
    }
    case 'leads': {
      const f = { ...scope, ...dateFilter('createdAt', q), ...(q.status && { status: q.status }), ...(q.source && { source: q.source }) };
      const docs = await Lead.find(f).populate('ownerId', 'name').sort({ createdAt: -1 }).lean();
      return docs.map((l) => ({ Name: l.leadName, Source: l.source, Status: l.status, Priority: l.priority, Owner: l.ownerId?.name || '', Converted: l.status === 'Converted' ? 'Yes' : 'No', Created: fmt(l.createdAt) }));
    }
    case 'followups': {
      const f = { ...scopeFilter(user, 'assignedTo'), ...dateFilter('followUpDate', q), ...(q.status && { status: q.status }) };
      const docs = await FollowUp.find(f).populate('assignedTo', 'name').sort({ followUpDate: 1 }).lean();
      return docs.map((x) => ({
        Subject: x.subject, Type: x.followUpType, Related: x.relatedType, Date: fmt(x.followUpDate), Status: x.status,
        Overdue: x.status === 'Planned' && x.followUpDate < today ? 'Yes' : 'No', AssignedTo: x.assignedTo?.name || '',
      }));
    }
    case 'opportunities': {
      const f = { ...scope, ...dateFilter('createdAt', q), ...(q.stage && { stage: q.stage }) };
      const docs = await Opportunity.find(f).populate('customerId', 'customerName').populate('ownerId', 'name').sort({ expectedCloseDate: 1 }).lean();
      return docs.map((o) => ({
        Name: o.opportunityName, Customer: o.customerId?.customerName || '', Stage: o.stage, Amount: o.amount,
        Probability: o.probability, Weighted: Math.round((o.amount * o.probability) / 100), ExpectedClose: fmt(o.expectedCloseDate), Owner: o.ownerId?.name || '',
      }));
    }
    case 'pipeline': {
      // Stage-wise and owner-wise open pipeline with weighted value
      const byStage = await Opportunity.aggregate([
        { $match: { ...aggMatch, stage: { $nin: CLOSED_STAGES } } },
        { $group: { _id: '$stage', count: { $sum: 1 }, amount: { $sum: '$amount' }, weighted: { $sum: { $divide: [{ $multiply: ['$amount', '$probability'] }, 100] } } } },
        { $sort: { _id: 1 } },
      ]);
      const byOwner = await Opportunity.aggregate([
        { $match: { ...aggMatch, stage: { $nin: CLOSED_STAGES } } },
        { $group: { _id: '$ownerId', count: { $sum: 1 }, amount: { $sum: '$amount' }, weighted: { $sum: { $divide: [{ $multiply: ['$amount', '$probability'] }, 100] } } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'owner' } },
      ]);
      return [
        ...byStage.map((s) => ({ Group: 'Stage', Name: s._id, Count: s.count, Amount: s.amount, Weighted: Math.round(s.weighted) })),
        ...byOwner.map((o) => ({ Group: 'Owner', Name: o.owner[0]?.name || 'Unknown', Count: o.count, Amount: o.amount, Weighted: Math.round(o.weighted) })),
      ];
    }
    case 'conversion': {
      const [leadTotal, leadConverted, oppWon, oppLost] = await Promise.all([
        Lead.countDocuments({ ...scope, ...dateFilter('createdAt', q) }),
        Lead.countDocuments({ ...scope, ...dateFilter('createdAt', q), status: 'Converted' }),
        Opportunity.countDocuments({ ...scope, stage: 'Won' }),
        Opportunity.countDocuments({ ...scope, stage: 'Lost' }),
      ]);
      const leadRate = leadTotal ? Math.round((leadConverted / leadTotal) * 100) : 0;
      const winRate = oppWon + oppLost ? Math.round((oppWon / (oppWon + oppLost)) * 100) : 0;
      return [
        { Metric: 'Total leads', Value: leadTotal },
        { Metric: 'Converted leads', Value: leadConverted },
        { Metric: 'Lead conversion rate (%)', Value: leadRate },
        { Metric: 'Won opportunities', Value: oppWon },
        { Metric: 'Lost opportunities', Value: oppLost },
        { Metric: 'Win rate (%)', Value: winRate },
      ];
    }
    case 'user-activity': {
      // Admin and Manager only (checked in the route)
      const rows = await AuditLog.aggregate([
        { $match: { ...dateFilter('createdAt', q) } },
        { $group: { _id: { user: '$userName', action: '$action' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      return rows.map((r) => ({ User: r._id.user, Action: r._id.action, Count: r.count }));
    }
    case 'audit': {
      // Admin only (checked in the route)
      const f = { ...dateFilter('createdAt', q), ...(q.module && { module: q.module }), ...(q.action && { action: q.action }), ...(q.result && { result: q.result }) };
      const docs = await AuditLog.find(f).sort({ createdAt: -1 }).limit(5000).lean();
      return docs.map((a) => ({ Time: new Date(a.createdAt).toISOString(), User: a.userName, Action: a.action, Module: a.module, Record: a.entityName, RecordId: a.recordId, Result: a.result, Details: a.details }));
    }
    default:
      throw new ApiError(404, 'Unknown report type.');
  }
}

export const report = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const q = req.query;

  if (type === 'user-activity' && !isFullAccess(req.user)) throw new ApiError(403, 'You do not have permission to view this report.');
  if (type === 'audit' && req.user.role !== 'Admin') throw new ApiError(403, 'Only administrators can view audit reports.');

  const rows = await buildRows(type, req.user, q);

  if (q.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    return res.send(toCsv(rows));
  }

  // Simple pagination over in-memory rows (sorted as produced above)
  const p = pageParams(q);
  res.json({ success: true, type, ...pageResult(rows.slice(p.skip, p.skip + p.limit), rows.length, p) });
});
