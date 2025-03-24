import React, { createContext, useContext, useEffect, useReducer, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useSocket } from './SocketContext';
import { 
  GameState as SocketGameState,
  Player,
  RaceReplay,
  RaceSummary
} from './SocketContext';


interface GameContextState {
  currentGame: SocketGameState | null;
  player: Player | null;
  isSpectator: boolean;
  gameId: string | null;
  raceText: string | null;
  countdown: number | null;
  isReady: boolean;
  isRacing: boolean;
  isFinished: boolean;
  raceStartTime: number | null;
  raceEndTime: number | null;
  raceSummary: RaceSummary | null;
  replay: RaceReplay | null;
  playerStats: {
    wpm: number;
    accuracy: number;
    position: number;
    currentIndex: number;
    errors: number;
  };
  loadingState: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}


type GameAction =
  | { type: 'GAME_LOADING' }
  | { type: 'SET_GAME'; payload: SocketGameState }
  | { type: 'SET_PLAYER'; payload: { player: Player; isSpectator: boolean } }
  | { type: 'UPDATE_PLAYER_STATS'; payload: { wpm: number; accuracy: number; position: number; currentIndex: number; errors?: number } }
  | { type: 'SET_READY'; payload: boolean }
  | { type: 'SET_COUNTDOWN'; payload: number | null }
  | { type: 'RACE_STARTED'; payload: number }
  | { type: 'RACE_FINISHED'; payload: number }
  | { type: 'SET_RACE_SUMMARY'; payload: RaceSummary }
  | { type: 'SET_REPLAY'; payload: RaceReplay }
  | { type: 'LEAVE_GAME' }
  | { type: 'PLAYER_LEFT'; payload: string }
  | { type: 'GAME_ERROR'; payload: string }
  | { type: 'RESET_ERROR' };

const initialState: GameContextState = {
  currentGame: null,
  player: null,
  isSpectator: false,
  gameId: null,
  raceText: null,
  countdown: null,
  isReady: false,
  isRacing: false,
  isFinished: false,
  raceStartTime: null,
  raceEndTime: null,
  raceSummary: null,
  replay: null,
  playerStats: {
    wpm: 0,
    accuracy: 100,
    position: 0,
    currentIndex: 0,
    errors: 0
  },
  loadingState: 'idle',
  error: null
};

const gameReducer = (state: GameContextState, action: GameAction): GameContextState => {
  switch (action.type) {
    case 'GAME_LOADING':
      return {
        ...state,
        loadingState: 'loading',
        error: null
      };
      
    case 'SET_GAME':
      return {
        ...state,
        currentGame: action.payload,
        gameId: action.payload.id,
        raceText: action.payload.text,
        isRacing: action.payload.state === 'active',
        isFinished: action.payload.state === 'finished',
        raceStartTime: action.payload.startTime || null,
        raceEndTime: action.payload.endTime || null,
        loadingState: 'success'
      };
      
    case 'SET_PLAYER':
      return {
        ...state,
        player: action.payload.player,
        isSpectator: action.payload.isSpectator,
        isReady: action.payload.player.isReady,
      };
      
    case 'UPDATE_PLAYER_STATS':
      return {
        ...state,
        playerStats: {
          ...state.playerStats,
          ...action.payload,
        },
        player: state.player
          ? {
              ...state.player,
              wpm: action.payload.wpm,
              accuracy: action.payload.accuracy,
              position: action.payload.position,
            }
          : null,
      };
      
    case 'SET_READY':
      return {
        ...state,
        isReady: action.payload,
        player: state.player
          ? { ...state.player, isReady: action.payload }
          : null,
      };
      
    case 'SET_COUNTDOWN':
      return {
        ...state,
        countdown: action.payload,
      };
      
    case 'RACE_STARTED':
      return {
        ...state,
        isRacing: true,
        raceStartTime: action.payload,
        currentGame: state.currentGame
          ? { ...state.currentGame, state: 'active', startTime: action.payload }
          : null,
      };
      
    case 'RACE_FINISHED':
      return {
        ...state,
        isRacing: false,
        isFinished: true,
        raceEndTime: action.payload,
        currentGame: state.currentGame
          ? { ...state.currentGame, state: 'finished', endTime: action.payload }
          : null,
      };
      
    case 'SET_RACE_SUMMARY':
      return {
        ...state,
        raceSummary: action.payload,
      };
      
    case 'SET_REPLAY':
      return {
        ...state,
        replay: action.payload,
      };
      
    case 'LEAVE_GAME':
      return initialState;
      
    case 'PLAYER_LEFT':
      if (!state.currentGame) return state;
      
      return {
        ...state,
        currentGame: {
          ...state.currentGame,
          players: state.currentGame.players.map(player => 
            player.id === action.payload
              ? { ...player, isConnected: false }
              : player
          ),
        },
      };
      
    case 'GAME_ERROR':
      return {
        ...state,
        loadingState: 'error',
        error: action.payload
      };
      
    case 'RESET_ERROR':
      return {
        ...state,
        loadingState: state.loadingState === 'error' ? 'idle' : state.loadingState,
        error: null
      };
      
    default:
      return state;
  }
};

interface GameContextType extends GameContextState {
  joinGame: (gameId: string, playerName: string, asSpectator?: boolean) => Promise<void>;
  createGame: (playerName: string, maxPlayers?: number) => Promise<string>;
  leaveGame: () => Promise<void>;
  markReady: () => Promise<void>;
  updateProgress: (currentIndex: number, typedText: string, errors: number) => void;
  finishRace: (wpm: number, accuracy: number) => Promise<void>;
  getReplay: (gameId: string) => Promise<void>;
  resetGame: () => void;
  resetError: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const navigate = useNavigate();
  
  const { 
    currentPlayer,
    currentGameId,
    gameState,
    isSpectator,
    raceSummary,
    replay,
    createGame: socketCreateGame,
    joinGame: socketJoinGame,
    leaveGame: socketLeaveGame,
    setReady: socketSetReady,
    updateProgress: socketUpdateProgress,
    finishRace: socketFinishRace,
    getReplay: socketGetReplay,
    getGameState: socketGetGameState,
    lastError,
    isConnected,
    startTime,
  } = useSocket();

  useEffect(() => {
    if (gameState) {
      dispatch({ type: 'SET_GAME', payload: gameState });
    }
  }, [gameState]);

  useEffect(() => {
    if (currentPlayer) {
      dispatch({ 
        type: 'SET_PLAYER', 
        payload: { 
          player: currentPlayer, 
          isSpectator: isSpectator 
        } 
      });
    }
  }, [currentPlayer, isSpectator]);

  useEffect(() => {
    if (raceSummary) {
      dispatch({ type: 'SET_RACE_SUMMARY', payload: raceSummary });
    }
  }, [raceSummary]);

  useEffect(() => {
    if (replay) {
      dispatch({ type: 'SET_REPLAY', payload: replay });
    }
  }, [replay]);

  useEffect(() => {
    if (lastError) {
      dispatch({ type: 'GAME_ERROR', payload: lastError.message });
      toast.error(lastError.message);
    }
  }, [lastError]);


  useEffect(() => {
    if (!gameState || !currentGameId) return;
    
    const currentPath = window.location.pathname;
    const isOnLobbyPage = currentPath.startsWith('/lobby/');
    const isOnRacePage = currentPath.startsWith('/race/');
    const isOnResultsPage = currentPath.startsWith('/results/');
    
    const needsRaceStartDispatch = 
      gameState.state === 'racing' && 
      state.currentGame?.state !== 'racing';
      
    const needsRaceFinishDispatch = 
      gameState.state === 'finished' && 
      state.currentGame?.state !== 'finished';
    
    
    if (gameState.state === 'waiting' && !isOnLobbyPage) {
      navigate(`/lobby/${currentGameId}`);
    } else if (gameState.state === 'racing' ) {
     
      if (needsRaceStartDispatch) {
        dispatch({ 
          type: 'RACE_STARTED', 
          payload: startTime|| gameState.startTime || Date.now() 
        });
      }
      
      if (!isOnRacePage) {
        navigate(`/race/${currentGameId}`);
      }
    } else if (gameState.state === 'finished') {
      if (needsRaceFinishDispatch) {
        dispatch({ 
          type: 'RACE_FINISHED', 
          payload: gameState.endTime || Date.now() 
        });
        
        if (!isOnResultsPage) {
          setTimeout(() => {
            navigate(`/results/${currentGameId}`);
          }, 2000);
        }
      }
    } else if (gameState.state === 'countdown') {
      dispatch({ 
        type: 'SET_COUNTDOWN', 
        payload: gameState.countdown ?? 3
      });
    }
  }, [
    gameState, 
    currentGameId, 
    navigate, 
  ]);
 


  useEffect(() => {
    const joinFromUrl = async () => {
      const path = window.location.pathname;
      const segments = path.split('/').filter(Boolean);
      
      if (segments.length >= 2) {
        const section = segments[0]; 
        const gameId = segments[1];
        
        if (gameId && (!currentGameId || currentGameId !== gameId)) {
          try {
            const gameState = await socketGetGameState(gameId);
            dispatch({ type: 'SET_GAME', payload: gameState });
          } catch (error) {
            console.error('Error fetching game from URL:', error);
            
            if (error instanceof Error && (error.message.includes('not found') || error.message.includes('does not exist'))) {
              navigate('/');
              toast.error('Game not found');
            }
          }
        }
      }
    };
    
    if (!currentGameId) {
      joinFromUrl();
    }
  }, [currentGameId, navigate, socketGetGameState]);

  const joinGame = useCallback(
    async (gameId: string, playerName: string, asSpectator = false): Promise<void> => {
      if (!isConnected) {
        toast.error('Not connected to server');
        throw new Error('Not connected to server');
      }
      
      dispatch({ type: 'GAME_LOADING' });
      
      try {
        await socketJoinGame(gameId, playerName, asSpectator);
        navigate(`/lobby/${gameId}`);
      } catch (error) {
        let message = 'Failed to join game';
        if (error instanceof Error) {
          message = error.message;
        }
        
        dispatch({ type: 'GAME_ERROR', payload: message });
        toast.error(message);
        throw error;
      }
    },
    [isConnected, socketJoinGame, navigate]
  );

  const createGame = useCallback(
    async (playerName: string, maxPlayers?: number): Promise<string> => {
      if (!isConnected) {
        toast.error('Not connected to server');
        throw new Error('Not connected to server');
      }
      
      dispatch({ type: 'GAME_LOADING' });
      
      try {
        const gameId = await socketCreateGame(playerName, maxPlayers);
        return gameId;
      } catch (error) {
        let message = 'Failed to create game';
        if (error instanceof Error) {
          message = error.message;
        }
        
        dispatch({ type: 'GAME_ERROR', payload: message });
        toast.error(message);
        throw error;
      }
    },
    [isConnected, socketCreateGame]
  );


  const leaveGame = useCallback(
    async (): Promise<void> => {
      if (!currentGameId) return;
      
      try {
        await socketLeaveGame();
        dispatch({ type: 'LEAVE_GAME' });
        navigate('/');
      } catch (error) {
        let message = 'Failed to leave game';
        if (error instanceof Error) {
          message = error.message;
        }
        
        toast.error(message);
        throw error;
      }
    },
    [currentGameId, socketLeaveGame, navigate]
  );

  const markReady = useCallback(
    async (): Promise<void> => {
      if (!currentGameId) return;
      
      try {
        await socketSetReady();
        dispatch({ type: 'SET_READY', payload: true });
      } catch (error) {
        let message = 'Failed to mark as ready';
        if (error instanceof Error) {
          message = error.message;
        }
        
        toast.error(message);
        throw error;
      }
    },
    [currentGameId, socketSetReady]
  );


  const calculateWPM = (currentIndex: number, timeElapsedMinutes: number): number => {
    const wordsTyped = currentIndex / 5;
    
    if (timeElapsedMinutes <= 0) return 0;
    
    const wpm = wordsTyped / timeElapsedMinutes;
    
    return Math.min(Math.max(0, wpm), 300);
  };

  const calculateAccuracy = (typedText: string, correctText: string, errors: number): number => {
    if (typedText.length === 0) return 100;
    
    const accuracy = 100 - (errors / typedText.length) * 100;
    
    return Math.min(Math.max(0, accuracy), 100);
  };

  const finishRace = useCallback(
    async (wpm: number, accuracy: number): Promise<void> => {
      if (!currentGameId || isSpectator) return;
      
      const finishTime = Date.now();
      
      try {
        await socketFinishRace(wpm, accuracy, finishTime);
        
        toast.success('Race completed!', {
          icon: '🏁',
          duration: 3000
        });
      } catch (error) {
        let message = 'Failed to finish race';
        if (error instanceof Error) {
          message = error.message;
        }
        
        toast.error(message);
      }
    },
    [currentGameId, socketFinishRace, isSpectator]
  );
  const updateProgress = useCallback(
    (currentIndex: number, typedText: string, errors: number): void => {
      if (!currentGameId || !state.isRacing || !state.raceText || isSpectator) return;
      
      const now = Date.now();
      const raceStartTime = state.raceStartTime || now;
      const timeElapsed = (now - raceStartTime) / 1000 / 60; 
      
      const wpm = calculateWPM(currentIndex, timeElapsed);
      const accuracy = calculateAccuracy(typedText, state.raceText.substring(0, currentIndex), errors);
      const position = (currentIndex / state.raceText.length) * 100;
      
      dispatch({
        type: 'UPDATE_PLAYER_STATS',
        payload: { 
          wpm, 
          accuracy, 
          position,
          currentIndex,
          errors
        },
      });
      
      socketUpdateProgress(currentIndex, wpm, accuracy);
      
      if (currentIndex >= state.raceText.length) {
        finishRace(wpm, accuracy);
      }
    },
    [currentGameId, state.isRacing, state.raceText, state.raceStartTime, socketUpdateProgress, isSpectator, finishRace]
  );

  

  const getReplay = useCallback(
    async (gameId: string): Promise<void> => {
      dispatch({ type: 'GAME_LOADING' });
      
      try {
        await socketGetReplay(gameId);
      } catch (error) {
        let message = 'Failed to get replay';
        if (error instanceof Error) {
          message = error.message;
        }
        
        dispatch({ type: 'GAME_ERROR', payload: message });
        toast.error(message);
        throw error;
      }
    },
    [socketGetReplay]
  );
  
  const resetGame = useCallback(async () => {
    if (currentGameId) {
      try {
        await socketLeaveGame();
      } catch (error) {
        console.error('Error leaving game:', error);
      }
    }
    
    dispatch({ type: 'LEAVE_GAME' });
  }, [currentGameId, socketLeaveGame]);
  
  const resetError = useCallback(() => {
    dispatch({ type: 'RESET_ERROR' });
  }, []);

  const value = {
    ...state,
    joinGame,
    createGame,
    leaveGame,
    markReady,
    updateProgress,
    finishRace,
    getReplay,
    resetGame,
    resetError
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  
  return context;
};