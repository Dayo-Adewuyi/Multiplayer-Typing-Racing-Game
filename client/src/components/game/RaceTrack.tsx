import React, { useEffect, useState, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Player } from '../../context/SocketContext';
import { FlagIcon } from '@heroicons/react/24/outline';

interface RaceTrackProps {
  players: Player[];
  currentPlayerId: string | null;
  finished: boolean;
}

const RaceTrack: React.FC<RaceTrackProps> = ({ 
  players, 
  currentPlayerId, 
  finished 
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const controls = useAnimation();

  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === currentPlayerId) return -1;
    if (b.id === currentPlayerId) return 1;
    
    return b.position - a.position;
  });

  useEffect(() => {
    const updateTrackWidth = () => {
      if (trackRef.current) {
        setTrackWidth(trackRef.current.clientWidth);
      }
    };
    
    updateTrackWidth();
    
    window.addEventListener('resize', updateTrackWidth);
    
    return () => {
      window.removeEventListener('resize', updateTrackWidth);
    };
  }, []);

  useEffect(() => {
    if (finished) {
      controls.start({
        opacity: [0, 1, 1, 0],
        scale: [0.8, 1, 1, 0.8],
        transition: { duration: 2, times: [0, 0.2, 0.8, 1] }
      });
    }
  }, [finished, controls]);

  return (
    <div className="w-full bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 p-4 shadow-lg mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Race Track</h2>
        <div className="text-sm text-gray-400">
          {finished ? 'Race Complete' : 'Race in Progress'}
        </div>
      </div>
      
      <div 
        ref={trackRef} 
        className="relative w-full bg-racing-asphalt rounded-lg overflow-hidden"
      >
        {sortedPlayers.map((player, index) => (
          <div 
            key={player.id} 
            className="track-lane relative"
          >
            <div className="lane-divider"></div>
            
            <motion.div 
              className="absolute top-1/2 transform -translate-y-1/2 z-20"
              initial={{ x: 0 }}
              animate={{ x: (player.position / 100) * (trackWidth - 48) }}
              transition={{ 
                type: 'spring', 
                damping: 20,
                stiffness: 100
              }}
            >
              <CarIcon 
                color={player.color} 
                isCurrentPlayer={player.id === currentPlayerId}
                position={player.position}
                wpm={player.wpm}
              />
            </motion.div>
            
            <div className={`
              player-tag
              ${player.id === currentPlayerId ? 'bg-primary-900/80 border-primary-500' : 'bg-gray-800/80 border-gray-600'}
            `}>
              <div className="text-sm font-medium">{player.name}</div>
              <div className="text-xs opacity-80">{Math.round(player.wpm)} WPM</div>
            </div>
          </div>
        ))}
        
        <div className="absolute inset-0 pointer-events-none">
          {[25, 50, 75].map(mark => (
            <div 
              key={mark} 
              className="track-mark"
              style={{ left: `${mark}%` }}
            >
              <div className="h-full w-0.5 bg-white/20"></div>
              <div className="absolute bottom-1 left-0 transform -translate-x-1/2 text-xs text-white/60">
                {mark}%
              </div>
            </div>
          ))}
        </div>
        
        <div className="absolute top-0 right-0 h-full w-8 flex items-center justify-center">
          <div className="h-full w-full bg-[length:8px_8px] bg-[repeating-linear-gradient(45deg,#000,#000_4px,#fff_4px,#fff_8px)]"></div>
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-90 text-xs font-bold text-white">
            <FlagIcon className="h-6 w-6 text-white"/>
          </div>
        </div>
        
        {finished && (
          <motion.div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-white bg-green-500/20 p-3 rounded-lg"
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={controls}
          >
            Race Complete!
          </motion.div>
        )}
      </div>
    </div>
  );
};

interface CarIconProps {
  color: string;
  isCurrentPlayer: boolean;
  position: number;
  wpm: number;
}

const CarIcon: React.FC<CarIconProps> = ({ color, isCurrentPlayer, position, wpm }) => {
  const intensity = Math.min(1, wpm / 150); 
  
  return (
    <motion.div
      className={`relative ${isCurrentPlayer ? 'z-20' : 'z-10'}`}
      animate={{ 
        y: [0, -1, 0, 1, 0],
      }}
      transition={{ 
        duration: 0.5, 
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut' 
      }}
    >
      {wpm > 30 && position < 100 && (
        <motion.div 
          className="absolute top-1/2 right-full transform -translate-y-1/2 origin-right"
          style={{ opacity: intensity * 0.8 }}
          animate={{
            scaleX: [1, 1.5, 1],
            opacity: [0.4 * intensity, 0.7 * intensity, 0.4 * intensity]
          }}
          transition={{ 
            duration: 0.3, 
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeOut' 
          }}
        >
          <div className="w-16 h-0.5 rounded-full bg-gradient-to-r from-transparent to-white"></div>
        </motion.div>
      )}
      
      <svg 
        width="40" 
        height="16" 
        viewBox="0 0 40 16" 
        className={`drop-shadow-md ${isCurrentPlayer ? 'filter drop-shadow-lg' : ''}`}
      >
        <g>
          <path 
            d="M5,11 L10,3 L30,3 L35,11 L5,11 Z" 
            fill={color} 
            stroke="#000" 
            strokeWidth="1" 
          />
          
          <path 
            d="M12,3 L15,7 L25,7 L28,3" 
            fill="#111" 
            stroke="#222" 
            strokeWidth="0.5" 
          />
          
          <circle cx="10" cy="12" r="3" fill="#333" stroke="#000" strokeWidth="0.5" />
          <circle cx="30" cy="12" r="3" fill="#333" stroke="#000" strokeWidth="0.5" />
          <circle cx="10" cy="12" r="1" fill="#666" />
          <circle cx="30" cy="12" r="1" fill="#666" />
          
          <circle cx="5" cy="7" r="1" fill="yellow" />
          <circle cx="35" cy="7" r="1" fill="red" />
        </g>
      </svg>
      
      {isCurrentPlayer && (
        <motion.div 
          className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full"
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut' 
          }}
        />
      )}
    </motion.div>
  );
};

export default RaceTrack;