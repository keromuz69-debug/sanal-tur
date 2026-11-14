@echo off
cd /d "%~dp0"
echo Sanal Tur yerel sunucu baslatiliyor: http://localhost:8000
echo Kapatmak icin bu pencereyi kapatin.
start "" http://localhost:8000/index.html
where py >nul 2>nul && (py -m http.server 8000) || (python -m http.server 8000)
if errorlevel 1 (echo. & echo Python bulunamadi. https://www.python.org/downloads/ adresinden kurun veya klasoru app.netlify.com/drop adresine surukleyin. & pause)
