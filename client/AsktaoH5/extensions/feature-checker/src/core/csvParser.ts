import * as fs from 'fs';

export interface CsvParseResult {
    headers: string[];
    rows: Record<string, string>[];
    warnings: string[];
}

/**
 * 解析 CSV 文件。
 * - 跳过以 "# " 开头的注释行
 * - 第 2 行（跳过注释后）为表头行
 * - 分隔符为 ";"
 * - 表头末尾的 +/- 符号会被去掉
 */
export function parseCsv(filePath: string): CsvParseResult {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const warnings: string[] = [];

    const validLines = lines.filter(l => !l.startsWith('# '));

    if (validLines.length < 2) {
        return { headers: [], rows: [], warnings: ['CSV 有效行数不足，无法读取表头'] };
    }

    const headers = validLines[1].split(';').map(h => h.trim().replace(/[+\-]$/, ''));

    const rows: Record<string, string>[] = [];
    for (let i = 2; i < validLines.length; i++) {
        const line = validLines[i].trim();
        if (!line) { continue; }
        const cells = line.split(';');
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim(); });
        rows.push(row);
    }

    return { headers, rows, warnings };
}
