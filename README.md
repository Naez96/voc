# Chat Vocal - 3 Canaux

Application web de chat vocal avec 3 canaux différents utilisant Node.js, Socket.io et WebRTC pour déploiement sur serveur Debian OVH.

## 🚀 Fonctionnalités

- **3 Canaux vocaux** : Canal Général, Canal Privé, Canal Conférence
- **Chat vocal en temps réel** avec WebRTC
- **Interface moderne et responsive**
- **Gestion des utilisateurs** et statuts audio
- **Détection d'activité vocale** automatique
- **Contrôles audio** (mute/unmute, volume)
- **Optimisé pour serveur Debian**

## 📋 Prérequis

- Node.js 16+ 
- npm ou yarn
- Serveur Debian (pour production)
- Certificat SSL (recommandé pour WebRTC)

## 🛠️ Installation

### Développement local

```bash
# Cloner le projet
git clone <votre-repo>
cd chat-vocal-ovh

# Installer les dépendances
npm install

# Démarrer en mode développement
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

### Production sur serveur Debian OVH

1. **Préparation du serveur**
```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation de Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installation de PM2 pour la gestion des processus
sudo npm install -g pm2
```

2. **Déploiement de l'application**
```bash
# Copier les fichiers sur le serveur
scp -r . user@votre-serveur:/var/www/chat-vocal/

# Connexion au serveur
ssh user@votre-serveur

# Aller dans le dossier de l'application
cd /var/www/chat-vocal

# Installer les dépendances de production
npm ci --only=production

# Configuration des variables d'environnement
cp .env.example .env
nano .env
```

3. **Configuration de l'environnement (.env)**
```bash
NODE_ENV=production
PORT=3000
DOMAIN=votre-domaine.com
```

4. **Démarrage avec PM2**
```bash
# Démarrer l'application
pm2 start server/app.js --name "chat-vocal"

# Sauvegarder la configuration PM2
pm2 save
pm2 startup
```

5. **Configuration Nginx (Reverse Proxy)**
```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Configuration spéciale pour Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

6. **SSL avec Let's Encrypt**
```bash
# Installation de Certbot
sudo apt install certbot python3-certbot-nginx

# Génération du certificat
sudo certbot --nginx -d votre-domaine.com

# Renouvellement automatique
sudo crontab -e
# Ajouter: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🏗️ Structure du projet

```
/
├── server/
│   ├── app.js              # Serveur Express principal
│   ├── socket-handler.js   # Gestion Socket.io et canaux
│   └── config/
├── public/
│   ├── index.html          # Interface principale
│   ├── css/
│   │   └── style.css       # Styles de l'application
│   ├── js/
│   │   ├── main.js         # Logique frontend
│   │   └── webrtc.js       # Gestion WebRTC
│   └── assets/
├── .github/
│   └── copilot-instructions.md
├── package.json
├── .env
└── README.md
```

## 🎯 Utilisation

1. **Connexion** : Entrez votre nom d'utilisateur
2. **Sélection de canal** : Cliquez sur un des 3 canaux disponibles
3. **Autorisation microphone** : Acceptez l'accès au microphone
4. **Chat vocal** : Parlez avec les autres utilisateurs du canal

### Contrôles disponibles

- **Mute/Unmute** : Cliquez sur l'icône micro
- **Volume** : Utilisez le slider de volume
- **Haut-parleurs** : Activez/désactivez le son
- **Changement de canal** : Cliquez sur un autre canal

## 🐛 Dépannage

### Problèmes communs

**Microphone non détecté :**
- Vérifiez les permissions du navigateur
- Testez avec un autre navigateur
- Vérifiez que le microphone fonctionne

**Pas de son :**
- Vérifiez le volume système
- Testez les haut-parleurs/écouteurs
- Rechargez la page

**Connexion WebRTC échoue :**
- Vérifiez la configuration du pare-feu
- Testez sur un réseau différent
- Contactez votre administrateur réseau

### Logs

```bash
# Logs PM2
pm2 logs chat-vocal

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔧 Scripts disponibles

```bash
npm start      # Démarrage production
npm run dev    # Démarrage développement avec nodemon
npm test       # Tests (à implémenter)
```

## 🌐 Navigateurs supportés

- Chrome 80+
- Firefox 80+
- Safari 14+
- Edge 80+

**Note :** WebRTC nécessite HTTPS en production pour fonctionner correctement.

## 📚 Technologies utilisées

- **Backend :** Node.js, Express, Socket.io
- **Frontend :** HTML5, CSS3, JavaScript (ES6+)
- **WebRTC :** Connexions peer-to-peer pour l'audio
- **Sécurité :** Helmet.js, CORS
- **Production :** PM2, Nginx, Let's Encrypt

## 🤝 Contribution

1. Fork du projet
2. Créez votre branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commitez vos changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrez une Pull Request

## 📄 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 📞 Support

Pour des questions ou problèmes :
- Créez une issue sur GitHub
- Consultez la documentation dans `.github/copilot-instructions.md`

## 🔄 Mises à jour

Pour mettre à jour l'application sur le serveur :

```bash
# Sur le serveur
cd /var/www/chat-vocal
git pull origin main
npm ci --only=production
pm2 restart chat-vocal
```