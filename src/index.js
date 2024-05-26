require("dotenv").config();
const { Client, IntentsBitField } = require("discord.js");

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
                }
                number = interaction.options.getInteger('sgn') - 1;
            }
            interaction.reply(json.results[number].url);
            console.log(`Sent gif for ${interaction.options.getString('character')} by ${interaction.user.tag}, gif number: ${number}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
        }
        
    }
    else if (commandName === "setbanner") {
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
    else if (commandName === "gif2someone") {
        if (interaction.options.getString('action') == "rickroll") {
            interaction.reply({ content: "nope, no rickroll", ephemeral: true });
            console.log("rickroll");
            return;
        }
        let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('action')}+anime&key=${process.env.TENORKEY}&limit=20`
        let response = await fetch(url);
        let json = await response.json();
        let number = Math.floor(Math.random() * json.results.length);
        if (interaction.options.getInteger('sgn') != null) {
            if (interaction.options.getInteger('sgn') > 20) {
                interaction.reply({ content: "There are only 20 gifs available. Sorry!", ephemeral: true });
                return;
            }
            number = interaction.options.getInteger('sgn') - 1;
        }
        interaction.guild.members.fetch(interaction.options.getUser('user')).then((user) => {
            interaction.reply(json.results[number].url);
            console.log(`Sent gif for ${interaction.options.getString('action')} to ${interaction.options.getUser('user').tag} by ${interaction.user.tag}, gif number: ${number}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
            //interaction.reply({ content: `Sent gif to ${user.tag}` });
        });
    }
});

client.login(process.env.TOKEN);