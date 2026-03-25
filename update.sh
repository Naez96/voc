#!/bin/bash

# Script de mise à jour pour voc.naez.fr
# À exécuter sur le serveur pour mettre à jour l'application

echo "🔄 Mise à jour de voc.naez.fr..."

# Aller dans le dossier de l'application
cd /var/www/voc-naez-fr

# Sauvegarder l'ancien .env si il existe
if [ -f ".env" ]; then
    cp .env .env.backup
fi

# Mettre à jour le code
echo "📥 Récupération des dernières modifications..."
git pull origin main

# Réinstaller les dépendances si package.json a changé
if git diff HEAD~1 HEAD --name-only | grep -q "package.json"; then
    echo "📦 Mise à jour des dépendances..."
    npm ci --only=production
fi

# Restaurer le .env personnalisé si il a été écrasé
if [ -f ".env.backup" ] && [ -f ".env.example" ]; then
    if cmp -s ".env" ".env.example"; then
        echo "⚙️ Restauration de la configuration personnalisée..."
        mv .env.backup .env
    else
        rm .env.backup
    fi
fi

# Redémarrer l'application
echo "🔄 Redémarrage de l'application..."
pm2 restart voc-naez-fr

# Afficher le statut
echo ""
echo "✅ Mise à jour terminée !"
pm2 status voc-naez-fr

echo ""
echo "📋 Pour voir les logs : pm2 logs voc-naez-fr"