import Opportunity from '../models/Opportunity.js';
import Customer from '../models/Customer.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit, snapshot } from '../utils/audit.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { scopeFilter, canAccess, isFullAccess } from '../utils/scope.js';
import { check, validateOpportunity, parseDay, escapeRegex, str } from '../utils/validators.js';
import { CLOSED_STAGES } from '../config/constants.js';

const load = async (req, id) => {
  const opp = await Opportunity.findById(id);
  if (!opp || !canAccess(req.user, opp.ownerId)) throw new ApiError(404, 'Opportunity not found.');
  return opp;
};

// Weighted value = Amount x Probability / 100
const weighted = (o) => Math.round(((o.amount || 0) * (o.probability || 0)) / 100);

async function buildPayload(req, body, existing) {
  const customer = await Customer.findById(body.customerId);
  if (!customer || !canAccess(req.user, customer.ownerId)) {
    throw new ApiError(400, 'Validation failed.', { customerId: 'Select a valid customer.' });
  }
  const stage = str(body.stage);
  const data = {
    opportunityName: str(body.opportunityName),
    customerId: customer._id,
    leadId: existing?.leadId ?? null,
    stage,
    amount: Number(body.amount),
    probability: Number(body.probability),
    expectedCloseDate: parseDay(body.expectedCloseDate),
    source: str(body.source) || existing?.source || 'Other',
    notes: str(body.notes),
    closedAt: CLOSED_STAGES.includes(stage) ? existing?.closedAt || new Date() : null,
  };
  let ownerId = existing?.ownerId ?? req.user.id;
  if (isFullAccess(req.user) && body.ownerId) ownerId = body.ownerId;
  if (!existing && !isFullAccess(req.user)) ownerId = req.user.id;
  const owner = await User.findById(ownerId);
  if (!owner || !owner.isActive) throw new ApiError(400, 'Validation failed.', { ownerId: 'Select a valid assigned user.' });
  data.ownerId = ownerId;
  return data;
}

export const list = asyncHandler(async (req, res) => {
  const filter = { ...scopeFilter(req.user) };
  if (req.query.stage) filter.stage = req.query.stage;
  if (req.query.customerId) filter.customerId = req.query.customerId;
  if (req.query.status === 'open') filter.stage = { $nin: CLOSED_STAGES };
  if (isFullAccess(req.user) && req.query.ownerId) filter.ownerId = req.query.ownerId;
  if (req.query.q) {
    filter.opportunityName = new RegExp(escapeRegex(req.query.q), 'i');
  }
  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    Opportunity.find(filter).populate('customerId', 'customerName').populate('ownerId', 'name')
      .sort({ expectedCloseDate: 1 }).skip(p.skip).limit(p.limit),
    Opportunity.countDocuments(filter),
  ]);
  const withWeighted = items.map((o) => ({ ...o.toJSON(), weightedAmount: weighted(o) }));
  res.json({ success: true, ...pageResult(withWeighted, total, p) });
});

export const get = asyncHandler(async (req, res) => {
  const opp = await load(req, req.params.id);
  await opp.populate([{ path: 'customerId', select: 'customerName' }, { path: 'ownerId', select: 'name' }]);
  res.json({ success: true, opportunity: { ...opp.toJSON(), weightedAmount: weighted(opp) } });
});

export const create = asyncHandler(async (req, res) => {
  check(validateOpportunity(req.body));
  const data = await buildPayload(req, req.body);
  const opp = await Opportunity.create({ ...data, createdBy: req.user.id });
  await writeAudit(req, { action: 'CREATE', module: 'Opportunities', entityName: 'Opportunity', recordId: opp._id, newValue: snapshot(opp) });
  res.status(201).json({ success: true, opportunity: opp });
});

export const update = asyncHandler(async (req, res) => {
  const opp = await load(req, req.params.id);
  check(validateOpportunity(req.body));
  const data = await buildPayload(req, req.body, opp);

  const oldValue = snapshot(opp);
  const oldStage = opp.stage;
  Object.assign(opp, data);
  await opp.save();

  await writeAudit(req, { action: 'UPDATE', module: 'Opportunities', entityName: 'Opportunity', recordId: opp._id, oldValue, newValue: snapshot(opp) });
  if (oldStage !== opp.stage) {
    await writeAudit(req, { action: 'STATUS_CHANGE', module: 'Opportunities', entityName: 'Opportunity', recordId: opp._id, oldValue: { stage: oldStage }, newValue: { stage: opp.stage } });
  }
  res.json({ success: true, opportunity: opp });
});

export const remove = asyncHandler(async (req, res) => {
  const opp = await load(req, req.params.id);
  await opp.deleteOne();
  await writeAudit(req, { action: 'DELETE', module: 'Opportunities', entityName: 'Opportunity', recordId: req.params.id, oldValue: snapshot(opp) });
  res.json({ success: true, message: 'Opportunity deleted.' });
});
