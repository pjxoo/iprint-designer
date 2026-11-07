/**
 * 整合 DEMO · 方式 A：单文件 SDK（adapter）
 *
 *   DemoUi.start({ connect, disconnect, api })
 *
 * · 设计：defineDataSource + defineTemplates
 * · 预览·打印：load({ templateId, dataSourceId, data? }) + setData({ data })
 *
 * 调用：`IPrintDesigner.api.xxx(payload)`，同步返回。
 * 须先 `npm run build:sdk`，再打开本页（dev: /demo/embed/）。
 *
 * @example
 * const { api } = IPrintDesigner;
 * IPrintDesigner.mount('#designer', { mode: 'free' });
 * api.defineDataSource({ id: 'erp_purchase', name: '采购单', fields: [...] });
 * api.defineTemplates({ templates: [template] });
 * api.load({
 *   templateId: template.id,
 *   dataSourceId: 'erp_purchase',
 *   data: { billNo: 'CG001', lines: [{ sku: 'A1' }] },
 * });
 * api.setData({ data: nextBill });
 * api.openPreview();
 */

const sdk = window.IPrintDesigner;
const host = document.getElementById('designer');

function requireSdk() {
  if (!sdk || typeof sdk.mount !== 'function') {
    throw new Error(
      '未找到 SDK：先执行 npm run build:sdk，生成 dist-demo/sdk/iprint-designer.js',
    );
  }
  return sdk;
}

/**
 * connect → { badge, detail }
 *
 * IPrintDesigner.mount(target, options?)
 * @param target  string | HTMLElement  —— '#designer' 或节点
 * @param options.mode   'free' | 'flow'  默认 'free'
 * @param options.height string           默认 '100%'
 *
 * 案例
 *   IPrintDesigner.mount('#designer', { mode: 'free' });
 *   IPrintDesigner.mount(host, { mode: 'flow', height: '640px' });
 */
/**
 * 保存出口（DEMO）：设计器只把 payload 传出，这里模拟第三方 HTTP。
 * 正式宿主换成自己的接口即可，例如：
 *   await fetch('/api/print-templates/save', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 */
async function demoOnSave(payload) {
  console.info('[demo onSave → 第三方 HTTP]', {
    dataSourceId: payload.dataSource?.id ?? null,
    templateId: payload.template?.id,
    fieldCount: payload.dataSource?.fields?.length ?? 0,
    dataKeys: Object.keys(payload.data || {}),
  });
  window.alert(
    `保存出口已传出（请宿主自行 HTTP）\n数据源：${payload.dataSource?.id ?? '（无）'}\n设计模版：${payload.template?.id}`,
  );
}

function mountDesigner() {
  const instance = requireSdk().mount(host, { mode: 'free' });
  // 通过 API 注册保存回调（未注册则点保存不调用）
  requireSdk().api.setOnSave(demoOnSave);
  const rect = instance.element.getBoundingClientRect();
  return {
    badge: `SDK v${sdk.version}`,
    detail:
      `已挂载 · 布局 ${instance.layoutMode} · ` +
      `画布区 ${Math.round(rect.width)}×${Math.round(rect.height)}`,
  };
}

/**
 * disconnect
 * IPrintDesigner.unmount() —— 卸实例 + 宿主桥；无实例时空操作。
 *
 * 案例（重建）
 *   unmount(); host.replaceChildren(); mount(...);
 */
function unmountDesigner() {
  requireSdk().api.setOnSave(null);
  requireSdk().unmount();
  host.replaceChildren();
}

const api = {
  /**
   * ping() → { ok: true, version }
   * 无入参。连通性 / 版本（同 IPrintDesigner.version）。
   *
   * 案例：const { version } = api.ping();
   */
  ping: () => requireSdk().api.ping(),

  /**
   * defineDataSource(payload) → { ok, id, name, fieldCount, arrayPaths }
   *
   * 【设计】登记数据源模板。可多次；同 id 覆盖。不写业务数据。
   * @param {string} payload.id                 必填
   * @param {string} [payload.name]
   * @param {string} [payload.description]
   * @param {Array}  [payload.fields]           标量不写 kind；object/array 写 kind+fields
   *
   * 案例 A：api.defineDataSource({ id: 'erp_purchase' });
   * 案例 B：
   *   api.defineDataSource({
   *     id: 'erp_purchase',
   *     name: '采购单',
   *     fields: [
   *       { name: '采购单号', field: 'billNo' },
   *       { name: '明细', field: 'lines', kind: 'array',
   *         fields: [{ name: '货号', field: 'sku' }] },
   *     ],
   *   });
   */
  defineDataSource: (payload) => requireSdk().api.defineDataSource(payload),

  /**
   * defineTemplates(payload) → { ok, templateIds }
   *
   * 【设计】登记 1～N 份设计模版；不打开画布；同 id 覆盖。
   * @param {Array} payload.templates  必填非空；项含 id/title/category/document.elements
   *
   * 案例：api.defineTemplates({ templates: [tplA, tplB] });
   */
  defineTemplates: (payload) => requireSdk().api.defineTemplates(payload),

  /**
   * load(payload) → { ok, templateId, dataSourceId }
   *
   * 【预览·打印】打开设计模版并绑数据源（唯一加载入口）。
   * @param {string} payload.templateId     必填 · 已 defineTemplates
   * @param {string} payload.dataSourceId   必填 · 已 defineDataSource
   * @param {object} [payload.data]         可选 · 业务根对象
   *
   * 案例 A：api.load({ templateId: 'document-purchase', dataSourceId: 'purchase' });
   * 案例 B：api.load({
   *   templateId: 'document-purchase',
   *   dataSourceId: 'purchase',
   *   data: { billNo: 'CG2026', lines: [{ sku: 'S-1', qty: 2 }] },
   * });
   */
  load: (payload) => requireSdk().api.load(payload),

  /**
   * setData(payload) → { ok: true }
   *
   * 【预览·打印】只换业务数据；不要传 dataSourceId。
   * @param {object} payload.data  必填 · JSON 对象（根不能是数组）
   *
   * 案例：api.setData({ data: { billNo: 'CG2026-2', lines: [] } });
   */
  setData: (payload) => requireSdk().api.setData(payload),

  /**
   * openPreview() / closePreview() → { ok: true }
   * 无入参。设计器内置预览弹层；与宿主自建预览互斥。
   *
   * 案例：api.openPreview(); api.closePreview();
   */
  openPreview: () => requireSdk().api.openPreview(),
  closePreview: () => requireSdk().api.closePreview(),

  /**
   * getPreviewData() → PrintPreviewData
   * 无入参。逐元素：pages[].elements[].{ html, text, x, y, ... }
   *
   * 案例：const data = api.getPreviewData();
   */
  getPreviewData: () => requireSdk().api.getPreviewData(),

  /**
   * getPrintPages() → { title, width, height, css, pages[], document }
   * 无入参。分页打印稿 / 完整 HTML。
   *
   * 案例 A：const { document: html, title } = api.getPrintPages();
   * 案例 B：const { css, pages } = api.getPrintPages();
   *   iframe.srcdoc = `<style>${css}</style>${pages[0]}`;
   */
  getPrintPages: () => requireSdk().api.getPrintPages(),

  /**
   * print() → { ok: true }
   * 无入参。须在用户点击事件链里调用。
   *
   * 案例：button.onclick = () => api.print();
   */
  print: () => requireSdk().api.print(),

  /**
   * save() → Promise<{ ok, viaHandler, viaPostMessage, payload }>
   * 触发与工具栏「保存」相同逻辑（会调已注册的 onSave）。
   *
   * 案例：await api.save();
   */
  save: () => requireSdk().api.save(),
};

window.DemoUi.start({
  connect: mountDesigner,
  disconnect: unmountDesigner,
  api,
});
