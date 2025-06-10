const { Riffy, Player } = require("riffy");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionsBitField } = require("discord.js");
const { requesters } = require("./commands/play");
const { Dynamic } = require("musicard");
const config = require("./config.js");
const musicIcons = require('./UI/icons/musicicons.js');
const colors = require('./UI/colors/colors');
const fs = require("fs");
const path = require("path");
const axios = require('axios');
const { autoplayCollection } = require('./mongodb.js');
const guildTrackMessages = new Map();

async function sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2) {
    try {
        const permissions = channel.permissionsFor(channel.guild.members.me);
        if (!permissions.has(PermissionsBitField.Flags.SendMessages) ||
            !permissions.has(PermissionsBitField.Flags.EmbedLinks) ||
            !permissions.has(PermissionsBitField.Flags.AttachFiles) ||
            !permissions.has(PermissionsBitField.Flags.UseExternalEmojis)) {
            console.error("Bot lacks necessary permissions to send messages in this channel.");
            return;
        }

        const message = await channel.send({
            embeds: [embed],
            files: [attachment],
            components: [actionRow1, actionRow2]
        });
        return message;
    } catch (error) {
        console.error("Error sending message:", error.message);
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription("⚠️ **Unable to send message. Check bot permissions.**");
        await channel.send({ embeds: [errorEmbed] });
    }
}

function initializePlayer(client) {
    const nodes = config.nodes.map(node => ({
        name: node.name,
        host: node.host,
        port: node.port,
        password: node.password,
        secure: node.secure,
        reconnectTimeout: 5000,
        reconnectTries: Infinity
    }));

    client.riffy = new Riffy(client, nodes, {
        send: (payload) => {
            const guildId = payload.d.guild_id;
            if (!guildId) return;

            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        defaultSearchPlatform: "ytmsearch",
        restVersion: "v4",
    });

    client.riffy.on("nodeConnect", node => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Node ${node.name} Connected ✅${colors.reset}`);
    });
    
    client.riffy.on("nodeError", (node, error) => {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node ${node.name} Error ❌ | ${error.message}${colors.reset}`);
    });

    client.riffy.on("trackStart", async (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        const guildId = player.guildId;
        const trackUri = track.info.uri;
        const requester = requesters.get(trackUri);

        // Clean up previous track messages for this guild
        await cleanupPreviousTrackMessages(channel, guildId);
        
        // Update voice channel status with current song
        try {
            const guild = client.guilds.cache.get(guildId);
            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (voiceChannel) {
                let songTitle = track.info.title;
                if (songTitle.length > 30) {
                    songTitle = songTitle.substring(0, 27) + '...';
                }
                await updateVoiceChannelStatus(client, voiceChannel.id, `<a:pinkanimatedheart:1303818204912816230> ${songTitle}`);
            }
        } catch (error) {
            console.error("Error updating voice channel status:", error.message);
        }

        try {
            const { Classic } = require('musicard');
            const musicard = await Classic({
                thumbnailImage: track.info.thumbnail || 'https://example.com/default_thumbnail.png',
                backgroundColor: '#070707',
                progress: 10,
                progressColor: '#FF7A00',
                progressBarColor: '#5F2D00',
                name: track.info.title,
                nameColor: '#FF7A00',
                author: track.info.author || 'Unknown Artist',
                authorColor: '#696969',
                startTime: '0:00',
                endTime: formatDuration(track.info.duration),
                timeColor: '#FF7A00'
            });

            // Save the generated card to a file
            const cardPath = path.join(__dirname, 'musicard.png');
            fs.writeFileSync(cardPath, musicard);

            // Prepare the attachment and embed
            const attachment = new AttachmentBuilder(cardPath, { name: 'musicard.png' });
            const embed = new EmbedBuilder()
            .setAuthor({ 
                name: 'Playing Song..', 
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setFooter({ text: `Developed by ARNAB | ARNAB Music`, iconURL: musicIcons.heartIcon })
            .setTimestamp()
            .setDescription(  
                `- **Title:** [${track.info.title}](${track.info.uri})\n` +
                `- **Author:** ${track.info.author || 'Unknown Artist'}\n` +
                `- **Length:** ${formatDuration(track.info.length)}\n` +
                `- **Requester:** ${requester}\n` +
                `- **Source:** ${track.info.sourceName}\n` + '**- Controls :**\n 🔁 `Loop`, ❌ `Disable`, ⏭️ `Skip`, 📜 `Queue`, 🗑️ `Clear`\n ⏹️ `Stop`, ⏸️ `Pause`, ▶️ `Resume`, 🔊 `Vol +`, 🔉 `Vol -`')
            .setImage('attachment://musicard.png')
            .setColor('#FF7A00');

            const actionRow1 = createActionRow1(false);
            const actionRow2 = createActionRow2(false);

            const message = await sendMessageWithPermissionsCheck(channel, embed, attachment, actionRow1, actionRow2);
            
            if (message) {
                // Store the track message for this guild
                if (!guildTrackMessages.has(guildId)) {
                    guildTrackMessages.set(guildId, []);
                }
                guildTrackMessages.get(guildId).push({
                    messageId: message.id,
                    channelId: channel.id,
                    type: 'track'
                });

                const collector = setupCollector(client, player, channel, message);
            }

        } catch (error) {
            console.error("Error creating or sending music card:", error.message);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription("⚠️ **Unable to load track card. Continuing playback...**");
            await channel.send({ embeds: [errorEmbed] });
        }
    });

    client.riffy.on("trackEnd", async (player) => {
        await cleanupTrackMessages(client, player);
        
        // Reset voice channel status if no more tracks in queue
         if (player.queue.length === 0) {
             try {
                 const guild = client.guilds.cache.get(player.guildId);
                 const voiceChannel = guild.channels.cache.get(player.voiceChannel);
                 if (voiceChannel) {
                     await updateVoiceChannelStatus(client, voiceChannel.id, "");
                 }
             } catch (error) {
                 console.error("Error resetting voice channel status:", error.message);
             }
         }
    });

    client.riffy.on("playerDisconnect", async (player) => {
        await cleanupTrackMessages(client, player);
        
        // Reset voice channel status when player disconnects
        try {
            const guild = client.guilds.cache.get(player.guildId);
            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (voiceChannel) {
                await updateVoiceChannelStatus(client, voiceChannel.id, "");
            }
        } catch (error) {
            console.error("Error resetting voice channel status:", error.message);
        }
    });

    client.riffy.on("queueEnd", async (player) => {
        const channel = client.channels.cache.get(player.textChannel);
        const guildId = player.guildId;
    
        try {
            // Reset voice channel status when queue ends
            try {
                const guild = client.guilds.cache.get(guildId);
                const voiceChannel = guild.channels.cache.get(player.voiceChannel);
                if (voiceChannel) {
                    await updateVoiceChannelStatus(client, voiceChannel.id, "");
                }
            } catch (error) {
                console.error("Error resetting voice channel status:", error.message);
            }
            
            const autoplaySetting = await autoplayCollection.findOne({ guildId });
    
            if (autoplaySetting?.autoplay) {
                const nextTrack = await player.autoplay(player);
    
                if (!nextTrack) {
                    await cleanupTrackMessages(client, player);
                    player.destroy();
                    await channel.send("⚠️ **No more tracks to autoplay. Disconnecting...**");
                }
            } else {
                await cleanupTrackMessages(client, player);
                console.log(`Autoplay is disabled for guild: ${guildId}`);
                player.destroy();
                await channel.send("🎶 **Queue has ended. Autoplay is disabled.**");
            }
        } catch (error) {
            console.error("Error handling autoplay:", error);
            await cleanupTrackMessages(client, player);
            player.destroy();
            await channel.send("👾**Queue Empty! Disconnecting...**");
        }
    });
}

async function cleanupPreviousTrackMessages(channel, guildId) {
    const messages = guildTrackMessages.get(guildId) || [];
    
    for (const messageInfo of messages) {
        try {
            const fetchChannel = channel.client.channels.cache.get(messageInfo.channelId);
            if (fetchChannel) {
                const message = await fetchChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                if (message) {
                    await message.delete().catch(() => {});
                }
            }
        } catch (error) {
            console.error("Error cleaning up previous track message:", error);
        }
    }

    // Clear the previous messages for this guild
    guildTrackMessages.set(guildId, []);
}

// New function to clean up track-related messages
async function cleanupTrackMessages(client, player) {
    const guildId = player.guildId;
    const messages = guildTrackMessages.get(guildId) || [];
    
    for (const messageInfo of messages) {
        try {
            const channel = client.channels.cache.get(messageInfo.channelId);
            if (channel) {
                const message = await channel.messages.fetch(messageInfo.messageId).catch(() => null);
                if (message) {
                    await message.delete().catch(() => {});
                }
            }
        } catch (error) {
            console.error("Error cleaning up track message:", error);
        }
    }

    // Clear the messages for this guild
    guildTrackMessages.set(guildId, []);
}
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    return [
        hours > 0 ? `${hours}h` : null,
        minutes > 0 ? `${minutes}m` : null,
        `${seconds}s`,
    ]
        .filter(Boolean)
        .join(' ');
}
function setupCollector(client, player, channel, message) {
    const filter = i => [
        'loopToggle', 'skipTrack', 'disableLoop', 'showLyrics', 'clearQueue',
        'stopTrack', 'pauseTrack', 'resumeTrack', 'volumeUp', 'volumeDown'
    ].includes(i.customId);

    const collector = message.createMessageComponentCollector({ filter, time: 600000 }); // Set timeout if desired

    collector.on('collect', async i => {
        await i.deferUpdate();

        const member = i.member;
        const voiceChannel = member.voice.channel;
        const playerChannel = player.voiceChannel;

        if (!voiceChannel || voiceChannel.id !== playerChannel) {
            const vcEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription('🔒 **You need to be in the same voice channel to use the controls!**');
            const sentMessage = await channel.send({ embeds: [vcEmbed] });
            setTimeout(() => sentMessage.delete().catch(console.error), config.embedTimeout * 1000);
            return;
        }

        handleInteraction(i, player, channel, client);
    });

    collector.on('end', () => {
        console.log("Collector stopped.");
    });

    return collector;
}

async function handleInteraction(i, player, channel, client) {
    switch (i.customId) {
        case 'loopToggle':
            toggleLoop(player, channel);
            break;
        case 'skipTrack':
            player.stop();
            await sendEmbed(channel, "⏭️ **Player will play the next song!**");
            break;
        case 'disableLoop':
            disableLoop(player, channel);
            break;
        case 'showLyrics':
            showLyrics(channel, player);
            break;
        case 'clearQueue':
            player.queue.clear();
            await sendEmbed(channel, "🗑️ **Queue has been cleared!**");
            break;
        case 'stopTrack':
            // Reset voice channel status when player is stopped
            try {
                const guild = channel.guild;
                const voiceChannel = guild.channels.cache.get(player.voiceChannel);
                if (voiceChannel) {
                    await updateVoiceChannelStatus(client, voiceChannel.id, "");
                }
                player.destroy();
                await sendEmbed(channel, "⏹️ **Player has been stopped!**");
            } catch (error) {
                console.error("Error resetting voice channel status:", error.message);
            }
            
            player.stop();
            player.destroy();
            await sendEmbed(channel, '⏹️ **Playback has been stopped and player destroyed!**');
            break;
        case 'pauseTrack':
            if (player.paused) {
                await sendEmbed(channel, '⏸️ **Playback is already paused!**');
            } else {
                player.pause(true);
                await sendEmbed(channel, '⏸️ **Playback has been paused!**');
            }
            break;
        case 'resumeTrack':
            if (!player.paused) {
                await sendEmbed(channel, '▶️ **Playback is already resumed!**');
            } else {
                player.pause(false);
                await sendEmbed(channel, '▶️ **Playback has been resumed!**');
            }
            break;
        case 'volumeUp':
            adjustVolume(player, channel, 10);
            break;
        case 'volumeDown':
            adjustVolume(player, channel, -10);
            break;
    }
}

async function sendEmbed(channel, message) {
    const embed = new EmbedBuilder().setColor(config.embedColor).setDescription(message);
    const sentMessage = await channel.send({ embeds: [embed] });
    setTimeout(() => sentMessage.delete().catch(console.error), config.embedTimeout * 1000);
}

function adjustVolume(player, channel, amount) {
    const newVolume = Math.min(100, Math.max(10, player.volume + amount));
    if (newVolume === player.volume) {
        sendEmbed(channel, amount > 0 ? '🔊 **Volume is already at maximum!**' : '🔉 **Volume is already at minimum!**');
    } else {
        player.setVolume(newVolume);
        sendEmbed(channel, `🔊 **Volume changed to ${newVolume}%!**`);
    }
}


function toggleLoop(player, channel) {
    player.setLoop(player.loop === "track" ? "queue" : "track");
    sendEmbed(channel, player.loop === "track" ? "🔁 **Track loop is activated!**" : "🔁 **Queue loop is activated!**");
}

function disableLoop(player, channel) {
    player.setLoop("none");
    sendEmbed(channel, "❌ **Loop is disabled!**");
}



async function getLyrics(trackName, artistName, duration) {
    try {
        //console.log(`🔍 Fetching lyrics for: ${trackName} - ${artistName} (${duration}s)`);

      
        trackName = trackName
            .replace(/\b(Official|Audio|Video|Lyrics|Theme|Soundtrack|Music|Full Version|HD|4K|Visualizer|Radio Edit|Live|Remix|Mix|Extended|Cover|Parody|Performance|Version|Unplugged|Reupload)\b/gi, "") 
            .replace(/\s*[-_/|]\s*/g, " ") 
            .replace(/\s+/g, " ") 
            .trim();

      
        artistName = artistName
            .replace(/\b(Topic|VEVO|Records|Label|Productions|Entertainment|Ltd|Inc|Band|DJ|Composer|Performer)\b/gi, "")
            .replace(/ x /gi, " & ") 
            .replace(/\s+/g, " ") 
            .trim();

        //console.log(`✅ Cleaned Data: ${trackName} - ${artistName} (${duration}s)`);

        
        let response = await axios.get(`https://lrclib.net/api/get`, {
            params: { track_name: trackName, artist_name: artistName, duration }
        });

        if (response.data.syncedLyrics || response.data.plainLyrics) {
            return response.data.syncedLyrics || response.data.plainLyrics;
        }

       
        response = await axios.get(`https://lrclib.net/api/get`, {
            params: { track_name: trackName, artist_name: artistName }
        });

        return response.data.syncedLyrics || response.data.plainLyrics;
    } catch (error) {
        console.error("❌ Lyrics fetch error:", error.response?.data?.message || error.message);
        return null;
    }
}



async function showLyrics(channel, player) {
    if (!player || !player.current || !player.current.info) {
        sendEmbed(channel, "🚫 **No song is currently playing.**");
        return;
    }

    const track = player.current.info;
    const lyrics = await getLyrics(track.title, track.author, Math.floor(track.length / 1000));

    if (!lyrics) {
        sendEmbed(channel, "❌ **Lyrics not found!**");
        return;
    }

    
    const lines = lyrics.split('\n').map(line => line.trim()).filter(Boolean);
    const songDuration = Math.floor(track.length / 1000); 

    const embed = new EmbedBuilder()
        .setTitle(`🎵 Live Lyrics: ${track.title}`)
        .setDescription("🔄 Syncing lyrics...")
        .setColor(config.embedColor);

    const stopButton = new ButtonBuilder()
        .setCustomId("stopLyrics")
        .setLabel("Stop Lyrics")
        .setStyle(ButtonStyle.Danger);

    const fullButton = new ButtonBuilder()
        .setCustomId("fullLyrics")
        .setLabel("Full Lyrics")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(fullButton, stopButton);
    
    const message = await channel.send({ embeds: [embed], components: [row] });

    // Store the lyrics message
    const guildId = player.guildId;
    if (!guildTrackMessages.has(guildId)) {
        guildTrackMessages.set(guildId, []);
    }
    guildTrackMessages.get(guildId).push({
        messageId: message.id,
        channelId: channel.id,
        type: 'lyrics'
    });

    const updateLyrics = async () => {
        const currentTime = Math.floor(player.position / 1000); 
        const totalLines = lines.length;

        const linesPerSecond = totalLines / songDuration; 
        const currentLineIndex = Math.floor(currentTime * linesPerSecond); 

        const start = Math.max(0, currentLineIndex - 3);
        const end = Math.min(totalLines, currentLineIndex + 3);
        const visibleLines = lines.slice(start, end).join('\n');

        embed.setDescription(visibleLines);
        await message.edit({ embeds: [embed] });
    };

    const interval = setInterval(updateLyrics, 3000);
    updateLyrics(); 

    const collector = message.createMessageComponentCollector({ time: 600000 });

    collector.on('collect', async i => {
        await i.deferUpdate();
    
        if (i.customId === "stopLyrics") {
            clearInterval(interval);
            await message.delete();
        } else if (i.customId === "fullLyrics") {
            clearInterval(interval);
            embed.setDescription(lines.join('\n'));
    
            const deleteButton = new ButtonBuilder()
                .setCustomId("deleteLyrics")
                .setLabel("Delete")
                .setStyle(ButtonStyle.Danger);
    
            const deleteRow = new ActionRowBuilder().addComponents(deleteButton);
    
            await message.edit({ embeds: [embed], components: [deleteRow] });
        } else if (i.customId === "deleteLyrics") {
            await message.delete();
        }
    });

    collector.on('end', () => {
        clearInterval(interval);
        message.delete().catch(() => {});
    });
}



function createActionRow1(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("loopToggle").setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("disableLoop").setEmoji('❌').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("skipTrack").setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("showLyrics").setEmoji('🎤').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("clearQueue").setEmoji('🗑️').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
}

function createActionRow2(disabled) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("stopTrack").setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
            new ButtonBuilder().setCustomId("pauseTrack").setEmoji('⏸️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("resumeTrack").setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("volumeUp").setEmoji('🔊').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId("volumeDown").setEmoji('🔉').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
}

/**
 * Updates the voice channel status using Discord's API
 * @param {Client} client - The Discord client
 * @param {string} channelId - The voice channel ID
 * @param {string} status - The status text to set
 * @returns {Promise<void>}
 */
async function updateVoiceChannelStatus(client, channelId, status) {
    try {
        const token = client.token;
        const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/voice-status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error(`Failed to update voice channel status: ${response.status} ${errorData}`);
        }
    } catch (error) {
        console.error('Error updating voice channel status:', error);
    }
}

module.exports = { initializePlayer, formatDuration, updateVoiceChannelStatus };