const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
}

function loadYamlConfig(configPath) {
  const content = fs.readFileSync(configPath, 'utf8');
  return yaml.load(content);
}

function toCsvRow(item) {
  return [
    item.name,
    item.itemId,
    item.icon,
    item.modelOrEffectIcon,
    item.effectConfig,
    item.unit,
    item.quality,
    item.type,
    item.desc,
    item.source,
    item.specialNote,
    item.extraParam,
  ].join(';') + ';';
}

function updateDecorateInfoCsv(typeCfg) {
  const csvPath = path.resolve(typeCfg.csvPath);
  ensureFileExists(csvPath);

  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const header = typeCfg.csvModuleHeader;
  const start = lines.findIndex((l) => l.trim() === header.trim());
  if (start < 0) {
    throw new Error(`未找到模块头: ${header}`);
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('# ')) {
      end = i;
      break;
    }
  }

  const row = toCsvRow(typeCfg.item);
  const insertCfg = typeCfg.csvInsert || { mode: 'tail' };
  const bodyStart = start + 1;
  const bodyEnd = end;

  let insertPos = bodyEnd;
  if (insertCfg.mode === 'head') {
    insertPos = bodyStart;
  } else if (insertCfg.mode === 'tail') {
    insertPos = bodyEnd;
  } else if (insertCfg.mode === 'afterName') {
    const targetName = insertCfg.afterName || '';
    const targetIndex = lines.findIndex((l, idx) => idx >= bodyStart && idx < bodyEnd && l.startsWith(`${targetName};`));
    if (targetIndex >= 0) {
      insertPos = targetIndex + 1;
    } else {
      insertPos = insertCfg.ifNotFound === 'head' ? bodyStart : bodyEnd;
    }
  }

  lines.splice(insertPos, 0, row);
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');

  return { csvPath, insertedRow: row, insertPos };
}

function updateResMgr(typeCfg) {
  const cfg = typeCfg.resMgr;
  const filePath = path.resolve(cfg.path);
  ensureFileExists(filePath);
  let text = fs.readFileSync(filePath, 'utf8');

  if (text.includes(`${cfg.key}:`) || text.includes(`"${cfg.key}"`)) {
    return { filePath, skipped: true, reason: '已存在相同 key' };
  }

  const pair = `${cfg.key}:"${cfg.value}"`;
  const modulePattern = new RegExp(`(${cfg.module}\\s*:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\})`, 'm');
  if (!modulePattern.test(text)) {
    throw new Error(`ResMgr 未找到模块: ${cfg.module}`);
  }

  text = text.replace(modulePattern, (all, p1, p2, p3) => {
    const body = p2.trimEnd();
    const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
    return `${p1}${p2}${suffix}\n    ${pair}${p3}`;
  });

  fs.writeFileSync(filePath, text, 'utf8');
  return { filePath, inserted: pair };
}

function updateConfigMgr(typeCfg) {
  const cfg = typeCfg.configMgr;
  const filePath = path.resolve(cfg.path);
  ensureFileExists(filePath);
  let text = fs.readFileSync(filePath, 'utf8');

  const [left, right] = cfg.appendPair;
  const item = `["${left}","${right}"]`;
  if (text.includes(item) || text.includes(`["${left}", "${right}"]`)) {
    return { filePath, skipped: true, reason: '已存在相同配置' };
  }

  const varPattern = new RegExp(`(${cfg.variable}\\s*=\\s*\\[)([\\s\\S]*?)(\\])`, 'm');
  if (!varPattern.test(text)) {
    throw new Error(`ConfigMgr 未找到变量: ${cfg.variable}`);
  }

  text = text.replace(varPattern, (all, p1, p2, p3) => {
    const body = p2.trimEnd();
    const suffix = body.endsWith(',') || body.length === 0 ? '' : ',';
    return `${p1}${p2}${suffix}\n    ${item}\n${p3}`;
  });

  fs.writeFileSync(filePath, text, 'utf8');
  return { filePath, inserted: item };
}

function main() {
  const configPath = process.argv[2] || 'process-config.yaml';
  const cfg = loadYamlConfig(path.resolve(configPath));

  const selectedType = cfg.flow && cfg.flow.selectedType;
  if (!selectedType || !cfg.types || !cfg.types[selectedType]) {
    throw new Error('配置无效：flow.selectedType 或 types.<type> 缺失');
  }

  const typeCfg = cfg.types[selectedType];
  const steps = (cfg.flow && cfg.flow.steps) || [];
  const report = [];

  for (const step of steps) {
    if (step === 'validateType') {
      report.push({ step, ok: true, selectedType });
    } else if (step === 'updateDecorateInfoCsv') {
      report.push({ step, ...updateDecorateInfoCsv(typeCfg) });
    } else if (step === 'updateResMgr') {
      report.push({ step, ...updateResMgr(typeCfg) });
    } else if (step === 'updateConfigMgr') {
      report.push({ step, ...updateConfigMgr(typeCfg) });
    } else if (step === 'summary') {
      // no-op
    } else {
      report.push({ step, skipped: true, reason: '未知步骤' });
    }
  }

  console.log('执行完成:');
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (err) {
  console.error('[ERROR]', err.message);
  process.exit(1);
}
