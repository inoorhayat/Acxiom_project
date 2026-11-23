import mongoose from 'mongoose';

// Admin and Manager see all team records; Sales Executives see only their own/assigned records
export const isFullAccess = (user) => ['Admin', 'Manager'].includes(user.role);

// Filter for normal Mongoose queries (auto-casts string ids)
export const scopeFilter = (user, field = 'ownerId') =>
  isFullAccess(user) ? {} : { [field]: user.id };

// Filter for aggregation pipelines (must use real ObjectIds)
export const aggScope = (user, field = 'ownerId') =>
  isFullAccess(user) ? {} : { [field]: new mongoose.Types.ObjectId(user.id) };

export const canAccess = (user, ownerId) =>
  isFullAccess(user) || String(ownerId) === String(user.id);

// Returns { from, to } for dashboard/report date ranges
export function dateRange(range = 'month', from, to) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86400000 - 1);

  if (range === 'today') return { from: startToday, to: endToday };
  if (range === 'week') return { from: new Date(startToday.getTime() - 6 * 86400000), to: endToday };
  if (range === 'custom' && from && to) {
    const f = new Date(from);
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    return { from: f, to: t };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endToday }; // month (default)
}
