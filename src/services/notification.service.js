const discordProvider = require('./discord.provider');

class NotificationService {
  /**
   * Notifies that a worksheet has been submitted.
   * @param {string} studentName Name of the student
   * @param {string} worksheetName Title of the worksheet
   * @param {Date} timestamp Submission time
   */
  notifyWorksheetSubmitted(studentName, worksheetName, timestamp) {
    console.log(`[NotificationService] notifyWorksheetSubmitted triggered for ${studentName}`);
    const embed = discordProvider.createWorksheetSubmittedEmbed(studentName, worksheetName, timestamp);
    discordProvider.sendEmbed(embed);
  }

  /**
   * Notifies that a student has completed all their pending worksheets.
   * @param {string} studentName Name of the student
   */
  notifyAllHomeworkCompleted(studentName) {
    console.log(`[NotificationService] notifyAllHomeworkCompleted triggered for ${studentName}`);
    const embed = discordProvider.createAllHomeworkCompletedEmbed(studentName);
    discordProvider.sendEmbed(embed);
  }

  /**
   * Notifies that a student's homework is overdue.
   * @param {string} studentName Name of the student
   * @param {string} worksheetName Title of the worksheet
   * @param {Date} dueDate The due date of the worksheet
   */
  notifyHomeworkOverdue(studentName, worksheetName, dueDate) {
    console.log(`[NotificationService] notifyHomeworkOverdue triggered for ${studentName}`);
    const embed = discordProvider.createHomeworkOverdueEmbed(studentName, worksheetName, dueDate);
    discordProvider.sendEmbed(embed);
  }

  /**
   * Notifies the coach about all pending evaluations for students.
   */
  async notifyPendingEvaluationsDaily() {
    console.log(`[NotificationService] notifyPendingEvaluationsDaily triggered`);
    const commandService = require('../discord/DiscordCommandService');
    const summary = await commandService.getPendingEvaluations();
    
    if (summary === 'No worksheets pending for evaluation.') {
      return; // Do not send empty notifications
    }

    const embed = {
      title: '📋 Pending Evaluations',
      color: 0x9b59b6, // Purple
      description: summary,
      timestamp: new Date().toISOString()
    };
    
    discordProvider.sendEmbed(embed);
  }
}

module.exports = new NotificationService();
