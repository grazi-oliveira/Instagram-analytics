# Alta Voltagem: animação de encerramento

Animação cinematográfica de 84 s em 1920×1080 e 30 fps para o fim do curta da equipe **Alta Voltagem**.

| Tempo | Cena |
|---|---|
| 0–10 s | Zoom saindo dos olhos do Super Choque, impacto e a logo com raios |
| 10–16 s | "Haja luz." (Gênesis 1:3) e a luz inunda a tela |
| 16–30 s | Cores: Índigo, Amarelo, Preto e Branco |
| 30–36 s | Atos 1:8 |
| 36–50 s | Bandeira tremulando com relâmpagos |
| 50–55 s | Mateus 5:14 |
| 55–70 s | Equipe: Giovana (líder), Oséas, Kauã, Pedro, Sara, Giovanna, Marcos Vinícius e Gueta |
| 70–75 s | Romanos 12:11 |
| 75–84 s | A energia converge, cai um raio e entra a logo final |

## Arquivos
- `anim.js`: toda a animação. Nomes, cores, versículos e tempos ficam no topo do arquivo.
- `index.html`: abre no navegador pra ver a prévia em tempo real (`index.html?t=42` congela no segundo 42).
- `render.js`: renderiza quadro a quadro com o Chromium (Playwright) e codifica com o FFmpeg.
- `sfx.py`: sintetiza os efeitos sonoros sincronizados (sem música).
- `logo.png` / `recorte_logo.py`: logo recortada do fundo.

## Gerar de novo
```bash
node render.js video_sem_audio.mp4          # gera também sfx.json
python3 sfx.py sfx.json sfx.wav 84
ffmpeg -i video_sem_audio.mp4 -i sfx.wav -c:v copy -c:a aac -b:a 320k -shortest alta_voltagem.mp4
```
Requisitos: Node com Playwright, FFmpeg, Python 3 com NumPy e SciPy, e a fonte Inter Display instalada.
