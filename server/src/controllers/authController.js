import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { writeAudit } from '../utils/audit.js';
import { check, validateLogin, validateRegister, passwordErrors, str } from '../utils/validators.js';

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

export const register = asyncHandler(async (req, res) => {
  check(validateRegister(req.body));
  const email = str(req.body.email).toLowerCase();
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  // Public registration always creates a Sales Executive; Admins assign other roles
  const user = await User.create({ name: str(req.body.name), email, passwordHash, role: 'SalesExecutive' });

  await writeAudit(req, {
    action: 'REGISTER', module: 'Authentication', entityName: 'User', recordId: user._id,
    userId: user._id, userName: user.name, newValue: { email, role: user.role },
  });
  res.status(201).json({ success: true, message: 'Account created. Please log in.', user });
});

export const login = asyncHandler(async (req, res) => {
  check(validateLogin(req.body));
  const email = str(req.body.email).toLowerCase();
  const maxAttempts = Number(process.env.MAX_LOGIN_ATTEMPTS || 5);
  const lockMinutes = Number(process.env.LOCKOUT_MINUTES || 15);

  const user = await User.findOne({ email }).select('+passwordHash +failedLoginCount +lockoutEnd');

  // Generic message so attackers cannot discover which emails exist
  if (!user) {
    await writeAudit(req, {
      action: 'LOGIN_FAILED', module: 'Authentication', entityName: 'User', recordId: email,
      userName: email, result: 'Failure', details: 'Unknown account',
    });
    throw new ApiError(401, 'Invalid email or password.');
  }

  if (user.lockoutEnd && user.lockoutEnd > new Date()) {
    await writeAudit(req, {
      action: 'LOGIN_BLOCKED', module: 'Authentication', entityName: 'User', recordId: String(user._id),
      userId: user._id, userName: user.name, result: 'Failure', details: 'Login attempted while locked',
    });
    throw new ApiError(423, 'Account is temporarily locked after repeated failed attempts. Try again later.');
  }

  if (!user.isActive) {
    await writeAudit(req, {
      action: 'LOGIN_FAILED', module: 'Authentication', entityName: 'User', recordId: String(user._id),
      userId: user._id, userName: user.name, result: 'Failure', details: 'Inactive account',
    });
    throw new ApiError(403, 'This account is deactivated. Please contact an administrator.');
  }

  const ok = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!ok) {
    user.failedLoginCount += 1;
    let action = 'LOGIN_FAILED';
    let details = `Failed attempt ${user.failedLoginCount} of ${maxAttempts}`;
    if (user.failedLoginCount >= maxAttempts) {
      user.lockoutEnd = new Date(Date.now() + lockMinutes * 60000);
      user.failedLoginCount = 0;
      action = 'ACCOUNT_LOCKED';
      details = `Account locked for ${lockMinutes} minutes`;
    }
    await user.save();
    await writeAudit(req, {
      action, module: 'Authentication', entityName: 'User', recordId: String(user._id),
      userId: user._id, userName: user.name, result: 'Failure', details,
    });
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Successful login resets the failure counter and any expired lock
  user.failedLoginCount = 0;
  user.lockoutEnd = null;
  user.lastLoginAt = new Date();
  await user.save();

  await writeAudit(req, {
    action: 'LOGIN_SUCCESS', module: 'Authentication', entityName: 'User', recordId: String(user._id),
    userId: user._id, userName: user.name, details: 'User logged in',
  });
  res.json({ success: true, token: signToken(user), user: user.toJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  await writeAudit(req, { action: 'LOGOUT', module: 'Authentication', entityName: 'User', recordId: req.user.id });
  res.json({ success: true, message: 'Logged out.' });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ success: true, user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const errors = {};
  if (!str(req.body.currentPassword)) errors.currentPassword = 'Current password is required.';
  const pwErr = passwordErrors(req.body.newPassword);
  if (pwErr.length) errors.newPassword = pwErr[0];
  if (req.body.newPassword !== req.body.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  check(errors);

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(400, 'Validation failed.', { currentPassword: 'Current password is incorrect.' });
  }
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await user.save();

  await writeAudit(req, { action: 'PASSWORD_CHANGE', module: 'Security', entityName: 'User', recordId: user._id, details: 'Password changed by user' });
  res.json({ success: true, message: 'Password updated successfully.' });
});
