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

    const { commandName } = interaction;

    if (commandName === "gif") {
        if (interaction.options.getString('character') == "rickroll") {
            interaction.reply({ content: "nope, no rickroll", ephemeral: true });
            console.log("rickroll");
            return;
        }
        let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('character')}&key=${process.env.TENORKEY}&limit=50`
        let response = await fetch(url);
        let json = await response.json();
        interaction.reply(json.results[Math.floor(Math.random() * json.results.length)].url);
        console.log(`Sent gif for ${interaction.options.getString('character')} by ${interaction.user.tag}`);
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
});

client.login(process.env.TOKEN);