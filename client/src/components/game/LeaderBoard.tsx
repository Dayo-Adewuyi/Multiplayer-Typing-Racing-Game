import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '../../context/SocketContext';

import { 
  TrophyIcon, 
  UserCircleIcon, 
  ChartBarIcon 
} from '@heroicons/react/24/outline';

interface LeaderboardProps {
  players: Player[];
  currentPlayerId: string | null;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, currentPlayerId }) => {
  const sortedPlayers = useMemo(() => {
    return [...players]
      .filter(player => player.isConnected)
      .sort((a, b) => {
        if (a.position === 100 && b.position !== 100) return -1;
        if (a.position !== 100 && b.position === 100) return 1;
        
        if (a.position !== b.position) return b.position - a.position;
        
        return b.wpm - a.wpm;
      });
  }, [players]);

  const playerRanks = useMemo(() => {
    const ranks: Record<string, number> = {};
    
    sortedPlayers.forEach((player, index) => {
      ranks[player.id] = index + 1;
    });
    
    return ranks;
  }, [sortedPlayers]);

  return (
    <div className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden h-full flex flex-col">
      <div className="p-4 bg-gray-900/50 flex items-center">
        <TrophyIcon className="h-5 w-5 text-yellow-400 mr-2" />
        <h2 className="text-lg font-semibold">Leaderboard</h2>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <AnimatePresence>
          {sortedPlayers.map((player) => {
            const rank = playerRanks[player.id];
            const isCurrentPlayer = player.id === currentPlayerId;
            
            let rankBadge = null;
            if (rank === 1) {
              rankBadge = <span className="text-yellow-400 font-bold">1st</span>;
            } else if (rank === 2) {
              rankBadge = <span className="text-gray-300 font-bold">2nd</span>;
            } else if (rank === 3) {
              rankBadge = <span className="text-amber-600 font-bold">3rd</span>;
            } else {
              rankBadge = <span className="text-gray-500 font-bold">{rank}th</span>;
            }
            
            return (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className={`mb-3 p-3 rounded-lg border ${
                  isCurrentPlayer
                    ? 'bg-primary-900/40 border-primary-700/50'
                    : player.position === 100
                      ? 'bg-gray-700/40 border-gray-600/50'
                      : 'bg-gray-800/40 border-gray-700/30'
                }`}
              >
                <div className="flex items-center">
                 
                  <div className="flex-shrink-0 w-10 text-center">
                    {rankBadge}
                  </div>
                  
         
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: player.color }}
                      ></div>
                      <span className="font-medium">
                        {player.name}
                        {isCurrentPlayer && " (You)"}
                      </span>
                    </div>
                    
                    <div className="mt-2">
                      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                        <div 
                          className="h-1.5 rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${player.position}%`,
                            backgroundColor: player.color 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">{Math.round(player.position)}%</span>
                        <span className="text-gray-400">{player.wpm} WPM</span>
                      </div>
                    </div>
                  </div>
     
                  {player.position === 100 && (
                    <div className="ml-2 bg-green-500/20 p-1 rounded-full">
                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {sortedPlayers.length === 0 && (
          <div className="text-center text-gray-400 py-6">
            <UserCircleIcon className="h-8 w-8 mx-auto mb-2 text-gray-500" />
            <p>No players in the race</p>
          </div>
        )}
      </div>
      
      <div className="p-3 bg-gray-900/50 flex justify-between items-center text-xs text-gray-400">
        <div className="flex items-center">
          <ChartBarIcon className="h-4 w-4 mr-1" />
          <span>Avg: {calculateAverageWPM(players)} WPM</span>
        </div>
        
        <div>
          {calculateFinishedCount(players)}/{players.length} Finished
        </div>
      </div>
    </div>
  );
};

const calculateAverageWPM = (players: Player[]): number => {
  const activePlayers = players.filter(p => p.isConnected && p.wpm > 0);
  if (activePlayers.length === 0) return 0;
  
  const totalWPM = activePlayers.reduce((sum, player) => sum + player.wpm, 0);
  return Math.round(totalWPM / activePlayers.length);
};

const calculateFinishedCount = (players: Player[]): number => {
  return players.filter(p => p.isConnected && p.position === 100).length;
};

export default Leaderboard;