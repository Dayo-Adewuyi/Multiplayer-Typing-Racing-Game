import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  percentage: number;
  text?: string;
  color?: string;
  showPercentage?: boolean;
  height?: number;
  animate?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  text,
  color = 'bg-primary-500',
  showPercentage = false,
  height = 8,
  animate = true
}) => {
  const validPercentage = Math.min(Math.max(0, percentage), 100);
  
  return (
    <div className="w-full">
      {text && (
        <div className="flex justify-between text-sm mb-1 px-1">
          <span className="text-gray-300">{text}</span>
          {showPercentage && (
            <span className="text-primary-300">{Math.round(validPercentage)}%</span>
          )}
        </div>
      )}
      
      <div 
        className="w-full bg-gray-700 rounded-full overflow-hidden relative"
        style={{ height: `${height}px` }}
      >
      
        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
   
        <motion.div 
          className={`h-full ${color} relative`}
          style={{ width: `${validPercentage}%` }}
          initial={animate ? { width: '0%' } : false}
          animate={{ width: `${validPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
     
          <motion.div 
            className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white opacity-30"
            animate={animate ? { 
              x: [0, 100, 0],
              opacity: [0, 0.3, 0] 
            } : {}}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
              ease: 'easeInOut',
              times: [0, 0.5, 1]
            }}
          />
          
          {validPercentage > 0 && validPercentage < 100 && (
            <motion.div 
              className="absolute top-1/2 -right-1 transform -translate-y-1/2 w-2 h-4 bg-white rounded-full"
              animate={animate ? { opacity: [1, 0.5, 1] } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
            />
          )}
          
          {validPercentage >= 100 && (
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-green-500 to-blue-500 opacity-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{
                duration: 1.5,
                repeat: 2,
                repeatType: 'reverse',
                ease: 'easeInOut'
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProgressBar;