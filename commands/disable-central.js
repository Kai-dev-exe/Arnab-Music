const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { disableCentralSetup, getCentralSetup } = require('../utils/centralUtils.js');

async function disableCentral(client, interaction, lang) {
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

        await interaction.deferReply();

        // Check if central setup exists
        const centralSetup = await getCentralSetup(interaction.guildId);
        
        if (!centralSetup) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'No Central Setup Found',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **No central music system is currently configured for this server.**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Disable the central setup
        const success = await disableCentralSetup(interaction.guildId);
        
        if (!success) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Database Error',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **Failed to disable central music system. Please try again later.**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Get the channel that was configured
        const textChannel = interaction.guild.channels.cache.get(centralSetup.textChannelId);
        const voiceChannel = centralSetup.voiceChannelId ? 
            interaction.guild.channels.cache.get(centralSetup.voiceChannelId) : null;

        // Create success embed
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({
                name: 'Central Music System Disabled',
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setDescription(
                `✅ **Central music system has been disabled successfully!**\n\n` +
                `📝 **Previously configured channel:** ${textChannel || 'Unknown channel'}\n` +
                `🔊 **Previously configured voice channel:** ${voiceChannel || 'Any voice channel'}\n\n` +
                `🎵 **What changed:**\n` +
                `• Commandless music functionality is now disabled\n` +
                `• Users can no longer type song names directly in the channel\n` +
                `• Traditional slash commands still work in all channels\n` +
                `• Use \`/setup-central\` to re-enable the system`
            )
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        await interaction.followUp({ embeds: [embed] });

        // Send a message to the previously designated channel if it still exists
        if (textChannel) {
            try {
                const channelEmbed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setAuthor({
                        name: '🚫 Central Music System Disabled',
                        iconURL: musicIcons.alertIcon,
                        url: config.SupportServer
                    })
                    .setDescription(
                        `The central music system has been disabled for this channel.\n\n` +
                        `You can no longer type song names directly here.\n` +
                        `Use slash commands like \`/play\` instead.`
                    )
                    .setFooter({ text: 'Developed by ARNAB | ARNAB Music', iconURL: musicIcons.heartIcon })
                    .setTimestamp();

                await textChannel.send({ embeds: [channelEmbed] });
            } catch (error) {
                console.error('Error sending message to previously central channel:', error);
            }
        }

    } catch (error) {
        console.error('Error in disable-central command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while disabling the central music system.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "disable-central",
    description: "Disable the commandless music system",
    permissions: "0x0000000000000010", // Manage Channels permission
    options: [],
    run: disableCentral,
};
