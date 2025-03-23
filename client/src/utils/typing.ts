

/**
 * Calculate Words Per Minute (WPM)
 * 
 * @param charactersTyped Number of characters typed
 * @param minutes Time elapsed in minutes
 * @returns WPM rate
 */
export const calculateWPM = (charactersTyped: number, minutes: number): number => {
    const wordsTyped = charactersTyped / 5;
    
    if (minutes <= 0) return 0;
    
    const wpm = wordsTyped / minutes;
    
    return Math.min(Math.max(0, wpm), 300);
  };
  
  /**
   * Calculate typing accuracy
   * 
   * @param typedText What the user typed
   * @param correctText What should have been typed
   * @param errorCount Number of errors (optional alternative to string comparison)
   * @returns Accuracy percentage (0-100)
   */
  export const calculateAccuracy = (
    typedText: string, 
    correctText: string,
    errorCount?: number
  ): number => {
    if (typedText.length === 0) return 100;
    
    let errors = errorCount;
    
    if (errors === undefined) {
      errors = 0;
      const minLength = Math.min(typedText.length, correctText.length);
      
      for (let i = 0; i < minLength; i++) {
        if (typedText[i] !== correctText[i]) {
          errors++;
        }
      }
      
      errors += Math.abs(typedText.length - correctText.length);
    }
    
    const accuracy = 100 - (errors / typedText.length) * 100;
    
    return Math.min(Math.max(0, accuracy), 100);
  };
  
  /**
   * Format a number as a time string (MM:SS.ms)
   * 
   * @param milliseconds Time in milliseconds
   * @returns Formatted time string
   */
  export const formatRaceTime = (milliseconds: number): string => {
    if (milliseconds <= 0) return '00:00.00';
    
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((milliseconds % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  /**
   * Format WPM with appropriate rounding
   * 
   * @param wpm Words per minute
   * @returns Formatted WPM string
   */
  export const formatWPM = (wpm: number): string => {
    return Math.round(wpm).toString();
  };
  
  /**
   * Format accuracy as a percentage
   * 
   * @param accuracy Accuracy percentage
   * @returns Formatted accuracy string
   */
  export const formatAccuracy = (accuracy: number): string => {
    return `${Math.round(accuracy)}%`;
  };