import * as fs from 'fs';
import * as path from 'path';
import { parseCsv } from './csvParser';
import { parseResMgrModule } from './resMgrParser';

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type CheckLevel = 'required' | 'optional' | 'none';
export type CheckType  = 'existence' | 'equal' | 'charResource' | 'resMgrMapping';

export interface HeaderCheckConfig {
    level: CheckLevel;
    checkType: CheckType;
    equalTarget?: string;   // 运行时填入，不持久化
}

export interface ResMgrConfig {
    filePath: string;
    modulePath: string;
    resourceRoot: string;
}

export interface CheckInput {
    workspaceRoot: string;
    csvPath: string;
    headers: Record<string, HeaderCheckConfig>;
    resMgr?: ResMgrConfig;
}

export type CellStatus = 'pass' | 'fail';

export interface CellResult {
    header: string;
    value: string;
    status: CellStatus;
    level: CheckLevel;
    message?: string;
}

export interface RowResult {
    rowIndex: number;
    cells: CellResult[];
}

export interface CheckResult {
    rows: RowResult[];
    warnings: string[];
}

// ─── 引擎 ─────────────────────────────────────────────────────────────────────

export function runCheck(input: CheckInput): CheckResult {
    const warnings: string[] = [];
    const { workspaceRoot, csvPath, headers, resMgr } = input;

    const absCSV = path.resolve(workspaceRoot, csvPath);
    const parsed = parseCsv(absCSV);
    warnings.push(...parsed.warnings);

    // equal 列作为行过滤条件
    const filterEntries = Object.entries(headers).filter(
        ([, cfg]) => cfg.checkType === 'equal' && cfg.equalTarget !== undefined,
    );

    let matchedRows = parsed.rows.map((row, i) => ({ row, i }));
    for (const [col, cfg] of filterEntries) {
        matchedRows = matchedRows.filter(({ row }) => row[col] === cfg.equalTarget);
    }

    if (filterEntries.length > 0 && matchedRows.length > 1) {
        warnings.push(`存在 ${matchedRows.length} 行匹配，理论上应唯一，请检查配置表是否有重复数据。`);
    }

    // 加载 ResMgr 映射
    let resMgrMap: Record<string, string> = {};
    const needsResMgr = Object.values(headers).some(c => c.checkType === 'resMgrMapping');
    if (needsResMgr && resMgr) {
        const absResMgr = path.resolve(workspaceRoot, resMgr.filePath);
        resMgrMap = parseResMgrModule(absResMgr, resMgr.modulePath);
    }

    const rows: RowResult[] = matchedRows.map(({ row, i }) => {
        const cells: CellResult[] = [];

        for (const [header, cfg] of Object.entries(headers)) {
            if (cfg.level === 'none') { continue; }

            const value = row[header] ?? '';
            let status: CellStatus = 'pass';
            let message: string | undefined;

            if (!value) {
                status = 'fail';
                message = '值不存在';
            } else {
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
                        const missing: string[] = [];
                        const checks = [
                            path.join(workspaceRoot, 'assets', 'rawChar', 'char', `0${padded}`),
                            path.join(workspaceRoot, 'assets', 'raw', 'portraits', 'big', `0${padded}_01_b.png`),
                            path.join(workspaceRoot, 'assets', 'raw', 'portraits', 'small', `0${padded}_01_s.png`),
                        ];
                        for (const p of checks) {
                            if (!pathExists(p)) { missing.push(p); }
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

function pathExists(p: string): boolean {
    try { fs.accessSync(p); return true; } catch { return false; }
}
