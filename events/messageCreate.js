const { EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const {
    isSongQuery,
    validateCentralAccess,
    getCentralSetup,
    safeDeleteMessage
} = require('../utils/centralUtils.js');
const { handleCommandlessSongRequest } = require('../utils/commandlessPlayer.js');

// Cooldown system to prevent spam
const userCooldowns = new Map();
const COOLDOWN_TIME = 3000; // 3 seconds
const SPAM_THRESHOLD = 5; // Max 5 messages per cooldown period

module.exports = async (client, message) => {
    try {
        // Ignore bot messages and system messages
        if (message.author.bot || !message.guild) return;

        // Get central setup configuration
        const centralSetup = await getCentralSetup(message.guild.id);

        // If no central setup or not in the designated channel, ignore
        if (!centralSetup || message.channel.id !== centralSetup.textChannelId) {
            return;
        }

        // Handle central music channel message
        await handleCentralMessage(message, client, centralSetup);

    } catch (error) {
        console.error('Error in messageCreate event:', error);
    }
};

async function handleCentralMessage(message, client, centralSetup) {
    const userId = message.author.id;
    const now = Date.now();

    try {
        // Cooldown check
        const userMessages = userCooldowns.get(userId) || [];
        const recentMessages = userMessages.filter(timestamp => now - timestamp < COOLDOWN_TIME);

        if (recentMessages.length >= SPAM_THRESHOLD) {
            // Delete spam message
            await safeDeleteMessage(message);
            return;
        }

        recentMessages.push(now);
        userCooldowns.set(userId, recentMessages);

        const content = message.content.trim();

        // Validate if this is a song query
        if (await isSongQuery(content)) {
            // Validate voice channel access
            const voiceValidation = await validateCentralAccess(message, centralSetup);
            if (!voiceValidation.valid) {
                await message.react('❌').catch(() => {});
                const errorMsg = await message.reply(voiceValidation.reason);
                setTimeout(() => {
                    safeDeleteMessage(message);
                    safeDeleteMessage(errorMsg);
                }, 4000);
                return;
            }

            // Process the song request
            await handleCommandlessSongRequest(message, client, centralSetup, voiceValidation.voiceChannelId);

            // Delete the original message after a short delay
            setTimeout(() => safeDeleteMessage(message), 3000);
        } else {
            // Not a valid song query, delete the message
            await safeDeleteMessage(message);
        }

    } catch (error) {
        console.error('Error in central message handler:', error);
        await safeDeleteMessage(message);
    }
}






