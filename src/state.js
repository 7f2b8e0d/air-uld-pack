import { reactive, computed, watch } from "vue";
import catalog from "../data/uld-pallets.json";
import { packScheme, GROUP_COLORS } from "./lib/pack.js";

export const TYPE_LABELS = {
  box: "矩形箱",
  "slope-one-side": "单侧斜切",
  "slope-both-sides": "双侧斜切",
  "low-pallet-flare": "低板外扩",
  "ake-container": "AKE 集装箱",
};

export const TYPE_COLORS = {
  box: "#4db8a8",
  "slope-one-side": "#d4a24c",
  "slope-both-sides": "#e07a5f",
  "low-pallet-flare": "#7eb6ff",
  "ake-container": "#9ec97f",
};

const STORAGE_KEY = "airpack.config.v2";
const LEGACY_KEY = "airpack.config.v1";
const EXPORT_KIND = "airpack-project";
const EXPORT_VERSION = 2;

export const pallets = (catalog.items || []).map((item) => ({
  ...item,
  airlines: item.airlines || "—",
  typeLabel: TYPE_LABELS[item.palletTypeName] || item.palletTypeName,
}));

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyCargo() {
  return { id: uid("box"), name: "", l: "", w: "", h: "", qty: "", allowFlip: true };
}

function normalizeResult(result) {
  if (!result || typeof result !== "object") return result;
  const flushEdge = Boolean(result.flushEdge);
  if (Array.isArray(result.boards) && result.boards.length) {
    return {
      ...result,
      flushEdge,
      palletIds: result.palletIds || result.boards.map((b) => b.palletId),
    };
  }
  if (result.groups) {
    return {
      ...result,
      flushEdge,
      palletIds: result.palletIds || (result.palletId != null ? [result.palletId] : []),
      boards: [
        {
          palletId: result.palletId,
          palletName: result.palletName,
          groups: result.groups,
          packedCount: result.packedCount,
          packedVolume: result.packedVolume,
          capacity: result.capacity,
          utilization: result.utilization,
        },
      ],
    };
  }
  return { ...result, boards: [], palletIds: result.palletIds || [], flushEdge };
}

function emptyConfig() {
  return {
    disabledIds: [],
    selectedId: pallets[0]?.id ?? null,
    cargos: [emptyCargo()],
    calcPalletIds: pallets[0] ? [pallets[0].id] : [],
    calcPalletQty: pallets[0] ? { [pallets[0].id]: 1 } : {},
    allowFlip: false,
    flushEdge: false,
    results: [],
    activeResultId: null,
    activeBoardIndex: 0,
    groupSelectMode: "multi",
    selectedGroupIds: [],
    previewPalletId: null,
  };
}

function persistPayload(value) {
  return {
    disabledIds: value.disabledIds,
    selectedId: value.selectedId,
    cargos: value.cargos,
    calcPalletIds: value.calcPalletIds,
    calcPalletQty: value.calcPalletQty,
    allowFlip: value.allowFlip,
    flushEdge: value.flushEdge,
    results: value.results,
    activeResultId: value.activeResultId,
    activeBoardIndex: value.activeBoardIndex,
    groupSelectMode: value.groupSelectMode,
    selectedGroupIds: value.selectedGroupIds,
  };
}

function normalizeSnapshot(parsed) {
  const fallback = emptyConfig();
  if (!parsed || typeof parsed !== "object") return fallback;
  const selectedStillExists = pallets.some((p) => p.id === parsed.selectedId);
  const palletIdList = Array.isArray(parsed.calcPalletIds)
    ? parsed.calcPalletIds
    : parsed.calcPalletId != null
      ? [parsed.calcPalletId]
      : fallback.calcPalletIds;
  const calcPalletIds = palletIdList.filter((id) => pallets.some((p) => p.id == id));
  const qtySource = parsed.calcPalletQty && typeof parsed.calcPalletQty === "object" ? parsed.calcPalletQty : {};
  const calcPalletQty = {};
  for (const id of calcPalletIds) {
    const rawQty = qtySource[id] ?? qtySource[String(id)] ?? 1;
    calcPalletQty[id] = Math.min(50, Math.max(1, Math.floor(Number(rawQty) || 1)));
  }
  return {
    ...fallback,
    disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [],
    selectedId: selectedStillExists ? parsed.selectedId : fallback.selectedId,
    cargos: Array.isArray(parsed.cargos) && parsed.cargos.length ? parsed.cargos : fallback.cargos,
    calcPalletIds: calcPalletIds.length ? calcPalletIds : fallback.calcPalletIds,
    calcPalletQty: Object.keys(calcPalletQty).length ? calcPalletQty : fallback.calcPalletQty,
    allowFlip: Boolean(parsed.allowFlip),
    flushEdge: parsed.flushEdge == null ? false : Boolean(parsed.flushEdge),
    results: Array.isArray(parsed.results) ? parsed.results.map(normalizeResult) : [],
    activeResultId: parsed.activeResultId ?? null,
    activeBoardIndex: Number(parsed.activeBoardIndex) || 0,
    groupSelectMode: parsed.groupSelectMode === "single" ? "single" : "multi",
    selectedGroupIds: Array.isArray(parsed.selectedGroupIds) ? parsed.selectedGroupIds : [],
    previewPalletId: null,
  };
}

function unwrapImport(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("文件内容不是有效的 JSON 对象");
  }
  if (parsed.kind === EXPORT_KIND && parsed.data && typeof parsed.data === "object") {
    return parsed.data;
  }
  if (parsed.disabledIds || parsed.cargos || parsed.results || parsed.calcPalletIds) {
    return parsed;
  }
  throw new Error("不是本项目导出的数据文件");
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return emptyConfig();
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return emptyConfig();
  }
}

export const config = reactive(loadStored());

watch(
  config,
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistPayload(value)));
  },
  { deep: true }
);

function fileStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function exportProjectData() {
  const payload = {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    data: persistPayload(config),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `空运装箱-数据-${fileStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true, message: "已导出当前全部数据" };
}

export function importProjectData(parsed) {
  const next = normalizeSnapshot(unwrapImport(parsed));
  Object.assign(config, next);
  return {
    ok: true,
    message: `已导入 ${next.results.length} 个方案、${next.cargos.length} 种货物`,
  };
}

export async function importProjectFile(file) {
  if (!file) throw new Error("请选择要导入的文件");
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  return importProjectData(parsed);
}

export const disabledSet = computed(() => new Set(config.disabledIds));

export const enabledPallets = computed(() =>
  pallets.filter((p) => !disabledSet.value.has(p.id))
);

export const selectedPallet = computed(
  () => pallets.find((p) => p.id === config.selectedId) || pallets[0] || null
);

export const calcPallets = computed(() =>
  config.calcPalletIds
    .map((id) => enabledPallets.value.find((p) => p.id == id) || pallets.find((p) => p.id == id))
    .filter(Boolean)
);

export const calcPallet = computed(() => calcPallets.value[0] || enabledPallets.value[0] || null);

export const previewPallet = computed(
  () => pallets.find((p) => p.id === config.previewPalletId) || null
);

export const activeResult = computed(
  () => config.results.find((r) => r.id === config.activeResultId) || null
);

export const activeBoard = computed(() => {
  const result = activeResult.value;
  if (!result?.boards?.length) return null;
  const index = Math.min(Math.max(config.activeBoardIndex, 0), result.boards.length - 1);
  return result.boards[index];
});

export const visibleGroups = computed(() => {
  const board = activeBoard.value;
  if (!board) return [];
  if (!config.selectedGroupIds.length) return [];
  const selected = new Set(config.selectedGroupIds);
  return board.groups.filter((g) => selected.has(g.id));
});

export const airplaneGroups = computed(() => {
  const map = new Map();
  for (const item of pallets) {
    if (!map.has(item.airplane)) map.set(item.airplane, []);
    map.get(item.airplane).push(item);
  }
  return [...map.entries()].map(([airplane, items]) => {
    const enabledCount = items.filter((item) => !disabledSet.value.has(item.id)).length;
    return {
      airplane,
      items,
      enabledCount,
      total: items.length,
      allOn: enabledCount === items.length,
      allOff: enabledCount === 0,
    };
  });
});

export function isEnabled(id) {
  return !disabledSet.value.has(id);
}

export function setEnabled(id, on) {
  const next = new Set(config.disabledIds);
  if (on) next.delete(id);
  else next.add(id);
  config.disabledIds = [...next];
}

export function setGroupEnabled(ids, on) {
  const next = new Set(config.disabledIds);
  for (const id of ids) {
    if (on) next.delete(id);
    else next.add(id);
  }
  config.disabledIds = [...next];
}

export function setAllEnabled(on) {
  config.disabledIds = on ? [] : pallets.map((p) => p.id);
}

export function selectPallet(id) {
  config.selectedId = id;
  toggleCalcPallet(id, !isCalcPallet(id));
}

export function isCalcPallet(id) {
  return config.calcPalletIds.some((item) => item == id);
}

export function toggleCalcPallet(id, on) {
  const next = config.calcPalletIds.filter((item) => item != id);
  if (on) next.push(id);
  config.calcPalletIds = next;
  if (on) {
    config.selectedId = id;
    const raw = config.calcPalletQty?.[id] ?? config.calcPalletQty?.[String(id)];
    if (!Number(raw)) setPalletQty(id, 1);
  } else {
    const qty = { ...config.calcPalletQty };
    delete qty[id];
    delete qty[String(id)];
    config.calcPalletQty = qty;
  }
}

export function palletQty(id) {
  const raw = config.calcPalletQty?.[id] ?? config.calcPalletQty?.[String(id)];
  return Math.min(50, Math.max(1, Math.floor(Number(raw) || 1)));
}

export function setPalletQty(id, value) {
  const qty = Math.min(50, Math.max(1, Math.floor(Number(value) || 1)));
  config.calcPalletQty = { ...config.calcPalletQty, [id]: qty };
}

export function setAllCalcPallets(on) {
  config.calcPalletIds = on ? enabledPallets.value.map((p) => p.id) : [];
  if (!on) {
    config.calcPalletQty = {};
    return;
  }
  const qty = { ...config.calcPalletQty };
  for (const item of enabledPallets.value) {
    if (!qty[item.id]) qty[item.id] = 1;
  }
  config.calcPalletQty = qty;
}

export function openPalletPreview(id) {
  config.previewPalletId = id;
  config.selectedId = id;
}

export function closePalletPreview() {
  config.previewPalletId = null;
}

export function addCargoRow() {
  config.cargos.push(emptyCargo());
}

function isBlankCargo(row) {
  return !String(row?.name || "").trim() && !(Number(row?.l) > 0) && !(Number(row?.w) > 0) && !(Number(row?.h) > 0);
}

const CARGO_PASTE_RE =
  /(\d+(?:\.\d+)?)\s*[*\u00d7xX\uff0a]\s*(\d+(?:\.\d+)?)\s*[*\u00d7xX\uff0a]\s*(\d+(?:\.\d+)?)(?:\s*[*\u00d7xX\uff0a]\s*(\d+))?/g;

export function parseCargoPaste(text) {
  const src = String(text || "").trim();
  if (!src) {
    return { ok: false, message: "请粘贴货物尺寸，例如 120*80*100*2", items: [] };
  }
  const items = [];
  const re = new RegExp(CARGO_PASTE_RE.source, "g");
  let match;
  while ((match = re.exec(src))) {
    const l = Number(match[1]);
    const w = Number(match[2]);
    const h = Number(match[3]);
    if (!(l > 0 && w > 0 && h > 0)) continue;
    const qtyRaw = match[4];
    const qty = qtyRaw == null || qtyRaw === "" ? "" : Math.max(0, Math.floor(Number(qtyRaw)));
    items.push({
      id: uid("box"),
      name: `${l}×${w}×${h}`,
      l,
      w,
      h,
      qty: qty === "" || qty <= 0 ? "" : qty,
      allowFlip: true,
    });
  }
  if (!items.length) {
    return {
      ok: false,
      message: "没有识别到有效尺寸。格式：长*宽*高*件数，例如 120*80*100*2，可一次粘贴多行",
      items: [],
    };
  }
  return { ok: true, items, message: `已添加 ${items.length} 种货物` };
}

export function addCargosFromPaste(text) {
  const parsed = parseCargoPaste(text);
  if (!parsed.ok) return parsed;
  const keep = (config.cargos || []).filter((row) => !isBlankCargo(row));
  config.cargos = [...keep, ...parsed.items];
  return parsed;
}

export function addResultCargosFromPaste(result, text) {
  if (!result) return { ok: false, message: "没有可编辑的方案" };
  const parsed = parseCargoPaste(text);
  if (!parsed.ok) return parsed;
  const current = Array.isArray(result.cargos) ? result.cargos : [];
  result.cargos = [...current.filter((row) => !isBlankCargo(row)), ...parsed.items];
  return parsed;
}

export function setAllCargoFlip(on) {
  config.cargos = config.cargos.map((row) => ({ ...row, allowFlip: Boolean(on) }));
}

export function removeCargoRow(id) {
  if (config.cargos.length <= 1) {
    config.cargos = [emptyCargo()];
    return;
  }
  config.cargos = config.cargos.filter((row) => row.id !== id);
}

export function setGroupSelectMode(mode) {
  config.groupSelectMode = mode === "single" ? "single" : "multi";
  const board = activeBoard.value;
  if (!board) return;
  if (config.groupSelectMode === "single") {
    config.selectedGroupIds = board.groups[0] ? [board.groups[0].id] : [];
  } else {
    config.selectedGroupIds = board.groups.map((g) => g.id);
  }
}

export function toggleGroup(id, on) {
  const board = activeBoard.value;
  if (!board) return;
  if (config.groupSelectMode === "single") {
    config.selectedGroupIds = [id];
    return;
  }
  const set = new Set(config.selectedGroupIds);
  if (on) set.add(id);
  else set.delete(id);
  config.selectedGroupIds = [...set];
}

export function selectAllGroups() {
  const board = activeBoard.value;
  if (!board) return;
  if (config.groupSelectMode === "single") {
    config.selectedGroupIds = board.groups[0] ? [board.groups[0].id] : [];
    return;
  }
  config.selectedGroupIds = board.groups.map((g) => g.id);
}

export function selectBoard(index) {
  const result = activeResult.value;
  if (!result?.boards?.length) return;
  config.activeBoardIndex = Math.min(Math.max(index, 0), result.boards.length - 1);
  selectAllGroups();
}

function snapshotCargos() {
  return config.cargos.map((row) => ({
    id: row.id,
    name: row.name,
    l: Number(row.l) || 0,
    w: Number(row.w) || 0,
    h: Number(row.h) || 0,
    qty: row.qty === "" || row.qty == null ? "" : Number(row.qty),
    allowFlip: Boolean(row.allowFlip),
  }));
}

function snapshotPalletQty() {
  const qty = {};
  for (const id of config.calcPalletIds) {
    qty[id] = palletQty(id);
  }
  return qty;
}

function cargoListFromGroups(groups) {
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
    if (!prev.color) prev.color = group.color;
    map.set(key, prev);
  }
  return [...map.values()];
}

function applyPackToResult(result, boards, leftover, inputs) {
  let colorIndex = 0;
  result.boards = boards.map((board, boardIndex) => {
    const groups = board.groups.map((group, groupIndex) => ({
      ...group,
      id: `b${boardIndex}-g${groupIndex + 1}`,
      color: GROUP_COLORS[colorIndex++ % GROUP_COLORS.length],
    }));
    return {
      ...board,
      groups,
      packingList: cargoListFromGroups(groups),
    };
  });
  result.palletIds = [...(inputs.palletIds || [])];
  result.palletQtys = { ...(inputs.palletQtys || {}) };
  result.flushEdge = Boolean(inputs.flushEdge);
  result.palletName = [...new Set(result.boards.map((b) => b.palletName))].join("、");
  result.cargos = (inputs.cargos || []).map((row) => ({ ...row }));
  result.allowFlip = result.cargos.some((row) => row.allowFlip);
  result.packingList = result.boards.map((board) => ({
    label: board.label || board.palletName,
    palletName: board.palletName,
    packedCount: board.packedCount,
    items: board.packingList,
  }));
  result.leftover = leftover || [];
  result.packedCount = result.boards.reduce((sum, b) => sum + b.packedCount, 0);
  result.packedVolume = result.boards.reduce((sum, b) => sum + b.packedVolume, 0);
  result.capacity = result.boards.reduce((sum, b) => sum + b.capacity, 0);
  result.utilization = result.capacity > 0 ? result.packedVolume / result.capacity : 0;
  result.updatedAt = Date.now();
}

function currentPackInputs() {
  return {
    palletIds: config.calcPalletIds.slice(),
    palletQtys: snapshotPalletQty(),
    cargos: snapshotCargos(),
    flushEdge: Boolean(config.flushEdge),
  };
}

function resultPackInputs(result) {
  return {
    palletIds: result.palletIds?.length ? result.palletIds.slice() : config.calcPalletIds.slice(),
    palletQtys: { ...(result.palletQtys || snapshotPalletQty()) },
    cargos: Array.isArray(result.cargos) && result.cargos.length ? result.cargos.map((row) => ({ ...row })) : snapshotCargos(),
    flushEdge: Boolean(result.flushEdge),
  };
}

function runPack(inputs, { requireEnabled = true } = {}) {
  const selected = inputs.palletIds
    .map((id) => enabledPallets.value.find((p) => p.id == id) || pallets.find((p) => p.id == id))
    .filter((item) => item && (!requireEnabled || isEnabled(item.id)));
  if (!selected.length) {
    return { ok: false, message: "请至少选择一个已启用的集装箱型号" };
  }
  const missingQty = selected.filter((item) => !Number(inputs.palletQtys?.[item.id] ?? inputs.palletQtys?.[String(item.id)]));
  if (missingQty.length) {
    return { ok: false, message: "请填写各型号集装箱的数量（至少 1）" };
  }
  const valid = (inputs.cargos || []).filter((row) => Number(row.l) > 0 && Number(row.w) > 0 && Number(row.h) > 0);
  if (!valid.length) {
    return { ok: false, message: "请至少填写一组货物的长宽高" };
  }
  const packed = packScheme(selected, valid, {
    qtyMap: inputs.palletQtys,
    flushEdge: Boolean(inputs.flushEdge),
  });
  if (!packed.boards.length) {
    return { ok: false, message: "当前货物无法装入所选板型，请检查尺寸、数量、贴边或翻转" };
  }
  return { ok: true, packed, inputs: { ...inputs, cargos: valid.length ? inputs.cargos : valid } };
}

export function runCalculate({ overwrite = false } = {}) {
  const packedRun = runPack(currentPackInputs());
  if (!packedRun.ok) return packedRun;

  const now = Date.now();
  if (overwrite && activeResult.value) {
    applyPackToResult(activeResult.value, packedRun.packed.boards, packedRun.packed.leftover, packedRun.inputs);
  } else {
    const result = {
      id: uid("plan"),
      name: `方案 ${config.results.length + 1}`,
      createdAt: now,
    };
    applyPackToResult(result, packedRun.packed.boards, packedRun.packed.leftover, packedRun.inputs);
    config.results.unshift(result);
    config.activeResultId = result.id;
  }
  config.activeBoardIndex = 0;
  const current = activeResult.value;
  config.groupSelectMode = "multi";
  config.selectedGroupIds = current.boards[0]?.groups.map((g) => g.id) || [];
  return { ok: true, result: current };
}

export function recalculateResult(result) {
  if (!result) return { ok: false, message: "没有可更新的方案" };
  const packedRun = runPack(resultPackInputs(result), { requireEnabled: false });
  if (!packedRun.ok) return packedRun;
  applyPackToResult(result, packedRun.packed.boards, packedRun.packed.leftover, {
    ...packedRun.inputs,
    cargos: result.cargos,
    palletIds: result.palletIds,
    palletQtys: result.palletQtys,
    flushEdge: result.flushEdge,
  });
  if (result.id === config.activeResultId) {
    config.flushEdge = Boolean(result.flushEdge);
    config.calcPalletIds = result.palletIds?.slice() || config.calcPalletIds;
    config.calcPalletQty = { ...(result.palletQtys || {}) };
    config.cargos = result.cargos?.length ? result.cargos.map((row) => ({ ...row })) : config.cargos;
    config.activeBoardIndex = Math.min(config.activeBoardIndex, Math.max(0, result.boards.length - 1));
    selectAllGroups();
  }
  return { ok: true, result };
}

export function addResultCargo(result) {
  if (!result) return;
  if (!Array.isArray(result.cargos)) result.cargos = [];
  result.cargos.push(emptyCargo());
}

export function removeResultCargo(result, id) {
  if (!result) return;
  if (!result.cargos || result.cargos.length <= 1) {
    result.cargos = [emptyCargo()];
    return;
  }
  result.cargos = result.cargos.filter((row) => row.id !== id);
}

export function setResultAllFlip(result, on) {
  if (!result?.cargos) return;
  result.cargos = result.cargos.map((row) => ({ ...row, allowFlip: Boolean(on) }));
}

export function setResultPalletQty(result, id, value) {
  if (!result) return;
  const qty = Math.min(50, Math.max(1, Math.floor(Number(value) || 1)));
  result.palletQtys = { ...(result.palletQtys || {}), [id]: qty };
}

export function selectResult(id) {
  config.activeResultId = id;
  const result = activeResult.value;
  if (!result) return;
  const ids = result.palletIds?.length ? result.palletIds : result.boards?.map((b) => b.palletId) || [];
  config.calcPalletIds = [...new Set(ids.filter(Boolean))];
  const qty = { ...(result.palletQtys || {}) };
  if (!Object.keys(qty).length) {
    for (const board of result.boards || []) {
      qty[board.palletId] = (qty[board.palletId] || 0) + 1;
    }
  }
  config.calcPalletQty = qty;
  config.flushEdge = Boolean(result.flushEdge);
  config.cargos = result.cargos?.length
    ? result.cargos.map((row) => ({
        ...row,
        allowFlip: row.allowFlip != null ? Boolean(row.allowFlip) : Boolean(result.allowFlip),
      }))
    : [emptyCargo()];
  config.activeBoardIndex = 0;
  if (config.groupSelectMode === "single") {
    config.selectedGroupIds = result.boards?.[0]?.groups[0] ? [result.boards[0].groups[0].id] : [];
  } else {
    config.selectedGroupIds = result.boards?.[0]?.groups.map((g) => g.id) || [];
  }
}

export function renameResult(id, name) {
  const result = config.results.find((r) => r.id === id);
  if (!result) return;
  result.name = String(name || "").trim() || result.name;
  result.updatedAt = Date.now();
}

export function deleteResult(id) {
  config.results = config.results.filter((r) => r.id !== id);
  if (config.activeResultId === id) {
    config.activeResultId = config.results[0]?.id ?? null;
    if (config.activeResultId) selectResult(config.activeResultId);
    else config.selectedGroupIds = [];
  }
}

export function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
