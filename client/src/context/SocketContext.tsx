import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientEvents,
  ServerEvents,
  ProgressUpdatePayload,
  PlayerFinishedPayload,
  PlayerJoinPayload
} from '../types';

export interface Player {
  id: string;
  name: string;
  position: number;
  isReady: boolean;
  isConnected: boolean;
  isSpectator: boolean;
  wpm: number;
  accuracy: number;
  finishTime?: number;
  color: string;
}

export interface GameState {
  id: string;
  text: string;
  players: Player[];
  state: 'waiting' | 'countdown' | 'active' | 'finished' | 'racing';
  startTime?: number;
  endTime?: number;
  countdown?: number;
  countdownEndTime?: number;
  createdAt: number;
  maxPlayers: number;
}

export interface RaceSummary {
  gameId: string;
  totalTime: number;
  rankings: {
    id: string;
    name: string;
    rank: number;
    wpm: number;
    accuracy: number;
    finished: boolean;
  }[];
  stats: {
    avgWpm: number;
    avgAccuracy: number;
    finishRate: number;
  };
  replayAvailable: boolean;
}

export interface RaceReplay {
  gameId: string;
  startTime: number;
  endTime: number;
  text: string;
  players: {
    id: string;
    name: string;
    snapshots: {
      timestamp: number;
      position: number;
      wpm: number;
      accuracy: number;
    }[];
  }[];
}

export interface SystemStatus {
  acceptingNewPlayers: boolean;
  throttlingEnabled: boolean;
  updateFrequency: 'normal' | 'low';
  replayResolution: 'normal' | 'low';
  maxPlayersPerGame: number;
  queueEnabled: boolean;
  backoffEnabled: boolean;
  deferringOperations: boolean;
  activeGames: number;
  connectedPlayers: number;
  serverLoad: number;
}

export interface GameStats {
  totalGamesCreated: number;
  totalPlayersJoined: number;
  averagePlayersPerGame: number;
  averageGameDuration: number;
  averageWpm: number;
}

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  connect: () => void;
  disconnect: () => void;
  
  currentPlayer: Player | null;
  currentGameId: string | null;
  gameState: GameState | null;
  isSpectator: boolean;
  
  createGame: (playerName: string, maxPlayers?: number) => Promise<string>;
  joinGame: (gameId: string, playerName: string, asSpectator?: boolean) => Promise<void>;
  leaveGame: () => Promise<void>;
  setReady: () => Promise<void>;
  updateProgress: (currentIndex: number, wpm: number, accuracy: number) => void;
  finishRace: (wpm: number, accuracy: number, finishTime: number) => Promise<void>;
  
  getGameState: (gameId: string) => Promise<GameState>;
  getReplay: (gameId: string) => Promise<RaceReplay>;
  raceSummary: RaceSummary | null;
  replay: RaceReplay | null;
  
  getAllGames: () => Promise<{ id: string; playerCount: number; status: string }[]>;
  getSystemStatus: () => Promise<{ status: SystemStatus; stats: GameStats }>;
  setSystemConfig: (config: {
    acceptNewPlayers?: boolean;
    throttling?: boolean;
    updateFrequency?: 'normal' | 'low';
    replayResolution?: 'normal' | 'low';
    maxPlayers?: number;
    queueEnabled?: boolean;
    backoffEnabled?: boolean;
    deferOperations?: boolean;
  }) => Promise<void>;
  
  lastError: { message: string; code: string } | null;
  clearError: () => void;
}

const defaultSocketContext: SocketContextType = {
  socket: null,
  isConnected: false,
  connectionError: null,
  connect: () => {},
  disconnect: () => {},
  currentPlayer: null,
  currentGameId: null,
  gameState: null,
  isSpectator: false,
  createGame: () => Promise.resolve(''),
  joinGame: () => Promise.resolve(),
  leaveGame: () => Promise.resolve(),
  setReady: () => Promise.resolve(),
  updateProgress: () => {},
  finishRace: () => Promise.resolve(),
  getGameState: () => Promise.resolve({} as GameState),
  getReplay: () => Promise.resolve({} as RaceReplay),
  raceSummary: null,
  replay: null,
  getAllGames: () => Promise.resolve([]),
  getSystemStatus: () => Promise.resolve({ status: {} as SystemStatus, stats: {} as GameStats }),
  setSystemConfig: () => Promise.resolve(),
  lastError: null,
  clearError: () => {},
};

export const SocketContext = createContext<SocketContextType>(defaultSocketContext);

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: React.ReactNode;
  socketUrl: string;
  autoConnect?: boolean;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  socketUrl,
  autoConnect = true,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [raceSummary, setRaceSummary] = useState<RaceSummary | null>(null);
  const [replay, setReplay] = useState<RaceReplay | null>(null);
  
  const [lastError, setLastError] = useState<{ message: string; code: string } | null>(null);
  
  const updateThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const progressQueueRef = useRef<ProgressUpdatePayload | null>(null);
  
  const connect = useCallback(() => {
    if (socketRef.current) return;
    
    try {
      const newSocket = io(socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      console.log('Connecting to socket server...', newSocket);
      socketRef.current = newSocket;
    } catch (error) {
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [socketUrl]);
  
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setCurrentPlayer(null);
    setCurrentGameId(null);
    setGameState(null);
    setIsSpectator(false);
  }, []);
  
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);
  
  useEffect(() => {
    if (!socketRef.current) {
      if (autoConnect) {
        connect();
      }
      return;
    }
    
    const socket = socketRef.current;
    
    const onConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };
    
    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      setConnectionError(`Disconnected: ${reason}`);
    };
    
    const onConnectError = (error: Error) => {
      setConnectionError(`Connection error: ${error.message}`);
      setIsConnected(false);
    };
    
    const onGameStateUpdate = (data: {
      gameState: GameState;
      gameId?: string;
      player?: Player;
      isSpectator?: boolean;
      playerId?: string;
      type?: string;
    }) => {
      setGameState(data.gameState);
      
      if (data.gameId && data.player) {
        setCurrentGameId(data.gameId);
        setCurrentPlayer(data.player);
        setIsSpectator(!!data.isSpectator);
      }
    };
    
    const onPlayerJoined = (data: { gameState: GameState; player: Player }) => {
      setGameState(data.gameState);
    };
    
    const onPlayerLeft = (data: { gameState: GameState; playerId: string }) => {
      setGameState(data.gameState);
      
      if (currentPlayer?.id === data.playerId) {
        setCurrentGameId(null);
        setCurrentPlayer(null);
        setIsSpectator(false);
      }
    };
    
    const onGameFinished = (data: { gameState: GameState; summary: RaceSummary }) => {
      setGameState(data.gameState);
      setRaceSummary(data.summary);
    };
    
    const onReplayData = (data: { replay: RaceReplay }) => {
      setReplay(data.replay);
    };
    
    const onError = (error: { message: string; code: string }) => {
      setLastError(error);
    };
    
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(ServerEvents.GAME_STATE_UPDATE, onGameStateUpdate);
    socket.on(ServerEvents.PLAYER_JOINED, onPlayerJoined);
    socket.on(ServerEvents.PLAYER_LEFT, onPlayerLeft);
    socket.on(ServerEvents.GAME_FINISHED, onGameFinished);
    socket.on(ServerEvents.REPLAY_DATA, onReplayData);
    socket.on(ServerEvents.ERROR, onError);
    
    if (socket.connected) {
      setIsConnected(true);
    }
    
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(ServerEvents.GAME_STATE_UPDATE, onGameStateUpdate);
      socket.off(ServerEvents.PLAYER_JOINED, onPlayerJoined);
      socket.off(ServerEvents.PLAYER_LEFT, onPlayerLeft);
      socket.off(ServerEvents.GAME_FINISHED, onGameFinished);
      socket.off(ServerEvents.REPLAY_DATA, onReplayData);
      socket.off(ServerEvents.ERROR, onError);
      
      if (updateThrottleRef.current) {
        clearTimeout(updateThrottleRef.current);
      }
    };
  }, [autoConnect, connect, currentPlayer?.id]);
  
  const createGame = useCallback(
    (playerName: string, maxPlayers?: number): Promise<string> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Socket not connected'));
          return;
        }
        
        const socket = socketRef.current;
        
        const handleGameCreated = (data: { gameId: string; gameState: GameState; player: Player }) => {
          resolve(data.gameId);
        };
        
        const handleError = (error: { message: string; code: string }) => {
          reject(new Error(error.message));
        };
        
        socket.once(ServerEvents.GAME_STATE_UPDATE, handleGameCreated);
        socket.once(ServerEvents.ERROR, handleError);
        
        socket.emit(ClientEvents.CREATE_GAME, { playerName, maxPlayers });
        
        setTimeout(() => {
          socket.off(ServerEvents.GAME_STATE_UPDATE, handleGameCreated);
          socket.off(ServerEvents.ERROR, handleError);
        }, 10000);
      });
    },
    [isConnected]
  );
  
  const joinGame = useCallback(
    (gameId: string, playerName: string, asSpectator = false): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Socket not connected'));
          return;
        }
        
        const socket = socketRef.current;
        
        const payload: PlayerJoinPayload = {
          gameId,
          playerName,
          isSpectator: asSpectator
        };
        
        console.log("payload",payload)
        const handleGameJoined = () => {
          resolve();
        };
        
        const handleError = (error: { message: string; code: string }) => {
          reject(new Error(error.message));
        };
        
        socket.once(ServerEvents.GAME_STATE_UPDATE, handleGameJoined);
        socket.once(ServerEvents.ERROR, handleError);
        
        socket.emit(ClientEvents.JOIN_GAME, payload);
        
        setTimeout(() => {
          socket.off(ServerEvents.GAME_STATE_UPDATE, handleGameJoined);
          socket.off(ServerEvents.ERROR, handleError);
        }, 10000);
      });
    },
    [isConnected]
  );
  
  const leaveGame = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected || !currentGameId) {
        reject(new Error('Not in a game or not connected'));
        return;
      }
      
      socketRef.current.emit(ClientEvents.LEAVE_GAME, { gameId: currentGameId });
      
      setCurrentGameId(null);
      setCurrentPlayer(null);
      setGameState(null);
      setIsSpectator(false);
      
      resolve();
    });
  }, [isConnected, currentGameId]);
  
  const setReady = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected || !currentGameId) {
        reject(new Error('Not in a game or not connected'));
        return;
      }
      
      socketRef.current.emit(ClientEvents.PLAYER_READY, { gameId: currentGameId });
      
      resolve();
    });
  }, [isConnected, currentGameId]);
  
  const updateProgress = useCallback(
    (currentIndex: number, wpm: number, accuracy: number) => {
      if (!socketRef.current || !isConnected || !currentGameId || isSpectator) {
        return;
      }
      
      const socket = socketRef.current;
      
      const payload: ProgressUpdatePayload = {
        gameId: currentGameId,
        currentIndex,
        wpm,
        accuracy
      };
      
      progressQueueRef.current = payload;
      
      if (!updateThrottleRef.current) {
        socket.emit(ClientEvents.UPDATE_PROGRESS, payload);
        
        updateThrottleRef.current = setTimeout(() => {
          if (progressQueueRef.current) {
            socket.emit(ClientEvents.UPDATE_PROGRESS, progressQueueRef.current);
            progressQueueRef.current = null;
          }
          
          updateThrottleRef.current = null;
        }, 100);
      }
    },
    [isConnected, currentGameId, isSpectator]
  );
  
  const finishRace = useCallback(
    (wpm: number, accuracy: number, finishTime: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected || !currentGameId || isSpectator) {
          reject(new Error('Not in a game, not connected, or spectating'));
          return;
        }
        
        const payload: PlayerFinishedPayload = {
          gameId: currentGameId,
          playerId: currentPlayer?.id ?? '',
          wpm,
          accuracy,
          finishTime
        };
        
        socketRef.current.emit(ClientEvents.PLAYER_FINISHED, payload);
        
        resolve();
      });
    },
    [isConnected, currentGameId, isSpectator, currentPlayer?.id]
  );
  
  const getGameState = useCallback(
    (gameId: string): Promise<GameState> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Socket not connected'));
          return;
        }
        
        const socket = socketRef.current;
        
        const handleGameState = (data: { gameState: GameState }) => {
          resolve(data.gameState);
        };
        
        const handleError = (error: { message: string; code: string }) => {
          reject(new Error(error.message));
        };
        
        socket.once(ServerEvents.GAME_STATE_UPDATE, handleGameState);
        socket.once(ServerEvents.ERROR, handleError);
        
        socket.emit(ClientEvents.GET_GAME_STATE, { gameId });
        
        setTimeout(() => {
          socket.off(ServerEvents.GAME_STATE_UPDATE, handleGameState);
          socket.off(ServerEvents.ERROR, handleError);
        }, 10000);
      });
    },
    [isConnected]
  );
  
  const getReplay = useCallback(
    (gameId: string): Promise<RaceReplay> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Socket not connected'));
          return;
        }
        
        const socket = socketRef.current;
        
        const handleReplayData = (data: { replay: RaceReplay }) => {
          resolve(data.replay);
        };
        
        const handleError = (error: { message: string; code: string }) => {
          reject(new Error(error.message));
        };
        
        socket.once(ServerEvents.REPLAY_DATA, handleReplayData);
        socket.once(ServerEvents.ERROR, handleError);
        
        socket.emit(ClientEvents.GET_REPLAY, { gameId });
        
        setTimeout(() => {
          socket.off(ServerEvents.REPLAY_DATA, handleReplayData);
          socket.off(ServerEvents.ERROR, handleError);
        }, 10000);
      });
    },
    [isConnected]
  );
  
  const getAllGames = useCallback((): Promise<{ id: string; playerCount: number; status: string }[]> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      const socket = socketRef.current;
      
      const handleAllGames = (data: { games: { id: string; playerCount: number; status: string }[] }) => {
        resolve(data.games);
      };
      
      const handleError = (error: { message: string; code: string }) => {
        reject(new Error(error.message));
      };
      
      socket.once(ServerEvents.ALL_GAMES, handleAllGames);
      socket.once(ServerEvents.ERROR, handleError);
      
      socket.emit(ClientEvents.GET_ALL_GAMES);
      
      setTimeout(() => {
        socket.off(ServerEvents.ALL_GAMES, handleAllGames);
        socket.off(ServerEvents.ERROR, handleError);
      }, 10000);
    });
  }, [isConnected]);
  
  const getSystemStatus = useCallback((): Promise<{ status: SystemStatus; stats: GameStats }> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !isConnected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      const socket = socketRef.current;
      
      const handleSystemStatus = (data: { 
        type: 'system_status';
        status: SystemStatus; 
        stats: GameStats 
      }) => {
        if (data.type === 'system_status') {
          resolve({ status: data.status, stats: data.stats });
        }
      };
      
      const handleError = (error: { message: string; code: string }) => {
        reject(new Error(error.message));
      };
      
      socket.once(ServerEvents.GAME_STATE_UPDATE, handleSystemStatus);
      socket.once(ServerEvents.ERROR, handleError);
      
      socket.emit(ClientEvents.GET_SYSTEM_STATUS);
      
      setTimeout(() => {
        socket.off(ServerEvents.GAME_STATE_UPDATE, handleSystemStatus);
        socket.off(ServerEvents.ERROR, handleError);
      }, 10000);
    });
  }, [isConnected]);
  
  const setSystemConfig = useCallback(
    (config: {
      acceptNewPlayers?: boolean;
      throttling?: boolean;
      updateFrequency?: 'normal' | 'low';
      replayResolution?: 'normal' | 'low';
      maxPlayers?: number;
      queueEnabled?: boolean;
      backoffEnabled?: boolean;
      deferOperations?: boolean;
    }): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current || !isConnected) {
          reject(new Error('Socket not connected'));
          return;
        }
        
        socketRef.current.emit(ClientEvents.SET_SYSTEM_CONFIG, config);
        
        resolve();
      });
    },
    [isConnected]
  );
  
  const contextValue: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connect,
    disconnect,
    currentPlayer,
    currentGameId,
    gameState,
    isSpectator,
    createGame,
    joinGame,
    leaveGame,
    setReady,
    updateProgress,
    finishRace,
    getGameState,
    getReplay,
    raceSummary,
    replay,
    getAllGames,
    getSystemStatus,
    setSystemConfig,
    lastError,
    clearError,
  };
  
  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
};