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
            },
            {
                name: 'sgn',
                description: 'Stands for "Specific Gif Number". If you want a specific gif, type the number here',
                type: 4, 
                required: false,
            },
            {
                name: 'developermode',
                description: 'for developers only',
                type: 5, 
                required: false,
            }
        ]
    },
    {
        name: 'gif2someone',
        description: 'Sends a random gif of what you choose to someone',
        options: [
            {
                name: 'action',
                description: 'Choose a action',
                type: 3, 
                required: true,
                choices: [{name: 'cuddle', value: 'cuddle'}, {name: 'hug', value: 'hug'}, {name: 'kiss', value: 'kiss'}, {name: 'lick', value: 'lick'}, {name: 'nom', value: 'nom'}, {name: 'pat', value: 'pat'}, {name: 'poke', value: 'poke'}, {name: 'slap', value: 'slap'}, {name: 'stare', value: 'stare'}, {name: 'highfive', value: 'highfive'}, {name: 'bite', value: 'bite'}, {name: 'greet', value: 'greet'}, {name: 'punch', value: 'punch'}, {name: 'handholding', value: 'handholding'}, {name: 'tickle', value: 'tickle'}, {name: 'kill', value: 'kill'}, {name: 'hold', value: 'hold'}, {name: 'pats', value: 'pats'}, {name: 'wave', value: 'wave'}, {name: 'boop', value: 'boop'}, {name: 'snuggle', value: 'snuggle'}, {name: 'bully', value: 'bully'}]
                //['cuddle', 'hug', 'kiss', 'lick', 'nom', 'pat', 'poke', 'slap', 'stare', 'highfive', 'bite', 'greet', 'punch', 'handholding', 'tickle', 'kill', 'hold', 'pats', 'wave', 'boop', 'snuggle', 'bully']
            },
            {
                name: 'user',
                description: 'Mention the user you want to send the gif to',
                type: 6, 
                required: true,
            },
            {
                name: 'sgn',
                description: 'Stands for "Specific Gif Number". If you want a specific gif, type the number here',
                type: 4, 
                required: false,
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