
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
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

    const song = { title: video.title, url: video.url };

    if (!serverQueue) {
      const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        player: createAudioPlayer(),
        currentSong: null,
        previousSongs: []
      };

      queue.set(message.guild.id, queueContruct);
      queueContruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        queueContruct.connection = connection;
        playSong(message.guild, queueContruct.songs[0]);
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

  if (command === '!skip') {
    if (!serverQueue) return message.reply('❌ No hay canción para saltar.');
    serverQueue.player.stop();
    return message.channel.send('⏭️ Canción saltada.');
  }

  if (command === '!stop') {
    if (!serverQueue) return message.reply('❌ Nada que detener.');
    serverQueue.songs = [];
    serverQueue.player.stop();
    queue.delete(message.guild.id);
    return message.channel.send('⏹️ Reproducción detenida.');
  }

  if (command === '!pause') {
    if (!serverQueue) return message.reply('❌ No hay música en reproducción.');
    serverQueue.player.pause();
    return message.channel.send('⏸️ Música pausada.');
  }

  if (command === '!resume') {
    if (!serverQueue) return message.reply('❌ No hay música en reproducción.');
    serverQueue.player.unpause();
    return message.channel.send('▶️ Música reanudada.');
  }

  if (command === '!previous') {
    if (!serverQueue || serverQueue.previousSongs.length === 0) {
      return message.reply('❌ No hay una canción anterior.');
    }

    const prev = serverQueue.previousSongs.pop();
    serverQueue.songs.unshift(prev);
    serverQueue.player.stop();
    return message.channel.send(`🔙 Reproduciendo anterior: **${prev.title}**`);
  }

  if (command === '!queue') {
    if (!serverQueue) return message.reply('❌ La cola está vacía.');
    const titles = serverQueue.songs.map((song, i) => `${i + 1}. ${song.title}`);
    return message.channel.send(`📜 Cola:
${titles.join('\n')}`);
  }
});

function playSong(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    queue.delete(guild.id);
    return;
  }

  serverQueue.currentSong = song;

  const stream = ytdl(song.url, {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
    dlChunkSize: 0
  });

  const resource = createAudioResource(stream);
  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  serverQueue.textChannel.send(`🎶 Reproduciendo: **${song.title}**`);

  serverQueue.player.on(AudioPlayerStatus.Idle, () => {
    serverQueue.previousSongs.push(serverQueue.currentSong);
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  });

  serverQueue.player.on('error', error => {
    console.error(error);
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  });
}

client.login(TOKEN);
