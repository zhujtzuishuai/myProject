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
exports.parseCsv = parseCsv;
const fs = __importStar(require("fs"));
/**
 * 解析 CSV 文件。
 * - 跳过以 "# " 开头的注释行
 * - 第 2 行（跳过注释后）为表头行
 * - 分隔符为 ";"
 * - 表头末尾的 +/- 符号会被去掉
 */
function parseCsv(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const warnings = [];
    const validLines = lines.filter(l => !l.startsWith('# '));
    if (validLines.length < 2) {
        return { headers: [], rows: [], warnings: ['CSV 有效行数不足，无法读取表头'] };
    }
    const headers = validLines[1].split(';').map(h => h.trim().replace(/[+\-]$/, ''));
    const rows = [];
    for (let i = 2; i < validLines.length; i++) {
        const line = validLines[i].trim();
        if (!line) {
            continue;
        }
        const cells = line.split(';');
        const row = {};
        headers.forEach((h, idx) => { var _a; row[h] = ((_a = cells[idx]) !== null && _a !== void 0 ? _a : '').trim(); });
        rows.push(row);
    }
    return { headers, rows, warnings };
}
