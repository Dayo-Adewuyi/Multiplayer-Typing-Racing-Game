import { Router, Request, Response, NextFunction } from "express";
import { GameService } from "./game-service";
import config from "../config/config";
import logger from "../utils/logger";
import os from "os";
import { performance, PerformanceObserver } from "perf_hooks";

/**
 * MonitoringService - A high-performance monitoring system for tracking application health,
 * performance metrics, and game statistics.
 */
export class MonitoringService {
  private gameService: GameService;
  private metrics: {
    startTime: number;
    requestCounts: Map<string, number>;
    responseTimeSum: Map<string, number>;
    responseTimeMax: Map<string, number>;
    responseTimeMin: Map<string, number>;
    errors: Map<string, number>;
    lastGcStats: {
      timestamp: number | null;
      duration: number | null;
      type: string | null;
    };
    memoryHighWatermark: number;
    systemLoad: number[];
  };

  private readonly SAMPLE_RATE = 0.1;

  private readonly CACHE_LIFETIME = 5000;
  private cachedMetrics: Map<string, { timestamp: number; data: any }> =
    new Map();

  constructor(gameService: GameService) {
    this.gameService = gameService;

    this.metrics = {
      startTime: Date.now(),
      requestCounts: new Map(),
      responseTimeSum: new Map(),
      responseTimeMax: new Map(),
      responseTimeMin: new Map(),
      errors: new Map(),
      lastGcStats: {
        timestamp: null,
        duration: null,
        type: null,
      },
      memoryHighWatermark: 0,
      systemLoad: [0, 0, 0],
    };

    this.setupPerformanceObservers();

    this.startBackgroundMetricCollection();

    logger.info("MonitoringService initialized");
  }

  /**
   * Set up PerformanceObserver for GC monitoring
   * @private
   */
  private setupPerformanceObservers(): void {
    try {
      if (typeof PerformanceObserver === "function") {
        const gcObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();

          entries.forEach((entry) => {
            if (entry.entryType === "gc") {
              const gcEntry = entry as any;

              this.metrics.lastGcStats = {
                timestamp: gcEntry.startTime,
                duration: gcEntry.duration,
                type:
                  gcEntry.kind === 1
                    ? "minor"
                    : gcEntry.kind === 2
                    ? "major"
                    : "unknown",
              };

              if (gcEntry.kind === 2 && gcEntry.duration > 100) {
                logger.warn("Major GC event detected", {
                  duration: `${gcEntry.duration.toFixed(2)}ms`,
                });
              }
            }
          });
        });

        if ("gc" in performance) {
          gcObserver.observe({ entryTypes: ["gc"] });
        }
      }
    } catch (error) {
      logger.warn("Failed to set up GC performance observer", { error });
    }
  }

  /**
   * Start background metric collection
   * @private
   */
  private startBackgroundMetricCollection(): void {
    setInterval(() => {
      this.metrics.systemLoad = os.loadavg();

      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > this.metrics.memoryHighWatermark) {
        this.metrics.memoryHighWatermark = memoryUsage.heapUsed;
      }

      const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
      if (memoryUsagePercent > 0.85) {
        logger.warn("Memory usage approaching limit", {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          percentage: `${(memoryUsagePercent * 100).toFixed(1)}%`,
        });
      }
    }, 10000);
  }

  public createTimingMiddleware(): (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const shouldSample = Math.random() < this.SAMPLE_RATE;

      const path = req.path;
      this.metrics.requestCounts.set(
        path,
        (this.metrics.requestCounts.get(path) || 0) + 1
      );

      if (!shouldSample) {
        next();
        return;
      }

      const startTime = performance.now();

      const originalEnd = res.end;

      res.end = function (this: MonitoringService, ...args: any[]) {
        const responseTime = performance.now() - startTime;

        if (
          !this.metrics.responseTimeMin.has(path) ||
          responseTime < this.metrics.responseTimeMin.get(path)!
        ) {
          this.metrics.responseTimeMin.set(path, responseTime);
        }

        if (
          !this.metrics.responseTimeMax.has(path) ||
          responseTime > this.metrics.responseTimeMax.get(path)!
        ) {
          this.metrics.responseTimeMax.set(path, responseTime);
        }

        this.metrics.responseTimeSum.set(
          path,
          (this.metrics.responseTimeSum.get(path) || 0) + responseTime
        );

        if (responseTime > 500) {
          logger.warn("Slow response detected", {
            path,
            responseTime: `${responseTime.toFixed(2)}ms`,
            method: req.method,
            statusCode: res.statusCode,
          });
        }

        if (res.statusCode >= 400) {
          this.metrics.errors.set(
            path,
            (this.metrics.errors.get(path) || 0) + 1
          );
        }

        return originalEnd.apply(res, args as [any, BufferEncoding, (() => void)?]);
      }.bind(this);

      next();
    };
  }

  /**
   * Get cached or compute expensive metrics
   * @private
   */
  private getOrComputeMetric<T>(key: string, computeFn: () => T): T {
    const now = Date.now();
    const cached = this.cachedMetrics.get(key);

    if (cached && now - cached.timestamp < this.CACHE_LIFETIME) {
      return cached.data;
    }

    const data = computeFn();

    this.cachedMetrics.set(key, {
      timestamp: now,
      data,
    });

    return data;
  }

  /**
   * Create Express router with monitoring endpoints
   */
  public createMonitoringRoutes(): Router {
    const router = Router();

    router.use(this.createTimingMiddleware());

    router.get('/health', (req: Request, res: Response) => {
        const memoryUsage = process.memoryUsage();
        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        const loadAvg = os.loadavg()[0];
        const cpuCount = os.cpus().length;
        const loadPerCpu = loadAvg / cpuCount;
        
        const status = 
          heapUsedPercent > 90 || loadPerCpu > 0.9 
            ? 'critical' 
            : heapUsedPercent > 75 || loadPerCpu > 0.7 
              ? 'warning' 
              : 'ok';
        
        const includeSelfHealing = req.query.detailed === 'true';
        
        const responseData: any = {
          status,
          env: config.env,
          timestamp: new Date().toISOString()
        };
        
        if (includeSelfHealing) {
          const systemStatus = this.gameService.getSystemStatus();
          
          responseData.memory = {
            usedPercent: `${heapUsedPercent.toFixed(1)}%`,
            heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
          };
          
          responseData.cpu = {
            loadAvg: loadAvg.toFixed(2),
            loadPerCore: loadPerCpu.toFixed(2)
          };
          
          responseData.selfHealing = {
            acceptingNewPlayers: systemStatus.acceptingNewPlayers,
            throttlingEnabled: systemStatus.throttling.enabled,
            updateFrequency: systemStatus.throttling.updateFrequency,
            queuedGames: systemStatus.gameCreation.queueSize
          };
        }
        
        const statusCode = status === 'critical' ? 503 : 200;
        
        res.status(statusCode).json(responseData);
      });

    router.get("/health/details", (_req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      const systemInfo = {
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`,
        loadAvg: os.loadavg(),
        platform: os.platform(),
        uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor(
          (os.uptime() % 3600) / 60
        )}m`,
      };

      res.status(200).json({
        status: "ok",
        env: config.env,
        timestamp: new Date().toISOString(),
        processUptime: `${Math.floor(
          (Date.now() - this.metrics.startTime) / 1000 / 60
        )}m`,
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          highWatermark: `${Math.round(
            this.metrics.memoryHighWatermark / 1024 / 1024
          )}MB`,
        },
        lastGcStats: this.metrics.lastGcStats.timestamp
          ? {
              age: `${(
                (Date.now() - this.metrics.lastGcStats.timestamp) /
                1000
              ).toFixed(1)}s ago`,
              duration: `${this.metrics.lastGcStats.duration!.toFixed(2)}ms`,
              type: this.metrics.lastGcStats.type,
            }
          : "No GC events recorded",
        system: systemInfo,
      });
    });

    router.get(
      "/metrics",
      this.requireApiKey,
      (_req: Request, res: Response) => {
        try {
          const requestRates: Record<string, number> = {};
          const uptime = (Date.now() - this.metrics.startTime) / 1000;

          this.metrics.requestCounts.forEach((count, path) => {
            requestRates[path] = parseFloat((count / uptime).toFixed(3));
          });

          const avgResponseTimes: Record<string, number> = {};
          this.metrics.responseTimeSum.forEach((sum, path) => {
            const count = this.metrics.requestCounts.get(path) || 1;
            avgResponseTimes[path] = parseFloat((sum / count).toFixed(2));
          });

          const gameMetrics = this.getOrComputeMetric("gameMetrics", () => {
            const stats = this.gameService.getStats();

            return {
              ...stats,
              activeGamesPerSecond: (stats.gamesPerState.racing || 0) / uptime,
              avgPlayersPerGame: stats.activePlayers / (stats.activeGames || 1),
              playerConnectionRate: stats.activePlayers / uptime,
            };
          });

          res.status(200).json({
            uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
            requestTotals: Object.fromEntries(this.metrics.requestCounts),
            requestRates,
            responseTimes: {
              average: avgResponseTimes,
              min: Object.fromEntries(this.metrics.responseTimeMin),
              max: Object.fromEntries(this.metrics.responseTimeMax),
            },
            errors: Object.fromEntries(this.metrics.errors),
            memory: {
              currentUsageMB: Math.round(
                process.memoryUsage().heapUsed / 1024 / 1024
              ),
              highWatermarkMB: Math.round(
                this.metrics.memoryHighWatermark / 1024 / 1024
              ),
            },
            systemLoad: this.metrics.systemLoad,
            game: gameMetrics,
          });
        } catch (error) {
          logger.error("Error generating metrics", { error });
          res.status(500).json({
            status: "error",
            message: "Error generating metrics",
          });
        }
      }
    );

    router.get("/stats", this.requireApiKey, (req: Request, res: Response) => {
      try {
        const stats = this.gameService.getStats();

        if (req.query.detailed === "true") {
          const detailedStats = this.getOrComputeMetric(
            "detailedGameStats",
            () => {
              const games = this.gameService.getAllGames();

              const gameAges: number[] = [];
              const playerCounts: number[] = [];
              let totalTextLength = 0;
              let gameCount = 0;

              games.forEach((game) => {
                if (game.state !== "finished") {
                  gameCount++;
                  playerCounts.push(game.playerCount);
                  const gameAge = (Date.now() - this.metrics.startTime) / 1000;
                  gameAges.push(gameAge);

                  totalTextLength += 250;
                }
              });

              return {
                avgGameAgeSeconds: gameAges.length
                  ? gameAges.reduce((sum, age) => sum + age, 0) /
                    gameAges.length
                  : 0,
                avgPlayersPerGame: playerCounts.length
                  ? playerCounts.reduce((sum, count) => sum + count, 0) /
                    playerCounts.length
                  : 0,
                totalTextCharacters: totalTextLength,
                avgTextLengthPerGame: gameCount
                  ? totalTextLength / gameCount
                  : 0,
              };
            }
          );

          res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            stats,
            detailedStats,
          });
        } else {
          res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            stats,
          });
        }
      } catch (error) {
        logger.error("Error getting game stats", { error });
        res.status(500).json({
          status: "error",
          message: "Error retrieving stats",
        });
      }
    });

    router.get(
      "/performance",
      this.requireApiKey,
      (_req: Request, res: Response) => {
        const startTime = performance.now();

        const memBefore = process.memoryUsage();

        try {
          const operations = {
            memoryAllocation: this.testMemoryAllocation(),
            objectCreation: this.testObjectCreation(),
            arrayOperations: this.testArrayOperations(),
            stringOperations: this.testStringOperations(),
          };

          const elapsedTime = performance.now() - startTime;

          const memAfter = process.memoryUsage();

          res.status(200).json({
            status: "ok",
            executionTimeMs: elapsedTime.toFixed(3),
            memoryBefore: {
              heapUsed: `${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`,
            },
            memoryAfter: {
              heapUsed: `${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`,
            },
            memoryDelta: {
              heapUsed: `${Math.round(
                (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024
              )}MB`,
            },
            operationResults: operations,
          });

          logger.info("Performance test completed", {
            executionTimeMs: elapsedTime.toFixed(3),
            memoryDeltaMB: Math.round(
              (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024
            ),
          });
        } catch (error) {
          logger.error("Error in performance test", { error });
          res.status(500).json({
            status: "error",
            message: "Error performing performance test",
          });
        }
      }
    );

    router.get(
      "/debug/memory",
      this.requireApiKey,
      (req: Request, res: Response) => {
        try {
          const memoryUsage = process.memoryUsage();

          if (req.query.gc === "true" && global.gc) {
            logger.info("Forcing garbage collection");
            global.gc();

            const memoryAfterGC = process.memoryUsage();

            res.status(200).json({
              status: "ok",
              timestamp: new Date().toISOString(),
              memoryBefore: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(
                  memoryUsage.heapTotal / 1024 / 1024
                )}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
              },
              memoryAfter: {
                rss: `${Math.round(memoryAfterGC.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(
                  memoryAfterGC.heapTotal / 1024 / 1024
                )}MB`,
                heapUsed: `${Math.round(
                  memoryAfterGC.heapUsed / 1024 / 1024
                )}MB`,
                external: `${Math.round(
                  memoryAfterGC.external / 1024 / 1024
                )}MB`,
              },
              freed: {
                heap: `${Math.round(
                  (memoryUsage.heapUsed - memoryAfterGC.heapUsed) / 1024 / 1024
                )}MB`,
              },
            });
          } else {
            res.status(200).json({
              status: "ok",
              timestamp: new Date().toISOString(),
              memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(
                  memoryUsage.heapTotal / 1024 / 1024
                )}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
              },
              gcAvailable: !!global.gc,
              note: global.gc
                ? "You can force GC by adding '?gc=true' to the URL"
                : "Run Node with --expose-gc to enable manual garbage collection",
            });
          }
        } catch (error) {
          logger.error("Error getting memory debug info", { error });
          res.status(500).json({
            status: "error",
            message: "Error retrieving memory debug info",
          });
        }
      }
    );

    /**
     * System health dashboard endpoint
     * Provides a comprehensive view of system health and self-healing status
     */
    router.get(
      "/dashboard",
      this.requireApiKey,
      (_req: Request, res: Response) => {
        try {
          const memoryUsage = process.memoryUsage();
          const cpuInfo = os.cpus();
          const loadAvg = os.loadavg();

          const memoryTotal = os.totalmem();
          const memoryFree = os.freemem();
          const systemMemoryPercent = 100 * (1 - memoryFree / memoryTotal);

          const heapUsedPercent =
            100 * (memoryUsage.heapUsed / memoryUsage.heapTotal);

          const gameStats = this.gameService.getStats();
          const systemStatus = this.gameService.getSystemStatus();

          const memoryHealthScore =
            100 - Math.min(100, Math.max(0, heapUsedPercent));
          const loadHealthScore =
            100 -
            Math.min(100, Math.max(0, (loadAvg[0] / cpuInfo.length) * 100));
          const gameCountHealthScore =
            100 -
            Math.min(100, Math.max(0, (gameStats.activeGames / 100) * 100));

          const overallHealthScore = Math.round(
            memoryHealthScore * 0.4 +
              loadHealthScore * 0.3 +
              gameCountHealthScore * 0.3
          );

          res.status(200).json({
            timestamp: new Date().toISOString(),
            systemUptime: Math.floor(os.uptime() / 60) + " minutes",
            processUptime:
              Math.floor((Date.now() - this.metrics.startTime) / 1000 / 60) +
              " minutes",

            healthStatus:
              overallHealthScore > 80
                ? "good"
                : overallHealthScore > 50
                ? "warning"
                : "critical",
            healthScore: overallHealthScore,

            componentScores: {
              memory: {
                score: memoryHealthScore,
                status:
                  memoryHealthScore > 80
                    ? "good"
                    : memoryHealthScore > 50
                    ? "warning"
                    : "critical",
              },
              cpu: {
                score: loadHealthScore,
                status:
                  loadHealthScore > 80
                    ? "good"
                    : loadHealthScore > 50
                    ? "warning"
                    : "critical",
              },
              gameCount: {
                score: gameCountHealthScore,
                status:
                  gameCountHealthScore > 80
                    ? "good"
                    : gameCountHealthScore > 50
                    ? "warning"
                    : "critical",
              },
            },

            memory: {
              systemTotal: `${Math.round(memoryTotal / 1024 / 1024)}MB`,
              systemFree: `${Math.round(memoryFree / 1024 / 1024)}MB`,
              systemUsedPercent: `${systemMemoryPercent.toFixed(1)}%`,

              heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
              heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
              heapUsedPercent: `${heapUsedPercent.toFixed(1)}%`,

              rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
              external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
            },

            cpu: {
              cores: cpuInfo.length,
              model: cpuInfo[0].model,
              loadAverage: loadAvg.map((val) => val.toFixed(2)),
              loadPerCore: (loadAvg[0] / cpuInfo.length).toFixed(2),
            },

            gameStats: {
              activeGames: gameStats.activeGames,
              activePlayers: gameStats.activePlayers,
              gamesPerState: gameStats.gamesPerState,
              replayCount: gameStats.replayCount,
            },

            selfHealing: {
              protectiveMeasures: {
                acceptingNewPlayers: systemStatus.acceptingNewPlayers,
                throttlingEnabled: systemStatus.throttling.enabled,
                updateFrequency: systemStatus.throttling.updateFrequency,
                gameCreationQueueEnabled:
                  systemStatus.gameCreation.queueEnabled,
                gameCreationQueueSize: systemStatus.gameCreation.queueSize,
                deferringOperations:
                  systemStatus.resourceManagement.deferringOperations,
              },

              configSettings: {
                maxPlayersPerGame: systemStatus.maxPlayersPerGame,
                replayResolutionMs: systemStatus.replay.resolution,
                replayRetentionTimeMs: systemStatus.replay.retentionTimeMs,
              },
            },

            requests: {
              totalCount: Array.from(
                this.metrics.requestCounts.values()
              ).reduce((a, b) => a + b, 0),
              errorCount: Array.from(this.metrics.errors.values()).reduce(
                (a, b) => a + b,
                0
              ),
              topEndpoints: Array.from(this.metrics.requestCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([path, count]) => ({ path, count })),
            },
          });
        } catch (error) {
          logger.error("Error generating dashboard data", { error });
          res.status(500).json({
            status: "error",
            message: "Error generating dashboard data",
          });
        }
      }
    );
    return router;
  }

  private requireApiKey = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (config.env === "production") {
      const apiKey = req.headers["x-api-key"];

      if (apiKey !== process.env.ADMIN_API_KEY) {
        res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
        return;
      }
    }

    next();
  };

  private testMemoryAllocation(): { durationMs: number; iterations: number } {
    const start = performance.now();
    let iterations = 0;

    for (let i = 0; i < 10000; i++) {
      const buffer = Buffer.alloc(1024);
      buffer.fill(0);
      iterations++;
    }

    return {
      durationMs: parseFloat((performance.now() - start).toFixed(3)),
      iterations,
    };
  }

  private testObjectCreation(): { durationMs: number; iterations: number } {
    const start = performance.now();
    let iterations = 0;

    for (let i = 0; i < 10000; i++) {
      iterations++;
    }

    return {
      durationMs: parseFloat((performance.now() - start).toFixed(3)),
      iterations,
    };
  }

  private testArrayOperations(): {
    durationMs: number;
    iterations: number;
    result: number;
  } {
    const start = performance.now();
    let iterations = 0;

    const array: number[] = [];
    for (let i = 0; i < 10000; i++) {
      array.push(i);
      iterations++;
    }

    const mapped = array.map((x) => x * 2);
    const filtered = mapped.filter((x) => x % 4 === 0);
    const sum = filtered.reduce((a, b) => a + b, 0);

    iterations += 3;

    return {
      durationMs: parseFloat((performance.now() - start).toFixed(3)),
      iterations,
      result: sum,
    };
  }

  private testStringOperations(): {
    durationMs: number;
    iterations: number;
    stringLength: number;
  } {
    const start = performance.now();
    let iterations = 0;

    let result = "";
    for (let i = 0; i < 1000; i++) {
      result += `chunk-${i}-`;
      iterations++;
    }

    const parts = result.split("-");
    const joined = parts.join(".");
    const replaced = joined.replace(/\./g, "_");

    iterations += 3;

    return {
      durationMs: parseFloat((performance.now() - start).toFixed(3)),
      iterations,
      stringLength: replaced.length,
    };
  }
}

export function createMonitoringRoutes(gameService: GameService): Router {
  const monitoringService = new MonitoringService(gameService);
  return monitoringService.createMonitoringRoutes();
}
