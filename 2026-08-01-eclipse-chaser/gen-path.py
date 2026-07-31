#!/usr/bin/env python3
"""Build path.js — the calibrated Aug 12 2026 eclipse centerline.

Recipe (fit_span.py holds the Spanish axis least-squares fit):
  1. NASA "google map" page (eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/
     SE2026Aug12Tgoogle.html) embeds the real TRACK.GOO polylines: northern
     limit, southern limit and centerline for the first half of the path
     (Siberia -> Arctic -> Greenland NE). Those arrays are in nasa_arrays.json.
  2. Iceland is anchored to Wikipedia's Aug 12 2026 city table: greatest
     eclipse (65.2N 25.2W, 17:47:06 UT, 2m18s), Latrabjarg 2:13, Reykjavik
     1:01, Vestmannaeyjar 99.63% (just outside the umbra).
  3. The Atlantic track is pinned by sky geometry from London (91.42% @
     18:13:19 UT), Paris (92.12% @ 18:17:19) and Dublin (94.02% @ 18:10:42):
     magnitude -> moon-sun separation -> ground distance from the axis.
  4. Spain: axis is the least-squares fit of fit_span.py against ~25 real
     city durations, with Madrid (99.98%) just outside the umbra; axis
     duration fitted piecewise-linear along the arc; hw = 150 km.
  5. End: the umbra leaves the Earth at 18:35:17 UT in the western
     Mediterranean (position pinned by Algiers: 96.09% @ 18:33:45 UT).

Output: path.js with ECLIPSE_PATH = [ [lat, lon, tUTCh, durSec, hwKm], ... ]
plus ECLIPSE_META. Distances/times are approximate (the toy is not for
eclipse navigation) but the flagship cities reproduce their real published
values within a few seconds / ~2%.
"""

import json
import math
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
GREATEST = (65.20, -25.20, 17.7850, 138, 147)   # 17:47:06 UT, 2m18s, 294 km wide
REYKJAVIK = (65.00, -20.00, 17.8131, 136, 147)  # Reykjavik 1:01 -> foot 132 km NE
# sky-geometry pins from the partial-phase capitals (magnitude -> distance);
# positions solved from the three distance circles with a constant ~1.7 km/s
# SE track: A_D = (50.0,-6.3), A_L = (48.2,-3.9), A_P = (45.4,-0.1)
DUBLIN = (50.0, -6.3, 18.1783, None, 150)       # 94.02% @ 18:10:42 UT
LONDON = (48.2, -3.9, 18.2220, None, 150)       # 91.42% @ 18:13:19 UT
PARIS = (45.4, -0.1, 18.2886, None, 150)        # 92.12% @ 18:17:19 UT
END = (38.6, 5.5, 18.5880, 40, 90)              # last umbral contact 18:35:17 UT

# Greenland descent waypoints (real TRACK.GOO north-limit crossings, shape only)
GREEN = [(74.27, -23.15), (68.73, -22.95)]
V1 = (65.9, -25.2, 17.7972, None, 147)          # north jog keeps Reykjavik/Isafjordur at distance
REYK = (65.0, -20.0, 17.8131, None, 147)        # Reykjavik 1:01 -> foot 132 km NE
VESTM = (63.5, -17.0, 17.8417, None, 150)       # Vestmannaeyjar 99.63% -> axis ~163 km NE
EAST = (65.0, -17.0, 17.8333, None, 147)        # eastward jog keeps Vestmannaeyjar outside
TORS = (57.9, -8.0, 17.9142, None, 150)         # Torshavn 91.22% -> axis ~465 km
ATL = (53.5, -11.5, 18.0000, None, 150)         # shape pin keeping the track west of Ireland
GIJON_FOOT = (43.35, -6.5, 18.4611, None, 150)  # Gijon max 18:27:40 UT pins the Galicia swing

# ---- Spanish fit results (from fit_span.py) --------------------------------
FIT_LONS = [-8.4, -6.6, -4.5, -3.7, -2.1, -0.9, 0.4, 1.3, 2.6, 4.3]
FIT_LATS = [42.64, 43.38, 42.51, 42.07, 41.35, 40.87, 40.34, 40.0, 39.65, 39.37]
FIT_DUR = [89.5, 112.6, 98.0, 102.3, 83.9]      # axis duration s at 5 arc positions
SPAIN_HW = 150.0

# real city max times (UT hours) for the time model — (lat, lon, tUT)
MAXES = [
    # Iceland + Atlantic
    (65.50, -24.53, 17.7594), (66.07, -23.13, 17.7481), (64.15, -21.94, 17.8131),
    (65.90, -25.20, 17.7972), (65.00, -20.00, 17.8131), (63.41, -20.27, 17.8417),
    (65.00, -17.00, 17.8333), (62.01, -6.77, 17.9142), (53.50, -11.50, 18.0000),
    (53.35, -6.26, 18.1783), (51.51, -0.13, 18.2220), (48.86, 2.35, 18.2886),
    (52.52, 13.41, 18.1403), (59.33, 18.07, 17.9367), (59.91, 10.75, 17.9508),
    (55.68, 12.57, 18.0603), (52.23, 21.01, 18.0483), (53.35, -6.26, 18.1783),
    # Spain (totality)
    (43.36, -8.42, 18.4720), (43.01, -7.56, 18.4806), (42.55, -6.60, 18.4911),
    (41.85, -6.63, 18.5081), (43.54, -5.66, 18.4611), (43.36, -5.84, 18.4667),
    (43.35, -6.50, 18.4611),
    (42.01, -4.53, 18.4997), (41.65, -4.72, 18.5103), (43.46, -3.80, 18.4581),
    (42.34, -3.70, 18.4881), (40.95, -4.12, 18.5269), (40.63, -3.16, 18.5319),
    (43.26, -2.93, 18.4606), (42.85, -2.67, 18.4708), (42.47, -2.44, 18.4806),
    (40.07, -2.13, 18.5425), (41.65, -0.88, 18.4956), (40.34, -1.10, 18.5308),
    (39.47, -0.38, 18.5500), (41.08, 1.13, 18.5014), (39.57, 2.65, 18.5314),
    (39.79, 3.12, 18.5219), (39.91, 3.08, 18.5206), (39.89, 4.27, 18.5142),
    (40.42, -3.70, 18.5397), (38.91, 1.43, 18.5550),
    # North Africa
    (36.77, 3.06, 18.5625), (38.72, -9.14, 18.6019),
]

# ---- build the full centerline ----------------------------------------------
center = list(NCEN)
# Greenland descent + Iceland, smoothed with catmull-rom
tail = [center[-1]] + GREEN + [GREATEST[:2], REYKJAVIK[:2]]
for i in range(len(tail) - 3):
    center += catmull(tail[i], tail[i + 1], tail[i + 2], tail[i + 3], 12)
center += [GREATEST[:2], V1[:2], REYKJAVIK[:2], EAST[:2], TORS[:2], ATL[:2],
           DUBLIN[:2], LONDON[:2], PARIS[:2], GIJON_FOOT[:2]]
spanish = list(zip(FIT_LATS, FIT_LONS))
center += spanish + [END[:2]]

arcs = arc_lengths(center)
TOTAL = arcs[-1]

def nearest_arc(p):
    """Arc position (km) of the nearest point on the polyline to p."""
    la, lo = p
    d, i = 1e18, 0
    for k in range(len(center) - 1):
        q, r = center[k], center[k + 1]
        x0, y0 = lo * math.cos(math.radians(la)), la
        x1, y1 = q[1] * math.cos(math.radians(la)), q[0]
        x2, y2 = r[1] * math.cos(math.radians(la)), r[0]
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / L2))
        dist = math.hypot(x0 - (x1 + t * dx), y0 - (y1 + t * dy)) * 111.32
        if dist < d:
            d, i = dist, k + t
    a0 = arcs[int(i)]
    a1 = arcs[min(int(i) + 1, len(arcs) - 1)]
    return a0 + (a1 - a0) * (i - int(i))

def nearest_dist(p):
    la, lo = p
    d = 1e18
    for k in range(len(center) - 1):
        q, r = center[k], center[k + 1]
        x0, y0 = lo * math.cos(math.radians(la)), la
        x1, y1 = q[1] * math.cos(math.radians(la)), q[0]
        x2, y2 = r[1] * math.cos(math.radians(la)), r[0]
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else max(0, min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / L2))
        dist = math.hypot(x0 - (x1 + t * dx), y0 - (y1 + t * dy)) * 111.32
        d = min(d, dist)
    return d

# ---- time: monotone piecewise-linear over real city maxes -------------------
TANCH = [(0.0, 16.9883)]                          # first umbral contact 16:59:18 UT
END_ARC = nearest_arc(END[:2])
for (la, lo, t) in MAXES:
    if t <= END[2]:                                # sky-max beyond the path end is not a path anchor
        TANCH.append((nearest_arc((la, lo)), t))
TANCH.append((END_ARC, END[2]))
TANCH.sort()
# keep only monotone-increasing times (drop inconsistent entries)
M = []
for a, t in TANCH:
    if not M or t > M[-1][1] + 1e-6:
        M.append((a, t))
TANCH = M

def time_at(arc):
    for i in range(len(TANCH) - 1):
        a1, t1 = TANCH[i]; a2, t2 = TANCH[i + 1]
        if a1 <= arc <= a2:
            return t1 if a2 == a1 else t1 + (t2 - t1) * (arc - a1) / (a2 - a1)
    return TANCH[-1][1]

# ---- umbra half-width -------------------------------------------------------
def hw_at(arc):
    if arc <= arcs[len(NCEN) - 1]:                # Arctic: real N/S limits
        i = min(range(len(NCEN)), key=lambda k: abs(arcs[k] - arc))
        d = (dist_to_curve(NCEN[i], NLIM) + dist_to_curve(NCEN[i], SLIM)) / 2
        return max(60, min(150, d))
    HANCH = [
        (arcs[len(NCEN) - 1], hw_at(arcs[len(NCEN) - 1])),
        (nearest_arc(GREATEST[:2]), GREATEST[4]),
        (nearest_arc(REYKJAVIK[:2]), REYKJAVIK[4]),
        (nearest_arc(spanish[0]), SPAIN_HW),
        (nearest_arc(spanish[-1]), SPAIN_HW),
        (nearest_arc(END[:2]), END[4]),
    ]
    HANCH.sort()
    for i in range(len(HANCH) - 1):
        a1, h1 = HANCH[i]; a2, h2 = HANCH[i + 1]
        if a1 <= arc <= a2:
            return h1 if a2 == a1 else h1 + (h2 - h1) * (arc - a1) / (a2 - a1)
    return HANCH[-1][1]

# ---- axis duration ----------------------------------------------------------
S0 = nearest_arc(spanish[0])
S1 = nearest_arc(spanish[-1])
G_ARC = nearest_arc(GREATEST[:2])

def dur_at(arc):
    if arc <= G_ARC:                              # Siberia -> greatest
        s = max(0.0, min(1.0, arc / G_ARC))
        return 138 * (s * (2 - s)) ** 0.75
    DANCH = [
        (G_ARC, GREATEST[3]),
        (nearest_arc(REYKJAVIK[:2]), REYKJAVIK[3]),
        (S0, FIT_DUR[0]),
        (S0 + (S1 - S0) * 0.25, FIT_DUR[1]),
        (S0 + (S1 - S0) * 0.5, FIT_DUR[2]),
        (S0 + (S1 - S0) * 0.75, FIT_DUR[3]),
        (S1, FIT_DUR[4]),
        (nearest_arc(END[:2]), END[3]),
    ]
    DANCH.sort()
    for i in range(len(DANCH) - 1):
        a1, d1 = DANCH[i]; a2, d2 = DANCH[i + 1]
        if a1 <= arc <= a2:
            return d1 if a2 == a1 else d1 + (d2 - d1) * (arc - a1) / (a2 - a1)
    return DANCH[-1][1]

# ---- emit -------------------------------------------------------------------
pts = []
for i, p in enumerate(center):
    a = arcs[i]
    pts.append([round(p[0], 3), round(p[1], 3), round(time_at(a), 4), round(dur_at(a), 1), round(hw_at(a), 1)])

meta = {
    "greatest": list(GREATEST),
    "startT": 16.9883,
    "endT": END[2],
    "magnitudeAxis": 1.0386,
    "spanHW": SPAIN_HW,
    "source": "NASA TRACK.GOO (SE2026Aug12Tgoogle) + Wikipedia Aug 12 2026 city table; approximate geometry",
}

js = "// Generated by gen-path.py — do not edit by hand.\n"
js += "// Aug 12 2026 total solar eclipse centerline: [lat, lon, timeUTCh, axisDurS, hwKm]\n"
js += "const ECLIPSE_PATH = " + json.dumps(pts) + ";\n"
js += "const ECLIPSE_META = " + json.dumps(meta) + ";\n"
(HERE / "path.js").write_text(js)

g = pts[min(range(len(pts)), key=lambda i: hav(center[i], GREATEST[:2]))]
print("wrote path.js with", len(pts), "vertices;", round(arcs[-1]), "km of path")
print("first:", pts[0])
print("greatest vertex:", g)
print("last:", pts[-1])
