import { onMounted } from "vue";

const KEY_PREFIX = "air-uld-pack:height:";

/**
 * 让元素可以通过拖动把手改变高度，并把高度存到本地，刷新后恢复。
 * @param {import("vue").Ref<HTMLElement|null>} elRef 要改变高度的元素（如 textarea）
 * @param {string} storageKey 本地存储里区分不同元素的名字
 * @param {{ min?: number, max?: number }} [limits] 高度上下限（px）
 * @returns {{ startResize: (event: PointerEvent) => void }} 绑定到拖动把手 pointerdown 上的处理函数
 */
export function usePersistedHeight(elRef, storageKey, { min = 80, max = 1200 } = {}) {
  const fullKey = KEY_PREFIX + storageKey;

  onMounted(() => {
    const saved = Number(localStorage.getItem(fullKey));
    if (elRef.value && saved > 0) applyHeight(elRef.value, saved, min, max);
  });

  /**
   * 按住把手后跟随鼠标/手指上下拖动，松开时保存高度。
   * @param {PointerEvent} event 把手上的 pointerdown 事件
   * @returns {void}
   */
  function startResize(event) {
    const el = elRef.value;
    if (!el || !el.offsetHeight) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = el.offsetHeight;
    document.body.classList.add("is-resizing-y");

    const onMove = (e) => applyHeight(el, startHeight + e.clientY - startY, min, max);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("is-resizing-y");
      localStorage.setItem(fullKey, String(el.offsetHeight));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { startResize };
}

/**
 * 把高度限制在上下限之间后设置到元素上。
 * @param {HTMLElement} el 目标元素
 * @param {number} height 期望高度（px）
 * @param {number} min 最小高度（px）
 * @param {number} max 最大高度（px）
 * @returns {void}
 */
function applyHeight(el, height, min, max) {
  el.style.height = `${Math.round(Math.min(max, Math.max(min, height)))}px`;
}
