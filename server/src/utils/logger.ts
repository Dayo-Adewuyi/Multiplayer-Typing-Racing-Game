import winston from 'winston';
import config from '../config/config';


const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaString}`;
  })
);


const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);


const logger = winston.createLogger({
  level: config.logLevel,
  format: config.env === 'production' ? productionFormat : developmentFormat,
  transports: [
    new winston.transports.Console(),

    ...(config.env === 'production' 
      ? [
          new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, 
            maxFiles: 5,
          }),
          new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, 
            maxFiles: 5,
          })
        ] 
      : [])
  ],
  exitOnError: false
});


export const logEvent = (
  level: string, 
  message: string, 
  meta: Record<string, any> = {}
): void => {
  logger.log(level, message, meta);
};

export default logger;