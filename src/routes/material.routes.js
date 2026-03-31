const express = require('express');
const router = express.Router({ mergeParams: true });
const { create, remove } = require('../controllers/material.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// POST /api/classrooms/:classroomId/materials — Trainer only
router.post('/', authenticate, requireRole('trainer'), create);

// DELETE /api/classrooms/:classroomId/materials/:materialId — Trainer only
router.delete('/:materialId', authenticate, requireRole('trainer'), remove);

module.exports = router;
