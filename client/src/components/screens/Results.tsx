import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { Player } from '../../context/SocketContext';

import RaceTimer from '../game/RaceTimer';

import { 
  TrophyIcon, 
  ChartBarIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ArrowLeftIcon, 
  HomeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const MedalIcon: React.FC<{ position: number }> = ({ position }) => {
  switch (position) {
    case 1:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500/20">
          <TrophyIcon className="h-6 w-6 text-yellow-400" />
        </div>
      );
    case 2:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-400/20">
          <TrophyIcon className="h-6 w-6 text-gray-300" />
        </div>
      );
    case 3:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-600/20">
          <TrophyIcon className="h-6 w-6 text-amber-600" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700/20">
          <span className="text-lg font-semibold text-gray-500">{position}</span>
        </div>
      );
  }
};

const Results: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { 
    currentGame, 
    player, 
    isFinished,
    raceText,
    raceSummary,
    replay,
    getReplay,
    resetGame,
    raceStartTime,
    raceEndTime
  } = useGame();
  const { isConnected } = useSocket();
  
  const [loading, setLoading] = useState<boolean>(false);
  const [showStats, setShowStats] = useState<boolean>(true);

  useEffect(() => {
    if (isConnected && !currentGame && !player) {
      navigate('/');
    }
  }, [isConnected, currentGame, player, navigate]);

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

  const rankedPlayers = useMemo(() => {
    if (!currentGame) return [];
    
    return [...currentGame.players]
      .filter(p => !p.isSpectator)
      .sort((a, b) => {
        if (a.position === 100 && b.position !== 100) return -1;
        if (a.position !== 100 && b.position === 100) return 1;
        
        if (a.position !== b.position) return b.position - a.position;
        
        return b.wpm - a.wpm;
      })
      .map((p, index) => ({ ...p, rank: index + 1 }));
  }, [currentGame]);

  const stats = useMemo(() => {
    if (!rankedPlayers.length) return null;
    
    const finishedPlayers = rankedPlayers.filter(p => p.position === 100);
    const totalWpm = finishedPlayers.reduce((sum, p) => sum + p.wpm, 0);
    const totalAccuracy = finishedPlayers.reduce((sum, p) => sum + p.accuracy, 0);
    
    return {
      avgWpm: finishedPlayers.length ? Math.round(totalWpm / finishedPlayers.length) : 0,
      avgAccuracy: finishedPlayers.length ? Math.round(totalAccuracy / finishedPlayers.length) : 0,
      finishRate: Math.round((finishedPlayers.length / rankedPlayers.length) * 100),
      fastestWpm: finishedPlayers.length ? Math.max(...finishedPlayers.map(p => p.wpm)) : 0,
      participantCount: rankedPlayers.length
    };
  }, [rankedPlayers]);

  const playerStats = useMemo(() => {
    if (!player || !rankedPlayers.length) return null;
    
    const playerRank = rankedPlayers.find(p => p.id === player.id)?.rank || 0;
    const percentile = Math.round(((rankedPlayers.length - playerRank + 1) / rankedPlayers.length) * 100);
    
    return {
      rank: playerRank,
      percentile: percentile,
      isTop3: playerRank <= 3,
      isWinner: playerRank === 1
    };
  }, [player, rankedPlayers]);

  const handleNewRace = () => {
    resetGame();
    navigate('/');
  };

  const raceTime = useMemo(() => {
    if (!raceStartTime || !raceEndTime) return 0;
    return raceEndTime - raceStartTime;
  }, [raceStartTime, raceEndTime]);

  if (!currentGame || !gameId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading results...</p>
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
      
      {playerStats?.isTop3 && (
        <div className="absolute inset-0 bg-confetti opacity-10 pointer-events-none"></div>
      )}
      
      <div className="relative container mx-auto px-4 py-6 flex flex-col min-h-screen z-10">
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <Link 
              to="/"
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 mr-4"
              onClick={() => resetGame()}
            >
              <HomeIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">Race Results</h1>
          </div>
          
          <RaceTimer time={raceTime} isFinished={true} />
        </div>
        
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Your Results</h2>
                
                {player && (
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <MedalIcon position={playerStats?.rank || 0} />
                      <div className="ml-4">
                        <div className="text-sm text-gray-400">Your Rank</div>
                        <div className="flex items-baseline">
                          <span className="text-2xl font-bold mr-2">
                            {playerStats?.rank ? `${playerStats.rank}${getRankSuffix(playerStats.rank)}` : '-'}
                          </span>
                          <span className="text-sm text-gray-400">
                            of {rankedPlayers.length} racers
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {playerStats?.percentile && (
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Percentile</div>
                        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary-500"
                            style={{ width: `${playerStats.percentile}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                          <span>0%</span>
                          <span>Better than {playerStats.percentile}% of racers</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">Your Speed</div>
                        <div className="text-3xl font-bold text-primary-400">{Math.round(player.wpm)}</div>
                        <div className="text-xs text-gray-500">WPM</div>
                      </div>
                      
                      <div className="bg-gray-700/50 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">Accuracy</div>
                        <div className="text-3xl font-bold text-green-400">{Math.round(player.accuracy)}%</div>
                      </div>
                    </div>
                    
                    {playerStats?.isWinner && (
                      <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-4 text-center">
                        <TrophyIcon className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                        <div className="text-lg font-semibold text-yellow-400">
                          Race Winner!
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          You finished first in this race
                        </div>
                      </div>
                    )}
                    
                    {!playerStats?.isWinner && playerStats?.isTop3 && (
                      <div className="bg-secondary-500/20 border border-secondary-500/40 rounded-lg p-4 text-center">
                        <svg className="h-8 w-8 text-secondary-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <div className="text-lg font-semibold text-secondary-400">
                          Top 3 Finisher!
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          You finished in the top 3 racers
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
            
            {stats && (
              <motion.div 
                className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <div className="p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center">
                    <ChartBarIcon className="h-5 w-5 mr-2 text-primary-400" />
                    Race Statistics
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Avg. Speed</div>
                      <div className="text-xl font-bold">{stats.avgWpm}</div>
                      <div className="text-xs text-gray-500">WPM</div>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Top Speed</div>
                      <div className="text-xl font-bold text-primary-400">{stats.fastestWpm}</div>
                      <div className="text-xs text-gray-500">WPM</div>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Avg. Accuracy</div>
                      <div className="text-xl font-bold">{stats.avgAccuracy}%</div>
                    </div>
                    
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">Finish Rate</div>
                      <div className="text-xl font-bold">{stats.finishRate}%</div>
                      <div className="text-xs text-gray-500">{rankedPlayers.filter(p => p.position === 100).length}/{rankedPlayers.length}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
          
          <div className="lg:col-span-2">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex border-b border-gray-700">
                <button 
                  className={`flex-1 py-3 px-4 text-center font-medium text-sm ${
                    showStats ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setShowStats(true)}
                >
                  Leaderboard
                </button>
                <button 
                  className={`flex-1 py-3 px-4 text-center font-medium text-sm ${
                    !showStats ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setShowStats(false)}
                >
                  Race Text
                </button>
              </div>
              
              {showStats ? (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <TrophyIcon className="h-5 w-5 mr-2 text-yellow-400" />
                    Final Rankings
                  </h2>
                  
                  <div className="overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 py-2 text-sm font-medium text-gray-400 border-b border-gray-700">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-4">Player</div>
                      <div className="col-span-2 text-center">WPM</div>
                      <div className="col-span-2 text-center">Accuracy</div>
                      <div className="col-span-3 text-right">Status</div>
                    </div>
                    
                    <div className="divide-y divide-gray-700">
                      {rankedPlayers.map((p, index) => {
                        const isCurrentPlayer = p.id === player?.id;
                        
                        return (
                          <motion.div 
                            key={p.id}
                            className={`grid grid-cols-12 gap-2 py-3 text-sm ${
                              isCurrentPlayer ? 'bg-primary-900/20' : ''
                            }`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                          >
                            <div className="col-span-1 flex justify-center items-center">
                              {p.rank <= 3 ? (
                                <div 
                                  className={`w-6 h-6 flex items-center justify-center rounded-full font-bold text-xs ${
                                    p.rank === 1 
                                      ? 'bg-yellow-500 text-yellow-900' 
                                      : p.rank === 2 
                                        ? 'bg-gray-300 text-gray-800' 
                                        : 'bg-amber-600 text-amber-900'
                                  }`}
                                >
                                  {p.rank}
                                </div>
                              ) : (
                                <div className="text-gray-500 font-medium">
                                  {p.rank}
                                </div>
                              )}
                            </div>
                            
                            <div className="col-span-4 flex items-center">
                              <div 
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: p.color }}
                              ></div>
                              <span className={isCurrentPlayer ? 'font-semibold' : ''}>
                                {p.name}
                                {isCurrentPlayer && " (You)"}
                              </span>
                            </div>
                            
                            <div className="col-span-2 text-center font-mono">
                              {Math.round(p.wpm)}
                            </div>
                            
                            <div className="col-span-2 text-center font-mono">
                              {Math.round(p.accuracy)}%
                            </div>
                            
                            <div className="col-span-3 text-right">
                              {p.position === 100 ? (
                                <span className="inline-flex items-center text-green-400">
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  Completed
                                </span>
                              ) : p.isConnected ? (
                                <span className="inline-flex items-center text-yellow-400">
                                  <span>{Math.round(p.position)}% Complete</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-red-400">
                                  <span>Disconnected</span>
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Race Text</h2>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-gray-300">
                    {raceText || "Race text not available"}
                  </div>
                </div>
              )}
            </motion.div>
            
            <motion.div 
              className="mt-6 flex gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <button 
                className="btn-primary flex-1 py-4 rounded-lg flex items-center justify-center"
                onClick={handleNewRace}
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                New Race
              </button>
              
              <Link 
                to="/"
                className="btn-outline flex-1 py-4 rounded-lg flex items-center justify-center"
                onClick={() => resetGame()}
              >
                <HomeIcon className="h-5 w-5 mr-2" />
                Back to Home
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getRankSuffix = (rank: number): string => {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
};

export default Results;