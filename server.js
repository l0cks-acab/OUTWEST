import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Game state
const lobbies = new Map();
const players = new Map();

// Lobby class
class Lobby {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.players = new Map();
        this.gameState = {
            started: false,
            players: {},
            bullets: [],
            gameOver: false,
            winner: null
        };
        this.maxPlayers = 2;
    }

    addPlayer(playerId, playerName) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        this.players.set(playerId, {
            id: playerId,
            name: playerName,
            health: 100,
            maxHealth: 100,
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            ready: false
        });
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        if (this.gameState.players[playerId]) {
            delete this.gameState.players[playerId];
        }
    }

    isFull() {
        return this.players.size >= this.maxPlayers;
    }

    allReady() {
        return Array.from(this.players.values()).every(p => p.ready) && this.players.size === this.maxPlayers;
    }
}

// Generate unique lobby ID
function generateLobbyId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate unique player ID
function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('create-lobby', (playerName) => {
        const lobbyId = generateLobbyId();
        const lobby = new Lobby(lobbyId, socket.id);
        
        lobby.addPlayer(socket.id, playerName || 'Player');
        lobbies.set(lobbyId, lobby);
        players.set(socket.id, { lobbyId, playerName: playerName || 'Player' });
        
        socket.join(lobbyId);
        socket.emit('lobby-created', { lobbyId, players: Array.from(lobby.players.values()) });
        console.log(`Lobby ${lobbyId} created by ${socket.id}`);
    });

    socket.on('join-lobby', ({ lobbyId, playerName }) => {
        const lobby = lobbies.get(lobbyId);
        
        if (!lobby) {
            socket.emit('lobby-error', { message: 'Lobby not found' });
            return;
        }

        if (lobby.isFull()) {
            socket.emit('lobby-error', { message: 'Lobby is full' });
            return;
        }

        if (lobby.gameState.started) {
            socket.emit('lobby-error', { message: 'Game already started' });
            return;
        }

        lobby.addPlayer(socket.id, playerName || 'Player');
        players.set(socket.id, { lobbyId, playerName: playerName || 'Player' });
        
        socket.join(lobbyId);
        
        // Notify all players in lobby
        io.to(lobbyId).emit('player-joined', {
            players: Array.from(lobby.players.values()),
            newPlayer: { id: socket.id, name: playerName || 'Player' }
        });
        
        console.log(`Player ${socket.id} joined lobby ${lobbyId}`);
    });

    socket.on('list-lobbies', () => {
        const availableLobbies = Array.from(lobbies.values())
            .filter(lobby => !lobby.isFull() && !lobby.gameState.started)
            .map(lobby => ({
                id: lobby.id,
                players: lobby.players.size,
                maxPlayers: lobby.maxPlayers,
                host: Array.from(lobby.players.values()).find(p => p.id === lobby.hostId)?.name || 'Unknown'
            }));
        
        socket.emit('lobbies-list', availableLobbies);
    });

    socket.on('leave-lobby', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const lobby = lobbies.get(player.lobbyId);
        if (lobby) {
            lobby.removePlayer(socket.id);
            socket.leave(player.lobbyId);
            
            if (lobby.players.size === 0) {
                lobbies.delete(player.lobbyId);
                console.log(`Lobby ${player.lobbyId} deleted (empty)`);
            } else {
                io.to(player.lobbyId).emit('player-left', {
                    players: Array.from(lobby.players.values()),
                    leftPlayer: socket.id
                });
            }
        }
        
        players.delete(socket.id);
    });

    socket.on('player-ready', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const lobby = lobbies.get(player.lobbyId);
        if (!lobby) return;

        const playerData = lobby.players.get(socket.id);
        if (playerData) {
            playerData.ready = true;
            io.to(player.lobbyId).emit('player-ready-updated', {
                players: Array.from(lobby.players.values())
            });

            // Start game if all ready
            if (lobby.allReady() && !lobby.gameState.started) {
                startGame(lobby);
            }
        }
    });

    socket.on('player-move', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const lobby = lobbies.get(player.lobbyId);
        if (!lobby || !lobby.gameState.started) return;

        const playerData = lobby.players.get(socket.id);
        if (playerData && lobby.gameState.players[socket.id]) {
            lobby.gameState.players[socket.id].position = data.position;
            lobby.gameState.players[socket.id].rotation = data.rotation;
            
            // Broadcast to other players
            socket.to(player.lobbyId).emit('player-moved', {
                playerId: socket.id,
                position: data.position,
                rotation: data.rotation
            });
        }
    });

    socket.on('player-shoot', (data) => {
        const player = players.get(socket.id);
        if (!player) return;

        const lobby = lobbies.get(player.lobbyId);
        if (!lobby || !lobby.gameState.started || lobby.gameState.gameOver) return;

        // Create bullet on server
        const bullet = {
            id: Math.random().toString(36).substring(2, 15),
            shooterId: socket.id,
            position: data.position,
            direction: data.direction,
            timestamp: Date.now()
        };

        lobby.gameState.bullets.push(bullet);

        // Broadcast to all players
        io.to(player.lobbyId).emit('bullet-shot', bullet);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        const player = players.get(socket.id);
        if (player) {
            const lobby = lobbies.get(player.lobbyId);
            if (lobby) {
                lobby.removePlayer(socket.id);
                socket.leave(player.lobbyId);
                
                if (lobby.players.size === 0) {
                    lobbies.delete(player.lobbyId);
                    console.log(`Lobby ${player.lobbyId} deleted (empty)`);
                } else {
                    // If game was in progress, end it
                    if (lobby.gameState.started && !lobby.gameState.gameOver) {
                        lobby.gameState.gameOver = true;
                        const remainingPlayer = Array.from(lobby.players.values())[0];
                        lobby.gameState.winner = remainingPlayer.name;
                        io.to(player.lobbyId).emit('game-ended', {
                            winner: remainingPlayer.name,
                            reason: 'opponent_disconnected'
                        });
                    } else {
                        io.to(player.lobbyId).emit('player-left', {
                            players: Array.from(lobby.players.values()),
                            leftPlayer: socket.id
                        });
                    }
                }
            }
            players.delete(socket.id);
        }
    });
});

function startGame(lobby) {
    lobby.gameState.started = true;
    lobby.gameState.gameOver = false;
    lobby.gameState.bullets = [];
    
    // Initialize player positions
    const playerArray = Array.from(lobby.players.values());
    playerArray.forEach((player, index) => {
        lobby.gameState.players[player.id] = {
            id: player.id,
            name: player.name,
            health: 100,
            maxHealth: 100,
            position: { x: index === 0 ? -8 : 8, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0 }
        };
    });

    // Notify all players
    io.to(lobby.id).emit('game-started', {
        players: lobby.gameState.players,
        gameState: lobby.gameState
    });

    // Start game loop
    const gameLoop = setInterval(() => {
        if (!lobby.gameState.started || lobby.gameState.gameOver) {
            clearInterval(gameLoop);
            return;
        }

        // Update bullets
        const BULLET_SPEED = 0.3;
        const BULLET_DAMAGE = 10;
        const ARENA_SIZE = 18;

        lobby.gameState.bullets = lobby.gameState.bullets.filter(bullet => {
            // Move bullet
            bullet.position.x += bullet.direction.x * BULLET_SPEED;
            bullet.position.y += bullet.direction.y * BULLET_SPEED;
            bullet.position.z += bullet.direction.z * BULLET_SPEED;

            // Check bounds
            if (Math.abs(bullet.position.x) > ARENA_SIZE ||
                Math.abs(bullet.position.z) > ARENA_SIZE ||
                bullet.position.y < -5 || bullet.position.y > 20) {
                return false;
            }

            // Check collision with players
            for (const [playerId, playerState] of Object.entries(lobby.gameState.players)) {
                if (playerId === bullet.shooterId) continue;
                
                const distance = Math.sqrt(
                    Math.pow(bullet.position.x - playerState.position.x, 2) +
                    Math.pow(bullet.position.y - playerState.position.y, 2) +
                    Math.pow(bullet.position.z - playerState.position.z, 2)
                );

                if (distance < 1) {
                    // Hit!
                    playerState.health -= BULLET_DAMAGE;
                    
                    io.to(lobby.id).emit('player-hit', {
                        playerId: playerId,
                        health: playerState.health,
                        shooterId: bullet.shooterId
                    });

                    // Check for game over
                    if (playerState.health <= 0) {
                        lobby.gameState.gameOver = true;
                        const winner = lobby.gameState.players[bullet.shooterId];
                        lobby.gameState.winner = winner ? winner.name : 'Unknown';
                        
                        io.to(lobby.id).emit('game-ended', {
                            winner: lobby.gameState.winner,
                            reason: 'elimination'
                        });
                    }

                    return false; // Remove bullet
                }
            }

            return true; // Keep bullet
        });

        // Broadcast game state
        io.to(lobby.id).emit('game-state-update', {
            bullets: lobby.gameState.bullets,
            players: lobby.gameState.players
        });
    }, 16); // ~60fps
}

// API endpoints
app.get('/api/lobbies', (req, res) => {
    const availableLobbies = Array.from(lobbies.values())
        .filter(lobby => !lobby.isFull() && !lobby.gameState.started)
        .map(lobby => ({
            id: lobby.id,
            players: lobby.players.size,
            maxPlayers: lobby.maxPlayers,
            host: Array.from(lobby.players.values()).find(p => p.id === lobby.hostId)?.name || 'Unknown'
        }));
    
    res.json(availableLobbies);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Game server ready for connections`);
});

