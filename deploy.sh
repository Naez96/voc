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

# Configuration Nginx TEMPORAIRE (sans SSL d'abord)
echo "🌐 Configuration Nginx temporaire (sans SSL)..."
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

# Configuration SSL optionnelle
read -p "🔐 Voulez-vous configurer SSL maintenant ? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Installation de certbot si pas déjà installé
    if ! command -v certbot &> /dev/null; then
        echo "📥 Installation de Certbot..."
        apt update
        apt install -y certbot python3-certbot-nginx
    fi
    
    echo "🔑 Configuration SSL avec Let's Encrypt..."
    certbot --nginx -d voc.naez.fr
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL configuré avec succès !"
        
        # Configuration du renouvellement automatique
        if ! crontab -l 2>/dev/null | grep -q certbot; then
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            echo "✅ Renouvellement automatique configuré"
        fi
    fi
fi

echo ""
echo "📋 Prochaines étapes :"
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "1. Configurez le certificat SSL avec : sudo certbot --nginx -d voc.naez.fr"
fi
echo "2. Vérifiez que l'application fonctionne : pm2 status"
echo "3. Consultez les logs : pm2 logs voc-naez-fr"
echo ""
echo "🌐 Votre chat vocal sera accessible sur : https://voc.naez.fr"