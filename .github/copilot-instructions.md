# Projet Chat Vocal - Instructions Copilot

## Vue d'ensemble
Application web de chat vocal avec 3 canaux différents utilisant Node.js, Socket.io et WebRTC pour déploiement sur serveur Debian OVH.

## Technologies utilisées
- **Backend**: Node.js avec Express
- **Communication temps réel**: Socket.io
- **Audio**: WebRTC avec SimpleWebRTC ou PeerJS
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Déploiement**: Serveur Debian OVH

## Architecture
- **Serveur Node.js**: Gestion des connexions et de la signalisation WebRTC
- **3 Canaux vocaux**: Canal général, Canal privé, Canal conférence
- **Interface utilisateur**: Simple et intuitive avec sélection de canaux
- **Gestion des utilisateurs**: Connexion avec pseudonyme

## Fonctionnalités clés
1. Sélection de canal vocal (3 canaux disponibles)
2. Connexion audio WebRTC peer-to-peer
3. Liste des utilisateurs connectés par canal
4. Interface de contrôle audio (mute/unmute, volume)
5. Notifications de connexion/déconnexion

## Structure du projet
```
/
├── server/
│   ├── app.js              # Serveur Express principal
│   ├── socket-handler.js   # Gestion Socket.io
│   └── config/
├── public/
│   ├── index.html          # Interface principale
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── main.js         # Logique frontend
│   │   └── webrtc.js       # Gestion WebRTC
│   └── assets/
├── package.json
└── README.md
```

## Configuration pour serveur Debian
- Port par défaut: 3000
- Variables d'environnement configurables
- Script de démarrage pour systemd
- Configuration nginx pour reverse proxy

## Instructions de déploiement
1. Installation Node.js sur Debian
2. Configuration PM2 pour production
3. Setup nginx en reverse proxy
4. Configuration SSL avec Let's Encrypt