const cron = require('node-cron');
const notificationService = require('../services/notification.service');

const runEvaluationReminderCheck = async () => {
  try {
    console.log('[EvaluationReminderJob] Running daily check for pending evaluations...');
    await notificationService.notifyPendingEvaluationsDaily();
    console.log('[EvaluationReminderJob] Completed check for pending evaluations.');
  } catch (err) {
    console.error('[EvaluationReminderJob] Error running evaluation reminder check:', err.message);
  }
};

// Run every day at 07:00 AM server time
const start = () => {
  cron.schedule('0 7 * * *', runEvaluationReminderCheck);
  console.log('[EvaluationReminderJob] Scheduled daily check for 07:00 AM.');
};

module.exports = { start, runEvaluationReminderCheck };
