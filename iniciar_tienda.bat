@echo off
title TramaHogar - Gestion de Tienda
echo ========================================================
echo   Iniciando TramaHogar (Gestion de Ropa de Hogar)
echo ========================================================
echo.

if not exist node_modules (
    echo Instalando dependencias por primera vez...
    call npm install
    echo.
)

echo Abriendo TramaHogar en tu navegador...
start http://localhost:3000

echo Iniciando servidor local...
call npm run dev
pause
