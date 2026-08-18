<template>
  <section class="table-panel">
    <div class="table-head">
      <div>
        <h2>集装箱型号</h2>
        <p>启用后才会出现在「计算摆法」里。点「3D」看轮廓和尺寸刻度。</p>
      </div>
      <div class="stat">
        <strong>{{ enabledCount }}</strong>
        <span>/ {{ total }} 已启用</span>
      </div>
    </div>

    <div class="toolbar">
      <label class="search">
        <span>搜索</span>
        <input v-model.trim="keyword" type="search" placeholder="机型、板型、尺寸…" />
      </label>
      <div class="toolbar-actions">
        <button type="button" class="ghost sm" @click="setAllEnabled(true)">全部启用</button>
        <button type="button" class="ghost sm" @click="setAllEnabled(false)">全部停用</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-check">启用</th>
            <th>航司</th>
            <th>机型</th>
            <th>板型</th>
            <th class="num">长 cm</th>
            <th class="num">宽 cm</th>
            <th class="num">高 cm</th>
            <th class="num">过渡高 cm</th>
            <th class="num">体积 m³</th>
            <th>轮廓</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in visibleGroups" :key="group.airplane">
            <tr class="plane-row">
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="group.allOn"
                  :indeterminate.prop="!group.allOn && !group.allOff"
                  @change="setGroupEnabled(group.items.map((i) => i.id), $event.target.checked)"
                />
              </td>
              <td colspan="10">
                <strong>{{ group.airplane }}</strong>
                <small>{{ group.enabledCount }}/{{ group.total }}</small>
              </td>
            </tr>
            <tr
              v-for="item in group.items"
              :key="item.id"
              :class="{ current: item.id === config.selectedId, off: !isEnabled(item.id) }"
              @click="config.selectedId = item.id"
            >
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="isEnabled(item.id)"
                  @change="setEnabled(item.id, $event.target.checked)"
                />
              </td>
              <td>{{ item.airlines }}</td>
              <td>{{ item.airplane }}</td>
              <td>
                <strong>{{ item.pallet }}</strong>
                <small v-if="item.publicBoard">公共板</small>
              </td>
              <td class="num">{{ item.baseOuterLengthCm }}</td>
              <td class="num">{{ item.baseOuterWidthCm }}</td>
              <td class="num">{{ item.heightCm }}</td>
              <td class="num">{{ item.transitionHeightCm }}</td>
              <td class="num">{{ item.volumeAllowedM3 ?? "—" }}</td>
              <td>
                <span class="type" :style="{ '--c': typeColor(item) }">{{ item.typeLabel }}</span>
              </td>
              <td @click.stop>
                <button type="button" class="ghost sm" @click="openPalletPreview(item.id)">3D</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="!visibleGroups.length" class="empty">没有匹配的数据</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  TYPE_COLORS,
  airplaneGroups,
  config,
  enabledPallets,
  isEnabled,
  openPalletPreview,
  pallets,
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
        const hay = [
          item.airlines,
          item.airplane,
          item.pallet,
          item.typeLabel,
          item.baseOuterLengthCm,
          item.baseOuterWidthCm,
          item.heightCm,
        ]
          .join(" ")
          .toLowerCase();
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

function typeColor(item) {
  return TYPE_COLORS[item.palletTypeName] || "#8b9bb0";
}
</script>
