import * as fs from 'fs';
import * as path from 'path';
import { parseResMgrModule } from './resMgrParser';
import { parseCsv } from './csvParser';

// ─── 步骤类型定义 ──────────────────────────────────────────────────────────────

export type StepType = 'fileExists' | 'resMgrKey' | 'csvField' | 'charResource';

export interface StepBase {
    id: string;
    type: StepType;
    label: string;
    required: boolean;
}

export interface FileExistsStep extends StepBase {
    type: 'fileExists';
    pathTemplate: string;  // 支持 {{varKey}} 插值
}

export interface ResMgrKeyStep extends StepBase {
    type: 'resMgrKey';
    keyTemplate: string;   // 支持 {{varKey}} 插值
    modulePath: string;    // 默认 'ui'
}

export interface CsvFieldStep extends StepBase {
    type: 'csvField';
    csvPath: string;
    filterField: string;   // 用于定位行的列名
    filterValueKey: string; // 运行时输入的 key
    checkField: string;    // 要检查的列名
}

export interface CharResourceStep extends StepBase {
    type: 'charResource';
    idKey: string;         // 运行时输入的 key（角色ID）
}

export type StepConfig = FileExistsStep | ResMgrKeyStep | CsvFieldStep | CharResourceStep;

export interface RuntimeInput {
    key: string;
    label: string;
    placeholder?: string;
}

export interface FeatureConfig {
    label: string;
    inputs: RuntimeInput[];
    steps: StepConfig[];
}

// ─── 结果类型 ──────────────────────────────────────────────────────────────────

export type StepStatus = 'pass' | 'fail';

export interface StepResult {
    id: string;
    label: string;
    status: StepStatus;
    required: boolean;
    message?: string;
}

export interface PipelineResult {
    steps: StepResult[];
    warnings: string[];
}

// ─── 引擎 ─────────────────────────────────────────────────────────────────────

export interface RunPipelineInput {
    workspaceRoot: string;
    resMgrFile: string;    // 相对 workspaceRoot
    feature: FeatureConfig;
    inputs: Record<string, string>;
}

export function runPipeline(input: RunPipelineInput): PipelineResult {
    const { workspaceRoot, resMgrFile, feature, inputs } = input;
    const warnings: string[] = [];
    const steps: StepResult[] = [];

    for (const step of feature.steps) {
        try {
            const result = runStep(step, workspaceRoot, resMgrFile, inputs);
            steps.push(result);
        } catch (e: any) {
            steps.push({ id: step.id, label: step.label, status: 'fail', required: step.required, message: `执行出错: ${e.message}` });
        }
    }

    return { steps, warnings };
}

function interpolate(template: string, inputs: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => inputs[key] ?? `{{${key}}}`);
}

function runStep(step: StepConfig, root: string, resMgrFile: string, inputs: Record<string, string>): StepResult {
    const base = { id: step.id, label: step.label, required: step.required };

    switch (step.type) {
        case 'fileExists': {
            const resolved = path.resolve(root, interpolate(step.pathTemplate, inputs));
            const exists = fs.existsSync(resolved);
            return { ...base, status: exists ? 'pass' : 'fail', message: exists ? undefined : `文件不存在: ${resolved}` };
        }

        case 'resMgrKey': {
            const key = interpolate(step.keyTemplate, inputs);
            const absResMgr = path.resolve(root, resMgrFile);
            const map = parseResMgrModule(absResMgr, step.modulePath || 'ui');
            const exists = key in map;
            return { ...base, status: exists ? 'pass' : 'fail', message: exists ? undefined : `ResMgr.${step.modulePath || 'ui'} 中不存在 key "${key}"` };
        }

        case 'csvField': {
            const absCSV = path.resolve(root, step.csvPath);
            const parsed = parseCsv(absCSV);
            const filterVal = inputs[step.filterValueKey] ?? '';
            const row = parsed.rows.find(r => r[step.filterField] === filterVal);
            if (!row) {
                return { ...base, status: 'fail', message: `CSV 中未找到 ${step.filterField}="${filterVal}" 的行` };
            }
            const val = row[step.checkField] ?? '';
            return { ...base, status: val ? 'pass' : 'fail', message: val ? undefined : `字段 "${step.checkField}" 为空` };
        }

        case 'charResource': {
            const id = inputs[step.idKey] ?? '';
            const padded = id.padStart(4, '0');
            const missing: string[] = [];
            const checks = [
                path.join(root, 'assets', 'rawChar', 'char', `0${padded}`),
                path.join(root, 'assets', 'raw', 'portraits', 'big', `0${padded}_01_b.png`),
                path.join(root, 'assets', 'raw', 'portraits', 'small', `0${padded}_01_s.png`),
            ];
            for (const p of checks) {
                if (!fs.existsSync(p)) { missing.push(p); }
            }
            return { ...base, status: missing.length === 0 ? 'pass' : 'fail', message: missing.length ? `缺失资源:\n${missing.join('\n')}` : undefined };
        }
    }
}
