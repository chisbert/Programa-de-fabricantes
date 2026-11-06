@echo off
title TramaHogar - Gestion de Tienda
echo ========================================================
echo   Iniciando TramaHogar (Gestion de Ropa de Hogar)
echo ========================================================
echo.

REM Comprobar si vite esta instalado
if not exist node_modules\vite (
    echo Instalando dependencias por primera vez con resolucion forzada...
    call npm install --force
    echo.
)

echo Abriendo TramaHogar en tu navegador...
start http://localhost:3000

echo Iniciando servidor local en http://localhost:3000...
call npm run dev

if errorlevel 1 (
    echo.
    echo ========================================================
    echo Hubo un problema al arrancar. Reparando dependencias...
    echo ========================================================
    call npm install --force
    echo Reintentando arranque...
    call npm run dev
)

pause
