const { EmbedBuilder } = require("discord.js");
const config = require("../config.js");

module.exports = {
    name: "lavalink-status",
    description: "Check the status of all Lavalink nodes",
    permissions: "0x0000000000000800",
    options: [],
    run: async (client, interaction) => {
        try {
            // Get the status report from the Lavalink manager
            const statusReport = client.lavalinkManager.getStatusReport();
            
            // Build the embed
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔧 Lavalink Nodes Status')
                .setTimestamp();

            // Add summary
            embed.addFields({
                name: '📊 Summary',
                value: `**Total Nodes:** ${statusReport.totalNodes}\n` +
                       `**Connected:** ${statusReport.connectedNodes} ✅\n` +
                       `**Disconnected:** ${statusReport.disconnectedNodes} ❌`,
                inline: false
            });

            // Add individual node status
            statusReport.nodes.forEach((node, index) => {
                let statusEmoji = '❌';
                let statusText = 'Disconnected';
                
                switch(node.status) {
                    case 'connected':
                        statusEmoji = '✅';
                        statusText = 'Connected';
                        break;
                    case 'reconnecting':
                        statusEmoji = '🔄';
                        statusText = 'Reconnecting';
                        break;
                    case 'error':
                        statusEmoji = '⚠️';
                        statusText = 'Error';
                        break;
                }
                
                // Determine priority label
                const priorityLabel = node.isPrimary ? '🎯 PRIMARY' : `🔄 BACKUP (Priority ${node.priority})`;

                const reconnectInfo = node.autoReconnecting 
                    ? `\n🔄 Auto-reconnecting every 5 minutes`
                    : '';
                
                const failedAttempts = node.failedAttempts > 0 
                    ? `\n❌ Failed attempts: ${node.failedAttempts}`
                    : '';

                embed.addFields({
                    name: `${statusEmoji} ${node.name}`,
                    value: `**Status:** ${statusText}\n**Type:** ${priorityLabel}${failedAttempts}${reconnectInfo}`,
                    inline: true
                });
            });

            // Add footer with additional info
            embed.setFooter({ 
                text: 'Persistent reconnection enabled - Will retry every 5 minutes | Auto-failover to backup nodes' 
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in lavalink-status command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('❌ Failed to retrieve Lavalink status.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
