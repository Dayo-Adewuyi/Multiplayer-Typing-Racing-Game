# Multiplayer Typing Racing Game

A real-time multiplayer typing racing platform where users can race against each other by typing provided texts as quickly and accurately as possible.



## Overview

This is a modern web application that allows users to compete in real-time typing races. The system is built with a focus on scalability, performance, and resilience with automatic self-healing capabilities to handle high traffic and maintain stability.

## Key Features

- **Real-time Multiplayer Racing**: Compete against others in real-time typing races
- **Live Progress Tracking**: See your competitors' progress as you type
- **Performance Metrics**: Measure your typing speed (WPM) and accuracy
- **Race Replays**: Watch replays of completed races
- **Spectator Mode**: Join ongoing races as a spectator
- **Self-healing Architecture**: Automatic system adaptation to handle load spikes
- **Scalable Backend**: Designed to handle thousands of concurrent players
- **Low-latency Updates**: Optimized socket communication for smooth experience

## Architecture

The project follows a client-server architecture with the following components:

### Backend (Server)

- **TypeScript/Node.js**: Strong typing for better reliability and development experience
- **Express**: HTTP API server for RESTful endpoints
- **Socket.IO**: WebSocket communication for real-time game updates
- **Winston**: Structured logging for monitoring and debugging
- **Self-healing Service**: Automatic system adaptation under high load

### Frontend (Client)

- React
- Socket.IO client for real-time communication
- Responsive design for desktop and mobile play

## Technical Approach

### Real-time Game Engine

The core of this app is a real-time game engine built with Socket.IO for bidirectional communication between the client and server. The system prioritizes:

1. **Low Latency**: Critical for real-time racing experience
2. **Fault Tolerance**: Handling disconnections gracefully
3. **Scalability**: Ability to run many concurrent games

### State Management

Games progress through a well-defined state machine:
- `WAITING`: Players joining, not yet started
- `COUNTDOWN`: 3-second countdown before race begins
- `RACING`: Active race with real-time updates
- `FINISHED`: Race completed, results displayed

### Self-healing System

The server includes a sophisticated self-healing system that automatically adjusts to system load:

- **Memory Management**: Reduces memory usage under high pressure
- **Load Balancing**: Adjusts update frequency based on system load
- **Resource Allocation**: Prioritizes critical operations during high traffic
- **Operation Throttling**: Prevents system overload during peak usage

### Performance Optimizations

- **Throttled Updates**: Reduced update frequency during high system load
- **Replay Resolution Control**: Adaptive replay data collection
- **Game Lifecycle Management**: Automatic cleanup of completed games
- **Task Queuing**: Prioritization system for resource-intensive operations

## Getting Started

### Prerequisites

- Node.js (v16 or newer)
- npm (v7 or newer)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Dayo-Adewuyi/type-racing-game.git
   cd type-racing-game
   ```

2. Set up the server:
   ```bash
   cd server
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Set up the client:
   ```bash
   cd ../client
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Starting the Application

#### Using the Startup Script

We provide a comprehensive startup script that handles environment configuration, dependency installation, and process management:

```bash
# Make the script executable
chmod +x setup.sh

# Start both server and client in development mode
./setup.sh

# Start in production mode
./setup.sh --prod

# Start only the server
./setup.sh --server-only

# Start only the client
./setup.sh --client-only

# Show help
./setup.sh --help
```

#### Manual Startup

**Server:**
```bash
cd server
npm run dev     # Development mode
# OR
npm run build   # Build for production
npm start       # Start production server
```

**Client:**
```bash
cd client
npm start       # Development mode
# OR
npm run build   # Build for production
npx serve -s build # Serve production build
```

### Environment Configuration

#### Server (.env)

```
# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CLIENT_URL=http://localhost:3000

# Game Configuration
MAX_PLAYERS_PER_GAME=4
COUNTDOWN_SECONDS=3
MAX_RACE_TIME_MINUTES=3
CLEANUP_DELAY_MINUTES=5

# Logging
LOG_LEVEL=info
```

#### Client (.env)

```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
PORT=3000
```

## System Architecture

### Server Components

The server architecture follows a modular approach with several key components:

#### Game Service

The central component that manages game state, player interactions, and real-time updates:

- Game creation and lifecycle management
- Player joining, leaving, and reconnection handling
- Real-time progress tracking and synchronization
- Race completion and results calculation
- Replay data collection and storage

#### Text Service

Manages the text content used in typing races:

- Text selection for races
- Support for different text lengths and difficulties
- Text validation and normalization

#### Socket Service

Handles WebSocket communication with clients:

- Bidirectional real-time updates
- Event-based communication
- Connection management and error handling

#### Self-Healing Service

Automatic system adaptation for high-load scenarios:

- System health monitoring
- Adaptive resource management
- Performance optimization under load
- Automatic recovery from stress conditions

#### Monitoring Service

Comprehensive system monitoring and metrics collection:

- Health checks and diagnostics
- Performance metrics collection
- System load monitoring
- Request/response tracking

### Data Flow

1. Client connects via WebSocket to join/create a game
2. Server validates request and updates game state
3. Server broadcasts game state changes to all connected clients
4. During racing, clients send progress updates to server
5. Server validates progress, updates game state, and broadcasts updates
6. When the race completes, server calculates results and stores replay data
7. Clients can request replay data for completed races

## API Reference

### WebSocket Events

#### Client to Server

| Event | Description | Payload |
|-------|-------------|---------|
| `join_game` | Join an existing game | `{ playerName: string, gameId?: string }` |
| `create_game` | Create a new game | `{ playerName: string, maxPlayers?: number }` |
| `player_ready` | Mark player as ready | `{ gameId: string }` |
| `update_progress` | Update typing progress | `{ gameId: string, currentIndex: number, wpm: number, accuracy: number }` |
| `player_finished` | Mark player as finished | `{ gameId: string, wpm: number, accuracy: number, finishTime: number }` |
| `leave_game` | Leave a game | `{ gameId: string }` |
| `get_replay` | Request race replay | `{ gameId: string }` |

#### Server to Client

| Event | Description | Payload |
|-------|-------------|---------|
| `game_state_update` | Game state changed | `{ gameState: GameSession, playerId?: string, type?: string }` |
| `player_joined` | New player joined | `{ gameState: GameSession, player: Player }` |
| `player_left` | Player left game | `{ gameState: GameSession, playerId: string }` |
| `game_countdown` | Game countdown update | `{ gameId: string, countdown: number }` |
| `game_started` | Race started | `{ gameId: string, startTime: number }` |
| `game_finished` | Race finished | `{ gameState: GameSession, summary: RaceSummary }` |
| `replay_data` | Race replay data | `{ replay: RaceReplay }` |
| `error` | Error message | `{ message: string, code: string }` |

### HTTP Endpoints

#### Game Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/game/games` | GET | List all active games |
| `/api/game/games/:gameId` | GET | Get game details |
| `/api/game/create` | POST | Create a new game |
| `/api/game/join` | POST | Join an existing game |
| `/api/game/player/:playerId/games` | GET | Get player's games |

#### Replays

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/game/replays` | GET | List available replays |
| `/api/game/replays/:gameId` | GET | Get specific replay |

#### System Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/game/system/status` | GET | Get system status |
| `/api/monitor/health` | GET | Health check endpoint |
| `/api/monitor/health/details` | GET | Detailed health information |

## Performance Considerations

### Scaling Strategies

1. **Horizontal Scaling**: Add more server instances behind a load balancer
2. **Game Sharding**: Distribute games across server instances
3. **Database Scaling**: Add caching and read replicas for persistence layer

### Memory Management

The server implements several strategies to manage memory efficiently:

- **Replay Data Pruning**: Older replay data is automatically cleaned up
- **Game Lifecycle Management**: Completed games are removed after a delay
- **Adaptive Data Collection**: Reduced data collection during high load

### Network Optimization

- **Throttled Updates**: Reduced update frequency during high load
- **Selective Broadcasting**: Send updates only to relevant clients
- **Message Compression**: Minimize packet size for efficient transmission




