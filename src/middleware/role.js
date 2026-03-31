/**
 * Middleware factory: Restrict access by role.
 * Usage: requireRole('trainer') or requireRole('student')
 */
const requireRole = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated.' });
  }
  if (req.user.role.toLowerCase() !== role.toLowerCase()) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `You do not have permission to perform this action. Required role: ${role}.`,
    });
  }
  next();
};

module.exports = { requireRole };
