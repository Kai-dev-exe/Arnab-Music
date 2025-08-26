const { EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { requesters } = require('../commands/play.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(require('node-fetch'));

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId, 
    clientSecret: config.spotifyClientSecret,
});

/**
 * Handles commandless song requests from central music channels
 * @param {Object} message - Discord message object
 * @param {Object} client - Discord client
 * @param {Object} centralSetup - Central setup configuration
 * @param {string} voiceChannelId - Voice channel ID where user is connected
 */
async function handleCommandlessSongRequest(message, client, centralSetup, voiceChannelId) {
    try {
        // Check if Lavalink nodes are available
        if (!client.riffy.nodes || client.riffy.nodes.size === 0) {
            await message.react('❌').catch(() => {});
            const errorMsg = await message.reply('❌ **Music system is currently unavailable. Please try again later.**');
            setTimeout(() => {
                safeDeleteMessage(message);
                safeDeleteMessage(errorMsg);
            }, 4000);
            return;
        }

        // Create or get existing player
        const player = client.riffy.createConnection({
            guildId: message.guild.id,
            voiceChannel: voiceChannelId,
            textChannel: message.channel.id,
            deaf: true
        });

        const query = message.content.trim();
        
        // Process the song request
        const result = await processCommandlessSongRequest(client, player, query, message.author);
        
        if (!result.success) {
            await message.react('❌').catch(() => {});
            const errorMsg = await message.reply(result.error);
            setTimeout(() => {
                safeDeleteMessage(message);
                safeDeleteMessage(errorMsg);
            }, 4000);
            return;
        }

        // Start playing if not already playing
        if (!player.playing && !player.paused) {
            player.play();
        }

        // Send success reaction and optional feedback
        await message.react('🎵').catch(() => {});
        
        // Send brief feedback for playlists
        if (result.type === 'playlist') {
            const feedbackMsg = await message.reply(`🎵 **Added ${result.tracksAdded} songs from playlist to queue!**`);
            setTimeout(() => {
                safeDeleteMessage(feedbackMsg);
            }, 3000);
        }

    } catch (error) {
        console.error('Error in commandless song request handler:', error);
        await message.react('❌').catch(() => {});
        const errorMsg = await message.reply('❌ **An error occurred while processing your request.**');
        setTimeout(() => {
            safeDeleteMessage(message);
            safeDeleteMessage(errorMsg);
        }, 4000);
    }
}

/**
 * Processes a song request and adds tracks to the player queue
 * @param {Object} client - Discord client
 * @param {Object} player - Riffy player instance
 * @param {string} query - Song query (name or URL)
 * @param {Object} requester - Discord user who requested the song
 * @returns {Object} - Result object with success status and details
 */
async function processCommandlessSongRequest(client, player, query, requester) {
    try {
        let tracksToQueue = [];
        let isPlaylist = false;
        let playlistName = '';

        // Handle Spotify URLs
        if (query.includes('spotify.com')) {
            const spotifyResult = await handleSpotifyUrl(query);
            if (!spotifyResult.success) {
                return spotifyResult;
            }
            tracksToQueue = spotifyResult.tracks;
            isPlaylist = spotifyResult.isPlaylist;
            playlistName = spotifyResult.playlistName;
        } else {
            // Handle regular search or YouTube/other URLs
            const resolve = await client.riffy.resolve({ 
                query: query, 
                requester: requester.username 
            });

            if (!resolve || typeof resolve !== 'object' || !Array.isArray(resolve.tracks)) {
                return {
                    success: false,
                    error: '❌ **Invalid response from music resolver.**'
                };
            }

            if (resolve.loadType === 'playlist') {
                isPlaylist = true;
                playlistName = resolve.playlistInfo?.name || 'Unknown Playlist';
                
                for (const track of resolve.tracks) {
                    track.info.requester = requester.username;
                    player.queue.add(track);
                    requesters.set(track.info.uri, requester.username);
                }

                return {
                    success: true,
                    type: 'playlist',
                    tracksAdded: resolve.tracks.length,
                    playlistName: playlistName
                };
            } else if (resolve.loadType === 'search' || resolve.loadType === 'track') {
                const track = resolve.tracks.shift();
                if (track) {
                    track.info.requester = requester.username;
                    player.queue.add(track);
                    requesters.set(track.info.uri, requester.username);
                    
                    return {
                        success: true,
                        type: 'track',
                        tracksAdded: 1,
                        trackName: track.info.title
                    };
                }
            }
        }

        // Handle Spotify tracks that need to be searched
        if (tracksToQueue.length > 0) {
            let queuedTracks = 0;

            for (const trackQuery of tracksToQueue) {
                const resolve = await client.riffy.resolve({ 
                    query: trackQuery, 
                    requester: requester.username 
                });
                
                if (resolve.tracks && resolve.tracks.length > 0) {
                    const trackInfo = resolve.tracks[0];
                    trackInfo.info.requester = requester.username;
                    player.queue.add(trackInfo);
                    requesters.set(trackInfo.info.uri, requester.username);
                    queuedTracks++;
                }
            }

            if (queuedTracks > 0) {
                return {
                    success: true,
                    type: isPlaylist ? 'playlist' : 'track',
                    tracksAdded: queuedTracks,
                    playlistName: playlistName
                };
            }
        }

        return {
            success: false,
            error: '❌ **No results found for your search.**'
        };

    } catch (error) {
        console.error('Error processing commandless song request:', error);
        return {
            success: false,
            error: '❌ **An error occurred while processing your request.**'
        };
    }
}

/**
 * Handles Spotify URL processing
 * @param {string} url - Spotify URL
 * @returns {Object} - Result object with tracks and metadata
 */
async function handleSpotifyUrl(url) {
    try {
        const spotifyData = await getData(url);

        if (spotifyData.type === 'track') {
            const trackName = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
            return {
                success: true,
                tracks: [trackName],
                isPlaylist: false,
                playlistName: ''
            };
        } else if (spotifyData.type === 'playlist') {
            const playlistId = url.split('/playlist/')[1].split('?')[0];
            const tracks = await getSpotifyPlaylistTracks(playlistId);
            
            return {
                success: true,
                tracks: tracks,
                isPlaylist: true,
                playlistName: spotifyData.name || 'Spotify Playlist'
            };
        } else {
            return {
                success: false,
                error: '❌ **Unsupported Spotify URL type.**'
            };
        }
    } catch (error) {
        console.error('Error handling Spotify URL:', error);
        return {
            success: false,
            error: '❌ **Failed to process Spotify URL.**'
        };
    }
}

/**
 * Fetches tracks from a Spotify playlist
 * @param {string} playlistId - Spotify playlist ID
 * @returns {Array} - Array of track names
 */
async function getSpotifyPlaylistTracks(playlistId) {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body.access_token);

        let tracks = [];
        let offset = 0;
        let limit = 100;
        let total = 0;

        do {
            const response = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
            total = response.body.total;
            offset += limit;

            for (const item of response.body.items) {
                if (item.track && item.track.name && item.track.artists) {
                    const trackName = `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`;
                    tracks.push(trackName);
                }
            }
        } while (tracks.length < total && tracks.length < 500); // Limit to 500 tracks

        return tracks;
    } catch (error) {
        console.error("Error fetching Spotify playlist tracks:", error);
        return [];
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

module.exports = {
    handleCommandlessSongRequest,
    processCommandlessSongRequest,
    handleSpotifyUrl,
    getSpotifyPlaylistTracks
};
