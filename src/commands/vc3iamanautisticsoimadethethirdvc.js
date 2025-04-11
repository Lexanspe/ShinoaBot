const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, SelectMenuBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');


const songs = new Map();
const queue = new Map();
const activeCollectors = new Map();
const guildPlayers = new Map();



module.exports = {
    cooldown: 1,
data: new SlashCommandBuilder()
.setName('idunno'),



async execute(interaction) {
    if (activeCollectors.has(interaction.guild.id)) {
        const oldCollector = activeCollectors.get(interaction.guild.id);
        oldCollector.stop();
    }

    member = await interaction.guild.members.fetch(interaction.user.id);
    channel = member.voice.channel;
    player = createAudioPlayer();

    if (channel) {
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await connection.subscribe(player);
        
        

        player.on("stateChange", (oldOne, newOne) => {
            console.log(oldOne.status, newOne.status);
            if (oldOne.status === "playing" && newOne.status === "idle") {

                if (songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)) {
                    resource = createAudioResource(`./songs/${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id) + 1}`)}.mp3`);
                    player.play(resource);
                    queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);
                } else {
                    player.stop();
                    queue.delete(interaction.guild.id);              
                
                    for (let i = 1; i; i++) {
                        if (!songs.get(`${interaction.guild.id}-${i}`)) {
                            break;
                        } else {
                            songs.delete(`${interaction.guild.id}-${i}`);
                        }
                    }
                    console.log("queue deleted")
                }
                
                console.log(queue.get(interaction.guild.id))

                return;
            }
        })        
    }  


   

    embed = new EmbedBuilder()
    .setColor('#54007f')
    .setTitle('idunno')
    .setDescription("idunno")

    const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId(`open_modal`)
            .setLabel('Choose a song')
            .setStyle(ButtonStyle.Primary)
    );


    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    //button interaction
    const filter = (i) => i.customId === `open_modal` && i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });

    activeCollectors.set(interaction.guild.id, collector);
    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.followUp({ content: 'Collector timed out. You can call the command again by using /idunno', ephemeral: true });

        }
    });

    //creating the modal
    collector.on('collect', async (buttonInteraction) => {
        const modal = new ModalBuilder()
            .setCustomId(`input_modal`)
            .setTitle('Choose a song');

        const textInput = new TextInputBuilder()
            .setCustomId(`user_input`)
            .setLabel('Your choice')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Type something here...')
            .setRequired(true);

        const modalRow = new ActionRowBuilder().addComponents(textInput);
        modal.addComponents(modalRow);

        await buttonInteraction.showModal(modal);
    });

    //modal interaction
    if (!guildPlayers.has(interaction.guild.id)) { 
        interaction.client.on('interactionCreate', async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit() || modalInteraction.customId !== `input_modal`) return;
            const userInput = modalInteraction.fields.getTextInputValue(`user_input`);
            console.log(userInput)
            if (!fs.existsSync(`./songs/${userInput}.mp3`)) {
                    return interaction.followUp({
                        content: `"${userInput}" mevcut değil.`,
                        ephemeral: true,
                    });
                }      
            let loop = 1;
            while (songs.get(`${interaction.guild.id}-${loop}`)) {
                loop++;
            }
            songs.set(`${interaction.guild.id}-${loop}`, userInput);
            if (player.state.status === "idle") {
                resource = createAudioResource(`./songs/${userInput}.mp3`);
                player.play(resource);
                queue.set(interaction.guild.id, 1);
            }
            guildPlayers.set(interaction.guild.id, player);   
        });
    }

    interaction.client.on('interactionCreate', async (modalInteraction) => {
        if (!modalInteraction.isModalSubmit() || modalInteraction.customId !== `input_modal`) return;
        const userInput = modalInteraction.fields.getTextInputValue(`user_input`);    
        embed = new EmbedBuilder()
        .setColor('#54007f')
        .setTitle('idunno')
        .setDescription(`Playing: ${userInput}`)
        .setFooter({ text: `Song ${queue.get(interaction.guild.id)} of ${songs.size}` });

        await msg.edit({ embeds: [embed], components: [row] });
    });

}}