import ApiError from '../utils/ApiError.js';

export const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

// Central error handler: consistent JSON responses, no stack traces or database details to the client
export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;
  let errors = err.errors;

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  }
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed.';
    errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  }
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}.`;
  }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `A record with this ${field || 'value'} already exists.`;
  }
  if (status === 500) {
    console.error(err);
    message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }) });
};
