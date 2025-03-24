import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../context/GameContext';

import { ArrowRightIcon, BoltIcon, UserGroupIcon, TrophyIcon } from '@heroicons/react/24/outline';

const Home: React.FC = () => {

  const { isConnected, connect, getAllGames } = useSocket();
  const { createGame, joinGame, error, resetError } = useGame();
  
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinGame, setShowJoinGame] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [activeGames, setActiveGames] = useState<{id: string; playerCount: number; status: string}[]>([]);

  useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  useEffect(() => {
    const fetchGames = async () => {
      if (isConnected) {
        try {
          setLoadingGames(true);
          const games = await getAllGames();
          const filteredGames = games
            .filter(game => game.status !== 'finished')
            .sort((a, b) => b.playerCount - a.playerCount);
          setActiveGames(filteredGames.slice(0, 5)); 
        } catch (error) {
          console.error('Failed to fetch active games:', error);
        } finally {
          setLoadingGames(false);
        }
      }
    };

    fetchGames();
    const interval = setInterval(fetchGames, 10000);
    
    return () => clearInterval(interval);
  }, [isConnected, getAllGames]);

  useEffect(() => {
    return () => {
      if (error) {
        resetError();
      }
    };
  }, [error, resetError]);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      setIsCreating(true);
     const gameId =  await createGame(playerName.trim());
    } catch (error) {
      console.error('Error creating game:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!gameId.trim()) {
      alert('Please enter a game code');
      return;
    }

    try {
      setIsJoining(true);
      await joinGame(gameId.trim(), playerName.trim());
    } catch (error) {
      console.error('Error joining game:', error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-600 opacity-10 blur-3xl"></div>
        <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-secondary-600 opacity-10 blur-3xl"></div>
        <div className="absolute -bottom-32 left-1/4 w-64 h-64 rounded-full bg-purple-600 opacity-10 blur-3xl"></div>
      </div>
     
      <div className="relative container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen z-10">
     
        <motion.div 
          className="mb-12 text-center"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="text-6xl md:text-7xl font-display text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-500 mb-4">
            TYPE RACER
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            Race against friends and improve your typing speed in real-time!
          </p>
        </motion.div>
        
        <motion.div 
          className="w-full max-w-lg"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <div className="backdrop-blur-xl bg-gray-800/70 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-8 pt-6">
              <div className="mb-6">
                <label htmlFor="playerName" className="block text-sm font-medium text-gray-300 mb-1">
                  Your Name
                </label>
                <input
                  id="playerName"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your racing name"
                  className="input w-full bg-gray-700 text-white border-gray-600 focus:border-primary-500 focus:ring-primary-500"
                  maxLength={20}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary py-3 flex items-center justify-center space-x-2"
                  onClick={handleCreateGame}
                  disabled={isCreating || !isConnected}
                >
                  {isCreating ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    <>
                      <BoltIcon className="h-5 w-5" />
                      <span>Create Race</span>
                    </>
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`py-3 flex items-center justify-center space-x-2 ${
                    showJoinGame ? 'bg-gray-700 text-white' : 'btn-outline'
                  }`}
                  onClick={() => setShowJoinGame(!showJoinGame)}
                >
                  <UserGroupIcon className="h-5 w-5" />
                  <span>Join Race</span>
                </motion.button>
              </div>
              
              {showJoinGame && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-6"
                >
                  <div className="mb-4">
                    <label htmlFor="gameId" className="block text-sm font-medium text-gray-300 mb-1">
                      Game Code
                    </label>
                    <div className="flex">
                      <input
                        id="gameId"
                        type="text"
                        value={gameId}
                        onChange={(e) => setGameId(e.target.value)}
                        placeholder="Enter game code"
                        className="input flex-1 bg-gray-700 text-white border-gray-600 focus:border-primary-500 focus:ring-primary-500"
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary ml-2 px-4"
                        onClick={handleJoinGame}
                        disabled={isJoining || !isConnected}
                      >
                        {isJoining ? (
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <ArrowRightIcon className="h-5 w-5" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
                      <TrophyIcon className="h-4 w-4 mr-1" />
                      Active Games
                    </h3>
                    
                    {loadingGames ? (
                      <div className="flex justify-center py-4">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : activeGames.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {activeGames.map(game => (
                          <motion.div
                            key={game.id}
                            whileHover={{ scale: 1.02 }}
                            className="bg-gray-700/60 rounded-lg p-2 cursor-pointer flex justify-between items-center border border-gray-600/40 hover:border-primary-500/40"
                            onClick={() => setGameId(game.id)}
                          >
                            <div>
                              <p className="text-xs text-gray-400">Game #{game.id.substring(0, 8)}...</p>
                              <p className="text-sm">{game.status === 'waiting' ? 'Waiting for players' : 'In progress'}</p>
                            </div>
                            <div className="flex items-center space-x-1 text-sm">
                              <UserGroupIcon className="h-4 w-4 text-primary-400" />
                              <span className="text-primary-300">{game.playerCount}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-sm text-gray-400 bg-gray-700/30 rounded-lg">
                        No active games found. Create one!
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
            
            <div className="bg-gray-900/50 px-6 py-4 text-center text-sm text-gray-400">
              {isConnected ? (
                <span className="flex items-center justify-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                  Connected to server
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="h-2 w-2 bg-red-500 rounded-full mr-2"></span>
                  Connecting to server...
                </span>
              )}
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="rounded-full bg-primary-500/10 w-12 h-12 flex items-center justify-center mb-4">
              <BoltIcon className="h-6 w-6 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-time Racing</h3>
            <p className="text-gray-400 text-sm">Compete against friends in real-time typing races. See who's the fastest!</p>
          </div>
          
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="rounded-full bg-secondary-500/10 w-12 h-12 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Track Progress</h3>
            <p className="text-gray-400 text-sm">Monitor your typing speed, accuracy, and improvement over time.</p>
          </div>
          
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
            <div className="rounded-full bg-purple-500/10 w-12 h-12 flex items-center justify-center mb-4">
              <TrophyIcon className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Compete & Improve</h3>
            <p className="text-gray-400 text-sm">Challenge yourself to beat your personal best or compete against others.</p>
          </div>
        </motion.div>
        
        <motion.div 
          className="mt-16 text-center text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <p>© {new Date().getFullYear()} Type Racer. All rights reserved.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;