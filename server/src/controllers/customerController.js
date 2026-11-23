import Customer from '../models/Customer.js';
import User from '../models/User.js';
import Opportunity from '../models/Opportunity.js';
import FollowUp from '../models/FollowUp.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit, snapshot } from '../utils/audit.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { scopeFilter, canAccess, isFullAccess } from '../utils/scope.js';
import { check, validateCustomer, normalizePhone, escapeRegex, str } from '../utils/validators.js';

const load = async (req, id) => {
  const customer = await Customer.findById(id);
  // 404 (not 403) for other users' records so their existence is not revealed
  if (!customer || !canAccess(req.user, customer.ownerId)) throw new ApiError(404, 'Customer not found.');
  return customer;
};

// Builds the saved document; phone is stored normalized, and only Managers/Admins may assign owners
async function buildPayload(req, body, existing) {
  const data = {
    customerName: str(body.customerName),
    email: str(body.email).toLowerCase(),
    phone: normalizePhone(body.phone),
    companyName: str(body.companyName),
    address: str(body.address),
    city: str(body.city),
    state: str(body.state),
    notes: str(body.notes),
    status: str(body.status) || existing?.status || 'Active',
  };
  let ownerId = existing?.ownerId ?? req.user.id;
  if (isFullAccess(req.user) && body.ownerId) ownerId = body.ownerId;
  if (!existing && !isFullAccess(req.user)) ownerId = req.user.id;
  const owner = await User.findById(ownerId);
  if (!owner || !owner.isActive) throw new ApiError(400, 'Validation failed.', { ownerId: 'Select a valid assigned user.' });
  data.ownerId = ownerId;
  return data;
}

async function checkDuplicates(data, excludeId) {
  const errors = {};
  const filter = excludeId ? { _id: { $ne: excludeId } } : {};
  if (await Customer.exists({ ...filter, email: data.email })) errors.email = 'This email is already used by another customer.';
  if (await Customer.exists({ ...filter, phone: data.phone })) errors.phone = 'This phone number is already used by another customer.';
  check(errors);
}

export const list = asyncHandler(async (req, res) => {
  const filter = { ...scopeFilter(req.user) };
  if (req.query.status) filter.status = req.query.status;
  if (isFullAccess(req.user) && req.query.ownerId) filter.ownerId = req.query.ownerId;
  if (req.query.q) {
    const r = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ customerName: r }, { email: r }, { phone: r }, { companyName: r }];
  }
  const sortable = { customerName: 1, createdAt: -1 };
  const sort = sortable[req.query.sortBy] ? { [req.query.sortBy]: req.query.sortOrder === 'asc' ? 1 : -1 } : { createdAt: -1 };

  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    Customer.find(filter).populate('ownerId', 'name').sort(sort).skip(p.skip).limit(p.limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ success: true, ...pageResult(items, total, p) });
});

// Details plus history: related opportunities and follow-ups
export const get = asyncHandler(async (req, res) => {
  const customer = await load(req, req.params.id);
  await customer.populate('ownerId', 'name');
  const [opportunities, followUps] = await Promise.all([
    Opportunity.find({ customerId: customer._id }).sort({ createdAt: -1 }),
    FollowUp.find({ relatedType: 'Customer', relatedId: customer._id }).sort({ followUpDate: -1 }),
  ]);
  res.json({ success: true, customer, opportunities, followUps });
});

export const create = asyncHandler(async (req, res) => {
  check(validateCustomer(req.body));
  const data = await buildPayload(req, req.body);
  await checkDuplicates(data);

  const customer = await Customer.create({ ...data, createdBy: req.user.id });
  await writeAudit(req, { action: 'CREATE', module: 'Customers', entityName: 'Customer', recordId: customer._id, newValue: snapshot(customer) });
  res.status(201).json({ success: true, customer });
});

export const update = asyncHandler(async (req, res) => {
  const customer = await load(req, req.params.id);
  check(validateCustomer(req.body));
  const data = await buildPayload(req, req.body, customer);
  await checkDuplicates(data, customer._id);

  const oldValue = snapshot(customer);
  const oldStatus = customer.status;
  Object.assign(customer, data);
  await customer.save();

  await writeAudit(req, { action: 'UPDATE', module: 'Customers', entityName: 'Customer', recordId: customer._id, oldValue, newValue: snapshot(customer) });
  if (oldStatus !== customer.status) {
    await writeAudit(req, { action: 'STATUS_CHANGE', module: 'Customers', entityName: 'Customer', recordId: customer._id, oldValue: { status: oldStatus }, newValue: { status: customer.status } });
  }
  res.json({ success: true, customer });
});

// Delete is a soft delete (deactivation) so related history is preserved
export const remove = asyncHandler(async (req, res) => {
  const customer = await load(req, req.params.id);
  customer.status = 'Inactive';
  await customer.save();
  await writeAudit(req, { action: 'DELETE', module: 'Customers', entityName: 'Customer', recordId: customer._id, details: 'Customer deactivated' });
  res.json({ success: true, message: 'Customer deactivated.' });
});
