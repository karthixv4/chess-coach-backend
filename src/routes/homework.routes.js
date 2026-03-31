const express = require('express');
const router = express.Router({ mergeParams: true });
const { create, update, submit, evaluate } = require('../controllers/homework.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms/:classroomId/homework — Trainer only
router.post('/', authenticate, requireRole('trainer'), create);

// PATCH /api/classrooms/:classroomId/homework/:homeworkId — Trainer only
router.patch('/:homeworkId', authenticate, requireRole('trainer'), update);

// POST /api/classrooms/:classroomId/homework/:homeworkId/submit — Student only
router.post('/:homeworkId/submit', authenticate, requireRole('student'), submit);

// POST /api/classrooms/:classroomId/homework/:homeworkId/evaluate — Trainer only
router.post('/:homeworkId/evaluate', authenticate, requireRole('trainer'), evaluate);

module.exports = router;
