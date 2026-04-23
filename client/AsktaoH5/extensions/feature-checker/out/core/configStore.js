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
exports.ConfigStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ─── 默认值 ───────────────────────────────────────────────────────────────────
const DEFAULT_RESMGR = { filePath: 'assets/scripts/mgr/ResMgr.ts', modulePath: 'ui' };
const DEFAULT_GLOBAL = { currentWorkspace: '', workspaces: {}, features: {} };
// ─── ConfigStore ──────────────────────────────────────────────────────────────
class ConfigStore {
    constructor(extensionPath) {
        this._globalPath = path.join(extensionPath, 'config', 'global.json');
        this._global = this._load();
    }
    // ── 工作区 ────────────────────────────────────────────────────────────────
    getWorkspaceNames() { return Object.keys(this._global.workspaces); }
    getCurrentWorkspaceName() { return this._global.currentWorkspace; }
    getCurrentWorkspace() {
        const entry = this._global.workspaces[this._global.currentWorkspace];
        return entry ? { root: entry.root, resMgr: entry.resMgr } : { root: '', resMgr: { ...DEFAULT_RESMGR } };
    }
    getWorkspace(name) {
        const entry = this._global.workspaces[name];
        return entry ? { root: entry.root, resMgr: entry.resMgr } : undefined;
    }
    setCurrentWorkspace(name) {
        if (this._global.workspaces[name]) {
            this._global.currentWorkspace = name;
            this._save();
        }
    }
    addWorkspace(name, root, resMgr) {
        this._global.workspaces[name] = { root, resMgr };
        this._global.currentWorkspace = name;
        this._save();
    }
    removeWorkspace(name) {
        var _a;
        delete this._global.workspaces[name];
        if (this._global.currentWorkspace === name) {
            this._global.currentWorkspace = (_a = Object.keys(this._global.workspaces)[0]) !== null && _a !== void 0 ? _a : '';
        }
        this._save();
    }
    /** 根据 VSCode 打开的目录列表自动匹配工作区，返回匹配到的名称列表 */
    autoDetect(openedFolders) {
        const normalize = (p) => p.replace(/\\/g, '/').toLowerCase();
        const matched = [];
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
    getAllFeatures() {
        const result = {};
        for (const [id, f] of Object.entries(this._global.features)) {
            result[id] = this._normalizeFeature(f);
        }
        return result;
    }
    getFeature(id) {
        const f = this._global.features[id];
        return f ? this._normalizeFeature(f) : undefined;
    }
    addFeature(label) {
        const id = Date.now().toString();
        this._global.features[id] = { label, inputs: [], steps: [] };
        this._save();
        return id;
    }
    removeFeature(id) {
        delete this._global.features[id];
        this._save();
    }
    setFeature(id, cfg) {
        this._global.features[id] = cfg;
        this._save();
    }
    // ── 持久化 ────────────────────────────────────────────────────────────────
    _normalizeFeature(f) {
        var _a, _b, _c;
        return { label: (_a = f.label) !== null && _a !== void 0 ? _a : '', inputs: (_b = f.inputs) !== null && _b !== void 0 ? _b : [], steps: (_c = f.steps) !== null && _c !== void 0 ? _c : [] };
    }
    _load() {
        try {
            if (fs.existsSync(this._globalPath)) {
                const raw = JSON.parse(fs.readFileSync(this._globalPath, 'utf-8'));
                return { ...DEFAULT_GLOBAL, ...raw };
            }
        }
        catch { }
        return { ...DEFAULT_GLOBAL };
    }
    _save() {
        const dir = path.dirname(this._globalPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this._globalPath, JSON.stringify(this._global, null, 2), 'utf-8');
    }
}
exports.ConfigStore = ConfigStore;
