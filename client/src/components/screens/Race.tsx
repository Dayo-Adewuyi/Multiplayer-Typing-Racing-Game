import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';

import RaceTrack from '../game/RaceTrack';
import TypingArea from '../game/TypingArea';
import Leaderboard from '../game/LeaderBoard';
import RaceTimer from '../game/RaceTimer';
import ProgressBar from '../game/ProgressBar';

import { XMarkIcon, PauseIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const Race: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { 
    currentGame, 
    player, 
    isSpectator,
    raceText,
    isRacing,
    isFinished,
    raceStartTime,
    raceEndTime,
    updateProgress,
    finishRace,
    leaveGame
  } = useGame();
  const { isConnected } = useSocket();

  const [typedText, setTypedText] = useState('');
  const [errors, setErrors] = useState(0);
  const [errorPositions, setErrorPositions] = useState<number[]>([]);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [completed, setCompleted] = useState(false);
  
  const raceTimerRef = useRef(0);
  const [displayRaceTimer, setDisplayRaceTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isConnected && !currentGame && !player) {
      navigate('/');
    }
  }, [isConnected, currentGame, player, navigate]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isRacing && raceStartTime && !isFinished) {
      timerRef.current = setInterval(() => {
        const newTime = Date.now() - raceStartTime;
        raceTimerRef.current = newTime; 
        setDisplayRaceTimer(newTime); 
      }, 100);
    } else if (isFinished && raceEndTime && raceStartTime) {
      const finalTime = raceEndTime - raceStartTime;
      raceTimerRef.current = finalTime;
      setDisplayRaceTimer(finalTime);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRacing, isFinished, raceStartTime, raceEndTime]);

  useEffect(() => {
    if (isRacing && !isSpectator && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isRacing, isSpectator]);

  
  const calculateWPM = useCallback((typed: string, timeMs: number) => {
    if (timeMs <= 0) return 0;
    
    const words = typed.length / 5;
    const minutes = timeMs / 60000; 
    
    return Math.round(words / minutes);
  }, []);

  const calculateAccuracy = useCallback((errorCount: number, total: number) => {
    if (total <= 0) return 100;
    
    const correct = total - errorCount;
    return Math.round((correct / total) * 100);
  }, []);

  const handleTyping = useCallback((input: string) => {
    if (!isRacing || isFinished || !raceText || isSpectator || completed) return;
    
    setTypedText(input);
    
    let localErrors = 0;
    const newErrorPositions: number[] = [];
    
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== raceText[i]) {
        localErrors++;
        newErrorPositions.push(i);
      }
    }
    
    setErrors(localErrors);
    setErrorPositions(newErrorPositions);
    setCurrentPosition(input.length);
    
    const elapsedTime = Date.now() - (raceStartTime || Date.now());
    const currentWPM = calculateWPM(input, elapsedTime);
    const currentAccuracy = calculateAccuracy(localErrors, input.length);
    
    setWpm(currentWPM);
    setAccuracy(currentAccuracy);
    
    updateProgress(input.length, input, localErrors);
    
    if (input.length === raceText.length) {
      setCompleted(true);
      finishRace(currentWPM, currentAccuracy);
    }
  }, [isRacing, isFinished, raceText, isSpectator, completed, raceStartTime, calculateWPM, calculateAccuracy, updateProgress, finishRace]);

  const formatRaceText = useCallback(() => {
    if (!raceText) return null;
    
    const before = raceText.substring(0, currentPosition);
    const current = raceText.charAt(currentPosition);
    const after = raceText.substring(currentPosition + 1);
    
    return (
      <div className="font-mono text-lg leading-relaxed">
        <span className="typing-correct">{before}</span>
        <span className="typing-current">{current}</span>
        <span className="typing-upcoming">{after}</span>
        
        {errorPositions.length > 0 && (
          <div className="relative">
            <div className="absolute top-0 left-0 right-0">
              {errorPositions.map((pos, index) => (
                <span 
                  key={index}
                  className="typing-error absolute"
                  style={{ left: `${pos * 0.6}em` }}
                >
                  {typedText.charAt(pos)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [raceText, currentPosition, errorPositions, typedText]);

  const handleEscapeKey = useCallback(() => {
    if (window.confirm('Are you sure you want to leave the race?')) {
      leaveGame();
    }
  }, [leaveGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleEscapeKey();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEscapeKey]);

  if (!currentGame || !gameId || !raceText) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary-500 rounded-full border-t-transparent mx-auto mb-4"></div>
          <p>Loading race...</p>
        </div>
      </div>
    );
  }

  const racers = currentGame.players.filter(p => !p.isSpectator);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary-600 opacity-5 blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-32 w-80 h-80 rounded-full bg-secondary-600 opacity-5 blur-3xl"></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-6 flex flex-col min-h-screen z-10">
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => handleEscapeKey()}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 mr-4"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold">Race #{gameId.substring(0, 8)}</h1>
          </div>
          
          <RaceTimer 
            time={displayRaceTimer} 
            isFinished={completed || isFinished} 
          />
        </div>
        
        <div className="mb-6">
          <RaceTrack 
            players={racers}
            currentPlayerId={player?.id || null}
            finished={isFinished}
          />
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col">
            <div className="bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 overflow-hidden flex-1 flex flex-col">
              <div className="p-6 bg-gray-800/70 flex-1 overflow-y-auto custom-scrollbar">
                {formatRaceText()}
              </div>
              
              <div className="p-6 bg-gray-900/50">
                <TypingArea
                  ref={textInputRef}
                  value={typedText}
                  onChange={handleTyping}
                  disabled={!isRacing  || completed || isFinished || isSpectator }
                  placeholder={
                    isSpectator 
                      ? "You are in spectator mode" 
                      : isFinished || completed
                        ? "Race completed!"
                        : "Type here when the race starts..."
                  }
                />
                
                <div className="mt-4">
                  <ProgressBar 
                    percentage={player?.position || 0}
                    text={`${Math.round(player?.position || 0)}% - ${wpm} WPM - ${accuracy}% Accuracy`}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <Leaderboard
              players={racers}
              currentPlayerId={player?.id || null}
            />
            
            <div className="mt-4 bg-gray-800/70 backdrop-blur-xl rounded-xl border border-gray-700 p-4 text-center">
              {isSpectator ? (
                <div className="text-yellow-400 flex items-center justify-center">
                  <PauseIcon className="h-5 w-5 mr-2" />
                  You are in spectator mode
                </div>
              ) : isFinished ? (
                <div className="text-green-400 flex items-center justify-center">
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Race completed!
                </div>
              ) : (
                <div className="text-primary-400">
                  Type the text above as fast and accurately as you can!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {(completed || isFinished) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => navigate(`/results/${gameId}`)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-gray-800 rounded-xl border border-gray-700 p-8 max-w-md w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-3xl font-display text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-500 mb-4">
                Race Complete!
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Your Speed</div>
                  <div className="text-3xl font-bold text-primary-400">{wpm}</div>
                  <div className="text-xs text-gray-500">WPM</div>
                </div>
                
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Accuracy</div>
                  <div className="text-3xl font-bold text-green-400">{accuracy}%</div>
                  <div className="text-xs text-gray-500">{errors} errors</div>
                </div>
              </div>
              
              <p className="text-gray-300 mb-6">
                Wait for others to finish to see the final results.
              </p>
              
              <button
              onClick={(e) => {
                e.stopPropagation(); 
                navigate(`/results/${gameId}`); 
              }}
              >
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Race;