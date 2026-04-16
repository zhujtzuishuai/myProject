import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CsvInsertConfig {
  mode: 'head' | 'tail' | 'sortByItemId';
}

export interface ItemConfig {
  name: string;
  itemId: string;
  icon: string;
  modelOrEffectIcon: string;
  effectConfig: string;
  unit: string;
  quality: string;
  type: string;
  desc: string;
  source: string;
  specialNote: string;
  extraParam: string;
}

export interface ResMgrConfig {
  module: string;
  key: string;
  value: string;
}

export interface ConfigMgrConfig {
  variable: string;
  appendPair: [string, string];
}

export interface TypeConfig {
  label: string;
  csvPath: string;
  csvModuleHeader?: string;
  csvInsert: CsvInsertConfig;
  item: ItemConfig;
  resMgr: ResMgrConfig;
  configMgr: ConfigMgrConfig;
}

export interface GlobalConfig {
  resMgrPath: string;
  configMgrPath: string;
}

export interface ProcessConfig {
  globalConfig: GlobalConfig;
  types: Record<string, TypeConfig>;
  flow: {
    selectedType: string;
    steps: string[];
  };
}

export interface StepResult {
  step: string;
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  selectedType?: string;
  csvPath?: string;
  insertedRow?: string;
  insertPos?: number;
  filePath?: string;
  inserted?: string;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
}

export function loadYamlConfig(configPath: string): ProcessConfig {
  const content = fs.readFileSync(configPath, 'utf8');
  return yaml.load(content) as ProcessConfig;
}

/**
 * 根据 CSV 第二行字段名顺序动态拼装行。
 * 字段名行示例：name+;itemId;icon;icon2;effectCfg;unit;color;type;descript;sources;flag;extraParams;
 */
function toCsvRow(item: ItemConfig, fieldNameRow: string): string {
  const fieldMap: Record<string, keyof ItemConfig> = {
    'name+': 'name',
    'name':  'name',
    itemId:          'itemId',
    icon:            'icon',
    icon2:           'modelOrEffectIcon',
    effectCfg:       'effectConfig',
    unit:            'unit',
    color:           'quality',
    type:            'type',
    descript:        'desc',
    sources:         'source',
    flag:            'specialNote',
    extraParams:     'extraParam',
  };

  const cols = fieldNameRow.split(';').map(c => c.trim()).filter(Boolean);
  return cols.map(col => {
    const key = fieldMap[col];
    return key !== undefined ? (item[key] ?? '') : '';
  }).join(';') + ';';
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export function updateDecorateInfoCsv(typeCfg: TypeConfig, workspaceRoot: string): StepResult {
  const csvPath = path.isAbsolute(typeCfg.csvPath)
    ? typeCfg.csvPath
    : path.resolve(workspaceRoot, typeCfg.csvPath);
  ensureFileExists(csvPath);

  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/);

  // 第二行为字段名行（name+;itemId;icon;...）
  const fieldNameRow = lines[1] ?? '';

  // 确定数据区范围
  let bodyStart: number;
  let bodyEnd = lines.length;

  if (typeCfg.csvModuleHeader) {
    const start = lines.findIndex(l => l.trim() === typeCfg.csvModuleHeader!.trim());
    if (start < 0) {
      throw new Error(`未找到模块头: ${typeCfg.csvModuleHeader}`);
    }
    bodyStart = start + 1;
    for (let i = bodyStart; i < lines.length; i++) {
      if (lines[i].trim().startsWith('# ')) { bodyEnd = i; break; }
    }
  } else {
    // 无模块头：跳过显示名行 + 字段名行
    bodyStart = 2;
  }

  const row = toCsvRow(typeCfg.item, fieldNameRow);
  const mode = typeCfg.csvInsert?.mode ?? 'tail';
  let insertPos: number;

  if (mode === 'head') {
    insertPos = bodyStart;
  } else if (mode === 'sortByItemId') {
    // 从字段名行找 itemId 所在列
    const fieldCols = fieldNameRow.split(';').map(c => c.trim());
    const colIdx = Math.max(fieldCols.indexOf('itemId'), 1);
    const newId = parseInt(typeCfg.item.itemId, 10);
    insertPos = bodyEnd;
    for (let i = bodyStart; i < bodyEnd; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) { continue; }
      const existingId = parseInt(line.split(';')[colIdx] ?? '', 10);
      if (!isNaN(existingId) && existingId > newId) {
        insertPos = i;
        break;
      }
    }
  } else {
    // tail（默认）
    insertPos = bodyEnd;
  }

  lines.splice(insertPos, 0, row);
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { step: 'updateDecorateInfoCsv', csvPath, insertedRow: row, insertPos };
}

export function updateResMgr(typeCfg: TypeConfig, filePath: string, workspaceRoot: string): StepResult {
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

  text = text.replace(modulePattern, (_all, p1: string, p2: string, p3: string) => {
    const body = p2.trimEnd();
    const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
    return `${p1}${p2}${suffix}\n    ${pair}${p3}`;
  });

  fs.writeFileSync(resolvedPath, text, 'utf8');
  return { step: 'updateResMgr', filePath: resolvedPath, inserted: pair };
}

export function updateConfigMgr(typeCfg: TypeConfig, filePath: string, workspaceRoot: string): StepResult {
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

  text = text.replace(varPattern, (_all, p1: string, p2: string, p3: string) => {
    const body = p2.trimEnd();
    const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
    return `${p1}${p2}${suffix}\n    ${item}\n${p3}`;
  });

  fs.writeFileSync(resolvedPath, text, 'utf8');
  return { step: 'updateConfigMgr', filePath: resolvedPath, inserted: item };
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export function applyConfig(configPath: string, workspaceRoot: string): StepResult[] {
  const cfg = loadYamlConfig(configPath);

  const selectedType = cfg.flow?.selectedType;
  if (!selectedType || !cfg.types?.[selectedType]) {
    throw new Error('配置无效：flow.selectedType 或 types.<type> 缺失');
  }

  const typeCfg = cfg.types[selectedType];
  const steps = cfg.flow?.steps ?? [];
  const resMgrPath = cfg.globalConfig?.resMgrPath ?? '';
  const configMgrPath = cfg.globalConfig?.configMgrPath ?? '';
  const report: StepResult[] = [];

  for (const step of steps) {
    if (step === 'validateType') {
      report.push({ step, ok: true, selectedType });
    } else if (step === 'updateDecorateInfoCsv') {
      report.push(updateDecorateInfoCsv(typeCfg, workspaceRoot));
    } else if (step === 'updateResMgr') {
      report.push(updateResMgr(typeCfg, resMgrPath, workspaceRoot));
    } else if (step === 'updateConfigMgr') {
      report.push(updateConfigMgr(typeCfg, configMgrPath, workspaceRoot));
    } else if (step === 'summary') {
      // no-op
    } else {
      report.push({ step, skipped: true, reason: '未知步骤' });
    }
  }

  return report;
}
