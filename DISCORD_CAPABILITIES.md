# Discord Integration: Coach Command Center

The Chess Coach backend features a robust two-part Discord integration designed to reduce the need for coaches to constantly log into the portal. 

## 1. Automated Push Notifications (One-Way)
The application utilizes a Webhook to push automated real-time alerts to the coach's Discord server.

### Supported Events:
* **📚 Worksheet Submitted**: Triggers instantly when a student submits a homework worksheet. Includes the student's name, the worksheet title, and the submission time.
* **✅ All Homework Completed**: Sent automatically alongside the "Worksheet Submitted" notification if the student has completely cleared their homework backlog.
* **⚠️ Homework Pending (Overdue)**: A daily automated job (running at 09:00 AM server time) checks for past-due worksheets. Sends an alert once initially, and will follow up with an automatic reminder every 2 days if the worksheet remains incomplete.
* **📋 Pending Evaluations (Daily Summary)**: A daily automated job (running at 07:00 AM server time) sends a consolidated summary of all worksheets that have been submitted by students and are waiting for the coach to evaluate.

---

## 2. Interactive Slash Commands (Two-Way)
The backend acts as a Discord Bot Client. It establishes a persistent WebSocket connection to Discord, meaning **it can receive slash commands even when running locally without needing a public IP, Ngrok, or open ports.**

*Security Note: Commands are strictly authenticated. Only the designated Coach's Discord account (configured via `DISCORD_COACH_USER_ID`) can successfully execute them.*

### Read-Only Commands
* **`/student <name>`** 
  Retrieves a detailed status of a specific student. Includes sessions attended this month, pending/completed worksheet counts, the date and topic of their last session, the schedule of their next session, and the most recent coach note.
* **`/pending`**
  Returns a consolidated list of all active students and their corresponding pending (assigned but not submitted) worksheets.
* **`/evaluation`**
  Returns a consolidated list of all worksheets that have been submitted by students and are currently pending evaluation by the coach.
* **`/today`**
  Displays an ordered schedule of all sessions booked for the current day.
* **`/summary`**
  Provides a weekly coaching summary. Lists all active classrooms alongside how many sessions were completed and worksheets submitted over the past 7 days.
* **`/students`**
  Returns a quick, simple list of all currently active students.

### Write Commands
* **`/note <name> <text>`**
  Allows the coach to quickly add a timestamped private note to a student's profile directly from Discord.
* **`/complete-session <name> <topic>`**
  Finds the next scheduled session for the specified student and marks it as `COMPLETED`, automatically logging the provided `<topic>` into the session notes.

---

## Environment Configuration
To utilize these capabilities, ensure the following are defined in your `.env`:
```env
# Phase 1: Webhook
DISCORD_WEBHOOK_URL_COACH=https://discord.com/api/webhooks/...

# Phase 2: Bot Setup
DISCORD_BOT_TOKEN=MTE...
DISCORD_CLIENT_ID=151...
DISCORD_GUILD_ID=151...
DISCORD_COACH_USER_ID=123...
```
