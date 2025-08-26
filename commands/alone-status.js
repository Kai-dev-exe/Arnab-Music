const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');

async function aloneStatus(client, interaction, lang) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const player = client.riffy.players.get(interaction.guildId);
        
        if (!player) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setAuthor({
                    name: 'No Active Player',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **No music is currently playing in this server.**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Access the alone timers from player.js (we need to make this accessible)
        const guild = interaction.guild;
        const voiceChannel = guild.channels.cache.get(player.voiceChannel);
        
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setAuthor({
                    name: 'Voice Channel Not Found',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **Bot is not connected to a voice channel.**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Count non-bot members in the voice channel
        const humanMembers = voiceChannel.members.filter(member => !member.user.bot);
        const isAlone = humanMembers.size === 0;

        // Get timer status
        const { getAloneTimerStatus } = require('../player.js');
        const timerStatus = getAloneTimerStatus(interaction.guildId);

        let description = '';
        let color = config.embedColor;
        let title = 'Voice Channel Status';

        if (isAlone) {
            color = '#ff9500';
            title = '⚠️ Bot is Alone';

            let timerInfo = '⏰ **Auto-disconnect timer:** Inactive';
            if (timerStatus && timerStatus.isActive) {
                const minutesRemaining = Math.floor(timerStatus.timeRemaining / 60000);
                const secondsRemaining = Math.floor((timerStatus.timeRemaining % 60000) / 1000);
                timerInfo = `⏰ **Auto-disconnect timer:** Active - ${minutesRemaining}m ${secondsRemaining}s remaining`;
            }

            description = `🔇 **Bot is currently alone in ${voiceChannel}**\n\n` +
                         `${timerInfo}\n` +
                         `📊 **Members in channel:** ${voiceChannel.members.size} (${humanMembers.size} humans, ${voiceChannel.members.size - humanMembers.size} bots)\n\n` +
                         `💡 **Note:** The bot will automatically stop playing and disconnect if no one joins within the remaining time.`;
        } else {
            color = '#00ff00';
            title = '✅ Voice Channel Active';
            description = `🎵 **Bot is playing music in ${voiceChannel}**\n\n` +
                         `👥 **Members in channel:** ${voiceChannel.members.size} (${humanMembers.size} humans, ${voiceChannel.members.size - humanMembers.size} bots)\n` +
                         `⏰ **Auto-disconnect timer:** Inactive\n\n` +
                         `**Human members:**\n${humanMembers.map(member => `• ${member.displayName}`).join('\n') || 'None'}`;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: title,
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setDescription(description)
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        await interaction.followUp({ embeds: [embed] });

    } catch (error) {
        console.error('Error in alone-status command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while checking the voice channel status.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "alone-status",
    description: "Check if bot is alone in voice channel and auto-disconnect timer status",
    permissions: "0x0000000000000800", // Send Messages permission
    options: [],
    run: aloneStatus,
};
