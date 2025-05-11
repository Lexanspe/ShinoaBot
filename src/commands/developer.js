const { SlashCommandBuilder } = require('discord.js');

let developmentMode = false;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('developer')
        .setDescription('Switch to developer mode')
        .addBooleanOption(option =>
            option.setName('dev')
                .setDescription('Enable or disable developer mode')
                .setRequired(true)),

async execute(interaction, client) {

    async function clientStatus() {
        if (developmentMode) {
            client.user.setActivity(`in development mode`);
        } else {
            client.user.setActivity(`beta v1.1 | ${client.guilds.cache.map(g => g.name).length} sunucuda!`);
        }
    }
    if (interaction.user.id != process.env.OWNERID) {
        return interaction.reply({ content: "you are not a developer. are you?", ephemeral: true });
    }

    const devMode = interaction.options.getBoolean('dev');
    

    if (devMode && developmentMode) {
        return interaction.reply({ content: "I'm already in development mode", ephemeral: true });
    } else if (!devMode && !developmentMode) {
        return interaction.reply({ content: "I'm already in normal mode", ephemeral: true });
    } else if (devMode && !developmentMode) {
        developmentMode = true;
        interaction.reply({ content: "Switched to development mode", ephemeral: true });
    } else if (!devMode && developmentMode) {
        developmentMode = false;
        interaction.reply({ content: "Switched to normal mode", ephemeral: true });
    }
    clientStatus();



},

 getDevelopmentMode: () => developmentMode,

};