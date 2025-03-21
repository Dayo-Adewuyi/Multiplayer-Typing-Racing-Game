export interface TextData {
  texts: string[];
  longTexts: string[];
}
export interface RaceReplay {
    gameId: string;
    text: string;
    startTime: number;
    endTime: number | null;
    players: PlayerReplay[];
  }
  
  
  export interface PlayerReplay {
    id: string;
    name: string;
    color: string;
    progressSnapshots: ProgressSnapshot[];
    finalStats: {
      wpm: number;
      accuracy: number;
      finishTime: number | null;
      rank: number | null;
    }
  }

   export interface ProgressSnapshot {
    timestamp: number;
    position: number;
    currentIndex: number;
    wpm: number;
    accuracy: number;
  }
  

  export interface Player {
    id: string;
    name: string;
    color: string;
    position: number; 
    wpm: number; 
    accuracy: number; 
    currentIndex: number; 
    isReady: boolean;
    finishTime: number | null;
    isConnected: boolean;
    isSpectator: boolean; 
    lastUpdate?: number;
  }