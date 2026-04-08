const express = require('express');
const router = express.Router();
const { create, getAll, getById, updateNotes, deleteClassroom } = require('../controllers/classroom.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms — Trainer only (invite student by email)
router.post('/', authenticate, requireRole('trainer'), create);

// GET /api/classrooms — Trainer or Student

router.get('/', authenticate, getAll);

// GET /api/classrooms/:classroomId — Any authenticated user (access enforced in controller)
router.get('/:classroomId', authenticate, getById);

// PATCH /api/classrooms/:classroomId/notes — Trainer only
router.patch('/:classroomId/notes', authenticate, requireRole('trainer'), updateNotes);

// DELETE /api/classrooms/:classroomId — Trainer only
router.delete('/:classroomId', authenticate, requireRole('trainer'), deleteClassroom);

module.exports = router;
