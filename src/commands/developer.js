const { SlashCommandBuilder } = require('discord.js');

let developmentMode = false;
let statusInterval; // Interval referansını saklamak için

module.exports = {
    data: new SlashCommandBuilder()
        .setName('developer')
        .setDescription('Switch to developer mode')
        .addBooleanOption(option =>
            option.setName('dev')
                .setDescription('Enable or disable developer mode')
                .setRequired(true)),

async execute(interaction, client) {

    if (interaction.user.id != process.env.OWNERID && interaction.user.id != process.env.DEV) {
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
    
    // Status güncelleme
    this.updateClientStatus(client);

},

// Status güncelleme fonksiyonu
updateClientStatus(client) {
    // Önceki interval'ı temizle
    if (statusInterval) clearInterval(statusInterval);
    
    if (developmentMode) {
        client.user.setActivity(`in development mode`);
        
        statusInterval = setInterval(() => {
            client.user.setActivity(`in development mode`);
        }, 60000);
    } else {
        client.user.setActivity(`v1.2 | ${client.guilds.cache.map(g => g.name).length} sunucuda!`);
        
        statusInterval = setInterval(() => {
            client.user.setActivity(`v1.2 | ${client.guilds.cache.map(g => g.name).length} sunucuda!`);
        }, 60000);
    }
},

// Developer kontrolü fonksiyonu
checkDeveloperPermission(userId) {
    return userId === process.env.OWNERID || userId === process.env.DEV;
},

// Developer mode kontrolü fonksiyonu  
checkDeveloperModeRestriction(userId) {
    return !this.checkDeveloperPermission(userId) && developmentMode;
},

getDevelopmentMode: () => developmentMode,

};