const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, SelectMenuBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
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
            desc = (`Playing: ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\nLoop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}`);
            const guildSongs = Array.from(songs.keys()).filter(key => key.startsWith(`${interaction.guild.id}-`));
            footer = `Song ${queue.get(interaction.guild.id)} of ${guildSongs.length}`
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
                    .setCustomId(`skip`)
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Primary)
            ).addComponents(
                new ButtonBuilder()
                    .setCustomId(`quit`)
                    .setLabel('Quit')
                    .setStyle(ButtonStyle.Danger)
            )
        }
 
        
        var embed = new EmbedBuilder()  // var eklendi
            .setColor('#54007f')
            .setTitle('idunno')
            .setDescription(desc)
            .setFooter({ text: `${footer}` });	
        await msg.edit({ embeds: [embed], components: [row] });        
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
            connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });
            player = createAudioPlayer();
            guildPlayers.set(interaction.guild.id, player);
            guildConnections.set(interaction.guild.id, connection);
            await connection.subscribe(player);
 
            guildPlayers.get(interaction.guild.id).on("stateChange", (oldOne, newOne) => {
                console.log(oldOne.status, newOne.status, stackFix.get(interaction.guild.id));
                if (oldOne.status === "playing" && newOne.status === "idle") {
                    if (loops.get(interaction.guild.id)) {
                        queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
                    }

                    if (songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)) {
                        resource = createAudioResource(`src/songs/${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)}.mp3`);
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
            })        
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
        var desc = `Playing: ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\nLoop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}`
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
                .setCustomId(`loop`)
                .setLabel(loop)
                .setStyle(style)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`skip`)
                .setLabel('Skip')
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`quit`)
                .setLabel('Quit')
                .setStyle(ButtonStyle.Danger)
        )

    }
    var embed = new EmbedBuilder() // var eklendi
        .setColor('#54007f')
        .setTitle('idunno')
        .setDescription(desc)
        .setFooter(footer);
    
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
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
            //console.log("open modalsaas")

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

            modals.set(interaction.guild.id, modal);
            await buttonInteraction.showModal(modals.get(interaction.guild.id));
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
        } else if (buttonInteraction.customId === `quit`) {
            buttonInteraction.deferUpdate(); // Discord'a yanıt ver
            
            guildPlayers.get(interaction.guild.id).stop();
            guildConnections.get(interaction.guild.id).destroy();
            guildPlayers.delete(interaction.guild.id);
            guildConnections.delete(interaction.guild.id);
            collector.stop("quit");
            deleteQueue();
            modals.delete(interaction.guild.id);
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
            return;
        }
    
        console.log('Modal validation passed, processing...');
        
        const userInput = modalInteraction.fields.getTextInputValue('user_input');
        const guildId = modalInteraction.guildId;
        const filePath = `src/songs/${userInput}.mp3`;
        
        console.log('User input:', userInput);
        console.log('File path:', filePath);
    
        if (!fs.existsSync(filePath)) {
            console.log('File not found:', filePath);
            return modalInteraction.reply({ content: `"${userInput}" mevcut değil.`, ephemeral: true });
        }
    
        let loop = 1;
        while (songs.get(`${guildId}-${loop}`)) {
            loop++;
        }
    
        songs.set(`${guildId}-${loop}`, userInput);
        console.log(`Added song: ${songs.get(`${guildId}-${loop}`)}`);
    
        const player = guildPlayers.get(guildId);
        if (!player) return;
    
        if (player.state.status === "idle") {
            const resource = createAudioResource(filePath);
            player.play(resource);
            queue.set(guildId, 1);
        }
    
        updateEmbed();
        modalInteraction.reply({ content: `"${userInput}" başarıyla eklendi!`, ephemeral: true });
        
        // Handler'ı temizle - Memory leak önle
        interaction.client.off('interactionCreate', modalHandler);
    };

    // ON kullan ama manuel cleanup ile
    interaction.client.on('interactionCreate', modalHandler);
    
    // Collector bittiğinde modal handler'ı da temizle
    collector.on('end', () => {
        interaction.client.off('interactionCreate', modalHandler);
        console.log('Collector ended, modal handler cleaned up');
    });

        } catch(error){
            console.log(error);
            interaction.reply({ content: 'An error occurred while executing the command.1'});
        }
    })();      
}}