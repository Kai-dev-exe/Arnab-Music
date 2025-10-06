const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(require('node-fetch'));
const { hasAvailableNodes, getNodesStatus } = require('../utils/nodeHelper.js');
const requesters = new Map();


const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId, 
    clientSecret: config.spotifyClientSecret,
});


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
        } while (tracks.length < total);

        return tracks;
    } catch (error) {
        console.error("Error fetching Spotify playlist tracks:", error);
        return [];
    }
}

async function play(client, interaction, lang) {
    try {
        const query = interaction.options.getString('name');

        if (!interaction.member.voice.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: lang.play.embed.error,
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.play.embed.noVoiceChannel);

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Check if any nodes are available
        if (!hasAvailableNodes(client)) {
            const nodesStatus = getNodesStatus(client);
            
            let errorMessage = lang.play.embed.noLavalinkNodes;
            
            // Provide more helpful error message
            if (nodesStatus.total > 0) {
                errorMessage = `⚠️ **All Lavalink servers are currently offline!**\n\n` +
                              `Total Nodes: ${nodesStatus.total}\n` +
                              `Connected: ${nodesStatus.connected}\n` +
                              `Disconnected: ${nodesStatus.disconnected}\n\n` +
                              `The bot will automatically reconnect when servers are back online.\n` +
                              `Please try again in a few moments.`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: lang.play.embed.error,
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(errorMessage);

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const player = client.riffy.createConnection({
            guildId: interaction.guildId,
            voiceChannel: interaction.member.voice.channelId,
            textChannel: interaction.channelId,
            deaf: true
        });
        
        // Log which node was selected
        if (player && player.node) {
            console.log(`🎵 [ PLAY ] Created player using node: ${player.node.name}`);
        }

        await interaction.deferReply();

        let tracksToQueue = [];
        let isPlaylist = false;

        if (query.includes('spotify.com')) {
            try {
                const spotifyData = await getData(query);

                if (spotifyData.type === 'track') {
                    const trackName = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                    tracksToQueue.push(trackName);
                } else if (spotifyData.type === 'playlist') {
                    isPlaylist = true;
                    const playlistId = query.split('/playlist/')[1].split('?')[0]; 
                    tracksToQueue = await getSpotifyPlaylistTracks(playlistId);
                }
            } catch (err) {
                console.error('Error fetching Spotify data:', err);
                await interaction.followUp({ content: "❌ Failed to fetch Spotify data." });
                return;
            }
        } else {
            
            const resolve = await client.riffy.resolve({ query, requester: interaction.user.username });

            if (!resolve || typeof resolve !== 'object' || !Array.isArray(resolve.tracks)) {
                throw new TypeError('Invalid response from Riffy');
            }

            if (resolve.loadType === 'playlist') {
                isPlaylist = true;
                for (const track of resolve.tracks) {
                    track.info.requester = interaction.user.username;
                    player.queue.add(track);
                    requesters.set(track.info.uri, interaction.user.username);
                }
            } else if (resolve.loadType === 'search' || resolve.loadType === 'track') {
                const track = resolve.tracks.shift();
                track.info.requester = interaction.user.username;
                player.queue.add(track);
                requesters.set(track.info.uri, interaction.user.username);
            } else {
                const errorEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({ 
                    name: lang.play.embed.error,
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
                .setDescription(lang.play.embed.noResults);

            await interaction.followUp({ embeds: [errorEmbed] });
                return;
            }
        }

        let queuedTracks = 0;

       
        for (const trackQuery of tracksToQueue) {
            const resolve = await client.riffy.resolve({ query: trackQuery, requester: interaction.user.username });
            if (resolve.tracks.length > 0) {
                const trackInfo = resolve.tracks[0];
                player.queue.add(trackInfo);
                requesters.set(trackInfo.uri, interaction.user.username);
                queuedTracks++;
            }
        }

        if (!player.playing && !player.paused) player.play();

        const randomEmbed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({
            name: lang.play.embed.requestUpdated,
            iconURL: musicIcons.beats2Icon,
            url: config.SupportServer
        })
        .setDescription(lang.play.embed.successProcessed)
        .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });
    
        const message = await interaction.followUp({ embeds: [randomEmbed] });

        setTimeout(() => {
            message.delete().catch(() => {}); 
        }, 3000);
        
    

    } catch (error) {
        console.error('Error processing play command:', error);
        await interaction.followUp({ content: "❌ An error occurred while processing the request." });
    }
}

module.exports = {
    name: "play",
    description: "Play a song from a name or link",
    permissions: "0x0000000000000800",
    options: [{
        name: 'name',
        description: 'Enter song name / link or playlist',
        type: ApplicationCommandOptionType.String,
        required: true
    }],
    run: play,
    requesters: requesters,
};