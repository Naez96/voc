#!/bin/bash

# Script de déploiement pour voc.naez.fr
# À exécuter sur le serveur Debian OVH

echo "🚀 Démarrage du déploiement de voc.naez.fr..."

# Vérification des prérequis
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 n'est pas installé"
    exit 1
fi

if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx n'est pas installé"
    exit 1
fi

# Création du dossier d'application
echo "📁 Création du dossier d'application..."
mkdir -p /var/www/voc-naez-fr
cd /var/www/voc-naez-fr

# Clonage du repository
echo "📥 Clonage du repository GitHub..."
if [ -d ".git" ]; then
    echo "Repository déjà présent, mise à jour..."
    git pull origin main
else
    git clone https://github.com/Naez96/voc.git .
fi

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm ci --only=production

# Configuration de l'environnement
echo "⚙️ Configuration de l'environnement..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Fichier .env créé, veuillez le configurer si nécessaire"
fi

# Configuration Nginx
echo "🌐 Configuration Nginx..."
cat > /etc/nginx/sites-available/voc-naez-fr << 'EOF'
server {
    listen 80;
    server_name voc.naez.fr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name voc.naez.fr;
    
    # Configuration SSL (à configurer avec certbot)
    ssl_certificate /etc/letsencrypt/live/voc.naez.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voc.naez.fr/privkey.pem;
    
    # Configuration moderne SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
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
        
        # Configuration pour WebRTC
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
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
EOF

# Activation du site
ln -sf /etc/nginx/sites-available/voc-naez-fr /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test de la configuration Nginx
echo "🧪 Test de la configuration Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration Nginx valide"
    systemctl reload nginx
else
    echo "❌ Erreur dans la configuration Nginx"
    exit 1
fi

# Démarrage de l'application avec PM2
echo "🚀 Démarrage de l'application..."
pm2 delete voc-naez-fr 2>/dev/null || true
pm2 start server/app.js --name "voc-naez-fr"
pm2 save
pm2 startup

echo ""
echo "✅ Déploiement terminé !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Configurez le certificat SSL avec : sudo certbot --nginx -d voc.naez.fr"
echo "2. Vérifiez que l'application fonctionne : pm2 status"
echo "3. Consultez les logs : pm2 logs voc-naez-fr"
echo ""
echo "🌐 Votre chat vocal sera accessible sur : https://voc.naez.fr"