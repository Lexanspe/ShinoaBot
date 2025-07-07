const { SlashCommandBuilder } = require('discord.js');

let developmentMode = true;

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
    if (interaction.user.id != process.env.OWNERID && interaction.user.id != process.env.DEV1) {
        return;
    }

    const devMode = interaction.options.getBoolean('dev');
    

    if (devMode && developmentMode) {
        return interaction.reply({ content: "I'm already in development mode", ephemeral: true });
    } else if (!devMode && !developmentMode) {
        return interaction.reply({ content: "I'm already in normal mode", ephemeral: true });
    } else if (devMode && !developmentMode) {
        developmentMode = true;
        interaction.reply({ content: "Switched to development mode", ephemeral: false });
    } else if (!devMode && developmentMode) {
        developmentMode = false;
        interaction.reply({ content: "Switched to normal mode", ephemeral: false });
    }
    clientStatus();



},

 getDevelopmentMode: () => developmentMode,

};