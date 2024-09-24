require("dotenv").config();
const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
    .setName("gif2someone") 
    .setDescription("birine gif yollar.")
    .addStringOption((option) =>
        option
            .setName("aksiyon")
            .setDescription("yollanacak gifin aksiyonunu seçer.")
            .setRequired(true)
            .addChoices([
                { name: 'cuddle', value: 'cuddled' },
                { name: 'hug', value: 'hugged' },
                { name: 'kiss', value: 'kissed' },
                { name: 'lick', value: 'licked' },
                { name: 'nom', value: 'nommed' },
                { name: 'pat', value: 'patted' },
                { name: 'poke', value: 'poked' },
                { name: 'slap', value: 'slapped' },
                { name: 'stare', value: 'stared at' },
                { name: 'highfive', value: 'highfived' },
                { name: 'kill', value: 'killed' },
                { name: 'bite', value: 'bit' },
                { name: 'greet', value: 'greeted' },
                { name: 'punch', value: 'punched' },
                { name: 'handholding', value: 'held hands with' },
                { name: 'tickle', value: 'tickled' },
                { name: 'hold', value: 'held' },
                { name: 'pats', value: 'patted' },
                { name: 'wave', value: 'waved at' },
                { name: 'boop', value: 'booped' },
                { name: 'snuggle', value: 'snuggled' },
                { name: 'bully', value: 'bullied' }
            ])
        )
        .addUserOption((option) =>
            option
                .setName("kişi")
                .setDescription("yollanacak kişiyi seçer.")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("sgn")
                .setDescription("spesifik gif numarası.")
                .setRequired(false)
        ),
async execute(interaction) {
    
    let url = `https://tenor.googleapis.com/v2/search?q=${interaction.options.getString('aksiyon')}+anime&key=${process.env.TENORKEY}&limit=10`
    let response = await fetch(url);
    let json = await response.json();
    let number = Math.floor(Math.random() * json.results.length);
    if (interaction.user.id == interaction.options.getUser('kişi').id) {
        interaction.reply({ content: "Kendine gif gönderemezsin.", ephemeral: true });
        return;
    }

    if (interaction.options.getInteger('sgn') != null) { //specific gif number
        if (interaction.options.getInteger('sgn') > 10) {
            interaction.reply({ content: "Ne yazık ki sadece 10 gif var.", ephemeral: true });
            return;
        } else if (interaction.options.getInteger('sgn') < 1) {
            interaction.reply({ content: "tek akıllı sendin", ephemeral: true });
            return; 
        }
        number = interaction.options.getInteger('sgn') - 1;
    }

    let action = interaction.options.getString('aksiyon');
    let whom;

    if (interaction.options.getUser('kişi').id == process.env.CLIENTID) {
        whom = "me";
    }
    else {
        let user = interaction.options.getUser("kişi");
        let member = await interaction.guild.members.fetch(user.id);
        whom = member.nickname ? member.nickname : user.username;  
    }

    interaction.guild.members.fetch(interaction.options.getUser('kişi')).then(async (user) => {
        const userAvatarURL = interaction.user.displayAvatarURL();
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.member.nickname ? interaction.member.nickname : interaction.user.username} ${action} ${whom}!`, iconURL: userAvatarURL })
            .setImage(json.results[number]["media_formats"]["gif"]["url"])
            .setColor(0x54007f);

    await interaction.reply({ embeds: [embed] });
        console.log(`Sent gif for ${interaction.options.getString('aksiyon')} to ${interaction.options.getUser('kişi').tag} by ${interaction.user.tag}, gif number: ${number}, selected by user: ${interaction.options.getInteger('sgn') != null}`);
        //interaction.reply({ content: `Sent gif to ${user.tag}` });
    });

}
};