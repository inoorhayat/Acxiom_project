export function pageParams(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageResult(items, total, { page, limit }) {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
