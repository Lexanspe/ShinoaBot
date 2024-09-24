require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');


const currentsongqueueglobal = new Map();
const connections = new Map();   
const songlist = new Map();
const guilds = new Map();
const loop = new Map();


module.exports = {
  cooldown: 1,
  data: new SlashCommandBuilder()
    .setName("ses")
    .setDescription("Ses kanalıyla ilgili işlemler.")
    .addSubcommand((subcommand) =>
        subcommand
        .setName("konuşartık")
        .setDescription("şarkı çalar.")
        .addStringOption((option) =>
            option.setName("şarkı")
            .setDescription("şarkı adı")
            .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("git")
        .setDescription("sesten gider.")
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("tekrar")
        .setDescription("şarkıyı tekrar ettirir.")
        .addBooleanOption((option) =>
            option.setName("açkapaamq")
            .setDescription("açar kapar amq")
            .setRequired(true)
          )
      ),
  async execute(interaction) {
    console.log; //consoles log, im sorry
    if (!guilds.has(interaction.guild.id)) {
      guilds.set(interaction.guild.id, interaction.channel.id);
    } else if (guilds.get(interaction.guild.id) != interaction.channel.id) {
      return interaction.reply({
        content: `Komut kullanmak için <#${guilds.get(interaction.guild.id)}> kanalına gitmelisin.`, ephemeral: true
      });
    }

    let member = await interaction.guild.members.fetch(interaction.user.id);
    let channel = member.voice.channel;
    if (interaction.user.id != process.env.OWNERID) {
      //interaction.reply({ content: "Voice channel feature still in progress. Thank you for understanding. <:understandable:1073559845518708736>", ephemeral: true });
      //return;
    }

    if (interaction.options.getSubcommand() === "konuşartık") {
      let selectedsong = interaction.options.getString("şarkı");
      let connection;
      let player;
      let currentqueue = 1;
      let loopstatus = "";

      if (!channel) {
        return interaction.reply({
          content: "Önce bir ses kanalında bulunman gerekiyor.",
          ephemeral: true,
        });
      }

      if (loop.has(channel.id)) {
        loopstatus = "(loop: enabled)";
      }

      while (1) {
        if (songlist.has(`${channel.id}-${currentqueue}`)) {
          currentqueue++;
        } else {
          songlist.set(`${channel.id}-${currentqueue}`, selectedsong);
          break;
        }
      }

      if (!connections.has(channel.id)) {
        connection = await joinVoiceChannel({
          channelId: channel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        connections.set(channel.id, connection);
        player = createAudioPlayer();
      } else {
        let queue = currentsongqueueglobal.get(channel.id) + 1;
        let currentsonglist = "";

        while (1) {
          if (songlist.has(`${channel.id}-${queue}`)) {
            currentsonglist += songlist.get(`${channel.id}-${queue}`) + ", ";
            queue++;
          } else {
            break;
          }
        }

        if (currentsonglist.slice(-2) === ", ") {
          currentsonglist = currentsonglist.slice(0, -2);
        }

        interaction.reply(
          `Sıraya "${selectedsong}" eklendi. Şu andaki sıra: ${currentsonglist} ${loopstatus}`
        );
        return;
      }

      let currentsong = songlist.get(`${channel.id}-1`);
      resource = createAudioResource(`./songs/${currentsong}.mp3`);
      console.log(currentsong);
      player.play(resource);

      currentsongqueueglobal.set(channel.id, currentqueue);

      player.addListener("stateChange", (oldOne, newOne) => {
        console.log(oldOne.status, newOne.status);
        if (oldOne.status == "playing" && newOne.status === "idle") {
          loopstatus = "";
          if (loop.has(channel.id)) {
            loopstatus = "(loop: enabled)";
          }

          if (!(loop.has(channel.id) && loop.get(channel.id))) {
            currentqueue++;
          }

          currentsongqueueglobal.delete(channel.id);
          currentsongqueueglobal.set(channel.id, currentqueue);

          if (!songlist.has(`${channel.id}-${currentqueue}`)) {
            connection.destroy();
            connections.delete(channel.id);
            interaction.followUp("Ses kanalından ayrıldım. <:nice:1076907398264004709>");
            for (let i = 1; i <= currentqueue; i++) {
              songlist.delete(`${channel.id}-${i}`);
            }
            return;
          }

          let currentsong = songlist.get(`${channel.id}-${currentqueue}`);
          console.log(songlist);
          resource = createAudioResource(`./songs/${currentsong}.mp3`);
          player.play(resource);

          if (!(loop.has(channel.id) && loop.get(channel.id))) {
            if (songlist.has(`${channel.id}-${currentqueue + 1}`)) {
              let list_ = Array.from(songlist.values()).slice(currentqueue).join(", ");
              if (list_.slice(-2) === ", ") {
                list_ = list_.slice(0, -2);
              }
              interaction.followUp(`Şu anda "${currentsong}" oynatılıyor, sıradaki şarkılar: ${list_} ${loopstatus}`);
            } else if (songlist.has(`${channel.id}-${currentqueue}`)) {
              interaction.followUp(`Şu anda "${currentsong}" oynatılıyor. ${loopstatus}`);
            }
          }
        }
      });

      if (loop.has(channel.id)) {
        loopstatus = "(loop: enabled)";
      }

      await connection.subscribe(player);
      await interaction.reply({
        content: `Şu anda \"${selectedsong}\" oynatılıyor! ${loopstatus}`,
      });

    } else if (interaction.options.getSubcommand() === "tekrar") {
      if (!channel) {
        return interaction.reply({
          content: "Önce bir ses kanalında bulunman gerekiyor.",
          ephemeral: true,
        });
      }

      if (interaction.options.getBoolean("açkapaamq")) {
        if (loop.has(channel.id)) {
          interaction.reply({
            content: "Şarkı döngüsü zaten etkin.",
            ephemeral: true,
          });
        } else {
          loop.set(channel.id, true);
          interaction.reply({ content: "Şarkı döngüsü etkinleştirildi." });
        }
      } else {
        if (loop.has(channel.id)) {
          loop.delete(channel.id);
          interaction.reply({ content: "Şarkı döngüsü devre dışı bırakıldı." });
        } else {
          interaction.reply({
            content: "Şarkı döngüsü zaten devre dışı.",
            ephemeral: true,
          });
        }
      }
    
    } else if (interaction.options.getSubcommand() === "git") {
      if (!channel) {
        return interaction.reply({
          content: "Herhangi bir ses kanalında değilsin!",
          ephemeral: true,
        });
      }

      let connection = connections.get(channel.id);
      if (connection) {
        for (let i = 1; i <= currentsongqueueglobal.get(channel.id); i++) {
          songlist.delete(`${channel.id}-${i}`);
        }
        connection.destroy();
        connections.delete(channel.id);
        guilds.delete(interaction.guild.id);

        interaction.reply({
          content: "Ses kanalından ayrıldım. <:nice:1076907398264004709>",
        });
      } else {
        interaction.reply({
          content:
            "Bulunduğun ses kanalında değilim... <a:sh2:1017889255973994546>",
        });
      }
    }
  },
};
