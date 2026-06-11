const express = require('express');
const router = express.Router({ mergeParams: true }); // inherit :classroomId from parent

const { authenticate } = require('../middleware/auth');
const { checkFeature } = require('../middleware/featureFlag');
const {
  createLog,
  getLogs,
  getLog,
  updateLog,
  deleteLog,
  pushWorksheet,
} = require('../controllers/dailyLog.controller');

// All routes require authentication
router.use(authenticate);

// POST   /api/classrooms/:classroomId/daily-logs            — student submits today's log
// GET    /api/classrooms/:classroomId/daily-logs            — list logs (trainer sees all, student sees own)
router.route('/').all(checkFeature('ENABLE_PRACTICE_LOGS')).post(createLog).get(getLogs);

// GET    /api/classrooms/:classroomId/daily-logs/:logId     — single log
// PATCH  /api/classrooms/:classroomId/daily-logs/:logId     — student updates their log
// DELETE /api/classrooms/:classroomId/daily-logs/:logId     — trainer or student deletes a log
router.route('/:logId').all(checkFeature('ENABLE_PRACTICE_LOGS')).get(getLog).patch(updateLog).delete(deleteLog);

// POST   /api/classrooms/:classroomId/push-worksheet        — trainer pushes a homework to student
router.post('/push-worksheet', pushWorksheet);

module.exports = router;
