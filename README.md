# i-print-designer

Web 打印设计器 **运行产物包**（不含源码）。用于独立部署完整设计器站点，或把单文件 SDK 嵌进业务页。

版本：`0.1.0`

---

## 目录

```
iprint-designer/
├── README.md          ← 本说明
├── dist/              ← 主应用整站（含 Monaco，可独立打开）
│   ├── index.html
│   └── assets/
└── dist-demo/         ← 单文件 SDK + 可运行 DEMO
    ├── README.md      ← SDK / DEMO 详细说明
    ├── sdk/iprint-designer.js
    ├── embed/         ← 方式 A：采购单（SDK 内嵌）
    ├── iframe/        ← 方式 B：收银小票（iframe + postMessage）
    └── …
```

| 目录 | 用途 | 怎么开 |
|------|------|--------|
| `dist/` | 完整设计器站点（自由 / 流式编辑、完整代码编辑） | 静态托管后打开根路径 |
| `dist-demo/` | SDK 内嵌 + 接入示例 | 见下方；细节见 [`dist-demo/README.md`](./dist-demo/README.md) |

二者分开交付：`dist` 不含 SDK；`dist-demo` 不含主应用整站。

---

## 快速体验

在本目录开两个静态服务（或把整个文件夹丢进 nginx / IIS）：

```bash
# 终端 1：完整设计器
npx serve dist -p 4173

# 终端 2：SDK DEMO
npx serve dist-demo -p 4174
```

- 主应用：<http://localhost:4173/>
- SDK DEMO（推荐先看）：<http://localhost:4174/embed/>
- iframe DEMO：需与主应用**同源**部署后再开 `dist-demo/iframe/`（勿 `file://`）

`embed` 页也可直接用浏览器打开 `dist-demo/embed/index.html`（`file://`，视浏览器策略而定）。

---

## 两种接入方式

### 方式 A：单文件 SDK（推荐内嵌）

把设计器挂进现有业务页，直接函数调用：

```html
<div id="designer" style="height: 640px"></div>
<script src="./dist-demo/sdk/iprint-designer.js"></script>
<script>
  const { api } = IPrintDesigner;
  IPrintDesigner.mount('#designer', {
    mode: 'free', // 'free' | 'flow'
    onSave: async (payload) => {
      // payload.dataSource · payload.template · payload.data
    },
  });

  api.defineDataSource({ id: 'erp_purchase', name: '采购单', fields: [/* … */] });
  api.defineTemplates({ templates: [/* 设计模版 JSON */] });
  api.load({
    templateId: 'document-purchase',
    dataSourceId: 'erp_purchase',
    data: { /* 业务 JSON */ },
  });
  api.openPreview();
</script>
```

完整可运行示例：`dist-demo/embed/`（采购单 · A4）。

要点：

- `mount` 返回后即可调 `api`，无需再等 `ready`
- 同页单实例；再次 `mount` 会先卸掉上一个
- SDK **不含 Monaco**（代码编辑降级为文本域）；需要完整 Monaco 用方式 B

### 方式 B：iframe + `postMessage`

需要 CSS/JS 隔离或完整 Monaco 时，用主应用 `dist/` 放进 iframe，宿主经 `postMessage` 调同一套能力（方法名 / payload 与 SDK 一致）。

完整可运行示例：`dist-demo/iframe/`（收银小票 · 80mm）。须 **http(s)**，且 iframe 能打开已托管的 `dist/index.html`。

---

## 常用 API（两种方式同名）

| 能力 | SDK | iframe |
|------|-----|--------|
| 挂载 / 卸载 | `IPrintDesigner.mount` / `unmount` | 加载 / 销毁 iframe |
| 登记数据源 | `api.defineDataSource(…)` | `call('defineDataSource', …)` |
| 登记模版 | `api.defineTemplates(…)` | `call('defineTemplates', …)` |
| 打开模版 | `api.load({ templateId, dataSourceId, data? })` | 同左 |
| 换业务数据 | `api.setData({ data })` | 同左 |
| 预览 / 打印 | `api.openPreview()` / `api.print()` | 同左 |
| 导出分页 HTML | `api.getPrintPages()` | 同左 |
| 保存回调 | `mount({ onSave })` 或 `api.setOnSave` | 监听 `type: 'save'` |

更细的字段与协议见源码工程 `docs/api.md`，或打开 DEMO 顶栏「API 文档」。

---

## 注意

1. **数据不落盘**：状态在内存，持久化由宿主 `onSave` / 自有接口负责。
2. **演示库** `dist-demo/bundle.js` 仅供 DEMO；生产请换成自己的模版与数据接口。
3. **跨域**：iframe 方案里 `postMessage` 的 `targetOrigin` 生产环境请按实际域名收紧。
4. 本目录为构建拷贝；改功能请在源码仓库重建后再覆盖 `dist/`、`dist-demo/`。
