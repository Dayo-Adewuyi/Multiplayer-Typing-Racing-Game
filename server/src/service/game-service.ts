import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import {
  GameSession,
  GameState,
  Player,
  ServerEvents,
} from "../shared/types/events";
import { TextService } from "./text-service";
import { RaceReplay, ProgressSnapshot } from "../types/service";
import config from "../config/config";
import logger from "../utils/logger";
import {
  GameNotFoundError,
  GameFullError,
  PlayerNotFoundError,
  PlayerAlreadyExistsError,
} from "../utils/error";
import { Request, Response } from "express";


export class GameService {
  private games: Map<string, GameSession> = new Map();
  private playerGameMap: Map<string, string[]> = new Map();
  private replayStorage: Map<string, RaceReplay> = new Map();
  private textService: TextService;
  private io: Server;
  private acceptingNewPlayers: boolean = true;
  private updateFrequencyMode: "normal" | "low" = "normal";
  private cachedMetrics: Map<string, any> = new Map();

  private throttlingEnabled: boolean = false;

  private replaySnapshotInterval: number = 100;
  private defaultReplaySnapshotInterval: number = 100;

  private gameCreationQueue: Array<{
    playerId: string;
    playerName: string;
    maxPlayers?: number;
    timestamp: number;
  }> = [];

  private gameCreationQueueEnabled: boolean = false;

  private gameCreationBackoffEnabled: boolean = false;

  private replayRetentionTimeMs: number = 60 * 60 * 1000; 
  private defaultReplayRetentionTimeMs: number = 60 * 60 * 1000;

  private resourceIntensiveOperationsQueue: Array<{
    operation: () => Promise<void>;
    priority: number;
    timestamp: number;
  }> = [];

  private deferResourceIntensiveOps: boolean = false;

  public isAcceptingNewPlayers(): boolean {
    return this.acceptingNewPlayers;
  }
  

  public isThrottlingEnabled(): boolean {
    return this.throttlingEnabled;
  }
  

  public getReplayResolution(): number {
    return this.replaySnapshotInterval;
  }
  

  public isGameCreationQueueEnabled(): boolean {
    return this.gameCreationQueueEnabled;
  }
  

  public getGameCreationQueueSize(): number {
    return this.gameCreationQueue.length;
  }
  

  public getUpdateFrequencyMode(): 'normal' | 'low' {
    return this.updateFrequencyMode;
  }
  

  public isResourceIntensiveOperationsDeferred(): boolean {
    return this.deferResourceIntensiveOps;
  }
  

  public getDeferredOperationsCount(): number {
    return this.resourceIntensiveOperationsQueue.length;
  }
  
 
  public getSystemStatus(): Record<string, any> {
    return {
      acceptingNewPlayers: this.acceptingNewPlayers,
      throttling: {
        enabled: this.throttlingEnabled,
        updateFrequency: this.updateFrequencyMode
      },
      replay: {
        resolution: this.replaySnapshotInterval,
        retentionTimeMs: this.replayRetentionTimeMs
      },
      gameCreation: {
        queueEnabled: this.gameCreationQueueEnabled,
        queueSize: this.gameCreationQueue.length,
        backoffEnabled: this.gameCreationBackoffEnabled
      },
      resourceManagement: {
        deferringOperations: this.deferResourceIntensiveOps,
        deferredOperationsCount: this.resourceIntensiveOperationsQueue.length
      },
      maxPlayersPerGame: config.maxPlayersPerGame
    };
  }

  public setAcceptingNewPlayers(accepting: boolean): void {
    this.acceptingNewPlayers = accepting;
    logger.info(`${accepting ? 'Enabled' : 'Disabled'} accepting new players`);
  }
  

  public clearCaches(): void {
    this.cachedMetrics.clear();
    
    this.replayStorage.forEach((replay, _gameId) => {
      replay.players.forEach(player => {
        if (player.progressSnapshots.length > 20) {
          player.progressSnapshots = player.progressSnapshots.filter((_, i) => i % 5 === 0);
        }
      });
    });
    
    logger.info('Cleared caches to reduce memory usage');
  }
  
  
  /**
   * Terminate idle game sessions to reclaim memory
   * @returns Number of games terminated
   */
  public terminateIdleGames(): number {
    let terminatedCount = 0;
    
    const finishedGames = Array.from(this.games.entries())
      .filter(([_, game]) => game.state === GameState.FINISHED)
      .map(([id, _]) => id);
    
    const idleWaitingGames = Array.from(this.games.entries())
      .filter(([_, game]) => {
        return game.state === GameState.WAITING && 
               game.players.filter(p => p.isConnected).length <= 1 &&
               Date.now() - (game.startTime || Date.now()) > 5 * 60 * 1000; 
      })
      .map(([id, _]) => id);
    
  
    [...finishedGames, ...idleWaitingGames].forEach(gameId => {
      try {
        this.cleanupGame(gameId);
        terminatedCount++;
      } catch (error) {
        logger.warn(`Failed to terminate game ${gameId}`, { error });
      }
    });
    
    return terminatedCount;
  }
  

  public setUpdateFrequency(mode: 'normal' | 'low'): void {
    this.updateFrequencyMode = mode;
    logger.info(`Set update frequency to ${mode}`);
  }
  

  public enableThrottling(): void {
    this.throttlingEnabled = true;
    logger.info('Enabled operation throttling');
  }
  

  public disableThrottling(): void {
    this.throttlingEnabled = false;
    logger.info('Disabled operation throttling');
  }
  
 
  public reduceReplayResolution(): void {
  
    this.replaySnapshotInterval = 500; 
    logger.info(`Reduced replay resolution to ${this.replaySnapshotInterval}ms`);
  }
  

  public restoreReplayResolution(): void {
    this.replaySnapshotInterval = this.defaultReplaySnapshotInterval;
    logger.info(`Restored replay resolution to ${this.replaySnapshotInterval}ms`);
  }
  

  public enableGameCreationQueue(): void {
    this.gameCreationQueueEnabled = true;
    logger.info('Enabled game creation queue');
    
    this.processGameCreationQueue();
  }
  

  public disableGameCreationQueue(): void {
    this.gameCreationQueueEnabled = false;
    logger.info('Disabled game creation queue');
  }
  

  private processGameCreationQueue(): void {
    if (!this.gameCreationQueueEnabled) return;
    
    setTimeout(() => {
      if (this.gameCreationQueue.length > 0 && this.gameCreationQueueEnabled) {
        const request = {...this.gameCreationQueue[0]};
        
        try {
          if (Date.now() - request.timestamp < 30000) { 
            logger.info('Processing queued game creation', { 
              playerId: request.playerId,
              queueSize: this.gameCreationQueue.length 
            });
           
            this.createGame(
              request.playerId,
              request.playerName,
              request.maxPlayers
            );
            
            this.gameCreationQueue.shift();
          } else {
            this.gameCreationQueue.shift();
            logger.info('Removed expired game creation request', {
              playerId: request.playerId
            });
          }
        } catch (error) {
          logger.error('Error processing queued game creation', { error });
          if (this.gameCreationQueue.length > 0) {
            this.gameCreationQueue.shift();
          }
        }
      }
      
      if (this.gameCreationQueue.length > 0) {
        this.processGameCreationQueue();
      }
    }, this.gameCreationBackoffEnabled ? 5000 : 2000);
  }
  

  public setMaxPlayersForNewGames(maxPlayers: number): void {
    config.maxPlayersPerGame = maxPlayers;
    logger.info(`Set max players for new games to ${maxPlayers}`);
  }
  
 
  public reduceReplayRetentionTime(): void {
    this.replayRetentionTimeMs = 15 * 60 * 1000; // 15 minutes
    logger.info(`Reduced replay retention time to ${this.replayRetentionTimeMs / 60000} minutes`);
  }
  

  public restoreReplayRetentionTime(): void {
    this.replayRetentionTimeMs = this.defaultReplayRetentionTimeMs;
    logger.info(`Restored replay retention time to ${this.replayRetentionTimeMs / 60000} minutes`);
  }
  

  public setCreationBackoff(enabled: boolean): void {
    this.gameCreationBackoffEnabled = enabled;
    logger.info(`${enabled ? 'Enabled' : 'Disabled'} game creation backoff`);
  }
  
 
  public deferResourceIntensiveOperations(): void {
    this.deferResourceIntensiveOps = true;
    logger.info('Deferring resource-intensive operations');
  }
  

  public resumeResourceIntensiveOperations(): void {
    this.deferResourceIntensiveOps = false;
    logger.info('Resuming resource-intensive operations');
    
    this.processResourceIntensiveOperations();
  }
  
  /**
   * Queue a resource-intensive operation
   * @param operation Function to execute
   * @param priority Priority (1-10, with 10 being highest)
   */
  public queueResourceIntensiveOperation(operation: () => Promise<void>, priority: number = 5): void {
    this.resourceIntensiveOperationsQueue.push({
      operation,
      priority: Math.max(1, Math.min(10, priority)),
      timestamp: Date.now()
    });
    
    if (!this.deferResourceIntensiveOps) {
      this.processResourceIntensiveOperations();
    }
  }
  
  /**
   * Process queued resource-intensive operations
   * @private
   */
  private processResourceIntensiveOperations(): void {
    if (this.deferResourceIntensiveOps) return;
    
    this.resourceIntensiveOperationsQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
    
    if (this.resourceIntensiveOperationsQueue.length > 0) {
      const operation = this.resourceIntensiveOperationsQueue.shift();
      if (operation) {
        operation.operation()
          .catch(error => {
            logger.error('Error processing resource-intensive operation', { error });
          })
          .finally(() => {
            if (this.resourceIntensiveOperationsQueue.length > 0) {
              setTimeout(() => this.processResourceIntensiveOperations(), 100);
            }
          });
      }
    }
  }
  constructor(io: Server) {
    this.io = io;
    this.textService = new TextService();
    logger.info("GameService initialized");
  }


  public createGame(
    playerId: string,
    playerName: string,
    maxPlayers: number = config.maxPlayersPerGame
  ): { gameId: string; player: Player } {
    if (!this.acceptingNewPlayers) {
        throw new Error('Server is currently not accepting new players due to high load');
      }
      
      if (this.gameCreationQueueEnabled) {
        this.gameCreationQueue.push({
          playerId,
          playerName,
          maxPlayers,
          timestamp: Date.now()
        });
        
        logger.info('Game creation queued', { 
          playerId, 
          queueSize: this.gameCreationQueue.length 
        });
        
        throw new Error('Game creation has been queued. Please wait a moment.');
      }
      
    const gameId = uuidv4();
    const player = this.createPlayer(playerId, playerName);

    const game: GameSession = {
      id: gameId,
      state: GameState.WAITING,
      players: [player],
      text: this.textService.getRandomText(),
      startTime: null,
      endTime: null,
      maxPlayers: maxPlayers,
      countdown: null,
    };

    this.games.set(gameId, game);
    this.addPlayerToGame(playerId, gameId);

    logger.info("Game created", {
      gameId,
      playerId,
      playerName,
      maxPlayers,
    });

    return { gameId, player };
  }

  
  public joinGame(
    playerId: string,
    payload: { playerName: string; gameId?: string }
  ): { gameId: string; player: Player; isSpectator?: boolean } {
    let gameId = payload.gameId;

    if (!gameId) {
      const availableGame = Array.from(this.games.values()).find(
        (game) =>
          game.state === GameState.WAITING &&
          game.players.length < game.maxPlayers
      );

      if (availableGame) {
        gameId = availableGame.id;
        logger.debug("Found available game", { gameId });
      } else {
        logger.debug("No available games, creating new game");
        return this.createGame(playerId, payload.playerName);
      }
    }

    const game = this.games.get(gameId);

    if (!game) {
      logger.warn("Game not found", { gameId });
      throw new GameNotFoundError(gameId, "Game not found");
    }

    const existingPlayer = game.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      if (!existingPlayer.isConnected) {
        existingPlayer.isConnected = true;
        logger.info("Reconnected player to game", {
          gameId,
          playerId,
          playerName: existingPlayer.name,
        });
        return { gameId, player: existingPlayer };
      }

      logger.warn("Player already in game", { gameId, playerId });
      throw new PlayerAlreadyExistsError(playerId);
    }

    if (game.state !== GameState.WAITING) {
      const spectator: Player = {
        id: playerId,
        name: `${this.sanitizePlayerName(payload.playerName)} (Spectator)`,
        color: "#AAAAAA",
        position: 0,
        wpm: 0,
        accuracy: 0,
        currentIndex: 0,
        isReady: true,
        finishTime: null,
        isConnected: true,
        isSpectator: true,
      };

      game.players.push(spectator);
      this.addPlayerToGame(playerId, gameId);

      logger.info("Spectator joined active game", {
        gameId,
        playerId,
        playerName: spectator.name,
        gameState: game.state,
      });

      return { gameId, player: spectator, isSpectator: true };
    }

    if (game.players.length >= game.maxPlayers) {
      logger.warn("Game is full", { gameId, maxPlayers: game.maxPlayers });
      throw new GameFullError(gameId);
    }

    const player = this.createPlayer(playerId, payload.playerName);
    game.players.push(player);
    this.addPlayerToGame(playerId, gameId);

    logger.info("Player joined game", {
      gameId,
      playerId,
      playerName: player.name,
      playerCount: game.players.length,
    });

    return { gameId, player };
  }


  public playerReady(gameId: string, playerId: string): GameSession {
    const game = this.getGame(gameId);

    const player = this.getPlayer(game, playerId);
    player.isReady = true;

    logger.info("Player marked as ready", {
      gameId,
      playerId,
      playerName: player.name,
    });

    return game;
  }

 
  public canStartGame(gameId: string): boolean {
    const game = this.getGame(gameId);

    const connectedPlayers = game.players.filter(
      (p) => p.isConnected && !p.isSpectator
    );
    if (connectedPlayers.length < 4) {
      logger.debug("Not enough connected players to start game", {
        gameId,
        connectedPlayers: connectedPlayers.length,
      });
      return false;
    }

    const allReady = connectedPlayers.every((p) => p.isReady);
    logger.debug("Checking if game can start", {
      gameId,
      connectedPlayers: connectedPlayers.length,
      allReady,
    });

    return allReady;
  }


  public startCountdown(gameId: string): void {
    const game = this.getGame(gameId);

    if (game.state !== GameState.WAITING) {
      logger.warn("Cannot start countdown, game not in waiting state", {
        gameId,
        state: game.state,
      });
      throw new Error("Game not in waiting state");
    }

    game.state = GameState.COUNTDOWN;
    game.countdown = config.countdownSeconds;

    this.initializeReplayData(gameId);

    logger.info("Starting game countdown", {
      gameId,
      countdown: game.countdown,
    });

    const countdownInterval = setInterval(() => {
      game.countdown!--;

      this.io.to(gameId).emit(ServerEvents.GAME_COUNTDOWN, {
        gameId,
        countdown: game.countdown,
      });

      logger.debug("Countdown update", {
        gameId,
        countdown: game.countdown,
      });

      if (game.countdown === 0) {
        clearInterval(countdownInterval);
        this.startRace(gameId);
      }
    }, 1000);
  }


  private startRace(gameId: string): void {
    const game = this.getGame(gameId);

    game.state = GameState.RACING;
    game.startTime = Date.now();

    game.players.forEach((player) => {
      if (!player.isSpectator) {
        player.position = 0;
        player.currentIndex = 0;
        player.wpm = 0;
        player.accuracy = 100;
      }
    });

    logger.info("Race started", {
      gameId,
      startTime: game.startTime,
      playerCount: game.players.filter((p) => !p.isSpectator).length,
      textLength: game.text.length,
    });

    const replay = this.replayStorage.get(gameId);
    if (replay) {
      replay.startTime = game.startTime;
    }

    this.io.to(gameId).emit(ServerEvents.GAME_STARTED, {
      gameId,
      startTime: game.startTime,
    });

    setTimeout(() => {
      const currentGame = this.games.get(gameId);
      if (currentGame && currentGame.state === GameState.RACING) {
        logger.info("Race time limit reached", { gameId });
        this.endRace(gameId);
      }
    }, config.maxRaceTimeMs);
  }

 
  private getPlayerRank(game: GameSession, playerId: string): number {
    const sortedPlayers = [...game.players]
      .filter((p) => p.isConnected && !p.isSpectator)
      .sort((a, b) => {
        if (b.position === a.position) {
          if (a.finishTime !== null && b.finishTime !== null) {
            return a.finishTime - b.finishTime;
          }
          return a.finishTime !== null ? -1 : b.finishTime !== null ? 1 : 0;
        }
        return b.position - a.position;
      });

    const rank = sortedPlayers.findIndex((p) => p.id === playerId) + 1;
    return rank;
  }


  public updatePlayerProgress(
    gameId: string,
    playerId: string,
    currentIndex: number,
    wpm: number,
    accuracy: number
  ): void {
    const game = this.getGame(gameId);

    if (game.state !== GameState.RACING) {
      logger.warn("Cannot update progress, game not in racing state", {
        gameId,
        state: game.state,
      });
      throw new Error("Game not in racing state");
    }

    const player = this.getPlayer(game, playerId);

    if (player.isSpectator) {
      return;
    }

    player.currentIndex = currentIndex;
    player.wpm = wpm;
    player.accuracy = accuracy;

    const position = (currentIndex / game.text.length) * 100;
    player.position = Math.min(position, 100);

    const timestamp = Date.now();
    const snapshot: ProgressSnapshot = {
      timestamp,
      position: player.position,
      currentIndex,
      wpm,
      accuracy,
    };

    this.recordProgressSnapshot(gameId, playerId, snapshot);

    if (Math.floor(player.position % 25) === 0 && player.position > 0) {
      logger.debug("Player progress update", {
        gameId,
        playerId,
        position: player.position.toFixed(2),
        wpm,
        accuracy,
      });
    }

    if (player.position >= 100 && player.finishTime === null) {
      player.finishTime = timestamp;
      const raceTime = player.finishTime - (game.startTime || 0);
      const playerRank = this.getPlayerRank(game, playerId);

      this.updatePlayerFinalStats(gameId, playerId, {
        wpm,
        accuracy,
        finishTime: player.finishTime ?? 0,
        rank: playerRank,
      });

      logger.info("Player finished race", {
        gameId,
        playerId,
        playerName: player.name,
        wpm,
        accuracy,
        raceTime,
        finishPosition: playerRank,
      });
    }
  }

 
  public playerFinished(
    gameId: string,
    playerId: string,
    wpm: number,
    accuracy: number,
    finishTime: number
  ): boolean {
    const startTime = performance.now();

    const game = this.getGame(gameId);

    if (game.state !== GameState.RACING) {
      logger.warn("Cannot mark player as finished, game not in racing state", {
        gameId,
        state: game.state,
      });
      throw new Error("Game not in racing state");
    }

    const player = this.getPlayer(game, playerId);

    if (player.isSpectator) {
      return false;
    }

    if (player.position === 100 && player.finishTime !== null) {
      return false;
    }

    player.position = 100;
    player.wpm = wpm;
    player.accuracy = accuracy;
    player.finishTime = finishTime;

    const playerRank = this.getPlayerRank(game, playerId);

    this.updatePlayerFinalStats(gameId, playerId, {
      wpm,
      accuracy,
      finishTime,
      rank: playerRank,
    });

    logger.info("Player officially finished race", {
      gameId,
      playerId,
      playerName: player.name,
      rank: playerRank,
      wpm,
      accuracy,
      raceTime: finishTime - (game.startTime || 0),
    });

    const activePlayers = game.players.filter(
      (p) => p.isConnected && !p.isSpectator
    );
    const finishedPlayers = activePlayers.filter((p) => p.finishTime !== null);

    const allFinished = finishedPlayers.length === activePlayers.length;

    const endTime = performance.now();
    logger.debug("playerFinished execution time", {
      time: `${(endTime - startTime).toFixed(2)}ms`,
      gameId,
      playersFinished: `${finishedPlayers.length}/${activePlayers.length}`,
    });

    if (allFinished) {
      this.endRace(gameId);
      return true;
    }

    return false;
  }

 
  private endRace(gameId: string): void {
    const game = this.getGame(gameId);

    if (game.state !== GameState.RACING) {
      return;
    }

    const startTime = performance.now();

    game.state = GameState.FINISHED;
    game.endTime = Date.now();
    const totalRaceTime = game.endTime - (game.startTime || game.endTime);

    const replay = this.replayStorage.get(gameId);
    if (replay) {
      replay.endTime = game.endTime;
    }

    const activePlayers = game.players.filter(
      (p) => p.isConnected && !p.isSpectator
    );
    const finishedPlayers = activePlayers.filter((p) => p.finishTime !== null);
    const finishRate = finishedPlayers.length / activePlayers.length;

    const totalWpm = finishedPlayers.reduce((sum, p) => sum + p.wpm, 0);
    const avgWpm =
      finishedPlayers.length > 0 ? totalWpm / finishedPlayers.length : 0;

    const totalAccuracy = finishedPlayers.reduce(
      (sum, p) => sum + p.accuracy,
      0
    );
    const avgAccuracy =
      finishedPlayers.length > 0 ? totalAccuracy / finishedPlayers.length : 0;

    game.players.forEach((player) => {
      if (!player.finishTime && player.isConnected && !player.isSpectator) {
        player.finishTime = game.endTime;

        this.updatePlayerFinalStats(gameId, player.id, {
          wpm: player.wpm,
          accuracy: player.accuracy,
          finishTime: player.finishTime ?? 0,
          rank: this.getPlayerRank(game, player.id),
        });
      }
    });

    const rankedPlayers = [...game.players]
      .filter((p) => p.isConnected && !p.isSpectator)
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
        finished: player.position >= 100,
      }));

    logger.info("Race ended", {
      gameId,
      totalTime: totalRaceTime,
      players: activePlayers.length,
      finishedPlayers: finishedPlayers.length,
      finishRate,
      avgWpm,
      avgAccuracy,
    });

    const raceSummary = {
      gameId,
      totalTime: totalRaceTime,
      rankings: rankedPlayers,
      stats: {
        avgWpm,
        avgAccuracy,
        finishRate,
      },
      replayAvailable: true,
    };

    this.io.to(gameId).emit(ServerEvents.GAME_FINISHED, {
      gameState: this.getGameState(gameId),
      summary: raceSummary,
    });

    const endTime = performance.now();
    logger.debug("endRace execution time", {
      time: `${(endTime - startTime).toFixed(2)}ms`,
      gameId,
    });

    const cleanupDelayMs = config.cleanupDelayMs;
    logger.debug("Scheduling game cleanup", {
      gameId,
      cleanupIn: `${cleanupDelayMs / 1000}s`,
    });

    setTimeout(() => {
      this.cleanupGame(gameId);
    }, cleanupDelayMs);
  }

  /**
   * Clean up game resources
   * @private
   */
  private cleanupGame(gameId: string): void {
    const game = this.games.get(gameId);
  
    if (!game) {
      logger.warn("Attempted to cleanup non-existent game", { gameId });
      return;
    }
  
    // Notify players about the game termination if it's still active
    if (game.state !== GameState.FINISHED) {
      this.io.to(gameId).emit(ServerEvents.GAME_TERMINATED, {
        gameId,
        reason: "Game terminated by server"
      });
      
      logger.info("Notified players about game termination", {
        gameId,
        playerCount: game.players.length,
        state: game.state
      });
    }
  
    // Disconnect all players from the game room
    game.players.forEach((player) => {
      this.removePlayerFromGame(player.id, gameId);
    });
  
    this.games.delete(gameId);
  
    logger.info("Game cleaned up", {
      gameId,
      playerCount: game.players.length,
      state: game.state,
    });
  
    // Schedule replay data cleanup with proper error handling
    setTimeout(() => {
      try {
        if (this.replayStorage.has(gameId)) {
          this.replayStorage.delete(gameId);
          logger.info('Replay data cleaned up', { gameId });
        }
      } catch (error) {
        logger.error('Error cleaning up replay data', { 
          gameId, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }, this.replayRetentionTimeMs);
  }

  public playerLeft(gameId: string, playerId: string): GameSession {
    const game = this.getGame(gameId);

    const playerIndex = game.players.findIndex((p) => p.id === playerId);

    if (playerIndex === -1) {
      logger.warn("Player not found in game during playerLeft", {
        gameId,
        playerId,
      });
      throw new PlayerNotFoundError(playerId);
    }

    const player = game.players[playerIndex];

    if (game.state === GameState.WAITING) {
      game.players.splice(playerIndex, 1);

      logger.info("Player removed from waiting game", {
        gameId,
        playerId,
        playerName: player.name,
        remainingPlayers: game.players.length,
      });

      if (game.players.length === 0) {
        logger.info("Removing empty game", { gameId });
        this.games.delete(gameId);
      }
    } else {
      game.players[playerIndex].isConnected = false;

      logger.info("Player disconnected from active game", {
        gameId,
        playerId,
        playerName: player.name,
        gameState: game.state,
        playerProgress: player.position.toFixed(1) + "%",
      });

      const connectedPlayers = game.players.filter(
        (p) => p.isConnected && !p.isSpectator
      );

      if (connectedPlayers.length === 0) {
        logger.info("All players disconnected, ending game", { gameId });

        if (game.state === GameState.RACING) {
          this.endRace(gameId);
        } else {
          setTimeout(() => {
            this.cleanupGame(gameId);
          }, config.cleanupDelayMs);
        }
      } else if (game.state === GameState.RACING) {
        const allFinished = connectedPlayers.every(
          (p) => p.finishTime !== null
        );

        if (allFinished) {
          logger.info("All remaining players finished, ending race", {
            gameId,
          });
          this.endRace(gameId);
        }
      }
    }

    this.removePlayerFromGame(playerId, gameId);

    return game;
  }

  public getGameState(gameId: string): GameSession {
    const game = this.getGame(gameId);

    return game;
  }

  public getRaceReplay(gameId: string): RaceReplay | null {
    return this.replayStorage.get(gameId) || null;
  }

  public getAllGames(): {
    id: string;
    playerCount: number;
    state: GameState;
  }[] {
    return Array.from(this.games.entries()).map(([id, game]) => ({
      id,
      playerCount: game.players.filter((p) => !p.isSpectator).length,
      state: game.state,
    }));
  }

  public getPlayerGames(playerId: string): string[] {
    return this.playerGameMap.get(playerId) || [];
  }

  /**
   * Initialize replay data structure for a game
   * @private
   */
  private initializeReplayData(gameId: string): void {
    const game = this.getGame(gameId);

    const replay: RaceReplay = {
      gameId,
      text: game.text,
      startTime: 0,
      endTime: null,
      players: game.players
        .filter((p) => !p.isSpectator)
        .map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          progressSnapshots: [],
          finalStats: {
            wpm: 0,
            accuracy: 0,
            finishTime: null,
            rank: null,
          },
        })),
    };

    this.replayStorage.set(gameId, replay);
    logger.debug("Initialized replay data structure", { gameId });
  }

  /**
   * Record a progress snapshot for replay
   * @private
   */
  private recordProgressSnapshot(
    gameId: string, 
    playerId: string, 
    snapshot: ProgressSnapshot
  ): void {
    const replay = this.replayStorage.get(gameId);
    if (!replay) {
      return; 
    }
    
    const playerReplay = replay.players.find(p => p.id === playerId);
    if (!playerReplay) {
      return; 
    }
    
    const lastSnapshot = playerReplay.progressSnapshots[playerReplay.progressSnapshots.length - 1];
    
    if (lastSnapshot) {
      const timeDiff = snapshot.timestamp - lastSnapshot.timestamp;
      const positionDiff = Math.abs(snapshot.position - lastSnapshot.position);
      
      if (timeDiff < this.replaySnapshotInterval && positionDiff < 5) {
        return; 
      }
    }
    
    playerReplay.progressSnapshots.push(snapshot);
  }

  /**
   * Update player final stats in replay data
   * @private
   */
  private updatePlayerFinalStats(
    gameId: string,
    playerId: string,
    stats: {
      wpm: number;
      accuracy: number;
      finishTime: number;
      rank: number;
    }
  ): void {
    const replay = this.replayStorage.get(gameId);
    if (!replay) {
      return;
    }

    const playerReplay = replay.players.find((p) => p.id === playerId);
    if (!playerReplay) {
      return;
    }

    playerReplay.finalStats = stats;
  }

  private getGame(gameId: string): GameSession {
    const game = this.games.get(gameId);

    if (!game) {
      logger.warn("Game not found", { gameId });
      throw new GameNotFoundError(gameId, "Game not found");
    }

    return game;
  }

  private getPlayer(game: GameSession, playerId: string): Player {
    const player = game.players.find((p) => p.id === playerId);

    if (!player) {
      logger.warn("Player not found in game", {
        gameId: game.id,
        playerId,
        players: game.players.map((p) => p.id),
      });
      throw new PlayerNotFoundError(playerId);
    }

    return player;
  }

  /**
   * Create a new player object
   * @private
   */
  private createPlayer(id: string, name: string): Player {
    const sanitizedName = this.sanitizePlayerName(name);

    return {
      id,
      name: sanitizedName,
      color: this.getRandomColor(),
      position: 0,
      wpm: 0,
      accuracy: 100,
      currentIndex: 0,
      isReady: false,
      finishTime: null,
      isConnected: true,
      isSpectator: false,
    };
  }

  private sanitizePlayerName(name: string): string {
    if (!name || typeof name !== "string") {
      return `Player-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let sanitized = name.trim().substring(0, 15);

    if (sanitized.length === 0) {
      sanitized = `Player-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    return sanitized;
  }

  /**
   * Add a player to a game in the player-game mapping
   * @private
   */
  private addPlayerToGame(playerId: string, gameId: string): void {
    const playerGames = this.playerGameMap.get(playerId) || [];

    if (!playerGames.includes(gameId)) {
      playerGames.push(gameId);
      this.playerGameMap.set(playerId, playerGames);
    }
  }

  /**
   * Remove a player from a game in the player-game mapping
   * @private
   */
  private removePlayerFromGame(playerId: string, gameId: string): void {
    const playerGames = this.playerGameMap.get(playerId) || [];
    const gameIndex = playerGames.indexOf(gameId);

    if (gameIndex !== -1) {
      playerGames.splice(gameIndex, 1);

      if (playerGames.length === 0) {
        this.playerGameMap.delete(playerId);
      } else {
        this.playerGameMap.set(playerId, playerGames);
      }
    }
  }

  private readonly playerColors = [
    "#FF6B6B",
    "#4ECDC4",
    "#FFD166",
    "#6B5CA5",
    "#72B01D",
    "#3A86FF",
    "#FB5607",
    "#8338EC",
  ];

 
  private getRandomColor(): string {
    return this.playerColors[
      Math.floor(Math.random() * this.playerColors.length)
    ];
  }


  public registerReplayEndpoints(router: any): void {
    router.get("/replays/:gameId", (req: Request, res: Response) => {
      try {
        const { gameId } = req.params;
        const replay = this.getRaceReplay(gameId);

        if (!replay) {
          return res.status(404).json({
            status: "error",
            message: "Replay not found",
          });
        }

        return res.status(200).json({
          status: "ok",
          replay,
        });
      } catch (error) {
        logger.error("Error getting replay", { error });
        return res.status(500).json({
          status: "error",
          message: "Error retrieving replay",
        });
      }
    });

    router.get("/replays", (_req: Request, res: Response) => {
      try {
        const replays = Array.from(this.replayStorage.entries()).map(
          ([id, replay]) => ({
            id,
            startTime: replay.startTime,
            endTime: replay.endTime,
            playerCount: replay.players.length,
            text:
              replay.text.substring(0, 50) +
              (replay.text.length > 50 ? "..." : ""),
          })
        );

        res.status(200).json({
          status: "ok",
          count: replays.length,
          replays,
        });
      } catch (error) {
        logger.error("Error listing replays", { error });
        res.status(500).json({
          status: "error",
          message: "Error retrieving replays",
        });
      }
    });
  }


  public getStats(): Record<string, any> {
    return {
      activeGames: this.games.size,
      activePlayers: this.playerGameMap.size,
      gamesPerState: {
        waiting: Array.from(this.games.values()).filter(
          (g) => g.state === GameState.WAITING
        ).length,
        countdown: Array.from(this.games.values()).filter(
          (g) => g.state === GameState.COUNTDOWN
        ).length,
        racing: Array.from(this.games.values()).filter(
          (g) => g.state === GameState.RACING
        ).length,
        finished: Array.from(this.games.values()).filter(
          (g) => g.state === GameState.FINISHED
        ).length,
      },
      replayCount: this.replayStorage.size,
      memoryUsage: process.memoryUsage(),
    };
  }
}
