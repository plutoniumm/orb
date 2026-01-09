from urllib.request import urlretrieve
from jplephem.spk import SPK
import json, os

EPHEMERIS_URL = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp"
EPHEMERIS_FILE = "./data/de440.bsp"
OUTPUT_FILE = "./data/planets.json"

SUN = 10
PLANETS = {
    "mercury": 1,
    "venus": 2,
    "earth": 3,
    "mars": 4,
    "jupiter": 5,
    "saturn": 6,
    "uranus": 7,
    "neptune": 8,
}

EPOCH_JD = 2460000.5  # ~2023-02-25

if not os.path.exists(EPHEMERIS_FILE):
    urlretrieve(EPHEMERIS_URL, EPHEMERIS_FILE)
kernel = SPK.open(EPHEMERIS_FILE)

data = {
    "epoch_jd": EPOCH_JD,
    "frame": "heliocentric ecliptic",
    "units": {
        "position": "AU",
        "velocity": "AU/day"
    },
    "planets": {}
}

SSB = 0

for name, pid in PLANETS.items():
    p_pos, p_vel = kernel[SSB, pid].compute_and_differentiate(EPOCH_JD)
    s_pos, s_vel = kernel[SSB, SUN].compute_and_differentiate(EPOCH_JD)

    pos = p_pos - s_pos
    vel = p_vel - s_vel

    data["planets"][name] = {
        "pos": [float(pos[0]), float(pos[1])],
        "vel": [float(vel[0]), float(vel[1])]
    }

maxPos = 0.0
for planet in data["planets"].values():
    vx, vy = planet["pos"]
    maxPos = max(maxPos, abs(vx), abs(vy))

vel_scale = (10.0 / maxPos) if maxPos else 0.0
for planet in data["planets"].values():
    vx, vy = planet["vel"]
    px, py = planet["pos"]

    planet["vel"] = [vx * vel_scale, vy * vel_scale]
    planet["pos"] = [px * vel_scale, py * vel_scale]

    # round to 5 decimal places
    planet["vel"] = [round(v, 5) for v in planet["vel"]]
    planet["pos"] = [round(p, 5) for p in planet["pos"]]

data["scale_factor"] = vel_scale
with open(OUTPUT_FILE, "w") as f:
    json.dump(data, f, indent=2)
