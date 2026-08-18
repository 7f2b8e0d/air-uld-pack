<template>
  <section class="viewer viewer-embed">
    <div class="viewer-head">
      <div>
        <h2>{{ pallet.airplane }} · {{ pallet.pallet }}</h2>
        <p>
          {{ pallet.baseOuterLengthCm }} × {{ pallet.baseOuterWidthCm }} × {{ pallet.heightCm }} cm
          <em :class="{ off: !isEnabled(pallet.id) }">
            {{ isEnabled(pallet.id) ? "已启用" : "未启用" }}
          </em>
        </p>
      </div>
      <button type="button" class="ghost" @click="resetCamera">复位视角</button>
    </div>
    <div ref="host" class="canvas-host"></div>
    <p class="hint">拖拽旋转 · 滚轮缩放 · 右键平移 · 尺寸单位 cm</p>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  buildCornerMarkers,
  buildDimensionGuides,
  buildUldMesh,
  sceneCenterOf,
  sceneSizeOf,
} from "../lib/uldGeometry.js";
import { isEnabled } from "../state.js";

const props = defineProps({
  pallet: { type: Object, required: true },
});

const host = ref(null);

let renderer;
let labelRenderer;
let scene;
let camera;
let controls;
let frameId = 0;
let modelGroup;
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

function rebuild() {
  if (!scene || !modelGroup || !props.pallet) return;
  clearGroup(modelGroup);

  const mesh = buildUldMesh(props.pallet);
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry, 12),
    new LineBasicMaterial({ color: "#ffffff", transparent: false })
  );
  modelGroup.add(mesh);
  modelGroup.add(edges);
  for (const item of buildCornerMarkers(mesh)) modelGroup.add(item);
  for (const item of buildDimensionGuides(props.pallet, mesh)) {
    modelGroup.add(item);
  }

  const center = sceneCenterOf(mesh);
  const size = sceneSizeOf(mesh);
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
  camera.position.set(center.x + span * 1.15, center.y + span * 0.85, center.z + span * 1.25);
  camera.near = 1;
  camera.far = span * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function resetCamera() {
  rebuild();
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
  renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.value.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "label-layer";
  host.value.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.7;

  scene.add(new AmbientLight(0x9eb0c4, 0.7));
  scene.add(new HemisphereLight(0xcde4ff, 0x2a2118, 0.55));
  const key = new DirectionalLight(0xfff4e2, 0.9);
  key.position.set(240, 420, 180);
  scene.add(key);
  const fill = new DirectionalLight(0x7eb6ff, 0.35);
  fill.position.set(-180, 120, -220);
  scene.add(fill);

  modelGroup = new Group();
  scene.add(modelGroup);

  resize();
  rebuild();
  tick();

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host.value);
});

watch(() => props.pallet, rebuild);

onUnmounted(() => {
  cancelAnimationFrame(frameId);
  resizeObserver?.disconnect();
  controls?.dispose();
  clearGroup(modelGroup);
  renderer?.dispose();
  renderer?.domElement?.remove();
  labelRenderer?.domElement?.remove();
});
</script>
