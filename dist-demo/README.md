# i-print-designer · SDK 交付包（`dist-demo`）

本目录是 **单文件 SDK + 可运行 DEMO** 的正式交付物，由 `npm run build:sdk` 产出。  
主应用整站产物在单独的 `dist/`（`npm run build`），**不含**本包内容。

| 你要… | 用这个 |
|------|--------|
| 嵌进现有业务页 | `sdk/iprint-designer.js`（方式 A） |
| 对照完整接入示例 | `embed/`（采购单 · SDK） |
| CSS/JS 隔离或完整 Monaco | 主应用 `dist/` + `iframe/` DEMO（方式 B） |

---

## 目录

```
dist-demo/
├── README.md                 ← 本说明
├── sdk/
│   └── iprint-designer.js    ← 单文件 IIFE（CSS 已内联，约 1.8 MB / gzip ~0.5 MB）
├── embed/                    ← 方式 A DEMO：采购单打印（A4 自由页）
│   ├── index.html
│   └── adapter.js
├── iframe/                   ← 方式 B DEMO：收银小票（80mm；需另托管主应用 dist）
│   ├── index.html
│   └── adapter.js
├── bundle.js                 ← 演示库（模板 / 数据源 / 样例数据）
├── demo-assets.js            ← DEMO 读库工具（DemoAssets）
├── demo-ui.js                ← DEMO 共用 UI 逻辑
└── demo.css
```

---

## 快速打开 DEMO

### 方式 A（`embed/`）— 推荐先看

静态托管整个 `dist-demo/` 后打开：

- `…/embed/index.html`

也可用本地静态服务，例如：

```bash
npx serve dist-demo
# 浏览器打开提示的地址 → /embed/
```

`embed` 直接加载 `../sdk/iprint-designer.js`，**可用 `file://` 打开**（部分浏览器对 ES module / 本地策略更严时，仍建议用 http 静态服务）。

页面可演示：挂载 / 卸载、灌数据源与模版、`load` / `setData`、预览、打印、导出 HTML、保存回调等。顶栏「API 文档」可展开能力清单。

### 方式 B（`iframe/`）

设计器跑在 **主应用** iframe 里（`src="/"` → 需已部署的 `dist/index.html`），本目录只提供宿主页。

1. 先部署或本地预览主应用：`npm run build && npx serve dist`（或 `npm run preview`）
2. 将本包中的 `iframe/`（及共用的 `demo-*.js|css`、`bundle.js`）挂到**同一源**下可访问路径，或开发时用仓库 `npm run dev` 访问 `/demo/iframe/`
3. **必须 http(s)**，不要用 `file://`（postMessage + 顶层路由依赖同源页面）

---

## 方式 A：在业务页嵌入 SDK

```html
<div id="designer" style="height: 640px"></div>
<script src="./sdk/iprint-designer.js"></script>
<script>
  const { api } = IPrintDesigner;

  IPrintDesigner.mount('#designer', {
    mode: 'free', // 'free' | 'flow'
    // onSave: async (payload) => { /* 持久化 */ },
  });

  // 设计：登记数据源 + 设计模版（内容由宿主提供）
  api.defineDataSource({ id: 'erp_purchase', name: '采购单', fields: [/* … */] });
  api.defineTemplates({ templates: [/* 设计模版 JSON */] });

  // 预览·打印：模版 id + 数据源 id 必填
  api.load({
    templateId: 'document-purchase',
    dataSourceId: 'erp_purchase',
    data: { /* 业务 JSON */ },
  });

  api.openPreview();
  // api.print() / api.getPrintPages() / api.save()
</script>
```

要点：

- `mount` 返回后即可调 `api`，无需再等 `ready`
- 重复 `mount` 会先卸掉上一个实例；同页只挂一个设计器
- 未注册 `onSave` / `api.setOnSave` 时，点保存不会回调
- 全局亦可读 `window.__IPrintDesigner`（与导出对象相同）
- SDK **不打包 Monaco**（代码编辑降级为文本域）。需要完整 Monaco 请用方式 B + 主应用 `dist/`

DEMO 里读演示库：

```js
const catalog = await DemoAssets.loadCatalog(); // 读 ../bundle.js
```

生产宿主请换成自己的接口，**不要依赖** `bundle.js`。

---

## 方式 B：iframe + `postMessage`

宿主与设计器方法名、payload 与 SDK 一致，只是多一层异步 `call`：

```js
// 宿主 → 设计器
iframe.contentWindow.postMessage(
  { source: 'i-print-host', type: 'load', requestId, payload },
  '*', // 生产请收紧 origin
);

// 设计器 → 宿主：ready / response / save
```

完整协议与字段见工程文档 `docs/api.md`「方式 B」。可运行参考：本包 `iframe/`。

---

## 常用 API（与 DEMO / 文档同名）

| 能力 | 调用 |
|------|------|
| 挂载 / 卸载 | `IPrintDesigner.mount` / `unmount` |
| 登记数据源 | `api.defineDataSource({ id, name, fields? })` |
| 登记模版 | `api.defineTemplates({ templates })` |
| 打开模版 | `api.load({ templateId, dataSourceId, data? })` |
| 只换业务数据 | `api.setData({ data })` |
| 预览 | `api.openPreview()` / `closePreview()` |
| 打印 | `api.print()`（保持在用户点击事件链内） |
| 导出分页 HTML | `api.getPrintPages()` |
| 保存回调 | `mount({ onSave })` 或 `api.setOnSave(fn)` → `api.save()` |

完整清单、保存 payload、预览几何等见工程文档 `docs/api.md`。

---

## 注意

1. **本包 ≠ 主应用**：`dist-demo` 只有 SDK + DEMO；完整编辑器站点（含 Monaco）在 `dist/`。
2. **单实例**：全局 store，同页只能挂一个设计器。
3. **布局**：`mount` 的 `mode` 决定首屏空文档；多设计纸模版打开时会强制 `free`。
4. **样式**：SDK 样式作用在 `.ipd-root`；浮层挂在 `body` 下 `.ipd-overlay-root`，避免被宿主 `overflow:hidden` 裁切。
5. **数据不落盘**：状态在内存，持久化由宿主 `onSave` / 自有接口负责。
6. **重构建**：改业务代码后重新执行 `npm run build:sdk` 再分发本目录。

---

## 仓库内如何重新产出

```bash
npm run demo:public   # 更新 demo/bundle.js（演示库）
npm run build:sdk     # → 本目录（清空后重建）
# 或
npm run build:all     # demo:public → build:sdk → build（主应用 dist）
```
