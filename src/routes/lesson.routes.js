const express = require('express');
const router = express.Router({ mergeParams: true });
const { create, update, markRead } = require('../controllers/lesson.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms/:classroomId/lessons — Trainer only
router.post('/', authenticate, requireRole('trainer'), create);

// PATCH /api/classrooms/:classroomId/lessons/:lessonId — Trainer only
router.patch('/:lessonId', authenticate, requireRole('trainer'), update);

// PATCH /api/classrooms/:classroomId/lessons/:lessonId/read — Student only
router.patch('/:lessonId/read', authenticate, requireRole('student'), markRead);

module.exports = router;
