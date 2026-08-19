const EPS = 1e-4;

export function cargoOrientations(l, w, h, allowFlip) {
  const raw = allowFlip
    ? [
        [l, w, h],
        [l, h, w],
        [w, l, h],
        [w, h, l],
        [h, l, w],
        [h, w, l],
      ]
    : [
        [l, w, h],
        [w, l, h],
      ];
  const seen = new Set();
  const out = [];
  for (const [a, b, c] of raw) {
    const key = `${a}x${b}x${c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ l: a, w: b, h: c });
  }
  return out;
}

const layerCache = new WeakMap();

function contourLayers(pallet) {
  const cached = layerCache.get(pallet);
  if (cached) return cached;
  const pts = Array.isArray(pallet.pointCoordinate) ? pallet.pointCoordinate : [];
  const byZ = new Map();
  for (const point of pts) {
    const z = Number(point[2]);
    if (!Number.isFinite(z)) continue;
    if (!byZ.has(z)) byZ.set(z, []);
    byZ.get(z).push([Number(point[0]), Number(point[1]), z]);
  }
  let layers = [...byZ.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([z, points]) => ({ z, ...aabbOf(points) }));
  if (!layers.length) {
    const dx = Number(pallet.baseOuterLengthCm) || 0;
    const dy = Number(pallet.baseOuterWidthCm) || 0;
    layers = [{ z: 0, x: 0, y: 0, x2: dx, y2: dy }];
  }
  layerCache.set(pallet, layers);
  return layers;
}

function aabbOf(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sliceAABB(pallet, z) {
  const layers = contourLayers(pallet);
  if (z <= layers[0].z + EPS) return { ...layers[0] };
  const last = layers[layers.length - 1];
  if (z >= last.z - EPS) return { ...last };
  for (let i = 0; i < layers.length - 1; i += 1) {
    const a = layers[i];
    const b = layers[i + 1];
    if (z >= a.z - EPS && z <= b.z + EPS) {
      const t = (z - a.z) / (b.z - a.z || 1);
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        x2: lerp(a.x2, b.x2, t),
        y2: lerp(a.y2, b.y2, t),
      };
    }
  }
  return { ...last };
}

function intersectAABB(a, b) {
  return {
    x: Math.max(a.x, b.x),
    y: Math.max(a.y, b.y),
    x2: Math.min(a.x2, b.x2),
    y2: Math.min(a.y2, b.y2),
  };
}

export function edgeInset(pallet, flushEdge) {
  if (flushEdge) return { x: 0, y: 0 };
  const bottomL = Number(pallet.bottomLengthCm) || Number(pallet.baseOuterLengthCm) || 0;
  const bottomW = Number(pallet.bottomWidthCm) || Number(pallet.baseOuterWidthCm) || 0;
  const innerL = Number(pallet.innerLengthCm);
  const innerW = Number(pallet.innerWidthCm);
  const x = Number.isFinite(innerL) && bottomL > innerL ? (bottomL - innerL) / 2 : 5;
  const y = Number.isFinite(innerW) && bottomW > innerW ? (bottomW - innerW) / 2 : 5;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

function applyInset(box, inset) {
  return {
    x: box.x + inset.x,
    y: box.y + inset.y,
    x2: box.x2 - inset.x,
    y2: box.y2 - inset.y,
  };
}

export function usableRect(pallet, z0, z1, inset) {
  const layers = contourLayers(pallet);
  let box = intersectAABB(sliceAABB(pallet, z0), sliceAABB(pallet, z1));
  for (const layer of layers) {
    if (layer.z > z0 + EPS && layer.z < z1 - EPS) {
      box = intersectAABB(box, layer);
    }
  }
  box = applyInset(box, inset);
  return {
    x: box.x,
    y: box.y,
    dx: box.x2 - box.x,
    dy: box.y2 - box.y,
  };
}

function intersectSpace(space, rect) {
  const x = Math.max(space.x, rect.x);
  const y = Math.max(space.y, rect.y);
  const x2 = Math.min(space.x + space.dx, rect.x + rect.dx);
  const y2 = Math.min(space.y + space.dy, rect.y + rect.dy);
  return { x, y, dx: x2 - x, dy: y2 - y };
}

export function packingBounds(pallet, inset = { x: 0, y: 0 }) {
  const layers = contourLayers(pallet);
  let box = { x: Infinity, y: Infinity, x2: -Infinity, y2: -Infinity };
  for (const layer of layers) {
    box = {
      x: Math.min(box.x, layer.x),
      y: Math.min(box.y, layer.y),
      x2: Math.max(box.x2, layer.x2),
      y2: Math.max(box.y2, layer.y2),
    };
  }
  box = applyInset(box, inset);
  return {
    x: box.x,
    y: box.y,
    z: 0,
    dx: Math.max(0, box.x2 - box.x),
    dy: Math.max(0, box.y2 - box.y),
    dz: Number(pallet.heightCm) || 0,
  };
}

export function pointInsidePallet(pallet, x, y, z, flushEdge = true) {
  const inset = edgeInset(pallet, flushEdge);
  const rect = usableRect(pallet, z, z, inset);
  return x >= rect.x - EPS && y >= rect.y - EPS && x <= rect.x + rect.dx + EPS && y <= rect.y + rect.dy + EPS;
}

export function boxInsidePallet(pallet, x, y, z, l, w, h, flushEdge = true) {
  const inset = edgeInset(pallet, flushEdge);
  const rect = usableRect(pallet, z, z + h, inset);
  return (
    rect.dx >= l - EPS &&
    rect.dy >= w - EPS &&
    x >= rect.x - EPS &&
    y >= rect.y - EPS &&
    x + l <= rect.x + rect.dx + EPS &&
    y + w <= rect.y + rect.dy + EPS
  );
}

function zCandidates(pallet, space, h) {
  const zEnd = space.z + space.dz - h;
  if (zEnd < space.z - EPS) return [];
  const set = new Set([Number(space.z.toFixed(4))]);
  for (const layer of contourLayers(pallet)) {
    if (layer.z >= space.z - EPS && layer.z <= zEnd + EPS) set.add(Number(layer.z.toFixed(4)));
  }
  const layers = contourLayers(pallet);
  for (let i = 0; i < layers.length - 1; i += 1) {
    const lo = Math.max(space.z, layers[i].z);
    const hi = Math.min(zEnd, layers[i + 1].z);
    if (hi - lo < 2) continue;
    for (let k = 1; k < 4; k += 1) {
      set.add(Number((lo + ((hi - lo) * k) / 4).toFixed(4)));
    }
  }
  return [...set].filter((z) => z <= zEnd + EPS).sort((a, b) => a - b);
}

function fitGrid(rect, ori, limit) {
  let nx = Math.floor((rect.dx + EPS) / ori.l);
  let ny = Math.floor((rect.dy + EPS) / ori.w);
  if (nx <= 0 || ny <= 0) return { nx: 0, ny: 0, n: 0 };
  if (limit != null) {
    const cap = Math.max(0, limit);
    while (nx * ny > cap) {
      if (nx >= ny && nx > 1) nx -= 1;
      else if (ny > 1) ny -= 1;
      else break;
    }
  }
  if (nx <= 0 || ny <= 0) return { nx: 0, ny: 0, n: 0 };
  return { nx, ny, n: nx * ny, x: rect.x, y: rect.y };
}

function placementInSpace(pallet, space, ori, limit, inset) {
  if (ori.h > space.dz + EPS) return null;
  let best = null;
  for (const z of zCandidates(pallet, space, ori.h)) {
    const rect = intersectSpace(space, usableRect(pallet, z, z + ori.h, inset));
    const grid = fitGrid(rect, ori, limit);
    if (!grid.n) continue;
    let nz = 1;
    while (true) {
      const next = nz + 1;
      if (next * ori.h > space.z + space.dz - z + EPS) break;
      if (limit != null && grid.n * next > limit) break;
      const taller = intersectSpace(space, usableRect(pallet, z, z + next * ori.h, inset));
      if (taller.x > grid.x + EPS || taller.y > grid.y + EPS) break;
      if (grid.x + grid.nx * ori.l > taller.x + taller.dx + EPS) break;
      if (grid.y + grid.ny * ori.w > taller.y + taller.dy + EPS) break;
      nz = next;
    }
    const n = grid.n * nz;
    const vol = n * ori.l * ori.w * ori.h;
    if (
      !best ||
      z < best.z - EPS ||
      (Math.abs(z - best.z) <= EPS && vol > best.vol)
    ) {
      best = { ...grid, nz, n, vol, z };
    }
    if (z <= space.z + EPS && best) break;
  }
  return best;
}

function splitAround(space, px, py, pz, usedDx, usedDy, usedDz) {
  const leftover = [];
  const x2 = space.x + space.dx;
  const y2 = space.y + space.dy;
  const z2 = space.z + space.dz;
  const ux2 = px + usedDx;
  const uy2 = py + usedDy;
  const uz2 = pz + usedDz;
  if (px - space.x > 1) {
    leftover.push({ x: space.x, y: space.y, z: space.z, dx: px - space.x, dy: space.dy, dz: space.dz });
  }
  if (x2 - ux2 > 1) {
    leftover.push({ x: ux2, y: space.y, z: space.z, dx: x2 - ux2, dy: space.dy, dz: space.dz });
  }
  if (py - space.y > 1) {
    leftover.push({ x: px, y: space.y, z: space.z, dx: usedDx, dy: py - space.y, dz: space.dz });
  }
  if (y2 - uy2 > 1) {
    leftover.push({ x: px, y: uy2, z: space.z, dx: usedDx, dy: y2 - uy2, dz: space.dz });
  }
  if (pz - space.z > 1) {
    leftover.push({ x: px, y: py, z: space.z, dx: usedDx, dy: usedDy, dz: pz - space.z });
  }
  if (z2 - uz2 > 1) {
    leftover.push({ x: px, y: py, z: uz2, dx: usedDx, dy: usedDy, dz: z2 - uz2 });
  }
  return leftover.filter((item) => item.dx > 1 && item.dy > 1 && item.dz > 1);
}

function volumeOf(pallet) {
  const v = Number(pallet.volumeAllowedM3);
  if (Number.isFinite(v) && v > 0) return v * 1e6;
  const b = packingBounds(pallet);
  return b.dx * b.dy * b.dz;
}

export const GROUP_COLORS = [
  "#4db8a8",
  "#d4a24c",
  "#e07a5f",
  "#7eb6ff",
  "#c084fc",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb7185",
  "#a3e635",
  "#22d3ee",
  "#f97316",
  "#818cf8",
  "#2dd4bf",
];

export function expandGroupBoxes(group) {
  const boxes = [];
  for (let iz = 0; iz < group.nz; iz += 1) {
    for (let iy = 0; iy < group.ny; iy += 1) {
      for (let ix = 0; ix < group.nx; ix += 1) {
        boxes.push({
          x: group.origin.x + ix * group.l,
          y: group.origin.y + iy * group.w,
          z: group.origin.z + iz * group.h,
          l: group.l,
          w: group.w,
          h: group.h,
        });
      }
    }
  }
  return boxes;
}

export function packMaxLoad(pallet, cargos, options = {}) {
  return packOnce(pallet, cargos, options);
}

function isUprightOri(stock, ori) {
  return (
    ori.h === stock.h &&
    ((ori.l === stock.l && ori.w === stock.w) || (ori.l === stock.w && ori.w === stock.l))
  );
}

function cargoRemaining(qty) {
  if (qty === "" || qty == null) return Infinity;
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function packOnce(pallet, cargos, options = {}) {
  const inset = edgeInset(pallet, Boolean(options.flushEdge));
  const stocks = cargos
    .map((item, index) => ({
      key: item.id || `cargo-${index}`,
      name: String(item.name || "").trim() || `箱型${index + 1}`,
      l: Number(item.l),
      w: Number(item.w),
      h: Number(item.h),
      allowFlip: Boolean(item.allowFlip),
      remaining: cargoRemaining(item.qty),
    }))
    .filter((item) => item.l > 0 && item.w > 0 && item.h > 0 && item.remaining > 0)
    .sort((a, b) => b.l * b.w * b.h - a.l * a.w * a.h);

  const spaces = [packingBounds(pallet, inset)];
  const groups = [];

  const findBest = () => {
    let best = null;
    for (let si = 0; si < spaces.length; si += 1) {
      const space = spaces[si];
      for (const stock of stocks) {
        if (stock.remaining <= 0) continue;
        const limit = Number.isFinite(stock.remaining) ? stock.remaining : null;
        for (const ori of cargoOrientations(stock.l, stock.w, stock.h, stock.allowFlip)) {
          const place = placementInSpace(pallet, space, ori, limit, inset);
          if (!place?.n) continue;
          if (
            !best ||
            place.z < best.place.z - EPS ||
            (Math.abs(place.z - best.place.z) <= EPS && place.vol > best.place.vol) ||
            (Math.abs(place.z - best.place.z) <= EPS &&
              Math.abs(place.vol - best.place.vol) <= EPS &&
              place.n > best.place.n)
          ) {
            best = { si, stock, ori, place, space };
          }
        }
      }
    }
    return best;
  };

  let guard = 0;
  while (guard < 1500) {
    guard += 1;
    const best = findBest();
    if (!best) break;
    const { si, stock, ori, place, space } = best;
    const usedDx = place.nx * ori.l;
    const usedDy = place.ny * ori.w;
    const usedDz = place.nz * ori.h;
    const flipped = stock.allowFlip && !isUprightOri(stock, ori);
    groups.push({
      id: `g-${groups.length + 1}`,
      cargoId: stock.key,
      name: stock.name,
      count: place.n,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      l: ori.l,
      w: ori.w,
      h: ori.h,
      origL: stock.l,
      origW: stock.w,
      origH: stock.h,
      flipped,
      allowFlip: stock.allowFlip,
      nx: place.nx,
      ny: place.ny,
      nz: place.nz,
      origin: { x: place.x, y: place.y, z: place.z },
    });
    stock.remaining -= place.n;
    spaces.splice(si, 1, ...splitAround(space, place.x, place.y, place.z, usedDx, usedDy, usedDz));
    if (spaces.length > 220) spaces.splice(220);
    spaces.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  }

  const packedCount = groups.reduce((sum, g) => sum + g.count, 0);
  const packedVolume = groups.reduce((sum, g) => sum + g.count * g.l * g.w * g.h, 0);
  const capacity = volumeOf(pallet);
  return {
    groups,
    packedCount,
    packedVolume,
    capacity,
    utilization: capacity > 0 ? packedVolume / capacity : 0,
  };
}

function hasLimitedQty(cargos) {
  return cargos.some((item) => Number(item.qty) > 0);
}

function subtractPacked(cargos, groups) {
  const used = new Map();
  for (const group of groups) {
    used.set(group.cargoId, (used.get(group.cargoId) || 0) + group.count);
  }
  return cargos.map((item) => {
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) return { ...item };
    const left = Math.max(0, qty - (used.get(item.id) || used.get(item.cargoId) || 0));
    return { ...item, qty: left || 0 };
  });
}

function limitedRemaining(cargos) {
  return cargos
    .filter((item) => Number(item.qty) > 0)
    .reduce((sum, item) => sum + Number(item.l) * Number(item.w) * Number(item.h) * Number(item.qty), 0);
}

function readFlushFlag(map, id, fallback = false) {
  if (map && typeof map === "object") {
    const raw = map[id] ?? map[String(id)];
    if (Array.isArray(raw)) return Boolean(raw[0]);
    if (raw != null) return Boolean(raw);
  }
  return Boolean(fallback);
}

export function packScheme(palletList, cargos, { qtyMap = {}, flushMap = {}, flushEdge = false } = {}) {
  const boards = [];
  if (!palletList.length) return { boards: [], leftover: [] };

  const fleet = [];
  for (const pallet of palletList) {
    const raw = qtyMap[pallet.id] ?? qtyMap[String(pallet.id)] ?? 1;
    const qty = Math.min(50, Math.max(1, Math.floor(Number(raw) || 1)));
    const edge = readFlushFlag(flushMap, pallet.id, flushEdge);
    for (let seq = 1; seq <= qty; seq += 1) {
      fleet.push({ pallet, seq, total: qty, flushEdge: edge });
    }
  }

  const mixedEdge = new Set(fleet.map((entry) => entry.flushEdge)).size > 1;

  const makeBoard = (entry, packed) => {
    const name = `${entry.pallet.airplane} / ${entry.pallet.pallet}`;
    const edge = entry.flushEdge ? "贴边" : "不贴边";
    const base = entry.total > 1 ? `${name} #${entry.seq}` : name;
    return {
      palletId: entry.pallet.id,
      palletName: name,
      seq: entry.seq,
      total: entry.total,
      flushEdge: Boolean(entry.flushEdge),
      label: mixedEdge ? `${base} · ${edge}` : base,
      groups: packed.groups,
      packingList: summarizeGroups(packed.groups),
      packedCount: packed.packedCount,
      packedVolume: packed.packedVolume,
      capacity: packed.capacity,
      utilization: packed.utilization,
    };
  };

  const packEntry = (entry, stock) => packMaxLoad(entry.pallet, stock, { flushEdge: entry.flushEdge });

  if (!hasLimitedQty(cargos)) {
    for (const entry of fleet) {
      const packed = packEntry(entry, cargos);
      if (packed.groups.length) boards.push(makeBoard(entry, packed));
    }
    return { boards, leftover: [] };
  }

  let stock = cargos.map((item) => ({ ...item }));
  const unused = [...fleet];
  while (unused.length && limitedRemaining(stock) > 0) {
    let best = null;
    for (const entry of unused) {
      const packed = packEntry(entry, stock);
      if (!packed.groups.length) continue;
      if (!best || packed.packedVolume > best.packed.packedVolume) {
        best = { entry, packed };
      }
    }
    if (!best) break;
    boards.push(makeBoard(best.entry, best.packed));
    stock = subtractPacked(stock, best.packed.groups);
    unused.splice(unused.indexOf(best.entry), 1);
  }

  return { boards, leftover: leftoverFrom(cargos, boards) };
}

function summarizeGroups(groups) {
  const map = new Map();
  for (const group of groups) {
    const key = `${group.cargoId}|${group.name}|${group.l}x${group.w}x${group.h}|${group.flipped ? 1 : 0}`;
    const prev = map.get(key) || {
      cargoId: group.cargoId,
      name: group.name,
      l: group.l,
      w: group.w,
      h: group.h,
      origL: group.origL,
      origW: group.origW,
      origH: group.origH,
      flipped: Boolean(group.flipped),
      count: 0,
      color: group.color,
    };
    prev.count += group.count;
    map.set(key, prev);
  }
  return [...map.values()];
}

function leftoverFrom(cargos, boards) {
  const packed = new Map();
  for (const board of boards) {
    for (const group of board.groups) {
      const key = String(group.cargoId ?? "");
      packed.set(key, (packed.get(key) || 0) + group.count);
    }
  }
  return cargos
    .filter((item) => Number(item.qty) > 0)
    .map((item) => {
      const requested = Math.floor(Number(item.qty));
      const loaded = packed.get(String(item.id)) || packed.get(String(item.cargoId)) || 0;
      return {
        cargoId: item.id,
        name: String(item.name || "").trim() || `${Number(item.l)}×${Number(item.w)}×${Number(item.h)}`,
        l: Number(item.l),
        w: Number(item.w),
        h: Number(item.h),
        allowFlip: Boolean(item.allowFlip),
        requested,
        packed: loaded,
        leftover: Math.max(0, requested - loaded),
      };
    })
    .filter((item) => item.leftover > 0);
}
