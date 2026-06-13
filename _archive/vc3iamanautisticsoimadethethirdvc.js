const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, SelectMenuBuilder, ContainerBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');

const songs = new Map();
const queue = new Map();
const activeCollectors = new Map();
const guildPlayers = new Map();
const guildConnections = new Map();
const msgs = new Map();
const loops = new Map();
const modals = new Map();
const stackFix = new Map();


module.exports = {
    cooldown: 1,
data: new SlashCommandBuilder()
.setName('idunno')
.setDescription('ses işte ya'),

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
            .setTitle('idunno')
            .setDescription(desc)
            .setFooter({ text: `${footer}` });	     
        
        if (!songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)){
        await msg.edit({ embeds: [embed], components: [row] });
        } else {
        await msg.edit({ embeds: [embed], components: [row, row2] });
        }    
        
    }

    async function deleteQueue() {
        for (let i = 1; i; i++) {
            if (!songs.get(`${interaction.guild.id}-${i}`)) {
                break;
            } else {
                songs.delete(`${interaction.guild.id}-${i}`);
            }
        }
        console.log("queue deleted")
    }
    
    (async () => {
        try {

    if (activeCollectors.has(interaction.guild.id)) {
        const oldCollector = activeCollectors.get(interaction.guild.id);
        oldCollector.stop();
        activeCollectors.delete(interaction.guild.id);
    }
    
    if (msgs.has(interaction.guild.id)) {
        const oldMsg = msgs.get(interaction.guild.id);
        oldMsg.delete();
        msgs.delete(interaction.guild.id);
    }

    member = await interaction.guild.members.fetch(interaction.user.id);
    channel = member.voice.channel;

    if (channel) {
        
        if (!guildPlayers.has(interaction.guild.id)) {
            console.log('Creating voice connection...');
            
            try {
                // Force encryption mode compatibility
                process.env.FFMPEG_PATH = '';  // Clear any ffmpeg path issues
                
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                    debug: false,
                    selfDeaf: true,
                    selfMute: false,
                });
                
                console.log('Voice connection created, waiting for ready...');
                
                // Connection durumunu dinle
                connection.on(VoiceConnectionStatus.Ready, () => {
                    console.log('Voice connection is ready!');
                });
                
                connection.on(VoiceConnectionStatus.Destroyed, () => {
                    console.log('Voice connection destroyed');
                });
                
                connection.on('error', (error) => {
                    console.error('Voice connection error:', error);
                    return interaction.followUp({ content: `Ses hatası: ${error.message}`, ephemeral: true });
                });
                
                player = createAudioPlayer({
                    debug: false,
                    behaviors: {
                        noSubscriber: 'pause',
                        maxMissedFrames: Math.round(5000 / 20),
                    }
                });
                
                guildPlayers.set(interaction.guild.id, player);
                guildConnections.set(interaction.guild.id, connection);
                
                const subscription = connection.subscribe(player);
                console.log('Player subscribed to connection');
 
                guildPlayers.get(interaction.guild.id).on("stateChange", (oldOne, newOne) => {
                    console.log('Player state change:', oldOne.status, '->', newOne.status, stackFix.get(interaction.guild.id));
                    if (oldOne.status === AudioPlayerStatus.Playing && newOne.status === AudioPlayerStatus.Idle) {
                        if (loops.get(interaction.guild.id)) {
                            queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
                        }

                        if (songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)) {
                            resource = createAudioResource(`src/songs/${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)}.mp3`, {
                                inlineVolume: true,
                            });
                            guildPlayers.get(interaction.guild.id).play(resource);
                            queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);
                            updateEmbed();
                        } else {
                            guildPlayers.get(interaction.guild.id).stop();
                            queue.delete(interaction.guild.id);                                              
                            deleteQueue();
                            updateEmbed();
                        }                    
                    }
                });
                
                // Voice connection timeout
                setTimeout(() => {
                    if (connection.state.status !== VoiceConnectionStatus.Ready) {
                        console.log('Voice connection timeout');
                        connection.destroy();
                        return interaction.followUp({ content: 'Ses bağlantısı zaman aşımına uğradı.', ephemeral: true });
                    }
                }, 15000);
                
            } catch (error) {
                console.error('Error creating voice connection:', error);
                return interaction.followUp({ content: `Ses kanalına bağlanırken hata: ${error.message}`, ephemeral: true });
            }
        } 
    } else {
        return interaction.reply({ content: 'You need to be in a voice channel to use this command.', ephemeral: true });
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
        .setTitle('idunno')
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
            interaction.followUp({ content: 'Collector timed out. You can call the command again by using /idunno', ephemeral: true });
        }
        activeCollectors.delete(interaction.guild.id);
    });
    
    collector.on('collect', async (buttonInteraction) => {
        if (!buttonInteraction.member.voice.channel) return buttonInteraction.reply({ content: 'You need to be in a voice channel to use this command.', ephemeral: true });
        
        if (buttonInteraction.customId === `open_modal${time}`) {
            const uniqueModalId = `input_modal_${time}`;

            const modal = new ModalBuilder()
                .setCustomId(uniqueModalId)
                .setTitle('Choose a song');

            const textInput = new TextInputBuilder()
                .setCustomId('user_input')
                .setLabel('Your choice')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the name of the song.')
                .setRequired(true);

            const modalRow = new ActionRowBuilder().addComponents(textInput);
            modal.addComponents(modalRow);

            try {
                await buttonInteraction.showModal(modal);

                // Modal cevabını bekleme
                const modalSubmission = await buttonInteraction.awaitModalSubmit({
                    filter: (modalInteraction) => modalInteraction.customId === uniqueModalId && modalInteraction.user.id === interaction.user.id,
                    time: 60000
                });

                const userInput = modalSubmission.fields.getTextInputValue('user_input');
                const guildId = modalSubmission.guildId;
                const filePath = `src/songs/${userInput}.mp3`;

                if (!fs.existsSync(filePath)) {
                    return await modalSubmission.reply({ content: `"${userInput}" mevcut değil.`, ephemeral: true });
                }

                // Modal'ı sessizce kapat
                await modalSubmission.deferUpdate();

                let loop = 1;
                while (songs.get(`${guildId}-${loop}`)) {
                    loop++;
                }

                songs.set(`${guildId}-${loop}`, userInput);
                console.log(`Added song: ${songs.get(`${guildId}-${loop}`)}`);

                const player = guildPlayers.get(guildId);
                if (player && player.state.status === AudioPlayerStatus.Idle) {
                    const resource = createAudioResource(filePath, {
                        inlineVolume: true,
                    });
                    player.play(resource);
                    queue.set(guildId, 1);
                }

                updateEmbed();
            } catch (error) {
                console.log('Modal error:', error.message);
                // Eğer modal timeout olursa veya hata varsa, buttonInteraction'ı da handle etmeye gerek yok
                // Çünkü zaten showModal() çağrısı ile acknowledge edildi
            }

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
            await buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            if (!loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);     
            } 
            //updateEmbed();

        } else if (buttonInteraction.customId === `previous`) {
            await buttonInteraction.deferUpdate(); // Discord'a yanıt ver

            guildPlayers.get(interaction.guild.id).stop();
            if (!loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 2);
            } else {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
            }
            //updateEmbed();

        } else if (buttonInteraction.customId === `loop`) {
            await buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            if (loops.get(interaction.guild.id)) {
                loops.delete(interaction.guild.id);  
            } else {
                loops.set(interaction.guild.id, true);
            }

            updateEmbed();

        } else if (buttonInteraction.customId === `skip`) {
            await buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            if (loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);     
            }
            updateEmbed();
        }
        
        else if (buttonInteraction.customId === `quit`) {
            await buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            guildConnections.get(interaction.guild.id).destroy();
            guildPlayers.delete(interaction.guild.id);
            guildConnections.delete(interaction.guild.id);
            loops.set(interaction.guild.id, false);
            collector.stop("quit");

            deleteQueue();
            modals.delete(interaction.guild.id);
            return interaction.editReply({ content: 'Disconnected from the voice channel.', embeds: [], components: [] });
        }
    });


        } catch(error){
            console.log(error);
            interaction.reply({ content: 'An error occurred while executing the command.1'});
        }
    })();      
}}