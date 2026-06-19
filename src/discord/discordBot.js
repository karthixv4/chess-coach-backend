const express = require('express');
const axios = require('axios');
const { verifyKeyMiddleware, InteractionType, InteractionResponseType } = require('discord-interactions');
const commandService = require('./DiscordCommandService');

const router = express.Router();

const getOption = (options, name) => options?.find(o => o.name === name)?.value;

// In development, we bypass the Discord signature check so you can test via Postman
const interactionMiddleware = process.env.NODE_ENV === 'development'
  ? [express.json(), (req, res, next) => next()]
  : [verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY)];

router.post('/interactions', ...interactionMiddleware, async (req, res) => {
  const interaction = req.body;

  // Handle PING from Discord
  if (interaction.type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Handle Application Commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const coachUserId = process.env.DISCORD_COACH_USER_ID;
    
    // Authorization check
    // user ID can be in member.user.id (if from a server) or user.id (if in DMs)
    const senderId = interaction.member?.user?.id || interaction.user?.id;
    if (senderId !== coachUserId) {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Access denied.', flags: 64 }, // Ephemeral
      });
    }

    const commandName = interaction.data.name;
    const options = interaction.data.options || [];
    
    try {
      let result = '';

      if (commandName === 'student') {
        const name = getOption(options, 'name');
        result = await commandService.getStudentStatus(name);
      } else if (commandName === 'pending') {
        result = await commandService.getPendingHomework();
      } else if (commandName === 'today') {
        result = await commandService.getTodaysSessions();
      } else if (commandName === 'summary') {
        result = await commandService.getWeeklySummary();
      } else if (commandName === 'students') {
        result = await commandService.getAllStudents();
      } else if (commandName === 'note') {
        const name = getOption(options, 'name');
        const text = getOption(options, 'text');
        result = await commandService.addCoachNote(name, text);
      } else if (commandName === 'complete-session') {
        const name = getOption(options, 'name');
        const topic = getOption(options, 'topic');
        result = await commandService.completeSession(name, topic);
      } else if (commandName === 'evaluation') {
        result = await commandService.getPendingEvaluations();
      }

      // In development, log the result so we can see it during Postman testing
      if (process.env.NODE_ENV === 'development') {
        console.log("=== DISCORD BOT RESPONSE ===");
        console.log(result);
        console.log("============================");
      }

      // Send the final result directly in the HTTP response (Synchronous mode)
      res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: result
        }
      });

    } catch (err) {
      console.error(`[DiscordBot] Error handling /${commandName}:`, err.message);
      if (!res.headersSent) {
        res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'An internal error occurred while processing the command.' }
        });
      }
    }
  }
});

const registerDiscordCommands = async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.warn('[DiscordBot] Missing environment variables for command registration.');
    return;
  }

  const commands = [
    {
      name: 'student',
      description: 'Retrieve a student\'s current status.',
      options: [{ name: 'name', type: 3, description: 'Student Name', required: true }] // STRING type = 3
    },
    {
      name: 'pending',
      description: 'View all students with pending worksheets.'
    },
    {
      name: 'today',
      description: 'View today\'s scheduled sessions.'
    },
    {
      name: 'summary',
      description: 'View coaching summary.'
    },
    {
      name: 'students',
      description: 'List all active students.'
    },
    {
      name: 'note',
      description: 'Add a coach note to a student.',
      options: [
        { name: 'name', type: 3, description: 'Student Name', required: true },
        { name: 'text', type: 3, description: 'Note Text', required: true }
      ]
    },
    {
      name: 'complete-session',
      description: 'Mark the next scheduled session as completed.',
      options: [
        { name: 'name', type: 3, description: 'Student Name', required: true },
        { name: 'topic', type: 3, description: 'Session Topic', required: true }
      ]
    },
    {
      name: 'evaluation',
      description: 'View all worksheets pending evaluation.'
    }
  ];

  try {
    console.log('[DiscordBot] Started refreshing application (/) commands.');
    await axios.put(
      `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`,
      commands,
      { headers: { Authorization: `Bot ${token}` } }
    );
    console.log('[DiscordBot] Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('[DiscordBot] Failed to register commands:', error.response?.data || error.message);
  }
};

module.exports = { discordRouter: router, registerDiscordCommands };
