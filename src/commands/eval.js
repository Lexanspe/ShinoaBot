
const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');
require('dotenv').config();

const developerIds = [
    process.env.OWNERID,
    process.env.DEV
];


module.exports = {
    data: new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Geliştirici komutları - eval, cmd, chatemesaj')
        .addStringOption(option =>
            option.setName('mod')
                .setDescription('Komut modu seçin')
                .setRequired(true)
                .addChoices(
                    { name: 'Eval - JavaScript kodu çalıştır', value: 'eval' },
                    { name: 'CMD - Terminal komutu çalıştır', value: 'cmd' },
                    { name: 'Chat Mesaj - Kanala mesaj gönder', value: 'chatemesaj' }
                ))
        .addStringOption(option =>
            option.setName('input')
                .setDescription('Çalıştırılacak kod/komut/mesaj')
                .setRequired(true)),


    async execute(interaction) {

        function nodeCommand(cmd, callback) {
            exec(cmd, (error, stdout, stderr) => {
                if (error) return callback(stderr || error.message);
                callback(stdout);
            });
        }

        if (!developerIds.includes(interaction.user.id)) {
            await interaction.reply({ content: 'Bu komut sadece geliştiricilere özeldir.', flags: 64 });
            return;
        }

        const mod = interaction.options.getString('mod');
        const input = interaction.options.getString('input');

        switch (mod) {
            case 'eval':
                try {
                    eval(`${input}`);
                    const evalReply = await interaction.reply({ content: 'Eval komutu çalıştırıldı.', flags: 64 });
                    setTimeout(() => {
                        evalReply.delete().catch(() => { });
                    }, 2500);
                } catch (error) {
                    await interaction.reply({ content: `Eval hatası: ${error.message}`, flags: 64 });
                }
                break;

            case 'cmd':
                nodeCommand(input, (result) => {
                    console.log('CMD sonucu:', result);
                });
                const cmdReply = await interaction.reply({ content: 'CMD komutu çalıştırıldı.', flags: 64 });
                setTimeout(() => {
                    cmdReply.delete().catch(() => { });
                }, 2500);
                break;

            case 'chatemesaj':
                interaction.channel.send(input);
                const chatReply = await interaction.reply({ content: 'Mesaj gönderildi.', flags: 64 });
                setTimeout(() => {
                    chatReply.delete().catch(() => { });
                }, 2500);
                break;

            default:
                await interaction.reply({ content: 'Geçersiz mod!', flags: 64 });
        }
    },
};