const express = require('express');
const router = express.Router({ mergeParams: true }); // access :classroomId from parent
const { generate, saveDraft, publish, getAll, acknowledge } = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// GET  /api/classrooms/:classroomId/reports  — trainer sees all, student sees published only
router.get('/', authenticate, getAll);

// POST /api/classrooms/:classroomId/reports/generate  — trainer generates (idempotent)
router.post('/generate', authenticate, requireRole('trainer'), generate);

// PATCH /api/classrooms/:classroomId/reports/:reportId  — save draft fields (autosave)
router.patch('/:reportId', authenticate, requireRole('trainer'), saveDraft);

// PATCH /api/classrooms/:classroomId/reports/:reportId/publish  — publish report
router.patch('/:reportId/publish', authenticate, requireRole('trainer'), publish);

// PATCH /api/classrooms/:classroomId/reports/:reportId/acknowledge  — student acknowledges
router.patch('/:reportId/acknowledge', authenticate, requireRole('student'), acknowledge);

module.exports = router;
