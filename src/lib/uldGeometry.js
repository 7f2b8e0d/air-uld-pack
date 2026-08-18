import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshPhongMaterial,
  SphereGeometry,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { TYPE_COLORS } from "../state.js";

function toScene(point) {
  return new Vector3(point[0], point[2], point[1]);
}

function layerQuads(points) {
  if (!Array.isArray(points) || points.length < 8) return [];
  if (points.length >= 12) {
    return [points.slice(0, 4), points.slice(4, 8), points.slice(8, 12)];
  }
  const byZ = new Map();
  for (const point of points) {
    const key = point[2];
    if (!byZ.has(key)) byZ.set(key, []);
    byZ.get(key).push(point);
  }
  return [...byZ.keys()]
    .sort((a, b) => a - b)
    .map((z) => byZ.get(z).slice(0, 4))
    .filter((layer) => layer.length >= 3);
}

function addTri(positions, normals, a, b, c) {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const n = new Vector3().crossVectors(ab, ac).normalize();
  for (const v of [a, b, c]) {
    positions.push(v.x, v.y, v.z);
    normals.push(n.x, n.y, n.z);
  }
}

function addQuad(positions, normals, a, b, c, d) {
  addTri(positions, normals, a, b, c);
  addTri(positions, normals, a, c, d);
}

export function buildUldMesh(pallet) {
  const layers = layerQuads(pallet.pointCoordinate).map((layer) => layer.map(toScene));
  const positions = [];
  const normals = [];

  if (layers.length >= 2) {
    const bottom = layers[0];
    const top = layers[layers.length - 1];
    addQuad(positions, normals, bottom[0], bottom[3], bottom[2], bottom[1]);
    addQuad(positions, normals, top[0], top[1], top[2], top[3]);
    for (let i = 0; i < layers.length - 1; i += 1) {
      const a = layers[i];
      const b = layers[i + 1];
      const n = Math.min(a.length, b.length);
      for (let k = 0; k < n; k += 1) {
        const k2 = (k + 1) % n;
        addQuad(positions, normals, a[k], a[k2], b[k2], b[k]);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const color = new Color(TYPE_COLORS[pallet.palletTypeName] || "#4db8a8");
  const material = new MeshPhongMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.35),
    transparent: true,
    opacity: 0.78,
    side: DoubleSide,
    shininess: 18,
    specular: new Color("#d9e4ee"),
    depthWrite: true,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = "uld-hull";
  mesh.userData.cornerPoints = (pallet.pointCoordinate || []).map(toScene);
  return mesh;
}

function makeLabel(text, klass) {
  const el = document.createElement("div");
  el.className = `dim-label ${klass || ""}`.trim();
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 0.5);
  return obj;
}

function makeLine(from, to, color = "#e8d5a3") {
  const geometry = new BufferGeometry().setFromPoints([from, to]);
  const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.92 });
  return new Line(geometry, material);
}

function tick(from, dir, size = 8) {
  const a = from.clone().add(dir.clone().multiplyScalar(size));
  const b = from.clone().add(dir.clone().multiplyScalar(-size));
  return makeLine(a, b, "#e8d5a3");
}

function pickAxisStep(size) {
  const abs = Math.max(Number(size) || 0, 1);
  if (abs <= 80) return 10;
  if (abs <= 160) return 20;
  if (abs <= 400) return 50;
  return 100;
}

function axisStops(size, step) {
  const end = Math.max(Number(size) || 0, 0);
  const values = [];
  for (let v = step; v < end - step * 0.15; v += step) values.push(v);
  return values;
}

function makeTickSegments(pairs, color = "#d8c48a") {
  const points = [];
  for (const [a, b] of pairs) points.push(a, b);
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.88 });
  return new LineSegments(geometry, material);
}

function addAxisRuler(items, { origin, axis, outward, length, title, labelShift }) {
  const end = origin.clone().add(axis.clone().multiplyScalar(length));
  items.push(makeLine(origin, end, "#e8d5a3"));
  const step = pickAxisStep(length);
  const minor = step >= 50 ? step / 5 : step / 2;
  const pairs = [];
  const out = outward.clone().normalize();
  for (let v = 0; v <= length + 1e-3; v += minor) {
    const at = origin.clone().add(axis.clone().multiplyScalar(Math.min(v, length)));
    const major = Math.abs(v % step) < 1e-3 || Math.abs(v - length) < 1e-3;
    const size = major ? 8 : 4;
    pairs.push([at.clone(), at.clone().add(out.clone().multiplyScalar(size))]);
  }
  if (pairs.length) items.push(makeTickSegments(pairs));
  for (const value of axisStops(length, step)) {
    const label = makeLabel(String(Math.round(value)), "is-tick");
    label.position.copy(origin).add(axis.clone().multiplyScalar(value)).add(labelShift);
    items.push(label);
  }
  const endLabel = makeLabel(`${title} ${Math.round(length)} cm`, "is-axis-end");
  endLabel.position.copy(end).add(labelShift.clone().multiplyScalar(1.15));
  items.push(endLabel);
}

export function buildAxisRulers(pallet, mesh) {
  const items = [];
  const box = mesh?.geometry?.boundingBox;
  if (!box) return items;
  const length = Number(pallet.baseOuterLengthCm) || box.max.x - box.min.x;
  const width = Number(pallet.baseOuterWidthCm) || box.max.z - box.min.z;
  const height = Number(pallet.heightCm) || box.max.y - box.min.y;
  const pad = Math.max(6, Math.max(length, width) * 0.012);
  const x0 = box.min.x;
  const y0 = box.min.y;
  const z1 = box.max.z;

  addAxisRuler(items, {
    origin: new Vector3(x0, y0, z1 + pad),
    axis: new Vector3(1, 0, 0),
    outward: new Vector3(0, 0, 1),
    length,
    title: "长",
    labelShift: new Vector3(0, 6, 14),
  });
  addAxisRuler(items, {
    origin: new Vector3(box.max.x + pad, y0, box.min.z),
    axis: new Vector3(0, 0, 1),
    outward: new Vector3(1, 0, 0),
    length: width,
    title: "宽",
    labelShift: new Vector3(16, 6, 0),
  });
  addAxisRuler(items, {
    origin: new Vector3(x0 - pad, y0, z1 + pad),
    axis: new Vector3(0, 1, 0),
    outward: new Vector3(-1, 0, 0),
    length: height,
    title: "高",
    labelShift: new Vector3(-16, 0, 8),
  });
  return items;
}

export function buildDimensionGuides(pallet, mesh) {
  const groupItems = [];
  const box = mesh.geometry.boundingBox;
  if (!box) return groupItems;

  const pad = Math.max(18, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.06);
  const y0 = box.min.y;
  const length = pallet.baseOuterLengthCm;
  const width = pallet.baseOuterWidthCm;
  const height = pallet.heightCm;
  const trans = pallet.transitionHeightCm;

  const lengthFrom = new Vector3(box.min.x, y0, box.max.z + pad);
  const lengthTo = new Vector3(box.max.x, y0, box.max.z + pad);
  groupItems.push(makeLine(lengthFrom, lengthTo));
  groupItems.push(tick(lengthFrom, new Vector3(0, 0, 1)));
  groupItems.push(tick(lengthTo, new Vector3(0, 0, 1)));
  const lengthLabel = makeLabel(`长 ${length} cm`);
  lengthLabel.position.copy(lengthFrom).lerp(lengthTo, 0.5).add(new Vector3(0, 10, 10));
  groupItems.push(lengthLabel);

  const widthFrom = new Vector3(box.max.x + pad, y0, box.min.z);
  const widthTo = new Vector3(box.max.x + pad, y0, box.max.z);
  groupItems.push(makeLine(widthFrom, widthTo));
  groupItems.push(tick(widthFrom, new Vector3(1, 0, 0)));
  groupItems.push(tick(widthTo, new Vector3(1, 0, 0)));
  const widthLabel = makeLabel(`宽 ${width} cm`);
  widthLabel.position.copy(widthFrom).lerp(widthTo, 0.5).add(new Vector3(12, 10, 0));
  groupItems.push(widthLabel);

  const heightFrom = new Vector3(box.min.x - pad, y0, box.min.z);
  const heightTo = new Vector3(box.min.x - pad, y0 + height, box.min.z);
  groupItems.push(makeLine(heightFrom, heightTo));
  groupItems.push(tick(heightFrom, new Vector3(-1, 0, 0)));
  groupItems.push(tick(heightTo, new Vector3(-1, 0, 0)));
  const heightLabel = makeLabel(`高 ${height} cm`);
  heightLabel.position.copy(heightFrom).lerp(heightTo, 0.5).add(new Vector3(-12, 0, 0));
  groupItems.push(heightLabel);

  if (trans != null && trans > 0 && trans < height) {
    const tFrom = new Vector3(box.max.x + pad, y0, box.max.z);
    const tTo = new Vector3(box.max.x + pad, y0 + trans, box.max.z);
    groupItems.push(makeLine(tFrom, tTo, "#7eb6ff"));
    groupItems.push(tick(tFrom, new Vector3(1, 0, 0), 6));
    groupItems.push(tick(tTo, new Vector3(1, 0, 0), 6));
    const tLabel = makeLabel(`过渡 ${trans} cm`, "is-trans");
    tLabel.position.copy(tFrom).lerp(tTo, 0.5).add(new Vector3(14, 0, 8));
    groupItems.push(tLabel);

    const planeFrom = new Vector3(box.min.x, y0 + trans, box.min.z);
    const planeTo = new Vector3(box.max.x, y0 + trans, box.max.z);
    const plane = makeLine(
      new Vector3(planeFrom.x, planeFrom.y, planeTo.z),
      new Vector3(planeTo.x, planeFrom.y, planeTo.z),
      "#7eb6ff"
    );
    groupItems.push(plane);
  }

  const innerLabel = makeLabel(
    `内径 ${pallet.innerLengthCm} × ${pallet.innerWidthCm} cm · ${pallet.volumeAllowedM3 ?? "—"} m³`,
    "is-meta"
  );
  innerLabel.position.set((box.min.x + box.max.x) / 2, box.max.y + 36, (box.min.z + box.max.z) / 2);
  groupItems.push(innerLabel);

  return groupItems;
}

export function buildCornerMarkers(mesh) {
  const points = mesh.userData.cornerPoints || [];
  const geom = new SphereGeometry(5, 12, 12);
  const mat = new MeshBasicMaterial({ color: "#f0d7a2" });
  return points.map((point) => {
    const ball = new Mesh(geom, mat);
    ball.position.copy(point);
    return ball;
  });
}

export function sceneCenterOf(mesh) {
  const box = mesh.geometry.boundingBox;
  if (!box) return new Vector3();
  return box.getCenter(new Vector3());
}

export function sceneSizeOf(mesh) {
  const box = mesh.geometry.boundingBox;
  if (!box) return new Vector3(100, 100, 100);
  return box.getSize(new Vector3());
}
