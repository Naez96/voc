// Gestionnaire WebRTC pour le chat vocal
class WebRTCManager {
    constructor() {
        this.socket = null;
        this.username = null;
        this.localStream = null;
        this.peers = new Map(); // Map des connexions peer
        this.isMuted = false;
        this.volume = 0.5;
        this.isSpeakerMuted = false;
        
        // Configuration des serveurs STUN/TURN
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }
    
    async initialize(socket, username) {
        this.socket = socket;
        this.username = username;
        
        try {
            // Demander l'accès au microphone
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            console.log('Flux audio local obtenu');
            
            // Détecter l'activité vocale
            this.setupVoiceActivityDetection();
            
        } catch (error) {
            console.error('Erreur lors de l\'accès au microphone:', error);
            this.handleMicrophoneError(error);
        }
    }
    
    setupVoiceActivityDetection() {
        if (!this.localStream) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(this.localStream);
            
            analyser.fftSize = 512;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            microphone.connect(analyser);
            
            let isSpeaking = false;
            const threshold = 30; // Seuil de détection de la voix
            
            const checkAudioLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                const newIsSpeaking = average > threshold && !this.isMuted;
                
                if (newIsSpeaking !== isSpeaking) {
                    isSpeaking = newIsSpeaking;
                    this.notifyAudioStatus(isSpeaking);
                }
                
                requestAnimationFrame(checkAudioLevel);
            };
            
            checkAudioLevel();
            
        } catch (error) {
            console.error('Erreur lors de la configuration de la détection vocale:', error);
        }
    }
    
    notifyAudioStatus(isSpeaking) {
        if (this.socket) {
            this.socket.emit('audio-status', {
                isMuted: this.isMuted,
                isSpeaking: isSpeaking
            });
        }
    }
    
    async connectToUser(userId) {
        if (this.peers.has(userId)) {
            console.log('Connexion déjà établie avec', userId);
            return;
        }
        
        try {
            const peer = new RTCPeerConnection(this.configuration);
            this.peers.set(userId, peer);
            
            // Ajouter le flux audio local
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peer.addTrack(track, this.localStream);
                });
            }
            
            // Gérer les événements de la connexion
            this.setupPeerEventHandlers(peer, userId);
            
            // Créer et envoyer une offre
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                target: userId,
                offer: offer
            });
            
            console.log('Offre WebRTC envoyée à', userId);
            
        } catch (error) {
            console.error('Erreur lors de la connexion à l\'utilisateur', userId, ':', error);
        }
    }
    
    async handleOffer(data) {
        if (this.peers.has(data.sender)) {
            console.log('Connexion déjà établie avec', data.sender);
            return;
        }
        
        try {
            const peer = new RTCPeerConnection(this.configuration);
            this.peers.set(data.sender, peer);
            
            // Ajouter le flux audio local
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peer.addTrack(track, this.localStream);
                });
            }
            
            // Gérer les événements de la connexion
            this.setupPeerEventHandlers(peer, data.sender);
            
            // Traiter l'offre reçue
            await peer.setRemoteDescription(data.offer);
            
            // Créer et envoyer une réponse
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            
            this.socket.emit('webrtc-answer', {
                target: data.sender,
                answer: answer
            });
            
            console.log('Réponse WebRTC envoyée à', data.sender);
            
        } catch (error) {
            console.error('Erreur lors du traitement de l\'offre de', data.sender, ':', error);
        }
    }
    
    async handleAnswer(data) {
        const peer = this.peers.get(data.sender);
        if (!peer) {
            console.error('Aucune connexion trouvée pour', data.sender);
            return;
        }
        
        try {
            await peer.setRemoteDescription(data.answer);
            console.log('Réponse WebRTC reçue de', data.sender);
        } catch (error) {
            console.error('Erreur lors du traitement de la réponse de', data.sender, ':', error);
        }
    }
    
    async handleIceCandidate(data) {
        const peer = this.peers.get(data.sender);
        if (!peer) {
            console.error('Aucune connexion trouvée pour', data.sender);
            return;
        }
        
        try {
            await peer.addIceCandidate(data.candidate);
            console.log('Candidat ICE ajouté pour', data.sender);
        } catch (error) {
            console.error('Erreur lors de l\'ajout du candidat ICE pour', data.sender, ':', error);
        }
    }
    
    setupPeerEventHandlers(peer, userId) {
        // Gérer les candidats ICE
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc-ice-candidate', {
                    target: userId,
                    candidate: event.candidate
                });
            }
        };
        
        // Gérer la réception du flux audio distant
        peer.ontrack = (event) => {
            console.log('Flux audio reçu de', userId);
            this.handleRemoteStream(event.streams[0], userId);
        };
        
        // Gérer les changements d'état de la connexion
        peer.onconnectionstatechange = () => {
            console.log('État de connexion avec', userId, ':', peer.connectionState);
            
            if (peer.connectionState === 'disconnected' || 
                peer.connectionState === 'failed' || 
                peer.connectionState === 'closed') {
                this.handlePeerDisconnection(userId);
            }
        };
        
        // Gérer les changements d'état ICE
        peer.oniceconnectionstatechange = () => {
            console.log('État ICE avec', userId, ':', peer.iceConnectionState);
        };
    }
    
    handleRemoteStream(stream, userId) {
        // Créer un élément audio pour le flux distant
        let audioElement = document.getElementById(`audio-${userId}`);
        
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = `audio-${userId}`;
            audioElement.autoplay = true;
            audioElement.controls = false;
            audioElement.volume = this.volume;
            audioElement.muted = this.isSpeakerMuted;
            
            // Ajouter à un container caché pour la gestion
            let audioContainer = document.getElementById('remote-audio-container');
            if (!audioContainer) {
                audioContainer = document.createElement('div');
                audioContainer.id = 'remote-audio-container';
                audioContainer.style.display = 'none';
                document.body.appendChild(audioContainer);
            }
            
            audioContainer.appendChild(audioElement);
        }
        
        audioElement.srcObject = stream;
        
        console.log('Flux audio distant configuré pour', userId);
    }
    
    handlePeerDisconnection(userId) {
        // Supprimer la connexion peer
        this.peers.delete(userId);
        
        // Supprimer l'élément audio correspondant
        const audioElement = document.getElementById(`audio-${userId}`);
        if (audioElement) {
            audioElement.remove();
        }
        
        console.log('Connexion fermée avec', userId);
    }
    
    disconnectFromUser(userId) {
        const peer = this.peers.get(userId);
        if (peer) {
            peer.close();
            this.handlePeerDisconnection(userId);
        }
    }
    
    setMuted(muted) {
        this.isMuted = muted;
        
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
        
        this.notifyAudioStatus(false); // Force speaking à false quand muté
    }
    
    setSpeakerMuted(muted) {
        this.isSpeakerMuted = muted;
        
        // Appliquer le mute à tous les éléments audio distants
        document.querySelectorAll('[id^=\"audio-\"]').forEach(audioElement => {
            audioElement.muted = muted;
        });
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        // Appliquer le volume à tous les éléments audio distants
        document.querySelectorAll('[id^=\"audio-\"]').forEach(audioElement => {
            audioElement.volume = this.volume;
        });
    }
    
    handleMicrophoneError(error) {
        let message = 'Erreur d\'accès au microphone';
        
        if (error.name === 'NotAllowedError') {
            message = 'Accès au microphone refusé. Veuillez autoriser l\'accès au microphone et recharger la page.';
        } else if (error.name === 'NotFoundError') {
            message = 'Aucun microphone trouvé. Veuillez connecter un microphone et recharger la page.';
        } else if (error.name === 'NotReadableError') {
            message = 'Microphone déjà en cours d\'utilisation par une autre application.';
        }
        
        // Afficher le message d'erreur dans l'interface
        if (window.addMessage) {
            window.addMessage(message, 'error');
        }
    }
    
    // Nettoyage lors de la déconnexion
    cleanup() {
        // Fermer toutes les connexions peer
        this.peers.forEach((peer, userId) => {
            peer.close();
        });
        this.peers.clear();
        
        // Arrêter le flux local
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }
        
        // Supprimer les éléments audio distants
        const audioContainer = document.getElementById('remote-audio-container');
        if (audioContainer) {
            audioContainer.remove();
        }
        
        console.log('WebRTC Manager nettoyé');
    }
}

// Créer une instance globale
window.webRTCManager = new WebRTCManager();

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.webRTCManager) {
        window.webRTCManager.cleanup();
    }
});