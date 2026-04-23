import * as fs from 'fs';

/**
 * 从 TypeScript 文件中解析形如：
 *   export const ResMgr = { ui: { key: "value", ... }, ... }
 * 的映射结构，返回指定模块路径下的 key->value 字典。
 * modulePath 示例："ui" 或 "ui.decorate"
 */
export function parseResMgrModule(filePath: string, modulePath: string): Record<string, string> {
    const src = fs.readFileSync(filePath, 'utf-8');
    const parts = modulePath.split('.');
    let cursor = src;

    for (const part of parts) {
        const re = new RegExp(`\\b${escapeRegex(part)}\\b[^=\\{]*=?\\s*\\{`);
        const m = re.exec(cursor);
        if (!m) { return {}; }
        const block = extractBlock(cursor, m.index + m[0].length - 1);
        if (!block) { return {}; }
        cursor = block;
    }

    return extractKeyValues(cursor);
}

function extractBlock(src: string, startIndex: number): string | null {
    let depth = 0, begin = -1;
    for (let i = startIndex; i < src.length; i++) {
        if (src[i] === '{') { depth++; if (depth === 1) { begin = i + 1; } }
        else if (src[i] === '}') { depth--; if (depth === 0) { return src.slice(begin, i); } }
    }
    return null;
}

function extractKeyValues(block: string): Record<string, string> {
    const result: Record<string, string> = {};
    const re = /(?:["']?([\w$]+)["']?)\s*:\s*["']([^"']*)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) { result[m[1]] = m[2]; }
    return result;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
