"""
Synthesizes the launch video's placeholder soundtrack (no samples, no network):
112 BPM, A minor (Am F C G), 69 s. Sparse pad for the problem, a kick and bass
arrive with the map, an arpeggio builds, a lift near 40 s, then a calm pad out.
Run: python3 scripts/make-music.py  ->  public/music.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 44100
DUR = 69.0
BPM = 112
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def env(t, a, d, curve=4.0):
    return np.where(t < a, t / a, np.exp(-(t - a) * curve / d))
def smooth(x, a, b, t0, t1):
    """Level ramp a->b between t0 and t1 (seconds), held outside."""
    return np.interp(t_all, [0, t0, t1, DUR], [a, a, b, b])

# Am F C G, one bar each: (bass root, chord tones)
CHORDS = [(45, [57, 60, 64]), (41, [53, 57, 60]), (48, [60, 64, 67]), (43, [55, 59, 62])]
BAR = BEAT * 4

L = np.zeros(N); R = np.zeros(N)
def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    buf[i:j] += sig[: j - i] * gain

# --- pad: detuned saws through a slow low-pass, one chord per bar -----------------
pad = np.zeros(N)
for b in range(int(DUR / BAR) + 1):
    root, tones = CHORDS[b % 4]
    s0 = b * BAR
    tt = np.arange(int((BAR + 1.2) * SR)) / SR
    chord = np.zeros_like(tt)
    for m in tones + [root + 12]:
        for det in (-0.07, 0.0, 0.07):
            f = hz(m) * 2 ** (det / 12)
            chord += 2 * ((tt * f) % 1) - 1
    chord = lp(chord, 900 + 500 * np.sin(b * 0.7)) / 12
    a = np.minimum(1, tt / 0.6) * np.minimum(1, (BAR + 1.2 - tt) / 1.0)
    add_i = int(s0 * SR)
    j = min(N, add_i + len(tt))
    pad[add_i:j] += (chord * a)[: j - add_i]
pad *= smooth(0, 1, 1, 0, 1) * np.interp(t_all, [0, 3, 8, 40, 46, 62, 69], [0.5, 0.8, 0.9, 0.9, 1.1, 0.95, 0.5])

# --- kick + sub bass: enter at 7 s with the map, leave at 62 s --------------------
kick = np.zeros(N); sub = np.zeros(N)
KS, KE = 7.0, 62.0
tk = np.arange(int(0.45 * SR)) / SR
kick_one = np.sin(2 * np.pi * (45 * tk + 75 * (1 - np.exp(-tk * 28)) / 28)) * np.exp(-tk * 9)
k = int(KS / BEAT)
while k * BEAT < KE:
    add(kick, k * BEAT, kick_one, 0.95)
    k += 1
for b in range(int(DUR / BAR) + 1):
    s0 = b * BAR
    if s0 < KS - 0.01 or s0 > KE: continue
    root = CHORDS[b % 4][0]
    for off in (0, 1.5 * BEAT, 2 * BEAT, 3.5 * BEAT):
        ts = np.arange(int(BEAT * 1.4 * SR)) / SR
        note = np.sin(2 * np.pi * hz(root) * ts) * env(ts, 0.01, BEAT * 1.0, 3.0)
        add(sub, s0 + off, note, 0.5)
# a faint pulse before the beat arrives
pulse = np.zeros(N)
p = 0
while p * BEAT < KS:
    tp = np.arange(int(0.3 * SR)) / SR
    add(pulse, p * BEAT, np.sin(2 * np.pi * 55 * tp) * np.exp(-tp * 12), 0.25 * (0.3 + 0.7 * p * BEAT / KS))
    p += 1

# --- arpeggio: plucked 16ths that build, brighter and an octave up after the lift -
arp = np.zeros(N)
S16 = BEAT / 4
AS, LIFT = 12.0, 40.0
step = int(AS / S16)
while step * S16 < 64:
    st = step * S16
    b = int(st / BAR)
    root, tones = CHORDS[b % 4]
    pat = [0, 1, 2, 3, 2, 1, 0, 1]
    idx = pat[step % 8]
    notes = tones + [tones[0] + 12]
    m = notes[idx] + (12 if st >= LIFT else 0)
    ta = np.arange(int(0.55 * SR)) / SR
    tone = (np.sin(2 * np.pi * hz(m) * ta) + 0.35 * np.sin(2 * np.pi * hz(m) * 2 * ta) + 0.2 * ((ta * hz(m)) % 1 * 2 - 1)) * env(ta, 0.004, 0.22, 5.0)
    tone = lp(tone, 2600 if st < LIFT else 5200)
    level = np.interp(st, [AS, 26, LIFT, 62, 64], [0.1, 0.5, 0.75, 0.75, 0.0])
    swing = 0.0
    add(arp, st + swing, tone, 0.22 * level)
    step += 1

# --- hats: off-beat from 22 s ------------------------------------------------------
hat = np.zeros(N)
th = np.arange(int(0.07 * SR)) / SR
hat_one = hp(rng.standard_normal(len(th)), 7000) * np.exp(-th * 70)
h = int(22 / (BEAT / 2))
while h * BEAT / 2 < KE:
    if h % 2 == 1: add(hat, h * BEAT / 2, hat_one, 0.28)
    h += 1

# --- a riser into the lift ---------------------------------------------------------
tr = np.arange(int(3.0 * SR)) / SR
noise = hp(rng.standard_normal(len(tr)), 1500) * (tr / 3.0) ** 2.5
riser = np.zeros(N); add(riser, LIFT - 3.0, noise, 0.1)

# --- space: a short synthetic hall on the pad and the arpeggio ---------------------
def reverb(x, seed):
    g = np.random.default_rng(seed)
    n = int(1.6 * SR)
    ir = g.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir = lp(ir, 5000)
    return fftconvolve(x, ir)[: len(x)] * 0.05
wet_l = reverb(pad + arp * 0.9, 1)
wet_r = reverb(pad + arp * 0.9, 2)

dry = kick + sub + pulse + hat + riser
L = dry + pad * 0.55 + arp * 0.85 + wet_l * 1.6
R = dry + pad * 0.55 + arp * 1.0 + wet_r * 1.6

# slow sidechain-ish duck of pad and arp on every kick
duck = np.ones(N)
k = int(KS / BEAT)
while k * BEAT < KE:
    i = int(k * BEAT * SR); j = min(N, i + int(0.28 * SR))
    duck[i:j] = np.minimum(duck[i:j], 0.72 + 0.28 * np.linspace(0, 1, j - i) ** 1.5)
    k += 1
mix = lambda x: x
Lm = (kick + sub + pulse + hat + riser) + (pad * 0.55 + arp * 0.85 + wet_l * 1.6) * duck
Rm = (kick + sub + pulse + hat + riser) + (pad * 0.55 + arp * 1.0 + wet_r * 1.6) * duck

# master: fade in/out, tame the lows, peak to -3 dB
fade = np.minimum(1, t_all / 1.2) * np.minimum(1, (DUR - t_all) / 4.0)
# the arrangement's loudness: hushed for the problem, full for the map, calm to close
arc = np.interp(t_all, [0, 6, 8.5, 20, 38, 42, 60, 64, 69], [0.30, 0.34, 0.62, 0.78, 0.92, 1.0, 1.0, 0.55, 0.30])
out = np.stack([Lm * fade * arc, Rm * fade * arc], axis=1)
out = np.tanh(out * 0.9) / np.tanh(0.9)
out = out / np.max(np.abs(out)) * 0.5
wavfile.write("public/music.wav", SR, (out * 32767).astype(np.int16))
print("wrote public/music.wav", round(DUR, 1), "s")
