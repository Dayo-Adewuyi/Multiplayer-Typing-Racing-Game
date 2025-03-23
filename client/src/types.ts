
export enum GameState {
    WAITING = 'waiting',
    COUNTDOWN = 'countdown',
    RACING = 'racing',
    FINISHED = 'finished'
  }
  
  export interface GameSession {
    id: string;
    state: GameState;
    players: Player[];
    text: string;
    startTime: number | null;
    endTime: number | null;
    maxPlayers: number;
    countdown: number | null;
  }
  
  
  export interface Player {
    id: string;
    name: string;
    color: string;
    position: number; 
    wpm: number; 
    accuracy: number; 
    currentIndex: number; 
    isReady: boolean;
    finishTime: number | null;
    isConnected: boolean;
    isSpectator?: boolean; 
    lastUpdate?: number;
  }
  
  export enum ClientEvents {
    JOIN_GAME = 'join_game',
    LEAVE_GAME = 'leave_game',
    PLAYER_READY = 'player_ready',
    TYPING_PROGRESS = 'typing_progress',
    UPDATE_PROGRESS = 'update_progress',
    PLAYER_FINISHED = 'player_finished',
    GET_GAME_STATE = 'get_game_state',
    CREATE_GAME = 'create_game',
    GET_REPLAY = 'get_replay',
    GET_ALL_GAMES = 'get_all_games',
    GET_SYSTEM_STATUS = 'get_system_status',
    SET_SYSTEM_CONFIG = 'set_system_config'
  }
  
  export enum ServerEvents {
    GAME_STATE_UPDATE = 'game_state_update',
    PLAYER_JOINED = 'player_joined',
    PLAYER_LEFT = 'player_left',
    GAME_COUNTDOWN = 'game_countdown',
    GAME_STARTED = 'game_started',
    GAME_FINISHED = 'game_finished',
    GAME_TERMINATED = 'game_terminated',
    REPLAY_DATA = 'replay_data',
    ALL_GAMES = 'all_games',
    ERROR = 'error'
  }
  
  export interface JoinGamePayload {
    playerName: string;
    gameId?: string; 
  }
  
  export interface TypingProgressPayload {
    gameId: string;
    playerId: string;
    currentIndex: number;
    wpm: number;
    accuracy: number;
  }
  
  export interface PlayerFinishedPayload {
    gameId: string;
    playerId: string;
    wpm: number;
    accuracy: number;
    finishTime: number;
  }
  
  export interface ReplayPayload {
    gameId: string;
  }
  
  export interface ErrorPayload {
    message: string;
    code: string;
  }
  
  
  export interface RaceReplay {
    gameId: string;
    text: string;
    startTime: number;
    endTime: number | null;
    players: PlayerReplay[];
  }
  
  export interface PlayerReplay {
    id: string;
    name: string;
    color: string;
    progressSnapshots: ProgressSnapshot[];
    finalStats: {
      wpm: number;
      accuracy: number;
      finishTime: number | null;
      rank: number | null;
    };
  }
  
  export interface ProgressSnapshot {
    timestamp: number;
    position: number;
    currentIndex: number;
    wpm: number;
    accuracy: number;
  }

  export interface ProgressUpdatePayload {
   
    gameId: string;
  
 
    currentIndex: number;

    wpm: number;
  
 
    accuracy: number;
  }
  
 
  export interface PlayerJoinPayload {
 
    playerName: string;
  
    gameId?: string;


    isSpectator?: boolean;
  }
  

  export interface PlayerFinishedPayload {

    gameId: string;
  
    wpm: number;
  

    accuracy: number;
  
    playerId: string ;
    
    finishTime: number;
  }