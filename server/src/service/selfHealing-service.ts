import os from 'os';
import { GameService } from './game-service';
import logger from '../utils/logger';
import config from '../config/config';

/**
 * SelfHealingService - Monitors system health and automatically responds to issues
 * without requiring external alerting or human intervention
 */
export class SelfHealingService {
  private gameService: GameService;
  
  
  private memoryAlertActive: boolean = false;
  private loadAlertActive: boolean = false;
  private gameCountAlertActive: boolean = false;
  
  private readonly MEMORY_CRITICAL_THRESHOLD = 0.9; 
  private readonly MEMORY_RECOVERY_THRESHOLD = 0.7;
  
  private readonly LOAD_CRITICAL_THRESHOLD = 0.8; 
  private readonly LOAD_RECOVERY_THRESHOLD = 0.6;
  
  private readonly GAME_COUNT_THRESHOLD = 100; 
  private readonly GAME_COUNT_RECOVERY_THRESHOLD = 80; 
  

  private readonly CHECK_INTERVAL_MS = 10000; 
  
  private monitorInterval: NodeJS.Timeout | null = null;
  
  constructor(gameService: GameService) {
    this.gameService = gameService;
    logger.info('Self-healing service initialized');
  }
  

  public start(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    
    this.monitorInterval = setInterval(() => {
      this.checkSystemHealth();
    }, this.CHECK_INTERVAL_MS);
    
    logger.info('Self-healing monitoring started');
  }
  

  public stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    logger.info('Self-healing monitoring stopped');
  }
  

  private checkSystemHealth(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      
      const loadAvg = os.loadavg()[0];
      const cpuCount = os.cpus().length;
      const loadPerCpu = loadAvg / cpuCount;
      
      const gameStats = this.gameService.getStats();
      const activeGames = gameStats.activeGames;
      
      this.handleMemoryIssues(memoryPercent, memoryUsage);
      
      this.handleLoadIssues(loadPerCpu, cpuCount, loadAvg);
      
      this.handleGameCountIssues(activeGames, gameStats);
      
      if (Math.random() < 0.167) { 
        logger.info('System health snapshot', {
          memoryUsage: `${(memoryPercent * 100).toFixed(1)}%`,
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          loadPerCpu: loadPerCpu.toFixed(2),
          activeGames,
          activePlayers: gameStats.activePlayers,
          mitigationsActive: {
            memory: this.memoryAlertActive,
            load: this.loadAlertActive,
            gameCount: this.gameCountAlertActive
          }
        });
      }
    } catch (error) {
      logger.error('Error in self-healing health check', { error });
    }
  }

  private handleMemoryIssues(memoryPercent: number, memoryUsage: NodeJS.MemoryUsage): void {
    if (memoryPercent > this.MEMORY_CRITICAL_THRESHOLD && !this.memoryAlertActive) {
      logger.error('CRITICAL: Memory usage exceeded threshold', {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        usagePercent: `${(memoryPercent * 100).toFixed(1)}%`
      });
      
      try {
        this.gameService.setAcceptingNewPlayers(false);
        
        if (global.gc) {
          global.gc();
          logger.info('Emergency GC executed');
        }
        
        this.gameService.clearCaches();
        
        if (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > this.MEMORY_CRITICAL_THRESHOLD) {
          const terminatedCount = this.gameService.terminateIdleGames();
          logger.info(`Terminated ${terminatedCount} idle games to reclaim memory`);
        }
        
        this.memoryAlertActive = true;
      } catch (error) {
        logger.error('Failed to mitigate memory issue', { error });
      }
    }
    else if (memoryPercent < this.MEMORY_RECOVERY_THRESHOLD && this.memoryAlertActive) {
      try {
        this.gameService.setAcceptingNewPlayers(true);
        
        this.memoryAlertActive = false;
        logger.info('Memory usage returned to normal levels, resuming standard operations', {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usagePercent: `${(memoryPercent * 100).toFixed(1)}%`
        });
      } catch (error) {
        logger.error('Failed to restore system after memory issue', { error });
      }
    }
  }
  

  private handleLoadIssues(loadPerCpu: number, cpuCount: number, loadAvg: number): void {
    if (loadPerCpu > this.LOAD_CRITICAL_THRESHOLD && !this.loadAlertActive) {
      logger.warn('HIGH LOAD: System experiencing performance degradation', {
        loadAvg,
        cpuCount,
        loadPerCpu: loadPerCpu.toFixed(2)
      });
      
      try {
        this.gameService.setUpdateFrequency('low');
        
        this.gameService.enableThrottling();
        
        this.gameService.deferResourceIntensiveOperations();
        
        this.gameService.reduceReplayResolution();
        
        this.loadAlertActive = true;
        logger.info('Applied performance degradation mitigations');
      } catch (error) {
        logger.error('Failed to mitigate system load', { error });
      }
    }
    else if (loadPerCpu < this.LOAD_RECOVERY_THRESHOLD && this.loadAlertActive) {
      try {
        this.gameService.setUpdateFrequency('normal');
        this.gameService.disableThrottling();
        this.gameService.resumeResourceIntensiveOperations();
        this.gameService.restoreReplayResolution();
        
        this.loadAlertActive = false;
        logger.info('System load returned to normal levels, resuming standard operations', {
          loadAvg, 
          cpuCount,
          loadPerCpu: loadPerCpu.toFixed(2)
        });
      } catch (error) {
        logger.error('Failed to restore system after load issue', { error });
      }
    }
  }
  
  /**
   * Handle high game count issues
   * @private
   */
  private handleGameCountIssues(activeGames: number, gameStats: any): void {
    if (activeGames > this.GAME_COUNT_THRESHOLD && !this.gameCountAlertActive) {
      logger.warn('HIGH GAME COUNT: Approaching system capacity', {
        activeGames,
        activePlayers: gameStats.activePlayers
      });
      
      try {
        this.gameService.enableGameCreationQueue();
        
        this.gameService.setMaxPlayersForNewGames(Math.max(2, config.maxPlayersPerGame - 1));
        
        this.gameService.reduceReplayRetentionTime();
        
        this.gameService.setCreationBackoff(true);
        
        this.gameCountAlertActive = true;
        logger.info('Applied high game count mitigations');
      } catch (error) {
        logger.error('Failed to mitigate high game count', { error });
      }
    }
    else if (activeGames < this.GAME_COUNT_RECOVERY_THRESHOLD && this.gameCountAlertActive) {
      try {
        this.gameService.disableGameCreationQueue();
        this.gameService.setMaxPlayersForNewGames(config.maxPlayersPerGame);
        this.gameService.restoreReplayRetentionTime();
        this.gameService.setCreationBackoff(false);
        
        this.gameCountAlertActive = false;
        logger.info('Game count returned to normal levels, resuming standard operations', {
          activeGames,
          activePlayers: gameStats.activePlayers
        });
      } catch (error) {
        logger.error('Failed to restore system after high game count', { error });
      }
    }
  }
}