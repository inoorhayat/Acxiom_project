// Client-side validation mirrors the server rules for instant feedback.
// The server always validates again, so this cannot be bypassed to store bad data.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidPhone = (value) => {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Field rules: { name, label, type, required, maxLength, min, max, notPast }
export function validateFields(fields, values) {
  const errors = {};
  for (const f of fields) {
    const raw = values[f.name];
    const s = raw === undefined || raw === null ? '' : String(raw).trim();

    if (!s) {
      if (f.required) errors[f.name] = `${f.label} is required.`;
      continue;
    }
    if (f.maxLength && s.length > f.maxLength) {
      errors[f.name] = `${f.label} must be ${f.maxLength} characters or fewer.`;
    } else if (f.type === 'email' && !EMAIL_RE.test(s)) {
      errors[f.name] = 'Enter a valid email address.';
    } else if (f.type === 'tel' && !isValidPhone(s)) {
      errors[f.name] = 'Enter a valid 10-digit Indian mobile number.';
    } else if (f.type === 'number') {
      const n = Number(s);
      if (Number.isNaN(n)) errors[f.name] = `${f.label} must be a number.`;
      else if (f.min !== undefined && n < f.min) errors[f.name] = `${f.label} must be ${f.min} or more.`;
      else if (f.max !== undefined && n > f.max) errors[f.name] = `${f.label} must be ${f.max} or less.`;
    } else if (f.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) errors[f.name] = 'Enter a valid date.';
      else if (f.notPast && s < todayStr()) errors[f.name] = `${f.label} cannot be in the past.`;
    }
  }
  return errors;
}

export const passwordErrors = (pw = '') => {
  const e = [];
  if (pw.length < 8) e.push('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(pw)) e.push('Password must include an uppercase letter.');
  if (!/[a-z]/.test(pw)) e.push('Password must include a lowercase letter.');
  if (!/\d/.test(pw)) e.push('Password must include a number.');
  if (!/[^A-Za-z0-9]/.test(pw)) e.push('Password must include a special character.');
  return e;
};
