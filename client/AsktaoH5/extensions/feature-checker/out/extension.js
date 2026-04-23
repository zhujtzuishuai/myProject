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
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const configStore_1 = require("./core/configStore");
const pipelineEngine_1 = require("./core/pipelineEngine");
const panelHtml_1 = require("./panelHtml");
let panel;
let store;
function activate(context) {
    store = new configStore_1.ConfigStore(context.extensionPath);
    context.subscriptions.push(vscode.commands.registerCommand('feature-checker.openPanel', () => {
        if (panel) {
            panel.reveal();
            return;
        }
        panel = vscode.window.createWebviewPanel('featureChecker', '功能检查器', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        panel.webview.html = (0, panelHtml_1.getPanelHtml)(panel.webview, store);
        panel.onDidDispose(() => { panel = undefined; });
        panel.webview.onDidReceiveMessage(msg => handleMessage(msg, panel, context), undefined, context.subscriptions);
    }));
}
async function handleMessage(msg, panel, _context) {
    var _a, _b, _c;
    switch (msg.cmd) {
        // ── 初始化：自动检测工作区 ─────────────────────────────────────────────
        case 'init': {
            const openedFolders = ((_a = vscode.workspace.workspaceFolders) !== null && _a !== void 0 ? _a : []).map(f => f.uri.fsPath);
            const matched = store.autoDetect(openedFolders);
            if (matched.length === 1) {
                store.setCurrentWorkspace(matched[0]);
            }
            else if (matched.length === 0 && store.getWorkspaceNames().length > 0) {
                // 无匹配，保持上次选中
            }
            panel.webview.postMessage({
                cmd: 'initData',
                wsNames: store.getWorkspaceNames(),
                currentWs: store.getCurrentWorkspaceName(),
                currentRoot: store.getCurrentWorkspace().root,
                autoMatched: matched,
                features: store.getAllFeatures(),
            });
            break;
        }
        // ── 工作区管理 ────────────────────────────────────────────────────────
        case 'pickSvnDir': {
            const res = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, title: '选择 SVN 仓库根目录' });
            if (!(res === null || res === void 0 ? void 0 : res[0])) {
                break;
            }
            const svnRoot = res[0].fsPath;
            const projectRoot = path.join(svnRoot, 'client', 'AsktaoH5');
            const resMgrFile = path.join(projectRoot, 'assets', 'scripts', 'mgr', 'ResMgr.ts');
            const warnings = [];
            if (!fs.existsSync(projectRoot)) {
                warnings.push(`项目根目录不存在: ${projectRoot}`);
            }
            if (!fs.existsSync(resMgrFile)) {
                warnings.push(`ResMgr 文件不存在: ${resMgrFile}`);
            }
            if (warnings.length) {
                vscode.window.showWarningMessage(warnings.join('\n'));
            }
            const parts = svnRoot.replace(/\\/g, '/').split('/');
            const defaultName = parts[parts.length - 1] || 'workspace';
            const name = await vscode.window.showInputBox({ prompt: '请输入工作区名称', value: defaultName, ignoreFocusOut: true });
            if (!(name === null || name === void 0 ? void 0 : name.trim())) {
                break;
            }
            if (store.getWorkspaceNames().includes(name.trim())) {
                vscode.window.showWarningMessage(`工作区 "${name.trim()}" 已存在`);
                break;
            }
            store.addWorkspace(name.trim(), projectRoot, {
                filePath: path.relative(projectRoot, resMgrFile).replace(/\\/g, '/'),
                modulePath: 'ui',
            });
            panel.webview.postMessage({
                cmd: 'setWorkspaceList',
                wsNames: store.getWorkspaceNames(),
                currentWs: store.getCurrentWorkspaceName(),
                currentRoot: store.getCurrentWorkspace().root,
            });
            break;
        }
        case 'removeWorkspace': {
            const pick = await vscode.window.showWarningMessage(`确认删除工作区 "${msg.name}"？`, { modal: true }, '删除');
            if (pick !== '删除') {
                break;
            }
            store.removeWorkspace(msg.name);
            panel.webview.postMessage({
                cmd: 'setWorkspaceList',
                wsNames: store.getWorkspaceNames(),
                currentWs: store.getCurrentWorkspaceName(),
                currentRoot: store.getCurrentWorkspace().root,
            });
            break;
        }
        case 'switchWorkspace': {
            store.setCurrentWorkspace(msg.name);
            panel.webview.postMessage({ cmd: 'setWorkspaceInfo', root: store.getCurrentWorkspace().root });
            break;
        }
        // ── 检查项管理 ────────────────────────────────────────────────────────
        case 'addFeature': {
            const label = await vscode.window.showInputBox({ prompt: '请输入检查项名称', ignoreFocusOut: true });
            if (!(label === null || label === void 0 ? void 0 : label.trim())) {
                break;
            }
            const id = store.addFeature(label.trim());
            panel.webview.postMessage({ cmd: 'setFeatureList', features: store.getAllFeatures(), selectId: id });
            break;
        }
        case 'removeFeature': {
            const pick = await vscode.window.showWarningMessage(`确认删除检查项 "${msg.label}"？`, { modal: true }, '删除');
            if (pick !== '删除') {
                break;
            }
            store.removeFeature(msg.featureId);
            panel.webview.postMessage({ cmd: 'setFeatureList', features: store.getAllFeatures() });
            break;
        }
        case 'getFeature': {
            panel.webview.postMessage({ cmd: 'setFeature', feature: (_b = store.getFeature(msg.featureId)) !== null && _b !== void 0 ? _b : null });
            break;
        }
        case 'saveFeature': {
            const cfg = { label: msg.label, inputs: msg.inputs, steps: msg.steps };
            store.setFeature(msg.featureId, cfg);
            panel.webview.postMessage({ cmd: 'saved' });
            break;
        }
        // ── 执行检查 ──────────────────────────────────────────────────────────
        case 'runCheck': {
            const feature = store.getFeature(msg.featureId);
            if (!feature) {
                vscode.window.showWarningMessage('请先保存检查项配置');
                break;
            }
            const ws = store.getCurrentWorkspace();
            if (!ws.root) {
                vscode.window.showWarningMessage('请先配置工作区根目录');
                break;
            }
            try {
                const result = (0, pipelineEngine_1.runPipeline)({
                    workspaceRoot: ws.root,
                    resMgrFile: ws.resMgr.filePath,
                    feature,
                    inputs: (_c = msg.inputs) !== null && _c !== void 0 ? _c : {},
                });
                panel.webview.postMessage({ cmd: 'showResult', result });
            }
            catch (e) {
                vscode.window.showErrorMessage(`检查失败: ${e.message}`);
            }
            break;
        }
    }
}
function deactivate() { }
