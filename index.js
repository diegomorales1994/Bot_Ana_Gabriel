import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import axios from 'axios';
import https from 'https';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
});

// 🔧 Función para dividir mensajes largos
function dividirMensaje(mensaje, limite = 2000) {
  const partes = [];
  for (let i = 0; i < mensaje.length; i += limite) {
    partes.push(mensaje.slice(i, i + limite));
  }
  return partes;
}

// 🔗 Función para consultar a OpenRouter (modelo DeepSeek)
async function consultarGemini(prompt, imageBase64 = null, mimeType = 'image/png') {
  const headers = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://tu-proyecto.com',
    'X-Title': 'DiscordGPTBot'
  };

  const content = [{ type: 'text', text: prompt || 'Describe esta imagen' }];

  if (imageBase64) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`
      }
    });
  }

  const body = {
    model: 'deepseek/deepseek-prover-v2:free',
    messages: [
      {
        role: 'user',
        content: content
      }
    ]
  };

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    body,
    { headers }
  );

  return response.data.choices[0].message.content;
}

// 📩 Escuchar mensajes en Discord
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith('!gpt')) return;

  const prompt = message.content.slice(4).trim();

  try {
    // 📷 Imagen adjunta
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType?.startsWith('image/')) {
        const imageBuffer = await axios.get(attachment.url, {
          responseType: 'arraybuffer',
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });

        const imageBase64 = Buffer.from(imageBuffer.data).toString('base64');
        const respuesta = await consultarGemini(prompt, imageBase64, attachment.contentType);

        const partes = dividirMensaje(respuesta);
        for (const parte of partes) {
          await message.channel.send(parte);
        }
        return;
      }
    }

    // 🧠 Solo texto
    if (!prompt) return message.reply('❌ Escribe algo después de `!gpt`');

    const respuesta = await consultarGemini(prompt);
    const partes = dividirMensaje(respuesta);
    for (const parte of partes) {
      await message.channel.send(parte);
    }

  } catch (error) {
    console.error('❌ Error:', error?.response?.data || error.message);
    message.reply('❌ Ocurrió un error al procesar tu solicitud.');
  }
});

client.login(process.env.DISCORD_TOKEN);

