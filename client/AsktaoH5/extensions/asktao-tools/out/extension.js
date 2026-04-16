"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const yaml = __importStar(require("js-yaml"));
const applyConfig_1 = require("./applyConfig");
const panelHtml_1 = require("./panelHtml");
// ─── Default YAML template ────────────────────────────────────────────────────
const DEFAULT_YAML = `# AsktaoH5 配置示例（角色时装）
globalConfig:
  resMgrPath: AsktaoH5/assets/scripts/mgr/ResMgr.ts
  configMgrPath: AsktaoH5/assets/scripts/mgr/ConfigMgr.ts
types:
  roleFashion:
    label: 角色时装
    csvPath: AsktaoH5/res/cfg/csv/DecorateInfo.csv
    csvInsert:
      mode: sortByItemId
    item:
      name: 道载万金
      itemId: "530"
      icon: decorate_fashion_35
      modelOrEffectIcon: "90001"
      effectConfig: ""
      unit: 套
      quality: 金色
      type: fashion_icon
      desc: 天命所归作金州，大道无形载乾坤。男子使用后将会身着华美的服饰。
      source: "[一周年庆活动#@|MGFestivalActivityDlg=一周年庆#@]"
      specialNote: ""
      extraParam: ""
    resMgr:
      module: ui
      key: decorate_fashion_35
      value: items/90001_50/texture
    configMgr:
      variable: FashionConfig
      appendPair:
        - 道载万金
        - 玲珑宝韵
flow:
  selectedType: roleFashion
  steps:
    - validateType
    - updateDecorateInfoCsv
    - updateResMgr
    - updateConfigMgr
    - summary
`;
// ─── Output channel ───────────────────────────────────────────────────────────
let outputChannel;
function getOutputChannel() {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('AsktaoH5 Tools');
    }
    return outputChannel;
}
// ─── Activate ─────────────────────────────────────────────────────────────────
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('asktao-tools.openPanel', () => {
        openPanel(context);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('asktao-tools.applyConfig', async (uri) => {
        if (!uri) {
            vscode.window.showErrorMessage('请在资源管理器中右键点击 YAML 配置文件');
            return;
        }
        const workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ??
            path.dirname(uri.fsPath);
        try {
            const report = (0, applyConfig_1.applyConfig)(uri.fsPath, workspaceRoot);
            showReportInChannel(report);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`执行失败: ${msg}`);
        }
    }));
}
function deactivate() {
    outputChannel?.dispose();
}
// ─── Panel ────────────────────────────────────────────────────────────────────
let currentPanel;
function openPanel(context) {
    if (currentPanel) {
        currentPanel.reveal();
        return;
    }
    const panel = vscode.window.createWebviewPanel('asktaoTools', 'AsktaoH5 配置工具', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });
    currentPanel = panel;
    panel.webview.html = (0, panelHtml_1.getPanelHtml)(panel.webview, DEFAULT_YAML);
    panel.onDidDispose(() => {
        currentPanel = undefined;
    }, null, context.subscriptions);
    panel.webview.onDidReceiveMessage(async (msg) => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        switch (msg.command) {
            case 'runFromObject': {
                if (!msg.config) {
                    panel.webview.postMessage({ command: 'error', message: '配置数据缺失' });
                    return;
                }
                try {
                    const report = runFromConfig(msg.config, workspaceRoot);
                    panel.webview.postMessage({ command: 'result', report });
                }
                catch (err) {
                    panel.webview.postMessage({
                        command: 'error',
                        message: err instanceof Error ? err.message : String(err),
                    });
                }
                break;
            }
            case 'runFromYaml': {
                if (!msg.yamlText) {
                    panel.webview.postMessage({ command: 'error', message: 'YAML 内容为空' });
                    return;
                }
                try {
                    const cfg = yaml.load(msg.yamlText);
                    const report = runFromConfig(cfg, workspaceRoot);
                    panel.webview.postMessage({ command: 'result', report });
                }
                catch (err) {
                    panel.webview.postMessage({
                        command: 'error',
                        message: err instanceof Error ? err.message : String(err),
                    });
                }
                break;
            }
            case 'pickYamlFile': {
                const uris = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: { YAML: ['yaml', 'yml'] },
                    title: '选择 YAML 配置文件',
                });
                if (uris && uris[0]) {
                    try {
                        const content = fs.readFileSync(uris[0].fsPath, 'utf8');
                        panel.webview.postMessage({ command: 'yamlLoaded', yamlText: content });
                    }
                    catch (err) {
                        panel.webview.postMessage({
                            command: 'error',
                            message: `读取文件失败: ${err instanceof Error ? err.message : String(err)}`,
                        });
                    }
                }
                break;
            }
            case 'exportYaml': {
                if (!msg.config) {
                    panel.webview.postMessage({ command: 'error', message: '配置数据缺失' });
                    return;
                }
                try {
                    const yamlText = yaml.dump(msg.config, { indent: 2 });
                    panel.webview.postMessage({ command: 'exportedYaml', yamlText });
                }
                catch (err) {
                    panel.webview.postMessage({
                        command: 'error',
                        message: `导出 YAML 失败: ${err instanceof Error ? err.message : String(err)}`,
                    });
                }
                break;
            }
        }
    }, undefined, context.subscriptions);
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * 直接从配置对象执行流程，逐步捕获错误不中断整体输出。
 */
function runFromConfig(cfg, workspaceRoot) {
    const selectedType = cfg.flow?.selectedType;
    if (!selectedType || !cfg.types?.[selectedType]) {
        throw new Error('配置无效：flow.selectedType 或 types.<type> 缺失');
    }
    const typeCfg = cfg.types[selectedType];
    const steps = cfg.flow?.steps ?? [];
    const resMgrPath = cfg.globalConfig?.resMgrPath ?? '';
    const configMgrPath = cfg.globalConfig?.configMgrPath ?? '';
    const report = [];
    for (const step of steps) {
        try {
            if (step === 'validateType') {
                report.push({ step, ok: true, selectedType });
            }
            else if (step === 'updateDecorateInfoCsv') {
                report.push((0, applyConfig_1.updateDecorateInfoCsv)(typeCfg, workspaceRoot));
            }
            else if (step === 'updateResMgr') {
                report.push((0, applyConfig_1.updateResMgr)(typeCfg, resMgrPath, workspaceRoot));
            }
            else if (step === 'updateConfigMgr') {
                report.push((0, applyConfig_1.updateConfigMgr)(typeCfg, configMgrPath, workspaceRoot));
            }
            else if (step === 'summary') {
                // no-op marker step
            }
            else {
                report.push({ step, skipped: true, reason: '未知步骤' });
            }
        }
        catch (err) {
            report.push({
                step,
                ok: false,
                reason: err instanceof Error ? err.message : String(err),
            });
        }
    }
    return report;
}
function showReportInChannel(report) {
    const ch = getOutputChannel();
    ch.clear();
    ch.show(true);
    for (const r of report) {
        if (r.skipped) {
            ch.appendLine(`⏭ ${r.step}: 跳过 — ${r.reason ?? ''}`);
        }
        else if (r.ok === false) {
            ch.appendLine(`❌ ${r.step}: 失败 — ${r.reason ?? ''}`);
        }
        else {
            let detail = '';
            if (r.insertedRow) {
                detail = `\n   插入行: ${r.insertedRow}`;
            }
            if (r.inserted) {
                detail = `\n   插入: ${r.inserted}`;
            }
            if (r.selectedType) {
                detail = ` → ${r.selectedType}`;
            }
            ch.appendLine(`✅ ${r.step}${detail}`);
        }
    }
}
//# sourceMappingURL=extension.js.map