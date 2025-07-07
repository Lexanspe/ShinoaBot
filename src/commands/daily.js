const { SlashCommandBuilder } = require('discord.js');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('daily'),


async execute(interaction, client) {

    
    interaction.reply("💰 | neir, Here is your daily :cowoncy: 5000 Cowoncy!\n    | You're on a 846 daily streak!\n:    | You received a lootbox!\n    | You and archlonz received :sadabdulhamidcoin: 1000 Sadabdulhamidcoin and a :crate: weapon crate!\⏱️ | Your next daily is in: 21H 19M 54S");






},



};