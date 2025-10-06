const colors = require('../UI/colors/colors');

/**
 * Get the best available connected Lavalink node
 * @param {Object} client - Discord client
 * @returns {Object|null} - Connected node or null
 */
function getAvailableNode(client) {
    try {
        const riffy = client.riffy;
        
        // Get least used connected nodes
        const availableNodes = riffy.leastUsedNodes;
        
        if (availableNodes && availableNodes.length > 0) {
            const node = availableNodes[0];
            console.log(`${colors.cyan}[ NODE HELPER ]${colors.reset} ${colors.green}Selected node: ${node.name} (${availableNodes.length} available)${colors.reset}`);
            return node;
        }
        
        console.log(`${colors.cyan}[ NODE HELPER ]${colors.reset} ${colors.red}No available nodes found${colors.reset}`);
        return null;
    } catch (error) {
        console.error(`${colors.cyan}[ NODE HELPER ]${colors.reset} ${colors.red}Error getting available node: ${error.message}${colors.reset}`);
        return null;
    }
}

/**
 * Check if any Lavalink nodes are available
 * @param {Object} client - Discord client
 * @returns {boolean} - True if at least one node is connected
 */
function hasAvailableNodes(client) {
    try {
        const riffy = client.riffy;
        const availableNodes = riffy.leastUsedNodes;
        return availableNodes && availableNodes.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Get status of all nodes
 * @param {Object} client - Discord client
 * @returns {Object} - Node status information
 */
function getNodesStatus(client) {
    try {
        const riffy = client.riffy;
        const allNodes = [];
        const connectedNodes = [];
        
        if (riffy.nodeMap) {
            for (const [name, node] of riffy.nodeMap) {
                allNodes.push({
                    name: node.name,
                    connected: node.connected,
                    host: node.host,
                    port: node.port
                });
                
                if (node.connected) {
                    connectedNodes.push(node);
                }
            }
        }
        
        return {
            total: allNodes.length,
            connected: connectedNodes.length,
            disconnected: allNodes.length - connectedNodes.length,
            nodes: allNodes,
            hasAvailable: connectedNodes.length > 0
        };
    } catch (error) {
        return {
            total: 0,
            connected: 0,
            disconnected: 0,
            nodes: [],
            hasAvailable: false
        };
    }
}

module.exports = {
    getAvailableNode,
    hasAvailableNodes,
    getNodesStatus
};
