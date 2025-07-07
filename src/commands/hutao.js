require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");



module.exports = {
  cooldown: 1,
  data: new SlashCommandBuilder()
    .setName("hutao")
    .setDescription("ez"),
    
    async execute(interaction) { 
        interaction.reply("alperenin hu taosu var");
        //interaction.channel.send("<a:plankton:1345420014450249808>");
    }
};