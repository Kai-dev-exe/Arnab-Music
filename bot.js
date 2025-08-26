const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a];
    }),
});

client.config = config;
initializePlayer(client);

client.on("ready", () => {
    console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
    console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);

    // Start periodic cleanup for voice channel statuses
    startVoiceStatusCleanup(client);
});
client.config = config;

fs.readdir("./events", (_err, files) => {
  files.forEach((file) => {
    if (!file.endsWith(".js")) return;
    const event = require(`./events/${file}`);
    let eventName = file.split(".")[0]; 
    client.on(eventName, event.bind(null, client));
    delete require.cache[require.resolve(`./events/${file}`)];
  });
});


client.commands = [];
fs.readdir(config.commandsDir, (err, files) => {
  if (err) throw err;
  files.forEach(async (f) => {
    try {
      if (f.endsWith(".js")) {
        let props = require(`${config.commandsDir}/${f}`);
        client.commands.push({
          name: props.name,
          description: props.description,
          options: props.options,
        });
      }
    } catch (err) {
      console.log(err);
    }
  });
});


client.on("raw", (d) => {
    const { GatewayDispatchEvents } = require("discord.js");
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

// Handle voice state updates to detect manual bot disconnections and alone status
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const { updateVoiceChannelStatus, checkAloneStatus } = require('./player.js');

        // Check if the bot was disconnected from a voice channel
        if (oldState.member && oldState.member.id === client.user.id) {
            // Bot was in a voice channel before
            if (oldState.channelId && !newState.channelId) {
                // Bot was disconnected from voice channel
                console.log(`🔊 Bot was disconnected from voice channel: ${oldState.channelId} in guild: ${oldState.guild.id}`);

                // Clear the voice channel status
                await updateVoiceChannelStatus(client, oldState.channelId, "");

                // Destroy the player if it exists
                const player = client.riffy.players.get(oldState.guild.id);
                if (player) {
                    console.log(`🎵 Destroying player for guild: ${oldState.guild.id} due to manual disconnect`);
                    player.destroy();
                }
            }
        } else {
            // Check for alone status changes when other users join/leave voice channels
            const guildId = oldState.guild.id;
            const player = client.riffy.players.get(guildId);

            if (player && player.voiceChannel) {
                // Check if the voice state change affects the channel where bot is playing
                if (oldState.channelId === player.voiceChannel || newState.channelId === player.voiceChannel) {
                    // Someone joined or left the bot's voice channel, check alone status
                    await checkAloneStatus(client, guildId, player.voiceChannel);
                }
            }
        }
    } catch (error) {
        console.error('Error handling voice state update:', error);
    }
});

client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});
connectToDatabase().then(() => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
}).catch((err) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
});

const express = require("express");
const app = express();
const port = 3000;
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});

app.listen(port, () => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
    console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    console.log(`${colors.cyan}[ USER ]${colors.reset} ${colors.yellow}Arnab${colors.reset}`);
});

/**
 * Starts periodic cleanup of voice channel statuses for channels where bot is not present
 * @param {Client} client - Discord client
 */
function startVoiceStatusCleanup(client) {
    // Run cleanup every 5 minutes
    setInterval(async () => {
        try {
            const { updateVoiceChannelStatus } = require('./player.js');

            // Check all guilds
            for (const guild of client.guilds.cache.values()) {
                const player = client.riffy.players.get(guild.id);

                // If no active player, clear any voice channel statuses in this guild
                if (!player) {
                    for (const channel of guild.channels.cache.values()) {
                        if (channel.type === 2) { // Voice channel
                            // Check if bot is in this voice channel
                            const botMember = guild.members.cache.get(client.user.id);
                            if (botMember && botMember.voice.channelId !== channel.id) {
                                // Bot is not in this channel, clear any status
                                await updateVoiceChannelStatus(client, channel.id, "").catch(() => {});
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in voice status cleanup:', error);
        }
    }, 300000); // 5 minutes

    console.log(`${colors.cyan}[ CLEANUP ]${colors.reset} ${colors.green}Voice status cleanup started ✅${colors.reset}`);
}
