"""Desenha os ícones do app (icon-180.png, icon-192.png, icon-512.png): um "C" de Controle feito como uma
incisão com pontos de sutura, sobre o ameixa do app. Só é preciso rodar se o ícone mudar. Precisa do Pillow.
Uso: python3 ferramentas/icones.py"""
import math, os
from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def icone(tamanho, topo=(140, 76, 160), base=(104, 50, 124), traco=(255, 255, 255)):
    S = 2048
    im = Image.new('RGB', (S, S), topo)
    d = ImageDraw.Draw(im)
    for y in range(S):  # degradê suave de cima para baixo
        t = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(round(topo[i] + (base[i] - topo[i]) * t) for i in range(3)))
    cx, cy, R, w = S / 2 + 46, S / 2, 540, 96   # o arco do "C"
    a0, a1, n, L, sw = 48, 312, 7, 170, 56      # abertura à direita; 7 pontos curtos
    d.arc([cx - R, cy - R, cx + R, cy + R], a0, a1, fill=traco, width=w)
    rr = R - w / 2
    for a in (a0, a1):  # pontas arredondadas
        x, y = cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a))
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=traco)
    for i in range(n):  # pontos cruzando a incisão
        ra = math.radians(a0 + (a1 - a0) * (i + 0.5) / n)
        mx, my = cx + rr * math.cos(ra), cy + rr * math.sin(ra)
        dx, dy = math.cos(ra) * L / 2, math.sin(ra) * L / 2
        d.line([mx - dx, my - dy, mx + dx, my + dy], fill=traco, width=sw)
        for px, py in ((mx - dx, my - dy), (mx + dx, my + dy)):
            d.ellipse([px - sw / 2, py - sw / 2, px + sw / 2, py + sw / 2], fill=traco)
    return im.resize((tamanho, tamanho), Image.LANCZOS)

for n in (180, 192, 512):
    icone(n).save(os.path.join(RAIZ, f'icon-{n}.png'), optimize=True)
print('ícones prontos')
