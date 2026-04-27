const express = require('express');
const router = express.Router({ mergeParams: true });

const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { getClassroomSummary, getInactiveStudents } = require('../controllers/analytics.controller');

router.use(authenticate);
router.use(requireRole('trainer'));

// GET /api/classrooms/:classroomId/analytics/summary
router.get('/summary', getClassroomSummary);

// GET /api/analytics/inactive-students?inactiveDays=3  (registered globally in index.js)
router.get('/inactive-students', getInactiveStudents);

module.exports = router;
