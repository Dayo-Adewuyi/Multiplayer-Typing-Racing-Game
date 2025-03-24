import dotenv from 'dotenv';
import path from 'path';
import { AppConfig, Environment } from '../types';
dotenv.config({ path: path.resolve(__dirname, '../.env') });



/**
 * Parse and validate environment variable
 * @param key Environment variable key
 * @param defaultValue Default value if not set
 * @param required Whether the variable is required
 */
const getEnv = (
  key: string, 
  defaultValue?: string, 
  required: boolean = false
): string => {
  const value = process.env[key] || defaultValue;
  
  if (required && !value) {
    throw new Error(`Environment variable ${key} is required`);
  }
  
  return value || '';
};

/**
 * Parse numeric environment variable
 * @param key Environment variable key
 * @param defaultValue Default value if not set
 */
const getNumericEnv = (key: string, defaultValue: number): number => {
  const value = getEnv(key);
  return value ? parseInt(value, 10) : defaultValue;
};


const config: AppConfig = {
 
  port: getNumericEnv('PORT', 3001),
  env: (getEnv('NODE_ENV', 'development') as Environment),
  
  clientUrl: getEnv('CLIENT_URL', 'http://localhost:3000'),
  

  maxPlayersPerGame: getNumericEnv('MAX_PLAYERS_PER_GAME', 4),
  countdownSeconds: getNumericEnv('COUNTDOWN_SECONDS', 3),
  maxRaceTimeMs: getNumericEnv('MAX_RACE_TIME_MINUTES', 1) * 60 * 1000,
  cleanupDelayMs: getNumericEnv('CLEANUP_DELAY_MINUTES', 3) * 60 * 1000,
  

  logLevel: getEnv('LOG_LEVEL', 'info'),
};

export default config;