import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';

import RaceTimer from '../game/RaceTimer';

import { 
  ArrowUturnLeftIcon,
  HomeIcon,
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const Replay: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { replay, getReplay, resetGame } = useGame();
  const { isConnected } = useSocket();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const controls = useAnimation();

  useEffect(() => {
    const fetchReplay = async () => {
      if (gameId && !replay && !loading) {
        try {
          setLoading(true);
          await getReplay(gameId);
        } catch (error) {
          console.error('Failed to fetch replay:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchReplay();
  }, [gameId, replay, getReplay, loading]);
  
  useEffect(() => {
    if (replay) {
      const replayDuration = replay.endTime - replay.startTime;
      setDuration(replayDuration);
    }
  }, [replay]);
  
  const processedPlayers = useMemo(() => {
    if (!replay) return [];
    
    return replay.players.map((player: { id: string; name: string; snapshots: { timestamp: number; position: number; wpm: number; accuracy: number; }[]; color?: string }) => {
      const enhancedSnapshots = [];
      
      for (let i = 0; i < player.snapshots.length - 1; i++) {
        const current = player.snapshots[i];
        const next = player.snapshots[i + 1];
        const timeDiff = next.timestamp - current.timestamp;
        
        enhancedSnapshots.push(current);
        
        if (timeDiff > 500) {
          const steps = Math.floor(timeDiff / 250); 
          
          for (let step = 1; step < steps; step++) {
            const fraction = step / steps;
            const interpolatedTimestamp = current.timestamp + (timeDiff * fraction);
            const interpolatedPosition = current.position + ((next.position - current.position) * fraction);
            const interpolatedWpm = current.wpm + ((next.wpm - current.wpm) * fraction);
            const interpolatedAccuracy = current.accuracy + ((next.accuracy - current.accuracy) * fraction);
            
            enhancedSnapshots.push({
              timestamp: interpolatedTimestamp,
              position: interpolatedPosition,
              wpm: interpolatedWpm,
              accuracy: interpolatedAccuracy
            });
          }
        }
      }
      
      if (player.snapshots.length > 0) {
        enhancedSnapshots.push(player.snapshots[player.snapshots.length - 1]);
      }
      
      return {
        id: player.id,
        name: player.name,
        snapshots: enhancedSnapshots,
        color: player.color || getRandomColor(player.id)
      };
    });
  }, [replay]);
  
  useEffect(() => {
    if (!replay || !isPlaying) return;
    
    const startTime = performance.now() - currentTime * playbackSpeed;
    
    const animate = (time: number) => {
      const elapsed = (time - startTime) / playbackSpeed;
      
      if (elapsed >= duration) {
        setCurrentTime(duration);
        setIsPlaying(false);
        return;
      }
      
      setCurrentTime(elapsed);
      lastTimeRef.current = elapsed;
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, replay, duration, playbackSpeed, currentTime]);
  
  const currentPlayerPositions = useMemo(() => {
    if (!processedPlayers.length || !replay) return [];
    
    const adjustedTime = currentTime + replay.startTime;
    
    return processedPlayers.map(player => {
      let position = 0;
      let wpm = 0;
      let accuracy = 0;
      
      const snapshots = player.snapshots;
      
      if (snapshots.length === 0) {
        return { id: player.id, name: player.name, color: player.color, position: 0, wpm: 0, accuracy: 0 };
      }
      
      if (adjustedTime <= snapshots[0].timestamp) {
        position = 0;
        wpm = 0;
        accuracy = 0;
      } 
      else if (adjustedTime >= snapshots[snapshots.length - 1].timestamp) {
        position = snapshots[snapshots.length - 1].position;
        wpm = snapshots[snapshots.length - 1].wpm;
        accuracy = snapshots[snapshots.length - 1].accuracy;
      } 
      else {
        for (let i = 0; i < snapshots.length - 1; i++) {
          if (adjustedTime >= snapshots[i].timestamp && adjustedTime <= snapshots[i + 1].timestamp) {
            const currentSnapshot = snapshots[i];
            const nextSnapshot = snapshots[i + 1];
            const timeInterval = nextSnapshot.timestamp - currentSnapshot.timestamp;
            const timeProgress = (adjustedTime - currentSnapshot.timestamp) / timeInterval;
            
            position = currentSnapshot.position + (nextSnapshot.position - currentSnapshot.position) * timeProgress;
            wpm = currentSnapshot.wpm + (nextSnapshot.wpm - currentSnapshot.wpm) * timeProgress;
            accuracy = currentSnapshot.accuracy + (nextSnapshot.accuracy - currentSnapshot.accuracy) * timeProgress;
            break;
          }
        }
      }
      
      return {
        id: player.id,
        name: player.name,
        color: player.color,
        position,
        wpm,
        accuracy
      };
    }).sort((a, b) => b.position - a.position); 
  }, [processedPlayers, currentTime, replay]);
  
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !replay) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(Math.max(0, x / rect.width), 1);
    const newTime = percentage * duration;
    
    setCurrentTime(newTime);
    
    if (!isPlaying) {
      lastTimeRef.current = newTime;
    }
  };
  
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };
  
  const skipTime = (seconds: number) => {
    const newTime = Math.min(Math.max(0, currentTime + seconds * 1000), duration);
    setCurrentTime(newTime);
    
    if (!isPlaying) {
      lastTimeRef.current = newTime;
    }
  };
  
  const resetReplay = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };
  
  const completionPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const topPlayer = useMemo(() => {
    if (!currentPlayerPositions.length) return null;
    return [...currentPlayerPositions].sort((a, b) => b.wpm - a.wpm)[0];
  }, [currentPlayerPositions]);
  
  if (!replay && loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading replay...</p>
        </div>
      </div>
    );
  }
  
  if (!replay && !loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center max-w-md px-4">
          <div className="text-yellow-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-4">Replay Not Available</h2>
          <p className="mb-6 text-gray-400">
            The replay data for this race could not be found. The race might have expired or was never completed.
          </p>
          <Link
            to="/"
            className="btn-primary py-3 px-6 rounded-lg inline-flex items-center"
            onClick={() => resetGame()}
          >
            <HomeIcon className="h-5 w-5 mr-2" />
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary-600 opacity-5 blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-32 w-80 h-80 rounded-full bg-secondary-600 opacity-5 blur-3xl"></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-6 flex flex-col min-h-screen z-10">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <Link 
              to={`/results/${gameId}`}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 mr-4"
            >
              <ArrowUturnLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Race Replay</h1>
          </div>
          
          <div className="flex items-center">
            <div className="text-sm text-gray-400 mr-4">
              <span className="font-mono">{formatTime(currentTime)}</span>
              {' / '}
              <span className="font-mono">{formatTime(duration)}</span>
            </div>
            
            <RaceTimer 
              time={replay?.endTime ? replay.endTime - replay.startTime : 0} 
              isFinished={true} 
              small={true}
              showLabel={false}
            />
          </div>
        </div>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="p-6 pb-2">
                <h2 className="text-lg font-semibold mb-4">Race Progress</h2>
                
                <div className="relative bg-racing-asphalt rounded-lg p-2 overflow-hidden">
                  {currentPlayerPositions.map((player, index) => (
                    <div 
                      key={player.id} 
                      className="track-lane relative h-12 my-2 bg-racing-lane rounded overflow-hidden"
                    >
                      <div className="lane-divider"></div>
                      
                      <div className="player-tag bg-gray-900/80 border-gray-600 text-sm">
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs opacity-80">{Math.round(player.wpm)} WPM</div>
                      </div>
                      
                      <motion.div 
                        className="absolute top-1/2 transform -translate-y-1/2 z-10"
                        style={{ 
                          left: `${player.position}%`, 
                          backgroundColor: player.color,
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)'
                        }}
                      />
                      
                      <div 
                        className="absolute inset-y-0 left-0 h-full opacity-30"
                        style={{ 
                          width: `${player.position}%`,
                          background: `linear-gradient(90deg, transparent, ${player.color})`
                        }}
                      />
                    </div>
                  ))}
                  
                  <div className="absolute inset-0 pointer-events-none">
                    {[25, 50, 75, 100].map(mark => (
                      <div 
                        key={mark} 
                        className="absolute top-0 h-full w-px bg-white/20"
                        style={{ left: `${mark}%` }}
                      >
                        <div className="absolute bottom-1 left-0 transform -translate-x-1/2 text-xs text-white/60">
                          {mark}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="p-6 pt-2">
                <div 
                  ref={timelineRef}
                  className="w-full h-4 bg-gray-700 rounded-full cursor-pointer relative mb-4 overflow-hidden"
                  onClick={handleSeek}
                >
                  <div className="absolute inset-0 flex justify-between px-2">
                    {[0, 1, 2, 3, 4].map(mark => (
                      <div 
                        key={mark} 
                        className="h-full w-px bg-gray-600"
                        style={{ opacity: mark === 0 || mark === 4 ? 0 : 0.5 }}
                      />
                    ))}
                  </div>
                  
                  <div 
                    className="h-full bg-primary-500 rounded-full"
                    style={{ width: `${completionPercentage}%` }}
                  />
                  
                  <div 
                    className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md"
                    style={{ left: `calc(${completionPercentage}% - 8px)` }}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex space-x-4">
                    <button 
                      className="p-2 text-gray-400 hover:text-white"
                      onClick={() => skipTime(-5)}
                    >
                      <BackwardIcon className="h-6 w-6" />
                    </button>
                    
                    <button 
                      className="p-3 bg-primary-500 hover:bg-primary-600 rounded-full text-white"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? (
                        <PauseIcon className="h-6 w-6" />
                      ) : (
                        <PlayIcon className="h-6 w-6" />
                      )}
                    </button>
                    
                    <button 
                      className="p-2 text-gray-400 hover:text-white"
                      onClick={() => skipTime(5)}
                    >
                      <ForwardIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button 
                      className="p-2 text-gray-400 hover:text-white"
                      onClick={resetReplay}
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                    
                    <div className="flex space-x-1">
                      {[0.5, 1, 1.5, 2].map(speed => (
                        <button 
                          key={speed}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            playbackSpeed === speed
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                          onClick={() => handleSpeedChange(speed)}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Race Text</h2>
                <div className="bg-gray-900/50 rounded-lg p-4 max-h-40 overflow-y-auto custom-scrollbar">
                  <p className="font-mono text-gray-300">
                    {replay?.text}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
          
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-primary-400" />
                  Current Stats
                </h2>
                
                <div className="text-xs text-gray-400 mb-1">
                  Time: {formatTime(currentTime)} / {formatTime(duration)} 
                  ({Math.round(completionPercentage)}%)
                </div>
                
                {topPlayer && (
                  <div className="bg-gray-700/50 rounded-lg p-4 my-3">
                    <div className="text-sm text-gray-400 mb-1">Current Leader</div>
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: topPlayer.color }}
                      />
                      <span className="font-medium">{topPlayer.name}</span>
                    </div>
                    <div className="grid grid-cols-2 mt-2 text-sm">
                      <div>
                        <span className="text-gray-400">Progress:</span>{' '}
                        <span className="font-mono">{Math.round(topPlayer.position)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400">WPM:</span>{' '}
                        <span className="font-mono">{Math.round(topPlayer.wpm)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Speed Chart</div>
                  <div className="bg-gray-900/50 rounded-lg p-4 h-40 flex items-center justify-center">
                    <div className="text-gray-500 text-center">
                      <ChartBarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <span className="text-sm">
                        WPM visualization will appear here
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <TrophyIcon className="h-5 w-5 mr-2 text-yellow-400" />
                  Current Standings
                </h2>
                
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                  {currentPlayerPositions.map((player, index) => (
                    <div 
                      key={player.id}
                      className="bg-gray-700/50 rounded-lg p-3 flex items-center"
                    >
                      <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 text-sm font-bold mr-3">
                        {index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: player.color }}
                          />
                          <span className="font-medium">{player.name}</span>
                        </div>
                        
                        <div className="mt-2">
                          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
                            <div 
                              className="h-1.5 rounded-full"
                              style={{ 
                                width: `${player.position}%`,
                                backgroundColor: player.color
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{Math.round(player.position)}%</span>
                            <span className="text-gray-400">{Math.round(player.wpm)} WPM</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 bg-gray-900/50 text-center">
                <Link 
                  to={`/results/${gameId}`}
                  className="text-sm text-primary-400 hover:text-primary-300 font-medium"
                >
                  View Final Results
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getRandomColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

export default Replay;