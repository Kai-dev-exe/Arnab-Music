const { ApplicationCommandOptionType, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../config.js');
const musicIcons = require('../UI/icons/musicicons.js');
const { centralSetupCollection } = require('../mongodb.js');

async function setupCentral(client, interaction, lang) {
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

        const textChannel = interaction.options.getChannel('text-channel');
        const voiceChannel = interaction.options.getChannel('voice-channel');
        
        // Use current channel if no text channel specified
        const targetTextChannel = textChannel || interaction.channel;
        
        // Validate text channel type
        if (targetTextChannel.type !== ChannelType.GuildText) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Invalid Channel',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **The specified channel must be a text channel!**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Validate voice channel type if provided
        if (voiceChannel && voiceChannel.type !== ChannelType.GuildVoice) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Invalid Channel',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **The voice channel must be a voice channel!**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        await interaction.deferReply();

        // Check if database is available
        if (!centralSetupCollection) {
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({
                    name: 'Database Error',
                    iconURL: musicIcons.alertIcon,
                    url: config.SupportServer
                })
                .setDescription('❌ **Database is not available. Please contact the bot administrator.**')
                .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

            await interaction.followUp({ embeds: [embed] });
            return;
        }

        // Create or update central setup configuration
        const setupData = {
            guildId: interaction.guildId,
            textChannelId: targetTextChannel.id,
            voiceChannelId: voiceChannel?.id || null,
            enabled: true,
            createdBy: interaction.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await centralSetupCollection.replaceOne(
            { guildId: interaction.guildId },
            setupData,
            { upsert: true }
        );

        // Create success embed
        const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setAuthor({
                name: 'Central Music System Setup Complete',
                iconURL: musicIcons.playerIcon,
                url: config.SupportServer
            })
            .setDescription(
                `✅ **Central music system has been configured successfully!**\n\n` +
                `📝 **Text Channel:** ${targetTextChannel}\n` +
                `🔊 **Voice Channel:** ${voiceChannel ? voiceChannel : 'Any voice channel'}\n\n` +
                `🎵 **How it works:**\n` +
                `• Users can now type song names directly in ${targetTextChannel}\n` +
                `• No need for commands or prefixes\n` +
                `• The bot will automatically search and play songs\n` +
                `• Traditional slash commands still work in all channels\n\n` +
                `⚠️ **Note:** Users must be in ${voiceChannel ? `the **${voiceChannel.name}** voice channel` : 'a voice channel'} to request songs.`
            )
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon })
            .setTimestamp();

        await interaction.followUp({ embeds: [embed] });

        // Send a message to the designated channel
        try {
            const channelEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setAuthor({
                    name: '🎵 Central Music Channel',
                    iconURL: musicIcons.playerIcon,
                    url: config.SupportServer
                })
                .setDescription(
                    `🎶 **Welcome to the central music channel!**\n\n` +
                    `Simply type the name of any song you want to play and I'll handle the rest!\n\n` +
                    `**Examples:**\n` +
                    `• \`Bohemian Rhapsody\`\n` +
                    `• \`The Weeknd Blinding Lights\`\n` +
                    `• \`https://www.youtube.com/watch?v=...\`\n\n` +
                    `${voiceChannel ? `⚠️ **You must be in ${voiceChannel} to request songs.**` : '⚠️ **You must be in a voice channel to request songs.**'}`
                )
                .setImage('https://cdn.discordapp.com/attachments/1180451693872287817/1409769413867212992/download.gif?ex=68ae9594&is=68ad4414&hm=dabaa1dd8506690c204863c544286c8502a65ce050424ea3d8d4901b3161ed97&')
                .setFooter({ text: 'Developed by ARNAB | ARNAB Music', iconURL: musicIcons.heartIcon })
                .setTimestamp();

            await targetTextChannel.send({ embeds: [channelEmbed] });
        } catch (error) {
            console.error('Error sending message to central channel:', error);
        }

    } catch (error) {
        console.error('Error in setup-central command:', error);
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('❌ **An error occurred while setting up the central music system.**')
            .setFooter({ text: lang.footer, iconURL: musicIcons.heartIcon });

        if (interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = {
    name: "setup-central",
    description: "Setup commandless music system in a text channel",
    permissions: "0x0000000000000010", // Manage Channels permission
    options: [
        {
            name: 'text-channel',
            description: 'Text channel for commandless music (defaults to current channel)',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildText],
            required: false
        },
        {
            name: 'voice-channel',
            description: 'Required voice channel for music requests (optional)',
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildVoice],
            required: false
        }
    ],
    run: setupCentral,
};
