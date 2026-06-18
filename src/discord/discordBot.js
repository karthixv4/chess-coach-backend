const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const commandService = require('./DiscordCommandService');

const startDiscordBot = async () => {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const coachUserId = process.env.DISCORD_COACH_USER_ID;

  if (!token || !clientId || !guildId || !coachUserId) {
    console.warn('[DiscordBot] Missing required environment variables. Bot will not start.');
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('[DiscordBot] Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );
    console.log('[DiscordBot] Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('[DiscordBot] Failed to register commands:', error);
  }

  client.on('ready', () => {
    console.log(`[DiscordBot] Logged in as ${client.user.tag}!`);
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.user.id !== coachUserId) {
      await interaction.reply({ content: 'Access denied.', ephemeral: true });
      return;
    }

    const { commandName } = interaction;

    try {
      if (commandName === 'student') {
        const name = interaction.options.getString('name');
        const res = await commandService.getStudentStatus(name);
        await interaction.reply({ content: res });
      } else if (commandName === 'pending') {
        const res = await commandService.getPendingHomework();
        await interaction.reply({ content: res });
      } else if (commandName === 'today') {
        const res = await commandService.getTodaysSessions();
        await interaction.reply({ content: res });
      } else if (commandName === 'summary') {
        const res = await commandService.getWeeklySummary();
        await interaction.reply({ content: res });
      } else if (commandName === 'students') {
        const res = await commandService.getAllStudents();
        await interaction.reply({ content: res });
      } else if (commandName === 'note') {
        const name = interaction.options.getString('name');
        const text = interaction.options.getString('text');
        const res = await commandService.addCoachNote(name, text);
        await interaction.reply({ content: res });
      } else if (commandName === 'complete-session') {
        const name = interaction.options.getString('name');
        const topic = interaction.options.getString('topic');
        const res = await commandService.completeSession(name, topic);
        await interaction.reply({ content: res });
      } else if (commandName === 'evaluation') {
        const res = await commandService.getPendingEvaluations();
        await interaction.reply({ content: res });
      }
    } catch (err) {
      console.error(`[DiscordBot] Error handling /${commandName}:`, err.message);
      await interaction.reply({ content: 'An internal error occurred while processing the command.', ephemeral: true });
    }
  });

  client.login(token).catch(err => {
    console.error('[DiscordBot] Failed to login:', err.message);
  });
};

module.exports = { startDiscordBot };
