#!/bin/bash

# Script de correction pour l'erreur SSL Nginx
# Pour corriger l'erreur de certificat manquant

echo "🔧 Correction de l'erreur SSL Nginx..."

# Configuration Nginx temporaire sans SSL
echo "📝 Reconfiguration Nginx sans SSL..."
cat > /etc/nginx/sites-available/voc-naez-fr << 'EOF'
server {
    listen 80;
    server_name voc.naez.fr;
    
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

# Test de la configuration
echo "🧪 Test de la configuration Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration Nginx corrigée !"
    systemctl reload nginx
    
    echo ""
    echo "🌐 Votre site est maintenant accessible en HTTP sur : http://voc.naez.fr"
    echo ""
    echo "🔐 Pour configurer SSL maintenant :"
    echo ""
    echo "1. Installez certbot si pas déjà fait :"
    echo "   apt update && apt install -y certbot python3-certbot-nginx"
    echo ""
    echo "2. Générez le certificat SSL :"
    echo "   certbot --nginx -d voc.naez.fr"
    echo ""
    echo "3. Le certificat sera automatiquement configuré et le site sera accessible en HTTPS"
    
else
    echo "❌ Erreur dans la configuration Nginx"
    exit 1
fi