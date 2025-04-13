const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, SelectMenuBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');


const songs = new Map();
const queue = new Map();
const activeCollectors = new Map();
const guildPlayers = new Map();
const msgs = new Map();
const loops = new Map();


module.exports = {
    cooldown: 1,
data: new SlashCommandBuilder()
.setName('idunno'),



async execute(interaction) {

    async function updateEmbed(loop, style, desc, footer, msg) {
        row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_modal`)
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
            )

        embed = new EmbedBuilder() 
            .setColor('#54007f')
            .setTitle('idunno')
            .setDescription(desc)
            .setFooter(footer);
        await msg.edit({ embeds: [embed], components: [row] });
        
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
        //oldMsg.delete();
        msgs.delete(interaction.guild.id);
    }

    if (!guildPlayers.has(interaction.guild.id)) {

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
                    if (loops.get(interaction.guild.id)) {
                        queue.set(interaction.guild.id, queue.get(interaction.guild.id) - 1);
                    }

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
                }
            })        
        } else {
            return interaction.reply({ content: 'You need to be in a voice channel to use this command.', ephemeral: true });
        }
    }

    
    if (!songs.get(`${interaction.guild.id}-1`)) {      
        var desc = `No song is currently playing.`
        var loop = "Loop";
        var style = ButtonStyle.Primary;
        var footer = { text: `No song in playlist` }; 
        row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`open_modal`)
                .setLabel('Choose a song')
                .setStyle(ButtonStyle.Primary)
        ).addComponents(
            new ButtonBuilder()
                .setCustomId(`loop`)
                .setLabel(loop)
                .setStyle(style)
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
        row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`open_modal`)
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
        )

    }
    embed = new EmbedBuilder()
        .setColor('#54007f')
        .setTitle('idunno')
        .setDescription(desc)
        .setFooter(footer);
    
    
    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    msgs.set(interaction.guild.id, msg);
    
    //console.log(activeCollectors.entries())

    //button interaction
    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });
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
        if (buttonInteraction.customId === `open_modal`) {
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
        } else if (buttonInteraction.customId === `loop`) {
            if (loops.get(interaction.guild.id)) {
                loops.delete(interaction.guild.id);
                var loop = "Loop";
                var style = ButtonStyle.Primary;     
            } else {
                loops.set(interaction.guild.id, true);
                var loop = "Disable Loop";
                var style = ButtonStyle.Danger;          
            }
            desc = (`Playing: ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\nLoop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}`);
            footer = { text: `Song ${queue.get(interaction.guild.id)} of ${songs.size}` };
            updateEmbed(loop, style, desc, footer, msg);

        } else if (buttonInteraction.customId === `skip`) {
            player.stop();
            if (loops.get(interaction.guild.id)) {
                queue.set(interaction.guild.id, queue.get(interaction.guild.id) + 1);     
                var loop = "Disable Loop";
                var style = ButtonStyle.Danger;           
            } else {
                var loop = "Loop";
                var style = ButtonStyle.Primary;
            }
            desc = (`Playing: ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\nLoop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}`);
            footer = { text: `Song ${queue.get(interaction.guild.id)} of ${songs.size}` };
            updateEmbed(loop, style, desc, footer, msg);
        }
    });

    //modal interaction
    if (!guildPlayers.has(interaction.guild.id)) { 
        interaction.client.on('interactionCreate', async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit() || modalInteraction.customId !== `input_modal`) return;
            guildPlayers.set(interaction.guild.id, player);
            const userInput = modalInteraction.fields.getTextInputValue(`user_input`);
            console.log(userInput)
            if (!fs.existsSync(`./songs/${userInput}.mp3`)) {
                return;          
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
            
        });
    }   

        interaction.client.on('interactionCreate', async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit() || modalInteraction.customId !== `input_modal`) return;
            if (modalInteraction.user.id !== interaction.user.id) return;
            const userInput = modalInteraction.fields.getTextInputValue(`user_input`);    
            if (!fs.existsSync(`./songs/${userInput}.mp3`)) {
                
                return interaction.followUp({
                    content: `"${userInput}" mevcut değil.`,
                    ephemeral: true,
                });
            }

            if (loops.get(interaction.guild.id)) {
                var loop = "Disable Loop";
                var style = ButtonStyle.Danger;           
            } else {
                var loop = "Loop";
                var style = ButtonStyle.Primary;
            }
            desc = (`Playing: ${songs.get(`${interaction.guild.id}-${queue.get(interaction.guild.id)}`)}\nLoop: ${loops.get(interaction.guild.id) ? 'enabled' : 'disabled'}`);
            footer = { text: `Song ${queue.get(interaction.guild.id)} of ${songs.size}` };
            updateEmbed(loop, style, desc, footer, msg);
        });

        } catch(error){
            console.log(error);
            interaction.reply({ content: 'An error occurred while executing the command.1'});
        }
         
}   )();
        

        
    }

}
