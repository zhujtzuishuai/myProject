'use strict';

const path = require('path');
const fs   = require('fs');

const VERSION = '1.0.5';

// ─── 图片工具 ──────────────────────────────────────────────────────────────────

// 将磁盘文件读成 base64 dataURL（绕开面板 webSecurity 对 file:// canvas 的跨域限制）
function fileToDataUrl(filePath) {
    const buf  = fs.readFileSync(filePath);
    const mime = (buf[0] === 0x89 && buf[1] === 0x50) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
}

// 把任意 src（dataURL 或绝对路径）加载为灰度 32x32 像素数组
function loadGray32(src) {
    const dataUrl = src.startsWith('data:') ? src : fileToDataUrl(src);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 32; c.height = 32;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, 32, 32);
            const { data } = ctx.getImageData(0, 0, 32, 32);
            const px = new Float32Array(1024);
            for (let i = 0; i < 1024; i++) {
                px[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
            }
            resolve(px);
        };
        img.onerror = (e) => reject(new Error('图片加载失败：' + dataUrl.substring(0, 60)));
        img.src = dataUrl;
    });
}

// ─── pHash ────────────────────────────────────────────────────────────────────

function dct1d(arr) {
    const N = arr.length;
    const out = new Float32Array(N);
    for (let k = 0; k < N; k++) {
        let s = 0;
        for (let n = 0; n < N; n++) s += arr[n] * Math.cos(Math.PI * k * (2*n+1) / (2*N));
        out[k] = s * (k === 0 ? Math.sqrt(1/N) : Math.sqrt(2/N));
    }
    return out;
}

function dct2d(px) {
    const N = 32;
    const tmp = new Float32Array(1024);
    const out = new Float32Array(1024);
    for (let y = 0; y < N; y++) {
        const row = dct1d(Array.from(px.subarray(y*N, y*N+N)));
        for (let x = 0; x < N; x++) tmp[y*N+x] = row[x];
    }
    for (let x = 0; x < N; x++) {
        const col = new Float32Array(N);
        for (let y = 0; y < N; y++) col[y] = tmp[y*N+x];
        const dc = dct1d(Array.from(col));
        for (let y = 0; y < N; y++) out[y*N+x] = dc[y];
    }
    return out;
}

async function computePHash(src) {
    const px  = await loadGray32(src);
    const dct = dct2d(px);
    const low = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) low.push(dct[y*32+x]);
    const avg = low.slice(1).reduce((a, b) => a+b, 0) / 63;
    return low.map(v => v >= avg ? 1 : 0);
}

function hammingDist(h1, h2) {
    return h1.reduce((d, b, i) => d + (b !== h2[i] ? 1 : 0), 0);
}

// 计算图片非透明区域的平均 RGB
function loadAvgColor(src) {
    const dataUrl = src.startsWith('data:') ? src : fileToDataUrl(src);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0, 16, 16);
            const { data } = ctx.getImageData(0, 0, 16, 16);
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < 256; i++) {
                if (data[i*4+3] < 128) continue; // 跳过透明像素
                r += data[i*4]; g += data[i*4+1]; b += data[i*4+2];
                n++;
            }
            resolve(n > 0 ? { r: r/n, g: g/n, b: b/n } : { r: 128, g: 128, b: 128 });
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// RGB 欧氏距离，最大值约 441（sqrt(3×255²)）
function colorDist(c1, c2) {
    return Math.sqrt((c1.r-c2.r)**2 + (c1.g-c2.g)**2 + (c1.b-c2.b)**2);
}

// ─── 文件扫描 ─────────────────────────────────────────────────────────────────

function findPrefabs(dir) {
    const result = [];
    function scan(d) {
        try {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) scan(full);
                else if (e.name.endsWith('.prefab')) result.push(full);
            }
        } catch (_) {}
    }
    scan(dir);
    return result;
}

// 返回 [{uuid, tint:{r,g,b}}]，tint 来自 cc.Sprite 组件自身的 _color 字段
function extractSpriteInfos(prefabPath) {
    try {
        const content = fs.readFileSync(prefabPath, 'utf8');
        const objs = JSON.parse(content);
        const result = [];
        const seen = new Set();

        for (let i = 0; i < objs.length; i++) {
            const obj = objs[i];
            if (obj.__type__ !== 'cc.Sprite') continue;
            const sf = obj._spriteFrame;
            if (!sf || !sf.__uuid__) continue;
            const uuid = sf.__uuid__;
            if (seen.has(uuid)) continue;
            seen.add(uuid);

            const c = obj._color;
            const tint = (c && c.__type__ === 'cc.Color')
                ? { r: c.r, g: c.g, b: c.b }
                : { r: 255, g: 255, b: 255 };

            result.push({ uuid, tint });
        }
        return result;
    } catch (_) { return []; }
}

function getPrefabUuid(prefabPath) {
    try {
        return JSON.parse(fs.readFileSync(prefabPath + '.meta', 'utf8')).uuid;
    } catch (_) { return null; }
}

// 优先返回完整纹理图（{base}.png），内容最完整
// _sprite_trim_.png 是编辑器裁剪标记文件（几百字节），不适合 pHash 比对
function findLibraryImage(libraryDir, spriteUuid) {
    const at   = spriteUuid.indexOf('@');
    const base = at >= 0 ? spriteUuid.slice(0, at) : spriteUuid;
    const sub  = at >= 0 ? spriteUuid.slice(at+1)  : '';
    const dir  = path.join(libraryDir, base.substring(0, 2));

    const full = path.join(dir, `${base}.png`);
    if (fs.existsSync(full)) return full;

    if (sub) {
        const trim = path.join(dir, `${base}@${sub}_sprite_trim_.png`);
        if (fs.existsSync(trim)) return trim;
    }
    return null;
}

// ─── 面板 ─────────────────────────────────────────────────────────────────────

module.exports = Editor.Panel.define({

    template: /* html */`
<div class="pf-root">

  <div id="drop-zone" class="drop-zone">
    <canvas id="input-preview"></canvas>
    <span id="drop-hint">将图片拖到这里，或点击选择</span>
    <input type="file" id="file-input" accept="image/*" style="display:none">
  </div>

  <div class="row">
    <label class="row-label">搜索目录（相对 assets/，留空则全部）</label>
    <div class="dir-row">
      <input type="text" id="search-dir" placeholder="例：ui/prefabs">
      <button id="clear-dir-btn" title="清空，搜索全部">×</button>
    </div>
  </div>

  <div class="row">
    <label class="row-label">相似度阈值（汉明距离 ≤ <span id="thr-val">10</span>，越小越严格）</label>
    <input type="range" id="threshold" min="1" max="30" value="10" step="1">
  </div>

  <button id="search-btn" disabled>开始搜索</button>

  <div id="status"></div>
  <div id="results"></div>

  <div id="version-bar">v${VERSION}</div>
</div>
    `,

    style: /* css */`
:host { display: block; }
.pf-root {
    padding: 12px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
    color: #ccc;
    position: relative;
}
.drop-zone {
    border: 2px dashed #555;
    border-radius: 6px;
    padding: 14px;
    text-align: center;
    cursor: pointer;
    min-height: 110px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color .15s, background .15s;
}
.drop-zone.over   { border-color: #4a9eff; background: rgba(74,158,255,.1); }
.drop-zone.loaded { border-style: solid; border-color: #4a9eff; }
#input-preview { display: none; max-width: 220px; max-height: 120px; }
.row { display: flex; flex-direction: column; gap: 4px; }
.row-label { color: #aaa; font-size: 12px; }
.dir-row { display: flex; gap: 4px; }
.dir-row input {
    flex: 1; background: #2c2c2c; border: 1px solid #555;
    color: #ccc; padding: 4px 8px; border-radius: 3px;
}
.dir-row button {
    padding: 0 10px; background: #444; border: 1px solid #555;
    color: #ccc; border-radius: 3px; cursor: pointer;
}
input[type=range] { width: 100%; cursor: pointer; }
#search-btn {
    padding: 7px 16px; background: #4a9eff; color: #fff;
    border: none; border-radius: 4px; cursor: pointer;
    font-size: 13px; align-self: flex-start;
}
#search-btn:disabled { background: #555; cursor: not-allowed; }
#status { color: #aaa; font-size: 12px; min-height: 18px; word-break: break-all; }
#status.error { color: #f87171; }
#results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    padding-bottom: 24px;
}
.result-card {
    border: 1px solid #444; border-radius: 5px; padding: 8px;
    cursor: pointer; text-align: center; background: #252525;
    transition: border-color .12s;
}
.result-card:hover { border-color: #4a9eff; }
.result-card img { width: 100%; height: 80px; object-fit: contain; background: #1a1a1a; border-radius: 3px; }
.result-card .name { font-size: 11px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ddd; }
.result-card .score { font-size: 10px; color: #888; margin-top: 2px; }
.no-result { color: #777; text-align: center; padding: 20px 0; font-size: 12px; }
#version-bar {
    position: fixed;
    bottom: 6px;
    right: 10px;
    font-size: 10px;
    color: #555;
    pointer-events: none;
    user-select: none;
}
    `,

    $: {
        'drop-zone':     '#drop-zone',
        'input-preview': '#input-preview',
        'drop-hint':     '#drop-hint',
        'file-input':    '#file-input',
        'search-dir':    '#search-dir',
        'clear-dir-btn': '#clear-dir-btn',
        'threshold':     '#threshold',
        'thr-val':       '#thr-val',
        'search-btn':    '#search-btn',
        'status':        '#status',
        'results':       '#results',
    },

    methods: {

        setStatus(msg, isError) {
            const el = this.$['status'];
            el.textContent = msg;
            el.className = isError ? 'error' : '';
        },

        async loadInputImage(src) {
            this._inputHash     = null;
            this._inputAvgColor = null;
            this.$['search-btn'].disabled = true;
            this.setStatus('正在计算输入图 pHash…');
            try {
                this._inputHash     = await computePHash(src);
                this._inputAvgColor = await loadAvgColor(src);
            } catch (e) {
                this.setStatus('图片解析失败：' + e.message, true);
                return;
            }
            // 预览
            const preview = this.$['input-preview'];
            const img = new Image();
            img.onload = () => {
                preview.width  = img.naturalWidth;
                preview.height = img.naturalHeight;
                preview.getContext('2d').drawImage(img, 0, 0);
                preview.style.display = 'block';
                this.$['drop-hint'].style.display = 'none';
                this.$['drop-zone'].classList.add('loaded');
            };
            img.src = src.startsWith('data:') ? src : fileToDataUrl(src);
            this.$['search-btn'].disabled = false;
            this.setStatus('图片已加载，pHash 计算完成，可以开始搜索');
        },

        async doSearch() {
            if (!this._inputHash) return;

            const projPath = Editor.Project.path;
            if (!projPath) {
                this.setStatus('无法获取项目路径（Editor.Project.path 为空）', true);
                return;
            }

            const assetsDir  = path.join(projPath, 'assets');
            const libraryDir = path.join(projPath, 'library');
            const subDir     = this.$['search-dir'].value.trim();
            const searchRoot = subDir ? path.join(assetsDir, subDir) : assetsDir;

            if (!fs.existsSync(searchRoot)) {
                this.setStatus(`目录不存在：${searchRoot}`, true);
                return;
            }

            const threshold = parseInt(this.$['threshold'].value);
            this.$['search-btn'].disabled = true;
            this.$['results'].innerHTML = '';
            this.setStatus(`扫描中… 项目：${projPath}`);

            const prefabs = findPrefabs(searchRoot);
            if (prefabs.length === 0) {
                this.setStatus(`未找到 .prefab（搜索根：${searchRoot}）`, true);
                this.$['search-btn'].disabled = false;
                return;
            }

            const matches = [];
            let errCount  = 0;

            for (let i = 0; i < prefabs.length; i++) {
                if (i % 5 === 0) {
                    this.setStatus(`处理 ${i+1} / ${prefabs.length}  错误：${errCount}`);
                    await new Promise(r => setTimeout(r, 0));
                }

                const spriteInfos = extractSpriteInfos(prefabs[i]);
                if (spriteInfos.length === 0) continue;

                let minDist = Infinity;
                let bestImg = null;
                let bestTint = { r: 255, g: 255, b: 255 };

                for (const { uuid, tint } of spriteInfos) {
                    const imgPath = findLibraryImage(libraryDir, uuid);
                    if (!imgPath) continue;
                    try {
                        const hash = await computePHash(imgPath);
                        const dist = hammingDist(this._inputHash, hash);
                        if (dist > threshold) continue;

                        // 颜色过滤：纹理平均色 × tint 归一化 = 实际显示色
                        if (this._inputAvgColor) {
                            const texColor = await loadAvgColor(imgPath);
                            const actual = {
                                r: texColor.r * tint.r / 255,
                                g: texColor.g * tint.g / 255,
                                b: texColor.b * tint.b / 255,
                            };
                            const cd = colorDist(actual, this._inputAvgColor);
                            if (cd > 80) continue;
                        }

                        if (dist < minDist) { minDist = dist; bestImg = imgPath; bestTint = tint; }
                    } catch (e) {
                        errCount++;
                        console.warn('[prefab-finder] 比对失败', imgPath, e.message);
                    }
                }

                if (minDist <= threshold && bestImg) {
                    matches.push({
                        prefabPath: prefabs[i],
                        uuid:       getPrefabUuid(prefabs[i]),
                        imgPath:    bestImg,
                        tint:       bestTint,
                        dist:       minDist,
                        name:       path.basename(prefabs[i], '.prefab'),
                        relPath:    path.relative(assetsDir, prefabs[i]).replace(/\\/g, '/'),
                    });
                }
            }

            matches.sort((a, b) => a.dist - b.dist);
            const errTip = errCount > 0 ? `  （${errCount} 个图片读取失败，见控制台）` : '';
            this.setStatus(`找到 ${matches.length} 个相似预制体，共扫描 ${prefabs.length} 个${errTip}`);
            this.renderResults(matches);
            this.$['search-btn'].disabled = false;
        },

        async loadAssetByUuid(uuid) {
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                if (!info) { this.setStatus('未找到资源信息', true); return; }
                const projPath = Editor.Project.path;
                const prefix   = uuid.substring(0, 2);
                const imgPath  = path.join(projPath, 'library', prefix, uuid + '.png');
                if (fs.existsSync(imgPath)) {
                    await this.loadInputImage(imgPath);
                } else {
                    this.setStatus('该资源在 library 中没有图片（uuid=' + uuid + '）', true);
                }
            } catch (e) {
                this.setStatus('资源加载失败：' + e.message, true);
            }
        },

        async renderResults(matches) {
            const container = this.$['results'];
            if (matches.length === 0) {
                container.innerHTML = '<div class="no-result">未找到相似的预制体，可尝试调高阈值</div>';
                return;
            }
            container.innerHTML = '';
            for (const m of matches) {
                const thumbUrl = await this.applyTint(m.imgPath, m.tint);

                const card = document.createElement('div');
                card.className = 'result-card';
                card.title = m.relPath;
                card.innerHTML = `
                    <img src="${thumbUrl}">
                    <div class="name">${m.name}</div>
                    <div class="score">距离：${m.dist}</div>
                `;
                if (m.uuid) {
                    card.addEventListener('click', () => {
                        Editor.Selection.clear('asset');
                        Editor.Selection.select('asset', m.uuid);
                        Editor.Message.send('assets', 'twinkle', m.uuid);
                    });
                }
                container.appendChild(card);
            }
        },

        // 将纹理像素乘以 tint，返回 Promise<dataURL>
        applyTint(imgPath, tint) {
            const dataUrl = fileToDataUrl(imgPath);
            if (tint.r === 255 && tint.g === 255 && tint.b === 255) {
                return Promise.resolve(dataUrl);
            }
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const c   = document.createElement('canvas');
                    c.width   = img.naturalWidth;
                    c.height  = img.naturalHeight;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const id = ctx.getImageData(0, 0, c.width, c.height);
                    const d  = id.data;
                    const tr = tint.r / 255, tg = tint.g / 255, tb = tint.b / 255;
                    for (let i = 0; i < d.length; i += 4) {
                        d[i]   = d[i]   * tr;
                        d[i+1] = d[i+1] * tg;
                        d[i+2] = d[i+2] * tb;
                    }
                    ctx.putImageData(id, 0, 0);
                    resolve(c.toDataURL());
                };
                img.onerror = () => resolve(dataUrl);
                img.src = dataUrl;
            });
        },
    },

    ready() {
        this._inputHash     = null;
        this._inputAvgColor = null;

        this.$['threshold'].addEventListener('input', () => {
            this.$['thr-val'].textContent = this.$['threshold'].value;
        });

        this.$['clear-dir-btn'].addEventListener('click', () => {
            this.$['search-dir'].value = '';
        });

        this.$['search-btn'].addEventListener('click', () => this.doSearch());

        this.$['drop-zone'].addEventListener('click', (e) => {
            if (e.target !== this.$['file-input']) this.$['file-input'].click();
        });

        this.$['file-input'].addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => this.loadInputImage(ev.target.result);
            reader.readAsDataURL(file);
        });

        const dz = this.$['drop-zone'];
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('over'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('over');

            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = ev => this.loadInputImage(ev.target.result);
                reader.readAsDataURL(file);
                return;
            }

            const text = e.dataTransfer.getData('text/plain');
            if (text && /^[0-9a-f-]{36}$/.test(text.trim())) {
                this.loadAssetByUuid(text.trim());
            }
        });
    },

});
