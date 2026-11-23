// Forwards errors from async route handlers to the central error handler
export default (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
