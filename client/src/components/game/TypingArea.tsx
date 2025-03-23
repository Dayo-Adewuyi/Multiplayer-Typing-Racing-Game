import React, { forwardRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TypingAreaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const TypingArea = forwardRef<HTMLInputElement, TypingAreaProps>(
  ({ value, onChange, disabled = false, placeholder = 'Start typing...' }, ref) => {
    const [focused, setFocused] = useState(false);
    const [blinkCursor, setBlinkCursor] = useState(true);
    
    useEffect(() => {
      if (disabled) {
        setBlinkCursor(false);
        return;
      }
      
      setBlinkCursor(focused);
    }, [focused, disabled]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onChange(e.target.value);
      }
    };
    
    const handleFocus = () => {
      setFocused(true);
    };
    
    const handleBlur = () => {
      setFocused(false);
    };
    
    const handleClick = () => {
      if (ref && 'current' in ref && ref.current && !disabled) {
        ref.current.focus();
      }
    };
    
    return (
      <div className="relative rounded-lg overflow-hidden">
        <motion.div 
          className={`bg-gray-700/70 rounded-lg p-4 min-h-[60px] cursor-text border-2 transition-colors duration-300 ${
            disabled 
              ? 'border-gray-600/30 opacity-70' 
              : focused
                ? 'border-primary-500 shadow-sm shadow-primary-500/20'
                : 'border-gray-600 hover:border-gray-500'
          }`}
          animate={{ 
            boxShadow: focused && !disabled ? '0 0 0 1px rgba(59, 130, 246, 0.3), 0 0 15px 2px rgba(59, 130, 246, 0.15)' : 'none' 
          }}
          onClick={handleClick}
        >
          <input
            ref={ref}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            className="opacity-0 absolute inset-0 w-full h-full cursor-text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
         
          <div className="flex">
            <div className="text-white font-mono">
              {value || (
                <span className="text-gray-500">{placeholder}</span>
              )}
              {blinkCursor && (
                <span className="typing-cursor"></span>
              )}
            </div>
          </div>
        </motion.div>
        
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-700">
          <div className="h-full bg-[repeating-linear-gradient(45deg,#222,#222_10px,#333_10px,#333_20px)]"></div>
        </div>
      </div>
    );
  }
);

TypingArea.displayName = 'TypingArea';

export default TypingArea;