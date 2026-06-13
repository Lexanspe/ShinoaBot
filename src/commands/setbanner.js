require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("setbanner")
        .setDescription("Bannerı değiştirir."),
    async execute(interaction, client) {

        if (interaction.user.id != process.env.OWNERID) {
            await interaction.reply({ content: 'Bu komut sadece geliştiricilere özeldir.', flags: 64 });
            return;
        }

        try {
            await interaction.deferReply({ flags: 64 });
            await client.user.setBanner('./media/banner.gif');
            console.log(`New banner set!`);
            await interaction.editReply({ content: "Banner set!" });
        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: "An error occurred while setting the banner." });
            } else {
                await interaction.reply({ content: "An error occurred while setting the banner.", flags: 64 });
            }
        }
    }
};