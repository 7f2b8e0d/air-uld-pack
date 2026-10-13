import { onBeforeUnmount, onMounted } from "vue";

const KEY_PREFIX = "air-uld-pack:height:";
const SAVE_DELAY_MS = 200;

/**
 * 让可拖动改变高度的元素（如 textarea）记住用户拖出来的高度，刷新后恢复。
 * @param {import("vue").Ref<HTMLElement|null>} elRef 目标元素的模板引用
 * @param {string} storageKey 本地存储里区分不同元素的名字
 * @returns {void}
 */
export function usePersistedHeight(elRef, storageKey) {
  const fullKey = KEY_PREFIX + storageKey;
  let observer = null;
  let saveTimer = 0;

  onMounted(() => {
    const el = elRef.value;
    if (!el) return;
    restoreHeight(el, fullKey);
    observer = new ResizeObserver(() => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveHeight(el, fullKey), SAVE_DELAY_MS);
    });
    observer.observe(el);
  });

  onBeforeUnmount(() => {
    clearTimeout(saveTimer);
    observer?.disconnect();
  });
}

/**
 * 从本地存储读出高度并套用到元素上。
 * @param {HTMLElement} el 目标元素
 * @param {string} key 本地存储键
 * @returns {void}
 */
function restoreHeight(el, key) {
  const saved = Number(localStorage.getItem(key));
  if (saved > 0) el.style.height = `${saved}px`;
}

/**
 * 把元素当前高度写入本地存储。
 * @param {HTMLElement} el 目标元素
 * @param {string} key 本地存储键
 * @returns {void}
 */
function saveHeight(el, key) {
  const height = Math.round(el.offsetHeight);
  if (height > 0) localStorage.setItem(key, String(height));
}
