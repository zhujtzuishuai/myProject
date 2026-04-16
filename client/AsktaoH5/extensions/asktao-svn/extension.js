'use strict';
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// ─── Output ───────────────────────────────────────────────────────────────────

/** @type {vscode.OutputChannel} */
let out;

function log(msg) {
  out.appendLine(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// ─── SVN helpers ──────────────────────────────────────────────────────────────

async function svnUpdate(dir, acceptTheirs) {
  const cmd = acceptTheirs
    ? `svn update --accept theirs-conflict "${dir}"`
    : `svn update "${dir}"`;
  try {
    const { stdout } = await execAsync(cmd);
    return { ok: true, output: stdout };
  } catch (e) {
    return { ok: false, output: (e.stdout || '') + (e.stderr || e.message) };
  }
}

async function svnGetConflicts(dir) {
  try {
    const { stdout } = await execAsync(`svn status "${dir}"`);
    return stdout.split(/\r?\n/)
      .filter((l) => l[0] === 'C' || l[1] === 'C')
      .map((l) => l.slice(8).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function svnResolveConflicts(files) {
  for (const f of files) {
    try {
      await execAsync(`svn resolve --accept theirs-full "${f}"`);
      log(`  已解决冲突: ${f}`);
    } catch (e) {
      log(`  解决失败: ${f} — ${e.message}`);
    }
  }
}

// ─── Bat runner ───────────────────────────────────────────────────────────────

// rules: [{ pattern: RegExp, response: string }]，按顺序匹配，命中则发送对应回复
// defaultResponse: 无规则命中时发送的默认回复
// debounce: true 时改用防抖模式——收到最后一块数据后等 200ms 无新输出再响应，
//   用于提示格式不固定的 bat，避免对每行普通输出都触发回车导致死循环
function runBat(batPath, rules, defaultResponse, debounce = false) {
  return new Promise((resolve) => {
    if (!fs.existsSync(batPath)) {
      log(`  跳过（不存在）: ${batPath}`);
      return resolve(0);
    }
    log(`  执行: ${batPath}`);
    const proc = spawn('cmd.exe', ['/c', path.basename(batPath)], {
      cwd: path.dirname(batPath),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Windows bat 默认 GBK 编码，用 TextDecoder 正确解码避免乱码
    const decoder = new TextDecoder('gbk');
    let buf = '';
    let timer = null;

    const tryRespond = () => {
      if (!buf.trim()) { return; }
      const matched = rules.find((r) => r.pattern.test(buf));
      proc.stdin.write(matched ? matched.response : defaultResponse);
      buf = '';
    };

    const onData = (data) => {
      const text = decoder.decode(data);
      out.append(text);
      buf += text;

      if (debounce) {
        // 防抖：最后一次收到数据后 200ms 无新输出，说明 bat 在等待输入
        if (timer) { clearTimeout(timer); }
        timer = setTimeout(tryRespond, 200);
        return;
      }

      // 标准提示符检测（适用于格式固定的 bat）
      const trimmed = buf.trimEnd();
      const isPrompt =
        /\[y[/\\]n\]|\(y[/\\]n\)/i.test(buf) ||
        trimmed.endsWith('?')  ||
        trimmed.endsWith('？') ||
        trimmed.endsWith(':')  ||
        trimmed.endsWith('：');

      if (isPrompt) { tryRespond(); }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('close', (code) => {
      if (timer) { clearTimeout(timer); }
      proc.stdin.end();
      resolve(code ?? 0);
    });
    proc.on('error', (e) => { log(`  执行出错: ${e.message}`); resolve(1); });
  });
}

// ─── Main.dis fix ─────────────────────────────────────────────────────────────

function fixMainDis(clientDir) {
  const disPath = path.join(clientDir, 'preview-template', 'Main.dis');
  if (!fs.existsSync(disPath)) {
    log(`  Main.dis 不存在，跳过`);
    return;
  }
  let text = fs.readFileSync(disPath, 'utf8');
  const m = text.match(/"openTime"[ \t]*:[ \t]*"(\d+)"/);
  if (!m) { log('  未找到 openTime 字段，跳过'); return; }
  const val = m[1];
  const updated = text.replace(/"openTime"[ \t]*:[ \t]*"\d+"/g, `"openTime": "${val}"`);
  if (updated === text) { log(`  openTime 已统一（${val}），无需修改`); return; }
  fs.writeFileSync(disPath, updated, 'utf8');
  log(`  Main.dis openTime 已统一为 ${val}`);
}

// ─── Repo flow ────────────────────────────────────────────────────────────────

// mode: 'all' | 'server' | 'client'
// 返回客户端冲突文件列表（供调用方汇总输出）
async function processRepo(repo, sqlPassword, groupName, mode) {
  const { name, serverDir, clientDir } = repo;
  const hasServer = !!serverDir;
  const hasClient = !!clientDir;
  const modeLabel = mode === 'server' ? '仅服务端' : mode === 'client' ? '仅客户端' : '客户端 + 服务端';
  out.appendLine(`\n${'='.repeat(60)}`);
  out.appendLine(`仓库: ${name}  [${modeLabel}]`);
  out.appendLine('='.repeat(60));

  if (mode === 'all' || mode === 'server') {
    if (!hasServer) {
      log('[服务端] 未配置 serverDir，跳过');
    } else {
      log(`[服务端] 更新: ${serverDir}`);
      const svrResult = await svnUpdate(serverDir, true);
      if (svrResult.output) out.append(svrResult.output);

      const svrConflicts = await svnGetConflicts(serverDir);
      if (svrConflicts.length) {
        log(`[服务端] 发现 ${svrConflicts.length} 个冲突，自动回退...`);
        await svnResolveConflicts(svrConflicts);
      }

      // bat 优先在 server_scripts 子目录查找，找不到则在服务端根目录
      const scriptDir = fs.existsSync(path.join(serverDir, 'server_scripts'))
        ? path.join(serverDir, 'server_scripts')
        : serverDir;

      // build_res.bat：遇到密码提示输入密码，其余默认 y
      const buildRules = [
        { pattern: /password|密码|passwd/i, response: sqlPassword + '\r\n' },
      ];
      await runBat(path.join(scriptDir, 'build_res.bat'), buildRules, 'y\r\n');

      // config_auto_gen.bat：按提示内容精确回复
      const configRules = [
        { pattern: /区组名/,                    response: groupName + '\r\n' },
        { pattern: /GS数量/,                    response: '2\r\n' },
        { pattern: /调整该区组的配置|调整为老服/, response: '\r\n' },
        { pattern: /password|密码|passwd/i,     response: sqlPassword + '\r\n' },
      ];
      await runBat(path.join(scriptDir, 'config_auto_gen.bat'), configRules, '\r\n', /* debounce */ true);

      // openTime 由服务端确定，脚本执行后同步到客户端的 Main.dis
      if (hasClient) {
        log('[服务端→客户端] 修正 Main.dis openTime...');
        fixMainDis(clientDir);
      }
    }
  }

  const conflicts = [];

  if (mode === 'all' || mode === 'client') {
    if (!hasClient) {
      log('[客户端] 未配置 clientDir，跳过');
    } else {
      log(`[客户端] 更新: ${clientDir}`);
      const cltResult = await svnUpdate(clientDir, false);
      if (cltResult.output) out.append(cltResult.output);

      const cltConflicts = await svnGetConflicts(clientDir);
      if (cltConflicts.length) {
        log(`[客户端] 发现 ${cltConflicts.length} 个冲突，已记录，将在最后汇总显示`);
        cltConflicts.forEach((f) => conflicts.push(`[${name}] ${f}`));
      } else {
        log('[客户端] 无冲突');
      }
    }
  }

  return conflicts;
}

// ─── Recent-usage sort ────────────────────────────────────────────────────────

// 按最近使用时间排序（history 为 { [label]: timestamp }，越大越靠前）
function sortByRecent(items, history) {
  return [...items].sort((a, b) => (history[b.label] || 0) - (history[a.label] || 0));
}


// ─── Activate ─────────────────────────────────────────────────────────────────

function activate(context) {
  out = vscode.window.createOutputChannel('SVN 更新');
  context.subscriptions.push(out);

  context.subscriptions.push(
    vscode.commands.registerCommand('asktao-svn.update', async () => {
      const cfg = vscode.workspace.getConfiguration('asktao-svn');
      const repos = cfg.get('repos') || [];
      const sqlPassword = cfg.get('sqlPassword') || '';

      if (!repos.length) {
        const choice = await vscode.window.showWarningMessage(
          '尚未配置 SVN 仓库，请在设置中添加 asktao-svn.repos',
          '打开设置'
        );
        if (choice === '打开设置') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'asktao-svn.repos');
        }
        return;
      }

      const repoHistory = context.globalState.get('repoHistory', {});
      const modeHistory = context.globalState.get('modeHistory', {});

      // 第一步：选择仓库（按最近使用排序）
      const repoItems = sortByRecent([
        { label: '全部仓库', description: '更新所有仓库' },
        ...repos.map((r) => ({ label: r.name, description: r.serverDir || r.clientDir || '' })),
      ], repoHistory);
      const pickedRepo = await vscode.window.showQuickPick(repoItems, { placeHolder: '第一步：选择仓库' });
      if (!pickedRepo) { return; }

      // 第二步：选择更新范围（按最近使用排序）
      const modeItems = sortByRecent([
        { label: '客户端 + 服务端', description: '完整更新', mode: 'all' },
        { label: '仅客户端',        description: '仅更新客户端目录', mode: 'client' },
        { label: '仅服务端',        description: '仅更新服务端目录并执行脚本', mode: 'server' },
      ], modeHistory);
      const pickedMode = await vscode.window.showQuickPick(modeItems, { placeHolder: '第二步：选择更新范围' });
      if (!pickedMode) { return; }

      // 记录本次选择到历史
      repoHistory[pickedRepo.label] = Date.now();
      modeHistory[pickedMode.label] = Date.now();
      await context.globalState.update('repoHistory', repoHistory);
      await context.globalState.update('modeHistory', modeHistory);

      const selected = pickedRepo.label === '全部仓库'
        ? repos
        : repos.filter((r) => r.name === pickedRepo.label);
      const mode = pickedMode.mode;

      out.clear();
      out.show(true);

      try {
        const allConflicts = [];
        for (const repo of selected) {
          const conflicts = await processRepo(repo, sqlPassword, repo.groupName || '', mode);
          allConflicts.push(...conflicts);
        }
        if (allConflicts.length) {
          out.appendLine(`\n${'!'.repeat(60)}`);
          out.appendLine(`!!! 客户端存在 ${allConflicts.length} 个冲突，请手动处理 !!!`);
          out.appendLine('!'.repeat(60));
          allConflicts.forEach((f) => out.appendLine(`  !! ${f}`));
          out.appendLine('!'.repeat(60));
        }
        out.appendLine('\n全部完成。');
      } catch (e) {
        log(`[FATAL] ${e.message}`);
        vscode.window.showErrorMessage(`SVN 更新失败: ${e.message}`);
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
