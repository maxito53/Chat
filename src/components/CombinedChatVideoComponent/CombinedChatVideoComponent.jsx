import React, { useState } from 'react';
import ChatComponent from '../ChatComponent/ChatComponent';
import VideoComponent from '../VideoComponent/VideoComponent';
import styles from './combinedChatVideoComponent.module.scss';

const CombinedChatVideoComponent = () => {
  // estados para controlar la visualización
  const [activeView, setActiveView] = useState('split'); // las opciones són split, video o chat

  // función para cambiar la vista activa
  const switchView = (view) => {
    setActiveView(view);
  };

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <button 
          className={`${styles.viewButton} ${activeView === 'split' ? styles.active : ''}`}
          onClick={() => switchView('split')}
        >
          Vista Dividida
        </button>
        <button 
          className={`${styles.viewButton} ${activeView === 'video' ? styles.active : ''}`}
          onClick={() => switchView('video')}
        >
          Solo Video
        </button>
        <button 
          className={`${styles.viewButton} ${activeView === 'chat' ? styles.active : ''}`}
          onClick={() => switchView('chat')}
        >
          Solo Chat
        </button>
      </div>

      <div 
        className={`
          ${styles.splitLayout} 
          ${activeView === 'video' ? styles.videoOnly : ''} 
          ${activeView === 'chat' ? styles.chatOnly : ''}
        `}
      >
        <div className={`${styles.videoSection} ${activeView === 'chat' ? styles.hidden : ''}`}>
          <VideoComponent />
        </div>
        <div className={`${styles.chatSection} ${activeView === 'video' ? styles.hidden : ''}`}>
          <ChatComponent />
        </div>
      </div>
    </div>
  );
};

export default CombinedChatVideoComponent;