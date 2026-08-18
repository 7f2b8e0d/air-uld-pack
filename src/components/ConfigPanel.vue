<template>
  <aside class="config">
    <div class="config-head">
      <div>
        <h2>配置中心</h2>
        <p>选择后续装箱计算要使用的箱型，设置保存在本机浏览器。</p>
      </div>
      <div class="stat">
        <strong>{{ enabledCount }}</strong>
        <span>/ {{ total }} 已启用</span>
      </div>
    </div>

    <div class="toolbar">
      <label class="search">
        <span>筛选</span>
        <input v-model.trim="keyword" type="search" placeholder="机型 / 板型" />
      </label>
      <div class="toolbar-actions">
        <button type="button" class="ghost" @click="setAllEnabled(true)">全部启用</button>
        <button type="button" class="ghost" @click="setAllEnabled(false)">全部停用</button>
      </div>
    </div>

    <div class="groups">
      <section v-for="group in visibleGroups" :key="group.airplane" class="group">
        <header class="group-head">
          <label class="check">
            <input
              type="checkbox"
              :checked="group.allOn"
              :indeterminate.prop="!group.allOn && !group.allOff"
              @change="setGroupEnabled(group.items.map((i) => i.id), $event.target.checked)"
            />
            <span class="plane">{{ group.airplane }}</span>
          </label>
          <span class="count">{{ group.enabledCount }}/{{ group.total }}</span>
        </header>
        <ul>
          <li
            v-for="item in group.items"
            :key="item.id"
            :class="{ on: isEnabled(item.id), off: !isEnabled(item.id), current: item.id === config.selectedId }"
            @click="selectPallet(item.id)"
          >
            <label class="check" @click.stop>
              <input
                type="checkbox"
                :checked="isEnabled(item.id)"
                @change="setEnabled(item.id, $event.target.checked)"
              />
              <span class="name">{{ item.pallet }}</span>
            </label>
            <span class="size">{{ item.baseOuterLengthCm }}×{{ item.baseOuterWidthCm }}×{{ item.heightCm }}</span>
          </li>
        </ul>
      </section>
      <p v-if="!visibleGroups.length" class="empty">没有匹配的箱型</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  airplaneGroups,
  config,
  enabledPallets,
  isEnabled,
  pallets,
  selectPallet,
  setAllEnabled,
  setEnabled,
  setGroupEnabled,
} from "../state.js";

const keyword = ref("");
const total = pallets.length;
const enabledCount = computed(() => enabledPallets.value.length);

const visibleGroups = computed(() => {
  const q = keyword.value.toLowerCase();
  if (!q) return airplaneGroups.value;
  return airplaneGroups.value
    .map((group) => {
      const items = group.items.filter((item) => {
        const hay = `${item.airplane} ${item.pallet} ${item.typeLabel} ${item.airlines}`.toLowerCase();
        return hay.includes(q);
      });
      if (!items.length) return null;
      const enabled = items.filter((item) => isEnabled(item.id)).length;
      return {
        ...group,
        items,
        total: items.length,
        enabledCount: enabled,
        allOn: enabled === items.length,
        allOff: enabled === 0,
      };
    })
    .filter(Boolean);
});
</script>
