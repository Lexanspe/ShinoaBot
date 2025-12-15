require("dotenv").config();
console.log(process.env.TOKEN);
console.log('YouTube API Key:', process.env.YOUTUBE_API_KEY);

// Discord ses şifrelemesi için gerekli kütüphaneleri önceden yükle
try {
    require('sodium-native');
    console.log('sodium-native loaded successfully');
} catch (error) {
    console.log('sodium-native not found, trying tweetnacl...');
    try {
        require('tweetnacl');
        console.log('TweetNaCl loaded successfully');
    } catch (error) {
        console.log('TweetNaCl not found, trying libsodium-wrappers...');
        try {
            require('libsodium-wrappers');
            console.log('libsodium-wrappers loaded successfully');
        } catch (error) {
            console.log('No encryption library found, voice may not work');
        }
    }
}

// Opus kütüphanesini önceden yükle
try {
    require('opusscript');
    console.log('OpusScript loaded successfully');
} catch (error) {
    console.log('OpusScript not found, trying @discordjs/opus...');
    try {
        require('@discordjs/opus');
        console.log('@discordjs/opus loaded successfully');
    } catch (error) {
        console.log('No opus library found, voice may not work');
    }
}

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, IntentsBitField } = require('discord.js');
const client = new Client({ intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates
] });

const developerModule = require('./commands/developer');


client.cooldowns = new Collection();
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
const filePath = path.join(commandsPath, file);
const command = require(filePath);
// Set a new item in the Collection with the key as the command name and the value as the exported module
if ('data' in command && 'execute' in command) {
client.commands.set(command.data.name, command);
} else {
console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
}  
}

client.once(Events.ClientReady, readyClient => { 
console.log(`Ready! Logged in as ${readyClient.user.tag}`);
developerModule.updateClientStatus(client);
});


client.on(Events.InteractionCreate, async interaction => {
if (!interaction.isChatInputCommand()) return;
const command = client.commands.get(interaction.commandName);


if (!command) {
console.error(`No command matching ${interaction.commandName} was found.`);
return;
}

const { cooldowns } = interaction.client;

if (!cooldowns.has(command.data.name)) {
cooldowns.set(command.data.name, new Collection());
}

const now = Date.now();
const timestamps = cooldowns.get(command.data.name);
const defaultCooldownDuration = 3;
const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1000;

if (timestamps.has(interaction.user.id)) {
const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

if (now < expirationTime) {
const expiredTimestamp = Math.round(expirationTime / 1000);
return interaction.reply({ content: `\`${command.data.name}\` komutunu çok hızlı kullanıyorsunuz. <t:${expiredTimestamp}:R> yeniden kullanabilirsiniz.`, ephemeral: true });
}
}

timestamps.set(interaction.user.id, now);
setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

try {

// Developer mode restriction kontrolü - eğer development mode açıksa ve kullanıcı developer değilse engelle
if (developerModule.developmentMode && interaction.user.id !== process.env.OWNERID && interaction.user.id !== process.env.DEV) {
    console.log(`${interaction.member?.nickname || interaction.user.username}(${interaction.user.username}) tried to use "${interaction.commandName}" command while in development mode.`);
    return interaction.reply({ content: 'Bot şu anda geliştirici modunda. Sadece geliştiriciler komut kullanabilir.', ephemeral: true });
}

await command.execute(interaction, client);

} catch (error) {
console.error(error);
if (interaction.replied || interaction.deferred) {
await interaction.followUp({ content: 'Bir hata oluştu!', ephemeral: true });
} else {
await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
}
}
});

client.login(process.env.TOKEN);