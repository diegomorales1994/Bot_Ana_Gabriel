# Discord Music Bot 🎶

Este es un bot de música para Discord que permite reproducir canciones desde YouTube en canales de voz. Incluye una interfaz interactiva con botones para pausar, saltar, repetir, ver la cola y mezclar canciones, además de una barra de progreso visual estática.

## Características

- Comandos para controlar la música (`!play`, `!pause`, `!resume`, `!skip`, `!stop`, `!queue`, `!previous`)
- Controles visuales con botones en el chat
- Barra de progreso visual simulada
- Soporte para loop y mezcla de cola
- Totalmente en español

## Requisitos

- Node.js >= 18
- Una aplicación de bot en el [Portal de desarrolladores de Discord](https://discord.com/developers/applications)
- Token del bot
- Canal de voz en tu servidor de Discord

## Instalación

1. Clona este repositorio o descarga el proyecto:

```bash
git clone https://github.com/tuusuario/music-bot.git
cd music-bot
```

2. Instala las dependencias:

```bash
npm install
```

3. Crea un archivo `.env` y añade tu token:

```env
DISCORD_TOKEN=TU_TOKEN_DEL_BOT
```

4. Ejecuta el bot:

```bash
npm start
```

## Uso

Escribe comandos como:

```
!play https://www.youtube.com/watch?v=...
!pause
!resume
!skip
!stop
!queue
!previous
```

## Créditos

- [discord.js](https://discord.js.org/)
- [yt-search](https://www.npmjs.com/package/yt-search)
- [@discordjs/voice](https://www.npmjs.com/package/@discordjs/voice)
- Inspirado por bots de música populares para Discord

---

🎵 ¡Disfruta tu música sin salir de Discord!
