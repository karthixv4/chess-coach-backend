/**
 * Global Express error handler.
 * Must be registered LAST in Express middleware chain (4 arguments).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} —`, err.message);

  const status = err.status || err.statusCode || 500;
  const error = err.name || 'InternalServerError';
  const message = err.message || 'Something went wrong. Please try again later.';

  res.status(status).json({ error, message });
};

module.exports = { errorHandler };
