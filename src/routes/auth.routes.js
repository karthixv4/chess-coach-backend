const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register — Public
router.post('/register', register);

// POST /api/auth/login — Public
router.post('/login', login);

// GET /api/auth/me — Authenticated
router.get('/me', authenticate, getMe);

// PUT /api/auth/change-password — Authenticated
router.put('/change-password', authenticate, changePassword);

module.exports = router;
