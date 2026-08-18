<template>
  <section class="result-panel">
    <div class="table-head">
      <div>
        <h2>装货方案</h2>
        <p>点一行查看并修改参数。改货物、数量、贴边或翻转后会自动重算，点「3D」看装载图。</p>
      </div>
      <div v-if="activeResult" class="toolbar-actions">
        <button type="button" class="primary sm" @click="openPlan(activeResult.id)">打开 3D</button>
        <button type="button" class="ghost sm danger" @click="deleteResult(activeResult.id)">删除当前</button>
      </div>
    </div>

    <div class="result-body">
      <div class="result-split">
        <div class="plan-table-wrap">
          <table class="plan-table">
            <thead>
              <tr>
                <th>方案</th>
                <th>集装箱</th>
                <th>货物</th>
                <th>贴边</th>
                <th>翻转</th>
                <th class="num">板</th>
                <th class="num">件</th>
                <th class="num">利用率</th>
                <th>更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in config.results"
                :key="item.id"
                :class="{ current: item.id === config.activeResultId }"
                @click="focusPlan(item.id)"
              >
                <td>
                  <input
                    class="cell-input"
                    :value="item.name"
                    @click.stop
                    @change="renameResult(item.id, $event.target.value)"
                  />
                </td>
                <td>
                  <div class="stack-cell">
                    <span v-for="row in fleetRows(item)" :key="row.name">{{ row.name }} ×{{ row.count }}</span>
                    <span v-if="!fleetRows(item).length">—</span>
                  </div>
                </td>
                <td>
                  <div class="stack-cell">
                    <span v-for="row in cargoRows(item)" :key="row.id">
                      {{ row.name }} {{ row.l }}×{{ row.w }}×{{ row.h }} ×{{ row.qtyText }}{{ row.allowFlip ? " 翻" : "" }}
                    </span>
                    <span v-if="!cargoRows(item).length">—</span>
                  </div>
                </td>
                <td class="col-check" @click.stop>
                  <label class="check">
                    <input
                      type="checkbox"
                      :checked="Boolean(item.flushEdge)"
                      @change="onFlushEdge(item, $event.target.checked)"
                    />
                    <span>{{ item.flushEdge ? "贴边" : "不贴边" }}</span>
                  </label>
                </td>
                <td>{{ flipSummary(item) }}</td>
                <td class="num">{{ item.boards?.length || 0 }}</td>
                <td class="num">{{ item.packedCount || 0 }}</td>
                <td class="num">{{ ((item.utilization || 0) * 100).toFixed(1) }}%</td>
                <td>{{ formatTime(item.updatedAt) }}</td>
                <td class="col-actions" @click.stop>
                  <button type="button" class="primary sm" @click="openPlan(item.id)">3D</button>
                  <button type="button" class="ghost sm danger" @click="deleteResult(item.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!config.results.length" class="empty">还没有方案，请先到「计算摆法」生成</p>
        </div>

        <div v-if="activeResult" class="result-detail">
          <div class="detail-head">
            <div>
              <strong>{{ activeResult.name }}</strong>
              <span>
                {{ activeResult.packedCount || 0 }} 件 · {{ activeResult.boards?.length || 0 }} 块板 ·
                利用率 {{ ((activeResult.utilization || 0) * 100).toFixed(1) }}%
              </span>
            </div>
            <p v-if="editMessage" class="msg warn">{{ editMessage }}</p>
          </div>

          <div class="detail-grid">
            <div class="detail-block">
              <div class="picker-head">
                <span>集装箱</span>
                <label class="check">
                  <input v-model="activeResult.flushEdge" type="checkbox" @change="recalcNow" />
                  贴边
                </label>
              </div>
              <div class="cargo-table-wrap">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>机型 / 板型</th>
                      <th>外径 cm</th>
                      <th class="num">数量</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activePallets" :key="row.id">
                      <td>{{ row.label }}</td>
                      <td>{{ row.size }}</td>
                      <td>
                        <input
                          class="cell-input num-input"
                          :value="row.qty"
                          type="number"
                          min="1"
                          max="50"
                          @change="onPalletQty(row.id, $event.target.value)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="detail-block">
              <div class="picker-head">
                <span>货物参数</span>
                <div class="toolbar-actions">
                  <button type="button" class="ghost sm" @click="flipAll(true)">全部可翻转</button>
                  <button type="button" class="ghost sm" @click="flipAll(false)">全部不翻转</button>
                  <button type="button" class="ghost sm" @click="addRow">添加</button>
                </div>
              </div>
              <div class="batch-paste compact">
                <textarea
                  v-model="batchText"
                  rows="2"
                  placeholder="粘贴批量添加：120*80*100*2"
                ></textarea>
                <button type="button" class="ghost sm" @click="onBatchAdd">粘贴添加</button>
              </div>
              <div class="cargo-table-wrap">
                <table class="cargo-table">
                  <thead>
                    <tr>
                      <th>型号名</th>
                      <th class="num">长 cm</th>
                      <th class="num">宽 cm</th>
                      <th class="num">高 cm</th>
                      <th class="num">数量</th>
                      <th>可翻转</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in activeResult.cargos || []" :key="row.id">
                      <td>
                        <input v-model.trim="row.name" class="cell-input" type="text" placeholder="如 A 箱" @input="scheduleRecalc" />
                      </td>
                      <td>
                        <input v-model="row.l" class="cell-input num-input" type="number" min="1" step="0.1" @input="scheduleRecalc" />
                      </td>
                      <td>
                        <input v-model="row.w" class="cell-input num-input" type="number" min="1" step="0.1" @input="scheduleRecalc" />
                      </td>
                      <td>
                        <input v-model="row.h" class="cell-input num-input" type="number" min="1" step="0.1" @input="scheduleRecalc" />
                      </td>
                      <td>
                        <input v-model="row.qty" class="cell-input num-input" type="number" min="0" step="1" placeholder="满" @input="scheduleRecalc" />
                      </td>
                      <td class="col-check">
                        <input v-model="row.allowFlip" type="checkbox" @change="recalcNow" />
                      </td>
                      <td>
                        <button type="button" class="ghost sm" @click="removeRow(row.id)">删</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="detail-block">
            <div class="picker-head">
              <span>装箱结果</span>
            </div>
            <div class="cargo-table-wrap">
              <table class="cargo-table pack-result-table">
                <thead>
                  <tr>
                    <th>集装箱</th>
                    <th>货物</th>
                    <th>尺寸 cm</th>
                    <th>朝向</th>
                    <th class="num">件数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in packingRows" :key="row.key">
                    <td>{{ row.board }}</td>
                    <td>
                      <i class="swatch" :style="{ background: row.color }"></i>
                      {{ row.name }}
                    </td>
                    <td>{{ row.size }}</td>
                    <td>{{ row.orient }}</td>
                    <td class="num">{{ row.count }}</td>
                  </tr>
                  <tr v-for="row in activeResult.leftover || []" :key="'left-' + row.cargoId" class="is-left">
                    <td>未装入</td>
                    <td>{{ row.name }}</td>
                    <td>{{ row.l }}×{{ row.w }}×{{ row.h }}</td>
                    <td>—</td>
                    <td class="num">余 {{ row.leftover }}/{{ row.requested }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!packingRows.length" class="empty">暂无装箱结果</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Modal
      :wide="true"
      :open="previewOpen && Boolean(activeResult)"
      :title="activeResult?.name || '装载预览'"
      :subtitle="previewSubtitle"
      @close="previewOpen = false"
    >
      <div v-if="activeResult" class="plan-preview">
        <div class="plan-preview-side">
          <div class="result-meta">
            <strong>{{ activeResult.packedCount }}</strong>
            <span>
              件 · {{ activeResult.boards?.length || 0 }} 块板 ·
              {{ ((activeResult.utilization || 0) * 100).toFixed(1) }}%
            </span>
          </div>

          <div class="board-tabs">
            <button
              v-for="(board, index) in activeResult.boards"
              :key="(board.label || board.palletId) + '-' + index"
              type="button"
              class="ghost sm"
              :class="{ on: index === config.activeBoardIndex }"
              @click="selectBoard(index)"
            >
              {{ board.label || board.palletName }} · {{ board.packedCount }} 件
            </button>
          </div>

          <div class="cargo-table-wrap">
            <table class="cargo-table pack-result-table">
              <thead>
                <tr>
                  <th>货物</th>
                  <th>朝向</th>
                  <th class="num">件</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activeBoard?.packingList || []" :key="row.cargoId + row.l + row.w + row.h">
                  <td>
                    <i class="swatch" :style="{ background: row.color }"></i>
                    {{ row.name }}
                  </td>
                  <td>
                    <template v-if="row.flipped && row.origL">
                      {{ row.origL }}×{{ row.origW }}×{{ row.origH }} → {{ row.l }}×{{ row.w }}×{{ row.h }} 翻转
                    </template>
                    <template v-else>{{ row.l }}×{{ row.w }}×{{ row.h }}</template>
                  </td>
                  <td class="num">{{ row.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="select-bar">
            <span>分组</span>
            <button type="button" class="ghost sm" :class="{ on: config.groupSelectMode === 'single' }" @click="setGroupSelectMode('single')">
              单选
            </button>
            <button type="button" class="ghost sm" :class="{ on: config.groupSelectMode === 'multi' }" @click="setGroupSelectMode('multi')">
              多选
            </button>
            <button v-if="config.groupSelectMode === 'multi'" type="button" class="ghost sm" @click="selectAllGroups">全选</button>
          </div>
          <ul class="legend">
            <li v-for="group in activeBoard?.groups || []" :key="group.id">
              <label class="check">
                <input
                  :type="config.groupSelectMode === 'single' ? 'radio' : 'checkbox'"
                  name="pack-group"
                  :checked="config.selectedGroupIds.includes(group.id)"
                  @change="toggleGroup(group.id, $event.target.checked)"
                />
                <i class="swatch" :style="{ background: group.color }"></i>
                <span>{{ group.name }}</span>
              </label>
              <em>{{ group.count }} 件 · {{ group.l }}×{{ group.w }}×{{ group.h }}{{ group.flipped ? " 翻转" : "" }}</em>
            </li>
          </ul>
        </div>
        <PackViewer3D v-if="previewOpen" :pallet="resultPallet" :groups="visibleGroups" />
      </div>
    </Modal>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref } from "vue";
import PackViewer3D from "./PackViewer3D.vue";
import Modal from "./Modal.vue";
import {
  activeBoard,
  activeResult,
  addResultCargo,
  addResultCargosFromPaste,
  config,
  deleteResult,
  formatTime,
  pallets,
  recalculateResult,
  removeResultCargo,
  renameResult,
  selectAllGroups,
  selectBoard,
  selectResult,
  setGroupSelectMode,
  setResultAllFlip,
  setResultPalletQty,
  toggleGroup,
  visibleGroups,
} from "../state.js";

const previewOpen = ref(false);
const editMessage = ref("");
const batchText = ref("");
let timer = 0;

const resultPallet = computed(
  () => pallets.find((p) => p.id == activeBoard.value?.palletId) || null
);

const previewSubtitle = computed(() => {
  if (!activeResult.value) return "";
  const n = activeResult.value.cargos?.filter((row) => row.allowFlip).length || 0;
  const total = activeResult.value.cargos?.length || 0;
  const flip = total && n === total ? "均可翻转" : n ? `${n} 种可翻转` : "均不可翻转";
  const edge = activeResult.value.flushEdge ? "贴边" : "不贴边";
  return `${activeResult.value.palletName || ""} · ${edge} · ${flip}`;
});

const activePallets = computed(() => {
  const result = activeResult.value;
  if (!result) return [];
  return (result.palletIds || []).map((id) => {
    const item = pallets.find((p) => p.id == id);
    return {
      id,
      label: item ? `${item.airplane} / ${item.pallet}` : `板 ${id}`,
      size: item ? `${item.baseOuterLengthCm}×${item.baseOuterWidthCm}×${item.heightCm}` : "—",
      qty: result.palletQtys?.[id] ?? result.palletQtys?.[String(id)] ?? 1,
    };
  });
});

const packingRows = computed(() => {
  const result = activeResult.value;
  if (!result?.packingList?.length) return [];
  const rows = [];
  for (const block of result.packingList) {
    for (const row of block.items || []) {
      rows.push({
        key: `${block.label}-${row.cargoId}-${row.l}x${row.w}x${row.h}-${row.flipped ? 1 : 0}`,
        board: block.label,
        name: row.name,
        color: row.color,
        size: row.flipped && row.origL ? `${row.origL}×${row.origW}×${row.origH}` : `${row.l}×${row.w}×${row.h}`,
        orient: row.flipped && row.origL ? `${row.l}×${row.w}×${row.h} 翻转` : "立放",
        count: row.count,
      });
    }
  }
  return rows;
});

function fleetRows(item) {
  const map = new Map();
  for (const board of item.boards || []) {
    const name = board.palletName || "集装箱";
    map.set(name, (map.get(name) || 0) + 1);
  }
  if (map.size) return [...map.entries()].map(([name, count]) => ({ name, count }));
  return (item.palletIds || []).map((id) => {
    const pallet = pallets.find((p) => p.id == id);
    return {
      name: pallet ? `${pallet.airplane} / ${pallet.pallet}` : `板 ${id}`,
      count: item.palletQtys?.[id] || 1,
    };
  });
}

function cargoRows(item) {
  return (item.cargos || [])
    .filter((row) => Number(row.l) > 0 && Number(row.w) > 0 && Number(row.h) > 0)
    .map((row) => ({
      id: row.id,
      name: row.name || "未命名",
      l: row.l,
      w: row.w,
      h: row.h,
      qtyText: row.qty === "" || row.qty == null || Number(row.qty) <= 0 ? "满" : Number(row.qty),
      allowFlip: Boolean(row.allowFlip),
    }));
}

function flipSummary(item) {
  const rows = item.cargos || [];
  const n = rows.filter((row) => row.allowFlip).length;
  if (!rows.length || !n) return "均不可翻转";
  if (n === rows.length) return "均可翻转";
  return `${n}/${rows.length} 可翻转`;
}

function applyRecalc() {
  const result = activeResult.value;
  if (!result) return;
  const res = recalculateResult(result);
  editMessage.value = res.ok ? "" : res.message;
}

function scheduleRecalc() {
  clearTimeout(timer);
  timer = window.setTimeout(applyRecalc, 400);
}

function recalcNow() {
  clearTimeout(timer);
  applyRecalc();
}

function onFlushEdge(item, on) {
  item.flushEdge = Boolean(on);
  selectResult(item.id);
  recalcNow();
}

function onPalletQty(id, value) {
  setResultPalletQty(activeResult.value, id, value);
  recalcNow();
}

function addRow() {
  addResultCargo(activeResult.value);
}

function onBatchAdd() {
  const res = addResultCargosFromPaste(activeResult.value, batchText.value);
  editMessage.value = res.ok ? "" : res.message;
  if (!res.ok) return;
  batchText.value = "";
  recalcNow();
}

function removeRow(id) {
  removeResultCargo(activeResult.value, id);
  recalcNow();
}

function flipAll(on) {
  setResultAllFlip(activeResult.value, on);
  recalcNow();
}

function focusPlan(id) {
  selectResult(id);
  editMessage.value = "";
}

function openPlan(id) {
  selectResult(id);
  editMessage.value = "";
  applyRecalc();
  previewOpen.value = true;
}

onUnmounted(() => clearTimeout(timer));
</script>
