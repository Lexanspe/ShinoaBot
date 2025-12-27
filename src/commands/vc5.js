const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType,
    StringSelectMenuBuilder
} = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytdl = require('ytdl-core');
const ytpl = require('ytpl');
require('dotenv').config();

// Global sessions map: GuildID -> GuildSession
const sessions = new Map();

// Components V2 Constants (Experimental)
const MessageFlags_ComponentsV2 = 1 << 15;
const ComponentType_Container = 17;
const ComponentType_TextDisplay = 10; // Correct ID for TextDisplay
const ComponentType_Section = 9;
const ComponentType_Separator = 14;
const ComponentType_MediaGallery = 12;

/**
 * Class to manage music session state for a specific guild
 */
class GuildSession {
    constructor(guildId, interaction) {
        this.guildId = guildId;
        this.songs = new Map(); // Index -> Song Title
        this.songIds = new Map(); // Index -> Video ID
        this.songThumbnails = new Map(); // Index -> Thumbnail URL
        this.queueIndex = 1;
        this.isLooping = false;
        this.isEditing = false; // New state for Edit Mode
        this.isRemoving = false;
        this.isChangingQueue = false;
        this.selectedSongToMove = null; // Stores index of song selected in Step 1
        this.isJumping = false;
        this.isListLooping = false;
        this.isShuffling = false;
        this.showThumbnail = true; // Toggle for thumbnail display

        // Original playlist order (saved when shuffle is enabled)
        this.originalSongs = null;
        this.originalSongIds = null;
        this.originalSongThumbnails = null;

        this.voiceConnection = null;
        // ... (skipping lines for brevity in match, better to target specifically)

        this.audioPlayer = createAudioPlayer();
        this.voiceChannelId = null;

        this.collector = null;
        this.message = null; // The main message
        this.lastInteraction = interaction;

        this.setupPlayerListeners();
        return this;
    }

    setupPlayerListeners() {
        this.audioPlayer.on('stateChange', async (oldState, newState) => {
            console.log(`Player State Change [${this.guildId}]: ${oldState.status} -> ${newState.status}`);

            if (oldState.status === AudioPlayerStatus.Playing && newState.status === AudioPlayerStatus.Idle) {
                // Song finished
                await this.handleSongFinish();
            } else if (newState.status === AudioPlayerStatus.AutoPaused) {
                // Should not happen often with reliable connection
                this.audioPlayer.unpause();
            }
        });

        this.audioPlayer.on('error', error => {
            console.error(`Audio Player Error [${this.guildId}]:`, error);
            // Skip to next song on error
            this.queueIndex++;
            this.playCurrentSong();
        });
    }

    async handleSongFinish() {
        if (this.isLooping) {
            // Loop enabled: replay current song
        } else {
            // Go to next song (shuffle will have pre-arranged the order)
            this.queueIndex++;

            // Check List Loop OR Shuffle mode (shuffle should play all songs)
            if (this.queueIndex > this.songs.size && (this.isListLooping || this.isShuffling)) {
                this.queueIndex = 1;
            }
        }

        await this.playCurrentSong();
    }

    async playCurrentSong() {
        const videoId = this.songIds.get(this.queueIndex);

        if (!videoId) {
            // End of playlist
            this.songs.clear();
            this.songIds.clear();
            this.songThumbnails.clear();
            this.queueIndex = 1;

            this.stop();
            await this.updateEmbed();
            return;
        }

        const songTitle = this.songs.get(this.queueIndex);

        // Find file
        const ytsongsPath = path.join(__dirname, '../ytsongs');
        const exts = ["webm", "mp3", "m4a", "opus"];
        let filePath = null;

        for (const ext of exts) {
            const p = path.join(ytsongsPath, `${videoId}.${ext}`);
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }

        if (filePath) {
            const resource = createAudioResource(filePath, {
                inlineVolume: true,
                metadata: {
                    title: songTitle,
                    url: `https://www.youtube.com/watch?v=${videoId}`
                }
            });
            this.audioPlayer.play(resource);
            await this.updateEmbed();
        } else {
            console.error(`File not found for ${videoId}, skipping...`);
            this.queueIndex++;
            await this.playCurrentSong();
        }
    }

    stop() {
        this.audioPlayer.stop();
    }

    cleanup() {
        if (this.voiceConnection) {
            this.voiceConnection.destroy();
        }
        if (this.collector) {
            this.collector.stop();
        }
        if (this.message) {
            // Optionally delete message
        }
        sessions.delete(this.guildId);
    }

    /**
     * Updates the message with V2 Components
     */
    async updateEmbed() {
        if (!this.message) return;

        try {
            const payload = this.createV2Payload();
            // Edit the message. Note: We use the raw options pattern.
            // We must NOT send 'embeds' if we are in V2 mode usually, or they are ignored.
            // But to be clean, we send just components and flags.

            await this.message.edit({
                content: "", // V2 messages typically handle content via Text components, but clearing string content is good.
                embeds: [],
                components: payload.components,
                flags: MessageFlags_ComponentsV2
            });
        } catch (error) {
            console.warn(`Failed to update V2 message for ${this.guildId}:`, error.message);
        }
    }

    // Legacy method kept for reference/fallback if needed, but unused in V2 flow
    createEmbed() {
        return new EmbedBuilder().setDescription("Legacy Embed - Should not be seen");
    }

    createV2Payload() {
        const currentSong = this.songs.get(this.queueIndex);
        const currentThumbnail = this.songThumbnails.get(this.queueIndex);
        const prevSong = this.songs.get(this.queueIndex - 1);
        const nextSong = this.songs.get(this.queueIndex + 1);

        // Now Playing Section with Toggle Button
        const nowPlayingSection = {
            type: ComponentType_Section,
            components: [
                {
                    type: ComponentType_TextDisplay,
                    content: currentSong
                        ? `## 🎶 Now Playing\n**${currentSong}**`
                        : "##  🎵 No song playing\n*Add a song to get started!*"
                }
            ],
            accessory: new ButtonBuilder()
                .setCustomId('toggle_thumbnail')
                .setEmoji(this.showThumbnail ? '🖼️' : '📷')
                .setStyle(this.showThumbnail ? ButtonStyle.Success : ButtonStyle.Secondary)
                .toJSON()
        };

        // Thumbnail Component (if available and enabled)
        const thumbnailComponent = (currentThumbnail && this.showThumbnail) ? {
            type: ComponentType_MediaGallery,
            items: [{
                media: {
                    url: currentThumbnail
                }
            }]
        } : null;

        // Queue Preview (show next songs, wraparound if List Loop enabled)
        let queueContent = "";
        if (this.songs.size > 1) {
            queueContent = "### 📋 Up Next\n";
            const queueItems = [];

            // Show next 4 songs (or wraparound if List Loop enabled)
            for (let offset = 1; offset <= 4; offset++) {
                let i = this.queueIndex + offset;

                // If List Loop is enabled and we go past the end, wrap to beginning
                if (this.isListLooping && i > this.songs.size) {
                    i = ((i - 1) % this.songs.size) + 1;
                }

                // Stop if we've gone past the end and List Loop is disabled
                if (!this.isListLooping && i > this.songs.size) break;

                const song = this.songs.get(i);
                if (song) {
                    const truncated = song.length > 45 ? song.substring(0, 42) + '...' : song;

                    // If shuffled, find original position number
                    let displayNumber = i;
                    if (this.isShuffling && this.originalSongIds) {
                        const songId = this.songIds.get(i);
                        for (const [k, id] of this.originalSongIds.entries()) {
                            if (id === songId) {
                                displayNumber = k;
                                break;
                            }
                        }
                    }

                    queueItems.push(`**${displayNumber}.** ${truncated}`);
                }
            }

            if (queueItems.length > 0) queueContent += queueItems.join('\n');
            else queueContent = "";
        }

        // Footer: show original position if shuffled
        let footerText = '';
        if (currentSong) {
            let displayIndex = this.queueIndex;
            let displayTotal = this.songs.size;

            // If shuffled, find original position
            if (this.isShuffling && this.originalSongIds) {
                const currentSongId = this.songIds.get(this.queueIndex);
                for (const [k, id] of this.originalSongIds.entries()) {
                    if (id === currentSongId) {
                        displayIndex = k;
                        break;
                    }
                }
                displayTotal = this.originalSongs.size;
            }

            footerText = `Song ${displayIndex}/${displayTotal} • Loop: ${this.isListLooping ? '🔁' : '❌'} • Shuffle: ${this.isShuffling ? '🔀' : '❌'}`;
        } else {
            footerText = `Empty playlist`;
        }


        // 3. Assemble V2 Structure

        // Loop Section (Type 9: Section) -> Text components + Accessory Button
        const loopSection = {
            type: ComponentType_Section,
            components: [
                {
                    type: ComponentType_TextDisplay,
                    content: `**Single Loop**: ${this.isLooping ? '✅ Enabled' : '❌ Disabled'}`
                }
            ],
            accessory: new ButtonBuilder()
                .setCustomId('toggle_loop')
                .setLabel(this.isLooping ? 'Disable' : 'Enable')
                .setStyle(this.isLooping ? ButtonStyle.Danger : ButtonStyle.Success)
                .toJSON()
        };

        // Main Controls Row (Type 1 inside Container)
        const mainControls = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setEmoji('⏮️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.queueIndex <= 1 && !this.isListLooping),
                new ButtonBuilder()
                    .setCustomId('rewind')
                    .setEmoji('⏪')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('pause_resume')
                    .setEmoji(
                        this.audioPlayer.state.status === AudioPlayerStatus.Playing ||
                            this.audioPlayer.state.status === AudioPlayerStatus.Buffering
                            ? '⏸️' : '▶️'
                    )
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('jump')
                    .setEmoji('⤵️')
                    .setLabel('Jump')
                    .setStyle(this.isJumping ? ButtonStyle.Success : ButtonStyle.Secondary)
            ).toJSON();

        // Secondary Controls (Add Song, List, Edit List, Quit)
        const secondaryRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_song')
                    .setLabel('Add Song')
                    .setStyle(ButtonStyle.Success)
            );

        if (this.songs.size > 0) {
            secondaryRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('song_list')
                    .setLabel('List')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('edit_list')
                    .setLabel(this.isEditing ? 'Close Options' : 'Edit List')
                    .setStyle(this.isEditing ? ButtonStyle.Danger : ButtonStyle.Secondary)
            );
        }

        secondaryRow.addComponents(
            new ButtonBuilder()
                .setCustomId('quit')
                .setLabel('Quit')
                .setStyle(ButtonStyle.Danger)
        );

        const secondaryControls = secondaryRow.toJSON();

        // Edit Mode Controls (Remove Song, Change Queue, List Loop, Shuffle)
        let editControls = null;
        if (this.isEditing && this.songs.size > 0) {
            editControls = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('remove_song')
                        .setLabel('Remove')
                        .setEmoji('🗑️')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('change_queue')
                        .setLabel('Move')
                        .setEmoji('↔️')
                        .setStyle(this.isChangingQueue ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('list_loop')
                        .setLabel('List Loop')
                        .setEmoji('🔁')
                        .setStyle(this.isListLooping ? ButtonStyle.Success : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setEmoji('🔀')
                        .setStyle(this.isShuffling ? ButtonStyle.Success : ButtonStyle.Secondary)
                ).toJSON();
        }

        // Root Container
        const rootContainer = {
            type: ComponentType_Container,
            accent_color: 0x5865F2, // Discord Blurple
            components: [
                // Thumbnail (if available)
                ...(thumbnailComponent ? [thumbnailComponent] : []),
                // Now Playing Section with Toggle Button
                nowPlayingSection,
                // Queue Section (if applicable)
                ...(queueContent ? [{
                    type: ComponentType_TextDisplay,
                    content: queueContent,
                }] : []),
                // Loop Section (Text + Button)
                loopSection,

                // Main Controls (Action Row inside Container) - Only if songs exist
                ...(this.songs.size > 0 ? [mainControls] : []),

                // Secondary Controls
                secondaryControls,

                // Separator (only if edit controls are visible)
                ...(editControls ? [{ type: ComponentType_Separator }] : []),

                // Edit Controls (Only if editing)
                ...(editControls ? [editControls] : []),

                // Footer (Small text)
                {
                    type: ComponentType_TextDisplay,
                    content: `*${footerText}*`
                }
            ]
        };

        // Remove Song Selection Menu (Outside Container)
        let removeMenuRow = null;
        if (this.isRemoving && this.songs.size > 0) {
            // ... (existing remove logic logic reuse or similar)
            const options = [];
            let count = 0;
            for (const [index, title] of this.songs.entries()) {
                if (count >= 24) break; // Leave room? No need, 25 limit.
                const label = (index === this.queueIndex ? '▶ ' : '') + `${index}. ${title.substring(0, 90)}`;
                options.push({
                    label: label,
                    value: index.toString(),
                    description: index === this.queueIndex ? 'Currently Playing' : undefined
                });
                count++;
            }
            removeMenuRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_remove_song')
                    .setPlaceholder('Select a song to remove...')
                    .addOptions(options)
            ).toJSON();
        }

        // Change Queue Menu (Step 1: Select Song to Move)
        let changeQueueRow = null;
        if (this.isChangingQueue && this.songs.size > 0 && this.selectedSongToMove === null) {
            const options = [];
            let count = 0;
            for (const [index, title] of this.songs.entries()) {
                if (count >= 25) break;
                const label = (index === this.queueIndex ? '▶ ' : '') + `${index}. ${title.substring(0, 90)}`;
                options.push({
                    label: label,
                    value: index.toString(),
                    description: index === this.queueIndex ? 'Currently Playing' : undefined
                });
                count++;
            }
            changeQueueRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_move_song_source')
                    .setPlaceholder('Select a song to move...')
                    .addOptions(options)
            ).toJSON();
        }

        // Change Queue Menu (Step 2: Select Target Position)
        let targetPositionRow = null;
        if (this.isChangingQueue && this.selectedSongToMove !== null) {
            const options = [];
            // Option to Cancel
            options.push({
                label: "Cancel Move",
                value: "cancel",
                emoji: "❌"
            });

            let count = 0;
            // Show positions 1 to Size
            for (let i = 1; i <= this.songs.size; i++) {
                if (count >= 24) break;
                // Don't show the current position of the selected song as a target?
                // Acts as "Move to position X".
                options.push({
                    label: `Position ${i}`,
                    value: i.toString(),
                    description: i === this.selectedSongToMove ? 'Current Position' : undefined
                });
                count++;
            }

            targetPositionRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_move_song_target')
                    .setPlaceholder(`Move "${this.songs.get(this.selectedSongToMove).substring(0, 30)}..." to...`)
                    .addOptions(options)
            ).toJSON();
        }

        // Jump Menu (Select Song to Jump to)
        let jumpRow = null;
        if (this.isJumping && this.songs.size > 0) {
            const options = [];
            let count = 0;
            for (const [index, title] of this.songs.entries()) {
                if (count >= 25) break;
                const label = (index === this.queueIndex ? '▶ ' : '') + `${index}. ${title.substring(0, 90)}`;
                options.push({
                    label: label,
                    value: index.toString(),
                    description: index === this.queueIndex ? 'Currently Playing' : undefined
                });
                count++;
            }
            jumpRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_jump_song')
                    .setPlaceholder('Jump to song...')
                    .addOptions(options)
            ).toJSON();
        }

        // Determine which external row to show
        // Priority: Remove > ChangeQueue > Jump
        const externalRow = removeMenuRow || targetPositionRow || changeQueueRow || jumpRow;

        return {
            components: [
                rootContainer,
                ...(externalRow ? [externalRow] : [])
            ]
        };
    }

    // Kept to satisfy interface if called, but we use createV2Payload mostly now.
    createComponents() {
        return []; // We handle components inside createV2Payload now.
    }
}

// --- Helper Functions ---

// Check if URL is a YouTube playlist
function isPlaylistUrl(url) {
    return url.includes('list=');
}

async function getYouTubeId(url) {
    try {
        if (url.includes('youtu.be/')) {
            return url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/watch')) {
            return url.split('v=')[1].split('&')[0];
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function getYouTubeTitle(url) {
    try {
        const info = await ytdl.getBasicInfo(url);
        const title = info.videoDetails.title;
        const thumbnails = info.videoDetails.thumbnails;
        const thumbnail = thumbnails && thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;
        return { title, thumbnail };
    } catch (error) {
        console.error('Error fetching title:', error.message);
        return { title: `YouTube Video ${await getYouTubeId(url)}`, thumbnail: null };
    }
}

// Get YouTube playlist information
async function getPlaylistInfo(url) {
    try {
        const playlistId = url.split('list=')[1]?.split('&')[0];
        if (!playlistId) throw new Error("Invalid playlist URL");

        // Use ytpl to get playlist info
        const playlist = await ytpl(playlistId, { limit: Infinity });

        // Extract video information
        const videos = playlist.items.map(item => ({
            videoId: item.id,
            title: item.title,
            thumbnail: item.bestThumbnail?.url || item.thumbnails?.[0]?.url || null
        }));

        return videos;
    } catch (error) {
        console.error('Error fetching playlist:', error.message);
        throw error;
    }
}

async function downloadVideo(url, interaction) {
    return new Promise(async (resolve, reject) => {
        try {
            const videoId = await getYouTubeId(url);
            if (!videoId) throw new Error("Invalid YouTube URL");

            const ytsongsPath = path.join(__dirname, '../ytsongs');
            await fsPromises.mkdir(ytsongsPath, { recursive: true });

            // Check if already exists
            const exts = ["webm", "mp3", "m4a", "opus"];
            for (const ext of exts) {
                const p = path.join(ytsongsPath, `${videoId}.${ext}`);
                try {
                    await fsPromises.access(p);
                    // File exists
                    return resolve({
                        videoId,
                        title: await getYouTubeTitle(url), // Optimistically fetch title or just use ID
                        isNew: false
                    });
                } catch { /* continue */ }
            }

            // Not found, download
            console.log(`Downloading ${videoId}...`);
            const ytDlp = new YTDlpWrap();
            const outputTemplate = path.join(ytsongsPath, `${videoId}.%(ext)s`);

            await ytDlp.execPromise([
                `https://www.youtube.com/watch?v=${videoId}`,
                '-f', 'bestaudio/best',
                '-o', outputTemplate,
                '--extract-audio',
                '--audio-quality', '160K',
                '--no-playlist'
            ]);

            // Determine what was downloaded
            // (yt-dlp might choose ext based on capabilities, usually opus or m4a)
            // We can check the directory again or trust it's there.
            // Let's resolve with Video ID and fetch Title.

            const title = await getYouTubeTitle(`https://www.youtube.com/watch?v=${videoId}`);
            resolve({
                videoId,
                title,
                isNew: true
            });

        } catch (error) {
            reject(error);
        }
    });
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('playyt') // Updated name as requested
        .setDescription('Optimized YouTube music player'),

    async execute(interaction) {
        // 1. Voice Channel Check
        const member = interaction.member;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });
        }

        // 2. Session Initialization or Retrieval
        let session = sessions.get(interaction.guildId);

        if (!session) {
            session = new GuildSession(interaction.guildId, interaction);
            sessions.set(interaction.guildId, session);

            // Connect to voice
            session.voiceConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            session.voiceConnection.subscribe(session.audioPlayer);
            session.voiceChannelId = voiceChannel.id;
        } else {
            // If already active, check if user is in same channel
            if (voiceChannel.id !== session.voiceChannelId) {
                return interaction.reply({ content: `I am already active in <#${session.voiceChannelId}>. Join me there or stop the bot first.`, ephemeral: true });
            }
        }

        // 3. Send/Update Command Interface
        const payload = session.createV2Payload();

        // Delete old message if exists
        if (session.message) {
            try {
                await session.message.delete();
            } catch (e) { /* ignore deletion error */ }
            session.message = null;
        }

        const response = await interaction.reply({
            embeds: [], // Clear embeds
            components: payload.components,
            flags: MessageFlags_ComponentsV2, // Activate V2 components
            withResponse: true
        });
        session.message = response.resource ? response.resource.message : await interaction.fetchReply();

        // 4. Start Collector Setup (if not already running)
        // We need to manage the collector. If we just created the session, start it.
        // If it exists but we sent a new message, we might need to recreate collector bound to new message OR just keep using the channel collector.
        // The original code used a channel collector.

        if (session.collector) session.collector.stop("renewed");

        session.collector = interaction.channel.createMessageComponentCollector({
            time: 3600_000 // 1 hour idle timeout (can be longer)
        });

        session.collector.on('collect', async (i) => {
            if (i.member.voice.channelId !== session.voiceChannelId) {
                return i.reply({ content: "Join the voice channel to use controls!", ephemeral: true });
            }

            try {
                if (i.isButton()) {
                    switch (i.customId) {
                        case 'add_song':
                            // Show Modal
                            const modal = new ModalBuilder()
                                .setCustomId(`add_song_modal_${interaction.guildId}`)
                                .setTitle('Add Song');

                            const input = new TextInputBuilder()
                                .setCustomId('url_input')
                                .setLabel('YouTube URL')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('https://youtube.com/watch?v=...')
                                .setRequired(true);

                            modal.addComponents(new ActionRowBuilder().addComponents(input));
                            await i.showModal(modal);
                            break;

                        case 'song_list':
                            let list = "";
                            // Always show original order (or current if not shuffled)
                            const listToShow = session.isShuffling && session.originalSongs ? session.originalSongs : session.songs;
                            listToShow.forEach((title, idx) => {
                                list += `${idx}. ${title}\n`;
                            });
                            if (!list) list = "Playlist is empty.";
                            // truncate if too long
                            if (list.length > 1900) list = list.substring(0, 1900) + "...";

                            await i.reply({ content: `**Playlist** ${session.isShuffling ? '(Original Order)' : ''}:\n${list}`, ephemeral: true });
                            break;

                        case 'toggle_loop':
                            session.isLooping = !session.isLooping;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        case 'edit_list':
                            session.isEditing = !session.isEditing;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        // Stubs for new buttons to prevent "Interaction Failed"
                        case 'remove_song':
                            session.isRemoving = !session.isRemoving;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        case 'change_queue':
                            session.isChangingQueue = !session.isChangingQueue;
                            session.selectedSongToMove = null; // Reset selection on toggle
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        case 'toggle_thumbnail':
                            session.showThumbnail = !session.showThumbnail;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        case 'list_loop':
                            session.isListLooping = !session.isListLooping;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            // Optional: Send ephemeral confirmation? Text in embed might be enough if added.
                            // For now, let's add a small footer note or rely on button color (if we change it).
                            // User asked to "add logic", visual feedback is secondary but good.
                            // Let's rely on button color change (need to update createV2Payload for color).
                            // But first, logic.
                            await i.followUp({ content: `List Loop is now **${session.isListLooping ? 'Enabled' : 'Disabled'}**.`, ephemeral: true });
                            break;

                        case 'shuffle':
                            if (!session.isShuffling) {
                                // Enabling shuffle: save original order and shuffle
                                session.originalSongs = new Map(session.songs);
                                session.originalSongIds = new Map(session.songIds);
                                session.originalSongThumbnails = new Map(session.songThumbnails);

                                // Get current song info
                                const currentIndex = session.queueIndex;
                                const currentEntry = {
                                    title: session.songs.get(currentIndex),
                                    id: session.songIds.get(currentIndex),
                                    thumbnail: session.songThumbnails.get(currentIndex)
                                };

                                // Convert to array and shuffle (excluding current song)
                                const entries = [];
                                for (const k of session.songs.keys()) {
                                    if (k !== currentIndex) {
                                        entries.push({
                                            title: session.songs.get(k),
                                            id: session.songIds.get(k),
                                            thumbnail: session.songThumbnails.get(k)
                                        });
                                    }
                                }

                                // Fisher-Yates shuffle the remaining songs
                                for (let idx = entries.length - 1; idx > 0; idx--) {
                                    const j = Math.floor(Math.random() * (idx + 1));
                                    [entries[idx], entries[j]] = [entries[j], entries[idx]];
                                }

                                // Rebuild maps with current song first
                                session.songs.clear();
                                session.songIds.clear();
                                session.songThumbnails.clear();

                                // Put current song at position 1
                                session.songs.set(1, currentEntry.title);
                                session.songIds.set(1, currentEntry.id);
                                session.songThumbnails.set(1, currentEntry.thumbnail);

                                // Add shuffled songs starting from position 2
                                entries.forEach((entry, idx) => {
                                    const key = idx + 2;
                                    session.songs.set(key, entry.title);
                                    session.songIds.set(key, entry.id);
                                    session.songThumbnails.set(key, entry.thumbnail);
                                });

                                // Set queue index to 1 (current song)
                                session.queueIndex = 1;
                            } else {
                                // Disabling shuffle: restore original order
                                const currentSongId = session.songIds.get(session.queueIndex);

                                session.songs = new Map(session.originalSongs);
                                session.songIds = new Map(session.originalSongIds);
                                session.songThumbnails = new Map(session.originalSongThumbnails);

                                // Find where current song is in original order
                                for (const [k, id] of session.songIds.entries()) {
                                    if (id === currentSongId) {
                                        session.queueIndex = k;
                                        break;
                                    }
                                }

                                session.originalSongs = null;
                                session.originalSongIds = null;
                                session.originalSongThumbnails = null;
                            }

                            session.isShuffling = !session.isShuffling;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            await i.followUp({ content: `Shuffle Mode is now **${session.isShuffling ? 'Enabled' : 'Disabled'}**.`, ephemeral: true });
                            break;

                        case 'jump':
                            session.isJumping = !session.isJumping;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            break;

                        // ... (previous cases)
                        case 'previous':
                            if (session.queueIndex > 1) {
                                session.queueIndex--;
                            } else if (session.isListLooping && (session.queueIndex === 1 || session.queueIndex <= 1)) {
                                session.queueIndex = session.songs.size;
                            }
                            await i.deferUpdate();
                            await session.playCurrentSong();
                            break;

                        case 'rewind':
                            await i.deferUpdate();
                            await session.playCurrentSong();
                            break;

                        case 'skip':
                            session.queueIndex++;
                            // Check List Loop for manual skip
                            if (session.queueIndex > session.songs.size && session.isListLooping) {
                                session.queueIndex = 1;
                            }
                            await i.deferUpdate();
                            await session.playCurrentSong();
                            break;

                        case 'pause_resume':
                            if (session.audioPlayer.state.status === AudioPlayerStatus.Playing) {
                                session.audioPlayer.pause();
                            } else {
                                session.audioPlayer.unpause();
                            }
                            await i.deferUpdate();
                            await session.updateEmbed(); // Button label changes
                            break;

                        case 'quit':
                            session.cleanup();
                            await i.update({
                                components: [{
                                    type: ComponentType_Container,
                                    accent_color: 0x54007f,
                                    components: [{
                                        type: ComponentType_TextDisplay,
                                        content: "Disconnected."
                                    }]
                                }],
                                // We don't need to specify flags again if it's already set, but let's be safe or just minimal update. 
                                // Actually, updating V2 message requires valid V2 payload.
                            });
                            break;
                    }
                } else if (i.isStringSelectMenu()) {
                    if (i.customId === 'select_remove_song') {
                        const removeIndex = parseInt(i.values[0]);
                        if (!isNaN(removeIndex) && session.songs.has(removeIndex)) {
                            const removedTitle = session.songs.get(removeIndex);

                            // Removal Logic: Re-index Map
                            const originalQueueIndex = session.queueIndex;

                            session.songs.delete(removeIndex);
                            session.songIds.delete(removeIndex);

                            // If we removed a previous song (removeIndex < queueIndex), queueIndex should decrement.
                            if (removeIndex < session.queueIndex) {
                                session.queueIndex--;
                            }

                            // Shift subsequent songs down
                            const entries = [];
                            for (const k of session.songs.keys()) {
                                entries.push({
                                    oldKey: k,
                                    title: session.songs.get(k),
                                    id: session.songIds.get(k)
                                });
                            }
                            entries.sort((a, b) => a.oldKey - b.oldKey);

                            session.songs.clear();
                            session.songIds.clear();

                            entries.forEach((entry, idx) => {
                                const currentKey = idx + 1;
                                session.songs.set(currentKey, entry.title);
                                session.songIds.set(currentKey, entry.id);
                            });

                            // Ensure queueIndex is valid
                            if (session.queueIndex < 1 && session.songs.size > 0) session.queueIndex = 1;
                            if (session.queueIndex > session.songs.size && session.songs.size > 0) session.queueIndex = session.songs.size;

                            session.isRemoving = false; // Close menu after selection
                            await i.deferUpdate();

                            if (removeIndex === originalQueueIndex) {
                                // Only skip if we removed the song that was ACTUALLY playing
                                await session.playCurrentSong();
                            } else {
                                await session.updateEmbed();
                            }

                            await i.followUp({ content: `Removed **${removedTitle}** from the playlist.`, ephemeral: true });
                        } else {
                            await i.reply({ content: "Invalid selection.", ephemeral: true });
                        }
                    } else if (i.customId === 'select_move_song_source') {
                        // Step 1 Completed: User selected song to move
                        const sourceIndex = parseInt(i.values[0]);
                        if (!isNaN(sourceIndex) && session.songs.has(sourceIndex)) {
                            session.selectedSongToMove = sourceIndex;
                            await i.deferUpdate();
                            await session.updateEmbed(); // Updates to show Step 2 menu
                        } else {
                            await i.reply({ content: "Invalid selection.", ephemeral: true });
                        }
                    } else if (i.customId === 'select_move_song_target') {
                        // Step 2 Completed: User selected target position
                        const targetValue = i.values[0];
                        if (targetValue === 'cancel') {
                            session.isChangingQueue = false;
                            session.selectedSongToMove = null;
                            await i.deferUpdate();
                            await session.updateEmbed();
                            return;
                        }

                        const targetIndex = parseInt(targetValue);
                        const sourceIndex = session.selectedSongToMove;

                        if (!isNaN(targetIndex) && session.songs.has(sourceIndex)) {
                            // Move Logic
                            const titleToMove = session.songs.get(sourceIndex);
                            const idToMove = session.songIds.get(sourceIndex);

                            // We are moving from sourceIndex to targetIndex.
                            // Strategy: Convert to array, move element, rebuild map.

                            const entries = [];
                            for (const k of session.songs.keys()) {
                                entries.push({
                                    oldKey: k,
                                    title: session.songs.get(k),
                                    id: session.songIds.get(k)
                                });
                            }
                            entries.sort((a, b) => a.oldKey - b.oldKey);

                            // Find element
                            const itemIndex = entries.findIndex(e => e.oldKey === sourceIndex);
                            if (itemIndex > -1) {
                                const [item] = entries.splice(itemIndex, 1);
                                // Insert at new position (convert 1-based targetIndex to 0-based array index)
                                // If target is 1, insert at 0.
                                entries.splice(targetIndex - 1, 0, item);
                            }

                            // Rebuild Map
                            session.songs.clear();
                            session.songIds.clear();

                            // Track where the *current* song ended up
                            // If we moved the currently playing song, we need to find its new index.
                            // If we moved another song, the current song's index might check.

                            // Actually, capturing the "original queue index" logic is complex because the song at that index might have moved.
                            // Better: Track the *unique ID* (or reference) of the current song if possible?
                            // But songs can have duplicate IDs. 
                            // Let's assume queueIndex tracks the *position*. 
                            // If we move the song AT queueIndex, we should update queueIndex to the new position.
                            // If we move a song *above* queueIndex to *below* it, queueIndex decrements.
                            // If we move a song *below* queueIndex to *above* it, queueIndex increments.

                            // Let's use the "re-find current song" approach if possible.
                            // But duplicate songs make this hard. 
                            // Let's rely on array math.

                            let newQueueIndex = session.queueIndex;

                            // Case 1: We moved the current song
                            if (sourceIndex === session.queueIndex) {
                                newQueueIndex = targetIndex;
                            }
                            // Case 2: We moved a song from ABOVE current to BELOW current
                            else if (sourceIndex < session.queueIndex && targetIndex >= session.queueIndex) {
                                newQueueIndex--;
                            }
                            // Case 3: We moved a song from BELOW current to ABOVE current
                            else if (sourceIndex > session.queueIndex && targetIndex <= session.queueIndex) {
                                newQueueIndex++;
                            }

                            session.queueIndex = newQueueIndex;

                            entries.forEach((entry, idx) => {
                                const currentKey = idx + 1;
                                session.songs.set(currentKey, entry.title);
                                session.songIds.set(currentKey, entry.id);
                            });

                            session.isChangingQueue = false;
                            session.selectedSongToMove = null;

                            await i.deferUpdate();
                            await session.updateEmbed();
                            await i.followUp({ content: `Moved **${titleToMove}** to position ${targetIndex}.`, ephemeral: true });

                        } else {
                            await i.reply({ content: "Invalid move operation.", ephemeral: true });
                        }
                    } else if (i.customId === 'select_jump_song') {
                        // Jump Logic
                        const jumpIndex = parseInt(i.values[0]);
                        if (!isNaN(jumpIndex) && session.songs.has(jumpIndex)) {
                            session.queueIndex = jumpIndex;
                            session.isJumping = false;
                            await i.deferUpdate();
                            await session.playCurrentSong();
                        } else {
                            await i.reply({ content: "Invalid selection.", ephemeral: true });
                        }
                    }
                }
            } catch (err) {
                console.error("Button Error:", err);
                if (!i.replied && !i.deferred) i.reply({ content: "Failed to process button.", ephemeral: true });
            }
        });

        session.collector.on('end', (collected, reason) => {
            if (reason !== 'renewed' && reason !== 'user') {
                // Timeout
                if (sessions.has(interaction.guildId)) {
                    session.message.edit({
                        components: [{
                            type: ComponentType_Container,
                            accent_color: 0x54007f,
                            components: [{
                                type: ComponentType_TextDisplay,
                                content: "Session timed out."
                            }]
                        }]
                    }).catch(() => { });
                    session.cleanup();
                }
            }
        });
    }
};

// Global Modal Handler (needs to be registered in your main bot file, or here if you have a loader that handles it)
// NOTE: Since this is a command file, we can't easily export a separate event listener that automatically attaches.
// However, the original code attached it to `interaction.client`. We can do the same within `execute` but ensure we don't duplicate.
// OR we can rely on the fact that `awaitModalSubmit` is cleaner for command-specific flows, but this is a persistent "Add Song" button.
// For optimization, let's attach a global listener ONCE if not exists, or handle it via specific interaction flow.
// The cleanest pattern for this specific user setup (one-file command) is to attach listener on client, but check a Set to avoid duplicates.

// We will use a static property or global symbol to check if listener is attached.
const LISTENERS_ATTACHED = Symbol.for('VC5_LISTENERS_ATTACHED');

if (!global[LISTENERS_ATTACHED]) {
    // This part assumes we have access to the client instance, which we get in execute. 
    // But we can't get it here at top level.
    // Solution: We'll attach it on the first execution.
}

// ... actually, we can't export extra logic easily for the main bot. 
// We will add the logic inside `execute` to attach `interaction.client.on(...)` ONLY ONCE.

module.exports.init = (client) => {
    // Optional: If your bot loader calls init.
};

// Fallback: Attach inside execute with a check.
// Process YouTube playlist
async function processPlaylist(interaction, session, playlistUrl) {
    try {
        await interaction.editReply({ content: '🔍 Analyzing playlist...' });

        const videos = await getPlaylistInfo(playlistUrl);

        if (!videos || videos.length === 0) {
            return interaction.editReply({ content: '❌ No videos found in playlist or playlist is private/unavailable.' });
        }

        await interaction.editReply({ content: `�� Found ${videos.length} songs. Downloading...` });

        let downloaded = 0;
        const firstSongWasIdle = session.audioPlayer.state.status === AudioPlayerStatus.Idle;

        for (const [index, video] of videos.entries()) {
            try {
                const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
                const ytsongsPath = path.join(__dirname, '../ytsongs');
                const exts = ["webm", "mp3", "m4a", "opus"];
                let exists = false;

                // Check if video already downloaded
                for (const ext of exts) {
                    if (fs.existsSync(path.join(ytsongsPath, `${video.videoId}.${ext}`))) {
                        exists = true;
                        break;
                    }
                }

                // Download if not exists
                if (!exists) {
                    await downloadVideo(videoUrl);
                }

                // Add to playlist
                let nextIndex = 1;
                if (session.songs.size > 0) {
                    nextIndex = Math.max(...session.songs.keys()) + 1;
                }

                session.songs.set(nextIndex, video.title);
                session.songIds.set(nextIndex, video.videoId);
                session.songThumbnails.set(nextIndex, video.thumbnail);

                // If shuffle is active, also add to original Maps
                if (session.isShuffling && session.originalSongs) {
                    let originalNextIndex = 1;
                    if (session.originalSongs.size > 0) {
                        originalNextIndex = Math.max(...session.originalSongs.keys()) + 1;
                    }
                    session.originalSongs.set(originalNextIndex, video.title);
                    session.originalSongIds.set(originalNextIndex, video.videoId);
                    session.originalSongThumbnails.set(originalNextIndex, video.thumbnail);
                }

                downloaded++;

                // Update progress every 5 songs or on first/last song
                if (downloaded === 1 || downloaded === videos.length || downloaded % 5 === 0) {
                    await interaction.editReply({ content: `⬇️ Downloading... (${downloaded}/${videos.length})` });
                    // Update UI to show new songs
                    await session.updateEmbed();
                }

                // Start playing if this was the first song and player was idle
                if (downloaded === 1 && firstSongWasIdle) {
                    session.queueIndex = nextIndex;
                    await session.playCurrentSong();
                }
            } catch (videoError) {
                console.error(`Error processing video ${video.videoId}:`, videoError.message);
                // Continue with next video
            }
        }

        await interaction.editReply({ content: `✅ Added ${downloaded} songs to the queue!` });

        // If shuffle was active, re-shuffle to mix new songs
        if (session.isShuffling && downloaded > 0) {
            const currentSongId = session.songIds.get(session.queueIndex);
            const currentIndex = session.queueIndex;
            const currentEntry = {
                title: session.songs.get(currentIndex),
                id: currentSongId,
                thumbnail: session.songThumbnails.get(currentIndex)
            };

            const entries = [];
            for (const k of session.songs.keys()) {
                if (k !== currentIndex) {
                    entries.push({
                        title: session.songs.get(k),
                        id: session.songIds.get(k),
                        thumbnail: session.songThumbnails.get(k)
                    });
                }
            }

            // Fisher-Yates shuffle
            for (let idx = entries.length - 1; idx > 0; idx--) {
                const j = Math.floor(Math.random() * (idx + 1));
                [entries[idx], entries[j]] = [entries[j], entries[idx]];
            }

            // Rebuild
            session.songs.clear();
            session.songIds.clear();
            session.songThumbnails.clear();
            session.songs.set(1, currentEntry.title);
            session.songIds.set(1, currentEntry.id);
            session.songThumbnails.set(1, currentEntry.thumbnail);
            entries.forEach((entry, idx) => {
                const key = idx + 2;
                session.songs.set(key, entry.title);
                session.songIds.set(key, entry.id);
                session.songThumbnails.set(key, entry.thumbnail);
            });
            session.queueIndex = 1;
        }

        // Cleanup message after 5 seconds
        setTimeout(async () => {
            try {
                await interaction.deleteReply();
            } catch (e) { /* ignore */ }
        }, 5000);

        // Final UI update
        await session.updateEmbed();
    } catch (error) {
        console.error('Error processing playlist:', error);
        await interaction.editReply({ content: `❌ Error processing playlist: ${error.message}` });
    }
}

// Fallback: Attach inside execute with a check.
const attachModalListener = (client) => {
    if (client.vc5ModalListenerAttached) return;

    client.on('interactionCreate', async interaction => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('add_song_modal_')) return;

        const guildId = interaction.guildId;
        const session = sessions.get(guildId);

        if (!session) {
            return interaction.reply({ content: "No active music session found.", ephemeral: true });
        }

        const url = interaction.fields.getTextInputValue('url_input');

        await interaction.deferReply({ ephemeral: true });

        // Check if URL is a playlist
        if (isPlaylistUrl(url)) {
            return await processPlaylist(interaction, session, url);
        }

        // Single video processing (existing logic)
        try {
            const videoId = await getYouTubeId(url);
            if (!videoId) throw new Error("Invalid YouTube URL");

            const infoPromise = getYouTubeTitle(url); // Start fetching info

            // 2. Check Existence
            const ytsongsPath = path.join(__dirname, '../ytsongs');
            const exts = ["webm", "mp3", "m4a", "opus"];
            let exists = false;

            for (const ext of exts) {
                if (fs.existsSync(path.join(ytsongsPath, `${videoId}.${ext}`))) {
                    exists = true;
                    break;
                }
            }

            const { title, thumbnail } = await infoPromise;

            // 3. User Feedback & Action
            if (exists) {
                await interaction.editReply({ content: `Added "**${title}**" to the song list.` });
            } else {
                await interaction.editReply({ content: `I couldn't find "**${title}**" in my database. *Wait a moment while I download it...*` });

                // Perform Download
                await downloadVideo(url); // This will handle the actual download

                await interaction.editReply({ content: `Finished downloading "**${title}**".` });
            }

            // 4. Add to playlist
            let nextIndex = 1;
            if (session.songs.size > 0) {
                nextIndex = Math.max(...session.songs.keys()) + 1;
            }

            session.songs.set(nextIndex, title);
            session.songIds.set(nextIndex, videoId);
            session.songThumbnails.set(nextIndex, thumbnail);

            // If shuffle is active, also add to original Maps (with correct original index)
            if (session.isShuffling && session.originalSongs) {
                let originalNextIndex = 1;
                if (session.originalSongs.size > 0) {
                    originalNextIndex = Math.max(...session.originalSongs.keys()) + 1;
                }
                session.originalSongs.set(originalNextIndex, title);
                session.originalSongIds.set(originalNextIndex, videoId);
                session.originalSongThumbnails.set(originalNextIndex, thumbnail);
            }

            // 5. Cleanup message after 3 seconds
            setTimeout(async () => {
                try {
                    await interaction.deleteReply();
                } catch (e) { /* ignore */ }
            }, 3000);

            // 6. Play if idle
            if (session.audioPlayer.state.status === AudioPlayerStatus.Idle) {
                session.queueIndex = nextIndex;
                if (session.songs.size === 1) {
                    session.queueIndex = 1;
                    await session.playCurrentSong();
                }
            } else {
                await session.updateEmbed();
            }

        } catch (error) {
            console.error("Download Error:", error);
            await interaction.editReply({ content: `Failed to add song: ${error.message}` });
        }
    });

    client.vc5ModalListenerAttached = true;
    console.log("VC5 Modal Handler Attached");
};

// Hook the attach into the execute start
const originalExecute = module.exports.execute;
module.exports.execute = async (interaction) => {
    attachModalListener(interaction.client);
    return originalExecute(interaction);
};
