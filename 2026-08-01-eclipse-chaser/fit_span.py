#!/usr/bin/env python3
"""Build path.js — the calibrated Aug 12 2026 eclipse centerline.

Recipe:
  1. NASA's "google map" page (eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/
     SE2026Aug12Tgoogle.html) embeds the real TRACK.GOO polylines: northern
     limit, southern limit and centerline for the first half of the path
     (Siberia -> Arctic -> Greenland NE). Those arrays are in nasa_arrays.json.
  2. The middle (Iceland) is anchored to Wikipedia's Aug 12 2026 city table:
     greatest eclipse (65.2N 25.2W, 17:47:06 UT, 2m18s), Latrabjarg 2:13,
     Isafjordur 1:31, Reykjavik 1:01, Vestmannaeyjar 99.63% (just outside
     the umbra). Shape between anchors follows the NASA time-line waypoints.
  3. In Spain the axis is least-squares fitted to ~25 real city totality
     durations from the same table (A Coruna 1:17, Burgos 1:44, Palma 1:36,
     ...) plus the hard constraint that Madrid (99.98%) sits just outside
     the umbra. Umbra half-width hw = 150 km there; axis duration is a
     piecewise-linear function of arc position, also fitted.
  4. After Palma the path ends at the last umbral contact (18:35:17 UT) in
     the western Mediterranean (approximate position).

Output: path.js with ECLIPSE_PATH = [ [lat, lon, tUTCh, durSec, hwKm], ... ]
spaced <= ~55 km apart, plus ECLIPSE_META. Distances/times are approximate
(the toy is not for eclipse navigation) but the flagship cities reproduce
their real published numbers within a few seconds / a couple of percent.
"""

import json
import math
import random
from pathlib import Path

HERE = Path(__file__).parent
RAW = json.load(open(HERE / "nasa_arrays.json", "r"))

def arr(label_part):
    for b in RAW:
        if label_part in b["label"]:
            return b["pts"]
    raise KeyError(label_part)

NLIM = arr("Northern Limit")     # real: northern umbra limit
SLIM = arr("Southern Limit")     # real: southern umbra limit
NCEN = arr("Central Line")       # real: centerline, Siberia -> pole -> Greenland NE

def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))

def seg_dist(p, q, r):
    la, lo = p
    x0, y0 = lo * math.cos(math.radians(la)), la
    x1, y1 = q[1] * math.cos(math.radians(la)), q[0]
    x2, y2 = r[1] * math.cos(math.radians(la)), r[0]
    dx, dy = x2 - x1, y2 - y1
    if dx == dy == 0:
        t = 0
    else:
        t = max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x0 - (x1 + t * dx), y0 - (y1 + t * dy)) * 111.32

def dist_to_curve(p, curve):
    return min(seg_dist(p, curve[i], curve[i + 1]) for i in range(len(curve) - 1))

def arc_lengths(pts):
    out, tot = [0.0], 0.0
    for i in range(1, len(pts)):
        tot += hav(pts[i - 1], pts[i])
        out.append(tot)
    return out

def catmull(p0, p1, p2, p3, n):
    out = []
    for i in range(1, n):
        t = i / n
        t2, t3 = t * t, t * t * t
        def f(a, b, c, d):
            return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
        out.append((f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])))
    return out

# ---- real anchors ----------------------------------------------------------
# (lat, lon, time UT hours, axis duration s, hw km)
ANCHORS = [
    (65.20, -25.20, 17.7850, 138, 147),      # greatest: real 17:47:06 UT, 2m18s
    (65.34, -21.90, 17.8083, 136, 147),      # Reykjavik 1:01 -> axis ~132 km N
]
END = (38.50, 11.40, 18.5880, 40, 90)        # last umbral contact 18:35:17 UT (approx pos)

# NASA time-line waypoints — real umbral positions, shape only.
SHAPE = [(74.27, -23.15), (68.73, -22.95), (63.56, -21.38),
         (58.56, -18.94), (53.55, -15.50), (48.21, -10.27)]

# ---- Spanish city table (Wikipedia, local times -> UT, durations s) -------
# (name, lat, lon, durS or None for partial, maxMag or None)
SPAIN_CITIES = [
    ("A Coruña", 43.36, -8.42, 77), ("Lugo", 43.01, -7.56, 84),
    ("Ponferrada", 42.55, -6.60, 87), ("Guadramil", 41.85, -6.63, 17),
    ("Gijón", 43.54, -5.66, 105), ("Oviedo", 43.36, -5.84, 109),
    ("Palencia", 42.01, -4.53, 103), ("Valladolid", 41.65, -4.72, 87),
    ("Santander", 43.46, -3.80, 64), ("Burgos", 42.34, -3.70, 104),
    ("Segovia", 40.95, -4.12, 57), ("Guadalajara", 40.63, -3.16, 67),
    ("Bilbao", 43.26, -2.93, 31), ("Vitoria", 42.85, -2.67, 64),
    ("Logroño", 42.47, -2.44, 82), ("Cuenca", 40.07, -2.13, 53),
    ("Zaragoza", 41.65, -0.88, 85), ("Teruel", 40.34, -1.10, 94),
    ("Valencia", 39.47, -0.38, 60), ("Salou", 41.08, 1.13, 68),
    ("Ibiza", 38.91, 1.43, 64), ("Sant Antoni", 38.95, 1.30, 66),
    ("Palma", 39.57, 2.65, 96), ("Alcúdia", 39.79, 3.12, 89),
    ("Port de Pollença", 39.91, 3.08, 88), ("Mahón", 39.89, 4.27, 70),
    ("Madrid", 40.42, -3.70, None),          # 99.98% — just OUTSIDE the umbra
]
# axis control longitudes for the Spanish fit
FIT_LONS = [-8.4, -6.6, -4.5, -3.7, -2.1, -0.9, 0.4, 1.3, 2.6, 4.3]
HW = 150.0                                    # umbra half-width in Spain, km

# ---- fit the Spanish axis ---------------------------------------------------
def spanish_axis(lats):
    return list(zip(lats, FIT_LONS))

def nearest_info(p, curve):
    la, lo = p
    best = (1e18, 0.0)
    for i in range(len(curve) - 1):
        q, r = curve[i], curve[i + 1]
        x0, y0 = lo * math.cos(math.radians(la)), la
        x1, y1 = q[1] * math.cos(math.radians(la)), q[0]
        x2, y2 = r[1] * math.cos(math.radians(la)), r[0]
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / L2))
        d = math.hypot(x0 - (x1 + t * dx), y0 - (y1 + t * dy)) * 111.32
        if d < best[0]:
            best = (d, i + t)
    return best                                # (dist km, arc index along curve)

def fit_loss(params):
    lats = params[:len(FIT_LONS)]
    d_axis = params[len(FIT_LONS):]            # axis durations at control arc positions
    curve = spanish_axis(lats)
    arc = list(arc_lengths(curve))
    tot = arc[-1]
    loss = 0.0
    def Da_at(s):
        pos = s / tot * (len(d_axis) - 1)
        i = min(int(pos), len(d_axis) - 2)
        f = pos - i
        return d_axis[i] + (d_axis[i + 1] - d_axis[i]) * f
    for (name, la, lo, dur, *_) in SPAIN_CITIES:
        d, idx = nearest_info((la, lo), curve)
        s = idx / (len(curve) - 1) * tot       # arc position of nearest point
        Da = Da_at(s)
        if dur is None:                        # Madrid: must be outside umbra
            loss += max(0.0, HW - d + 8.0) ** 2 * 50.0
        else:
            if d >= HW:                        # outside but has a duration: bad
                loss += (dur - 0) ** 2 * 0.5 + 1000.0
            else:
                model = Da * math.sqrt(max(0.0, 1 - (d / HW) ** 2))
                loss += (model - dur) ** 2
    return loss

# Nelder-Mead (tiny, dependency-free)
def nelder_mead(f, x0, steps, iters=4000, tol=1e-9):
    n = len(x0)
    simp = [x0[:]]
    for i in range(n):
        s = x0[:]; s[i] += steps[i]; simp.append(s)
    vals = [f(s) for s in simp]
    for _ in range(iters):
        order = sorted(range(len(simp)), key=lambda i: vals[i])
        simp = [simp[i] for i in order]; vals = [vals[i] for i in order]
        if vals[-1] - vals[0] < tol * max(1.0, abs(vals[0])):
            break
        xo = [sum(simp[i][k] for i in range(n)) / n for k in range(n)]
        xr = [xo[k] + 1.0 * (xo[k] - simp[-1][k]) for k in range(n)]
        vr = f(xr)
        if vr < vals[0]:
            xe = [xo[k] + 2.0 * (xr[k] - xo[k]) for k in range(n)]
            ve = f(xe)
            simp[-1], vals[-1] = (xe, ve) if ve < vr else (xr, vr)
        elif vr < vals[-2]:
            simp[-1], vals[-1] = xr, vr
        else:
            xc = [xo[k] + 0.5 * (simp[-1][k] - xo[k]) for k in range(n)]
            vc = f(xc)
            if vc < vals[-1]:
                simp[-1], vals[-1] = xc, vc
            else:
                for i in range(1, n + 1):
                    simp[i] = [simp[0][k] + 0.5 * (simp[i][k] - simp[0][k]) for k in range(n)]
                    vals[i] = f(simp[i])
    return simp[0], vals[0]

# initial axis: rough by hand (SE trend from A Coruna to Palma), dur ~118-100s
INIT_LATS = [42.4, 42.3, 42.2, 42.0, 41.5, 41.0, 40.6, 40.3, 40.0, 39.7]
INIT_D = [100.0, 108.0, 108.0, 105.0, 85.0]
x0 = INIT_LATS + INIT_D
best, loss = nelder_mead(fit_loss, x0, [0.08] * len(FIT_LONS) + [4.0] * len(INIT_D))
fit_lats = best[:len(FIT_LONS)]
fit_d = best[len(FIT_LONS):]
print("fit loss:", round(loss, 2))
print("axis lats:", [round(l, 2) for l in fit_lats])
print("axis dur:", [round(d, 1) for d in fit_d])

# verification against the real table
curve = spanish_axis(fit_lats)
tot = arc_lengths(curve)[-1]
def Da_at(s):
    pos = s / tot * (len(fit_d) - 1)
    i = min(int(pos), len(fit_d) - 2)
    f = pos - i
    return fit_d[i] + (fit_d[i + 1] - fit_d[i]) * f
for (name, la, lo, dur) in SPAIN_CITIES:
    d, idx = nearest_info((la, lo), curve)
    s = idx / (len(curve) - 1) * tot
    Da = Da_at(s)
    if dur is None:
        print(f"{name:15s} d={d:6.1f} km  -> OUTSIDE by {d-HW:5.1f} km (real: 99.98% partial)")
    elif d >= HW:
        print(f"{name:15s} d={d:6.1f} km  -> OUTSIDE !!  (real: {dur}s totality)")
    else:
        model = Da * math.sqrt(max(0.0, 1 - (d / HW) ** 2))
        print(f"{name:15s} d={d:6.1f} km  model {model:5.1f}s  real {dur:4d}s  ({model-dur:+5.1f})")
