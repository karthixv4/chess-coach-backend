const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :classroomId from parent router
const { create, update, updateStatus, remove, getAllForClassroom } = require('../controllers/session.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// GET /api/classrooms/:classroomId/sessions
router.get('/', authenticate, getAllForClassroom);

// POST /api/classrooms/:classroomId/sessions
router.post('/', authenticate, requireRole('trainer'), create);

// PATCH /api/classrooms/:classroomId/sessions/:sessionId  (edit title, date, time, link)
router.patch('/:sessionId', authenticate, requireRole('trainer'), update);

// PATCH /api/classrooms/:classroomId/sessions/:sessionId/status
router.patch('/:sessionId/status', authenticate, requireRole('trainer'), updateStatus);

// DELETE /api/classrooms/:classroomId/sessions/:sessionId
router.delete('/:sessionId', authenticate, requireRole('trainer'), remove);

module.exports = router;
