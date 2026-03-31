const { generateToken, verifyToken } = require('../utils/jwt');

/**
 * Middleware: Authenticate JWT from Authorization: Bearer <token> header.
 * Attaches req.user = { id, role } if valid.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token.' });
  }
};

module.exports = { authenticate };
