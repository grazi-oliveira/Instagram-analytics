"""Gera a trilha de efeitos sonoros (sem música) sincronizada com a animação.

Lê sfx.json (exportado pelo render.js a partir de anim.js) e sintetiza cada efeito
do zero: whoosh, impacto, zap elétrico, estalos, zumbido, trovão, brilho, vento.
Uso: python3 sfx.py sfx.json saida.wav [duracao_s]
"""
import json
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rs = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env_ad(n, a, d_curve=4.0):
    """Ataque linear de `a` segundos e decaimento exponencial até o fim."""
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    e[na:] = np.exp(-np.linspace(0, d_curve, n - na))
    return e


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)


def sweep_noise(dur, f0, f1, q=1.6):
    """Ruído filtrado com centro varrendo de f0 a f1 (overlap-add)."""
    n = int(dur * SR)
    noise = rs.standard_normal(n + 4096)
    out = np.zeros(n + 4096)
    hop, win = 1024, np.hanning(2048)
    for i, s in enumerate(range(0, n, hop)):
        fc = f0 * (f1 / f0) ** (s / max(1, n))
        lo, hi = fc / q, min(fc * q, SR / 2 - 100)
        seg = bp(noise[s:s + 2048], lo, hi) * win
        out[s:s + 2048] += seg
    return out[:n]


def stereo(x, width=0.3, delay_ms=9):
    d = int(delay_ms * SR / 1000)
    r = np.concatenate([np.zeros(d), x[:-d]]) if d else x
    return np.stack([x * (1 - width / 2) + r * width / 2, r * (1 - width / 2) + x * width / 2], 1)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


# ---------------- efeitos ----------------
def fx_whoosh(dur=1.0):
    n = int(dur * SR)
    x = sweep_noise(dur, 200, 6000)
    e = np.linspace(0, 1, n) ** 2.5
    e[-int(.03 * SR):] *= np.linspace(1, 0, int(.03 * SR))
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(60, 400, n)) / SR) * .25
    return stereo(norm(x * e + tone * e) * .8, .6)


def fx_swoosh(dur=.6):
    n = int(dur * SR)
    x = sweep_noise(dur, 500, 4000)
    tt = np.linspace(0, 1, n)
    e = np.sin(np.pi * tt) ** 2
    out = stereo(norm(x * e) * .6, .2)
    pan = np.linspace(-.8, .8, n)  # passa da esquerda para a direita
    out[:, 0] *= (1 - pan) / 2 + .2
    out[:, 1] *= (1 + pan) / 2 + .2
    return out


def fx_impact(dur=3.0):
    t = t_axis(dur)
    n = len(t)
    f = 32 + 90 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    body = lp(rs.standard_normal(n), 900) * np.exp(-t * 7) * 1.2
    crack = hp(rs.standard_normal(n), 2500) * np.exp(-t * 30) * .9
    tail = lp(rs.standard_normal(n), 250) * np.exp(-t * 1.3) * .5
    x = np.tanh(1.6 * (sub * 1.2 + body + crack + tail))
    return stereo(norm(x) * 1.0, .4, 13)


def fx_zap(dur=.45):
    t = t_axis(dur)
    n = len(t)
    # oscilador "elétrico" com frequência saltando
    steps = np.repeat(rs.uniform(70, 420, int(dur * 60) + 2), int(SR / 60) + 1)[:n]
    saw = 2 * ((np.cumsum(steps) / SR) % 1) - 1
    buzz = np.sign(np.sin(2 * np.pi * np.cumsum(steps * 2.01) / SR)) * .5
    hiss = hp(rs.standard_normal(n), 3000)
    gate = (rs.random(n // 240 + 1) > .35).repeat(240)[:n]
    x = (saw * .6 + buzz * .4) * gate + hiss * .5
    x = np.tanh(2.5 * hp(x, 120)) * env_ad(n, .002, 6)
    return stereo(norm(x) * .9, .5, 5)


def fx_crackle(dur=2.0):
    n = int(dur * SR)
    x = np.zeros(n)
    count = int(dur * 55)
    for _ in range(count):
        p = rs.integers(0, max(1, n - 2400))
        L = rs.integers(60, 2200)
        burst = rs.standard_normal(L) * np.exp(-np.linspace(0, 6, L)) * rs.uniform(.2, 1)
        x[p:p + L] += burst
    x = hp(x, 1500)
    e = np.ones(n)
    k = min(n // 4, int(.15 * SR))
    e[:k] = np.linspace(0, 1, k)
    e[-k:] = np.linspace(1, 0, k)
    return stereo(norm(x * e) * .7, .9, 11)


def fx_hum(dur=4.0):
    t = t_axis(dur)
    n = len(t)
    x = sum(np.sin(2 * np.pi * 60 * h * t + h) / h ** 1.2 for h in range(1, 9))
    x = lp(x, 900) * (1 + .25 * np.sin(2 * np.pi * 4.5 * t))
    e = np.minimum(1, np.minimum(t / .6, (dur - t) / .8)).clip(0, 1)
    return stereo(norm(x * e) * .5, .3)


def fx_riser(dur=1.6):
    t = t_axis(dur)
    n = len(t)
    x = sweep_noise(dur, 300, 9000)
    f = np.geomspace(120, 1400, n)
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * m) / SR) for m in (1, 1.5, 2.003)) / 3
    e = (t / dur) ** 3
    e[-int(.02 * SR):] *= np.linspace(1, 0, int(.02 * SR))
    return stereo(norm(x * .7 + tone * .5) * e * .85, .6)


def fx_shimmer(dur=1.3):
    t = t_axis(dur)
    n = len(t)
    x = np.zeros(n)
    for _ in range(14):
        f = rs.uniform(2200, 7000)
        x += np.sin(2 * np.pi * f * t + rs.uniform(0, 6)) * np.exp(-((t - rs.uniform(.1, .7) * dur) / (.25 * dur)) ** 2)
    x += hp(rs.standard_normal(n), 7000) * .15
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return stereo(norm(x * e) * .45, .9, 17)


def fx_thunder(dur=3.0):
    t = t_axis(dur)
    n = len(t)
    brown = np.cumsum(rs.standard_normal(n))
    brown = hp(brown, 20)
    x = lp(brown, 220) * np.exp(-t * 1.4) * (1 + .6 * lp(rs.standard_normal(n), 3) * 30)
    crack = hp(rs.standard_normal(n), 1800) * np.exp(-t * 18) * .4
    return stereo(norm(x + crack) * .9, .8, 21)


def fx_wind(dur=14.0):
    t = t_axis(dur)
    n = len(t)
    x = lp(rs.standard_normal(n), 600)
    gust = .6 + .4 * np.sin(2 * np.pi * .23 * t) * np.sin(2 * np.pi * .11 * t + 1)
    flap = 1 + .35 * np.sin(2 * np.pi * 2.2 * t) ** 8  # batida do tecido
    e = np.minimum(1, np.minimum(t / 1.2, (dur - t) / 1.2)).clip(0, 1)
    return stereo(norm(x * gust * flap * e) * .6, 1.0, 23)


def fx_tick(dur=.12):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * 3200 * t) * np.exp(-t * 90) + hp(rs.standard_normal(len(t)), 5000) * np.exp(-t * 200) * .3
    return stereo(norm(x) * .5, .2)


def fx_air(dur=4.0):
    t = t_axis(dur)
    x = bp(rs.standard_normal(len(t)), 300, 2500)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return stereo(norm(x * e) * .25, 1.0, 19)


FX = dict(whoosh=fx_whoosh, swoosh=fx_swoosh, impact=fx_impact, zap=fx_zap, crackle=fx_crackle,
          hum=fx_hum, riser=fx_riser, shimmer=fx_shimmer, thunder=fx_thunder, wind=fx_wind,
          tick=fx_tick, air=fx_air)


def reverb(x, secs=1.8, mix=.22):
    n = int(secs * SR)
    tt = np.arange(n) / SR
    out = np.empty_like(x)
    for c in range(2):
        ir = rs.standard_normal(n) * np.exp(-tt * 3.2)
        ir = lp(ir, 5000)
        ir /= np.sqrt(np.sum(ir ** 2))
        out[:, c] = signal.fftconvolve(x[:, c], ir)[:len(x)]
    return x * (1 - mix) + out * mix * 1.6


def main():
    events = json.load(open(sys.argv[1]))
    total = float(sys.argv[3]) if len(sys.argv) > 3 else 84.0
    mix = np.zeros((int(total * SR) + SR, 2))
    for ev in events:
        fn = FX[ev['type']]
        y = fn(ev['dur']) if 'dur' in ev else fn()
        y = y * ev.get('g', 1)
        s = int(ev['t'] * SR)
        e = min(len(mix), s + len(y))
        mix[s:e] += y[:e - s]
    mix = reverb(mix)
    mix = mix[:int(total * SR)]
    mix = np.tanh(mix / (np.max(np.abs(mix)) * .7)) * .89  # limitador suave, pico ≈ -1 dBFS
    fade = int(.05 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    wavfile.write(sys.argv[2], SR, (mix * 32767).astype(np.int16))


if __name__ == '__main__':
    main()
