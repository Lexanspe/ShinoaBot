const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, SelectMenuBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');

module.exports = {
    cooldown: 1,
data: new SlashCommandBuilder()
.setName('nehir')
.setDescription("Sihirli 8 Topu'na soru sorar.")                      
    .addStringOption(option => 
        option.setName('soru')
            .setDescription('Sorunuzu buraya yazın.')
            .setRequired(true)),
async execute(interaction) {
        //ses kısmı
        let member = await interaction.guild.members.fetch(interaction.user.id);
        let channel = member.voice.channel;
        let player = createAudioPlayer();
        //ses kısmı
        const soru = interaction.options.getString('soru')
        if (soru == "") return interaction.reply("Soru sormadın ki cevaplayayım?")
        if (soru.length > 1000) return interaction.reply("Yazdığın soru çok uzun, hiçbir şey anlamadım kısaltır mısın?")
        var sayi = Math.ceil(Math.random() * 18);
        var cevap;
        switch (sayi) {
            case 1: cevap = "yepp"; break; //olumlu
            case 2: cevap = "hell na bro wtf"; break; //olumsuz
            case 3: cevap = "fr"; break; //olumlu
            case 4: cevap = "i dont think so"; break; //olumsuz
            case 5: cevap = "mayyybee"; break; //kararsız
            case 6: cevap = "i dunno"; break; //kararsız
            case 7: cevap = "probably, i guess"; break; //olumlu
            case 8: cevap = "it wont be happening"; break; //olumsuz
            case 9: cevap = "kys"; break; //olumsuz
            case 10: cevap = "its a bit complicated"; break; //kararsız
            case 11: cevap = "might be tough"; break; //olumlu
            case 12: cevap = "nope"; break;  //olumsuz
            case 13: cevap = "i have some good feelings about it"; break;  //olumlu
            case 14: cevap = "dont even consider"; break;  //olumsuz
            case 15: cevap = "its a solid \"True\""; break;  //olumlu
            case 16: cevap = "i mean, yeah"; break;  //olumlu
            case 17: cevap = "<a:plankton:1345420014450249808>"; break; //olumsuz
            default: cevap = "im not sure"; break; //kararsız
        } //olumlu = 7, olumsuz = 7, kararsız = 4
        if (soru == "do you have any ibuprofen" | soru == "bilgisayar bana hemen fantastik ipneleri yolla" | soru == "i got a headache"){
            cevap = "i got a headache";
            if (soru == "bilgisayar bana hemen fantastik ipneleri yolla") {
                cevap = "tabi efendim";
            }
            else if (soru == "i got a headache") {
                cevap = "do you have any ibuprofen";
            }
            if (channel) {
                connection = await joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                  });
                await connection.subscribe(player);
                resource = createAudioResource(`./songs/headache.mp3`);
                if (soru == "bilgisayar bana hemen fantastik ipneleri yolla") {
                    resource = createAudioResource(`./songs/fantastik.mp3`);
                }
                else if (soru == "i got a headache") {
                    resource = createAudioResource(`./songs/ibuprofen.mp3`);
                }
                player.play(resource);
                player.addListener("stateChange", (oldOne, newOne) => {
                    console.log(oldOne.status, newOne.status);
                    if (oldOne.status == "playing" && newOne.status === "idle") {

            
                        connection.destroy();
                        //i.update({ content: "Ses kanalından ayrıldım. <:nice:1076907398264004709>", embeds: [], components: [] });

                        //interaction.followUp("Ses kanalından ayrıldım. <:nice:1076907398264004709>");

                        return;

        
        
                    }
                  })
            }
        }
        const embed = new EmbedBuilder()
            .setTitle("Sihirli 8 Topu")
            .addFields(
                { name: "Soru", value: soru },
                { name: "Cevap", value: cevap }
            )
            .setColor("#54007f");

        interaction.reply({embeds: [embed]});
},
};