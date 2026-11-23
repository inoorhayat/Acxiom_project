import AuditLog from '../models/AuditLog.js';
import asyncHandler from '../utils/asyncHandler.js';
import { pageParams, pageResult } from '../utils/paginate.js';
import { escapeRegex } from '../utils/validators.js';

// Read-only: audit records can be filtered and viewed but never changed
export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.module) filter.module = req.query.module;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.result) filter.result = req.query.result;
  if (req.query.userId) filter.userId = req.query.userId;
  if (req.query.q) {
    const r = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ userName: r }, { entityName: r }, { recordId: r }, { details: r }];
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = to;
    }
  }

  const p = pageParams(req.query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, ...pageResult(items, total, p) });
});
