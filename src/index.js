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

const currentsongqueueglobal = new Map();
const connections = new Map();   
const songlist = new Map();
const loop = new Map();


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
        let member = await interaction.guild.members.fetch(interaction.user.id);
        let channel = member.voice.channel;
        if (interaction.user.id != process.env.OWNERID) {
            //interaction.reply({ content: "Voice channel feature still in progress. Thank you for understanding. <:understandable:1073559845518708736>", ephemeral: true });
            //return;
        }

        if (interaction.options.getSubcommand() === 'play') {

            let selectedsong = interaction.options.getString('song');
            let connection;
            let player;
            let currentqueue = 1;
        
            if (!channel) {
                return interaction.reply({ content: "Önce bir ses kanalında bulunman gerekiyor.", ephemeral: true });
            }
                         
            while (1){
                if (songlist.has(`${channel.id}-${currentqueue}`)) {
                    currentqueue++;
                } else {
                    songlist.set(`${channel.id}-${currentqueue}`, selectedsong);
                    break;
                }
            };

            

            if (!connections.has(channel.id)) {
                connection = await joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                connections.set(channel.id, connection);
                player = createAudioPlayer();
            } else {
                let queue = currentsongqueueglobal.get(channel.id) + 1;
                let currentsonglist = "";
                while (1) {
                    if (songlist.has(`${channel.id}-${queue}`)) {
                        currentsonglist += songlist.get(`${channel.id}-${queue}`) + ", ";
                        queue++;
                    } else {
                        break;
                    }
                }

                if (currentsonglist.slice(-2) === ", ") {
                    currentsonglist = currentsonglist.slice(0, -2);
                }

                interaction.reply(`Sıraya "${selectedsong}" eklendi. Şu andaki sıra: ${currentsonglist}`);
                return;
            }

            let currentsong = songlist.get(`${channel.id}-1`);
        
            resource = createAudioResource(`../songs/${currentsong}.mp3`);
            player.play(resource);

            currentsongqueueglobal.set(channel.id, currentqueue);

            player.addListener("stateChange", (oldOne, newOne) => {
                console.log(oldOne.status, newOne.status);
                if (oldOne.status == "playing" && newOne.status === "idle") {

                    if (!(loop.has(channel.id) && loop.get(channel.id))) {
                        currentqueue++;
                    }

                    currentsongqueueglobal.delete(channel.id);
                    currentsongqueueglobal.set(channel.id, currentqueue);

                    if (!songlist.has(`${channel.id}-${currentqueue}`)) {
                        connection.destroy();
                        connections.delete(channel.id);
                        for(let i = 1; i <= currentqueue; i++) {
                            songlist.delete(`${channel.id}-${i}`);
                        }
                     }
                    
                    let currentsong = songlist.get(`${channel.id}-${currentqueue}`);
                    console.log(songlist);
                    resource = createAudioResource(`../songs/${currentsong}.mp3`);
                    player.play(resource);
                    if (songlist.has(`${channel.id}-${currentqueue + 1}`)) {
                        let list_ = Array.from(songlist.values()).slice(currentqueue).join(', ');
                        if (list_.slice(-2) === ", ") {
                            list_ = list_.slice(0, -2);
                        }
                        interaction.followUp(`Şu anda "${currentsong}" oynatılıyor, sıradaki şarkılar: ${list_}`);
                    } else if (songlist.has(`${channel.id}-${currentqueue}`)) {
                        interaction.followUp(`Şu anda "${currentsong}" oynatılıyor.`);
                    }
                    
                    
                }
            });

            await connection.subscribe(player);
            await interaction.reply({ content: `Şu anda \"${selectedsong}\" oynatılıyor!` });
        }

        else if (interaction.options.getSubcommand() === 'loop') {
            if (!channel) {
                return interaction.reply({ content: "Önce bir ses kanalında bulunman gerekiyor.", ephemeral: true });
            }

            if (loop.has(channel.id)) {
                loop.delete(channel.id);
            }

            if (interaction.options.getBoolean('enable')) {
                loop.set(channel.id, true);
                interaction.reply({ content: "Şarkı döngüsü etkinleştirildi." });
            } else {
                loop.set(channel.id, false);
                interaction.reply({ content: "Şarkı döngüsü devre dışı bırakıldı." });
            }
        }

        else if (interaction.options.getSubcommand() === 'disconnect') {

        
            if (!channel) {
                return interaction.reply({ content: "Herhangi bir ses kanalında değilsin!", ephemeral: true });
            }
        
            let connection = connections.get(channel.id);
            if (connection) {
                for(let i = 1; i <= currentsongqueueglobal.get(channel.id); i++) {
                    songlist.delete(`${channel.id}-${i}`);
                }
                connection.destroy();
                connections.delete(channel.id);
                
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