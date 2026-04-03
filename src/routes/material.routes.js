const express = require('express');
const router = express.Router({ mergeParams: true });
const { create, remove, update } = require('../controllers/material.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms/:classroomId/materials — Trainer only
router.post('/', authenticate, requireRole('trainer'), create);

// PATCH /api/classrooms/:classroomId/materials/:materialId — Trainer only
router.patch('/:materialId', authenticate, requireRole('trainer'), update);

// DELETE /api/classrooms/:classroomId/materials/:materialId — Trainer only
router.delete('/:materialId', authenticate, requireRole('trainer'), remove);

module.exports = router;
