import * as fs from 'fs';
import * as path from 'path';
import { FeatureConfig } from './pipelineEngine';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface ResMgrConfig {
    filePath: string;   // 相对 root
    modulePath: string;
}

export interface WorkspaceEntry {
    root: string;
    resMgr: ResMgrConfig;
}

export interface GlobalConfig {
    currentWorkspace: string;
    workspaces: Record<string, WorkspaceEntry>;  // name -> entry
    features: Record<string, FeatureConfig>;     // 全局共享检查项
}

export interface WorkspaceConfig {
    root: string;
    resMgr: ResMgrConfig;
}

// ─── 默认值 ───────────────────────────────────────────────────────────────────

const DEFAULT_RESMGR: ResMgrConfig = { filePath: 'assets/scripts/mgr/ResMgr.ts', modulePath: 'ui' };

const DEFAULT_GLOBAL: GlobalConfig = { currentWorkspace: '', workspaces: {}, features: {} };

// ─── ConfigStore ──────────────────────────────────────────────────────────────

export class ConfigStore {
    private _globalPath: string;
    private _global: GlobalConfig;

    constructor(extensionPath: string) {
        this._globalPath = path.join(extensionPath, 'config', 'global.json');
        this._global = this._load();
    }

    // ── 工作区 ────────────────────────────────────────────────────────────────

    getWorkspaceNames(): string[] { return Object.keys(this._global.workspaces); }
    getCurrentWorkspaceName(): string { return this._global.currentWorkspace; }

    getCurrentWorkspace(): WorkspaceConfig {
        const entry = this._global.workspaces[this._global.currentWorkspace];
        return entry ? { root: entry.root, resMgr: entry.resMgr } : { root: '', resMgr: { ...DEFAULT_RESMGR } };
    }

    getWorkspace(name: string): WorkspaceConfig | undefined {
        const entry = this._global.workspaces[name];
        return entry ? { root: entry.root, resMgr: entry.resMgr } : undefined;
    }

    setCurrentWorkspace(name: string): void {
        if (this._global.workspaces[name]) {
            this._global.currentWorkspace = name;
            this._save();
        }
    }

    addWorkspace(name: string, root: string, resMgr: ResMgrConfig): void {
        this._global.workspaces[name] = { root, resMgr };
        this._global.currentWorkspace = name;
        this._save();
    }

    removeWorkspace(name: string): void {
        delete this._global.workspaces[name];
        if (this._global.currentWorkspace === name) {
            this._global.currentWorkspace = Object.keys(this._global.workspaces)[0] ?? '';
        }
        this._save();
    }

    /** 根据 VSCode 打开的目录列表自动匹配工作区，返回匹配到的名称列表 */
    autoDetect(openedFolders: string[]): string[] {
        const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();
        const matched: string[] = [];
        for (const [name, entry] of Object.entries(this._global.workspaces)) {
            const root = normalize(entry.root);
            for (const folder of openedFolders) {
                const f = normalize(folder);
                if (root.startsWith(f) || f.startsWith(root)) {
                    matched.push(name);
                    break;
                }
            }
        }
        return matched;
    }

    // ── 检查项（全局共享） ────────────────────────────────────────────────────

    getAllFeatures(): Record<string, FeatureConfig> {
        const result: Record<string, FeatureConfig> = {};
        for (const [id, f] of Object.entries(this._global.features)) {
            result[id] = this._normalizeFeature(f);
        }
        return result;
    }

    getFeature(id: string): FeatureConfig | undefined {
        const f = this._global.features[id];
        return f ? this._normalizeFeature(f) : undefined;
    }

    addFeature(label: string): string {
        const id = Date.now().toString();
        this._global.features[id] = { label, inputs: [], steps: [] };
        this._save();
        return id;
    }

    removeFeature(id: string): void {
        delete this._global.features[id];
        this._save();
    }

    setFeature(id: string, cfg: FeatureConfig): void {
        this._global.features[id] = cfg;
        this._save();
    }

    // ── 持久化 ────────────────────────────────────────────────────────────────

    private _normalizeFeature(f: any): FeatureConfig {
        return { label: f.label ?? '', inputs: f.inputs ?? [], steps: f.steps ?? [] };
    }

    private _load(): GlobalConfig {
        try {
            if (fs.existsSync(this._globalPath)) {
                const raw = JSON.parse(fs.readFileSync(this._globalPath, 'utf-8'));
                return { ...DEFAULT_GLOBAL, ...raw };
            }
        } catch {}
        return { ...DEFAULT_GLOBAL };
    }

    private _save(): void {
        const dir = path.dirname(this._globalPath);
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
        fs.writeFileSync(this._globalPath, JSON.stringify(this._global, null, 2), 'utf-8');
    }
}
