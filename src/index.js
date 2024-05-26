require("dotenv").config();
const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel } = require('@discordjs/voice');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ]
});

const connections = new Map();

client.on("ready", (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "gif") {
        if (interaction.options.getString('character') == "rickroll") {
            interaction.reply({ content: "nope, no rickroll", ephemeral: true });
            console.log("rickroll");
            return;
        }
        let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('character')}&key=${process.env.TENORKEY}&limit=50`
        let response = await fetch(url);
        let json = await response.json();
        let number = Math.floor(Math.random() * json.results.length);
        if (interaction.options.getBoolean('developermode')) {
            if (interaction.user.id != process.env.OWNERID) { interaction.reply({ content: "You do not have permission to use developer.", ephemeral: true }); return;}
            console.log("Developer mode activated");
            await interaction.reply(json.results[0].url);
            for (let i = 1; i < json.results.length; i++) {
                interaction.followUp(json.results[i].url);
            }
        } else {

            if (interaction.options.getInteger('sgn') != null) {
                if (interaction.options.getInteger('sgn') > 50) {
                    interaction.reply({ content: "There are only 50 gifs available. Sorry!", ephemeral: true });
                    return;
                } else if (interaction.options.getInteger('sgn') < 1) {
                    interaction.reply({ content: "The gif number must be greater than 0", ephemeral: true });
                    return;
                }
                number = interaction.options.getInteger('sgn') - 1;
            }
            interaction.reply(json.results[number].url);
            console.log(`Sent gif for ${interaction.options.getString('character')} by ${interaction.user.tag}, gif number: ${number+1}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
        }
        
    }
    else if (interaction.commandName === "gif2someone") {
        let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('action')}+anime&key=${process.env.TENORKEY}&limit=20`
        let response = await fetch(url);
        let json = await response.json();
        let number = Math.floor(Math.random() * json.results.length);
        if (interaction.options.getInteger('sgn') != null) {
            if (interaction.options.getInteger('sgn') > 20) {
                interaction.reply({ content: "There are only 20 gifs available. Sorry!", ephemeral: true });
                return;
            } else if (interaction.options.getInteger('sgn') < 1) {
                interaction.reply({ content: "The gif number must be greater than 0", ephemeral: true });
                return;
            }
            number = interaction.options.getInteger('sgn') - 1;
        }
        if (interaction.options.getUser('user').id == client.user.id) {
            interaction.reply({ content: "I can't send gifs to myself!", ephemeral: true });
            return;
        }
        let actionType = interaction.options.getString('action');
        let action;
        switch (actionType) {
            case 'cuddle':
                action = "cuddled";
                break;
            case 'hug':
                action = "hugged";
                break;
            case 'kiss':
                action = "kissed";
                break;
            case 'lick':
                action = "licked";
                break;
            case 'nom':
                action = "nommed";
                break;
            case 'pat':
                action = "patted";
                break;
            case 'poke':
                action = "poked";
                break;
            case 'slap':
                action = "slapped";
                break;
            case 'stare':
                action = "stared at";
                break;
            case 'highfive':
                action = "highfived";
                break;
            case 'bite':
                action = "bit";
                break;
            case 'greet':
                action = "greeted";
                break;
            case 'punch':
                action = "punched";
                break;
            case 'handholding':
                action = "held hands with";
                break;
            case 'tickle':
                action = "tickled";
                break;
            case 'kill':
                action = "killed";
                break;
            case 'hold':
                action = "held";
                break;
            case 'pats':
                action = "patted";
                break;
            case 'wave':
                action = "waved at";
                break;
            case 'boop':
                action = "booped";
                break;
            case 'snuggle':
                action = "snuggled";
                break;
            case 'bully':
                action = "bullied";
                break;
            default:
                action = actionType;
        }

        interaction.guild.members.fetch(interaction.options.getUser('user')).then(async (user) => {
            const embed = new EmbedBuilder()
                .setDescription(`${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} ${action} <@${user.id}>`)
                .setImage(json.results[number]["media_formats"]["gif"]["url"])
                .setColor(0x54007f);
    
        await interaction.reply({ embeds: [embed] });
            console.log(`Sent gif for ${interaction.options.getString('action')} to ${interaction.options.getUser('user').tag} by ${interaction.user.tag}, gif number: ${number}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
            //interaction.reply({ content: `Sent gif to ${user.tag}` });
        });
    }
    else if (interaction.commandName === "vc") {
        let member = await interaction.guild.members.fetch(interaction.user.id);
        console.log(`Member: ${member}`);
        let channel = member.voice.channel;
        console.log(`Channel: ${channel}`);
        console.log(`Channel ID: ${channel ? channel.id : 'None'}`);
        console.log(`Guild ID: ${interaction.guild.id}`);
        if (interaction.user.id != process.env.OWNERID) {
            interaction.reply({ content: "Voice channel feature still in progress. Thank you for understanding.", ephemeral: true });
            return;
        }
        if (interaction.options.getSubcommand() === 'debug') {     
            for (let [channelId, connection] of connections.entries()) {
                console.log(`Channel ID: ${channelId}`);
                console.log(`Connection status: ${connection.status}`);
                console.log(`Connection joinTimestamp: ${connection.joinTimestamp}`);
                interaction.reply({ content: `Channel ID: ${channelId}\nConnection status: ${connection.status}\nConnection joinTimestamp: ${connection.joinTimestamp}` }, { ephemeral: true });
            }
        }

        if (!channel) {
            interaction.reply({ content: "You must be in a voice channel to use this command", ephemeral: true }); 
            return;
        }

        if (interaction.options.getSubcommand() === 'join') {
            let member = await interaction.guild.members.fetch(interaction.user.id);
            let channel = member.voice.channel;
        
            let connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });
            connections.set(channel, connection);
            interaction.reply({ content: "Joined the voice channel!" });
        }
        
        else if (interaction.options.getSubcommand() === 'disconnect') {
            let member = await interaction.guild.members.fetch(interaction.user.id);
            let channel = member.voice.channel;
            let connection = connections.get(channel);
            if (connection) {
                connection.destroy();
                connections.delete(channel);
                interaction.reply({content: "disconnected"});
            } else {
                interaction.reply({content: "not in vc"});
            }
        }
    }
    else if (interaction.commandName === "setbanner") {
        if (interaction.user.id != process.env.OWNERID) {
            interaction.reply({ content: "You do not have permission to use this command", ephemeral: true });
            return;
        }
    
        try {
            await client.user.setBanner('./banner.gif');
            console.log(`New banner set!`);
            interaction.reply({ content: "Banner set!" });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: "An error occurred while setting the banner.", ephemeral: true });
            return;
        }
    }
});

client.login(process.env.TOKEN);