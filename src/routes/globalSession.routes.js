const express = require('express');
const router = express.Router();
const { getByStudentId } = require('../controllers/session.controller');
const { authenticate } = require('../middleware/auth');

// GET /api/sessions/student/:studentId
router.get('/student/:studentId', authenticate, getByStudentId);

module.exports = router;
