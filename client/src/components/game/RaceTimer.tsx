import React, { useEffect, useState } from 'react';

interface RaceTimerProps {
  time: number;
  isFinished?: boolean;
  small?: boolean;
  showLabel?: boolean;
}

const RaceTimer: React.FC<RaceTimerProps> = ({
  time,
  isFinished = false,
  small = false,
  showLabel = true
}) => {
  const [displayTime, setDisplayTime] = useState('00:00.000');
  const [isHighlighted, setIsHighlighted] = useState(false);
  useEffect(() => {
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const milliseconds = Math.floor((time % 1000) / 10);
    
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    const formattedMilliseconds = String(milliseconds).padStart(2, '0');
    
    setDisplayTime(`${formattedMinutes}:${formattedSeconds}.${formattedMilliseconds}`);
  }, [time]);
  
  useEffect(() => {
    if (isFinished && !isHighlighted) {
      setIsHighlighted(true);
    }
  }, [isFinished, isHighlighted]);
  
  const containerClass = small
    ? 'text-sm px-2 py-1'
    : 'text-base px-3 py-2';
  
  const timerClass = small
    ? 'text-lg font-mono'
    : 'text-xl font-mono';
  
  return (
    <div className={containerClass}>
      {showLabel && (
        <div>
          {isFinished ? 'Final Time' : 'Race Time'}
        </div>
      )}
      <div className={timerClass}>
        {displayTime}
      </div>
    </div>
  );
};

export default RaceTimer;