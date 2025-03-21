
export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
  
    constructor(
      message: string,
      code: string = 'INTERNAL_ERROR',
      statusCode: number = 500,
      isOperational: boolean = true
    ) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      
      this.name = this.constructor.name;
      
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Error types specific to the game
   */
  export class GameError extends AppError {
    constructor(message: string, code: string = 'GAME_ERROR') {
      super(message, code, 400, true);
    }
  }
  
  export class GameNotFoundError extends GameError {
    gameId: string;

    constructor(gameId: string, message: string) {
      super(message);
      this.name = 'GameNotFoundError';
      this.gameId = gameId;
    }
  }
  
  export class GameFullError extends Error {
    gameId: string;
  
    constructor(gameId: string) {
      super('The game is full');
      this.name = 'GameFullError';
      this.gameId = gameId;
    }
  }
  
  export class GameInProgressError extends GameError {
    constructor(gameId: string) {
      super(`Game ${gameId} is already in progress`, 'GAME_IN_PROGRESS');
    }
  }
  
  export class PlayerError extends AppError {
    constructor(message: string, code: string = 'PLAYER_ERROR') {
      super(message, code, 400, true);
    }
  }
  
  export class PlayerNotFoundError extends Error {
    playerId: string;
  
    constructor(playerId: string) {
      super('Player not found');
      this.name = 'PlayerNotFoundError';
      this.playerId = playerId;
    }
  }
  
  export class PlayerAlreadyExistsError extends PlayerError {
    playerId: string;
  
    constructor(playerId: string) {
      super('Player already exists');
      this.name = 'PlayerAlreadyExistsError';
      this.playerId = playerId;
    }
  }
  

  export const isOperationalError = (error: Error): boolean => {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  };