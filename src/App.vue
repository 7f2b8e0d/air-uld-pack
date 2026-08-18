<template>
  <div class="app" :data-tab="tab">
    <header class="topbar">
      <div class="brand">
        <span class="mark" aria-hidden="true"></span>
        <div>
          <strong>空运装箱</strong>
          <small>{{ tabHint }}</small>
        </div>
      </div>
      <nav class="tabs" aria-label="功能标签">
        <button type="button" :class="{ on: tab === 'config' }" @click="tab = 'config'">
          配置中心
        </button>
        <button type="button" :class="{ on: tab === 'table' }" @click="tab = 'table'">
          集装箱
        </button>
        <button type="button" :class="{ on: tab === 'calc' }" @click="tab = 'calc'">
          计算摆法
        </button>
        <button type="button" :class="{ on: tab === 'result' }" @click="tab = 'result'">
          装货方案
          <em v-if="resultCount">{{ resultCount }}</em>
        </button>
      </nav>
    </header>

    <div class="workspace">
      <ConfigPanel v-show="tab === 'config'" class="pane pane-config" />
      <PalletTable v-show="tab === 'table'" class="pane pane-table" />
      <CargoForm v-show="tab === 'calc'" class="pane pane-calc" />
      <ResultPanel v-show="tab === 'result'" class="pane pane-result" />
    </div>

    <Modal
      :open="Boolean(previewPallet)"
      :title="previewPallet ? `${previewPallet.airplane} · ${previewPallet.pallet}` : ''"
      subtitle="集装箱轮廓与尺寸"
      @close="closePalletPreview"
    >
      <Viewer3D v-if="previewPallet" :pallet="previewPallet" />
    </Modal>
  </div>
</template>

<script setup>
import { computed, provide, ref } from "vue";
import ConfigPanel from "./components/ConfigPanel.vue";
import PalletTable from "./components/PalletTable.vue";
import CargoForm from "./components/CargoForm.vue";
import ResultPanel from "./components/ResultPanel.vue";
import Viewer3D from "./components/Viewer3D.vue";
import Modal from "./components/Modal.vue";
import { closePalletPreview, config, previewPallet } from "./state.js";

const tab = ref("config");
const hints = {
  config: "启用后续计算要用的集装箱型号",
  table: "查看尺寸数据，点 3D 预览轮廓",
  calc: "选择多种板型并录入货物后计算最大装货",
  result: "方案表格里改参数，点 3D 看装载图",
};
const tabHint = computed(() => hints[tab.value]);
const resultCount = computed(() => config.results.length);

provide("setTab", (name) => {
  tab.value = name;
});
</script>
