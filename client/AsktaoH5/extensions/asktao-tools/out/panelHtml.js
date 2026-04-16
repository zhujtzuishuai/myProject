"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPanelHtml = getPanelHtml;
function getPanelHtml(webview, defaultYaml) {
    const nonce = getNonce();
    const escapedYaml = defaultYaml
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AsktaoH5 配置工具</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
    }
    h1 { font-size: 1.3em; margin-bottom: 16px; }
    h2 { font-size: 1.05em; margin: 20px 0 8px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    label { display: block; margin-bottom: 4px; font-weight: 600; }
    input, select, textarea {
      width: 100%;
      padding: 5px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 3px;
      font-family: inherit;
      font-size: inherit;
      margin-bottom: 10px;
    }
    textarea { resize: vertical; min-height: 80px; font-family: monospace; }
    .row { display: flex; gap: 12px; }
    .row > .field { flex: 1; }
    .field { margin-bottom: 4px; }
    button {
      padding: 7px 18px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: inherit;
      margin-right: 8px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    #output {
      margin-top: 16px;
      padding: 10px;
      background: var(--vscode-terminal-background, #1e1e1e);
      color: var(--vscode-terminal-foreground, #d4d4d4);
      border-radius: 4px;
      font-family: monospace;
      white-space: pre-wrap;
      min-height: 60px;
      display: none;
    }
    #output.visible { display: block; }
    .ok   { color: #4ec9b0; }
    .skip { color: #dcdcaa; }
    .err  { color: #f44747; }
    .tabs { display: flex; gap: 0; margin-bottom: 16px; }
    .tab {
      padding: 6px 16px;
      cursor: pointer;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      border-radius: 3px 3px 0 0;
      margin-right: 2px;
    }
    .tab.active {
      background: var(--vscode-tab-activeBackground, #1e1e1e);
      border-bottom-color: var(--vscode-tab-activeBackground, #1e1e1e);
      font-weight: bold;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .hint { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
    .actions { margin-top: 16px; }
    #csvInsert_afterName_row { display: none; }
  </style>
</head>
<body>
  <h1>🛠 AsktaoH5 配置工具</h1>

  <div class="tabs">
    <div class="tab active" data-tab="form">表单模式</div>
    <div class="tab" data-tab="yaml">YAML 模式</div>
  </div>

  <!-- ── 表单模式 ── -->
  <div class="tab-content active" id="tab-form">

    <h2>全局路径</h2>
    <div class="field"><label>ResMgr 路径</label><input id="global_resMgrPath" value="AsktaoH5/assets/scripts/mgr/ResMgr.ts" /></div>
    <div class="field"><label>ConfigMgr 路径</label><input id="global_configMgrPath" value="AsktaoH5/assets/scripts/mgr/ConfigMgr.ts" /></div>

    <h2>基本信息</h2>
    <div class="row">
      <div class="field">
        <label>配置类型</label>
        <select id="selectedType">
          <option value="roleFashion">角色时装</option>
        </select>
      </div>
      <div class="field">
        <label>CSV 路径</label>
        <input id="csvPath" value="AsktaoH5/res/cfg/csv/DecorateInfo.csv" />
      </div>
    </div>

    <h2>道具信息</h2>
    <div class="row">
      <div class="field"><label>道具名</label><input id="item_name" value="道载万金" /></div>
      <div class="field"><label>道具编号</label><input id="item_itemId" value="530" /></div>
    </div>
    <div class="row">
      <div class="field"><label>图标 (icon)</label><input id="item_icon" value="decorate_fashion_35" /></div>
      <div class="field"><label>模型/特效图标 (icon2)</label><input id="item_modelOrEffectIcon" value="90001" /></div>
    </div>
    <div class="row">
      <div class="field"><label>特效配置 (effectCfg)</label><input id="item_effectConfig" value="" /></div>
      <div class="field"><label>单位</label><input id="item_unit" value="套" /></div>
    </div>
    <div class="row">
      <div class="field"><label>品质 (color)</label><input id="item_quality" value="金色" /></div>
      <div class="field"><label>类型</label><input id="item_type" value="fashion_icon" /></div>
    </div>
    <div class="field"><label>描述</label><input id="item_desc" value="天命所归作金州，大道无形载乾坤。男子使用后将会身着华美的服饰。" /></div>
    <div class="field"><label>来源</label><input id="item_source" value="[一周年庆活动#@|MGFestivalActivityDlg=一周年庆#@]" /></div>
    <div class="row">
      <div class="field"><label>特殊备注 (flag)</label><input id="item_specialNote" value="" /></div>
      <div class="field"><label>额外参数 (extraParams)</label><input id="item_extraParam" value="" /></div>
    </div>

    <h2>CSV 插入位置</h2>
    <div class="row">
      <div class="field">
        <label>插入模式</label>
        <select id="csvInsert_mode">
          <option value="sortByItemId">sortByItemId（按编号自动排序）</option>
          <option value="tail">tail（插入到尾部）</option>
          <option value="head">head（插入到头部）</option>
        </select>
      </div>
    </div>
    <p class="hint" id="csvInsert_hint">按道具编号数值升序自动找到插入位置，无需手动指定。</p>

    <h2>ResMgr 配置</h2>
    <div class="row">
      <div class="field"><label>模块名</label><input id="resMgr_module" value="ui" /></div>
      <div class="field"><label>Key</label><input id="resMgr_key" value="decorate_fashion_35" /></div>
    </div>
    <div class="field"><label>Value（路径）</label><input id="resMgr_value" value="items/90001_50/texture" /></div>

    <h2>ConfigMgr 配置</h2>
    <div class="row">
      <div class="field"><label>变量名</label><input id="configMgr_variable" value="FashionConfig" /></div>
    </div>
    <div class="row">
      <div class="field"><label>男性时装名</label><input id="configMgr_left" value="道载万金" /></div>
      <div class="field"><label>女性时装名</label><input id="configMgr_right" value="玲珑宝韵" /></div>
    </div>

    <div class="actions">
      <button id="btn-run-form">▶ 执行</button>
      <button class="secondary" id="btn-export-yaml">导出为 YAML</button>
    </div>
  </div>

  <!-- ── YAML 模式 ── -->
  <div class="tab-content" id="tab-yaml">
    <p class="hint">直接编辑 YAML 配置，或点击"选择文件"加载已有的 process-config.yaml。</p>
    <div class="actions" style="margin-bottom:10px;">
      <button class="secondary" id="btn-pick-yaml">📂 选择 YAML 文件</button>
    </div>
    <label>YAML 内容</label>
    <textarea id="yaml-editor" rows="24">${escapedYaml}</textarea>
    <div class="actions">
      <button id="btn-run-yaml">▶ 执行</button>
    </div>
  </div>

  <div id="output"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // ── Tab switching ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // ── Insert mode hint ──
    const hintMap = {
      sortByItemId: '按道具编号数值升序自动找到插入位置，无需手动指定。',
      tail: '插入到当前模块数据区末尾。',
      head: '插入到当前模块数据区开头。',
    };
    document.getElementById('csvInsert_mode').addEventListener('change', function() {
      document.getElementById('csvInsert_hint').textContent = hintMap[this.value] || '';
    });

    // ── Build config from form ──
    function buildConfigFromForm() {
      const mode = document.getElementById('csvInsert_mode').value;
      return {
        globalConfig: {
          resMgrPath: document.getElementById('global_resMgrPath').value,
          configMgrPath: document.getElementById('global_configMgrPath').value,
        },
        types: {
          roleFashion: {
            label: '角色时装',
            csvPath: document.getElementById('csvPath').value,
            csvInsert: { mode },
            item: {
              name:               document.getElementById('item_name').value,
              itemId:             document.getElementById('item_itemId').value,
              icon:               document.getElementById('item_icon').value,
              modelOrEffectIcon:  document.getElementById('item_modelOrEffectIcon').value,
              effectConfig:       document.getElementById('item_effectConfig').value,
              unit:               document.getElementById('item_unit').value,
              quality:            document.getElementById('item_quality').value,
              type:               document.getElementById('item_type').value,
              desc:               document.getElementById('item_desc').value,
              source:             document.getElementById('item_source').value,
              specialNote:        document.getElementById('item_specialNote').value,
              extraParam:         document.getElementById('item_extraParam').value,
            },
            resMgr: {
              module: document.getElementById('resMgr_module').value,
              key:    document.getElementById('resMgr_key').value,
              value:  document.getElementById('resMgr_value').value,
            },
            configMgr: {
              variable: document.getElementById('configMgr_variable').value,
              appendPair: [
                document.getElementById('configMgr_left').value,
                document.getElementById('configMgr_right').value,
              ]
            }
          }
        },
        flow: {
          selectedType: document.getElementById('selectedType').value,
          steps: ['validateType','updateDecorateInfoCsv','updateResMgr','updateConfigMgr','summary']
        }
      };
    }

    document.getElementById('btn-run-form').addEventListener('click', () => {
      vscode.postMessage({ command: 'runFromObject', config: buildConfigFromForm() });
    });

    document.getElementById('btn-export-yaml').addEventListener('click', () => {
      vscode.postMessage({ command: 'exportYaml', config: buildConfigFromForm() });
    });

    document.getElementById('btn-pick-yaml').addEventListener('click', () => {
      vscode.postMessage({ command: 'pickYamlFile' });
    });

    document.getElementById('btn-run-yaml').addEventListener('click', () => {
      vscode.postMessage({ command: 'runFromYaml', yamlText: document.getElementById('yaml-editor').value });
    });

    // ── Receive messages from extension ──
    window.addEventListener('message', event => {
      const msg = event.data;
      const out = document.getElementById('output');
      if (msg.command === 'result') {
        out.classList.add('visible');
        out.innerHTML = formatReport(msg.report);
      } else if (msg.command === 'error') {
        out.classList.add('visible');
        out.innerHTML = '<span class="err">❌ ' + escHtml(msg.message) + '</span>';
      } else if (msg.command === 'yamlLoaded' || msg.command === 'exportedYaml') {
        document.getElementById('yaml-editor').value = msg.yamlText;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="yaml"]').classList.add('active');
        document.getElementById('tab-yaml').classList.add('active');
      }
    });

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function formatReport(report) {
      if (!Array.isArray(report)) return escHtml(JSON.stringify(report, null, 2));
      return report.map(r => {
        const stepName = escHtml(r.step);
        if (r.skipped) {
          return '<span class="skip">⏭ ' + stepName + ': 跳过 — ' + escHtml(r.reason || '') + '</span>';
        }
        if (r.ok === false) {
          return '<span class="err">❌ ' + stepName + ': 失败 — ' + escHtml(r.reason || '') + '</span>';
        }
        let detail = '';
        if (r.insertedRow) detail = '\\n   插入行: ' + escHtml(r.insertedRow);
        if (r.inserted)    detail = '\\n   插入: ' + escHtml(r.inserted);
        if (r.selectedType) detail = ' → ' + escHtml(r.selectedType);
        return '<span class="ok">✅ ' + stepName + detail + '</span>';
      }).join('\\n');
    }
  </script>
</body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=panelHtml.js.map