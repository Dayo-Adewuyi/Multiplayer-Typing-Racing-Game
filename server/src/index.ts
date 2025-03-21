import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { startSocketServer } from './socket';
import rateLimit from 'express-rate-limit';
import { createMonitoringRoutes } from './service/monitoring-service';
import { SelfHealingService } from './service/selfHealing-service';
import config from './config/config';
import logger from './utils/logger';
import { GameState } from './shared/types/events';
import { GameService } from './service/game-service';
import { Request, Response, NextFunction } from 'express';



const app = express();

app.use(helmet());


app.use(cors({
  origin: config.clientUrl,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: 'Too many requests from this IP, please try again after 15 minutes'
});


app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', environment: config.env });
});

const server = http.createServer(app);

const socketServer = startSocketServer(server);

const gameService = new GameService(socketServer);

app.use('/api/monitor', createMonitoringRoutes(gameService));

const selfHealingService = new SelfHealingService(gameService);

if (config.env === 'production') {
  selfHealingService.start();
  logger.info('Self-healing system activated for production environment');
} else {
  app.get('/api/debug/self-healing/start', (_req, res) => {
    selfHealingService.start();
    res.status(200).json({ status: 'ok', message: 'Self-healing system started' });
  });
  
  app.get('/api/debug/self-healing/stop', (_req, res) => {
    selfHealingService.stop();
    res.status(200).json({ status: 'ok', message: 'Self-healing system stopped' });
  });
  
  logger.info('Self-healing system available in development but not auto-started');
}

const gameRouter = express.Router();

/**
 * Get list of all active games
 * GET /api/game/games
 */
gameRouter.get('/games', (_req, res) => {
  try {
    const games = gameService.getAllGames();
    res.status(200).json({
      status: 'ok',
      count: games.length,
      games,
      systemProtection: {
        acceptingNewPlayers: gameService.isAcceptingNewPlayers(),
        throttlingEnabled: gameService.isThrottlingEnabled(),
        replayResolution: gameService.getReplayResolution(),
        gameCreationQueueEnabled: gameService.isGameCreationQueueEnabled(),
        queueSize: gameService.getGameCreationQueueSize()
      }
    });
  } catch (error) {
    logger.error('Error listing games', { error });
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving games'
    });
  }
});

/**
 * Get detailed information about a specific game
 * GET /api/game/:gameId
 */
gameRouter.get('/games/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const gameState = gameService.getGameState(gameId);
    
   return res.status(200).json({
      status: 'ok',
      game: {
        id: gameState.id,
        state: gameState.state,
        players: gameState.players.map(player => ({
          id: player.id,
          name: player.name,
          position: player.position,
          wpm: player.wpm,
          accuracy: player.accuracy,
          isConnected: player.isConnected,
          isSpectator: player.isSpectator,
          isReady: player.isReady,
          finishTime: player.finishTime
        })),
        startTime: gameState.startTime,
        endTime: gameState.endTime,
        maxPlayers: gameState.maxPlayers,
        countdown: gameState.countdown,
        text: gameState.state === GameState.WAITING ? gameState.text : undefined
      }
    });
  } catch (error) {
    logger.error('Error getting game details', { error, gameId: req.params.gameId });
    
    if (error instanceof Error && error.name === 'GameNotFoundError') {
      return res.status(404).json({
        status: 'error',
        message: `Game with ID ${req.params.gameId} not found`
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving game details'
    });
  }
});

/**
 * Create a new game
 * POST /api/game/create
 */
gameRouter.post('/create', (req, res) => {
  try {
    const { playerId, playerName, maxPlayers } = req.body;
    
    if (!playerId || !playerName) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: playerId, playerName'
      });
    }
    
    const result = gameService.createGame(
      playerId,
      playerName,
      maxPlayers || config.maxPlayersPerGame
    );
    
    return res.status(201).json({
      status: 'ok',
      gameId: result.gameId,
      player: result.player,
      maxPlayers: maxPlayers || config.maxPlayersPerGame
    });
  } catch (error) {
    logger.error('Error creating game', { error, body: req.body });
    
    if (error instanceof Error && error.message.includes('Game creation has been queued')) {
      return res.status(202).json({
        status: 'queued',
        message: 'Game creation has been queued due to high server load. Please try connecting via WebSocket in a moment.'
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Error creating game'
    });
  }
});

/**
 * Join an existing game
 * POST /api/game/join
 */
gameRouter.post('/join', (req, res) => {
  try {
    const { playerId, playerName, gameId } = req.body;
    
    if (!playerId || !playerName) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: playerId, playerName'
      });
    }
    
    const result = gameService.joinGame(playerId, { playerName, gameId });
    
   return res.status(200).json({
      status: 'ok',
      gameId: result.gameId,
      player: result.player,
      isSpectator: result.isSpectator || false
    });
  } catch (error) {
    logger.error('Error joining game', { error, body: req.body });
    
    if (error instanceof Error && error.name === 'GameNotFoundError') {
      return res.status(404).json({
        status: 'error',
        message: `Game with ID ${req.body.gameId} not found`
      });
    }
    
    if (error instanceof Error && error.name === 'GameFullError') {
      return res.status(409).json({
        status: 'error',
        message: `Game with ID ${req.body.gameId} is full`
      });
    }
    
    if (error instanceof Error && error.name === 'PlayerAlreadyExistsError') {
      return res.status(409).json({
        status: 'error',
        message: `Player ${req.body.playerId} is already in game ${req.body.gameId}`
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Error joining game'
    });
  }
});

/**
 * Get player stats
 * GET /api/game/player/:playerId/games
 */
gameRouter.get('/player/:playerId/games', (req, res) => {
  try {
    const { playerId } = req.params;
    const gameIds = gameService.getPlayerGames(playerId);
    
    const games = gameIds.map(gameId => {
      try {
        const gameState = gameService.getGameState(gameId);
        return {
          id: gameState.id,
          state: gameState.state,
          playerCount: gameState.players.filter(p => !p.isSpectator).length,
          startTime: gameState.startTime,
          endTime: gameState.endTime
        };
      } catch (error) {
        return null;
      }
    }).filter(Boolean);
    
    res.status(200).json({
      status: 'ok',
      count: games.length,
      games
    });
  } catch (error) {
    logger.error('Error getting player games', { error, playerId: req.params.playerId });
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving player games'
    });
  }
});

/**
 * System status endpoint
 * GET /api/game/system/status
 */
gameRouter.get('/system/status', (_req, res) => {
  try {
    const status = gameService.getSystemStatus();
    const stats = gameService.getStats();
    
    res.status(200).json({
      status: 'ok',
      system: {
        ...status,
        stats
      }
    });
  } catch (error) {
    logger.error('Error getting system status', { error });
    res.status(500).json({
      status: 'error',
      message: 'Error retrieving system status'
    });
  }
});

/**
 * Admin endpoints - these should be protected in production
 */
if (config.env !== 'production') {
  gameRouter.post('/admin/toggleNewPlayers', (req, res) => {
    const { accepting } = req.body;
    
    if (typeof accepting !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: accepting (boolean)'
      });
    }
    
    gameService.setAcceptingNewPlayers(accepting);
    
    return res.status(200).json({
      status: 'ok',
      message: `${accepting ? 'Enabled' : 'Disabled'} accepting new players`,
      accepting
    });
  });
  
  gameRouter.post('/admin/toggleThrottling', (req, res) => {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required field: enabled (boolean)'
      });
    }
    
    if (enabled) {
      gameService.enableThrottling();
    } else {
      gameService.disableThrottling();
    }
    
    return res.status(200).json({
      status: 'ok',
      message: `${enabled ? 'Enabled' : 'Disabled'} operation throttling`,
      throttlingEnabled: gameService.isThrottlingEnabled()
    });
  });
  
  gameRouter.post('/admin/setUpdateFrequency', (req, res) => {
    const { mode } = req.body;
    
    if (mode !== 'normal' && mode !== 'low') {
      return res.status(400).json({
        status: 'error',
        message: "Invalid mode. Must be 'normal' or 'low'"
      });
    }
    
    gameService.setUpdateFrequency(mode);
    
    return res.status(200).json({
      status: 'ok',
      message: `Set update frequency to ${mode}`,
      updateFrequencyMode: gameService.getUpdateFrequencyMode()
    });
  });
  
  gameRouter.post('/admin/terminateIdleGames', (_req, res) => {
    const terminatedCount = gameService.terminateIdleGames();
    
    res.status(200).json({
      status: 'ok',
      message: `Terminated ${terminatedCount} idle games`,
      terminatedCount
    });
  });
  
  gameRouter.post('/admin/setMaxPlayers', (req, res) => {
    const { maxPlayers } = req.body;
    
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 20) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid maxPlayers. Must be an integer between 2 and 20'
      });
    }
    
    gameService.setMaxPlayersForNewGames(maxPlayers);
    
    return res.status(200).json({
      status: 'ok',
      message: `Set max players for new games to ${maxPlayers}`,
      maxPlayers
    });
  });
  
  gameRouter.post('/admin/clearCaches', (_req, res) => {
    gameService.clearCaches();
    
    return res.status(200).json({
      status: 'ok',
      message: 'Cleared caches'
    });
  });
}

gameService.registerReplayEndpoints(gameRouter);

app.use('/api/game', gameRouter);

app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

interface ErrorWithStack extends Error {
  stack?: string;
}

app.use((err: ErrorWithStack, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error in request', { 
    error: err.stack || err.message || err,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred'
  });
});

function gracefulShutdown() {
  logger.info('Shutting down services gracefully...');
  
  selfHealingService.stop();
  
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

server.listen(config.port, () => {
  logger.info(`Server started on port ${config.port} with self-healing capability`, {
    port: config.port,
    environment: config.env,
    clientUrl: config.clientUrl
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.stack });
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export { app, server };