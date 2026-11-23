import FollowUp from '../models/FollowUp.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import Opportunity from '../models/Opportunity.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit, snapshot } from '../utils/audit.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { scopeFilter, canAccess, isFullAccess } from '../utils/scope.js';
import { check, validateFollowUp, parseDay, startOfToday, str, escapeRegex } from '../utils/validators.js';
import { FOLLOWUP_STATUSES } from '../config/constants.js';

const MODELS = { Customer, Lead, Opportunity };
const NAME_FIELD = { Customer: 'customerName', Lead: 'leadName', Opportunity: 'opportunityName' };

const load = async (req, id) => {
  const fu = await FollowUp.findById(id);
  if (!fu || !canAccess(req.user, fu.assignedTo)) throw new ApiError(404, 'Follow-up not found.');
  return fu;
};

// Ensures the related Customer/Lead/Opportunity exists and is visible to the current user
async function checkRelated(req, relatedType, relatedId) {
  const Model = MODELS[relatedType];
  const record = await Model.findById(relatedId);
  if (!record || !canAccess(req.user, record.ownerId)) {
    throw new ApiError(400, 'Validation failed.', { relatedId: `Select a valid ${relatedType.toLowerCase()}.` });
  }
}

export const list = asyncHandler(async (req, res) => {
  // Sales Executives see only follow-ups assigned to them
  const filter = { ...scopeFilter(req.user, 'assignedTo') };
  const today = startOfToday();
  if (req.query.status) filter.status = req.query.status;
  if (isFullAccess(req.user) && req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.relatedType) filter.relatedType = req.query.relatedType;
  if (req.query.q) filter.subject = new RegExp(escapeRegex(req.query.q), 'i');
  if (req.query.view === 'overdue') {
    filter.status = 'Planned';
    filter.followUpDate = { $lt: today };
  }
  if (req.query.view === 'upcoming') {
    filter.status = 'Planned';
    filter.followUpDate = { $gte: today };
  }

  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    FollowUp.find(filter).populate('assignedTo', 'name').sort({ followUpDate: 1 }).skip(p.skip).limit(p.limit),
    FollowUp.countDocuments(filter),
  ]);

  // Attach the related record's display name for the UI
  const enriched = await Promise.all(items.map(async (f) => {
    const Model = MODELS[f.relatedType];
    const rec = Model ? await Model.findById(f.relatedId).select(NAME_FIELD[f.relatedType]) : null;
    return { ...f.toJSON(), relatedName: rec ? rec[NAME_FIELD[f.relatedType]] : '(deleted)', isOverdue: f.status === 'Planned' && f.followUpDate < today };
  }));
  res.json({ success: true, ...pageResult(enriched, total, p) });
});

export const create = asyncHandler(async (req, res) => {
  check(validateFollowUp(req.body, { isNew: true }));
  const assignedTo = isFullAccess(req.user) && req.body.assignedTo ? req.body.assignedTo : req.user.id;
  if (!(await User.exists({ _id: assignedTo, isActive: true }))) {
    throw new ApiError(400, 'Validation failed.', { assignedTo: 'Select a valid assigned user.' });
  }
  await checkRelated(req, req.body.relatedType, req.body.relatedId);

  const fu = await FollowUp.create({
    relatedType: req.body.relatedType,
    relatedId: req.body.relatedId,
    subject: str(req.body.subject),
    followUpType: str(req.body.followUpType) || 'Call',
    followUpDate: parseDay(req.body.followUpDate),
    status: 'Planned',
    assignedTo,
    notes: str(req.body.notes),
    createdBy: req.user.id,
  });
  await writeAudit(req, { action: 'CREATE', module: 'FollowUps', entityName: 'FollowUp', recordId: fu._id, newValue: snapshot(fu) });
  res.status(201).json({ success: true, followUp: fu });
});

export const update = asyncHandler(async (req, res) => {
  const fu = await load(req, req.params.id);
  check(validateFollowUp(req.body));
  const oldValue = snapshot(fu);
  fu.subject = str(req.body.subject);
  fu.followUpType = req.body.followUpType;
  fu.followUpDate = parseDay(req.body.followUpDate);
  fu.notes = str(req.body.notes);
  fu.status = str(req.body.status) || fu.status;
  if (fu.status === 'Completed' && !fu.completedAt) fu.completedAt = new Date();
  await fu.save();
  await writeAudit(req, { action: 'UPDATE', module: 'FollowUps', entityName: 'FollowUp', recordId: fu._id, oldValue, newValue: snapshot(fu) });
  res.json({ success: true, followUp: fu });
});

// Complete / Missed / Cancelled
export const setStatus = asyncHandler(async (req, res) => {
  const fu = await load(req, req.params.id);
  const status = str(req.body.status);
  if (!FOLLOWUP_STATUSES.includes(status)) throw new ApiError(400, 'Validation failed.', { status: 'Select a valid status.' });
  if (fu.status !== 'Planned') throw new ApiError(409, `Only Planned follow-ups can be updated. This one is ${fu.status}.`);

  const oldStatus = fu.status;
  fu.status = status;
  if (status === 'Completed') fu.completedAt = new Date();
  await fu.save();
  await writeAudit(req, { action: 'STATUS_CHANGE', module: 'FollowUps', entityName: 'FollowUp', recordId: fu._id, oldValue: { status: oldStatus }, newValue: { status } });
  res.json({ success: true, followUp: fu });
});

// Rescheduling a missed/planned follow-up must use today or a future date
export const reschedule = asyncHandler(async (req, res) => {
  const fu = await load(req, req.params.id);
  const date = parseDay(req.body.followUpDate);
  if (!date) throw new ApiError(400, 'Validation failed.', { followUpDate: 'Enter a valid follow-up date.' });
  if (date < startOfToday()) throw new ApiError(400, 'Validation failed.', { followUpDate: 'Follow-up date cannot be earlier than today.' });

  const oldDate = fu.followUpDate;
  fu.followUpDate = date;
  fu.status = 'Planned';
  await fu.save();
  await writeAudit(req, { action: 'UPDATE', module: 'FollowUps', entityName: 'FollowUp', recordId: fu._id, oldValue: { followUpDate: oldDate }, newValue: { followUpDate: date }, details: 'Rescheduled' });
  res.json({ success: true, followUp: fu });
});

export const remove = asyncHandler(async (req, res) => {
  const fu = await load(req, req.params.id);
  await fu.deleteOne();
  await writeAudit(req, { action: 'DELETE', module: 'FollowUps', entityName: 'FollowUp', recordId: req.params.id, oldValue: snapshot(fu) });
  res.json({ success: true, message: 'Follow-up deleted.' });
});
