const { EmbedBuilder } = require("discord.js");
const config = require("../config.js");
const os = require('os');

module.exports = {
    name: "health",
    description: "Check comprehensive bot health status including Lavalink connections and active players",
    permissions: "0x0000000000000800",
    options: [],
    run: async (client, interaction) => {
        try {
            // Get uptime
            const uptimeSeconds = Math.floor(client.uptime / 1000);
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;
            const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

            // Get memory usage
            const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            const memTotal = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);

            // Get Lavalink status
            const statusReport = client.lavalinkManager.getStatusReport();
            
            // Get active players info
            const activePlayers = Array.from(client.riffy.players.values());
            const playingNow = activePlayers.filter(p => p.playing).length;
            const pausedPlayers = activePlayers.filter(p => p.paused).length;
            
            // Build the main embed
            const embed = new EmbedBuilder()
                .setColor(statusReport.connectedNodes > 0 ? '#00FF00' : '#FF0000')
                .setTitle('🏥 Bot Health Status')
                .setTimestamp();

            // Overall Status
            const overallStatus = statusReport.connectedNodes > 0 ? '✅ **ONLINE**' : '❌ **OFFLINE**';
            const statusEmoji = statusReport.connectedNodes > 0 ? '🟢' : '🔴';
            
            embed.addFields({
                name: '📊 Overall Status',
                value: `${statusEmoji} ${overallStatus}\n` +
                       `**Uptime:** ${uptimeString}\n` +
                       `**Guilds:** ${client.guilds.cache.size}\n` +
                       `**Users:** ${client.users.cache.size}`,
                inline: false
            });

            // Lavalink Nodes Status
            let lavalinkStatus = '';
            let currentlyUsedNodes = new Set();
            
            // Determine which nodes are actively being used
            for (const player of activePlayers) {
                if (player.node) {
                    currentlyUsedNodes.add(player.node.name);
                }
            }

            statusReport.nodes.forEach(node => {
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

                // Check if this node is currently being used
                const isInUse = currentlyUsedNodes.has(node.name);
                const inUseIndicator = isInUse ? ' 🎵 **[IN USE]**' : '';

                lavalinkStatus += `${statusEmoji} **${node.name}**${inUseIndicator}\n`;
                lavalinkStatus += `└─ Status: ${statusText}\n`;
                
                if (node.failedAttempts > 0) {
                    lavalinkStatus += `└─ Failed Attempts: ${node.failedAttempts}\n`;
                }
                
                if (node.autoReconnecting) {
                    lavalinkStatus += `└─ 🔄 Auto-reconnecting (3 min intervals)\n`;
                }
                
                lavalinkStatus += '\n';
            });

            embed.addFields({
                name: `🔧 Lavalink Nodes (${statusReport.connectedNodes}/${statusReport.totalNodes} Connected)`,
                value: lavalinkStatus || 'No nodes configured',
                inline: false
            });

            // Music Players Status
            const playersInfo = activePlayers.length > 0 
                ? `**Total Players:** ${activePlayers.length}\n` +
                  `**Playing:** ${playingNow} 🎵\n` +
                  `**Paused:** ${pausedPlayers} ⏸️\n` +
                  `**Idle:** ${activePlayers.length - playingNow - pausedPlayers}`
                : '**No active players**';

            embed.addFields({
                name: '🎵 Music Players',
                value: playersInfo,
                inline: true
            });

            // System Resources
            embed.addFields({
                name: '💻 System Resources',
                value: `**Memory:** ${memUsed}MB / ${memTotal}MB\n` +
                       `**CPU:** ${os.cpus()[0].model}\n` +
                       `**Platform:** ${os.platform()} ${os.arch()}`,
                inline: true
            });

            // Active Tracks Info (if any)
            if (playingNow > 0) {
                let tracksInfo = '';
                let trackCount = 0;
                
                for (const player of activePlayers) {
                    if (player.playing && player.current && trackCount < 3) {
                        const guild = client.guilds.cache.get(player.guildId);
                        const trackTitle = player.current.info.title.length > 40 
                            ? player.current.info.title.substring(0, 37) + '...'
                            : player.current.info.title;
                        
                        tracksInfo += `🎵 **${guild ? guild.name : 'Unknown'}**\n`;
                        tracksInfo += `└─ ${trackTitle}\n`;
                        tracksInfo += `└─ Node: ${player.node ? player.node.name : 'Unknown'}\n\n`;
                        trackCount++;
                    }
                }
                
                if (tracksInfo) {
                    embed.addFields({
                        name: `🎶 Currently Playing (Showing ${trackCount}/${playingNow})`,
                        value: tracksInfo,
                        inline: false
                    });
                }
            }

            // Connection Quality Indicator
            const connectionQuality = statusReport.connectedNodes === statusReport.totalNodes
                ? '🟢 Excellent - All nodes connected'
                : statusReport.connectedNodes > 0
                ? '🟡 Fair - Some nodes disconnected'
                : '🔴 Critical - No nodes available';

            embed.addFields({
                name: '📡 Connection Quality',
                value: connectionQuality,
                inline: false
            });

            // Warnings if any
            if (statusReport.disconnectedNodes > 0) {
                embed.addFields({
                    name: '⚠️ Warnings',
                    value: `${statusReport.disconnectedNodes} Lavalink node(s) disconnected. ` +
                           `Automatic reconnection is active. Check console logs for details.`,
                    inline: false
                });
            }

            // Footer
            embed.setFooter({ 
                text: `Bot Version: ${require('../package.json').version} | Ping: ${client.ws.ping}ms` 
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in health command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('❌ Failed to retrieve health status.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },
};
