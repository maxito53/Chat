import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import styles from './chatComponent.module.scss';

const ChatComponent = () => {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [connectionError, setConnectionError] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // detectar automáticamente la URL del servidor (esto por pruebas que hice con el server.js)
  useEffect(() => {
    const hostname = window.location.hostname;
    const detectedServerUrl = `http://${hostname}:5000`;
    console.log(`URL del servidor detectada: ${detectedServerUrl}`);
    setServerUrl(detectedServerUrl);
  }, []);

  // iniciar conexión de socket
  useEffect(() => {
    // solo conectar si tenemos username, la URL del serevr y no se esta mostrando el prompt
    if (username && !showUsernamePrompt && serverUrl && !socket) {
      console.log(`Intentando conectar a: ${serverUrl}`);
      
      const newSocket = io(serverUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['websocket', 'polling'],
      });
      
      newSocket.on('connect', () => {
        console.log('Conectado al servidor');
        setIsConnected(true);
        setConnectionError(null);
        
        // enviar nombre de usuario al conectar
        newSocket.emit('user_connected', { username });
      });

      newSocket.on('connect_error', (error) => {
        console.error('Error de conexión:', error);
        setConnectionError(`Error de conexión: No se pudo conectar a ${serverUrl}. Asegúrate de que el servidor está ejecutándose.`);
        setIsConnected(false);
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log(`Desconectado: ${reason}`);
        setIsConnected(false);
        if (reason === 'io server disconnect') {
          setConnectionError('El servidor cerró la conexión.');
        } else {
          setConnectionError('Conexión perdida. Intentando reconectar...');
        }
      });
      
      newSocket.on('receive_message', (data) => {
        setMessages(prevMessages => [...prevMessages, data]);
      });
      
      newSocket.on('message_history', (history) => {
        setMessages(history);
      });
      
      newSocket.on('user_typing', ({ user, isTyping: typing }) => {
        if (user !== username) {
          setTypingUsers(prev => {
            if (typing && !prev.includes(user)) {
              return [...prev, user];
            } else if (!typing && prev.includes(user)) {
              return prev.filter(u => u !== user);
            }
            return prev;
          });
        }
      });
      
      newSocket.on('online_users', ({ count }) => {
        setOnlineUsers(count);
      });
      
      // establecer el socket solo una vez
      setSocket(newSocket);
      
      // limpiar al desmontar
      return () => {
        console.log('Desconectando socket...');
        newSocket.disconnect();
        setSocket(null);
      };
    }
  }, [username, showUsernamePrompt, serverUrl]); // ! pide poner socket pero si lo pongo se hace un bucle que peta todo

  // auto-scroll al recibir nuevos mensajes (esto da problemas en la union de los 2 componentes)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback((e) => {
    e.preventDefault();
    
    if (message.trim() && socket && isConnected) {
      socket.emit('send_message', {
        username: username,
        message: message,
      });
      
      socket.emit('typing', { username, isTyping: false });
      setIsTyping(false);
      
      setMessage('');
    } else if (!isConnected) {
      alert('No estás conectado al servidor. No se puede enviar el mensaje.');
    }
  }, [message, socket, username, isConnected]);

  // manejar entrada de nombre de usuario
  const handleUsernameSubmit = useCallback((e) => {
    e.preventDefault();
    if (username.trim()) {
      setShowUsernamePrompt(false);
    }
  }, [username]);

  // manejar indicador de escritura
  const handleTyping = useCallback((e) => {
    setMessage(e.target.value);
    
    if (socket && isConnected) {
      if (!isTyping) {
        setIsTyping(true);
        socket.emit('typing', { username, isTyping: true });
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        if (socket.connected) {
          socket.emit('typing', { username, isTyping: false });
        }
      }, 2000);
    }
  }, [socket, username, isTyping, isConnected]);

  // función  la hora
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // reintentar conexión manualmente
  const handleRetryConnection = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setConnectionError(null);
  };

  return (
    <div className={styles['chat-container']}>
      {showUsernamePrompt ? (
        <div className={styles['username-prompt']}>
          <form onSubmit={handleUsernameSubmit}>
            <h2>Bienvenido al Chat</h2>
            <p>Introduce tu nombre para comenzar</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre"
              required
              autoFocus
            />
            <button type="submit">Entrar al Chat</button>
          </form>
        </div>
      ) : (
        <div className={styles['chat-box']}>
          <div className={styles['chat-header']}>
            <h2>Chat</h2>
            <div className={styles['header-info']}>
              <span className={styles['connection-status']}>
                {isConnected ? 
                  <span className={styles['status-connected']}>Conectado</span> : 
                  <span className={styles['status-disconnected']}>Desconectado</span>
                }
              </span>
              <span className={styles['online-users']}>En línea: {onlineUsers}</span>
              <span className={styles['username-display']}>Conectado como: {username}</span>
            </div>
          </div>
          
          {connectionError && (
            <div className={styles['connection-error']}>
              <p>{connectionError}</p>
              <p>Servidor actual: {serverUrl}</p>
              <button onClick={handleRetryConnection}>Reintentar conexión</button>
            </div>
          )}
          
          <div className={styles['messages-container']}>
            {messages.length === 0 ? (
              <div className={styles['no-messages']}>
                <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles['message']} ${
                    msg.sender === username ? styles['own-message'] : styles['other-message']
                  } ${msg.type === 'system' ? styles['system-message'] : ''}`}
                >
                  <div className={styles['message-header']}>
                    <span className={styles['sender']}>{msg.sender}</span>
                    <span className={styles['timestamp']}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className={styles['message-content']}>{msg.message}</p>
                </div>
              ))
            )}
            
            {typingUsers.length > 0 && (
              <div className={styles['typing-indicator']}>
                <p>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} está escribiendo...`
                    : `${typingUsers.length} personas están escribiendo...`}
                </p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form className={styles['message-form']} onSubmit={handleSendMessage}>
            <input
              type="text"
              value={message}
              onChange={handleTyping}
              placeholder="Escribe un mensaje..."
              required
              autoFocus
              disabled={!isConnected}
            />
            <button type="submit" disabled={!isConnected}>Enviar</button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatComponent;