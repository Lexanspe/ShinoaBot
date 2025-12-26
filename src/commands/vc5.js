const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ComponentType
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
require('dotenv').config();

// Global sessions map: GuildID -> GuildSession
const sessions = new Map();

/**
 * Class to manage music session state for a specific guild
 */
class GuildSession {
    constructor(guildId, interaction) {
        this.guildId = guildId;
        this.songs = new Map(); // Index -> Song Title
        this.songIds = new Map(); // Index -> Video ID
        this.queueIndex = 1;
        this.isLooping = false;

        this.voiceConnection = null;
        this.audioPlayer = createAudioPlayer();
        this.voiceChannelId = null;

        this.collector = null;
        this.message = null; // The main embed message
        this.lastInteraction = interaction; // Store last interaction for follow-ups

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
                // Should not happen often with reliable connection, but just in case
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
            // Do not increment queueIndex
        } else {
            // Loop disabled: go to next song
            this.queueIndex++;
        }

        await this.playCurrentSong();
    }

    async playCurrentSong() {
        const videoId = this.songIds.get(this.queueIndex);

        if (!videoId) {
            // End of playlist
            if (this.isLooping) {
                // Technically if looping is on, we shouldn't reach here unless queue was empty/cleared
                // But if we do, maybe reset to 1? Or just stop.
                // Original logic seemed to just stop if next song missing.
            }

            // Should we check if there's a song at index 1 and loop back if "Loop All"?
            // Original code only had single song loop or "Loop" button which seemed to behave like "Loop current" or maybe "Loop Queue"?
            // Analyzing original code: 
            // if (loops.get(...)) { queue = queue - 1 } -> This implies "Repeat Current Song" behavior when song finishes.

            // If no song, stop.
            this.songs.clear();
            this.songIds.clear();
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
        // Don't destroy connection immediately, just stop playing
    }

    cleanup() {
        if (this.voiceConnection) {
            this.voiceConnection.destroy();
        }
        if (this.collector) {
            this.collector.stop();
        }
        if (this.message) {
            // Optionally delete message or edit to show "Session ended"
            // this.message.delete().catch(() => {});
        }
        sessions.delete(this.guildId);
    }

    async updateEmbed() {
        if (!this.message) return;

        try {
            const embed = this.createEmbed();
            const components = this.createComponents();

            // We usually edit the last known message
            await this.message.edit({ embeds: [embed], components: components });
        } catch (error) {
            console.warn(`Failed to update embed for ${this.guildId}:`, error.message);
            // If message is deleted, maybe send a new one? For now just log.
        }
    }

    createEmbed() {
        const currentSong = this.songs.get(this.queueIndex);
        const prevSong = this.songs.get(this.queueIndex - 1);
        const nextSong = this.songs.get(this.queueIndex + 1);

        let desc = "";

        if (!currentSong) {
            desc = "No song is currently playing.";
        } else {
            desc = `Loop: ${this.isLooping ? 'Enabled' : 'Disabled'}\n\n**Song List:**\n`;

            // Previous 2
            if (this.songs.get(this.queueIndex - 2)) {
                desc += `${this.queueIndex - 2}. ${this.songs.get(this.queueIndex - 2)}\n`;
            }
            // Previous 1
            if (prevSong) {
                desc += `${this.queueIndex - 1}. ${this.songs.get(this.queueIndex - 1)}\n`;
            }
            // Current
            desc += `**${this.queueIndex}. ${currentSong}**`;
            // Next 1
            if (nextSong) {
                desc += `${this.queueIndex + 1}. ${this.songs.get(this.queueIndex + 1)}\n`;
            }
            // Next 2
            if (this.songs.get(this.queueIndex + 2)) {
                desc += `${this.queueIndex + 2}. ${this.songs.get(this.queueIndex + 2)}\n`;
            }
        }

        const footerText = currentSong
            ? `Song ${this.queueIndex} of ${this.songs.size}`
            : `No song in playlist`;

        return new EmbedBuilder()
            .setColor('#54007f')
            .setTitle('Play songs from YouTube')
            .setDescription(desc)
            .setFooter({ text: footerText });
    }

    createComponents() {
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_song')
                    .setLabel('Add Song')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('song_list')
                    .setLabel('List')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('toggle_loop')
                    .setLabel(this.isLooping ? 'Disable Loop' : 'Loop')
                    .setStyle(this.isLooping ? ButtonStyle.Danger : ButtonStyle.Secondary), // Visual feedback
                new ButtonBuilder()
                    .setCustomId('quit')
                    .setLabel('Quit')
                    .setStyle(ButtonStyle.Danger)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(this.queueIndex <= 1),
                new ButtonBuilder()
                    .setCustomId('rewind')
                    .setLabel('Rewind')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('pause_resume')
                    .setLabel(
                        this.audioPlayer.state.status === AudioPlayerStatus.Playing ||
                            this.audioPlayer.state.status === AudioPlayerStatus.Buffering
                            ? 'Pause' : 'Resume'
                    )
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
            );

        // Only show row2 if there are songs
        if (this.songs.size > 0) {
            return [row1, row2];
        }
        return [row1];
    }
}

// --- Helper Functions ---

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
        return info.videoDetails.title;
    } catch (error) {
        console.error('Error fetching title:', error.message);
        return `YouTube Video ${await getYouTubeId(url)}`;
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
        const embed = session.createEmbed();
        const components = session.createComponents();

        // Delete old message if exists
        if (session.message) {
            try {
                await session.message.delete();
            } catch (e) { /* ignore deletion error */ }
            session.message = null;
        }

        const response = await interaction.reply({ embeds: [embed], components: components, withResponse: true });
        session.message = response.resource ? response.resource.message : await interaction.fetchReply();

        // 4. Start Collector Setup (if not already running)
        // We need to manage the collector. If we just created the session, start it.
        // If it exists but we sent a new message, we might need to recreate collector bound to new message OR just keep using the channel collector.
        // The original code used a channel collector.

        if (session.collector) session.collector.stop("renewed");

        session.collector = interaction.channel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 3600_000 // 1 hour idle timeout (can be longer)
        });

        session.collector.on('collect', async (i) => {
            if (i.member.voice.channelId !== session.voiceChannelId) {
                return i.reply({ content: "Join the voice channel to use controls!", ephemeral: true });
            }

            try {
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
                        session.songs.forEach((title, idx) => {
                            list += `${idx}. ${title}\n`;
                        });
                        if (!list) list = "Playlist is empty.";
                        // truncate if too long
                        if (list.length > 1900) list = list.substring(0, 1900) + "...";

                        await i.reply({ content: `**Playlist**:\n${list}`, ephemeral: true });
                        break;

                    case 'toggle_loop':
                        session.isLooping = !session.isLooping;
                        await i.deferUpdate();
                        await session.updateEmbed();
                        break;

                    case 'previous':
                        if (session.queueIndex > 1) {
                            session.queueIndex--;
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
                        await i.update({ content: "Disconnected.", embeds: [], components: [] });
                        break;
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
                    session.message.edit({ content: "Session timed out.", components: [] }).catch(() => { });
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

        try {
            // 1. Get Info Validation
            const videoId = await getYouTubeId(url);
            if (!videoId) throw new Error("Invalid YouTube URL");

            const titlePromise = getYouTubeTitle(url); // Start fetching title

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

            const title = await titlePromise;

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
