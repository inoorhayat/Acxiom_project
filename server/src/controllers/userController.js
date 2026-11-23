import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit } from '../utils/audit.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { check, validateUser, passwordErrors, escapeRegex, str } from '../utils/validators.js';
import { ROLES } from '../config/constants.js';

const findUser = async (id) => {
  const user = await User.findById(id).select('+failedLoginCount +lockoutEnd');
  if (!user) throw new ApiError(404, 'User not found.');
  return user;
};

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const r = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: r }, { email: r }];
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'inactive') filter.isActive = false;

  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    User.find(filter).select('+failedLoginCount +lockoutEnd').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, ...pageResult(items, total, p) });
});

// Lightweight list for assignment dropdowns (any logged-in user)
export const assignable = asyncHandler(async (_req, res) => {
  const items = await User.find({ isActive: true }).select('name role').sort({ name: 1 });
  res.json({ success: true, items });
});

export const roles = (_req, res) => res.json({ success: true, items: ROLES });

export const create = asyncHandler(async (req, res) => {
  check(validateUser(req.body, { requirePassword: true }));
  const email = str(req.body.email).toLowerCase();
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({
    name: str(req.body.name),
    email,
    role: req.body.role,
    isActive: req.body.isActive !== false,
    passwordHash: await bcrypt.hash(req.body.password, 12),
  });

  // Password is never written to the audit log
  await writeAudit(req, {
    action: 'USER_CREATE', module: 'Users', entityName: 'User', recordId: user._id,
    newValue: { name: user.name, email, role: user.role },
  });
  res.status(201).json({ success: true, user });
});

export const update = asyncHandler(async (req, res) => {
  check(validateUser(req.body));
  const user = await findUser(req.params.id);
  const email = str(req.body.email).toLowerCase();

  if (email !== user.email && (await User.exists({ email, _id: { $ne: user._id } }))) {
    throw new ApiError(409, 'An account with this email already exists.');
  }
  if (String(user._id) === req.user.id && req.body.role !== 'Admin') {
    throw new ApiError(400, 'You cannot remove your own Admin role.');
  }

  const oldValue = { name: user.name, email: user.email, role: user.role };
  user.name = str(req.body.name);
  user.email = email;
  user.role = req.body.role;
  await user.save();

  const newValue = { name: user.name, email: user.email, role: user.role };
  const roleChanged = oldValue.role !== newValue.role;
  await writeAudit(req, {
    action: roleChanged ? 'ROLE_CHANGE' : 'UPDATE', module: 'Users', entityName: 'User', recordId: user._id,
    oldValue, newValue,
  });
  res.json({ success: true, user });
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = await findUser(req.params.id);
  const isActive = req.body.isActive === true || req.body.isActive === 'true';
  if (String(user._id) === req.user.id && !isActive) {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }
  user.isActive = isActive;
  await user.save();
  await writeAudit(req, {
    action: 'USER_STATUS', module: 'Users', entityName: 'User', recordId: user._id,
    newValue: { isActive }, details: isActive ? 'Account activated' : 'Account deactivated',
  });
  res.json({ success: true, user });
});

export const unlock = asyncHandler(async (req, res) => {
  const user = await findUser(req.params.id);
  user.lockoutEnd = null;
  user.failedLoginCount = 0;
  await user.save();
  await writeAudit(req, { action: 'UNLOCK', module: 'Security', entityName: 'User', recordId: user._id, details: 'Account unlocked by administrator' });
  res.json({ success: true, message: 'Account unlocked.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const pwErr = passwordErrors(req.body.newPassword);
  if (pwErr.length) check({ newPassword: pwErr[0] });
  const user = await findUser(req.params.id);
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.failedLoginCount = 0;
  user.lockoutEnd = null;
  await user.save();
  await writeAudit(req, { action: 'PASSWORD_RESET', module: 'Security', entityName: 'User', recordId: user._id, details: 'Password reset by administrator' });
  res.json({ success: true, message: 'Password reset successfully.' });
});
