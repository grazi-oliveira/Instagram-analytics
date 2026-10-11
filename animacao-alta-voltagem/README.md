# Alta Voltagem: animação de encerramento

Animação cinematográfica de ~47 s em 1920×1080 e 30 fps para o fim do curta da equipe **Alta Voltagem**.
Cada versículo entra rasgando a tela por cima do fim da cena anterior (J-cut), sem pausas entre as partes.

| Tempo | Cena |
|---|---|
| 0–6 s | Zoom saindo dos olhos do Super Choque (raios azulados do filme), impacto e a logo |
| 5,6–8,6 s | "Haja luz." (Gênesis 1:3) e a luz inunda a tela |
| 8,6–15 s | Cores: 4 cortes rápidos e depois os 4 quadrados entrando dos cantos |
| 15–18,4 s | Atos 1:8 |
| 18,4–24,2 s | Raio revela a bandeira, a câmera avança e termina num zoom rápido na logo |
| 24,2–27,4 s | Mateus 5:14 |
| 27,4–36,4 s | Equipe: Giovana (líder), Oséas, Kauã, Pedro, Sara, Giovanna, Marcos Vinícius e Gueta |
| 36,4–39,8 s | Romanos 12:11 |
| 39,8–46,9 s | Tempestade converge, apagão, raio final, logo e corte seco |

## Arquivos
- `anim.js`: toda a animação. Nomes, cores, versículos e tempos ficam no topo do arquivo.
- `index.html`: abre no navegador pra ver a prévia em tempo real (`index.html?t=42` congela no segundo 42).
- `render.js`: renderiza quadro a quadro com o Chromium (Playwright) e codifica com o FFmpeg.
- `sfx.py`: sintetiza os efeitos sonoros sincronizados (sem música).
- `logo.png` / `recorte_logo.py`: logo recortada do fundo.

## Gerar de novo
```bash
./render_all.sh saida     # tudo de uma vez: 3 partes em paralelo, efeitos e MP4 final em saida/

# ou passo a passo:
node render.js video_sem_audio.mp4          # gera também sfx.json
python3 sfx.py sfx.json sfx.wav 46.9
ffmpeg -i video_sem_audio.mp4 -i sfx.wav -c:v copy -c:a aac -b:a 320k -shortest alta_voltagem.mp4
```
Requisitos: Node com Playwright, FFmpeg, Python 3 com NumPy e SciPy, e a fonte Inter Display instalada.
