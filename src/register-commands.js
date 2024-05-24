require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'gif',
        description: 'Sends a random gif of what you choose',
        options: [
            {
                name: 'character',
                description: 'Choose a character',
                type: 3, 
                required: true,
            }
        ]
    },
    {
        name: 'setbanner',
        description: 'sets banner',
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();