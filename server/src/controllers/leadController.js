import Lead from '../models/Lead.js';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit, snapshot } from '../utils/audit.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { scopeFilter, canAccess, isFullAccess } from '../utils/scope.js';
import { check, validateLead, normalizePhone, escapeRegex, str } from '../utils/validators.js';
import { LEAD_TRANSITIONS } from '../config/constants.js';

const load = async (req, id) => {
  const lead = await Lead.findById(id);
  if (!lead || !canAccess(req.user, lead.ownerId)) throw new ApiError(404, 'Lead not found.');
  return lead;
};

async function buildPayload(req, body, existing) {
  const data = {
    leadName: str(body.leadName),
    email: str(body.email).toLowerCase(),
    phone: normalizePhone(body.phone),
    companyName: str(body.companyName),
    source: str(body.source) || existing?.source || 'Website',
    status: str(body.status) || existing?.status || 'New',
    priority: str(body.priority) || existing?.priority || 'Medium',
    expectedValue: body.expectedValue === '' || body.expectedValue === undefined ? 0 : Number(body.expectedValue),
    notes: str(body.notes),
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
  if (req.query.status) filter.status = req.query.status;
  if (req.query.source) filter.source = req.query.source;
  if (isFullAccess(req.user) && req.query.ownerId) filter.ownerId = req.query.ownerId;
  if (req.query.q) {
    const r = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ leadName: r }, { companyName: r }, { email: r }];
  }
  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    Lead.find(filter).populate('ownerId', 'name').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Lead.countDocuments(filter),
  ]);
  res.json({ success: true, ...pageResult(items, total, p) });
});

export const get = asyncHandler(async (req, res) => {
  const lead = await load(req, req.params.id);
  await lead.populate('ownerId', 'name');
  res.json({ success: true, lead });
});

export const create = asyncHandler(async (req, res) => {
  check(validateLead(req.body));
  const data = await buildPayload(req, req.body);
  const lead = await Lead.create({ ...data, createdBy: req.user.id });
  await writeAudit(req, { action: 'CREATE', module: 'Leads', entityName: 'Lead', recordId: lead._id, newValue: snapshot(lead) });
  res.status(201).json({ success: true, lead });
});

export const update = asyncHandler(async (req, res) => {
  const lead = await load(req, req.params.id);
  check(validateLead(req.body));
  const data = await buildPayload(req, req.body, lead);

  // Status changes must follow the configured lead workflow
  const oldStatus = lead.status;
  if (data.status !== oldStatus) {
    if (data.status === 'Converted') throw new ApiError(400, 'Use the Convert action to convert a lead.');
    if (!(LEAD_TRANSITIONS[oldStatus] || []).includes(data.status)) {
      throw new ApiError(409, `A lead cannot move from ${oldStatus} to ${data.status}.`);
    }
  }

  const oldValue = snapshot(lead);
  Object.assign(lead, data);
  await lead.save();

  await writeAudit(req, { action: 'UPDATE', module: 'Leads', entityName: 'Lead', recordId: lead._id, oldValue, newValue: snapshot(lead) });
  if (oldStatus !== lead.status) {
    await writeAudit(req, { action: 'STATUS_CHANGE', module: 'Leads', entityName: 'Lead', recordId: lead._id, oldValue: { status: oldStatus }, newValue: { status: lead.status } });
  }
  res.json({ success: true, lead });
});

// Converts a Qualified lead into a Customer (reused if one already exists) and an Opportunity
export const convert = asyncHandler(async (req, res) => {
  const lead = await load(req, req.params.id);
  if (lead.status !== 'Qualified') throw new ApiError(409, 'Only Qualified leads can be converted.');

  const errors = {};
  if (!lead.email) errors.email = 'Lead needs an email address before conversion.';
  if (!lead.phone) errors.phone = 'Lead needs a phone number before conversion.';
  const amount = Number(req.body.amount || lead.expectedValue);
  if (!(amount > 0)) errors.amount = 'Opportunity Amount must be greater than 0.';
  check(errors);

  let customer = await Customer.findOne({ $or: [{ email: lead.email }, { phone: normalizePhone(lead.phone) }] });
  if (!customer) {
    customer = await Customer.create({
      customerName: lead.leadName,
      email: lead.email,
      phone: normalizePhone(lead.phone),
      companyName: lead.companyName,
      notes: lead.notes,
      ownerId: lead.ownerId,
      createdBy: req.user.id,
    });
    await writeAudit(req, { action: 'CREATE', module: 'Customers', entityName: 'Customer', recordId: customer._id, details: `Created from lead ${lead._id}` });
  }

  const closeDate = req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : new Date(Date.now() + 30 * 86400000);
  const opportunity = await Opportunity.create({
    opportunityName: `${lead.leadName} - Opportunity`,
    customerId: customer._id,
    leadId: lead._id,
    stage: 'Qualification',
    amount,
    probability: 10,
    expectedCloseDate: closeDate,
    source: lead.source,
    ownerId: lead.ownerId,
    createdBy: req.user.id,
  });

  const oldStatus = lead.status;
  lead.status = 'Converted';
  lead.convertedCustomerId = customer._id;
  lead.convertedOpportunityId = opportunity._id;
  await lead.save();

  await writeAudit(req, {
    action: 'CONVERT', module: 'Leads', entityName: 'Lead', recordId: lead._id,
    oldValue: { status: oldStatus }, newValue: { status: 'Converted', customerId: customer._id, opportunityId: opportunity._id },
  });
  res.json({ success: true, message: 'Lead converted successfully.', lead, customer, opportunity });
});

export const remove = asyncHandler(async (req, res) => {
  const lead = await load(req, req.params.id);
  await lead.deleteOne();
  await writeAudit(req, { action: 'DELETE', module: 'Leads', entityName: 'Lead', recordId: req.params.id, oldValue: snapshot(lead) });
  res.json({ success: true, message: 'Lead deleted.' });
});
