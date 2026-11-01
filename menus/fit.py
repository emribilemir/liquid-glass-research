# Fits a Chromium-doable menu glass (blur -> inward displacement -> linear tone + edge highlight) to the native
# macOS 27 NSMenu captured over 45-degree stripes (refrlab). All in device px (2x).
# Usage: python3 fit.py <menu.png> <background.png> [order=bd|db] [cap]   (RN=<pt> env: how far before a corner the
# bend starts turning; 40 fitted best). Captures: research/menus/native-stripes-{menu,background}.png (refrlab, 2x).
import sys, json
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates, binary_dilation
from scipy.optimize import least_squares

menu = np.asarray(Image.open(sys.argv[1]).convert('L')).astype(float)
bg = np.asarray(Image.open(sys.argv[2]).convert('L')).astype(float)
order = sys.argv[3] if len(sys.argv) > 3 else 'bd'
X0, Y0, X1, Y1 = 301, 267, 655, 715          # outer hairline box, inclusive
W, H = X1 - X0 + 1, Y1 - Y0 + 1
K = 2.0                                       # device px per pt
R = 13 * K                                    # corner radius
M = menu[Y0:Y1 + 1, X0:X1 + 1]
B = bg[Y0:Y1 + 1, X0:X1 + 1]

# Distance to the rounded-rect edge (px, >= 0 inside) and the inward normal. The normal comes from a rounded rect
# with a larger radius RN so it turns smoothly in the corners (no seam on the diagonal).
yy, xx = np.mgrid[0:H, 0:W] + 0.5
def sdf(r):
    qx = np.abs(xx - W / 2) - (W / 2 - r); qy = np.abs(yy - H / 2) - (H / 2 - r)
    out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return -out
dist = sdf(R)
import os; RN = float(os.environ.get("RN", 30)) * K
cx = np.clip(xx, RN, W - RN); cy = np.clip(yy, RN, H - RN)
nx, ny = cx - xx, cy - yy; nl = np.hypot(nx, ny); nl[nl == 0] = 1
# inside the inner rect of RN the nearest edge decides
inner = (xx > RN) & (xx < W - RN) & (yy > RN) & (yy < H - RN)
dl, dr, dt, db_ = xx, W - xx, yy, H - yy
mn = np.minimum.reduce([dl, dr, dt, db_])
nx = np.where(inner, np.select([mn == dl, mn == dr], [1.0, -1.0], 0.0), nx / nl)
ny = np.where(inner, np.select([mn == dt, mn == db_], [1.0, -1.0], 0.0), ny / nl)
# which edge is nearest (for per-edge strength): top/bottom vs sides
vert = np.abs(ny) > np.abs(nx)
top = vert & (yy < H / 2)

# Mask: drop text and separators (bright), the 3px rim band, and pixels outside the shape.
text = M > 200
text = binary_dilation(text, iterations=5)
mask = (~text) & (dist > 2.5)
print('fit pixels', mask.sum(), 'of', W * H)

KN = np.array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 18, 22, 27, 32]) * K   # knots, px from edge

def shift_at(d, vals):
    return np.interp(d, KN, np.concatenate([vals, [0.0]]))

def render(p):
    sigma, k, sd, ht, hb, htau, topk = p[:7]; a, b = .611, 38.7
    vals = np.cumsum(p[7:][::-1])[::-1] * K
    s = shift_at(dist, vals) * np.where(top, topk, 1.0)
    sx, sy = xx - 0.5 + s * nx, yy - 0.5 + s * ny
    if order == 'bd':
        soft = gaussian_filter(B, sigma * K, mode='nearest')
        core = map_coordinates(soft, [sy, sx], order=1, mode='nearest')
    else:
        core = map_coordinates(B, [sy, sx], order=1, mode='nearest')
        core = gaussian_filter(core, sigma * K, mode='nearest')
    if k > 0: core = (1 - k) * core + k * np.minimum(core, gaussian_filter(core, sd * K, mode='nearest'))
    hl = np.where(top, ht, hb) * np.exp(-dist / (htau * K)) * vert
    return a * core + b + hl

def resid(p):
    return (render(p) - M)[mask] / 255

prof = np.array([22, 21, 20, 18, 15, 12.5, 10, 8, 6.5, 5.5, 4, 3, 2.5, 2, 1.5, 1.2, 1, .5]) * (min(1, (float(sys.argv[4]) if len(sys.argv) > 4 else 60) / 30))
p0 = np.concatenate([[8, .3, 6, 20, 10, 2.5, 1.2], np.maximum(1e-3, -np.diff(np.concatenate([prof, [0]])))])
lo = np.concatenate([[1, 0, .5, -40, -40, .3, .5], np.zeros(18)])
cap = float(sys.argv[4]) if len(sys.argv) > 4 else 60
hi = np.concatenate([[30, 1, 30, 120, 120, 10, 3], np.full(18, cap / 4)])
r = least_squares(resid, p0, bounds=(lo, hi), diff_step=1e-3, max_nfev=400)
p = r.x
rms = np.sqrt(np.mean(r.fun ** 2)) * 255
print('order', order, 'rms', round(rms, 2))
print('sigma(pt) %.2f  darken k %.3f sd(pt) %.1f  hl top %.1f bottom %.1f tau(pt) %.2f  top x%.2f' % tuple(p[:7]))
print('shift(pt) at', (KN / K).tolist())
print('  ', [round(float(v), 2) for v in np.cumsum(p[7:][::-1])[::-1]] + [0])
# per-region residual
fit = render(p)
corner = (np.minimum(xx, W - xx) < 30 * K) & (np.minimum(yy, H - yy) < 30 * K)
trbl = corner & (((xx > W / 2) & (yy < H / 2)) | ((xx < W / 2) & (yy > H / 2)))
for name, sel in [('TR+BL corners', mask & trbl), ('top band', mask & top & (dist < 30 * K)), ('bottom band', mask & vert & ~top & (dist < 30 * K)), ('sides', mask & ~vert & (dist < 30 * K)), ('centre', mask & (dist >= 30 * K))]:
    print(name, round(np.sqrt(np.mean((fit - M)[sel] ** 2)), 2))
json.dump({'order': order, 'p': p.tolist(), 'knots_pt': (KN / K).tolist(), 'rms': rms}, open(f'fitT{os.environ.get("RN",30)}-{order}-{sys.argv[4] if len(sys.argv) > 4 else 60}.json', 'w'))
out = np.clip(fit, 0, 255)
out[~(dist > 0)] = B[~(dist > 0)]
Image.fromarray(np.hstack([M, out, np.abs(out - M) * 2]).clip(0, 255).astype(np.uint8)).save(f'fitT{os.environ.get("RN",30)}-{order}-{sys.argv[4] if len(sys.argv) > 4 else 60}.png')
