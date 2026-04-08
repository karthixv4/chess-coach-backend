const express = require('express');
const router = express.Router();
const { deleteStudent } = require('../controllers/student.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// DELETE /api/students/:studentId — Trainer only
router.delete('/:studentId', authenticate, requireRole('trainer'), deleteStudent);

module.exports = router;
