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
exports.runCheck = runCheck;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csvParser_1 = require("./csvParser");
const resMgrParser_1 = require("./resMgrParser");
// ─── 引擎 ─────────────────────────────────────────────────────────────────────
function runCheck(input) {
    const warnings = [];
    const { workspaceRoot, csvPath, headers, resMgr } = input;
    const absCSV = path.resolve(workspaceRoot, csvPath);
    const parsed = (0, csvParser_1.parseCsv)(absCSV);
    warnings.push(...parsed.warnings);
    // equal 列作为行过滤条件
    const filterEntries = Object.entries(headers).filter(([, cfg]) => cfg.checkType === 'equal' && cfg.equalTarget !== undefined);
    let matchedRows = parsed.rows.map((row, i) => ({ row, i }));
    for (const [col, cfg] of filterEntries) {
        matchedRows = matchedRows.filter(({ row }) => row[col] === cfg.equalTarget);
    }
    if (filterEntries.length > 0 && matchedRows.length > 1) {
        warnings.push(`存在 ${matchedRows.length} 行匹配，理论上应唯一，请检查配置表是否有重复数据。`);
    }
    // 加载 ResMgr 映射
    let resMgrMap = {};
    const needsResMgr = Object.values(headers).some(c => c.checkType === 'resMgrMapping');
    if (needsResMgr && resMgr) {
        const absResMgr = path.resolve(workspaceRoot, resMgr.filePath);
        resMgrMap = (0, resMgrParser_1.parseResMgrModule)(absResMgr, resMgr.modulePath);
    }
    const rows = matchedRows.map(({ row, i }) => {
        var _a;
        const cells = [];
        for (const [header, cfg] of Object.entries(headers)) {
            if (cfg.level === 'none') {
                continue;
            }
            const value = (_a = row[header]) !== null && _a !== void 0 ? _a : '';
            let status = 'pass';
            let message;
            if (!value) {
                status = 'fail';
                message = '值不存在';
            }
            else {
                switch (cfg.checkType) {
                    case 'existence':
                        break;
                    case 'equal':
                        if (value !== cfg.equalTarget) {
                            status = 'fail';
                            message = `值不匹配（期望 "${cfg.equalTarget}"，实际 "${value}"）`;
                        }
                        break;
                    case 'charResource': {
                        const padded = value.padStart(4, '0');
                        const missing = [];
                        const checks = [
                            path.join(workspaceRoot, 'assets', 'rawChar', 'char', `0${padded}`),
                            path.join(workspaceRoot, 'assets', 'raw', 'portraits', 'big', `0${padded}_01_b.png`),
                            path.join(workspaceRoot, 'assets', 'raw', 'portraits', 'small', `0${padded}_01_s.png`),
                        ];
                        for (const p of checks) {
                            if (!pathExists(p)) {
                                missing.push(p);
                            }
                        }
                        if (missing.length > 0) {
                            status = 'fail';
                            message = `缺失资源:\n${missing.join('\n')}`;
                        }
                        break;
                    }
                    case 'resMgrMapping': {
                        if (!resMgrMap[value]) {
                            status = 'fail';
                            message = `ResMgr 中不存在 key "${value}"`;
                        }
                        break;
                    }
                }
            }
            cells.push({ header, value, status, level: cfg.level, message });
        }
        return { rowIndex: i, cells };
    });
    if (rows.length === 0) {
        warnings.push('未找到匹配的数据行。');
    }
    return { rows, warnings };
}
function pathExists(p) {
    try {
        fs.accessSync(p);
        return true;
    }
    catch {
        return false;
    }
}
