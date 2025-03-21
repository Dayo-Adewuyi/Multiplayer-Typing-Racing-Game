
export type Environment = 'development' | 'production' | 'test';


export interface AppConfig {
  port: number;
  env: Environment;
  
  clientUrl: string;
  

  maxPlayersPerGame: number;
  countdownSeconds: number;
  maxRaceTimeMs: number;
  cleanupDelayMs: number;
  

  logLevel: string;
}