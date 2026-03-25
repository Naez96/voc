#!/bin/bash

# Script de résolution pour l'erreur de port 3000 -> 3002
echo "🔧 Résolution du problème de port..."

# Aller dans le dossier de l'application
cd /var/www/voc-naez-fr

# Arrêter toutes les instances
echo "⏹️ Arrêt des instances PM2..."
pm2 delete voc-naez-fr 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Mettre à jour le code
echo "📥 Mise à jour du code..."
git pull origin main

# Réinstaller les dépendances
echo "📦 Réinstallation des dépendances..."
npm ci --only=production

# Créer le fichier .env avec le bon port
echo "⚙️ Configuration de l'environnement..."
cat > .env << 'EOF'
NODE_ENV=production
PORT=3002
DOMAIN=voc.naez.fr

# Logs
LOG_LEVEL=info
EOF

# Vérifier que le port 3002 est libre
echo "🔍 Vérification du port 3002..."
if netstat -tlnp | grep -q :3002; then
    echo "⚠️ Port 3002 occupé, libération..."
    sudo fuser -k 3002/tcp 2>/dev/null || true
    sleep 2
fi

# Démarrer l'application avec les variables d'environnement explicites
echo "🚀 Démarrage de l'application sur le port 3002..."
PORT=3002 NODE_ENV=production pm2 start server/app.js --name "voc-naez-fr" --env production

# Sauvegarder la configuration PM2
pm2 save

# Vérifier que l'application démarre correctement
echo "⏳ Vérification du démarrage..."
sleep 5

# Statut final
echo "📊 Statut final :"
pm2 status voc-naez-fr
echo ""
echo "🔍 Vérification du port 3002 :"
netstat -tlnp | grep :3002 || echo "❌ Port 3002 non ouvert"
echo ""
echo "📋 Logs récents :"
pm2 logs voc-naez-fr --lines 5

# Configuration Nginx
echo ""
echo "🌐 Mise à jour de la configuration Nginx..."
cat > /etc/nginx/sites-available/voc-naez-fr << 'EOF'
server {
    listen 80;
    server_name voc.naez.fr;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Configuration pour WebRTC
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Configuration spéciale pour Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Test et rechargement Nginx
nginx -t && systemctl reload nginx

echo ""
echo "✅ Configuration terminée !"
echo "🌐 Testez maintenant : http://voc.naez.fr"