const express = require('express');
const router = express.Router();
const { getByStudentId, getByTrainerId } = require('../controllers/session.controller');
const { authenticate } = require('../middleware/auth');

// GET /api/sessions/student/:studentId
router.get('/student/:studentId', authenticate, getByStudentId);

// GET /api/sessions/trainer
router.get('/trainer', authenticate, getByTrainerId);

module.exports = router;
