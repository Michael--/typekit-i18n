#!/usr/bin/env python3
# Build a compact monthly Linke TL grid with custom latitude range.
# pip install pvlib numpy pandas tqdm

import struct
import numpy as np
import pandas as pd
from tqdm import tqdm
from pvlib.clearsky import lookup_linke_turbidity

# --- CONFIG ---
LAT_MIN = -65.0   # inclusive domain
LAT_MAX = +65.0   # inclusive domain
DLAT    = 1.0
LON_MIN = -180.0
LON_MAX = +180.0
DLON    = 1.0
SCALE   = 20      # store as uint8: round(TL * SCALE)
OUTFILE = "./dist/tl_1deg_uint8.bin"

def centers(vmin, vmax, dv):
    """Return grid cell centers from [vmin, vmax) with spacing dv."""
    n = int(round((vmax - vmin) / dv))
    return np.linspace(vmin + dv/2.0, vmax - dv/2.0, n), n

def lt_lookup(months, lat, lon):
    """Robust wrapper for pvlib's lookup_linke_turbidity across versions."""
    try:
        # Newer pvlib: named args are 'latitude'/'longitude'
        return lookup_linke_turbidity(months, latitude=float(lat), longitude=float(lon))
    except TypeError:
        # Older pvlib: positional args (times, latitude, longitude)
        return lookup_linke_turbidity(months, float(lat), float(lon))

def build_grid():
    lats, nlat = centers(LAT_MIN, LAT_MAX, DLAT)   # e.g. -64.5 .. +64.5
    lons, nlon = centers(LON_MIN, LON_MAX, DLON)   # e.g. -179.5 .. +179.5
    months = pd.date_range("2000-01-01", periods=12, freq="MS", tz="UTC")

    out = np.zeros((12, nlat, nlon), dtype=np.uint8)

    # Progress over latitude rows for visible feedback
    for i, lat in enumerate(tqdm(lats, desc="Rows (lat)")):
        for j, lon in enumerate(lons):
            # pvlib returns a monthly TL climatology (pandas Series/Index=months)
            tl = lt_lookup(months, lat, lon).to_numpy()
            v = np.rint(np.clip(tl * SCALE, 0, 255)).astype(np.uint8)
            out[:, i, j] = v

    meta = {
        "nlat": nlat, "nlon": nlon,
        "lat0": float(lats[0]), "lon0": float(lons[0]),
        "dlat": DLAT, "dlon": DLON,
        "scale": SCALE
    }
    return out, meta

def write_bin(path, arr, meta):
    """
    Header "TLB2":
      magic(4)="TLB2", version(uint16)=2,
      nlat(uint16), nlon(uint16),
      scale(uint8), reserved(uint8)=0,
      lat0(float32 LE), lon0(float32 LE), dlat(float32 LE), dlon(float32 LE),
      payload: 12 * nlat * nlon bytes (month-major, m=0..11)
    """
    magic = b"TLB2"
    header  = bytearray()
    header += magic
    header += struct.pack("<H", 2)
    header += struct.pack("<H", meta["nlat"])
    header += struct.pack("<H", meta["nlon"])
    header += struct.pack("<B", meta["scale"])
    header += struct.pack("<B", 0)  # reserved
    header += struct.pack("<ffff", meta["lat0"], meta["lon0"], meta["dlat"], meta["dlon"])

    with open(path, "wb") as f:
        f.write(header)
        f.write(arr.tobytes(order="C"))

if __name__ == "__main__":
    grid, meta = build_grid()
    write_bin(OUTFILE, grid, meta)
    print(f"Wrote {OUTFILE} with {meta['nlat']} x {meta['nlon']} cells; "
          f"lat0={meta['lat0']} dlat={meta['dlat']} lon0={meta['lon0']} dlon={meta['dlon']}")
