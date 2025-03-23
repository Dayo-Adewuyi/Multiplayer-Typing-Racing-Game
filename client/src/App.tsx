import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './context/SocketContext';
import { GameProvider } from './context/GameContext';
import Home from './components/screens/Home';
import Lobby from './components/screens/Lobby';
import Race from './components/screens/Race';
import Results from './components/screens/Results';
import Replay from './components/screens/Replay';

const App: React.FC = () => {

  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

  return (
    <BrowserRouter>
      <SocketProvider socketUrl={SOCKET_URL} autoConnect={true}>
        <GameProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby/:gameId" element={<Lobby />} />
            <Route path="/race/:gameId" element={<Race />} />
            <Route path="/results/:gameId" element={<Results />} />
            <Route path="/replay/:gameId" element={<Replay />} />
          </Routes>
          <Toaster position="top-right" />
        </GameProvider>
      </SocketProvider>
    </BrowserRouter>
  );
};

export default App;