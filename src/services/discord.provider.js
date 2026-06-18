const axios = require('axios');

class DiscordProvider {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL_COACH;
  }

  /**
   * Sends a message to the Discord webhook.
   * Uses fire-and-forget mechanism to not block the event loop.
   * @param {Object} embed Discord embed object
   */
  async sendEmbed(embed) {
    if (!this.webhookUrl) {
      console.warn('[DiscordProvider] Webhook URL not configured. Skipping notification.');
      return;
    }

    try {
      // Fire and forget
      axios.post(this.webhookUrl, { embeds: [embed] }).catch(err => {
        console.error('[DiscordProvider] Error sending notification to Discord:', err.message);
      });
    } catch (err) {
      console.error('[DiscordProvider] Unexpected error preparing Discord notification:', err.message);
    }
  }

  createWorksheetSubmittedEmbed(studentName, worksheetName, timestamp) {
    return {
      title: '📚 Worksheet Submitted',
      color: 0x3498db, // Blue
      fields: [
        { name: 'Student', value: studentName, inline: true },
        { name: 'Worksheet', value: worksheetName || 'Unnamed Worksheet', inline: true },
        { name: 'Submitted At', value: timestamp ? new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), inline: false }
      ],
      timestamp: new Date().toISOString()
    };
  }

  createAllHomeworkCompletedEmbed(studentName) {
    return {
      title: '✅ All Homework Completed',
      color: 0x2ecc71, // Green
      description: 'The student currently has no pending worksheets.',
      fields: [
        { name: 'Student', value: studentName, inline: true }
      ],
      timestamp: new Date().toISOString()
    };
  }

  createHomeworkOverdueEmbed(studentName, worksheetName, dueDate) {
    return {
      title: '⚠️ Homework Pending',
      color: 0xe74c3c, // Red
      fields: [
        { name: 'Student', value: studentName, inline: true },
        { name: 'Pending Worksheet', value: worksheetName || 'Unnamed Worksheet', inline: true },
        { name: 'Due Date', value: new Date(dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }), inline: false }
      ],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new DiscordProvider();
