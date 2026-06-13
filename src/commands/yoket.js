const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

const developerIds = [
    process.env.OWNERID,
    process.env.DEV
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yoket')
        .setDescription('Belirtilen kullanıcıyı sunucudan atar')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Atılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atılma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        // Geliştirici kontrolü
        if (!developerIds.includes(interaction.user.id)) {
            await interaction.reply({ content: 'Bu komut sadece geliştiricilere özeldir.', flags: 64 });
            return;
        }

        const targetUser = interaction.options.getUser('kullanici');
        const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

        // Hedef kullanıcıyı sunucudan al
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: 'Bu kullanıcı sunucuda bulunamadı.', flags: 64 });
            return;
        }

        // Kendini atamaya çalışıyor mu?
        if (targetUser.id === interaction.user.id) {
            await interaction.reply({ content: 'Kendini atamazsın!', flags: 64 });
            return;
        }

        // Bot sahibini atamaya çalışıyor mu?
        if (targetUser.id === interaction.guild.ownerId) {
            await interaction.reply({ content: 'Sunucu sahibini atamazsın!', flags: 64 });
            return;
        }

        // Kullanıcıyı at
        try {
            if (targetUser.id === "1100432016576622594") {
                await interaction.reply({ content: 'Gene ne bok yedin amk botu ya 🥀\nMayonez başarıyla atıldı.' });
                return;
            }
            await targetMember.kick(reason);
            await interaction.reply({
                content: `${targetUser.tag} başarıyla sunucudan atıldı.\n**Sebep:** ${reason}`,
            });
        } catch (error) {
            console.error('Kick hatası:', error);
            await interaction.reply({
                content: `❌ ${targetUser.tag} atılırken bir hata oluştu: ${error.message}`,
                flags: 64
            });
        }
    },
};