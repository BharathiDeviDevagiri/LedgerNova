export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error('[LedgerLine Error]', {
    message: err.message,
    stack:
      process.env.NODE_ENV === 'development'
        ? err.stack
        : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  let statusCode = Number(err.statusCode || err.status || 500);

  if (
    !Number.isInteger(statusCode) ||
    statusCode < 400 ||
    statusCode > 599
  ) {
    statusCode = 500;
  }

  // Never expose internal server errors in production.
  const message =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error.'
      : err.message || 'Internal server error.';

  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}