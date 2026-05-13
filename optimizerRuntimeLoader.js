/* optimizerRuntimeLoader.js */

window.OptimizerRuntime = {
  loaded: false,
  manifest: null,
  chunks: {},
  runtimeFlags: {},
};

async function loadOptimizerRuntimeChunk(basePath, chunkInfo) {
  const url = `${basePath}/${chunkInfo.file}?v=${Date.now()}`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed runtime chunk: ${chunkInfo.file}`);
  }
  return response.json();
}

window.loadOptimizerRuntime = async function loadOptimizerRuntime() {
  if (window.OptimizerRuntime.loaded) {
    return window.OptimizerRuntime;
  }

  const basePath = './apkfiles/entries/runtime';

  const manifestResponse = await fetch(
    `${basePath}/optimizer_runtime_manifest.json?v=${Date.now()}`,
    { cache: 'no-store' }
  );

  if (!manifestResponse.ok) {
    throw new Error('Failed optimizer runtime manifest');
  }

  const manifest = await manifestResponse.json();

  window.OptimizerRuntime.manifest = manifest;
  window.OptimizerRuntime.runtimeFlags = manifest.runtimeFlags || {};

  const chunkEntries = Object.entries(manifest.chunks || {});

  for (const [key, chunkInfo] of chunkEntries) {
    try {
      const chunk = await loadOptimizerRuntimeChunk(basePath, chunkInfo);
      window.OptimizerRuntime.chunks[key] = chunk.data;
    } catch (err) {
      console.error('[OptimizerRuntime]', key, err);
    }
  }

  window.OptimizerRuntime.loaded = true;

  console.log('[OptimizerRuntime] Loaded runtime chunks', {
    chunks: Object.keys(window.OptimizerRuntime.chunks),
    flags: window.OptimizerRuntime.runtimeFlags,
  });

  return window.OptimizerRuntime;
};
