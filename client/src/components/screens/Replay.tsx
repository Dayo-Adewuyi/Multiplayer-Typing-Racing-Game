import { CarIcon } from '../game/RaceTrack';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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





const FinishLineEffect: React.FC<{
  playerPosition: number;
  color: string;
}> = ({ playerPosition, color }) => {
  const [showEffect, setShowEffect] = useState(false);
  
  useEffect(() => {
    if (playerPosition >= 99 && !showEffect) {
      setShowEffect(true);
      
      setTimeout(() => {
        setShowEffect(false);
      }, 1000);
    }
  }, [playerPosition, showEffect]);
  
  if (!showEffect) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.2 }}
      animate={{ opacity: [0, 0.8, 0], scale: [0.2, 1.5, 2] }}
      transition={{ duration: 1 }}
      className="absolute right-0 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full"
      style={{ 
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        zIndex: 5
      }}
    />
  );
};

const RaceTextVisualization: React.FC<{
  text: string;
  players: Array<{
    id: string;
    name: string;
    color: string;
    currentIndex: number;
  }>;
  highlightedPlayerId: string | null;
}> = ({ text, players, highlightedPlayerId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const highlightedPlayer = highlightedPlayerId 
    ? players.find(p => p.id === highlightedPlayerId) 
    : null;
  
  useEffect(() => {
    if (!containerRef.current || !highlightedPlayer) return;
    
    const scrollTimeout = setTimeout(() => {
      const cursorElement = document.getElementById(`cursor-${highlightedPlayer.id}`);
      if (cursorElement) {
        cursorElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
    }, 50);
    
    return () => clearTimeout(scrollTimeout);
  }, [highlightedPlayer?.currentIndex, highlightedPlayer?.id, highlightedPlayer]);
  
  return (
    <div 
      ref={containerRef} 
      className="bg-gray-900/50 rounded-lg p-4 max-h-60 overflow-y-auto custom-scrollbar"
    >
      {highlightedPlayer && (
        <div className="mb-3 flex items-center">
          <div 
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: highlightedPlayer.color }}
          />
          <span className="text-sm text-gray-400">
            Following: {highlightedPlayer.name}'s progress
          </span>
        </div>
      )}
      
      <div className="font-mono text-gray-300 relative whitespace-pre-wrap">
        {text.split('').map((char, index) => {
          const playersAtPosition = players.filter(p => p.currentIndex === index);
          
          const primaryPlayer = playersAtPosition.find(p => p.id === highlightedPlayerId) || 
                              playersAtPosition[0];
          
          const isTypedByHighlighted = highlightedPlayer && index < highlightedPlayer.currentIndex;
          
          let charClassName = "relative ";
          let charStyle = {};
          
          if (primaryPlayer) {
            charClassName += "bg-opacity-30 rounded px-0.5 mx-0.5 ";
            charStyle = { backgroundColor: primaryPlayer.color };
          } else if (isTypedByHighlighted) {
            charClassName += "text-gray-100 ";
          } else {
            charClassName += "text-gray-500 ";
          }
          
          return (
            <span 
              key={index} 
              className={charClassName}
              style={charStyle}
              id={primaryPlayer ? `cursor-${primaryPlayer.id}` : undefined}
            >
              {char}
              
              {primaryPlayer && (
                <motion.span 
                  className="absolute bottom-0 left-0 w-full h-0.5"
                  style={{ backgroundColor: primaryPlayer.color }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity,
                    repeatType: 'reverse'
                  }}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const WpmChart: React.FC<{
  players: Array<{
    id: string;
    name: string;
    color: string;
    snapshots: Array<{
      timestamp: number;
      wpm: number;
    }>;
  }>;
  startTime: number;
  highlightedPlayerId: string | null;
  currentTime: number;
}> = ({ players, startTime, highlightedPlayerId, currentTime }) => {
  const chartData = useMemo(() => {
    const timeRange = 20000; 
    const minTime = Math.max(startTime, startTime + currentTime - timeRange);
    const maxTime = startTime + currentTime;
    
    const data = [];
    const step = 1000; 
    
    for (let time = minTime; time <= maxTime; time += step) {
      const point: any = {
        time: (time - startTime) / 1000 
      };
      
      players.forEach(player => {
        let closestWpm = 0;
        let closestDiff = Infinity;
        
        for (const snapshot of player.snapshots) {
          const diff = Math.abs(snapshot.timestamp - time);
          if (diff < closestDiff) {
            closestDiff = diff;
            closestWpm = snapshot.wpm;
          }
        }
        
        point[player.id] = closestWpm;
      });
      
      data.push(point);
    }
    
    return data;
  }, [players, startTime, currentTime]);
  
  if (!players.length) return (
    <div className="text-gray-500 text-center">
      <ChartBarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <span className="text-sm">No data available</span>
    </div>
  );
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis 
          dataKey="time" 
          label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }} 
          tick={{ fill: '#aaa' }}
        />
        <YAxis 
          label={{ value: 'WPM', angle: -90, position: 'insideLeft' }} 
          tick={{ fill: '#aaa' }}
        />
        <Tooltip 
          formatter={(value: any) => [`${Math.round(value)} WPM`, '']}
          labelFormatter={(label) => `Time: ${label}s`}
          contentStyle={{ backgroundColor: '#222', borderColor: '#555' }}
        />
        {players.map(player => (
          <Line 
            key={player.id}
            type="monotone" 
            dataKey={player.id} 
            name={player.name}
            stroke={player.color}
            strokeWidth={highlightedPlayerId === player.id ? 3 : 1}
            dot={false}
            activeDot={{ r: 4, fill: player.color }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getRandomColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

const Replay: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { replay, getReplay, resetGame } = useGame();
  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get('highlight');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<string | null>(highlightParam);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  
 
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
    
    return replay.players.map((player) => {
      const validSnapshots = Array.isArray(player.progressSnapshots) ? player.progressSnapshots : [];
      
      const enhancedSnapshots = validSnapshots.map(snapshot => ({
        timestamp: snapshot.timestamp,
        position: typeof snapshot.position === 'number' ? snapshot.position * 100 : 0,
        wpm: typeof snapshot.wpm === 'number' ? snapshot.wpm : 0, 
        accuracy: typeof snapshot.accuracy === 'number' ? snapshot.accuracy : 0,
        currentIndex: typeof snapshot.currentIndex === 'number' ? snapshot.currentIndex : 0
      }));
      
      enhancedSnapshots.sort((a, b) => a.timestamp - b.timestamp);
      
      return {
        id: player.id,
        name: player.name,
        snapshots: enhancedSnapshots,
        color: player.color || getRandomColor(player.id),
        finalWpm: player.finalStats?.wpm || 0,
        finalAccuracy: player.finalStats?.accuracy || 0,
        finishTime: player.finalStats?.finishTime || replay.endTime,
        finalStats: player.finalStats
      };
    });
  }, [replay]);
  
  useEffect(() => {
    if (highlightParam && processedPlayers.some(p => p.id === highlightParam)) {
      setHighlightedPlayerId(highlightParam);
    }
  }, [highlightParam, processedPlayers]);

  const currentPlayerPositions = useMemo(() => {
    if (!processedPlayers.length || !replay) return [];
    
    const adjustedTime = currentTime + replay.startTime;
    
    return processedPlayers.map(player => {
      let position = 0;
      let wpm = 0;
      let accuracy = 0;
      let currentIndex = 0;
      
      const snapshots = player.snapshots;
      
      if (snapshots.length === 0) {
        return { 
          id: player.id, 
          name: player.name, 
          color: player.color, 
          position: 0, 
          wpm: 0, 
          accuracy: 0,
          currentIndex: 0
        };
      }
      
      if (adjustedTime <= snapshots[0].timestamp) {
        position = 0;
        wpm = 0;
        accuracy = 0;
        currentIndex = 0;
      } 
      else if (adjustedTime >= player.finishTime || adjustedTime >= snapshots[snapshots.length - 1].timestamp) {
        position = player.finalStats ? 100 : snapshots[snapshots.length - 1].position;
        wpm = player.finalWpm || snapshots[snapshots.length - 1].wpm;
        accuracy = player.finalAccuracy || snapshots[snapshots.length - 1].accuracy;
        currentIndex = snapshots[snapshots.length - 1].currentIndex || 0;
      } 
      else {
        for (let i = 0; i < snapshots.length - 1; i++) {
          if (adjustedTime >= snapshots[i].timestamp && adjustedTime <= snapshots[i + 1].timestamp) {
            const currentSnapshot = snapshots[i];
            const nextSnapshot = snapshots[i + 1];
            const timeInterval = nextSnapshot.timestamp - currentSnapshot.timestamp;
           
            const timeProgress = timeInterval > 0 
              ? (adjustedTime - currentSnapshot.timestamp) / timeInterval 
              : 0;
            
            position = Math.max(0, Math.min(100, 
              currentSnapshot.position + (nextSnapshot.position - currentSnapshot.position) * timeProgress
            ));
            
            wpm = currentSnapshot.wpm + (nextSnapshot.wpm - currentSnapshot.wpm) * timeProgress;
            accuracy = currentSnapshot.accuracy + (nextSnapshot.accuracy - currentSnapshot.accuracy) * timeProgress;
            
            currentIndex = timeProgress < 0.5 
              ? (currentSnapshot.currentIndex || 0)
              : (nextSnapshot.currentIndex || 0);
            
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
        accuracy,
        currentIndex
      };
    }).sort((a, b) => b.position - a.position);  
  }, [processedPlayers, currentTime, replay]);
  
  const togglePlayerHighlight = (playerId: string) => {
    if (highlightedPlayerId === playerId) {
      setHighlightedPlayerId(null);
      navigate(`/replay/${gameId}`);
    } else {
      setHighlightedPlayerId(playerId);
      navigate(`/replay/${gameId}?highlight=${playerId}`);
    }
  };
  
  useEffect(() => {
    if (!replay || !isPlaying) return;
    
    const startAnimation = () => {
      startTimeRef.current = performance.now() - (currentTime * 1000 / playbackSpeed);
      lastFrameTimeRef.current = performance.now();
      
      animationRef.current = requestAnimationFrame(animationFrame);
    };
    
    const animationFrame = (timestamp: number) => {
      const elapsedMs = (timestamp - startTimeRef.current) * playbackSpeed;
      
      const newTimeMs = Math.min(elapsedMs, duration);
      
      if (Math.abs(newTimeMs - currentTime) > 16) { 
        setCurrentTime(newTimeMs);
      }
      
      if (newTimeMs < duration) {
        animationRef.current = requestAnimationFrame(animationFrame);
      } else {
        setIsPlaying(false);
      }
    };
    
    startAnimation();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, duration, replay, currentTime]);
  
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying]);
  
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
  };
  
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
  };
  
  const skipTime = (seconds: number) => {
    const newTime = Math.min(Math.max(0, currentTime + seconds * 1000), duration);
    setCurrentTime(newTime);
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
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 mr-4 flex items-center justify-center"
              title="Back to Results"
            >
              <ArrowUturnLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex items-center">
              <h1 className="text-xl md:text-2xl font-bold">Race Replay</h1>
              {gameId && (
                <>
                  <span className="mx-2 text-gray-500">•</span>
                  <div className="text-sm text-gray-400">
                    Game #{gameId.substring(0, 8)}
                  </div>
                </>
              )}
            </div>
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
                      className={`track-lane relative h-16 my-3 bg-racing-lane rounded overflow-hidden ${
                        highlightedPlayerId === player.id ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-secondary-500' : ''
                      }`}
                      onClick={() => togglePlayerHighlight(player.id)}
                    >
                      <div className="lane-divider"></div>
                      
                      <div className={`player-tag bg-gray-900/80 border-gray-600 text-sm ${
                        highlightedPlayerId === player.id ? 'border-l-4 border-l-secondary-500 pl-2' : ''
                      }`}>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs opacity-80">{Math.round(player.wpm)} WPM</div>
                      </div>
                      
                      <div 
                        key={`car-${player.id}-${currentTime}`} 
                        className="absolute top-1/2 transform -translate-y-1/2 z-10"
                        style={{ 
                          left: `${Math.min(player.position, 100)}%`,
                          transition: isPlaying ? 'left 0.08s linear' : 'none'
                        }}
                      >
                        <CarIcon 
                          color={player.color} 
                          isCurrentPlayer={highlightedPlayerId === player.id}
                          position={player.position}
                          wpm={player.wpm}
                        />
                      </div>
                      
                      <div 
                        className="absolute inset-y-0 left-0 h-full opacity-30"
                        style={{ 
                          width: `${Math.min(player.position, 100)}%`,
                          background: `linear-gradient(90deg, transparent, ${player.color})`
                        }}
                      />
                      
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-white opacity-50">
                        <div className="absolute top-0 bottom-0 -left-2 w-4 bg-gradient-to-r from-transparent to-white opacity-20" />
                      </div>
                      
                      <FinishLineEffect 
                        playerPosition={player.position} 
                        color={player.color} 
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
                
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Click on a player's lane to highlight their performance
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
                {replay?.text && (
                  <RaceTextVisualization 
                    text={replay.text}
                    players={currentPlayerPositions.map(player => ({
                      id: player.id,
                      name: player.name,
                      color: player.color,
                      currentIndex: player.currentIndex || 0
                    }))}
                    highlightedPlayerId={highlightedPlayerId}
                  />
                )}
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
                  <div className={`bg-gray-700/50 rounded-lg p-4 my-3 ${
                    highlightedPlayerId === topPlayer.id ? 'ring-2 ring-secondary-500' : ''
                  }`}>
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
                  <div className="bg-gray-900/50 rounded-lg p-4 h-56">
                    {replay && (
                      <WpmChart 
                        players={processedPlayers}
                        startTime={replay.startTime}
                        highlightedPlayerId={highlightedPlayerId}
                        currentTime={currentTime}
                      />
                    )}
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
                      className={`bg-gray-700/50 rounded-lg p-3 flex items-center cursor-pointer ${
                        highlightedPlayerId === player.id ? 'ring-2 ring-secondary-500' : ''
                      }`}
                      onClick={() => togglePlayerHighlight(player.id)}
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

export default Replay;