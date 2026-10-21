import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ChatComponent from './components/ChatComponent/ChatComponent';
import VideoComponent from './components/VideoComponent/VideoComponent';
import CombinedChatVideoComponent from './components/CombinedChatVideoComponent/CombinedChatVideoComponent';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="app-container">
        <BrowserRouter>
          <Routes>
            <Route 
              path="/" 
              element={
                <CombinedChatVideoComponent />
              } 
            />
            <Route 
              path="/video"
              element={
                <VideoComponent />
              }
            />
            <Route 
              path="/chat"
              element={
                <ChatComponent />
              }
            />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;