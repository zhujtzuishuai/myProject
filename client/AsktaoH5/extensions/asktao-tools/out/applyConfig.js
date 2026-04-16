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
exports.loadYamlConfig = loadYamlConfig;
exports.updateDecorateInfoCsv = updateDecorateInfoCsv;
exports.updateResMgr = updateResMgr;
exports.updateConfigMgr = updateConfigMgr;
exports.applyConfig = applyConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
}
function loadYamlConfig(configPath) {
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content);
}
/**
 * 根据 CSV 第二行字段名顺序动态拼装行。
 * 字段名行示例：name+;itemId;icon;icon2;effectCfg;unit;color;type;descript;sources;flag;extraParams;
 */
function toCsvRow(item, fieldNameRow) {
    const fieldMap = {
        'name+': 'name',
        'name': 'name',
        itemId: 'itemId',
        icon: 'icon',
        icon2: 'modelOrEffectIcon',
        effectCfg: 'effectConfig',
        unit: 'unit',
        color: 'quality',
        type: 'type',
        descript: 'desc',
        sources: 'source',
        flag: 'specialNote',
        extraParams: 'extraParam',
    };
    const cols = fieldNameRow.split(';').map(c => c.trim()).filter(Boolean);
    return cols.map(col => {
        const key = fieldMap[col];
        return key !== undefined ? (item[key] ?? '') : '';
    }).join(';') + ';';
}
// ─── Steps ────────────────────────────────────────────────────────────────────
function updateDecorateInfoCsv(typeCfg, workspaceRoot) {
    const csvPath = path.isAbsolute(typeCfg.csvPath)
        ? typeCfg.csvPath
        : path.resolve(workspaceRoot, typeCfg.csvPath);
    ensureFileExists(csvPath);
    const text = fs.readFileSync(csvPath, 'utf8');
    const lines = text.split(/\r?\n/);
    // 第二行为字段名行（name+;itemId;icon;...）
    const fieldNameRow = lines[1] ?? '';
    // 确定数据区范围
    let bodyStart;
    let bodyEnd = lines.length;
    if (typeCfg.csvModuleHeader) {
        const start = lines.findIndex(l => l.trim() === typeCfg.csvModuleHeader.trim());
        if (start < 0) {
            throw new Error(`未找到模块头: ${typeCfg.csvModuleHeader}`);
        }
        bodyStart = start + 1;
        for (let i = bodyStart; i < lines.length; i++) {
            if (lines[i].trim().startsWith('# ')) {
                bodyEnd = i;
                break;
            }
        }
    }
    else {
        // 无模块头：跳过显示名行 + 字段名行
        bodyStart = 2;
    }
    const row = toCsvRow(typeCfg.item, fieldNameRow);
    const mode = typeCfg.csvInsert?.mode ?? 'tail';
    let insertPos;
    if (mode === 'head') {
        insertPos = bodyStart;
    }
    else if (mode === 'sortByItemId') {
        // 从字段名行找 itemId 所在列
        const fieldCols = fieldNameRow.split(';').map(c => c.trim());
        const colIdx = Math.max(fieldCols.indexOf('itemId'), 1);
        const newId = parseInt(typeCfg.item.itemId, 10);
        insertPos = bodyEnd;
        for (let i = bodyStart; i < bodyEnd; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) {
                continue;
            }
            const existingId = parseInt(line.split(';')[colIdx] ?? '', 10);
            if (!isNaN(existingId) && existingId > newId) {
                insertPos = i;
                break;
            }
        }
    }
    else {
        // tail（默认）
        insertPos = bodyEnd;
    }
    lines.splice(insertPos, 0, row);
    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
    return { step: 'updateDecorateInfoCsv', csvPath, insertedRow: row, insertPos };
}
function updateResMgr(typeCfg, filePath, workspaceRoot) {
    const cfg = typeCfg.resMgr;
    const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workspaceRoot, filePath);
    ensureFileExists(resolvedPath);
    let text = fs.readFileSync(resolvedPath, 'utf8');
    if (text.includes(`${cfg.key}:`) || text.includes(`"${cfg.key}"`)) {
        return { step: 'updateResMgr', filePath: resolvedPath, skipped: true, reason: '已存在相同 key' };
    }
    const pair = `${cfg.key}:"${cfg.value}"`;
    const modulePattern = new RegExp(`(${cfg.module}\\s*:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`, 'm');
    if (!modulePattern.test(text)) {
        throw new Error(`ResMgr 未找到模块: ${cfg.module}`);
    }
    text = text.replace(modulePattern, (_all, p1, p2, p3) => {
        const body = p2.trimEnd();
        const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
        return `${p1}${p2}${suffix}\n    ${pair}${p3}`;
    });
    fs.writeFileSync(resolvedPath, text, 'utf8');
    return { step: 'updateResMgr', filePath: resolvedPath, inserted: pair };
}
function updateConfigMgr(typeCfg, filePath, workspaceRoot) {
    const cfg = typeCfg.configMgr;
    const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workspaceRoot, filePath);
    ensureFileExists(resolvedPath);
    let text = fs.readFileSync(resolvedPath, 'utf8');
    const [left, right] = cfg.appendPair;
    const item = `["${left}","${right}"]`;
    if (text.includes(item) || text.includes(`["${left}", "${right}"]`)) {
        return { step: 'updateConfigMgr', filePath: resolvedPath, skipped: true, reason: '已存在相同配置' };
    }
    const varPattern = new RegExp(`(${cfg.variable}\\s*=\\s*\\[)([\\s\\S]*?)(\\])`, 'm');
    if (!varPattern.test(text)) {
        throw new Error(`ConfigMgr 未找到变量: ${cfg.variable}`);
    }
    text = text.replace(varPattern, (_all, p1, p2, p3) => {
        const body = p2.trimEnd();
        const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
        return `${p1}${p2}${suffix}\n    ${item}\n${p3}`;
    });
    fs.writeFileSync(resolvedPath, text, 'utf8');
    return { step: 'updateConfigMgr', filePath: resolvedPath, inserted: item };
}
// ─── Main runner ──────────────────────────────────────────────────────────────
function applyConfig(configPath, workspaceRoot) {
    const cfg = loadYamlConfig(configPath);
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
        if (step === 'validateType') {
            report.push({ step, ok: true, selectedType });
        }
        else if (step === 'updateDecorateInfoCsv') {
            report.push(updateDecorateInfoCsv(typeCfg, workspaceRoot));
        }
        else if (step === 'updateResMgr') {
            report.push(updateResMgr(typeCfg, resMgrPath, workspaceRoot));
        }
        else if (step === 'updateConfigMgr') {
            report.push(updateConfigMgr(typeCfg, configMgrPath, workspaceRoot));
        }
        else if (step === 'summary') {
            // no-op
        }
        else {
            report.push({ step, skipped: true, reason: '未知步骤' });
        }
    }
    return report;
}
//# sourceMappingURL=applyConfig.js.map