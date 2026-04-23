"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPanelHtml = getPanelHtml;
function getPanelHtml(webview, store) {
    const nonce = getNonce();
    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>功能检查器</title>
  <style nonce="${nonce}">
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%}
    body{font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);background:var(--vscode-editor-background);overflow:hidden}
    .layout{display:flex;height:100vh;gap:0}
    .left{width:520px;min-width:400px;max-width:620px;flex-shrink:0;overflow-y:auto;padding:12px;border-right:1px solid var(--vscode-panel-border,#3c3c3c)}
    .right{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
    .section{background:var(--vscode-sideBar-background,#252526);border:1px solid var(--vscode-panel-border,#3c3c3c);border-radius:4px;padding:10px 12px;margin-bottom:8px}
    .right .section{margin-bottom:0}
    .field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
    .field:last-child{margin-bottom:0}
    .field label{font-size:11px;color:var(--vscode-descriptionForeground)}
    .bar{display:flex;gap:6px;align-items:center}
    .bar select{flex:1}
    input,select{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,#555);border-radius:3px;padding:5px 8px;font-size:13px;width:100%;height:28px}
    input:focus,select:focus{outline:1px solid var(--vscode-focusBorder)}
    button{padding:5px 12px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground);border:1px solid var(--vscode-button-border,transparent);border-radius:3px;cursor:pointer;font-size:12px;white-space:nowrap;height:28px}
    button:hover{background:var(--vscode-button-secondaryHoverBackground)}
    button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:transparent}
    button.primary:hover{background:var(--vscode-button-hoverBackground)}
    button.danger{background:var(--vscode-inputValidation-errorBackground,#5a1d1d);color:#f48771;border-color:transparent}
    button.danger:hover{opacity:.85}
    button.icon{padding:2px 6px;height:22px;font-size:11px}
    .hint{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px;line-height:1.6}
    .hint.warn{color:#e5c07b}
    .hint.ok{color:#4ec9b0}
    .divider{border:none;border-top:1px solid var(--vscode-panel-border,#3c3c3c);margin:10px 0}
    .step-card{border:1px solid var(--vscode-panel-border,#3c3c3c);border-radius:4px;padding:8px 10px;margin-bottom:8px;background:var(--vscode-editor-background)}
    .step-header{display:flex;align-items:center;gap:6px;margin-bottom:8px}
    .step-header input{flex:2}
    .step-body{display:flex;flex-direction:column;gap:6px}
    .step-row{display:flex;gap:6px;align-items:center}
    .step-row label{font-size:11px;color:var(--vscode-descriptionForeground);width:70px;flex-shrink:0}
    .step-row input,.step-row select{flex:1}
    .step-row input[type=checkbox]{width:16px;height:16px;flex:none}
    .req-badge{display:inline-flex;align-items:center;gap:3px;font-size:11px;padding:2px 8px;border-radius:3px;cursor:pointer;user-select:none;position:relative;border:1px solid transparent;transition:opacity .15s}
    .req-badge.req{background:rgba(244,71,71,.15);color:#f48771;border-color:rgba(244,71,71,.3)}
    .req-badge.opt{background:rgba(229,192,123,.15);color:#e5c07b;border-color:rgba(229,192,123,.3)}
    .req-badge:hover{opacity:.8}
    .req-badge::after{content:'↕';font-size:9px;opacity:.6;margin-left:2px}
    .req-badge:hover .tooltip{display:block}
    .tooltip{display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:99;background:var(--vscode-editorHoverWidget-background,#252526);border:1px solid var(--vscode-editorHoverWidget-border,#454545);border-radius:4px;padding:6px 8px;font-size:11px;color:var(--vscode-editorHoverWidget-foreground,#ccc);white-space:nowrap;pointer-events:none;line-height:1.6}
    .input-row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
    .input-row input{flex:1}
    .rt-field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
    .rt-field label{font-size:11px;color:var(--vscode-descriptionForeground)}
    .result-title{font-weight:600;margin-bottom:8px;font-size:13px}
    .warn-box{background:rgba(255,200,0,.08);border:1px solid rgba(255,200,0,.3);border-radius:3px;padding:8px 10px;margin-bottom:8px;font-size:12px;color:#e5c07b;white-space:pre-wrap}
    .step-result{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--vscode-panel-border,#3c3c3c);font-size:12px}
    .step-result:last-child{border-bottom:none}
    .sr-icon{width:18px;flex-shrink:0;text-align:center;font-size:14px}
    .sr-label{flex:1;font-weight:600}
    .sr-msg{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:2px;white-space:pre-wrap}
    .pass{color:#4ec9b0}.fail-r{color:#f44747}.fail-o{color:#e5c07b}
    .empty-hint{color:var(--vscode-descriptionForeground);font-size:12px;padding:6px 0}
    .run-btn{width:100%;height:34px;font-size:13px;margin-top:4px}
    .save-btn{width:100%;margin-top:6px}
    details>summary{cursor:pointer;font-weight:600;font-size:13px;list-style:none;display:flex;align-items:center;gap:6px}
    details[open]>summary{padding-bottom:10px}
    details>summary::before{content:'▶';font-size:10px;transition:transform .15s}
    details[open]>summary::before{transform:rotate(90deg)}
    .tag{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;background:rgba(78,201,176,.2);color:#4ec9b0}
    .tag.warn{background:rgba(229,192,123,.2);color:#e5c07b}
    .right-placeholder{color:var(--vscode-descriptionForeground);font-size:12px;padding:20px 0;text-align:center}
  </style>
</head>
<body>
<div class="layout">

<!-- 左侧：配置 -->
<div class="left">

<!-- 仓库 -->
<div class="section">
  <div class="field">
    <label>当前仓库</label>
    <div class="bar">
      <select id="ws-select"><option value="">（加载中...）</option></select>
      <button id="btn-add-ws">+ 注册</button>
      <button class="danger" id="btn-del-ws">删除</button>
    </div>
  </div>
  <div id="ws-info" class="hint">检测中...</div>
</div>

<!-- 检查项 -->
<div class="section">
  <div class="field">
    <label>检查项</label>
    <div class="bar">
      <select id="feature-select"><option value="">（无检查项）</option></select>
      <button id="btn-add-feature">+ 新增</button>
      <button class="danger" id="btn-del-feature">删除</button>
    </div>
  </div>
</div>

<!-- 配置 -->
<details class="section" id="feature-config">
  <summary>检查项配置</summary>
  <div class="field" style="margin-top:4px">
    <label>运行时输入（执行前填写的变量）</label>
    <div id="inputs-wrap"></div>
    <button id="btn-add-input" style="margin-top:2px;width:100%">+ 添加输入项</button>
  </div>
  <hr class="divider"/>
  <div class="field">
    <label>检查步骤</label>
    <div id="steps-wrap"></div>
    <div style="display:flex;gap:6px;margin-top:2px">
      <select id="step-type-select" style="flex:1">
        <option value="fileExists">文件/目录存在</option>
        <option value="resMgrKey">ResMgr Key 存在</option>
        <option value="csvField">CSV 字段非空</option>
        <option value="charResource">角色资源检查</option>
      </select>
      <button id="btn-add-step">+ 添加步骤</button>
    </div>
  </div>
  <button class="primary save-btn" id="btn-save-feature">保存配置</button>
</details>

</div><!-- /left -->

<!-- 右侧：执行 + 结果 -->
<div class="right">

<div class="section">
  <div id="runtime-inputs"></div>
  <button class="primary run-btn" id="btn-run">执行检查</button>
</div>

<div class="section" id="result-section" style="display:none">
  <div class="result-title">检查结果</div>
  <div id="warnings-wrap"></div>
  <div id="result-wrap"></div>
</div>

<div id="right-placeholder" class="right-placeholder">填写左侧输入项后点击"执行检查"</div>

</div><!-- /right -->
</div><!-- /layout -->

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
let currentFeatureId = '';
let pendingInputs = [];
let pendingSteps  = [];

vscode.postMessage({ cmd: 'init' });

// ── 工作区 ────────────────────────────────────────────────────────────────────
document.getElementById('ws-select').addEventListener('change', e => {
  vscode.postMessage({ cmd: 'switchWorkspace', name: e.target.value });
});
document.getElementById('btn-add-ws').addEventListener('click', () => {
  vscode.postMessage({ cmd: 'pickSvnDir' });
});
document.getElementById('btn-del-ws').addEventListener('click', () => {
  const name = document.getElementById('ws-select').value;
  if (name) { vscode.postMessage({ cmd: 'removeWorkspace', name }); }
});

// ── 检查项 ────────────────────────────────────────────────────────────────────
document.getElementById('feature-select').addEventListener('change', e => {
  currentFeatureId = e.target.value;
  vscode.postMessage({ cmd: 'getFeature', featureId: currentFeatureId });
});
document.getElementById('btn-add-feature').addEventListener('click', () => {
  vscode.postMessage({ cmd: 'addFeature' });
});
document.getElementById('btn-del-feature').addEventListener('click', () => {
  if (!currentFeatureId) { return; }
  const label = document.getElementById('feature-select').selectedOptions[0]?.text || currentFeatureId;
  vscode.postMessage({ cmd: 'removeFeature', featureId: currentFeatureId, label });
});

// ── 步骤/输入 ─────────────────────────────────────────────────────────────────
document.getElementById('btn-add-step').addEventListener('click', () => {
  const type = document.getElementById('step-type-select').value;
  const id = Date.now().toString();
  const defaults = {
    fileExists:   { id, type, label: '文件存在', required: true, pathTemplate: '' },
    resMgrKey:    { id, type, label: 'ResMgr Key', required: true, keyTemplate: '', modulePath: 'ui' },
    csvField:     { id, type, label: 'CSV 字段', required: true, csvPath: '', filterField: '', filterValueKey: '', checkField: '' },
    charResource: { id, type, label: '角色资源', required: true, idKey: '' },
  };
  pendingSteps.push(defaults[type]);
  renderSteps();
});
document.getElementById('btn-add-input').addEventListener('click', () => {
  pendingInputs.push({ key: '', label: '', placeholder: '' });
  renderInputs();
});

// ── 保存 ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-save-feature').addEventListener('click', () => {
  collectInputs();
  const label = document.getElementById('feature-select').selectedOptions[0]?.text || '';
  vscode.postMessage({ cmd: 'saveFeature', featureId: currentFeatureId, label, inputs: pendingInputs, steps: pendingSteps });
});

// ── 执行 ──────────────────────────────────────────────────────────────────────
document.getElementById('btn-run').addEventListener('click', () => {
  const inputs = {};
  document.querySelectorAll('.rt-input').forEach(el => { inputs[el.dataset.key] = el.value.trim(); });
  vscode.postMessage({ cmd: 'runCheck', featureId: currentFeatureId, inputs });
});

// ── 消息处理 ──────────────────────────────────────────────────────────────────
window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.cmd) {

    case 'initData': {
      renderWsList(msg.wsNames, msg.currentWs);
      renderWsInfo(msg.currentWs, msg.currentRoot, msg.autoMatched);
      renderFeatureList(msg.features, '');
      break;
    }

    case 'setWorkspaceList': {
      renderWsList(msg.wsNames, msg.currentWs);
      renderWsInfo(msg.currentWs, msg.currentRoot, [msg.currentWs]);
      break;
    }

    case 'setWorkspaceInfo': {
      const name = document.getElementById('ws-select').value;
      renderWsInfo(name, msg.root, []);
      break;
    }

    case 'setFeatureList': {
      renderFeatureList(msg.features, msg.selectId || '');
      break;
    }

    case 'setFeature': {
      const f = msg.feature;
      if (!f) { pendingInputs = []; pendingSteps = []; renderInputs(); renderSteps(); renderRuntimeInputs([]); break; }
      pendingInputs = JSON.parse(JSON.stringify(f.inputs || []));
      pendingSteps  = JSON.parse(JSON.stringify(f.steps  || []));
      renderInputs(); renderSteps(); renderRuntimeInputs(pendingInputs);
      document.getElementById('result-section').style.display = 'none';
      break;
    }

    case 'showResult': renderResult(msg.result); break;
    case 'saved': renderRuntimeInputs(pendingInputs); break;
  }
});

// ── 工作区渲染 ────────────────────────────────────────────────────────────────
function renderWsList(names, current) {
  const sel = document.getElementById('ws-select');
  sel.innerHTML = names.length
    ? names.map(n => '<option value="' + esc(n) + '"' + (n === current ? ' selected' : '') + '>' + esc(n) + '</option>').join('')
    : '<option value="">（无仓库，请注册）</option>';
}

function renderWsInfo(name, root, autoMatched) {
  const info = document.getElementById('ws-info');
  if (!name || !root) {
    info.className = 'hint warn';
    info.innerHTML = '未配置仓库，点击"+ 注册"选择 SVN 根目录';
    return;
  }
  const isAuto = autoMatched && autoMatched.includes(name);
  info.className = 'hint ok';
  info.innerHTML = (isAuto ? '<span class="tag">自动匹配</span> ' : '') + esc(root);
}

// ── 检查项渲染 ────────────────────────────────────────────────────────────────
function renderFeatureList(features, selectId) {
  const sel = document.getElementById('feature-select');
  const entries = Object.entries(features || {});
  sel.innerHTML = entries.length
    ? entries.map(([id, f]) => '<option value="' + esc(id) + '">' + esc(f.label) + '</option>').join('')
    : '<option value="">（无检查项）</option>';
  if (selectId) { sel.value = selectId; }
  currentFeatureId = sel.value;
  if (currentFeatureId) { vscode.postMessage({ cmd: 'getFeature', featureId: currentFeatureId }); }
}

// ── 输入项配置 ────────────────────────────────────────────────────────────────
function renderInputs() {
  const wrap = document.getElementById('inputs-wrap');
  wrap.innerHTML = '';
  if (!pendingInputs.length) { wrap.innerHTML = '<div class="empty-hint">暂无输入项</div>'; return; }
  pendingInputs.forEach((inp, idx) => {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML =
      '<input class="inp-key" placeholder="变量名（如 charId）" value="' + esc(inp.key) + '"/>' +
      '<input class="inp-label" placeholder="显示名（如 角色ID）" value="' + esc(inp.label) + '"/>' +
      '<input class="inp-ph" placeholder="提示文字（可选）" value="' + esc(inp.placeholder||'') + '"/>' +
      '<button class="danger icon inp-del">✕</button>';
    wrap.appendChild(row);
    row.querySelector('.inp-key').addEventListener('input', e => { pendingInputs[idx].key = e.target.value; });
    row.querySelector('.inp-label').addEventListener('input', e => { pendingInputs[idx].label = e.target.value; });
    row.querySelector('.inp-ph').addEventListener('input', e => { pendingInputs[idx].placeholder = e.target.value; });
    row.querySelector('.inp-del').addEventListener('click', () => { pendingInputs.splice(idx, 1); renderInputs(); });
  });
}

function collectInputs() {
  document.querySelectorAll('#inputs-wrap .input-row').forEach((row, idx) => {
    if (!pendingInputs[idx]) { return; }
    pendingInputs[idx].key         = row.querySelector('.inp-key').value.trim();
    pendingInputs[idx].label       = row.querySelector('.inp-label').value.trim();
    pendingInputs[idx].placeholder = row.querySelector('.inp-ph').value.trim();
  });
  pendingInputs = pendingInputs.filter(i => i.key);
}

// ── 步骤渲染 ──────────────────────────────────────────────────────────────────
function renderSteps() {
  const wrap = document.getElementById('steps-wrap');
  wrap.innerHTML = '';
  if (!pendingSteps.length) { wrap.innerHTML = '<div class="empty-hint">暂无步骤，点击下方"添加步骤"</div>'; return; }
  pendingSteps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'step-card';
    card.innerHTML =
      '<div class="step-header">' +
        '<span style="font-size:11px;color:var(--vscode-descriptionForeground);flex-shrink:0">' + stepTypeLabel(step.type) + '</span>' +
        '<input class="s-label" placeholder="步骤名称" value="' + esc(step.label) + '"/>' +
        '<span class="req-badge ' + (step.required ? 'req' : 'opt') + ' s-req-badge">' +
          (step.required ? '必要' : '非必要') +
          '<span class="tooltip">' + (step.required ? '必要：有任意一项不通过则最终结果为不通过' : '非必要：不通过时只给出警告，不影响最终结果') + '</span>' +
        '</span>' +
        '<button class="danger icon s-del">✕</button>' +
      '</div>' +
      '<div class="step-body">' + renderStepBody(step) + '</div>';
    wrap.appendChild(card);
    card.querySelector('.s-label').addEventListener('input', e => { pendingSteps[idx].label = e.target.value; });
    card.querySelector('.s-req-badge').addEventListener('click', () => {
      pendingSteps[idx].required = !pendingSteps[idx].required;
      renderSteps();
    });
    card.querySelector('.s-del').addEventListener('click', () => { pendingSteps.splice(idx, 1); renderSteps(); });
    card.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', e => { pendingSteps[idx][e.target.dataset.field] = e.target.value; });
      el.addEventListener('change', e => { pendingSteps[idx][e.target.dataset.field] = e.target.value; });
    });
  });
}

function stepTypeLabel(type) {
  return { fileExists: '文件存在', resMgrKey: 'ResMgr Key', csvField: 'CSV字段', charResource: '角色资源' }[type] || type;
}

function renderStepBody(step) {
  switch (step.type) {
    case 'fileExists':
      return row('路径模板', '<input data-field="pathTemplate" placeholder="assets/raw/{{charId}}.png" value="' + esc(step.pathTemplate||'') + '"/>');
    case 'resMgrKey':
      return row('Key 模板', '<input data-field="keyTemplate" placeholder="decorate_fashion_{{id}}" value="' + esc(step.keyTemplate||'') + '"/>') +
             row('模块路径', '<input data-field="modulePath" placeholder="ui" value="' + esc(step.modulePath||'ui') + '"/>');
    case 'csvField':
      return row('CSV 路径', '<input data-field="csvPath" placeholder="res/cfg/xxx.csv" value="' + esc(step.csvPath||'') + '"/>') +
             row('过滤列名', '<input data-field="filterField" placeholder="道具名" value="' + esc(step.filterField||'') + '"/>') +
             row('过滤变量', '<input data-field="filterValueKey" placeholder="输入项 key" value="' + esc(step.filterValueKey||'') + '"/>') +
             row('检查列名', '<input data-field="checkField" placeholder="图标" value="' + esc(step.checkField||'') + '"/>');
    case 'charResource':
      return row('ID 变量', '<input data-field="idKey" placeholder="输入项 key（如 charId）" value="' + esc(step.idKey||'') + '"/>');
    default: return '';
  }
}

function row(label, content) {
  return '<div class="step-row"><label>' + label + '</label>' + content + '</div>';
}

// ── 运行时输入区 ──────────────────────────────────────────────────────────────
function renderRuntimeInputs(inputs) {
  const wrap = document.getElementById('runtime-inputs');
  wrap.innerHTML = '';
  (inputs || []).filter(i => i.key).forEach(inp => {
    const div = document.createElement('div');
    div.className = 'rt-field';
    div.innerHTML = '<label>' + esc(inp.label || inp.key) + '</label>' +
      '<input class="rt-input" data-key="' + esc(inp.key) + '" type="text" placeholder="' + esc(inp.placeholder||'') + '"/>';
    wrap.appendChild(div);
  });
}

// ── 结果渲染 ──────────────────────────────────────────────────────────────────
function renderResult(result) {
  const sec = document.getElementById('result-section');
  sec.style.display = '';
  document.getElementById('right-placeholder').style.display = 'none';
  const ww = document.getElementById('warnings-wrap');
  ww.innerHTML = '';
  if (result.warnings?.length) {
    const d = document.createElement('div');
    d.className = 'warn-box';
    d.textContent = result.warnings.join('\\n');
    ww.appendChild(d);
  }
  const rw = document.getElementById('result-wrap');
  rw.innerHTML = '';
  if (!result.steps?.length) { rw.innerHTML = '<div class="empty-hint">无检查步骤</div>'; return; }
  result.steps.forEach(step => {
    const div = document.createElement('div');
    div.className = 'step-result';
    const icon = step.status === 'pass'
      ? '<span class="sr-icon pass">✓</span>'
      : step.required ? '<span class="sr-icon fail-r">✗</span>' : '<span class="sr-icon fail-o">!</span>';
    div.innerHTML = icon +
      '<div style="flex:1"><div class="sr-label">' + esc(step.label) + '</div>' +
      (step.message ? '<div class="sr-msg">' + esc(step.message) + '</div>' : '') + '</div>';
    rw.appendChild(div);
  });
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
</body>
</html>`;
}
function getNonce() {
    let t = '';
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        t += c.charAt(Math.floor(Math.random() * c.length));
    }
    return t;
}
