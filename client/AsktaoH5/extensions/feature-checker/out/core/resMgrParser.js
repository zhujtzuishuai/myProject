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
exports.parseResMgrModule = parseResMgrModule;
const fs = __importStar(require("fs"));
/**
 * 从 TypeScript 文件中解析形如：
 *   export const ResMgr = { ui: { key: "value", ... }, ... }
 * 的映射结构，返回指定模块路径下的 key->value 字典。
 * modulePath 示例："ui" 或 "ui.decorate"
 */
function parseResMgrModule(filePath, modulePath) {
    const src = fs.readFileSync(filePath, 'utf-8');
    const parts = modulePath.split('.');
    let cursor = src;
    for (const part of parts) {
        const re = new RegExp(`\\b${escapeRegex(part)}\\b[^=\\{]*=?\\s*\\{`);
        const m = re.exec(cursor);
        if (!m) {
            return {};
        }
        const block = extractBlock(cursor, m.index + m[0].length - 1);
        if (!block) {
            return {};
        }
        cursor = block;
    }
    return extractKeyValues(cursor);
}
function extractBlock(src, startIndex) {
    let depth = 0, begin = -1;
    for (let i = startIndex; i < src.length; i++) {
        if (src[i] === '{') {
            depth++;
            if (depth === 1) {
                begin = i + 1;
            }
        }
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) {
                return src.slice(begin, i);
            }
        }
    }
    return null;
}
function extractKeyValues(block) {
    const result = {};
    const re = /(?:["']?([\w$]+)["']?)\s*:\s*["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(block)) !== null) {
        result[m[1]] = m[2];
    }
    return result;
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
