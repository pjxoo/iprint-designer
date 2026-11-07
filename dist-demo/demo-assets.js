/**
 * 整合 DEMO · 共用资源层。
 * 真源在 `src/assets/library`；本层只读同目录 `bundle.js`（无 JSON 副本）。
 *
 *   const catalog  = await DemoAssets.loadCatalog();
 *   const template = DemoAssets.findTemplate(catalog, 'ticket-pos');
 *   const file     = await DemoAssets.readTemplate(template);
 *   const sample   = await DemoAssets.readSample(catalog, template, 'apparel');
 */
(function () {
  'use strict';

  const SERVE_HINT =
    '未找到 demo/bundle.js。请先跑 npm run demo:public，' +
    '再用 npm run dev 打开 /demo/embed/ 或 /demo/iframe/。';

  let bundlePromise = null;
  const keyCache = new Map();

  /** 本脚本所在目录 = demo/（构建后在 dist-demo/） */
  function demoRootUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const src = scripts[i].src;
      if (src && /demo-assets\.js(?:\?|$)/.test(src)) {
        return new URL('.', src);
      }
    }
    return new URL('../', location.href);
  }

  function loadBundle() {
    if (bundlePromise) return bundlePromise;
    bundlePromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = new URL('bundle.js', demoRootUrl()).href;
      script.onload = () =>
        resolve(window.__IPRINT_LIBRARY_BUNDLE__ || null);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
    return bundlePromise;
  }

  async function ensureBundle() {
    const bundle = await loadBundle();
    if (!bundle) throw new Error(SERVE_HINT);
    return bundle;
  }

  async function readKey(key) {
    if (!key) throw new Error('资源 key 为空');
    if (!keyCache.has(key)) {
      keyCache.set(
        key,
        ensureBundle().then((bundle) => {
          if (!(key in bundle)) {
            throw new Error(`bundle 中无「${key}」`);
          }
          return bundle[key];
        }),
      );
    }
    return keyCache.get(key);
  }

  function loadCatalog() {
    return readKey('catalog.json');
  }

  function findTemplate(catalog, templateId) {
    return catalog?.templates?.find((item) => item.id === templateId) ?? null;
  }

  function findDataSource(catalog, dataSourceId) {
    return (
      catalog?.dataSources?.find((item) => item.id === dataSourceId) ?? null
    );
  }

  function readTemplate(template) {
    if (!template?.templateUrl) throw new Error('未选择模板');
    return readKey(template.templateUrl);
  }

  async function readSample(catalog, template, dataSourceId) {
    const id = dataSourceId || template?.dataSourceId;
    const meta = findDataSource(catalog, id);
    if (!meta?.dataUrl) {
      throw new Error(`未找到样例数据：${id || '（数据源为空）'}`);
    }
    const sample = await readKey(meta.dataUrl);
    const data =
      sample && sample.data && typeof sample.data === 'object'
        ? sample.data
        : sample;
    return {
      data,
      dataSourceId: meta.id,
      dataSourceName: meta.name,
      url: meta.dataUrl,
    };
  }

  async function readDataSourceSchema(catalog, dataSourceId) {
    const meta = findDataSource(catalog, dataSourceId);
    if (!meta) throw new Error(`未找到数据源：${dataSourceId}`);
    if (meta.schemaUrl) return readKey(meta.schemaUrl);
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      fields: meta.fields || [],
    };
  }

  function parseJsonObject(text) {
    const parsed = JSON.parse(text?.trim() || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('业务 JSON 的根必须是对象');
    }
    return parsed;
  }

  window.DemoAssets = {
    SERVE_HINT,
    isServed: function isServed() {
      return location.protocol !== 'file:';
    },
    loadCatalog,
    findTemplate,
    findDataSource,
    readTemplate,
    readSample,
    readDataSourceSchema,
    parseJsonObject,
    clearCache: function clearCache() {
      keyCache.clear();
      bundlePromise = null;
    },
  };
})();
