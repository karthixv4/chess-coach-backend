const cron = require('node-cron');
const prisma = require('../prisma/prismaConnection');
const notificationService = require('../services/notification.service');

const runHomeworkOverdueCheck = async () => {
  try {
    console.log('[HomeworkOverdueJob] Running daily check for overdue homework...');

    const now = new Date();
    // 2 days ago
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const overdueHomeworks = await prisma.homework.findMany({
      where: {
        status: 'ASSIGNED',
        dueDate: { lt: now },
        OR: [
          { lastRemindedAt: null },
          { lastRemindedAt: { lt: twoDaysAgo } }
        ]
      },
      include: {
        classroom: {
          include: { student: true }
        }
      }
    });

    for (const hw of overdueHomeworks) {
      if (hw.classroom && hw.classroom.student) {
        notificationService.notifyHomeworkOverdue(
          hw.classroom.student.name,
          hw.title,
          hw.dueDate
        );

        // Update the lastRemindedAt field to prevent duplicate notifications
        await prisma.homework.update({
          where: { id: hw.id },
          data: { lastRemindedAt: now }
        });
      }
    }

    console.log(`[HomeworkOverdueJob] Checked overdue homework. Sent ${overdueHomeworks.length} notifications.`);
  } catch (err) {
    console.error('[HomeworkOverdueJob] Error running overdue check:', err.message);
  }
};

// Run every day at 09:00 AM server time
const start = () => {
  cron.schedule('0 9 * * *', runHomeworkOverdueCheck);
  console.log('[HomeworkOverdueJob] Scheduled daily check for 09:00 AM.');
};

module.exports = { start, runHomeworkOverdueCheck };
