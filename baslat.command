#!/bin/bash
# Mac / Linux: çift tıklayın (ilk seferde: sağ tık > Aç). Tarayıcıda http://localhost:8000 açılır.
cd "$(dirname "$0")"
echo "Sanal Tur yerel sunucu: http://localhost:8000  (kapatmak için Ctrl+C)"
( sleep 1; (open http://localhost:8000/index.html 2>/dev/null || xdg-open http://localhost:8000/index.html 2>/dev/null) ) &
python3 -m http.server 8000
