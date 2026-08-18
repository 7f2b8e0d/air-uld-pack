<template>
  <section class="table-panel">
    <div class="table-head">
      <div>
        <h2>集装箱型号</h2>
        <p>共 {{ rows.length }} 条，点「3D」看轮廓；点行可多选进当前计算方案。</p>
      </div>
      <label class="search">
        <span>搜索</span>
        <input v-model.trim="keyword" type="search" placeholder="机型、板型、尺寸…" />
      </label>
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
          <tr
            v-for="item in rows"
            :key="item.id"
            :class="{ current: isCalcPallet(item.id), off: !isEnabled(item.id) }"
            @click="selectPallet(item.id)"
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
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty">没有匹配的数据</p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  TYPE_COLORS,
  isCalcPallet,
  isEnabled,
  openPalletPreview,
  pallets,
  selectPallet,
  setEnabled,
} from "../state.js";

const keyword = ref("");

const rows = computed(() => {
  const q = keyword.value.toLowerCase();
  if (!q) return pallets;
  return pallets.filter((item) => {
    const hay = [
      item.airlines,
      item.airplane,
      item.pallet,
      item.typeLabel,
      item.baseOuterLengthCm,
      item.baseOuterWidthCm,
      item.heightCm,
      item.status,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
});

function typeColor(item) {
  return TYPE_COLORS[item.palletTypeName] || "#8b9bb0";
}
</script>
