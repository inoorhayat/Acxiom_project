import AuditLog from '../models/AuditLog.js';

const SECRET_KEYS = ['password', 'passwordHash', 'confirmPassword', 'token', 'resetToken', 'failedLoginCount', 'lockoutEnd'];

// Copies a document for audit storage with all secrets removed
export function snapshot(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  SECRET_KEYS.forEach((k) => delete obj[k]);
  delete obj.__v;
  return obj;
}

// Never throws: a failed audit write must not break the business operation (it is logged to the console)
export async function writeAudit(req, entry) {
  try {
    await AuditLog.create({
      userId: entry.userId ?? req?.user?.id ?? null,
      userName: entry.userName ?? req?.user?.name ?? 'Anonymous',
      action: entry.action,
      module: entry.module,
      entityName: entry.entityName ?? '',
      recordId: String(entry.recordId ?? ''),
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      result: entry.result ?? 'Success',
      details: entry.details ?? '',
      ipAddress: req?.ip ?? '',
    });
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
}
