import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { mdToWiki } from "./converter";

export function activate(context: vscode.ExtensionContext) {
    const cmd = vscode.commands.registerCommand("md-to-wiki.convert", async (uri?: vscode.Uri) => {
        // 支持右键菜单传入 uri，也支持当前活动编辑器
        const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!fileUri || path.extname(fileUri.fsPath) !== ".md") {
            vscode.window.showErrorMessage("请在 .md 文件上执行此命令");
            return;
        }

        const mdContent = fs.readFileSync(fileUri.fsPath, "utf8");
        const wikiContent = mdToWiki(mdContent);

        const wikiPath = fileUri.fsPath.replace(/\.md$/, ".wiki");
        fs.writeFileSync(wikiPath, wikiContent, { encoding: "utf8" });

        const doc = await vscode.workspace.openTextDocument(wikiPath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`已生成：${path.basename(wikiPath)}`);
    });

    context.subscriptions.push(cmd);
}

export function deactivate() {}
