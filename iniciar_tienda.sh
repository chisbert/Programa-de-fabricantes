#!/bin/bash
echo "========================================================"
echo "  Iniciando TramaHogar (Gestión de Ropa de Hogar)"
echo "========================================================"
echo ""

if [ ! -d "node_modules/@tailwindcss/vite" ]; then
    echo "Instalando dependencias necesarias (por favor espera un momento)..."
    npm install --legacy-peer-deps || npm install --force
    echo ""
fi

# Open browser depending on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:3000 &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://localhost:3000 &
fi

echo "Iniciando servidor local en http://localhost:3000..."
npm run dev
