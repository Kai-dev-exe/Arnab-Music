const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');

async function testAloneTimeout(client, interaction, lang) {
    try {
        // Check if user has administrator permission (for testing only)
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Permission Denied',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **You need `Administrator` permission to use this testing command!**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

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

        // Import the handleAloneTimeout function (we need to make it accessible)
        const { updateVoiceChannelStatus } = require('../player.js');
        
        // Manually trigger the alone timeout logic
        console.log(`🧪 TEST: Manually triggering alone timeout for guild ${interaction.guildId}`);
        
        const channel = client.channels.cache.get(player.textChannel);
        const voiceChannelId = player.voiceChannel;
        
        // Clear voice channel status
        await updateVoiceChannelStatus(client, voiceChannelId, "");
        
        // Destroy player
        player.destroy();
        
        // Send notification message
        if (channel) {
            await channel.send("🧪 **TEST: Auto-disconnect triggered manually** - This was a test of the alone timeout feature.");
        }
        
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({
                name: 'Test Alone Timeout Triggered',
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setDescription(
                `✅ **Manually triggered alone timeout for testing**\n\n` +
                `🔊 **Voice Channel:** <#${voiceChannelId}>\n` +
                `📝 **Text Channel:** ${channel}\n` +
                `🎵 **Player Status:** Destroyed\n` +
                `📊 **Voice Status:** Cleared\n\n` +
                `This was a test to verify the alone timeout functionality works correctly.`
            )
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        await interaction.followUp({ embeds: [embed] });

    } catch (error) {
        console.error('Error in test-alone-timeout command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while testing the alone timeout.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "test-alone-timeout",
    description: "🧪 TEST: Manually trigger alone timeout (Admin only)",
    permissions: "0x0000000000000008", // Administrator permission
    options: [],
    run: testAloneTimeout,
};
