@echo off
setlocal
cd /d "%~dp0.."
npx expo start --web --port 8081 --clear > expo-web.log 2> expo-web.err.log
