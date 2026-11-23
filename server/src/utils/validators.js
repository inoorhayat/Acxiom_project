import ApiError from './ApiError.js';
import {
  ROLES, CUSTOMER_STATUSES, LEAD_STATUSES, LEAD_SOURCES, PRIORITIES,
  OPP_STAGES, CLOSED_STAGES, FOLLOWUP_STATUSES, FOLLOWUP_TYPES, RELATED_TYPES,
} from '../config/constants.js';

export const str = (v) => String(v ?? '').trim();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (v) => EMAIL_RE.test(v) && v.length <= 150;
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Accepts 10-digit Indian mobile numbers, optionally prefixed with 0 or +91
export const normalizePhone = (v) => {
  let d = str(v).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
export const isValidPhone = (v) => /^[6-9]\d{9}$/.test(normalizePhone(v));

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Parses YYYY-MM-DD as a local date (avoids timezone shifts)
export function parseDay(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(v))) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
}

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export function passwordErrors(pw = '') {
  const e = [];
  if (pw.length < 8) e.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(pw)) e.push('Password must include an uppercase letter.');
  if (!/[a-z]/.test(pw)) e.push('Password must include a lowercase letter.');
  if (!/\d/.test(pw)) e.push('Password must include a number.');
  if (!/[^A-Za-z0-9]/.test(pw)) e.push('Password must include a special character.');
  return e;
}

// Throws a 400 with field-level messages if any validation failed
export function check(errors) {
  if (Object.keys(errors).length) throw new ApiError(400, 'Validation failed.', errors);
}

const optionalText = (errors, body, key, label, max) => {
  const v = str(body[key]);
  if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
};
const oneOf = (errors, body, key, label, list, required = false) => {
  const v = str(body[key]);
  if (!v && required) errors[key] = `${label} is required.`;
  else if (v && !list.includes(v)) errors[key] = `Select a valid ${label.toLowerCase()}.`;
};

export function validateLogin(b) {
  const e = {};
  if (!str(b.email)) e.email = 'Email is required.';
  if (!str(b.password)) e.password = 'Password is required.';
  return e;
}

export function validateRegister(b) {
  const e = {};
  const name = str(b.name);
  if (!name) e.name = 'Name is required.';
  else if (name.length > 100) e.name = 'Name must be 100 characters or fewer.';
  if (!str(b.email)) e.email = 'Email is required.';
  else if (!isValidEmail(str(b.email).toLowerCase())) e.email = 'Enter a valid email address.';
  const pwErr = passwordErrors(b.password);
  if (pwErr.length) e.password = pwErr[0];
  if (b.password !== b.confirmPassword) e.confirmPassword = 'Passwords do not match.';
  return e;
}

export function validateUser(b, { requirePassword = false } = {}) {
  const e = {};
  const name = str(b.name);
  if (!name) e.name = 'Name is required.';
  else if (name.length > 100) e.name = 'Name must be 100 characters or fewer.';
  if (!str(b.email)) e.email = 'Email is required.';
  else if (!isValidEmail(str(b.email).toLowerCase())) e.email = 'Enter a valid email address.';
  oneOf(e, b, 'role', 'Role', ROLES, true);
  if (requirePassword) {
    const pwErr = passwordErrors(b.password);
    if (pwErr.length) e.password = pwErr[0];
  }
  return e;
}

export function validateCustomer(b) {
  const e = {};
  const name = str(b.customerName);
  if (!name) e.customerName = 'Customer name is required.';
  else if (name.length > 120) e.customerName = 'Customer name must be 120 characters or fewer.';
  if (!str(b.email)) e.email = 'Email is required.';
  else if (!isValidEmail(str(b.email).toLowerCase())) e.email = 'Enter a valid email address.';
  if (!str(b.phone)) e.phone = 'Phone is required.';
  else if (!isValidPhone(b.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
  optionalText(e, b, 'companyName', 'Company name', 150);
  optionalText(e, b, 'address', 'Address', 300);
  optionalText(e, b, 'city', 'City', 80);
  optionalText(e, b, 'state', 'State', 80);
  optionalText(e, b, 'notes', 'Notes', 2000);
  oneOf(e, b, 'status', 'Status', CUSTOMER_STATUSES);
  return e;
}

export function validateLead(b) {
  const e = {};
  const name = str(b.leadName);
  if (!name) e.leadName = 'Lead name is required.';
  else if (name.length > 120) e.leadName = 'Lead name must be 120 characters or fewer.';
  if (str(b.email) && !isValidEmail(str(b.email).toLowerCase())) e.email = 'Enter a valid email address.';
  if (str(b.phone) && !isValidPhone(b.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
  optionalText(e, b, 'companyName', 'Company name', 150);
  optionalText(e, b, 'notes', 'Notes', 2000);
  oneOf(e, b, 'status', 'Status', LEAD_STATUSES, true);
  oneOf(e, b, 'source', 'Source', LEAD_SOURCES);
  oneOf(e, b, 'priority', 'Priority', PRIORITIES);
  if (b.expectedValue !== undefined && b.expectedValue !== '') {
    const v = num(b.expectedValue);
    if (Number.isNaN(v)) e.expectedValue = 'Expected value must be a number.';
    else if (v < 0 || v > 1e12) e.expectedValue = 'Expected value must be between 0 and 1,000,000,000,000.';
  }
  return e;
}

export function validateOpportunity(b) {
  const e = {};
  const name = str(b.opportunityName);
  if (!name) e.opportunityName = 'Opportunity name is required.';
  else if (name.length > 150) e.opportunityName = 'Opportunity name must be 150 characters or fewer.';
  if (!str(b.customerId)) e.customerId = 'Customer is required.';
  oneOf(e, b, 'stage', 'Stage', OPP_STAGES, true);
  const active = !CLOSED_STAGES.includes(str(b.stage));

  const amount = num(b.amount);
  if (Number.isNaN(amount)) e.amount = 'Opportunity Amount is required.';
  else if (amount < 0) e.amount = 'Opportunity Amount cannot be negative.';
  else if (active && amount <= 0) e.amount = 'Opportunity Amount must be greater than 0.';

  const prob = num(b.probability);
  if (Number.isNaN(prob)) e.probability = 'Probability is required.';
  else if (prob < 0 || prob > 100) e.probability = 'Probability must be between 0 and 100.';

  const close = parseDay(b.expectedCloseDate);
  if (!close) e.expectedCloseDate = 'Enter a valid Expected Close Date.';
  else if (active && close < startOfToday()) e.expectedCloseDate = 'Expected Close Date cannot be in the past.';

  optionalText(e, b, 'notes', 'Notes', 2000);
  return e;
}

export function validateFollowUp(b, { isNew = false } = {}) {
  const e = {};
  const subject = str(b.subject);
  if (!subject) e.subject = 'Subject is required.';
  else if (subject.length > 150) e.subject = 'Subject must be 150 characters or fewer.';
  oneOf(e, b, 'relatedType', 'Related type', RELATED_TYPES, true);
  if (!str(b.relatedId)) e.relatedId = 'Related record is required.';
  oneOf(e, b, 'followUpType', 'Follow-up type', FOLLOWUP_TYPES, true);
  oneOf(e, b, 'status', 'Status', FOLLOWUP_STATUSES);

  const date = parseDay(b.followUpDate);
  if (!date) e.followUpDate = 'Enter a valid follow-up date.';
  else if ((isNew || str(b.status) === 'Planned') && date < startOfToday()) {
    e.followUpDate = 'Follow-up date cannot be earlier than today.';
  }
  optionalText(e, b, 'notes', 'Notes', 2000);
  return e;
}
