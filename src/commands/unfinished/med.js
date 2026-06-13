require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");



module.exports = {
  cooldown: 1,
  data: new SlashCommandBuilder()
    .setName("med")
    .setDescription("medin oyunu")
    .addUserOption(option => option.setName('user1').setDescription('First user').setRequired(true))
    .addUserOption(option => option.setName('user2').setDescription('Second user').setRequired(false))
    .addUserOption(option => option.setName('user3').setDescription('Third user').setRequired(false))
    .addUserOption(option => option.setName('user4').setDescription('Fourth user').setRequired(false))
    .addUserOption(option => option.setName('user5').setDescription('Fifth user').setRequired(false)),

  async execute(interaction) {
    console.log("med command executed");

    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const user3 = interaction.options.getUser('user3');
    const user4 = interaction.options.getUser('user4');
    const user5 = interaction.options.getUser('user5');

    const users = [user1, user2, user3, user4, user5].filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle("Oyun Başladı!")
      .setDescription(`Host: <@${interaction.user.id}>\n Oyuncu 1: ${user1 ? `<@${user1.id}>` : 'N/A'}\n Oyuncu 2: ${user2 ? `<@${user2.id}>` : 'N/A'}\n Oyuncu 3: ${user3 ? `<@${user3.id}>` : 'N/A'}\n Oyuncu 4: ${user4 ? `<@${user4.id}>` : 'N/A'}\n Oyuncu 5: ${user5 ? `<@${user5.id}>` : 'N/A'}`)
      .setColor(0xff7d1a);

    const raw = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('med-start')
        .setLabel('Başla')
        .setStyle('PRIMARY')
    );

    

    await interaction.reply({ content: "Medin oyunu başladı!", embeds: [embed], components: [raw] });
  }
};