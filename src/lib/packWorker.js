import { packScheme } from "./pack.js";

self.onmessage = (event) => {
  const { id, palletList, cargos, qtyMap, flushMap, flushEdge, budgetMs } = event.data || {};
  try {
    const packed = packScheme(palletList, cargos, { qtyMap, flushMap, flushEdge, budgetMs });
    self.postMessage({ id, ok: true, packed });
  } catch (error) {
    self.postMessage({ id, ok: false, message: error?.message || "计算失败" });
  }
};
