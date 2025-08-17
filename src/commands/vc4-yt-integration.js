const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, SelectMenuBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytdl = require('ytdl-core');
const path = require('path');
require('dotenv').config();

const songs = new Map();
const queue = new Map();
const activeCollectors = new Map();
const disabledCollectors = new Map();
const guildPlayers = new Map();
const guildConnections = new Map();
const guildChannels = new Map();
const msgs = new Map();
const loops = new Map();
const modals = new Map();
const stackFix = new Map();
const titleToId = new Map();


module.exports = {
    cooldown: 1,
data: new SlashCommandBuilder()
.setName('playyt')
.setDescription('songs from yt with links'),

async execute(interaction) {
    
    async function updateEmbed() {
        let msg = msgs.get(interaction.guild.id);
        if (loops.get(interaction.guild.id)) {  
            var loop = "Disable Loop";
            var style = ButtonStyle.Danger;           
        } else {
            var loop = "Loop";
            var style = ButtonStyle.Primary;
        }
        if (!songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)) {
            var desc = `No song is currently playing.`
            var footer = `No song in playlist`;
            var row = new ActionRowBuilder() // var eklendi
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_modal${stackFix.get(interaction.guild.id)}`)
                    .setLabel('Choose a song')
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`loop`)
                    .setLabel(loop)
                    .setStyle(style)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`quit`)
                    .setLabel('Quit')
                    .setStyle(ButtonStyle.Danger)
            )
        } else {
            desc = (`Loop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}\nSong list:\n
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 2}`) && !songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`) ? `${queue.get(interaction.guild.id) - 2}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 2}`)}\n` : ''}\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`) ? `${queue.get(interaction.guild.id) - 1}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`)}\n` : ''}\
**${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`) ? `${queue.get(interaction.guild.id)}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\n` : ''}**\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`) ? `${queue.get(interaction.guild.id) + 1}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)}\n` : ''}\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 2}`) && !songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`) ? `${queue.get(interaction.guild.id) + 2}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 2}`)}` : ''}
            `);
            
            const gs = Array.from(songs.keys()).filter(key => key.startsWith(`${interaction.guild.id}-`));
            footer = `Song ${queue.get(interaction.guild.id)} of ${gs.length}`
            var row = new ActionRowBuilder() // var eklendi
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_modal${stackFix.get(interaction.guild.id)}`)
                    .setLabel('Choose a song')
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`songlist`)
                    .setLabel("Song List")
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`loop`)
                    .setLabel(loop)
                    .setStyle(style)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`quit`)
                    .setLabel('Quit')
                    .setStyle(ButtonStyle.Danger)
            )
            
            var row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`previous`)
                    .setLabel("Previous")
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`rewind`)
                    .setLabel("Rewind")
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`skip`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
            )

        }
 
        
        var embed = new EmbedBuilder()  // var eklendi
            .setColor('#54007f')
            .setTitle('Play songs from YouTube')
            .setDescription(desc)
            .setFooter({ text: `${footer}` });	     
        
        if (!songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`) && !disabledCollectors.get(interaction.guild.id)){
        await msg.edit({ embeds: [embed], components: [row] });
        } else if (songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`) && !disabledCollectors.get(interaction.guild.id)){
        await msg.edit({ embeds: [embed], components: [row, row2] });
        } else {
        await msg.edit({ content: '**Collector timed out. Use /playyt to refresh the collector.**', embeds: [embed], components: [], fetchReply: true }); 
        }
        
    }

    async function deleteQueue() {
        for (let i = 1; i; i++) {
            if (!songs.get(`${interaction.guild.id}-${i}`)) {
                break;
            } else {
                songs.delete(`${interaction.guild.id}-${i}`);
                titleToId.delete(`${interaction.guild.id}-${i}`); // Mapping'i de temizle
            }
        }
        console.log("queue deleted")
    }
    
    async function getYouTubeTitle(videoUrl) {
        try {
            console.log('Video başlığı alınıyor (indirme yok):', videoUrl);
            const info = await ytdl.getBasicInfo(videoUrl);
            const title = info.videoDetails.title;
            console.log('Başlık alındı:', title);
            return title;
        } catch (error) {
            console.log('Başlık alınamadı, varsayılan isim kullanılacak:', error.message);
            
            return `YouTube Video ${await onlyId(videoUrl)}`;
        }
    }

    async function onlyId(videoUrl) {
        try {
            let videoId;
            if (videoUrl.includes('youtu.be/')) {
                videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
            } else if (videoUrl.includes('youtube.com/watch')) {
                videoId = videoUrl.split('v=')[1].split('&')[0];
            } else {
                return reject(new Error('Geçersiz YouTube URL formatı'));
            }
            return videoId;
        } catch (error) {
            console.log('Video ID alınamadı:', error.message);
            return null;
        }
    }
    
    async function ytFetch(videoUrl, modalInteraction){
        return new Promise(async (resolve, reject) => {
            try {
                // URL'yi temizle - video ID çıkar
                let videoId = await onlyId(videoUrl);

                // Temiz URL oluştur
                const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
                console.log('YouTube videosu işleniyor:', cleanUrl);
                
                // Önce başlığı al (hızlı)
                const videoTitle = await getYouTubeTitle(cleanUrl);

                // Eğer dosya zaten varsa, başlık ile birlikte döndür
                if (fs.existsSync(`src/ytsongs/${videoId}.opus`)) {
                    console.log('Video zaten indirilmiş:', videoId);
                    return resolve({ filePath: `src/ytsongs/${videoId}.opus`, videoId: videoId, videoTitle: videoTitle, isFile: true });
                }


                // ytsongs klasörü oluştur
                const ytsongsPath = path.join(__dirname, '../ytsongs');
                if (!fs.existsSync(ytsongsPath)) {
                    fs.mkdirSync(ytsongsPath, { recursive: true });
                    console.log('ytsongs klasörü oluşturuldu');
                }
                
                // yt-dlp kullanarak video indir
                const ytDlp = new YTDlpWrap();
                console.log('yt-dlp ile indiriliyor...');
                
                const fileName = `${videoId}.%(ext)s`;
                const outputTemplate = path.join(ytsongsPath, fileName);
                
                // Video'yu indir - sadece ses, en düşük kalite
                await ytDlp.execPromise([
                    cleanUrl,
                    '-f', 'bestaudio/best',
                    '-o', outputTemplate,
                    '--extract-audio',
                    '--audio-format', 'best',
                    '--audio-quality', '96K'
                ]);
                
                // İndirilen dosyayı bul
                const possibleFiles = [
                    path.join(ytsongsPath, `${videoId}.webm`),
                    path.join(ytsongsPath, `${videoId}.mp4`),
                    path.join(ytsongsPath, `${videoId}.m4a`),
                    path.join(ytsongsPath, `${videoId}.opus`)
                ];
                
                let downloadedFile = null;
                for (const file of possibleFiles) {
                    if (fs.existsSync(file)) {
                        downloadedFile = file;
                        break;
                    }
                }
                
                if (!downloadedFile) {
                    // Klasördeki en yeni dosyayı bul
                    const files = fs.readdirSync(ytsongsPath)
                        .filter(file => file.startsWith(videoId))
                        .map(file => path.join(ytsongsPath, file));
                    
                    if (files.length > 0) {
                        downloadedFile = files[0];
                    }
                }
                
                if (!downloadedFile || !fs.existsSync(downloadedFile)) {
                    throw new Error('İndirilen dosya bulunamadı');
                }
                
                console.log('İndirme tamamlandı:', path.basename(downloadedFile));

                await modalInteraction.editReply({ content: `Finished downloading "${videoTitle}".` });

                setTimeout(async () => {
                try {
                    await modalInteraction.deleteReply();
                } catch (error) {
                    console.log('Reply already deleted or expired');
                }
                }, 3000);

                resolve({
                    filePath: downloadedFile,
                    videoId: videoId,
                    videoTitle: videoTitle,
                    isFile: true
                });
                
            } catch (error) {
                console.error('yt-dlp indirme hatası:', error);
                
                // Kullanıcı dostu hata mesajları
                let errorMessage = error.message;
                if (errorMessage.includes('Video unavailable')) {
                    errorMessage = 'Video mevcut değil veya kaldırılmış';
                } else if (errorMessage.includes('Private video')) {
                    errorMessage = 'Bu video özel, erişim yok';
                } else if (errorMessage.includes('Sign in to confirm')) {
                    errorMessage = 'Bu video yaş sınırı nedeniyle indirilemez';
                } else if (errorMessage.includes('No video formats found')) {
                    errorMessage = 'Video formatı bulunamadı';
                }
                
                reject(new Error(errorMessage));
            }
        });
    }

    (async () => {
        try {
    member = await interaction.guild.members.fetch(interaction.user.id);
    channel = member.voice.channel;

    if (!channel) {
        interaction.reply({ content: 'You must be in a voice channel to use this command.', ephemeral: true });
        return;
    } else if (channel !== guildChannels.get(interaction.guild.id) && guildConnections.has(interaction.guild.id)) {
        interaction.reply({ content: 'You must be in the same voice channel with me to use this command.', ephemeral: true });
        return;
    }

    if (activeCollectors.has(interaction.guild.id)) {
        const oldCollector = activeCollectors.get(interaction.guild.id);
        oldCollector.stop();
        activeCollectors.delete(interaction.guild.id);
    }
    
    if (msgs.has(interaction.guild.id)) {
        const oldMsg = msgs.get(interaction.guild.id);
        oldMsg.delete();
        msgs.delete(interaction.guild.id);
        disabledCollectors.set(interaction.guild.id, false);
    }


        if (!guildPlayers.has(interaction.guild.id)) {
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            player = createAudioPlayer();
            guildPlayers.set(interaction.guild.id, player);
            guildConnections.set(interaction.guild.id, connection);
            guildChannels.set(interaction.guild.id, channel);
            await connection.subscribe(player);
 
            guildPlayers.get(interaction.guild.id).on("stateChange", async (oldOne, newOne) => {
                console.log(oldOne.status, newOne.status, stackFix.get(interaction.guild.id));
                if (oldOne.status === "playing" && newOne.status === "idle") {
                    if (loops.get(interaction.guild.id)) {
                        queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
                    }

                    if (songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)) {
                        const nextSongKey = `${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`;
                        const videoId = titleToId.get(nextSongKey);
                        
                        // Bir sonraki şarkıyı çal - dosyadan
                        try {
                            const ytsongsPath = path.join(__dirname, '../ytsongs');
                            
                            // Farklı uzantılı dosyaları kontrol et
                            const possibleFiles = [
                                path.join(ytsongsPath, `${videoId}.webm`),
                                path.join(ytsongsPath, `${videoId}.mp4`),
                                path.join(ytsongsPath, `${videoId}.m4a`),
                                path.join(ytsongsPath, `${videoId}.opus`)
                            ];
                            
                            let filePath = null;
                            for (const file of possibleFiles) {
                                if (fs.existsSync(file)) {
                                    filePath = file;
                                    break;
                                }
                            }
                            
                            if (filePath) {
                                const resource = createAudioResource(filePath, {
                                    inlineVolume: true
                                });
                                guildPlayers.get(interaction.guild.id).play(resource);
                                queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);
                                updateEmbed();
                            } else {
                                // Dosya yoksa sonraki şarkıya geç
                                console.error('Next song file not found for video ID:', videoId);
                                queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 2);
                            }
                        } catch (error) {
                            console.error('Next song play error:', error);
                            // Hata durumunda sonraki şarkıya geç
                            queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 2);
                        }
                    } else {
                        guildPlayers.get(interaction.guild.id).stop();
                        queue.delete(interaction.guild.id);                                              
                        deleteQueue();
                        updateEmbed();
                    }                    
                }
            })        
        } 

    const time = Date.now();
    //console.log("time has been updated:", time);
    stackFix.set(interaction.guild.id, time);

    if (!songs.get(`${interaction.guild.id}-1`)) {
        var desc = `No song is currently playing.`
        var loop = "Loop";
        var style = ButtonStyle.Primary;
        var footer = { text: `No song in playlist` }; 
        var row = new ActionRowBuilder() // var eklendi
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`open_modal${time}`)
                .setLabel('Choose a song')
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`loop`)
                .setLabel(loop)
                .setStyle(style)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`quit`)
                .setLabel('Quit')
                .setStyle(ButtonStyle.Danger)
        )
    } else {
        desc = (`Loop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}\nSong list:\n
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 2}`) && !songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`) ? `${queue.get(interaction.guild.id) - 2}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 2}`)}\n` : ''}\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`) ? `${queue.get(interaction.guild.id) - 1}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`)}\n` : ''}\
**${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`) ? `${queue.get(interaction.guild.id)}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\n` : ''}**\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`) ? `${queue.get(interaction.guild.id) + 1}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)}\n` : ''}\
${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 2}`) && !songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) - 1}`) ? `${queue.get(interaction.guild.id) + 2}- ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 2}`)}` : ''}
        `);
        var footer = { text: `Song ${queue.get(interaction.guild.id)} of ${songs.size}` };
        if (loops.get(interaction.guild.id)) {
            var loop = "Disable Loop";
            var style = ButtonStyle.Danger;            
        } else {
            var loop = "Loop";
            var style = ButtonStyle.Primary;
        }
        var row = new ActionRowBuilder() // var eklendi
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`open_modal${time}`)
                .setLabel('Choose a song')
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`songlist`)
                .setLabel("Song List")
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`loop`)
                .setLabel(loop)
                .setStyle(style)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`quit`)
                .setLabel('Quit')
                .setStyle(ButtonStyle.Danger)
        )
        
        var row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`previous`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`rewind`)
                .setLabel("Rewind")
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`skip`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
        )

    }

    var embed = new EmbedBuilder() // var eklendi
        .setColor('#54007f')
        .setTitle('Play songs from YouTube')
        .setDescription(desc)
        .setFooter(footer);


    if (!songs.get(`${interaction.guild.id}-1`)){
        var msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        } else {
        var msg = await interaction.reply({ embeds: [embed], components: [row, row2], fetchReply: true });
    }   

    msgs.set(interaction.guild.id, msg);
    
    //console.log(activeCollectors.entries())
    const collector = interaction.channel.createMessageComponentCollector({ time: 600000 });
    //console.log(collector);
    activeCollectors.set(interaction.guild.id, collector);
    //console.log(activeCollectors.get(interaction.guild.id));
    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            msg.edit({ content: '**Collector timed out. Use /playyt to refresh the collector.**', components: [], fetchReply: true });
            interaction.followUp({ content: 'Collector timed out. You can call the command again by using /playyt', ephemeral: true });
        }
        activeCollectors.delete(interaction.guild.id);
        disabledCollectors.set(interaction.guild.id, true);
    });
    
    collector.on('collect', async (buttonInteraction) => {
        if (!buttonInteraction.member.voice.channel) return buttonInteraction.reply({ content: 'You need to be in a voice channel to use this command.', ephemeral: true });
        if (buttonInteraction.member.voice.channel !== guildChannels.get(interaction.guild.id) && guildConnections.has(interaction.guild.id)) return buttonInteraction.reply({ content: 'You must be in the same voice channel with me to use this command.', ephemeral: true });  
        if (buttonInteraction.customId === `open_modal${time}`) {
            //console.log("open modalsaas")

            const uniqueModalId = `input_modal_${time}`;

            const modal = new ModalBuilder()
                .setCustomId(uniqueModalId)
                .setTitle('Add YouTube Video');

            const textInput = new TextInputBuilder()
                .setCustomId('user_input')
                .setLabel('YouTube URL')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter YouTube video URL (e.g., https://youtube.com/watch?v=...)')
                .setRequired(true);

            const modalRow = new ActionRowBuilder().addComponents(textInput);
            modal.addComponents(modalRow);

            modals.set(interaction.guild.id, modal);
            await buttonInteraction.showModal(modals.get(interaction.guild.id));

        } else if(buttonInteraction.customId === `songlist`){
            // Guild'e ait şarkıları filtrele - numara + isim
            let songList = Array.from(songs.entries())
                .filter(([key, value]) => key.startsWith(`${interaction.guild.id}-`))
                .map(([key, value], index) => `${index + 1}. ${value}`) // Sadece numara ve isim
                .join('\n');

            buttonInteraction.reply({ 
                content: `**🎵 Playlist:**\n\n${songList}`, 
                ephemeral: true 
            });

        } else if (buttonInteraction.customId === `rewind`){

            buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            if (!loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);     
            } 
            //updateEmbed();

        } else if (buttonInteraction.customId === `previous`) {
            buttonInteraction.deferUpdate(); // Discord'a yanıt ver

            guildPlayers.get(interaction.guild.id).stop();
            if (!loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 2);
            } else {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
            }
            //updateEmbed();

        } else if (buttonInteraction.customId === `loop`) {
            buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            if (loops.get(interaction.guild.id)) {
                loops.delete(interaction.guild.id);  
            } else {
                loops.set(interaction.guild.id, true);
            }

            updateEmbed();

        } else if (buttonInteraction.customId === `skip`) {
            buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            if (loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);     
            }
            updateEmbed();
        }
        
        else if (buttonInteraction.customId === `quit`) {
            buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            guildConnections.get(interaction.guild.id).destroy();
            guildChannels.delete(interaction.guild.id);
            guildPlayers.delete(interaction.guild.id);
            guildConnections.delete(interaction.guild.id);
            loops.set(interaction.guild.id, false);
            collector.stop("quit");

            deleteQueue();
            modals.delete(interaction.guild.id);
            
            // Geçici dosyaları temizle (base.js dosyaları)
            try {
                const fs = require('fs');
                const files = fs.readdirSync('./');
                files.filter(file => file.endsWith('-base.js')).forEach(file => {
                    fs.unlinkSync(file);
                    console.log('Temizlendi:', file);
                });
            } catch (e) {
                // Temizlik hatası önemli değil
                console.log('Temizlik hatası (önemsiz):', e.message);
            }
            
            return interaction.editReply({ content: 'Disconnected from the voice channel.', embeds: [], components: [] });
        }
    });


    //modal interaction - DEBUG ve düzeltme
    const modalHandler = async (modalInteraction) => {
        console.log('Modal interaction received:', modalInteraction.customId, modalInteraction.user.id);
        
        if (!modalInteraction.isModalSubmit()) {
            console.log('Not a modal submit');
            return;
        }
        
        if (!modalInteraction.customId.startsWith(`input_modal_${time}`)) {
            console.log('Modal ID mismatch:', modalInteraction.customId, `input_modal_${time}`);
            return;
        }
        
        if (modalInteraction.user.id !== interaction.user.id) {
            console.log('User ID mismatch');
            //return;
        }
    
        console.log('Modal validation  passed, processing...');
        
        const userInput = modalInteraction.fields.getTextInputValue('user_input');
        const guildId = modalInteraction.guildId;
        
        console.log('User input (YouTube URL):', userInput);
        
        // YouTube URL'sinin geçerli olup olmadığını kontrol et
        if (!userInput.includes('youtube.com/watch') && !userInput.includes('youtu.be/')) {
            console.log('Invalid YouTube URL:', userInput);
            
            return modalInteraction.reply({ 
                content: `"${userInput}" geçerli bir YouTube URL'si değil. Lütfen YouTube video linkini girin.`, 
                ephemeral: true 
            });
        }

        // Modal'ı kapat - Discord'a response gönder
            modalInteraction.deferReply({ ephemeral: true, fetchReply: true });
          
            // 1.3 saniye bekle
            setTimeout(async () => {
                try {
                    if (!fs.existsSync(`src/ytsongs/${await onlyId(userInput)}.opus`)) {
                        await modalInteraction.editReply({ content: `I couldn't find "${await getYouTubeTitle(userInput)}" in my database. *Wait a moment while I download it.*` });
                    } else {
                        await modalInteraction.deleteReply();
                    }
                } catch (error) {
                    console.log('Reply already deleted or expired');
                }
            }, 1300);
            
            modals.delete(modalInteraction.user.id);
            

        
        try {
            // YouTube'dan indir
            const downloadResult = await ytFetch(userInput, modalInteraction);
            
            // Video ID'sini al
            const videoId = downloadResult.videoId;
            let videoTitle = downloadResult.videoTitle;
            
            // Video başlığı kontrolü - undefined, null, boş string kontrolü
            if (!videoTitle || videoTitle.trim() === '' || videoTitle === 'undefined') {
                videoTitle = `YouTube Video ${videoId}`;
                console.log('Video title was empty/undefined, using fallback:', videoTitle);
            } else {
                // Başlığı temizle - özel karakterleri kaldır
                videoTitle = videoTitle.trim().replace(/[^\w\s-]/g, '').substring(0, 100);
                if (videoTitle === '') {
                    videoTitle = `YouTube Video ${videoId}`;
                }
            }
            
            console.log('Final video title:', videoTitle);
            
            // Playlist'e ekle - başlık kullan, video ID mapping
            let loop = 1;
            while (songs.get(`${guildId}-${loop}`)) {
                loop++;
            }
            
            songs.set(`${guildId}-${loop}`, videoTitle); // Şarkı adını göster
            titleToId.set(`${guildId}-${loop}`, videoId); // Başlık -> ID mapping
            console.log(`Added YouTube download: ${videoTitle} (${videoId})`);
            
            const player = guildPlayers.get(guildId);
            if (!player) return;
            
            // Eğer müzik çalmıyorsa başlat - dosyadan çal
            if (player.state.status === "idle") {
                const resource = createAudioResource(downloadResult.filePath, {
                    inlineVolume: true,
                    metadata: {
                        title: videoTitle,
                        url: `https://www.youtube.com/watch?v=${videoId}`
                    }
                });
                
                // Player error handling - removeAllListeners to avoid duplicates
                player.removeAllListeners('error');
                player.on('error', (error) => {
                    console.error('Audio player error:', error.message);
                    modalInteraction.followUp({ 
                        content: `❌ Dosya çalınamadı: ${error.message}`,
                        ephemeral: true 
                    }).catch(console.error);
                });
                
                player.play(resource);
                queue.set(guildId, loop);
            }
            
            updateEmbed();
            
            

            
        } catch (error) {
            console.error('YouTube processing error:', error);
            
            // Friendly error message
            let errorMessage = error.message;
            if (errorMessage.startsWith('Error: ')) {
                errorMessage = errorMessage.replace('Error: ', '');
            }
            
            // Add emoji if not present
            if (!errorMessage.startsWith('❌')) {
                errorMessage = `❌ ${errorMessage}`;
            }
            
            await modalInteraction.followUp({ 
                content: errorMessage, 
                ephemeral: true 
            }).catch(console.error);
            
            // Modal'ı kapat
            modals.delete(modalInteraction.user.id);
        }
        
        // Handler'ı temizle - Memory leak önle
        //interaction.client.off('interactionCreate', modalHandler);
    };

    // ON kullan ama manuel cleanup ile
    interaction.client.on('interactionCreate', modalHandler);
    
    // Collector bittiğinde modal handler'ı da temizle
    collector.on('end', () => {
        //interaction.client.off('interactionCreate', modalHandler);
        console.log('Collector ended, modal handler cleaned up');
    });

        } catch(error){
            console.log(error);
            interaction.reply({ content: 'An error occurred while executing the command.1'});
        }
    })();      
}}