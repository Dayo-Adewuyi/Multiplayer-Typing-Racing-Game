import { Server } from 'socket.io';
import config from './config/config';
import { GameService } from './service/game-service';
import {
  ClientEvents,
  ServerEvents,
  ProgressUpdatePayload,
  PlayerFinishedPayload,
  PlayerJoinPayload
} from './shared/types/events';
import logger from './utils/logger';
import {
  GameNotFoundError,
  GameFullError,
  PlayerNotFoundError,
  PlayerAlreadyExistsError
} from './utils/error';

import http from 'http';

export function setupSocketServer(httpServer: http.Server): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  const gameService = new GameService(io);

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('disconnect', () => {
      handlePlayerDisconnect(socket.id);
      logger.info('Client disconnected', { socketId: socket.id });
    });

    socket.on(ClientEvents.CREATE_GAME, (payload: { playerName: string; maxPlayers?: number }) => {
      try {
        const { gameId, player } = gameService.createGame(
          socket.id,
          payload.playerName,
          payload.maxPlayers
        );

        socket.join(gameId);

        socket.emit(ServerEvents.GAME_STATE_UPDATE, {
          gameId,
          player,
          gameState: gameService.getGameState(gameId)
        });

        io.to(gameId).emit(ServerEvents.PLAYER_JOINED, {
          gameState: gameService.getGameState(gameId),
          player
        });

        logger.info('Game created event emitted', { gameId, socketId: socket.id });
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.JOIN_GAME, (payload: PlayerJoinPayload) => {
      try {
        const { gameId, player, isSpectator } = gameService.joinGame(socket.id, payload);

        socket.join(gameId);

        socket.emit(ServerEvents.GAME_STATE_UPDATE, {
          gameId,
          player,
          isSpectator,
          gameState: gameService.getGameState(gameId)
        });

        io.to(gameId).emit(ServerEvents.PLAYER_JOINED, {
          gameState: gameService.getGameState(gameId),
          player
        });

        logger.info(isSpectator ? 'Spectator joined game' : 'Player joined game', {
          gameId,
          socketId: socket.id,
          playerName: player.name
        });
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.PLAYER_READY, (payload: { gameId: string }) => {
      try {
        const gameState = gameService.playerReady(payload.gameId, socket.id);

        io.to(payload.gameId).emit(ServerEvents.GAME_STATE_UPDATE, {
          gameState,
          playerId: socket.id,
          type: 'player_ready'
        });

        logger.info('Player ready', {
          gameId: payload.gameId,
          socketId: socket.id
        });

        const canStart = gameService.canStartGame(payload.gameId);
        if (canStart) {
          gameService.startCountdown(payload.gameId);
        }
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.UPDATE_PROGRESS, (payload: ProgressUpdatePayload) => {
      try {
        gameService.updatePlayerProgress(
          payload.gameId,
          socket.id,
          payload.currentIndex,
          payload.wpm,
          payload.accuracy
        );

        const gameState = gameService.getGameState(payload.gameId);
        
        // Only emit to other players at a throttled rate to reduce network traffic
        const throttledEmit = gameService.isThrottlingEnabled() && 
          gameService.getUpdateFrequencyMode() === 'low';
        
        if (!throttledEmit || Math.random() < 0.2) { // Emit ~20% of updates when throttling
          io.to(payload.gameId).emit(ServerEvents.GAME_STATE_UPDATE, {
            gameState,
            playerId: socket.id,
            type: 'progress_update'
          });
        }
      } catch (error) {
        // Don't send error to client for progress updates to avoid spam
        logger.warn('Error updating progress', { error, socketId: socket.id });
      }
    });

    socket.on(ClientEvents.PLAYER_FINISHED, (payload: PlayerFinishedPayload) => {
      try {
        const allFinished = gameService.playerFinished(
          payload.gameId,
          socket.id,
          payload.wpm,
          payload.accuracy,
          payload.finishTime
        );

        const gameState = gameService.getGameState(payload.gameId);

        io.to(payload.gameId).emit(ServerEvents.GAME_STATE_UPDATE, {
          gameState,
          playerId: socket.id,
          type: 'player_finished'
        });

        logger.info('Player finished', {
          gameId: payload.gameId,
          socketId: socket.id,
          wpm: payload.wpm,
          accuracy: payload.accuracy
        });

        // If all players have finished, emit an additional event
        if (allFinished) {
          const replay = gameService.getRaceReplay(payload.gameId);
          
          // Get the complete game state with final positions
          const finalGameState = gameService.getGameState(payload.gameId);
          
          // Calculate rankings and statistics
          const activePlayers = finalGameState.players.filter(
            p => p.isConnected && !p.isSpectator
          );
          
          const rankedPlayers = [...activePlayers]
            .sort((a, b) => {
              if (b.position === a.position) {
                return (a.finishTime || Infinity) - (b.finishTime || Infinity);
              }
              return b.position - a.position;
            })
            .map((player, index) => ({
              id: player.id,
              name: player.name,
              rank: index + 1,
              wpm: player.wpm,
              accuracy: player.accuracy,
              finished: player.position >= 100
            }));
            
          const totalWpm = activePlayers.reduce((sum, p) => sum + p.wpm, 0);
          const avgWpm = activePlayers.length > 0 ? totalWpm / activePlayers.length : 0;
          
          const totalAccuracy = activePlayers.reduce((sum, p) => sum + p.accuracy, 0);
          const avgAccuracy = activePlayers.length > 0 ? totalAccuracy / activePlayers.length : 0;
          
          const totalRaceTime = finalGameState.endTime! - (finalGameState.startTime || finalGameState.endTime!);
          
          const raceSummary = {
            gameId: payload.gameId,
            totalTime: totalRaceTime,
            rankings: rankedPlayers,
            stats: {
              avgWpm,
              avgAccuracy,
              finishRate: 1.0 // All players finished
            },
            replayAvailable: !!replay
          };
          
          // Emit the summary to all clients in the game
          io.to(payload.gameId).emit(ServerEvents.GAME_FINISHED, {
            gameState: finalGameState,
            summary: raceSummary
          });
          
          logger.info('All players finished race', {
            gameId: payload.gameId,
            totalTime: totalRaceTime,
            playerCount: activePlayers.length
          });
        }
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.LEAVE_GAME, (payload: { gameId: string }) => {
      try {
        handlePlayerLeaveGame(socket.id, payload.gameId);
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.GET_REPLAY, (payload: { gameId: string }) => {
      try {
        const replay = gameService.getRaceReplay(payload.gameId);

        if (replay) {
          socket.emit(ServerEvents.REPLAY_DATA, { replay });
          logger.info('Replay data sent', { gameId: payload.gameId, socketId: socket.id });
        } else {
          socket.emit(ServerEvents.ERROR, {
            message: 'Replay not found',
            code: 'REPLAY_NOT_FOUND'
          });
          logger.warn('Replay not found', { gameId: payload.gameId, socketId: socket.id });
        }
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.GET_GAME_STATE, (payload: { gameId: string }) => {
      try {
        const gameState = gameService.getGameState(payload.gameId);
        socket.emit(ServerEvents.GAME_STATE_UPDATE, { gameState });
      } catch (error) {
        handleError(socket, error);
      }
    });

    // Admin-only events for server management (should be secured in production)
    socket.on(ClientEvents.GET_ALL_GAMES, () => {
      try {
        const games = gameService.getAllGames();
        socket.emit(ServerEvents.ALL_GAMES, { games });
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.GET_SYSTEM_STATUS, () => {
      try {
        const status = gameService.getSystemStatus();
        const stats = gameService.getStats();
        socket.emit(ServerEvents.GAME_STATE_UPDATE, { 
          type: 'system_status',
          status, 
          stats 
        });
      } catch (error) {
        handleError(socket, error);
      }
    });

    socket.on(ClientEvents.SET_SYSTEM_CONFIG, (payload: {
      acceptNewPlayers?: boolean;
      throttling?: boolean;
      updateFrequency?: 'normal' | 'low';
      replayResolution?: 'normal' | 'low';
      maxPlayers?: number;
      queueEnabled?: boolean;
      backoffEnabled?: boolean;
      deferOperations?: boolean;
    }) => {
      try {
        if (payload.acceptNewPlayers !== undefined) {
          gameService.setAcceptingNewPlayers(payload.acceptNewPlayers);
        }
        
        if (payload.throttling !== undefined) {
          if (payload.throttling) {
            gameService.enableThrottling();
          } else {
            gameService.disableThrottling();
          }
        }
        
        if (payload.updateFrequency) {
          gameService.setUpdateFrequency(payload.updateFrequency);
        }
        
        if (payload.replayResolution === 'low') {
          gameService.reduceReplayResolution();
        } else if (payload.replayResolution === 'normal') {
          gameService.restoreReplayResolution();
        }
        
        if (payload.maxPlayers !== undefined) {
          gameService.setMaxPlayersForNewGames(payload.maxPlayers);
        }
        
        if (payload.queueEnabled !== undefined) {
          if (payload.queueEnabled) {
            gameService.enableGameCreationQueue();
          } else {
            gameService.disableGameCreationQueue();
          }
        }
        
        if (payload.backoffEnabled !== undefined) {
          gameService.setCreationBackoff(payload.backoffEnabled);
        }
        
        if (payload.deferOperations !== undefined) {
          if (payload.deferOperations) {
            gameService.deferResourceIntensiveOperations();
          } else {
            gameService.resumeResourceIntensiveOperations();
          }
        }
        
        // Send updated status
        const status = gameService.getSystemStatus();
        io.emit(ServerEvents.GAME_STATE_UPDATE, { 
          type: 'system_status',
          status 
        });
        
        logger.info('System configuration updated', { payload });
      } catch (error) {
        handleError(socket, error);
      }
    });

    // Utility functions
    function handlePlayerDisconnect(playerId: string): void {
      try {
        const gameIds = gameService.getPlayerGames(playerId);
        
        gameIds.forEach(gameId => {
          try {
            handlePlayerLeaveGame(playerId, gameId);
          } catch (error) {
            logger.error('Error handling game disconnect', { 
              error, 
              playerId, 
              gameId 
            });
          }
        });
      } catch (error) {
        logger.error('Error in disconnect handler', { error, playerId });
      }
    }

    function handlePlayerLeaveGame(playerId: string, gameId: string): void {
      socket.leave(gameId);
      
      const gameState = gameService.playerLeft(gameId, playerId);
      
      io.to(gameId).emit(ServerEvents.PLAYER_LEFT, {
        gameState,
        playerId
      });
      
      logger.info('Player left game', { gameId, playerId });
    }

    function handleError(socket: any, error: any): void {
      let errorMessage = 'An unexpected error occurred';
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error instanceof GameNotFoundError) {
        errorMessage = `Game not found: ${error.gameId}`;
        errorCode = 'GAME_NOT_FOUND';
      } else if (error instanceof GameFullError) {
        errorMessage = `Game is full: ${error.gameId}`;
        errorCode = 'GAME_FULL';
      } else if (error instanceof PlayerNotFoundError) {
        errorMessage = `Player not found in game: ${error.playerId}`;
        errorCode = 'PLAYER_NOT_FOUND';
      } else if (error instanceof PlayerAlreadyExistsError) {
        errorMessage = `Player already in game: ${error.playerId}`;
        errorCode = 'PLAYER_ALREADY_EXISTS';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      socket.emit(ServerEvents.ERROR, {
        message: errorMessage,
        code: errorCode
      });
      
      logger.warn('Error sent to client', { 
        socketId: socket.id, 
        errorCode, 
        errorMessage,
        error 
      });
    }
  });

  return io;
}

export function startSocketServer(httpServer: http.Server): Server {
  const io = setupSocketServer(httpServer);
  return io;
}