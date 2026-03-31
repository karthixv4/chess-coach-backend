const express = require('express');
const router = express.Router({ mergeParams: true });
const { send } = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms/:classroomId/notifications — Student only
router.post('/', authenticate, requireRole('student'), send);

module.exports = router;
