<template>
  <div class="pack-viewer">
    <div ref="host" class="canvas-host pack-canvas"></div>
    <p class="hint">拖拽旋转 · 滚轮缩放 · 仅显示勾选分组，每组一种颜色</p>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  MeshPhongMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { buildUldMesh, sceneCenterOf, sceneSizeOf } from "../lib/uldGeometry.js";
import { expandGroupBoxes } from "../lib/pack.js";

const props = defineProps({
  pallet: { type: Object, default: null },
  groups: { type: Array, default: () => [] },
});

const host = ref(null);
let renderer;
let labelRenderer;
let scene;
let camera;
let controls;
let frameId = 0;
let modelGroup;
let cargoGroup;
let grid;
let resizeObserver;

function clearGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    if (child.element?.parentNode) child.element.parentNode.removeChild(child.element);
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
    else child.material?.dispose?.();
  }
}

function addLabel(text, position, color) {
  const el = document.createElement("div");
  el.className = "dim-label";
  el.style.borderColor = color;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(position);
  cargoGroup.add(obj);
}

function rebuildCargo() {
  if (!cargoGroup) return;
  clearGroup(cargoGroup);
  const dummy = new Object3D();
  for (const group of props.groups) {
    const color = new Color(group.color || "#4db8a8");
    const mat = new MeshPhongMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.22),
      transparent: true,
      opacity: 0.9,
      shininess: 20,
    });
    const l = Math.max((group.l || 1) - 0.6, 0.8);
    const w = Math.max((group.w || 1) - 0.6, 0.8);
    const h = Math.max((group.h || 1) - 0.6, 0.8);
    const geom = new BoxGeometry(l, h, w);
    const boxes = expandGroupBoxes(group);
    if (boxes.length) {
      const mesh = new InstancedMesh(geom, mat, boxes.length);
      boxes.forEach((box, index) => {
        dummy.position.set(box.x + box.l / 2, box.z + box.h / 2, box.y + box.w / 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      cargoGroup.add(mesh);
    }

    const block = new BoxGeometry(group.nx * group.l, group.nz * group.h, group.ny * group.w);
    const edges = new LineSegments(new EdgesGeometry(block), new LineBasicMaterial({ color: "#f7f4ee" }));
    edges.position.set(
      group.origin.x + (group.nx * group.l) / 2,
      group.origin.z + (group.nz * group.h) / 2,
      group.origin.y + (group.ny * group.w) / 2
    );
    cargoGroup.add(edges);

    addLabel(
      `${group.name} × ${group.count}`,
      new Vector3(
        group.origin.x + (group.nx * group.l) / 2,
        group.origin.z + group.nz * group.h + 8,
        group.origin.y + (group.ny * group.w) / 2
      ),
      group.color
    );
  }
}

function fitCamera() {
  if (!modelGroup || !camera || !controls) return;
  const hull = modelGroup.children[0];
  if (!hull?.geometry) return;
  const center = sceneCenterOf(hull);
  const size = sceneSizeOf(hull);
  const span = Math.max(size.x, size.y, size.z, 120);
  if (grid) {
    scene.remove(grid);
    grid.geometry?.dispose?.();
    grid.material?.dispose?.();
  }
  grid = new GridHelper(Math.ceil(span * 2.4), 20, 0x8aa0b8, 0x3b4d61);
  grid.position.set(center.x, 0, center.z);
  scene.add(grid);
  controls.target.copy(center);
  camera.position.set(center.x + span * 1.2, center.y + span * 0.9, center.z + span * 1.3);
  camera.near = 1;
  camera.far = span * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function rebuildHull() {
  if (!scene || !modelGroup) return;
  clearGroup(modelGroup);
  if (!props.pallet) return;
  const mesh = buildUldMesh(props.pallet);
  mesh.material.opacity = 0.12;
  mesh.material.depthWrite = false;
  modelGroup.add(mesh);
  fitCamera();
}

function resize() {
  if (!host.value || !renderer || !camera) return;
  const { clientWidth: w, clientHeight: h } = host.value;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}

function tick() {
  frameId = requestAnimationFrame(tick);
  controls?.update();
  renderer?.render(scene, camera);
  labelRenderer?.render(scene, camera);
}

onMounted(() => {
  scene = new Scene();
  scene.background = new Color("#1c2836");
  camera = new PerspectiveCamera(42, 1, 1, 20000);
  renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.value.appendChild(renderer.domElement);
  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "label-layer";
  host.value.appendChild(labelRenderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new AmbientLight(0x9eb0c4, 0.75));
  scene.add(new HemisphereLight(0xcde4ff, 0x2a2118, 0.5));
  const key = new DirectionalLight(0xfff4e2, 0.95);
  key.position.set(260, 420, 180);
  scene.add(key);
  modelGroup = new Group();
  cargoGroup = new Group();
  scene.add(modelGroup);
  scene.add(cargoGroup);
  resize();
  rebuildHull();
  rebuildCargo();
  tick();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
});

watch(() => props.pallet, rebuildHull);
watch(() => props.groups, rebuildCargo, { deep: true });

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  controls?.dispose();
  clearGroup(modelGroup);
  clearGroup(cargoGroup);
  renderer?.dispose();
  renderer?.domElement?.remove();
  labelRenderer?.domElement?.remove();
});
</script>
