// Gestion des utilisateurs connectés par canal
const users = {
  'canal-general': new Map(),
  'canal-prive': new Map(), 
  'canal-conference': new Map()
};

const CHANNELS = ['canal-general', 'canal-prive', 'canal-conference'];

function handleSocketConnection(socket, io) {
  let currentUser = null;
  let currentChannel = null;

  // Connexion d'un utilisateur à un canal
  socket.on('join-channel', (data) => {
    const { username, channel } = data;
    
    // Validation des données
    if (!username || !channel || !CHANNELS.includes(channel)) {
      socket.emit('error', { message: 'Données invalides' });
      return;
    }

    // Si l'utilisateur était déjà dans un canal, le retirer
    if (currentChannel && currentUser) {
      leaveChannel(socket, currentUser, currentChannel, io);
    }

    // Ajouter l'utilisateur au nouveau canal
    currentUser = { id: socket.id, username, joinedAt: new Date() };
    currentChannel = channel;
    
    socket.join(channel);
    users[channel].set(socket.id, currentUser);

    // Notifier les autres utilisateurs du canal
    socket.to(channel).emit('user-joined', {
      user: currentUser,
      channel: channel
    });

    // Envoyer la liste des utilisateurs connectés au nouveau client
    const channelUsers = Array.from(users[channel].values());
    socket.emit('channel-users', {
      channel: channel,
      users: channelUsers
    });

    // Confirmer la connexion au canal
    socket.emit('joined-channel', {
      channel: channel,
      user: currentUser,
      users: channelUsers
    });

    // Mettre à jour les compteurs pour tous
    broadcastChannelCounts(io);

    console.log(`${username} a rejoint le ${channel}`);
  });

  // Gestion des signaux WebRTC pour l'audio
  socket.on('webrtc-offer', (data) => {
    if (!currentChannel) return;
    
    socket.to(data.target).emit('webrtc-offer', {
      offer: data.offer,
      sender: socket.id,
      senderName: currentUser?.username
    });
  });

  socket.on('webrtc-answer', (data) => {
    if (!currentChannel) return;
    
    socket.to(data.target).emit('webrtc-answer', {
      answer: data.answer,
      sender: socket.id,
      senderName: currentUser?.username
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    if (!currentChannel) return;
    
    socket.to(data.target).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      sender: socket.id,
      senderName: currentUser?.username
    });
  });

  // Gestion des messages de statut audio
  socket.on('audio-status', (data) => {
    if (!currentChannel) return;
    
    socket.to(currentChannel).emit('user-audio-status', {
      userId: socket.id,
      username: currentUser?.username,
      isMuted: data.isMuted,
      isSpeaking: data.isSpeaking
    });
  });

  // Requête pour la liste des canaux
  socket.on('get-channels', () => {
    const channelsInfo = CHANNELS.map(channel => ({
      name: channel,
      userCount: users[channel].size,
      users: Array.from(users[channel].values()).map(user => ({
        id: user.id,
        username: user.username
      }))
    }));
    
    socket.emit('channels-list', channelsInfo);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`Déconnexion: ${socket.id}`);
    
    if (currentChannel && currentUser) {
      leaveChannel(socket, currentUser, currentChannel, io);
    }
  });

  // Quitter un canal
  socket.on('leave-channel', () => {
    if (currentChannel && currentUser) {
      leaveChannel(socket, currentUser, currentChannel, io);
      currentChannel = null;
      currentUser = null;
    }
  });
}

function leaveChannel(socket, user, channel, io) {
  // Retirer l'utilisateur du canal
  users[channel].delete(socket.id);
  socket.leave(channel);
  
  // Notifier les autres utilisateurs
  socket.to(channel).emit('user-left', {
    user: user,
    channel: channel
  });
  
  // Mettre à jour les compteurs pour tous
  broadcastChannelCounts(io);
  
  console.log(`${user.username} a quitté le ${channel}`);
}

function broadcastChannelCounts(io) {
  const channelsInfo = CHANNELS.map(channel => ({
    name: channel,
    userCount: users[channel].size
  }));
  
  io.emit('channels-counts', channelsInfo);
}

module.exports = { handleSocketConnection };