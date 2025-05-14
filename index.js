// index.js - Bot musical Ana Gabriel completo con interfaz visual, barra de progreso y botones

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const queue = new Map();

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const serverQueue = queue.get(message.guild.id);
  const args = message.content.split(' ');
  const command = args.shift().toLowerCase();
  const query = args.join(' ');

  if (command === '!play') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('🎧 Únete a un canal de voz primero.');

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return message.reply('❌ No tengo permisos para unirme o hablar en ese canal.');
    }

    const searchResult = await ytSearch(query);
    const video = searchResult.videos.find(v => !v.live) || searchResult.videos[0];
    if (!video) return message.reply('❌ No encontré resultados.');

    const song = {
  title: video.title,
  url: video.url,
  duration: video.duration?.seconds || 180 // fallback seguro
};

    if (!serverQueue) {
      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        currentSong: null,
        previousSongs: [],
        loop: false,
        progressMessage: null,
        progressSeconds: 0
      };

      queue.set(message.guild.id, queueConstruct);
      queueConstruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        queueConstruct.connection = connection;
        playSong(message.guild, queueConstruct.songs[0]);
      } catch (err) {
        console.error(err);
        queue.delete(message.guild.id);
        return message.reply('❌ Error al unirme al canal de voz.');
      }
    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`✅ Añadido a la cola: **${song.title}**`);
    }
  }
});

function playSong(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    queue.delete(guild.id);
    return;
  }

  serverQueue.currentSong = song;
  serverQueue.progressSeconds = 0;

  const stream = ytdl(song.url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
  const resource = createAudioResource(stream);
  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('previous').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('queue').setEmoji('📜').setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setColor(0x1DB954)
    .setTitle('🎶 Reproduciendo')
    .setDescription(`[${song.title}](${song.url})`)
    .setFooter({ text: '⏳ Cargando barra de progreso...' });

  serverQueue.textChannel.send({ embeds: [embed], components: [row1, row2] }).then(msg => {
    serverQueue.progressMessage = msg;
  });

  const interval = setInterval(async () => {
    if (!serverQueue || !serverQueue.progressMessage) return clearInterval(interval);
    if (serverQueue.player.state.status !== AudioPlayerStatus.Playing) return;
    serverQueue.progressSeconds += 10;

    const progressBar = createProgressBar(serverQueue.progressSeconds, song.duration);

    const updated = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎶 Reproduciendo')
      .setDescription(`[${song.title}](${song.url})\n${progressBar}`);

    try {
      await serverQueue.progressMessage.edit({ embeds: [updated] });
    } catch (e) {
      console.warn('❌ No se pudo actualizar la barra:', e.message);
    }
  }, 10000);

  const collector = serverQueue.textChannel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

  collector.on('collect', async interaction => {
    const safeReply = async (content) => {
      try {
        await interaction.deferUpdate();
        await interaction.followUp({ content, ephemeral: true });
      } catch (e) {}
    };

    switch (interaction.customId) {
      case 'pause':
        if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
          serverQueue.player.pause();
          await safeReply('⏸️ Música pausada');
        } else {
          serverQueue.player.unpause();
          await safeReply('▶️ Música reanudada');
        }
        break;
      case 'skip':
        serverQueue.player.stop();
        await safeReply('⏭️ Canción saltada');
        break;
      case 'previous':
        const prev = serverQueue.previousSongs.pop();
        if (prev) {
          serverQueue.songs.unshift(prev);
          serverQueue.player.stop();
          await safeReply('🔙 Reproduciendo canción anterior');
        } else {
          await safeReply('❌ No hay canción anterior');
        }
        break;
      case 'loop':
        serverQueue.loop = !serverQueue.loop;
        await safeReply(serverQueue.loop ? '🔁 Modo repetir ACTIVADO' : '➡️ Modo repetir DESACTIVADO');
        break;
      case 'shuffle':
        if (serverQueue.songs.length > 1) {
          const current = serverQueue.songs.shift();
          serverQueue.songs.sort(() => Math.random() - 0.5);
          serverQueue.songs.unshift(current);
          await safeReply('🔀 Canciones mezcladas');
        } else {
          await safeReply('❌ No hay suficientes canciones para mezclar');
        }
        break;
      case 'queue':
        const list = serverQueue.songs.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
        await safeReply(`📜 Cola actual:\n${list}`);
        break;
    }
  });

  serverQueue.player.on(AudioPlayerStatus.Idle, () => {
    if (serverQueue.loop) {
      playSong(guild, serverQueue.currentSong);
    } else {
      serverQueue.previousSongs.push(serverQueue.currentSong);
      serverQueue.songs.shift();
      playSong(guild, serverQueue.songs[0]);
    }
  });

  serverQueue.player.on('error', error => {
    console.error(error);
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  });
}

function createProgressBar(currentSeconds = 0, totalSeconds = 180) {
  const barLength = 20;
  if (!Number.isFinite(currentSeconds)) currentSeconds = 0;
  if (!Number.isFinite(totalSeconds) || totalSeconds === 0) totalSeconds = 180;

  const progress = Math.min(currentSeconds / totalSeconds, 1);
  const filled = Math.max(0, Math.round(progress * barLength));
  const empty = Math.max(0, barLength - filled);

  return `\n[${'='.repeat(filled)}${' '.repeat(empty)}] ${formatTime(currentSeconds)} / ${formatTime(totalSeconds)}`;
}

function formatTime(seconds = 0) {
  if (!Number.isFinite(seconds)) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}



function timeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

client.login(TOKEN);
