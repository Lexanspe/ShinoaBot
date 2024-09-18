require("dotenv").config();
const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates
    ]
});

const connections = new Map();   
const songlist = [];

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
            if (interaction.user.id != process.env.OWNERID) { interaction.reply({ content: "Geliştirici olduğunu sanmıyorum.", ephemeral: true }); return;}
            console.log("Developer mode activated");
            await interaction.reply(json.results[0].url);
            for (let i = 1; i < json.results.length; i++) {
                interaction.followUp(json.results[i].url);
            }
        } else {

            if (interaction.options.getInteger('sgn') != null) {
                if (interaction.options.getInteger('sgn') > 50) {
                    interaction.reply({ content: "Ne yazık ki sadece 50 gif var.", ephemeral: true });
                    return;
                } else if (interaction.options.getInteger('sgn') < 1) {
                    interaction.reply({ content: "tek akıllı sendin", ephemeral: true });
                    return;
                }
                number = interaction.options.getInteger('sgn') - 1;
            }
            interaction.reply(json.results[number].url);
            console.log(`Sent gif for ${interaction.options.getString('character')} by ${interaction.user.tag}, gif number: ${number+1}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
        }
        
    }
    else if (interaction.commandName === "gif2someone") {
        let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('action')}+anime&key=${process.env.TENORKEY}&limit=10`
        let response = await fetch(url);
        let json = await response.json();
        let number = Math.floor(Math.random() * json.results.length);
        if (interaction.user.id == interaction.options.getUser('user').id) {
            interaction.reply({ content: "Kendine gif gönderemezsin.", ephemeral: true });
            return;
        }

        if (interaction.options.getInteger('sgn') != null) { //specific gif number
            if (interaction.options.getInteger('sgn') > 10) {
                interaction.reply({ content: "Ne yazık ki sadece 10 gif var.", ephemeral: true });
                return;
            } else if (interaction.options.getInteger('sgn') < 1) {
                interaction.reply({ content: "tek akıllı sendin", ephemeral: true });
                return; 
            }
            number = interaction.options.getInteger('sgn') - 1;
        }

        let actionType = interaction.options.getString('action');
        let action;
        let whom;
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

        if (interaction.options.getUser('user').id == client.user.id) {
            whom = "me";
        }
        else {
            let user = interaction.options.getUser("user");
            let member = await interaction.guild.members.fetch(user.id);
            whom = member.nickname ? member.nickname : user.username;  
        }

        interaction.guild.members.fetch(interaction.options.getUser('user')).then(async (user) => {
            const userAvatarURL = interaction.user.displayAvatarURL();
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} ${action} ${whom}!`, iconURL: userAvatarURL })
                .setImage(json.results[number]["media_formats"]["gif"]["url"])
                .setColor(0x54007f);
    
        await interaction.reply({ embeds: [embed] });
            console.log(`Sent gif for ${interaction.options.getString('action')} to ${interaction.options.getUser('user').tag} by ${interaction.user.tag}, gif number: ${number}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
            //interaction.reply({ content: `Sent gif to ${user.tag}` });
        });
    }

    else if (interaction.commandName === "vc") {
        if (interaction.user.id != process.env.OWNERID) {
            //interaction.reply({ content: "Voice channel feature still in progress. Thank you for understanding. <:understandable:1073559845518708736>", ephemeral: true });
            //return;
        }

        if (interaction.options.getSubcommand() === 'play') {
            let member = await interaction.guild.members.fetch(interaction.user.id);
            let channel = member.voice.channel;
            let selectedsong = interaction.options.getString('song');
            let connection;
            let player;
        
            if (!channel) {
                return interaction.reply({ content: "Önce bir ses kanalında bulunman gerekiyor.", ephemeral: true });
            }
                         
            songlist.push(selectedsong);

            

            if (!connections.has(channel.id)) {
                connection = await joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                connections.set(channel.id, connection);
                player = createAudioPlayer();
            } else {
                interaction.reply(`Sıraya ${selectedsong} eklendi. Şu andaki sıra: ${songlist}`);
                return;
            }

        
            resource = createAudioResource(`../songs/${songlist[0]}.mp3`);
            player.play(resource);

            player.addListener("stateChange", (oldOne, newOne) => {
                console.log(oldOne.status, newOne.status);
                if (oldOne.status == "playing" && newOne.status === "idle") {
                    songlist.shift();
                    console.log(songlist);
                    resource = createAudioResource(`../songs/${songlist[0]}.mp3`);
                    player.play(resource);
                    if (songlist[1]) {
                        interaction.followUp(`Şu anda ${songlist[0]} oynatılıyor, sıradaki şarkılar: ${songlist.slice(1)}`);
                    } else if (songlist[0]) {
                        interaction.followUp(`Şu anda ${songlist[0]} oynatılıyor.`);
                    }
                    
                    if (songlist.length == 0) {
                        connection.destroy();
                        connections.delete(channel.id);
                    }
                }
            });

            await connection.subscribe(player);
            await interaction.reply({ content: `Şu anda \"${selectedsong}\" oynatılıyor!` });
        }

        if (interaction.options.getSubcommand() === 'disconnect') {
            let member = await interaction.guild.members.fetch(interaction.user.id);
            let channel = member.voice.channel;
        
            if (!channel) {
                return interaction.reply({ content: "Herhangi bir ses kanalında değilsin!", ephemeral: true });
            }
        
            let connection = connections.get(channel.id);
            if (connection) {
                connection.destroy();
                connections.delete(channel.id);
                songlist.length = 0;
                interaction.reply({ content: "Ses kanalından ayrıldım. <:nice:1076907398264004709>" });
            } else {
                interaction.reply({ content: "Bulunduğun ses kanalında değilim... <a:sh2:1017889255973994546>" });
            }
        }
    }





    else if (interaction.commandName === "setbanner") {
        if (interaction.user.id != process.env.OWNERID) {
            interaction.reply({ content: "Geliştirici olduğunu sanmıyorum.", ephemeral: true });
            return;
        }
    
        try {
            await client.user.setBanner('../banner.gif');
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