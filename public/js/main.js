// Variables globales
let socket = null;
let currentUser = null;
let currentChannel = null;
let isMuted = false;
let isSpeakerMuted = false;
let volume = 50;

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Connexion Socket.io
    socket = io();
    
    // Event listeners pour l'interface
    setupEventListeners();
    
    // Gestion des événements Socket.io
    setupSocketEvents();
    
    console.log('Application initialisée');
}

function setupEventListeners() {
    // Formulaire de connexion
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Bouton de déconnexion
    document.getElementById('disconnect-btn').addEventListener('click', handleDisconnect);
    
    // Contrôles audio
    document.getElementById('mute-btn').addEventListener('click', toggleMute);
    document.getElementById('speaker-btn').addEventListener('click', toggleSpeaker);
    document.getElementById('volume-slider').addEventListener('input', handleVolumeChange);
    
    // Canaux
    document.querySelectorAll('.channel-item').forEach(item => {
        item.addEventListener('click', () => {
            const channel = item.dataset.channel;
            joinChannel(channel);
        });
    });
}

function setupSocketEvents() {
    // Connexion/déconnexion
    socket.on('connect', () => {
        updateConnectionStatus(true);
        console.log('Connexion WebSocket établie');
    });
    
    socket.on('disconnect', () => {
        updateConnectionStatus(false);
        addMessage('Connexion perdue avec le serveur', 'error');
    });
    
    // Gestion des canaux
    socket.on('joined-channel', handleChannelJoined);
    socket.on('channel-users', updateChannelUsers);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('channels-list', updateChannelsList);
    
    // Gestion d'erreurs
    socket.on('error', (data) => {
        addMessage(data.message || 'Une erreur est survenue', 'error');
    });
    
    // Signalisation WebRTC
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('webrtc-ice-candidate', handleWebRTCIceCandidate);
    
    // Statut audio des utilisateurs
    socket.on('user-audio-status', handleUserAudioStatus);
}

// Gestion de la connexion
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    
    if (!username) {
        addMessage('Veuillez entrer un nom d\'utilisateur', 'error');
        return;
    }
    
    if (username.length > 20) {
        addMessage('Le nom d\'utilisateur ne peut pas dépasser 20 caractères', 'error');
        return;
    }
    
    currentUser = { username };
    
    // Cacher la section de connexion et afficher l'application
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    
    // Afficher le nom d'utilisateur
    document.getElementById('current-username').textContent = username;
    
    // Demander la liste des canaux
    socket.emit('get-channels');
    
    addMessage(`Bienvenue ${username} ! Sélectionnez un canal pour commencer.`, 'success');
}

function handleDisconnect() {
    if (currentChannel) {
        socket.emit('leave-channel');
    }
    
    // Réinitialiser l'état
    currentUser = null;
    currentChannel = null;
    
    // Afficher la section de connexion
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
    
    // Nettoyer l'interface
    document.getElementById('username').value = '';
    clearChannelInfo();
    clearUsersList();
    clearMessages();
    
    addMessage('Déconnexion réussie', 'info');
}

// Gestion des canaux
function joinChannel(channel) {
    if (!currentUser) return;
    
    socket.emit('join-channel', {
        username: currentUser.username,
        channel: channel
    });
}

function handleChannelJoined(data) {
    currentChannel = data.channel;
    
    // Mettre à jour l'interface
    updateActiveChannel(data.channel);
    showChannelInfo(data.channel);
    updateChannelUsers({ users: data.users });
    
    // Initialiser WebRTC pour ce canal
    initializeWebRTCForChannel(data.users);
    
    addMessage(`Vous avez rejoint ${getChannelDisplayName(data.channel)}`, 'success');
}

function updateActiveChannel(channel) {
    // Retirer la classe active de tous les canaux
    document.querySelectorAll('.channel-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Ajouter la classe active au canal actuel
    const activeChannel = document.querySelector(`[data-channel="${channel}"]`);
    if (activeChannel) {
        activeChannel.classList.add('active');
    }
}

function showChannelInfo(channel) {
    const channelInfo = document.getElementById('channel-info');
    const channelName = document.getElementById('current-channel-name');
    const channelDescription = document.getElementById('current-channel-description');
    
    channelName.textContent = getChannelDisplayName(channel);
    channelDescription.textContent = getChannelDescription(channel);
    
    channelInfo.classList.remove('hidden');
}

function clearChannelInfo() {
    document.getElementById('channel-info').classList.add('hidden');
    document.getElementById('users-list').classList.add('hidden');
}

function getChannelDisplayName(channel) {
    const names = {
        'canal-general': 'Canal Général',
        'canal-prive': 'Canal Privé',
        'canal-conference': 'Canal Conférence'
    };
    return names[channel] || channel;
}

function getChannelDescription(channel) {
    const descriptions = {
        'canal-general': 'Discutez librement avec tous les utilisateurs connectés',
        'canal-prive': 'Conversations privées entre participants sélectionnés',
        'canal-conference': 'Réunions et conférences avec plusieurs participants'
    };
    return descriptions[channel] || 'Canal de discussion vocale';
}

// Gestion des utilisateurs
function updateChannelUsers(data) {
    const usersList = document.getElementById('users-list');
    const usersContainer = document.getElementById('users-container');
    
    // Vider la liste actuelle
    usersContainer.innerHTML = '';
    
    if (data.users && data.users.length > 0) {
        data.users.forEach(user => {
            const userElement = createUserElement(user);
            usersContainer.appendChild(userElement);
        });
        
        usersList.classList.remove('hidden');
    } else {
        usersList.classList.add('hidden');
    }
}

function createUserElement(user) {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    userDiv.dataset.userId = user.id;
    
    userDiv.innerHTML = `
        <div class="user-item-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(user.username)}</div>
            <div class="user-item-status">
                <i class="fas fa-microphone"></i>
                <span>Connecté</span>
            </div>
        </div>
    `;
    
    return userDiv;
}

function handleUserJoined(data) {
    addMessage(`${data.user.username} a rejoint le canal`, 'info');
    
    // Demander la liste mise à jour des utilisateurs
    socket.emit('get-channels');
    
    // Établir une connexion WebRTC avec le nouvel utilisateur si nécessaire
    if (window.webRTCManager) {
        window.webRTCManager.connectToUser(data.user.id);
    }
}

function handleUserLeft(data) {
    addMessage(`${data.user.username} a quitté le canal`, 'warning');
    
    // Retirer l'utilisateur de la liste
    const userElement = document.querySelector(`[data-user-id="${data.user.id}"]`);
    if (userElement) {
        userElement.remove();
    }
    
    // Fermer la connexion WebRTC avec cet utilisateur
    if (window.webRTCManager) {
        window.webRTCManager.disconnectFromUser(data.user.id);
    }
}

function handleUserAudioStatus(data) {
    const userElement = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (!userElement) return;
    
    const statusElement = userElement.querySelector('.user-item-status');
    const iconElement = statusElement.querySelector('i');
    const textElement = statusElement.querySelector('span');
    
    if (data.isMuted) {
        iconElement.className = 'fas fa-microphone-slash';
        textElement.textContent = 'Muet';
        statusElement.classList.add('muted');
        statusElement.classList.remove('speaking');
    } else if (data.isSpeaking) {
        iconElement.className = 'fas fa-microphone';
        textElement.textContent = 'Parle';
        statusElement.classList.add('speaking');
        statusElement.classList.remove('muted');
    } else {
        iconElement.className = 'fas fa-microphone';
        textElement.textContent = 'Connecté';
        statusElement.classList.remove('muted', 'speaking');
    }
}

function updateChannelsList(channels) {
    channels.forEach(channel => {
        const channelElement = document.querySelector(`[data-channel="${channel.name}"]`);
        if (channelElement) {
            const userCountElement = channelElement.querySelector('.user-count');
            userCountElement.textContent = channel.userCount;
        }
    });
}

function clearUsersList() {
    document.getElementById('users-container').innerHTML = '';
    document.getElementById('users-list').classList.add('hidden');
}

// Contrôles audio
function toggleMute() {
    isMuted = !isMuted;
    
    const muteBtn = document.getElementById('mute-btn');
    const icon = muteBtn.querySelector('i');
    
    if (isMuted) {
        muteBtn.classList.add('muted');
        icon.className = 'fas fa-microphone-slash';
        muteBtn.title = 'Activer le micro';
    } else {
        muteBtn.classList.remove('muted');
        icon.className = 'fas fa-microphone';
        muteBtn.title = 'Couper le micro';
    }
    
    // Informer le serveur du changement de statut
    if (currentChannel) {
        socket.emit('audio-status', { 
            isMuted: isMuted,
            isSpeaking: false 
        });
    }
    
    // Appliquer le changement au flux audio WebRTC
    if (window.webRTCManager) {
        window.webRTCManager.setMuted(isMuted);
    }
}

function toggleSpeaker() {
    isSpeakerMuted = !isSpeakerMuted;
    
    const speakerBtn = document.getElementById('speaker-btn');
    const icon = speakerBtn.querySelector('i');
    
    if (isSpeakerMuted) {
        speakerBtn.classList.add('muted');
        icon.className = 'fas fa-volume-mute';
        speakerBtn.title = 'Activer les haut-parleurs';
    } else {
        speakerBtn.classList.remove('muted');
        icon.className = 'fas fa-volume-up';
        speakerBtn.title = 'Couper les haut-parleurs';
    }
    
    // Appliquer le changement au volume WebRTC
    if (window.webRTCManager) {
        window.webRTCManager.setSpeakerMuted(isSpeakerMuted);
    }
}

function handleVolumeChange(event) {
    volume = parseInt(event.target.value);
    
    // Appliquer le changement de volume
    if (window.webRTCManager) {
        window.webRTCManager.setVolume(volume / 100);
    }
}

// Gestion WebRTC
function initializeWebRTCForChannel(users) {
    if (window.webRTCManager) {
        window.webRTCManager.initialize(socket, currentUser.username);
        
        // Se connecter aux autres utilisateurs déjà présents
        users.forEach(user => {
            if (user.id !== socket.id) {
                window.webRTCManager.connectToUser(user.id);
            }
        });
    }
}

function handleWebRTCOffer(data) {
    if (window.webRTCManager) {
        window.webRTCManager.handleOffer(data);
    }
}

function handleWebRTCAnswer(data) {
    if (window.webRTCManager) {
        window.webRTCManager.handleAnswer(data);
    }
}

function handleWebRTCIceCandidate(data) {
    if (window.webRTCManager) {
        window.webRTCManager.handleIceCandidate(data);
    }
}

// Gestion des messages
function addMessage(text, type = 'info') {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const icon = getMessageIcon(type);
    messageDiv.innerHTML = `
        <i class="${icon}"></i>
        <span>${escapeHtml(text)}</span>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Supprimer les anciens messages (garder seulement les 50 derniers)
    const messages = messagesContainer.children;
    while (messages.length > 50) {
        messagesContainer.removeChild(messages[0]);
    }
}

function getMessageIcon(type) {
    const icons = {
        'info': 'fas fa-info-circle',
        'success': 'fas fa-check-circle',
        'warning': 'fas fa-exclamation-triangle',
        'error': 'fas fa-times-circle'
    };
    return icons[type] || icons.info;
}

function clearMessages() {
    document.getElementById('messages').innerHTML = `
        <div class="message info">
            <i class="fas fa-info-circle"></i>
            Sélectionnez un canal pour rejoindre la conversation
        </div>
    `;
}

// Gestion de l'état de connexion
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    const icon = statusElement.querySelector('i');
    const text = statusElement.childNodes[1];
    
    if (connected) {
        statusElement.className = 'status online';
        text.textContent = ' Connecté';
    } else {
        statusElement.className = 'status offline';
        text.textContent = ' Déconnecté';
    }
}

// Utilitaires
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}