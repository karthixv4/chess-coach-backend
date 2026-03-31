const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '7d';

/**
 * Signs a JWT for the given user.
 * @param {{ id: string, role: string }} payload
 * @returns {string} signed JWT
 */
const generateToken = (payload) => {
  if (!SECRET) throw new Error('JWT_SECRET is not defined in environment variables.');
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
};

/**
 * Verifies and decodes a JWT.
 * @param {string} token
 * @returns {{ id: string, role: string }} decoded payload
 */
const verifyToken = (token) => {
  if (!SECRET) throw new Error('JWT_SECRET is not defined in environment variables.');
  return jwt.verify(token, SECRET);
};

module.exports = { generateToken, verifyToken };
