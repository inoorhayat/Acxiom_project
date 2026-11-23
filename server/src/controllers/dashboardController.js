import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import Opportunity from '../models/Opportunity.js';
import FollowUp from '../models/FollowUp.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import { scopeFilter, aggScope, isFullAccess, dateRange } from '../utils/scope.js';
import { startOfToday } from '../utils/validators.js';
import { LEAD_OPEN_STATUSES, LEAD_STATUSES, OPP_STAGES, CLOSED_STAGES } from '../config/constants.js';

// Role-based KPIs: Admin/Manager see team data, Sales Executives see only their own/assigned records
export const summary = asyncHandler(async (req, res) => {
  const { range = 'month', from, to } = req.query;
  const { from: start, to: end } = dateRange(range, from, to);
  const scope = scopeFilter(req.user);
  const aggMatch = aggScope(req.user);
  const createdIn = { createdAt: { $gte: start, $lte: end } };
  const today = startOfToday();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [
    totalCustomers, totalLeads, openLeads, totalOpps, openOpps, wonOpps, lostOpps,
    pipelineAgg, leadStatusAgg, oppStageAgg, monthlySalesAgg, followUpPending, followUpOverdue,
  ] = await Promise.all([
    Customer.countDocuments({ ...scope, ...createdIn }),
    Lead.countDocuments({ ...scope, ...createdIn }),
    Lead.countDocuments({ ...scope, ...createdIn, status: { $in: LEAD_OPEN_STATUSES } }),
    Opportunity.countDocuments({ ...scope, ...createdIn }),
    Opportunity.countDocuments({ ...scope, ...createdIn, stage: { $nin: CLOSED_STAGES } }),
    Opportunity.countDocuments({ ...scope, ...createdIn, stage: 'Won' }),
    Opportunity.countDocuments({ ...scope, ...createdIn, stage: 'Lost' }),
    Opportunity.aggregate([
      { $match: { ...aggMatch, stage: { $nin: CLOSED_STAGES } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, weighted: { $sum: { $divide: [{ $multiply: ['$amount', '$probability'] }, 100] } } } },
    ]),
    Lead.aggregate([
      { $match: { ...aggMatch, ...createdIn } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Opportunity.aggregate([
      { $match: { ...aggMatch, ...createdIn } },
      { $group: { _id: '$stage', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Opportunity.aggregate([
      { $match: { ...aggMatch, stage: 'Won', closedAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year: '$closedAt' }, m: { $month: '$closedAt' } }, amount: { $sum: '$amount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    FollowUp.countDocuments({ ...scopeFilter(req.user, 'assignedTo'), status: 'Planned', followUpDate: { $gte: today } }),
    FollowUp.countDocuments({ ...scopeFilter(req.user, 'assignedTo'), status: 'Planned', followUpDate: { $lt: today } }),
  ]);

  const countBy = (agg, keys) => Object.fromEntries(keys.map((k) => [k, agg.find((a) => a._id === k)?.count || 0]));
  const pipeline = pipelineAgg[0] || { amount: 0, weighted: 0 };

  // Monthly sales for the last 6 months (labels + values), zero-filled
  const monthly = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const hit = monthlySalesAgg.find((m) => m._id.y === d.getFullYear() && m._id.m === d.getMonth() + 1);
    monthly.push({ label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }), amount: hit?.amount || 0 });
  }

  const data = {
    range: { from: start, to: end },
    kpis: {
      totalCustomers,
      totalLeads,
      openLeads,
      totalOpportunities: totalOpps,
      openOpportunities: openOpps,
      wonOpportunities: wonOpps,
      lostOpportunities: lostOpps,
      pipelineValue: pipeline.amount,
      weightedPipeline: Math.round(pipeline.weighted),
      followUpsPending: followUpPending,
      followUpsOverdue: followUpOverdue,
    },
    charts: {
      leadStatus: { labels: LEAD_STATUSES, values: LEAD_STATUSES.map((s) => countBy(leadStatusAgg, [s])[s]) },
      opportunityPipeline: {
        labels: OPP_STAGES,
        values: OPP_STAGES.map((s) => oppStageAgg.find((a) => a._id === s)?.count || 0),
        amounts: OPP_STAGES.map((s) => oppStageAgg.find((a) => a._id === s)?.amount || 0),
      },
      monthlySales: { labels: monthly.map((m) => m.label), values: monthly.map((m) => m.amount) },
    },
  };

  // Admin-only security and user statistics
  if (isFullAccess(req.user) && req.user.role === 'Admin') {
    const [users, activeUsers, lockedUsers, recentEvents] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ lockoutEnd: { $gt: new Date() } }),
      AuditLog.find().sort({ createdAt: -1 }).limit(5).select('userName action module createdAt result'),
    ]);
    data.admin = { users, activeUsers, lockedUsers, recentEvents };
  }

  res.json({ success: true, ...data });
});
