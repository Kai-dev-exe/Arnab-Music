const colors = require('./UI/colors/colors');
const axios = require('axios');

/**
 * Lavalink Connection Manager
 * Handles multiple Lavalink nodes with automatic failover and persistent reconnection
 */
class LavalinkManager {
    constructor(client) {
        this.client = client;
        this.reconnectInterval = 300000; // 5 minutes in milliseconds
        this.nodeReconnectTimers = new Map();
        this.nodeStatus = new Map(); // Track node connection status
        this.failedConnectionAttempts = new Map();
        this.lastConnectionAttempt = new Map();
        this.webhookUrl = client.config.webhookUrl || '';
        this.nodePriority = new Map(); // Track node priority (lower = higher priority)
        this.initializeNodePriority();
    }

    /**
     * Initialize node priority based on config order
     * First node in config = highest priority (0), second = priority 1, etc.
     */
    initializeNodePriority() {
        this.client.config.nodes.forEach((node, index) => {
            this.nodePriority.set(node.name, index);
            console.log(`${colors.gray}  └─ Node "${node.name}" priority: ${index} ${index === 0 ? '(PRIMARY)' : '(BACKUP)'}${colors.reset}`);
        });
    }

    /**
     * Initialize the Lavalink manager and start monitoring nodes
     */
    initialize() {
        console.log(`${colors.cyan}[ LAVALINK MANAGER ]${colors.reset} ${colors.green}Initialized with ${this.client.config.nodes.length} node(s) ✅${colors.reset}`);
        
        // Set up event listeners for all nodes
        this.setupNodeEventListeners();
    }

    /**
     * Set up event listeners for Riffy node events
     */
    setupNodeEventListeners() {
        const riffy = this.client.riffy;

        // Node connected successfully
        riffy.on("nodeConnect", (node) => {
            this.handleNodeConnect(node);
        });

        // Node disconnected
        riffy.on("nodeDisconnect", (node) => {
            this.handleNodeDisconnect(node);
        });

        // Node encountered an error
        riffy.on("nodeError", (node, error) => {
            this.handleNodeError(node, error);
        });

        // Node reconnecting
        riffy.on("nodeReconnect", (node) => {
            this.handleNodeReconnect(node);
        });
    }

    /**
     * Handle node connection event
     */
    handleNodeConnect(node) {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Node "${node.name}" Connected ✅${colors.reset}`);
        console.log(`${colors.gray}  └─ Host: ${node.host}:${node.port}${colors.reset}`);
        
        // Check if this was a reconnection (node was previously disconnected)
        const wasDisconnected = this.nodeStatus.get(node.name) === 'disconnected' || 
                                this.nodeStatus.get(node.name) === 'error';
        
        // Mark node as connected
        this.nodeStatus.set(node.name, 'connected');
        this.failedConnectionAttempts.set(node.name, 0);
        
        // Clear any existing reconnection timer for this node
        if (this.nodeReconnectTimers.has(node.name)) {
            clearInterval(this.nodeReconnectTimers.get(node.name));
            this.nodeReconnectTimers.delete(node.name);
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Stopped reconnection timer for "${node.name}"${colors.reset}`);
        }
        
        // Check if this node has higher priority than currently used nodes
        if (wasDisconnected) {
            this.checkNodePriorityAndMigrate(node);
            
            // Send webhook notification for reconnection
            this.sendWebhookNotification(
                '✅ Lavalink Node Reconnected',
                `Node **${node.name}** has successfully reconnected!\n\n` +
                `**Host:** ${node.host}:${node.port}\n` +
                `**Status:** Online\n` +
                `**Priority:** ${this.nodePriority.get(node.name) === 0 ? 'PRIMARY' : 'BACKUP'}`,
                0x00FF00 // Green
            );
        }
    }

    /**
     * Handle node disconnection event
     */
    handleNodeDisconnect(node) {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node "${node.name}" Disconnected ❌${colors.reset}`);
        
        // Mark node as disconnected
        this.nodeStatus.set(node.name, 'disconnected');
        
        // IMMEDIATELY check for backup nodes and failover
        const connectedNodes = this.getConnectedNodes();
        const hasBackup = connectedNodes.length > 0;
        
        if (hasBackup) {
            const bestBackup = this.getBestAvailableNode();
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Backup node available: "${bestBackup.name}" - Switching immediately!${colors.reset}`);
            
            // Immediately move all players to backup
            this.movePlayersToBackupNode(node, bestBackup);
        } else {
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}No backup nodes available!${colors.reset}`);
        }
        
        // Send webhook notification
        this.sendWebhookNotification(
            '❌ Lavalink Node Disconnected',
            `Node **${node.name}** has disconnected!\n\n` +
            `**Host:** ${node.host}:${node.port}\n` +
            `**Backup Available:** ${hasBackup ? 'Yes ✅' : 'No ❌'}\n` +
            `**Auto-Reconnect:** Every 5 minutes\n\n` +
            (hasBackup ? `➡️ Switched to backup node: **${connectedNodes[0].name}**` : '⚠️ No backup nodes available!'),
            hasBackup ? 0xFFA500 : 0xFF0000 // Orange if backup available, Red if not
        );
        
        // Start persistent reconnection attempts in the background
        this.startPersistentReconnection(node);
    }

    /**
     * Handle node error event
     */
    handleNodeError(node, error) {
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node "${node.name}" Error ❌${colors.reset}`);
        console.log(`${colors.gray}  └─ Error: ${error.message}${colors.reset}`);
        
        // Mark node as errored
        this.nodeStatus.set(node.name, 'error');
        
        // Increment failed connection attempts
        const attempts = (this.failedConnectionAttempts.get(node.name) || 0) + 1;
        this.failedConnectionAttempts.set(node.name, attempts);
        
        // Send webhook notification for critical errors (every 5 failed attempts)
        if (attempts % 5 === 0) {
            this.sendWebhookNotification(
                '⚠️ Lavalink Node Error',
                `Node **${node.name}** encountered an error!\n\n` +
                `**Error:** ${error.message}\n` +
                `**Failed Attempts:** ${attempts}\n` +
                `**Status:** Will retry in 5 minutes`,
                0xFFA500 // Orange
            );
        }
        
        // Start persistent reconnection if not already started
        if (!this.nodeReconnectTimers.has(node.name)) {
            this.startPersistentReconnection(node);
        }
    }

    /**
     * Handle node reconnection event
     */
    handleNodeReconnect(node) {
        const attempts = this.failedConnectionAttempts.get(node.name) || 0;
        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Node "${node.name}" Reconnecting... (Attempt: ${attempts + 1})${colors.reset}`);
        this.nodeStatus.set(node.name, 'reconnecting');
    }

    /**
     * Start persistent reconnection attempts for a node (every 3 minutes)
     */
    startPersistentReconnection(node) {
        // Don't create duplicate timers
        if (this.nodeReconnectTimers.has(node.name)) {
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.gray}Reconnection timer already exists for "${node.name}"${colors.reset}`);
            return;
        }

        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Starting persistent reconnection for "${node.name}" (every 5 minutes)${colors.reset}`);

        // Create a reconnection timer that runs every 5 minutes
        const timer = setInterval(() => {
            const status = this.nodeStatus.get(node.name);
            
            // Only attempt reconnection if node is not connected
            if (status !== 'connected') {
                this.attemptNodeReconnection(node);
            } else {
                // Node is connected, stop the timer
                clearInterval(timer);
                this.nodeReconnectTimers.delete(node.name);
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Node "${node.name}" is connected. Stopping reconnection timer.${colors.reset}`);
            }
        }, this.reconnectInterval);

        this.nodeReconnectTimers.set(node.name, timer);
        
        // Attempt immediate reconnection
        this.attemptNodeReconnection(node);
    }

    /**
     * Attempt to reconnect to a specific node
     */
    async attemptNodeReconnection(node) {
        try {
            const attempts = this.failedConnectionAttempts.get(node.name) || 0;
            this.lastConnectionAttempt.set(node.name, Date.now());
            
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Attempting reconnection to "${node.name}"... (Total attempts: ${attempts + 1})${colors.reset}`);
            console.log(`${colors.gray}  └─ Next attempt in 5 minutes if this fails${colors.reset}`);
            
            // Check if the node's WebSocket exists and is not connected
            if (node.ws) {
                const wsState = node.ws.readyState;
                console.log(`${colors.gray}  └─ WebSocket state: ${wsState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)${colors.reset}`);
                
                // If WebSocket is closed or closing, try to reconnect
                if (wsState === 2 || wsState === 3) { // CLOSING or CLOSED
                    console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}WebSocket is closed, attempting to reconnect...${colors.reset}`);
                    
                    // Close the existing WebSocket if it's still lingering
                    try {
                        if (node.ws.close && typeof node.ws.close === 'function') {
                            node.ws.close();
                        }
                    } catch (e) {
                        // Ignore errors when closing
                    }
                    
                    // Call Riffy's connect method if available
                    if (node.connect && typeof node.connect === 'function') {
                        await node.connect();
                    } else {
                        console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node "${node.name}" has no connect method available${colors.reset}`);
                    }
                } else if (wsState === 0) { // CONNECTING
                    console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}WebSocket is already attempting to connect, waiting...${colors.reset}`);
                } else if (wsState === 1) { // OPEN
                    console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}WebSocket is already connected!${colors.reset}`);
                    // Mark as connected
                    this.nodeStatus.set(node.name, 'connected');
                    this.failedConnectionAttempts.set(node.name, 0);
                }
            } else {
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Node "${node.name}" has no WebSocket object${colors.reset}`);
                // Try to call connect if available
                if (node.connect && typeof node.connect === 'function') {
                    await node.connect();
                } else {
                    console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Cannot reconnect: no connect method available${colors.reset}`);
                }
            }
        } catch (error) {
            console.error(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Reconnection attempt failed for "${node.name}": ${error.message}${colors.reset}`);
            this.failedConnectionAttempts.set(node.name, (this.failedConnectionAttempts.get(node.name) || 0) + 1);
        }
    }

    /**
     * Check if a reconnected node has higher priority and migrate players back
     * @param {Object} reconnectedNode - The node that just reconnected
     */
    async checkNodePriorityAndMigrate(reconnectedNode) {
        const reconnectedPriority = this.nodePriority.get(reconnectedNode.name);
        const riffy = this.client.riffy;
        
        // If this is the primary node (priority 0), migrate all players back
        if (reconnectedPriority === 0) {
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}PRIMARY node "${reconnectedNode.name}" reconnected! Migrating all players back...${colors.reset}`);
            
            let migratedPlayers = 0;
            
            // Iterate through all active players
            for (const [guildId, player] of riffy.players.entries()) {
                // Check if player is using a backup node
                if (player.node && player.node.name !== reconnectedNode.name) {
                    const currentNodePriority = this.nodePriority.get(player.node.name) || 999;
                    
                    // Only migrate if current node has lower priority
                    if (currentNodePriority > reconnectedPriority) {
                        try {
                            console.log(`${colors.gray}  └─ Migrating player from "${player.node.name}" to "${reconnectedNode.name}" for guild ${guildId}${colors.reset}`);
                            
                            const currentTrack = player.current;
                            const currentPosition = player.position || 0;
                            const queue = player.queue ? [...player.queue] : [];
                            const isPaused = player.paused;
                            
                            // Change the player's node
                            player.node = reconnectedNode;
                            
                            // Resume playback if there was a track
                            if (currentTrack) {
                                await player.play(currentTrack, { startTime: currentPosition });
                                
                                // Restore paused state
                                if (isPaused) {
                                    player.pause(true);
                                }
                            }
                            
                            migratedPlayers++;
                        } catch (error) {
                            console.error(`${colors.red}  └─ Failed to migrate player for guild ${guildId}: ${error.message}${colors.reset}`);
                        }
                    }
                }
            }
            
            if (migratedPlayers > 0) {
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Successfully migrated ${migratedPlayers} player(s) back to PRIMARY node "${reconnectedNode.name}" ✅${colors.reset}`);
                
                this.sendWebhookNotification(
                    '⬅️ Players Migrated Back to Primary',
                    `**${migratedPlayers}** active player(s) migrated back to primary node **${reconnectedNode.name}**!\n\n` +
                    `**Node:** ${reconnectedNode.name}\n` +
                    `**Status:** All players now on primary node`,
                    0x00FF00 // Green
                );
            } else {
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.gray}No players to migrate (already on primary or no active players)${colors.reset}`);
            }
        } else {
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Backup node "${reconnectedNode.name}" reconnected (priority ${reconnectedPriority}). Players remain on current nodes.${colors.reset}`);
        }
    }

    /**
     * Get the best available node based on priority
     * @returns {Object|null} - Best available node or null
     */
    getBestAvailableNode() {
        const connectedNodes = this.getConnectedNodes();
        
        if (connectedNodes.length === 0) {
            return null;
        }
        
        // Sort nodes by priority (lower number = higher priority)
        connectedNodes.sort((a, b) => {
            const priorityA = this.nodePriority.get(a.name) || 999;
            const priorityB = this.nodePriority.get(b.name) || 999;
            return priorityA - priorityB;
        });
        
        return connectedNodes[0];
    }

    /**
     * Get all currently connected nodes (sorted by priority)
     */
    getConnectedNodes() {
        const riffy = this.client.riffy;
        const connectedNodes = [];
        
        // Check if riffy.nodeMap exists (Riffy uses nodeMap, not nodes)
        if (!riffy.nodeMap) {
            return connectedNodes;
        }
        
        // Iterate through all nodes in Riffy's nodeMap
        for (const [nodeName, node] of riffy.nodeMap) {
            // Check if node is connected and matches our tracked status
            const status = this.nodeStatus.get(nodeName);
            if (status === 'connected' && node && node.connected) {
                connectedNodes.push(node);
            }
        }
        
        // Sort by priority (lower = higher priority)
        connectedNodes.sort((a, b) => {
            const priorityA = this.nodePriority.get(a.name) || 999;
            const priorityB = this.nodePriority.get(b.name) || 999;
            return priorityA - priorityB;
        });
        
        return connectedNodes;
    }

    /**
     * Move active players from one node to another (failover)
     */
    async movePlayersToBackupNode(fromNode, toNode) {
        try {
            console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.yellow}Attempting to failover players from "${fromNode.name}" to "${toNode.name}"${colors.reset}`);
            
            const riffy = this.client.riffy;
            let movedPlayers = 0;
            
            // Iterate through all active players
            for (const [guildId, player] of riffy.players.entries()) {
                // Check if this player was using the disconnected node
                if (player.node && player.node.name === fromNode.name) {
                    try {
                        console.log(`${colors.gray}  └─ Moving player for guild ${guildId} to "${toNode.name}"${colors.reset}`);
                        
                        // Change the player's node
                        player.node = toNode;
                        
                        // If there was a current track, try to resume playback
                        if (player.current) {
                            const currentPosition = player.position || 0;
                            await player.play(player.current, { startTime: currentPosition });
                        }
                        
                        movedPlayers++;
                    } catch (error) {
                        console.error(`${colors.red}  └─ Failed to move player for guild ${guildId}: ${error.message}${colors.reset}`);
                    }
                }
            }
            
            if (movedPlayers > 0) {
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.green}Successfully moved ${movedPlayers} player(s) to backup node "${toNode.name}" ✅${colors.reset}`);
                
                // Send webhook notification about successful failover
                this.sendWebhookNotification(
                    '➡️ Lavalink Failover Complete',
                    `Successfully switched from **${fromNode.name}** to **${toNode.name}**!\n\n` +
                    `**Players Migrated:** ${movedPlayers}\n` +
                    `**New Node:** ${toNode.name}\n` +
                    `**Status:** Music playback continuing normally`,
                    0x00FF00 // Green
                );
            } else {
                console.log(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.gray}No active players to move${colors.reset}`);
            }
        } catch (error) {
            console.error(`${colors.cyan}[ LAVALINK ]${colors.reset} ${colors.red}Error during failover: ${error.message}${colors.reset}`);
        }
    }

    /**
     * Get status report of all nodes
     */
    getStatusReport() {
        const report = {
            totalNodes: this.client.config.nodes.length,
            connectedNodes: 0,
            disconnectedNodes: 0,
            nodes: []
        };

        for (const [nodeName, status] of this.nodeStatus.entries()) {
            const attempts = this.failedConnectionAttempts.get(nodeName) || 0;
            const hasTimer = this.nodeReconnectTimers.has(nodeName);
            const priority = this.nodePriority.get(nodeName);
            const isPrimary = priority === 0;
            
            report.nodes.push({
                name: nodeName,
                status: status,
                priority: priority,
                isPrimary: isPrimary,
                failedAttempts: attempts,
                autoReconnecting: hasTimer
            });

            if (status === 'connected') {
                report.connectedNodes++;
            } else {
                report.disconnectedNodes++;
            }
        }
        
        // Sort nodes by priority
        report.nodes.sort((a, b) => a.priority - b.priority);

        return report;
    }

    /**
     * Stop all reconnection timers (cleanup)
     */
    cleanup() {
        console.log(`${colors.cyan}[ LAVALINK MANAGER ]${colors.reset} ${colors.yellow}Cleaning up reconnection timers...${colors.reset}`);
        
        for (const [nodeName, timer] of this.nodeReconnectTimers.entries()) {
            clearInterval(timer);
            console.log(`${colors.gray}  └─ Stopped timer for "${nodeName}"${colors.reset}`);
        }
        
        this.nodeReconnectTimers.clear();
    }

    /**
     * Send a webhook notification to Discord
     * @param {string} title - Notification title
     * @param {string} description - Notification description
     * @param {number} color - Embed color (hex)
     */
    async sendWebhookNotification(title, description, color = 0x00FF00) {
        // Skip if webhook URL is not configured
        if (!this.webhookUrl || this.webhookUrl === '') {
            return;
        }

        try {
            const statusReport = this.getStatusReport();
            
            const embed = {
                title: title,
                description: `<@728922361340100658>\n\n${description}`,  // Mention user at top of description
                color: color,
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Connected: ${statusReport.connectedNodes}/${statusReport.totalNodes} | Bot Status`
                },
                fields: [
                    {
                        name: '🔌 Connection Status',
                        value: `**Connected Nodes:** ${statusReport.connectedNodes}\n` +
                               `**Disconnected Nodes:** ${statusReport.disconnectedNodes}\n` +
                               `**Total Nodes:** ${statusReport.totalNodes}`,
                        inline: true
                    }
                ]
            };

            await axios.post(this.webhookUrl, {
                username: 'Lavalink Monitor',
                avatar_url: 'https://cdn.discordapp.com/emojis/1303818204912816230.png',
                embeds: [embed]
            });

            console.log(`${colors.cyan}[ WEBHOOK ]${colors.reset} ${colors.green}Notification sent: ${title}${colors.reset}`);
        } catch (error) {
            console.error(`${colors.cyan}[ WEBHOOK ]${colors.reset} ${colors.red}Failed to send notification: ${error.message}${colors.reset}`);
        }
    }
}

module.exports = { LavalinkManager };
