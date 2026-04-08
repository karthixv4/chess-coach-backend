const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 5 auth requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many authentication attempts, please try again after 15 minutes' }
});

// POST /api/auth/register — Public
router.post('/register', authLimiter, register);

// POST /api/auth/login — Public
router.post('/login', authLimiter, login);

// GET /api/auth/me — Authenticated
router.get('/me', authenticate, getMe);

// PUT /api/auth/change-password — Authenticated
router.put('/change-password', authenticate, changePassword);

module.exports = router;
