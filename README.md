# Cyberpunk Western Arena - Online Multiplayer 1v1 Shooter

A gritty cyberpunk spaghetti western arena shooter with online multiplayer support and lobby-based matchmaking.

## Features

- 🎮 **Online Multiplayer**: Real-time 1v1 battles with other players
- 🏠 **Lobby System**: Create or join lobbies to find opponents
- 🎨 **Cyberpunk Aesthetic**: Neon lights, gritty visuals, and western-themed arena
- ⚡ **Real-time Sync**: Smooth player movement and bullet synchronization
- 🎯 **Combat System**: Health-based combat with visual feedback

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run server
```

3. In a new terminal, start the client:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173` (or the port Vite assigns)

## How to Play

1. **Enter your name** in the start screen
2. **Create a lobby** or **join an existing lobby**
3. **Click "READY"** when you're prepared to play
4. Once both players are ready, the game starts automatically
5. **Move** with WASD keys
6. **Aim** with your mouse
7. **Shoot** with left mouse button
8. Eliminate your opponent to win!

## Controls

- **WASD** - Move
- **Mouse** - Aim
- **Left Click** - Shoot

## Server Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm run server
```

## Technology Stack

- **Three.js** - 3D graphics and rendering
- **Socket.io** - Real-time multiplayer communication
- **Express** - Server framework
- **Vite** - Development server and build tool

## Project Structure

```
├── server.js          # Socket.io server and game logic
├── main.js            # Client-side Three.js game
├── index.html         # HTML structure
├── style.css          # Cyberpunk UI styling
└── package.json       # Dependencies
```

## Development

- Server: `npm run server`
- Client: `npm run dev`
- Build: `npm run build`

Enjoy the arena, gunslinger! 🤠⚡

