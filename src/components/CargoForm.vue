<template>
  <section class="calc-panel">
    <div class="table-head">
      <div>
        <h2>计算摆法</h2>
        <p>「集装箱」页启用的型号会自动出现在这里，只需填写每种数量后计算。</p>
      </div>
    </div>

    <div class="calc-body">
      <div class="picker-head">
        <span>集装箱型号 · {{ calcPallets.length }}</span>
      </div>
      <p v-if="!calcPallets.length" class="warn">请先在「集装箱」页启用型号</p>
      <div v-else class="pallet-pick">
        <div v-for="item in calcPallets" :key="item.id" class="pick-item on">
          <span class="pick-copy">
            <strong>{{ item.airplane }} / {{ item.pallet }}</strong>
            <small>{{ item.baseOuterLengthCm }}×{{ item.baseOuterWidthCm }}×{{ item.heightCm }} cm</small>
          </span>
          <span class="qty-field">
            <em>数量</em>
            <input
              :value="palletQty(item.id)"
              type="number"
              min="1"
              max="50"
              required
              @change="setPalletQty(item.id, $event.target.value)"
            />
          </span>
        </div>
      </div>

      <label class="switch">
        <input v-model="config.flushEdge" type="checkbox" />
        <span>
          <strong>贴边装箱</strong>
          <small>勾选后货物贴集装箱外轮廓。不勾选则长宽各留约 5cm，例如 318×244×290 按 308×234×290 计算，高度不变。</small>
        </span>
      </label>

      <div class="picker-head">
        <span>待装货物 · {{ config.cargos.length }} 种</span>
        <div class="toolbar-actions">
          <button type="button" class="ghost sm" @click="setAllCargoFlip(true)">全部可翻转</button>
          <button type="button" class="ghost sm" @click="setAllCargoFlip(false)">全部不翻转</button>
          <button type="button" class="ghost sm" @click="addCargoRow">添加货物</button>
          <button type="button" class="ghost sm danger" @click="onClearCargos">清空货物</button>
        </div>
      </div>
      <div class="batch-paste">
        <textarea
          v-model="batchText"
          rows="3"
          placeholder="粘贴批量添加，每行一种：长*宽*高*件数&#10;120*80*100*2&#10;90*60*50*3"
        ></textarea>
        <button type="button" class="ghost sm" @click="onBatchAdd">粘贴添加</button>
      </div>
      <p v-if="batchMessage" :class="['msg', batchOk ? 'ok' : 'warn']">{{ batchMessage }}</p>
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
            <tr v-for="row in config.cargos" :key="row.id">
              <td>
                <input v-model.trim="row.name" type="text" placeholder="如 A 箱" />
              </td>
              <td>
                <input v-model="row.l" type="number" min="1" step="0.1" placeholder="长" />
              </td>
              <td>
                <input v-model="row.w" type="number" min="1" step="0.1" placeholder="宽" />
              </td>
              <td>
                <input v-model="row.h" type="number" min="1" step="0.1" placeholder="高" />
              </td>
              <td>
                <input v-model="row.qty" type="number" min="0" step="1" placeholder="不填=尽量装满" />
              </td>
              <td class="col-check">
                <input v-model="row.allowFlip" type="checkbox" title="勾选后可把 120×80×150 翻成 150×120×80 等朝向，算法会翻转部分或全部以尽量多装" />
              </td>
              <td>
                <button type="button" class="ghost sm" @click="removeCargoRow(row.id)">删</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="hint">新货物默认可翻转。批量格式：长*宽*高*件数，可一次粘贴多行。贴边：贴外轮廓；不贴边则长宽各留约 5cm。</p>

      <div class="calc-actions">
        <button type="button" class="primary" @click="onCreate">计算新方案</button>
        <button type="button" class="ghost" :disabled="!activeResult" @click="onUpdate">更新当前方案</button>
      </div>
      <p v-if="message" :class="['msg', ok ? 'ok' : 'warn']">{{ message }}</p>
    </div>
  </section>
</template>

<script setup>
import { inject, ref } from "vue";
import {
  activeResult,
  addCargoRow,
  addCargosFromPaste,
  clearAllCargos,
  calcPallets,
  config,
  palletQty,
  removeCargoRow,
  runCalculate,
  setAllCargoFlip,
  setPalletQty,
} from "../state.js";

const setTab = inject("setTab", () => {});
const message = ref("");
const ok = ref(false);
const batchText = ref("");
const batchMessage = ref("");
const batchOk = ref(false);

function onBatchAdd() {
  const res = addCargosFromPaste(batchText.value);
  batchOk.value = res.ok;
  batchMessage.value = res.message;
  if (res.ok) batchText.value = "";
}

function onClearCargos() {
  if (!window.confirm("清空计算页里的全部货物？")) return;
  clearAllCargos();
  batchText.value = "";
  batchMessage.value = "已清空货物";
  batchOk.value = true;
}

function onCreate() {
  const res = runCalculate({ overwrite: false });
  ok.value = res.ok;
  message.value = res.ok
    ? `已生成「${res.result.name}」，${res.result.boards.length} 块板，共 ${res.result.packedCount} 件，利用率 ${(res.result.utilization * 100).toFixed(1)}%`
    : res.message;
  if (res.ok) setTab("result");
}

function onUpdate() {
  const res = runCalculate({ overwrite: true });
  ok.value = res.ok;
  message.value = res.ok
    ? `已更新「${res.result.name}」，${res.result.boards.length} 块板，共 ${res.result.packedCount} 件，利用率 ${(res.result.utilization * 100).toFixed(1)}%`
    : res.message;
  if (res.ok) setTab("result");
}
</script>
