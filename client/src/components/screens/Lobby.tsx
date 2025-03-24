import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';

import { 
  ArrowLeftIcon, 
  UserPlusIcon, 
  ClipboardIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const Lobby: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { 
    currentGame, 
    player, 
    isSpectator, 
    isReady, 
    markReady, 
    leaveGame
  } = useGame();

  const {countdown} = useSocket();
  const { isConnected } = useSocket();
  
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (isConnected && !currentGame && !player) {
      navigate('/');
    }
  }, [isConnected, currentGame, player, navigate]);

  useEffect(() => {
    if (countdown !== null) {
      setTimeLeft(countdown);
      
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const copyToClipboard = () => {
    if (!gameId) return;
    
    navigator.clipboard.writeText(gameId)
      .then(() => {
        setCopied(true);
        toast.success('Game code copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        toast.error('Failed to copy game code');
      });
  };

  if (!currentGame || !gameId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  const connectedPlayers = currentGame.players.filter(p => p.isConnected && !p.isSpectator);
  const readyPlayers = connectedPlayers.filter(p => p.isReady);
  const allReady = connectedPlayers.length > 1 && readyPlayers.length === connectedPlayers.length;
  const readyPercentage = connectedPlayers.length ? (readyPlayers.length / connectedPlayers.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-600 opacity-10 blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-32 w-80 h-80 rounded-full bg-secondary-600 opacity-10 blur-3xl"></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-12 flex flex-col min-h-screen z-10">
        <div className="mb-8 flex items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 mr-4"
            onClick={() => leaveGame()}
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </motion.button>
          <h1 className="text-2xl font-bold">Race Lobby</h1>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 space-y-6">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <UserPlusIcon className="h-5 w-5 mr-2 text-primary-400" />
                  Game Details
                </h2>
                
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">Game Code</div>
                  <div className="flex">
                    <input
                      type="text"
                      value={gameId}
                      readOnly
                      className="bg-gray-700 rounded-l-md px-3 py-2 w-full text-sm border-gray-600 focus:outline-none"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="bg-gray-700 hover:bg-gray-600 text-white rounded-r-md flex items-center justify-center px-3 border-l border-gray-600"
                    >
                      {copied ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      ) : (
                        <ClipboardIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Players</div>
                    <div className="text-xl font-semibold">
                      {connectedPlayers.length}/{currentGame.maxPlayers}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Status</div>
                    <div className="text-xl font-semibold flex items-center">
                      {timeLeft !== null ? (
                        <span className="flex items-center text-yellow-400">
                          <ClockIcon className="h-5 w-5 mr-1" />
                          {timeLeft}s
                        </span>
                      ) : allReady ? (
                        <span className="flex items-center text-green-400">
                          <CheckCircleIcon className="h-5 w-5 mr-1" />
                          Ready
                        </span>
                      ) : (
                        <span className="flex items-center text-yellow-400">
                          <ClockIcon className="h-5 w-5 mr-1" />
                          Waiting
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between mb-2 text-sm">
                    <span>Ready Players</span>
                    <span className="text-primary-400">{readyPlayers.length}/{connectedPlayers.length}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-primary-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${readyPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/50 p-4">
                <div className="text-sm text-gray-400 mb-2">Race Preview                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 max-h-20 overflow-y-auto custom-scrollbar">
                  <p className="text-sm text-gray-300">
                    {currentGame.text.substring(0, 150)}
                    {currentGame.text.length > 150 ? '...' : ''}
                  </p>
                </div>
              </div>
            </motion.div>
            
            {!isSpectator && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <button
                  onClick={() => markReady()}
                  disabled={isReady || timeLeft !== null}
                  className={`w-full py-4 rounded-lg font-semibold relative overflow-hidden transition-all duration-300 
                    ${isReady 
                      ? 'bg-green-600 text-white cursor-not-allowed' 
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }
                    ${timeLeft !== null ? 'cursor-not-allowed opacity-70' : ''}
                  `}
                >
                  {isReady ? (
                    <span className="flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Ready to Race!
                    </span>
                  ) : timeLeft !== null ? (
                    <span className="flex items-center justify-center">
                      <ClockIcon className="h-5 w-5 mr-2" />
                      Race Starting in {timeLeft}s
                    </span>
                  ) : (
                    "I'm Ready to Race!"
                  )}
                  
                  {isReady && (
                    <>
                      <span className="absolute top-0 left-0 w-2 h-full bg-white opacity-20 animate-pulse-fast"></span>
                      <span className="absolute top-0 right-0 w-2 h-full bg-white opacity-20 animate-pulse-fast" style={{ animationDelay: '0.5s' }}></span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
            
            {isSpectator && (
              <motion.div
                className="bg-yellow-600/20 border border-yellow-600/40 rounded-lg p-4 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <span className="text-yellow-400 font-medium">
                  You are in spectator mode
                </span>
              </motion.div>
            )}
          </div>
          
          <div className="w-full md:w-2/3">
            <motion.div 
              className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 h-full overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Players ({connectedPlayers.length})
                </h2>
                
                <div className="space-y-3">
                  <AnimatePresence>
                    {currentGame.players
                      .filter(p => !p.isSpectator)
                      .map((p, index) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className={`flex items-center p-3 rounded-lg border ${
                            p.isConnected 
                              ? p.id === player?.id
                                ? 'bg-primary-900/30 border-primary-700/50'
                                : 'bg-gray-700/50 border-gray-600/50' 
                              : 'bg-gray-800/30 border-gray-700/30'
                          }`}
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mr-3"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-medium">
                                {p.name}
                                {p.id === player?.id && " (You)"}
                              </span>
                              
                              {!p.isConnected && (
                                <span className="ml-2 text-xs text-red-400 bg-red-400/10 py-0.5 px-2 rounded">
                                  Disconnected
                                </span>
                              )}
                            </div>
                            
                            <div className="text-sm text-gray-400">
                              {p.isReady ? (
                                <span className="text-green-400 flex items-center">
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  Ready to race
                                </span>
                              ) : (
                                <span className="text-yellow-400 flex items-center">
                                  <ClockIcon className="h-4 w-4 mr-1" />
                                  Not ready
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="w-6">
                            {p.isReady ? (
                              <CheckCircleIcon className="h-6 w-6 text-green-400" />
                            ) : (
                              <XCircleIcon className="h-6 w-6 text-gray-500" />
                            )}
                          </div>
                        </motion.div>
                      ))
                    }
                  </AnimatePresence>
                </div>
                
                {currentGame.players.some(p => p.isSpectator && p.isConnected) && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-3 text-gray-300">
                      Spectators ({currentGame.players.filter(p => p.isSpectator && p.isConnected).length})
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {currentGame.players
                        .filter(p => p.isSpectator && p.isConnected)
                        .map(p => (
                          <div 
                            key={p.id} 
                            className="bg-gray-700/30 px-3 py-1 rounded-full text-sm flex items-center"
                          >
                            <span 
                              className="w-4 h-4 rounded-full mr-2"
                              style={{ backgroundColor: p.color }}
                            ></span>
                            {p.name}
                            {p.id === player?.id && " (You)"}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-gray-900/50 p-4">
                <div className="text-sm text-gray-400">
                  {timeLeft !== null ? (
                    <p className="flex items-center justify-center">
                      <ClockIcon className="h-5 w-5 mr-2 text-yellow-400" />
                      Race starting in {timeLeft} seconds! Get ready!
                    </p>
                  ) : allReady ? (
                    <p className="flex items-center justify-center">
                      <CheckCircleIcon className="h-5 w-5 mr-2 text-green-400" />
                      All players are ready! Race will start momentarily.
                    </p>
                  ) : (
                    <p>All players must be ready to start the race. Minimum 4 players required.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {timeLeft !== null && timeLeft <= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm z-50"
          >
            <motion.div
              initial={{ scale: 2 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.8, type: "spring" }}
              className="text-8xl font-display text-white"
            >
              {timeLeft === 0 ? "GO!" : timeLeft}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Lobby;