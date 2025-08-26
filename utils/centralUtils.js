const { EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { centralSetupCollection } = require('../mongodb.js');

/**
 * Validates if a message content is a valid song query
 * @param {string} content - The message content to validate
 * @returns {boolean} - True if valid song query, false otherwise
 */
async function isSongQuery(content) {
    const minLength = 2;
    const maxLength = 200;
    
    // Check length constraints
    if (content.length < minLength || content.length > maxLength) {
        return false;
    }

    // Patterns that should be rejected
    const restrictedPatterns = [
        /discord\.gg/i,           // Discord invite links
        /@everyone/i,             // Everyone mentions
        /@here/i,                 // Here mentions
        /^\s*$/,                  // Only whitespace
        /^[!@#$%^&*()_+=\[\]{}|;':",./<>?`~-]+$/, // Only special characters
        /^\d+$/,                  // Only numbers
        /^[a-zA-Z]$/,            // Single letter
        /fuck|shit|damn|bitch|ass|hell|crap/i, // Basic profanity filter
        /spam|test|hello|hi|hey|lol|lmao|xd/i, // Common non-song words
    ];

    // Check if content matches any restricted pattern
    if (restrictedPatterns.some(pattern => pattern.test(content))) {
        return false;
    }

    // Patterns that indicate valid song queries
    const validPatterns = [
        // Valid music URLs
        /https?:\/\/(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com|spotify\.com|soundcloud\.com)/i,
        // Text that looks like song names (contains letters and possibly numbers/spaces)
        /^[a-zA-Z0-9\s\-_'".,:;!?()&]+$/,
    ];

    // Must match at least one valid pattern
    const matchesValidPattern = validPatterns.some(pattern => pattern.test(content));
    
    // Additional checks for text-based queries
    if (matchesValidPattern && !content.startsWith('http')) {
        // Should contain at least one letter
        if (!/[a-zA-Z]/.test(content)) {
            return false;
        }
        
        // Should not be too short after trimming
        const trimmed = content.trim();
        if (trimmed.length < 2) {
            return false;
        }
        
        // Should not be common chat words
        const commonWords = ['ok', 'no', 'yes', 'why', 'how', 'what', 'when', 'where', 'who'];
        if (commonWords.includes(trimmed.toLowerCase())) {
            return false;
        }
    }

    return matchesValidPattern;
}

/**
 * Validates if a user can use the central music system
 * @param {Object} message - Discord message object
 * @param {Object} centralSetup - Central setup configuration
 * @returns {Object} - Validation result with valid flag and reason
 */
async function validateCentralAccess(message, centralSetup) {
    const member = message.member;
    const guild = message.guild;
    const configuredVoiceChannelId = centralSetup.voiceChannelId;
    const userVoiceChannelId = member.voice?.channelId;

    // Check if user is in a voice channel
    if (!userVoiceChannelId) {
        return { 
            valid: false, 
            reason: '❌ **You must be in a voice channel to request songs!**' 
        };
    }

    // If a specific voice channel is configured, check if user is in it
    if (configuredVoiceChannelId && userVoiceChannelId !== configuredVoiceChannelId) {
        const configuredChannel = guild.channels.cache.get(configuredVoiceChannelId);
        const channelName = configuredChannel?.name || 'configured voice channel';
        return { 
            valid: false, 
            reason: `❌ **You must be in the \`${channelName}\` voice channel to use the central music system!**` 
        };
    }

    // Check if user has permission to connect to the voice channel
    const voiceChannel = guild.channels.cache.get(userVoiceChannelId);
    if (voiceChannel && !voiceChannel.permissionsFor(member).has('Connect')) {
        return {
            valid: false,
            reason: '❌ **You don\'t have permission to use that voice channel!**'
        };
    }

    return { 
        valid: true, 
        voiceChannelId: userVoiceChannelId 
    };
}

/**
 * Gets the central setup configuration for a guild
 * @param {string} guildId - The guild ID
 * @returns {Object|null} - Central setup configuration or null
 */
async function getCentralSetup(guildId) {
    if (!centralSetupCollection) {
        return null;
    }

    try {
        return await centralSetupCollection.findOne({ 
            guildId: guildId,
            enabled: true 
        });
    } catch (error) {
        console.error('Error fetching central setup:', error);
        return null;
    }
}

/**
 * Updates the central setup configuration for a guild
 * @param {string} guildId - The guild ID
 * @param {Object} setupData - The setup data to update
 * @returns {boolean} - Success status
 */
async function updateCentralSetup(guildId, setupData) {
    if (!centralSetupCollection) {
        return false;
    }

    try {
        setupData.updatedAt = new Date();
        await centralSetupCollection.replaceOne(
            { guildId: guildId },
            { guildId: guildId, ...setupData },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error('Error updating central setup:', error);
        return false;
    }
}

/**
 * Disables the central setup for a guild
 * @param {string} guildId - The guild ID
 * @returns {boolean} - Success status
 */
async function disableCentralSetup(guildId) {
    if (!centralSetupCollection) {
        return false;
    }

    try {
        await centralSetupCollection.updateOne(
            { guildId: guildId },
            { $set: { enabled: false, updatedAt: new Date() } }
        );
        return true;
    } catch (error) {
        console.error('Error disabling central setup:', error);
        return false;
    }
}

/**
 * Safely deletes a Discord message
 * @param {Object} messageObject - Discord message object
 */
function safeDeleteMessage(messageObject) {
    if (messageObject && messageObject.delete && typeof messageObject.delete === 'function') {
        messageObject.delete().catch(() => {});
    }
}

/**
 * Creates a standardized error embed
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {EmbedBuilder} - Discord embed
 */
function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor('#ff0000')
        .setAuthor({
            name: title,
            iconURL: musicIcons.alertIcon,
            url: config.SupportServer
        })
        .setDescription(description)
        .setFooter({ text: 'Developed by ARNAB | ARNAB Music', iconURL: musicIcons.heartIcon });
}

/**
 * Creates a standardized success embed
 * @param {string} title - Success title
 * @param {string} description - Success description
 * @returns {EmbedBuilder} - Discord embed
 */
function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({
            name: title,
            iconURL: musicIcons.playerIcon,
            url: config.SupportServer
        })
        .setDescription(description)
        .setFooter({ text: 'Developed by ARNAB | ARNAB Music', iconURL: musicIcons.heartIcon });
}

module.exports = {
    isSongQuery,
    validateCentralAccess,
    getCentralSetup,
    updateCentralSetup,
    disableCentralSetup,
    safeDeleteMessage,
    createErrorEmbed,
    createSuccessEmbed
};
