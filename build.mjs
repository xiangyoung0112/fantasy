import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));

// 1. 讀取最新資料
let state = null;
const dbPath = join(root, 'data', 'fantasy.sqlite');
if (existsSync(dbPath)) {
  try {
    const db = new DatabaseSync(dbPath);
    const row = db.prepare('SELECT payload FROM documents WHERE id=1').get();
    if (row?.payload) state = JSON.parse(row.payload);
  } catch (err) {
    console.warn('警告：無法從 SQLite 讀取，嘗試備用方案：', err.message);
  }
}
if (!state && existsSync(join(root, 'public', 'data.json'))) {
  try {
    state = JSON.parse(readFileSync(join(root, 'public', 'data.json'), 'utf8'));
  } catch (e) {}
}

if (!state) {
  console.error('錯誤：找不到任何可打包的聯盟資料！');
  process.exit(1);
}

// 確保目錄存在
mkdirSync(join(root, 'public'), { recursive: true });
mkdirSync(join(root, 'docs'), { recursive: true });
mkdirSync(join(root, 'dist'), { recursive: true });

// 2. 寫入 public/data.json
const jsonStr = JSON.stringify(state, null, 2);
writeFileSync(join(root, 'public', 'data.json'), jsonStr);
writeFileSync(join(root, 'docs', 'data.json'), jsonStr);

// 3. 讀取前端資源並打包
const css = readFileSync(join(root, 'public', 'style.css'), 'utf8');
const logic = readFileSync(join(root, 'public', 'logic.js'), 'utf8').replace(/export /g, '');
const app = readFileSync(join(root, 'public', 'app.js'), 'utf8').replace(/^import .*?;\r?\n/, '');
const bundledJs = logic + '\n' + app;

// 4. 產出單檔獨立 HTML（內嵌所有樣式、運算與最新數據）
const sOpen = '<' + 'script>';
const sClose = '<' + '/script>';
const sBundle = '<' + 'script id="bundle-script">';
const standaloneHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>對戰研究室 · NBA Fantasy</title>
  <style id="bundle-style">${css}</style>
</head>
<body>
  <div id="app"><p class="loading">正在開啟對戰研究室…</p></div>
  <div id="toast" role="status" aria-live="polite"></div>
  ${sOpen}
    window.__INITIAL_DATA__ = ${JSON.stringify(state)};
  ${sClose}
  ${sBundle}
    ${bundledJs}
  ${sClose}
</body>
</html>`;

// 寫入 docs/index.html（供 GitHub Pages 的 /docs 模式直接部署）
writeFileSync(join(root, 'docs', 'index.html'), standaloneHtml);
copyFileSync(join(root, 'public', 'style.css'), join(root, 'docs', 'style.css'));
copyFileSync(join(root, 'public', 'logic.js'), join(root, 'docs', 'logic.js'));
copyFileSync(join(root, 'public', 'app.js'), join(root, 'docs', 'app.js'));

// 寫入根目錄 fantasy-share.html 與 dist/ 供即時測試與外傳
writeFileSync(join(root, 'fantasy-share.html'), standaloneHtml);
writeFileSync(join(root, 'dist', 'fantasy-share.html'), standaloneHtml);

console.log('✅ 打包完成！');
console.log(' ├─ public/data.json (已同步最新 SQLite 數據)');
console.log(' ├─ docs/ (已產出靜態網站，可直接用於 GitHub Pages 部署)');
console.log(' └─ fantasy-share.html (單檔獨立分享版，點兩下即可離線開啟操作)');
