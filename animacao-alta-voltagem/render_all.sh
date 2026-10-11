#!/bin/bash
# Renderiza em 3 partes paralelas, junta, gera os efeitos e monta os arquivos finais.
# Uso: ./render_all.sh pasta_de_saida
set -e
cd "$(dirname "$0")"
OUT=${1:-saida}; mkdir -p "$OUT"
node render.js "$OUT/p1.mp4" 0 28 & node render.js "$OUT/p2.mp4" 28 56 & node render.js "$OUT/p3.mp4" 56 84.5 & wait
printf "file '%s'\n" p1.mp4 p2.mp4 p3.mp4 > "$OUT/list.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$OUT/list.txt" -c copy "$OUT/alta_voltagem_sem_audio.mp4"
python3 sfx.py sfx.json "$OUT/alta_voltagem_efeitos.wav" 84.5
ffmpeg -y -v error -i "$OUT/alta_voltagem_sem_audio.mp4" -i "$OUT/alta_voltagem_efeitos.wav" -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart "$OUT/alta_voltagem.mp4"
rm "$OUT"/p?.mp4 "$OUT/list.txt"
echo RENDER_DONE
