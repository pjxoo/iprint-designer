/**
 * 整合 DEMO · 方式 B：iframe + postMessage（adapter）
 *
 *   DemoUi.start({ connect, disconnect, api })
 *
 * 设计器整包跑在站点根 `/` 的 iframe 里（BrowserRouter，无 #；亦可 `/editor/free`）。
 * 协议见 docs/api.md「方式 B」：
 *
 *   宿主 → 设计器   { source: 'i-print-host', type, requestId, payload }
 *   设计器 → 宿主   { source: 'i-print-designer', type: 'ready' }
 *                   { source: 'i-print-designer', type: 'response', requestId, ok, result | error }
 *                   { source: 'i-print-designer', type: 'save', payload }  // 工具栏保存
 *
 * 本文件：把 postMessage 包成 call(type, payload)，再交给 demo-ui.js。
 * 方法名 / payload 与 SDK 完全一致，仅多一层 Promise。
 * 须 http(s)；file:// 下 ES module 无法加载。
 */

const assets = window.DemoAssets;
const frame = document.getElementById('designer');

const FRAME_SRC = '/';
const READY_TIMEOUT = 20000;
const REQUEST_TIMEOUT = 30000;

const pending = new Map();
let seq = 0;
let frameReady = false;
let readyWaiter = null;

function waitReady() {
  if (frameReady) return Promise.resolve();
  if (readyWaiter) return readyWaiter.promise;

  const waiter = {};
  waiter.promise = new Promise((resolve, reject) => {
    waiter.resolve = resolve;
    waiter.timer = window.setTimeout(() => {
      readyWaiter = null;
      reject(
        new Error(
          '设计器未就绪：确认已 npm run dev，并用 http://localhost:5173/demo/iframe/ 打开（勿 file://）',
        ),
      );
    }, READY_TIMEOUT);
  });
  readyWaiter = waiter;
  return waiter.promise;
}

function markReady() {
  frameReady = true;
  if (!readyWaiter) return;
  window.clearTimeout(readyWaiter.timer);
  readyWaiter.resolve();
  readyWaiter = null;
}

/**
 * call(type, payload?) → Promise<result>
 * @param type  与 SDK 方法名相同
 * @param payload  与 SDK 同名方法入参一致；无参可省略
 *
 * 案例：await call('load', { templateId, dataSourceId, data });
 */
async function call(type, payload) {
  await waitReady();

  return new Promise((resolve, reject) => {
    const requestId = `req_${Date.now()}_${++seq}`;
    const timer = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error(`超时：${type}`));
    }, REQUEST_TIMEOUT);

    pending.set(requestId, { resolve, reject, timer });
    frame.contentWindow.postMessage(
      { source: 'i-print-host', type, requestId, payload: payload || {} },
      '*',
    );
  });
}

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'i-print-designer') return;

  if (data.type === 'ready') {
    markReady();
    return;
  }

  // 工具栏「保存」主动推送：宿主在此调第三方接口
  if (data.type === 'save') {
    const payload = data.payload || {};
    console.info('[demo iframe save]', {
      dataSourceId: payload.dataSource?.id ?? null,
      templateId: payload.template?.id,
      fieldCount: payload.dataSource?.fields?.length ?? 0,
    });
    window.alert(
      `已收到 iframe save\n数据源：${payload.dataSource?.id ?? '（无）'}\n设计模版：${payload.template?.id}`,
    );
    return;
  }

  if (data.type !== 'response') return;

  const slot = pending.get(data.requestId);
  if (!slot) return;
  pending.delete(data.requestId);
  window.clearTimeout(slot.timer);
  if (data.ok) {
    slot.resolve(data.result);
  } else {
    slot.reject(new Error(data.error));
  }
});

const api = {
  /**
   * ping() → Promise<{ ok, version }>
   * 案例：const { version } = await api.ping();
   */
  ping: () => call('ping'),

  /**
   * defineDataSource(payload)
   * @param {string} payload.id  必填
   * @param {string} [payload.name]
   * @param {string} [payload.description]
   * @param {Array}  [payload.fields]
   *
   * 案例：
   *   await api.defineDataSource({
   *     id: 'erp_purchase', name: '采购单',
   *     fields: [
   *       { name: '采购单号', field: 'billNo' },
   *       { name: '明细', field: 'lines', kind: 'array',
   *         fields: [{ name: '货号', field: 'sku' }] },
   *     ],
   *   });
   */
  defineDataSource: (payload) => call('defineDataSource', payload),

  /**
   * defineTemplates({ templates })
   * templates 必填非空；项含 id/title/category/document.elements
   *
   * 案例：await api.defineTemplates({ templates: [tplA, tplB] });
   */
  defineTemplates: (payload) => call('defineTemplates', payload),

  /**
   * load({ templateId, dataSourceId, data? })
   * 两 id 必填；data 可选。
   *
   * 案例 A：await api.load({ templateId: 'ticket-pos', dataSourceId: 'apparel' });
   * 案例 B：await api.load({
   *   templateId: 'ticket-pos',
   *   dataSourceId: 'apparel',
   *   data: { shopName: '旗舰店', lines: [...] },
   * });
   */
  load: (payload) => call('load', payload),

  /**
   * setData({ data })
   * data 必填对象；不要传 dataSourceId。
   *
   * 案例：await api.setData({ data: { shopName: '新店', lines: [] } });
   */
  setData: (payload) => call('setData', payload),

  /**
   * openPreview() / closePreview()
   * 案例：await api.openPreview(); await api.closePreview();
   */
  openPreview: () => call('openPreview'),
  closePreview: () => call('closePreview'),

  /**
   * getPreviewData() → 逐元素预览数据
   * 案例：const data = await api.getPreviewData();
   */
  getPreviewData: () => call('getPreviewData'),

  /**
   * getPrintPages() → { title, width, height, css, pages[], document }
   * 案例：const { document: html } = await api.getPrintPages();
   */
  getPrintPages: () => call('getPrintPages'),

  /**
   * print() —— 须在点击事件链里调用
   * 案例：button.onclick = () => api.print();
   */
  print: () => call('print'),

  /**
   * save() → 与工具栏保存相同；并会 postMessage type:'save'
   * 案例：await api.save();
   */
  save: () => call('save'),
};

function rejectPending(reason) {
  for (const slot of pending.values()) {
    window.clearTimeout(slot.timer);
    slot.reject(new Error(reason));
  }
  pending.clear();
}

/** 同域时可直接探测桥是否已挂（兜底漏掉的 ready） */
function tryMarkFromBridge() {
  try {
    if (frame.contentWindow && frame.contentWindow.__IPrintDesigner) {
      markReady();
    }
  } catch {
    // 跨域 / 未加载完
  }
}

function loadFrame(src) {
  const loaded = new Promise((resolve) => {
    frame.addEventListener('load', resolve, { once: true });
  });
  frame.src = src;
  return loaded;
}

window.DemoUi.start({
  async connect() {
    if (!assets.isServed()) throw new Error(assets.SERVE_HINT);

    // 先挂好监听再导航，避免 HTML 里提前 src=/ 时 ready 早于 adapter
    frameReady = false;
    readyWaiter = null;
    await loadFrame(FRAME_SRC);
    tryMarkFromBridge();
    // 若 load 时桥已挂但漏发 ready：再等一小会儿或靠 waitReady
    if (!frameReady) {
      window.setTimeout(tryMarkFromBridge, 0);
      window.setTimeout(tryMarkFromBridge, 200);
    }

    const { version } = await call('ping');
    return {
      badge: `iframe v${version}`,
      detail: `已连接 · ${FRAME_SRC} · 通信 postMessage`,
    };
  },

  async disconnect() {
    rejectPending('iframe 已重载');
    frameReady = false;
    readyWaiter = null;
    await loadFrame(FRAME_SRC);
    tryMarkFromBridge();
  },

  api,
});
