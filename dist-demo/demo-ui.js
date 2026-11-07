/**
 * 整合 DEMO · 共用 UI 壳层
 *
 *   DemoUi.start({
 *     connect,     // 挂载 / 连接设计器 → { badge, detail }
 *     disconnect,  // 可选：卸载 / 重载
 *     api,         // 能力集合（方法名 = SDK 方法名）
 *   })
 *
 * 两个 DEMO 的差别只剩 adapter：
 *   embed/adapter.js   → api 指向 IPrintDesigner.api
 *   iframe/adapter.js  → api 每条走 call()（postMessage）
 *
 * 文件读写一律走 demo-assets.js，本文件不碰网络。正式宿主不必引入本文件。
 */
(function () {
  'use strict';

  const assets = window.DemoAssets;
  /** <body data-default-template="ticket-pos"> 可指定进页打开的模板 */
  const DEFAULT_TEMPLATE_ID = document.body.dataset.defaultTemplate || '';

  const el = {
    badge: document.getElementById('sdkBadge'),
    stageInfo: document.getElementById('stageInfo'),
    stageLoading: document.getElementById('stageLoading'),
    stageLoadingText: document.getElementById('stageLoadingText'),
    templateSelect: document.getElementById('templateSelect'),
    templateHint: document.getElementById('templateHint'),
    dataSourceSelect: document.getElementById('dataSourceSelect'),
    dataJson: document.getElementById('dataJson'),
    previewModal: document.getElementById('previewModal'),
    previewTitle: document.getElementById('previewTitle'),
    previewList: document.getElementById('previewList'),
    previewMeta: document.getElementById('previewMeta'),
    closeModalBtn: document.getElementById('btnClosePreviewModal'),
    docsBtn: document.getElementById('btnDocs'),
    docsModal: document.getElementById('docsModal'),
    closeDocsBtn: document.getElementById('btnCloseDocs'),
    toast: document.getElementById('toast'),
  };

  function setStageLoading(on, text) {
    if (!el.stageLoading) return;
    el.stageLoading.hidden = !on;
    if (text && el.stageLoadingText) el.stageLoadingText.textContent = text;
  }

  /** @type {{ templates: any[], dataSources: any[] } | null} */
  let catalog = null;
  let toastTimer = 0;
  let adapter = null;
  /** 重建实例后需重新 define */
  let hostAssetsDefined = false;

  function toast(text, kind) {
    el.toast.textContent = text;
    el.toast.className = `toast show${kind === 'err' ? ' err' : ''}`;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      el.toast.className = 'toast';
    }, 3200);
  }

  function setBadge(text, kind) {
    el.badge.textContent = text;
    el.badge.className = `pill${kind ? ` ${kind}` : ''}`;
  }

  function fail(error) {
    toast(error?.message || String(error), 'err');
  }

  function run(action) {
    try {
      Promise.resolve(action()).catch(fail);
    } catch (error) {
      fail(error);
    }
  }

  function fillSelect(select, items, textKey) {
    select.innerHTML = (items || [])
      .map((item) => `<option value="${item.id}">${item[textKey]}</option>`)
      .join('');
  }

  function currentTemplate() {
    return assets.findTemplate(catalog, el.templateSelect.value);
  }

  function readJson() {
    return assets.parseJsonObject(el.dataJson.value);
  }

  async function loadCatalog() {
    catalog = await assets.loadCatalog();
    fillSelect(el.templateSelect, catalog.templates, 'title');
    fillSelect(el.dataSourceSelect, catalog.dataSources, 'name');

    const first =
      assets.findTemplate(catalog, DEFAULT_TEMPLATE_ID) || catalog.templates?.[0];
    if (!first) return;
    el.templateSelect.value = first.id;
    syncDataSource();
  }

  function syncDataSource() {
    const tpl = currentTemplate();
    el.templateHint.textContent = tpl?.description || '—';
    const meta = assets.findDataSource(catalog, tpl?.dataSourceId);
    if (meta) el.dataSourceSelect.value = meta.id;
  }

  async function loadSampleData(showTip) {
    const tpl = currentTemplate();
    const sourceId = el.dataSourceSelect.value || tpl?.dataSourceId;
    const { data, url } = await assets.readSample(catalog, tpl, sourceId);
    el.dataJson.value = JSON.stringify(data, null, 2);
    if (showTip) toast(`已载入样例数据\n${url}`);
    return data;
  }

  /**
   * 把 catalog 里的数据源 + 模版登记进设计器（可多次 define）。
   * 重建实例后需重新登记。
   */
  async function ensureHostAssetsDefined() {
    if (hostAssetsDefined || !catalog) return;

    for (const source of catalog.dataSources || []) {
      let fields = Array.isArray(source.fields) ? source.fields : undefined;
      let name = source.name || source.id;
      let description = source.description;
      if (source.schemaUrl) {
        const schema = await assets.readDataSourceSchema(catalog, source.id);
        fields = Array.isArray(schema.fields) ? schema.fields : fields;
        name = schema.name || name;
        description = schema.description ?? description;
      }
      await adapter.api.defineDataSource({
        id: source.id,
        name,
        description,
        fields,
      });
    }

    const templates = [];
    for (const meta of catalog.templates || []) {
      if (!meta?.templateUrl) continue;
      templates.push(await assets.readTemplate(meta));
    }
    if (templates.length > 0) {
      await adapter.api.defineTemplates({ templates });
    }

    hostAssetsDefined = true;
  }

  /**
   * 打开选中模版：先 define，再 load({ templateId, dataSourceId, data? })。
   * 两 id 必填：设计模版 + 数据源模板。
   */
  async function loadSelected() {
    const tpl = currentTemplate();
    if (!tpl?.id) throw new Error('未选择模板');

    await ensureHostAssetsDefined();
    const data = readJson();
    const dataSourceId = el.dataSourceSelect.value || tpl.dataSourceId;
    if (!dataSourceId) throw new Error('未选择数据源模板');

    const result = await adapter.api.load({
      templateId: tpl.id,
      dataSourceId,
      data,
    });
    toast(
      `已打开「${tpl.title}」\n模版 ${result.templateId || tpl.id} · 数据源 ${result.dataSourceId || dataSourceId}`,
    );
    return result;
  }

  /** 应用数据：只 setData({ data }) */
  async function applyData() {
    await ensureHostAssetsDefined();
    const data = readJson();
    await adapter.api.setData({ data });
    toast('已写入业务数据');
  }

  async function exportHtml() {
    const { document: html, title } = await adapter.api.getPrintPages();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || '打印稿').replace(/[\\/:*?"<>|]+/g, '_')}.html`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出完整 HTML 文件');
  }

  function renderBlocks(data) {
    const pages = data.pages || [];
    el.previewMeta.textContent = `${pages.length} 页 · ${data.width}×${data.height}`;

    if (!pages.length) {
      el.previewList.innerHTML = '<p class="empty">没有可预览内容</p>';
      return;
    }

    const thumbW = 240;
    const scale = thumbW / Math.max(data.width, 1);
    const frag = document.createDocumentFragment();

    pages.forEach((page) => {
      const card = document.createElement('div');
      card.className = 'page-card';

      const head = document.createElement('header');
      head.textContent =
        `${page.designPageName} · 第 ${page.sheetNo}/${page.sheetTotal} 页`;

      const viewport = document.createElement('div');
      viewport.className = 'page-viewport';
      viewport.style.width = `${thumbW}px`;
      viewport.style.height = `${Math.round(page.height * scale)}px`;

      const stage = document.createElement('div');
      stage.className = 'page-stage';
      stage.style.width = `${data.width}px`;
      stage.style.height = `${page.height}px`;
      stage.style.transform = `scale(${scale})`;
      stage.innerHTML = page.elements.map((item) => item.html).join('');

      viewport.append(stage);
      card.append(head, viewport);
      frag.append(card);
    });

    el.previewList.replaceChildren(frag);
  }

  async function openBlocksModal() {
    await adapter.api.closePreview();
    const data = await adapter.api.getPreviewData();
    window.__lastPreviewData = data;
    el.previewTitle.textContent = '逐元素预览 · getPreviewData()';
    renderBlocks(data);
    el.previewModal.hidden = false;
    el.closeModalBtn.focus();
    return data;
  }

  function closeBlocksModal() {
    el.previewModal.hidden = true;
  }

  function isBlocksModalOpen() {
    return !el.previewModal.hidden;
  }

  function openDocsModal() {
    if (!el.docsModal) return;
    closeBlocksModal();
    el.docsModal.hidden = false;
    el.closeDocsBtn?.focus();
  }

  function closeDocsModal() {
    if (!el.docsModal) return;
    el.docsModal.hidden = true;
  }

  function isDocsModalOpen() {
    return Boolean(el.docsModal) && !el.docsModal.hidden;
  }

  function bindEvents() {
    document.getElementById('btnReload').onclick = () => run(reload);

    el.templateSelect.onchange = () => {
      syncDataSource();
      run(() => loadSampleData(false).then(() => loadSelected()));
    };

    el.dataSourceSelect.onchange = () => run(() => loadSampleData(true));

    document.getElementById('btnReloadData').onclick = () =>
      run(() => loadSampleData(true));

    document.getElementById('btnApply').onclick = () => run(applyData);

    document.getElementById('btnPreview').onclick = () => {
      closeBlocksModal();
      closeDocsModal();
      run(() =>
        Promise.resolve(adapter.api.openPreview()).then(() =>
          toast('已打开设计器预览弹窗'),
        ),
      );
    };

    document.getElementById('btnClosePreview').onclick = () =>
      run(() => adapter.api.closePreview());

    document.getElementById('btnPrint').onclick = () =>
      run(() =>
        Promise.resolve(adapter.api.print()).then(() =>
          toast('已发送 print 指令'),
        ),
      );

    document.getElementById('btnExportHtml').onclick = () => run(exportHtml);

    document.getElementById('btnPreviewBlocks').onclick = () => {
      closeDocsModal();
      run(() =>
        openBlocksModal().then((data) => {
          const elementCount = data.pages.reduce(
            (sum, page) => sum + page.elements.length,
            0,
          );
          toast(
            `预览数据：${data.pageCount} 页 / ${elementCount} 个元素\n` +
              `纸面 ${data.width}×${data.height}（${data.layoutMode}）`,
          );
        }),
      );
    };

    el.closeModalBtn.onclick = closeBlocksModal;

    el.previewModal.addEventListener('mousedown', (event) => {
      if (event.target === el.previewModal) closeBlocksModal();
    });

    if (el.docsBtn) el.docsBtn.onclick = openDocsModal;
    if (el.closeDocsBtn) el.closeDocsBtn.onclick = closeDocsModal;
    if (el.docsModal) {
      el.docsModal.addEventListener('mousedown', (event) => {
        if (event.target === el.docsModal) closeDocsModal();
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (isBlocksModalOpen()) {
        closeBlocksModal();
        return;
      }
      if (isDocsModalOpen()) {
        closeDocsModal();
        return;
      }
      try {
        Promise.resolve(adapter.api.closePreview()).catch(() => {});
      } catch {
        /* 未连接，忽略 */
      }
    });
  }

  async function connectAndLoad() {
    setStageLoading(true, '正在连接设计器…');
    const info = await adapter.connect();
    setBadge(info.badge, 'ok');
    el.stageInfo.textContent = info.detail;

    hostAssetsDefined = false;
    setStageLoading(true, '正在加载模版与数据…');
    await loadCatalog();
    await loadSampleData(false);
    await loadSelected();

    el.stageInfo.textContent += ' · library bundle';
    setStageLoading(false);
  }

  async function reload() {
    hostAssetsDefined = false;
    setStageLoading(true, '正在重建…');
    if (adapter.disconnect) await adapter.disconnect();
    await connectAndLoad();
  }

  window.DemoUi = /** @type {const} */ ({
    start(next) {
      adapter = next;
      bindEvents();
      setStageLoading(true, '正在加载…');
      connectAndLoad().catch((error) => {
        setStageLoading(false);
        setBadge('未连接', 'err');
        el.stageInfo.textContent = error?.message || String(error);
        fail(error);
      });
    },
  });
})();
