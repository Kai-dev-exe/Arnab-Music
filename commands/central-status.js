const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { getCentralSetup } = require('../utils/centralUtils.js');

async function centralStatus(client, interaction, lang) {
    try {
        await interaction.deferReply();

        // Get central setup configuration
        const centralSetup = await getCentralSetup(interaction.guildId);
        
        if (!centralSetup) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setAuthor({
                    name: 'Central Music System Status',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription(
                    `❌ **Central music system is not configured for this server.**\n\n` +
                    `Use \`/setup-central\` to enable commandless music functionality.`
                )
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setTimestamp();

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Get channel information
        const textChannel = interaction.guild.channels.cache.get(centralSetup.textChannelId);
        const voiceChannel = centralSetup.voiceChannelId ? 
            interaction.guild.channels.cache.get(centralSetup.voiceChannelId) : null;
        
        // Get creator information
        const creator = await client.users.fetch(centralSetup.createdBy).catch(() => null);

        // Create status embed
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({
                name: 'Central Music System Status',
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setDescription(
                `✅ **Central music system is active!**\n\n` +
                `📝 **Text Channel:** ${textChannel || '❌ Channel not found'}\n` +
                `🔊 **Voice Channel:** ${voiceChannel || 'Any voice channel'}\n` +
                `👤 **Setup by:** ${creator ? `${creator.tag}` : 'Unknown user'}\n` +
                `📅 **Created:** <t:${Math.floor(centralSetup.createdAt.getTime() / 1000)}:R>\n` +
                `🔄 **Last updated:** <t:${Math.floor(centralSetup.updatedAt.getTime() / 1000)}:R>\n\n` +
                `🎵 **How it works:**\n` +
                `• Users can type song names directly in ${textChannel || 'the configured channel'}\n` +
                `• No need for commands or prefixes\n` +
                `• The bot automatically searches and plays songs\n` +
                `• Traditional slash commands still work everywhere\n\n` +
                `⚠️ **Requirements:**\n` +
                `• Users must be in ${voiceChannel ? `**${voiceChannel.name}**` : 'a voice channel'} to request songs\n` +
                `• Messages in the central channel are automatically deleted after processing`
            )
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        // Add warning if channels are missing
        if (!textChannel) {
            embed.addFields({
                name: '⚠️ Warning',
                value: 'The configured text channel no longer exists. Please run `/setup-central` again.',
                inline: false
            });
        }

        if (centralSetup.voiceChannelId && !voiceChannel) {
            embed.addFields({
                name: '⚠️ Warning',
                value: 'The configured voice channel no longer exists. Users can now use any voice channel.',
                inline: false
            });
        }

        await interaction.followUp({ embeds: [embed] });

    } catch (error) {
        console.error('Error in central-status command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while checking the central music system status.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "central-status",
    description: "Check the status of the commandless music system",
    permissions: "0x0000000000000800", // Send Messages permission
    options: [],
    run: centralStatus,
};
