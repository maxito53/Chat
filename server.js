import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import process from 'process';
import { networkInterfaces } from 'os';

const app = express();
app.use(cors({
  origin: '*', // Permitir cualquier origen en desarrollo
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir cualquier origen en desarrollo
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, // Aumentar el tiempo de espera para detectar desconexiones
});

// Lista para almacenar los mensajes recientes
const recentMessages = [];
const MAX_MESSAGES = 50;

// Lista para almacenar usuarios conectados
const connectedUsers = new Map();

// Función para obtener la IP local
const getLocalIp = () => {
  const nets = networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Saltar interfaces no IPv4 y no internas
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }
  
  return results;
};

// Gestión de conexiones de socket
io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);
  
  // Actualizar contador de usuarios
  const updateOnlineUsers = () => {
    io.emit('online_users', { count: connectedUsers.size });
  };
  
  // Enviar historial de mensajes recientes al nuevo usuario
  if (recentMessages.length > 0) {
    socket.emit('message_history', recentMessages);
  }
  
  // Recibir información de usuario conectado
  socket.on('user_connected', ({ username }) => {
    console.log(`Usuario ${username} identificado`);
    connectedUsers.set(socket.id, { username });
    updateOnlineUsers();
    
    // Notificar a todos que un nuevo usuario se ha conectado
    const systemMessage = {
      id: Date.now(),
      senderId: 'system',
      sender: 'Sistema',
      message: `${username} se ha unido al chat`,
      timestamp: new Date().toISOString(),
      type: 'system'
    };
    
    recentMessages.push(systemMessage);
    if (recentMessages.length > MAX_MESSAGES) {
      recentMessages.shift();
    }
    
    io.emit('receive_message', systemMessage);
  });
  
  // Recibir mensaje del cliente
  socket.on('send_message', (data) => {
    console.log(`Mensaje recibido de ${data.username}: ${data.message}`);
    
    const messageData = {
      id: Date.now(),
      senderId: socket.id,
      sender: data.username,
      message: data.message,
      timestamp: new Date().toISOString()
    };
    
    // Guardar mensaje en historial
    recentMessages.push(messageData);
    if (recentMessages.length > MAX_MESSAGES) {
      recentMessages.shift(); // Eliminar mensaje más antiguo si excede el límite
    }
    
    // Emitir mensaje a todos los clientes
    io.emit('receive_message', messageData);
  });
  
  // Gestionar eventos de "está escribiendo"
  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', {
      user: data.username,
      isTyping: data.isTyping
    });
  });
  
  // Gestionar desconexión
  socket.on('disconnect', () => {
    // Comprobar si el usuario estaba identificado
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      console.log(`Usuario desconectado: ${userData.username}`);
      
      // Notificar a todos que el usuario se ha desconectado
      const systemMessage = {
        id: Date.now(),
        senderId: 'system',
        sender: 'Sistema',
        message: `${userData.username} ha salido del chat`,
        timestamp: new Date().toISOString(),
        type: 'system'
      };
      
      recentMessages.push(systemMessage);
      if (recentMessages.length > MAX_MESSAGES) {
        recentMessages.shift();
      }
      
      io.emit('receive_message', systemMessage);
      
      // Eliminar usuario de la lista de conectados
      connectedUsers.delete(socket.id);
      updateOnlineUsers();
    } else {
      console.log(`Conexión sin identificar desconectada: ${socket.id}`);
    }
  });
});

// Ruta básica para probar el servidor
app.get('/', (req, res) => {
  res.send('Servidor de chat funcionando correctamente');
});

// Ruta para verificar estado del servidor
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    connections: connectedUsers.size,
    messages: recentMessages.length
  });
});

const PORT = process.env.PORT || 5000;

// Escuchar en todas las interfaces de red (0.0.0.0)
// puertos abiertos: sudo ufw allow 5173/tcp , sudo ufw allow 5000/tcp
server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Dirección local: http://localhost:${PORT}`);
  console.log('Direcciones IP disponibles para conexiones externas:');
  console.log(localIp);
});