import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigStore } from './core/configStore';
import { runPipeline, FeatureConfig } from './core/pipelineEngine';
import { getPanelHtml } from './panelHtml';

let panel: vscode.WebviewPanel | undefined;
let store: ConfigStore;

export function activate(context: vscode.ExtensionContext): void {
    store = new ConfigStore(context.extensionPath);

    context.subscriptions.push(
        vscode.commands.registerCommand('feature-checker.openPanel', () => {
            if (panel) { panel.reveal(); return; }
            panel = vscode.window.createWebviewPanel(
                'featureChecker', '功能检查器', vscode.ViewColumn.One,
                { enableScripts: true, retainContextWhenHidden: true },
            );
            panel.webview.html = getPanelHtml(panel.webview, store);
            panel.onDidDispose(() => { panel = undefined; });
            panel.webview.onDidReceiveMessage(
                msg => handleMessage(msg, panel!, context),
                undefined, context.subscriptions,
            );
        }),
    );
}

async function handleMessage(msg: any, panel: vscode.WebviewPanel, _context: vscode.ExtensionContext) {
    switch (msg.cmd) {

        // ── 初始化：自动检测工作区 ─────────────────────────────────────────────

        case 'init': {
            const openedFolders = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
            const matched = store.autoDetect(openedFolders);

            if (matched.length === 1) {
                store.setCurrentWorkspace(matched[0]);
            } else if (matched.length === 0 && store.getWorkspaceNames().length > 0) {
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
            if (!res?.[0]) { break; }
            const svnRoot = res[0].fsPath;
            const projectRoot = path.join(svnRoot, 'client', 'AsktaoH5');
            const resMgrFile  = path.join(projectRoot, 'assets', 'scripts', 'mgr', 'ResMgr.ts');

            const warnings: string[] = [];
            if (!fs.existsSync(projectRoot)) { warnings.push(`项目根目录不存在: ${projectRoot}`); }
            if (!fs.existsSync(resMgrFile))  { warnings.push(`ResMgr 文件不存在: ${resMgrFile}`); }
            if (warnings.length) { vscode.window.showWarningMessage(warnings.join('\n')); }

            const parts = svnRoot.replace(/\\/g, '/').split('/');
            const defaultName = parts[parts.length - 1] || 'workspace';
            const name = await vscode.window.showInputBox({ prompt: '请输入工作区名称', value: defaultName, ignoreFocusOut: true });
            if (!name?.trim()) { break; }
            if (store.getWorkspaceNames().includes(name.trim())) {
                vscode.window.showWarningMessage(`工作区 "${name.trim()}" 已存在`); break;
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
            if (pick !== '删除') { break; }
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
            if (!label?.trim()) { break; }
            const id = store.addFeature(label.trim());
            panel.webview.postMessage({ cmd: 'setFeatureList', features: store.getAllFeatures(), selectId: id });
            break;
        }

        case 'removeFeature': {
            const pick = await vscode.window.showWarningMessage(`确认删除检查项 "${msg.label}"？`, { modal: true }, '删除');
            if (pick !== '删除') { break; }
            store.removeFeature(msg.featureId);
            panel.webview.postMessage({ cmd: 'setFeatureList', features: store.getAllFeatures() });
            break;
        }

        case 'getFeature': {
            panel.webview.postMessage({ cmd: 'setFeature', feature: store.getFeature(msg.featureId) ?? null });
            break;
        }

        case 'saveFeature': {
            const cfg: FeatureConfig = { label: msg.label, inputs: msg.inputs, steps: msg.steps };
            store.setFeature(msg.featureId, cfg);
            panel.webview.postMessage({ cmd: 'saved' });
            break;
        }

        // ── 执行检查 ──────────────────────────────────────────────────────────

        case 'runCheck': {
            const feature = store.getFeature(msg.featureId);
            if (!feature) { vscode.window.showWarningMessage('请先保存检查项配置'); break; }
            const ws = store.getCurrentWorkspace();
            if (!ws.root) { vscode.window.showWarningMessage('请先配置工作区根目录'); break; }

            try {
                const result = runPipeline({
                    workspaceRoot: ws.root,
                    resMgrFile: ws.resMgr.filePath,
                    feature,
                    inputs: msg.inputs ?? {},
                });
                panel.webview.postMessage({ cmd: 'showResult', result });
            } catch (e: any) {
                vscode.window.showErrorMessage(`检查失败: ${e.message}`);
            }
            break;
        }
    }
}

export function deactivate() {}
