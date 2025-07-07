require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("setbanner")
        .setDescription("Bannerı değiştirir."),
async execute(interaction, client) {
    
    if (interaction.user.id != process.env.OWNERID) {
        return;
    }

    try {
        await client.user.setBanner('../banner.gif');
        console.log(`New banner set!`);
        await interaction.reply({ content: "Banner set!" });
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: "An error occurred while setting the banner.", ephemeral: true });
        return;
    }
}
};