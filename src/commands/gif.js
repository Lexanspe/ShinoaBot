require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("gif")
        .setDescription("Rastgele bir gif yollar.")
        .addStringOption((option) =>
            option
                .setName("arama")
                .setDescription(
                    "Belirli bir şey için gif arar."
                )
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("sgn")
                .setDescription(
                    "spesifik gif numarası"
                )
        )
        .addBooleanOption((option) =>
            option
                .setName("geliştiricimodu")
                .setDescription(
                    "Sadece geliştiriciler için."
                )
        ),
async execute(interaction) {
    if (interaction.options.getString('arama') == "rickroll") {
        interaction.reply({ content: "nope, no rickroll", ephemeral: true });
        console.log("rickroll");
        return;
    }

    let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('arama')}&key=${process.env.TENORKEY}&limit=50`
    let response = await fetch(url);
    let json = await response.json();
    let number = Math.floor(Math.random() * json.results.length);
    if (interaction.options.getBoolean('geliştiricimodu')) {
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
        console.log(`Sent gif for ${interaction.options.getString('arama')} by ${interaction.user.tag}, gif number: ${number+1}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
    }
    
}
};