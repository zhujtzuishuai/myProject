'use strict';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync, spawn } = require('child_process');

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, '..', 'svn-update-config.yaml');

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let configPath = DEFAULT_CONFIG_PATH;
  let repoName = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      configPath = args[++i];
    } else if (!args[i].startsWith('--')) {
      repoName = args[i];
    }
  }
  return { configPath, repoName };
}

function loadConfig(configPath) {
  return yaml.load(fs.readFileSync(configPath, 'utf8'));
}

// SVN 更新，acceptTheirs=true 时冲突自动取服务器版本
function svnUpdate(dir, acceptTheirs) {
  const cmd = acceptTheirs
    ? `svn update --accept theirs-conflict "${dir}"`
    : `svn update "${dir}"`;
  try {
    const out = execSync(cmd, { encoding: 'utf8' });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || e.message) };
  }
}

// 返回有冲突的文件列表
function svnGetConflicts(dir) {
  try {
    const out = execSync(`svn status "${dir}"`, { encoding: 'utf8' });
    return out.split(/\r?\n/)
      .filter((l) => l[0] === 'C' || l[1] === 'C')
      .map((l) => l.slice(8).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 对每个冲突文件执行 resolve --accept theirs-full
function svnResolveConflicts(files) {
  for (const f of files) {
    try {
      execSync(`svn resolve --accept theirs-full "${f}"`, { encoding: 'utf8' });
      log(`  已解决冲突: ${f}`);
    } catch (e) {
      log(`  解决失败: ${f} — ${e.message}`);
    }
  }
}

// 执行 bat 文件，自动响应交互提示
function runBat(batPath, sqlPassword) {
  return new Promise((resolve) => {
    if (!fs.existsSync(batPath)) {
      log(`  跳过（不存在）: ${batPath}`);
      return resolve(0);
    }
    log(`  执行: ${batPath}`);
    const cwd = path.dirname(batPath);
    const proc = spawn('cmd.exe', ['/c', path.basename(batPath)], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buf = '';

    const onData = (data) => {
      const text = data.toString();
      process.stdout.write(text);
      buf += text;

      const lower = buf.toLowerCase();
      // 检测密码提示
      if (/password|密码|passwd/.test(lower)) {
        proc.stdin.write(sqlPassword + '\r\n');
        buf = '';
        return;
      }
      // 检测 y/n 或其他等待输入的提示
      const trimmed = buf.trimEnd();
      if (
        /\[y[/\\]n\]|\(y[/\\]n\)/i.test(buf) ||
        trimmed.endsWith('?') ||
        trimmed.endsWith(':')
      ) {
        proc.stdin.write('y\r\n');
        buf = '';
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('close', (code) => { proc.stdin.end(); resolve(code ?? 0); });
    proc.on('error', (e) => { log(`  执行出错: ${e.message}`); resolve(1); });
  });
}

// 将 Main.dis 中所有 openTime 统一为同一个值
function fixMainDis(clientDir) {
  const disPath = path.join(clientDir, 'AsktaoH5', 'preview_template', 'Main.dis');
  if (!fs.existsSync(disPath)) {
    log(`  Main.dis 不存在，跳过: ${disPath}`);
    return;
  }
  let text = fs.readFileSync(disPath, 'utf8');
  const m = text.match(/"openTime"\s*:\s*(\d+)/);
  if (!m) { log('  未找到 openTime 字段，跳过'); return; }
  const val = m[1];
  const updated = text.replace(/"openTime"\s*:\s*\d+/g, `"openTime":${val}`);
  if (updated === text) { log(`  openTime 已统一（${val}），无需修改`); return; }
  fs.writeFileSync(disPath, updated, 'utf8');
  log(`  Main.dis openTime 已统一为 ${val}`);
}

async function processRepo(repo, sqlPassword) {
  const { name, server_dir, client_dir } = repo;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`仓库: ${name}`);
  console.log('='.repeat(60));

  // ---- 服务端 ----
  log(`[服务端] 更新: ${server_dir}`);
  const svrResult = svnUpdate(server_dir, true);
  if (svrResult.output) process.stdout.write(svrResult.output);

  // 处理残留冲突
  const svrConflicts = svnGetConflicts(server_dir);
  if (svrConflicts.length) {
    log(`[服务端] 发现 ${svrConflicts.length} 个冲突，自动回退...`);
    svnResolveConflicts(svrConflicts);
  }

  // 执行服务端脚本
  const scriptDir = path.join(server_dir, 'server_scripts');
  await runBat(path.join(scriptDir, 'build_res.bat'), sqlPassword);
  await runBat(path.join(scriptDir, 'config_auto_gen.bat'), sqlPassword);

  // 修正客户端 Main.dis
  log('[客户端] 修正 Main.dis openTime...');
  fixMainDis(client_dir);

  // ---- 客户端 ----
  log(`[客户端] 更新: ${client_dir}`);
  const cltResult = svnUpdate(client_dir, false);
  if (cltResult.output) process.stdout.write(cltResult.output);

  const cltConflicts = svnGetConflicts(client_dir);
  if (cltConflicts.length) {
    console.log(`\n[警告] 客户端存在 ${cltConflicts.length} 个冲突，请手动处理：`);
    cltConflicts.forEach((f) => console.log(`  ! ${f}`));
  } else {
    log('[客户端] 无冲突');
  }
}

async function main() {
  const { configPath, repoName } = parseArgs();
  let cfg;
  try {
    cfg = loadConfig(configPath);
  } catch (e) {
    console.error(`读取配置失败: ${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(cfg.repos) || !cfg.repos.length) {
    console.error('配置中没有 repos');
    process.exit(1);
  }

  const repos = repoName
    ? cfg.repos.filter((r) => r.name === repoName)
    : cfg.repos;

  if (repoName && repos.length === 0) {
    console.error(`未找到仓库: "${repoName}"，可用仓库: ${cfg.repos.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }

  for (const repo of repos) {
    await processRepo(repo, cfg.sql_password || '');
  }
  console.log('\n全部完成。');
}

main().catch((e) => { console.error('[FATAL]', e.message); process.exit(1); });
