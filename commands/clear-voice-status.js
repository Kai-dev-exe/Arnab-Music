const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { updateVoiceChannelStatus } = require('../player.js');

async function clearVoiceStatus(client, interaction, lang) {
    try {
        // Check if user has manage channels permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Permission Denied',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **You need `Manage Channels` permission to use this command!**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const voiceChannel = interaction.options.getChannel('voice-channel');
        
        await interaction.deferReply();

        if (voiceChannel) {
            // Clear specific voice channel status
            await updateVoiceChannelStatus(client, voiceChannel.id, "");
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({
                    name: 'Voice Channel Status Cleared',
                    iconURL: musicIcons.playerIcon,
                    url: config.SupportServer
                })
                .setDescription(`✅ **Voice channel status cleared for ${voiceChannel}**`)
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
        } else {
            // Clear all voice channel statuses in the server
            let clearedCount = 0;
            
            for (const channel of interaction.guild.channels.cache.values()) {
                if (channel.type === ChannelType.GuildVoice) {
                    try {
                        await updateVoiceChannelStatus(client, channel.id, "");
                        clearedCount++;
                    } catch (error) {
                        console.error(`Error clearing status for channel ${channel.id}:`, error);
                    }
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({
                    name: 'Voice Channel Statuses Cleared',
                    iconURL: musicIcons.playerIcon,
                    url: config.SupportServer
                })
                .setDescription(`✅ **Cleared voice channel statuses for ${clearedCount} voice channels in this server**`)
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
        }

    } catch (error) {
        console.error('Error in clear-voice-status command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while clearing voice channel status.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "clear-voice-status",
    description: "Clear voice channel status (for stuck statuses)",
    permissions: "0x0000000000000010", // Manage Channels permission
    options: [
        {
            name: 'voice-channel',
            description: 'Specific voice channel to clear (optional - clears all if not specified)',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
            required: false
        }
    ],
    run: clearVoiceStatus,
};
