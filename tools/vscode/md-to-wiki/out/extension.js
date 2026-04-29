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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const converter_1 = require("./converter");
function activate(context) {
    const cmd = vscode.commands.registerCommand("md-to-wiki.convert", async (uri) => {
        // 支持右键菜单传入 uri，也支持当前活动编辑器
        const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!fileUri || path.extname(fileUri.fsPath) !== ".md") {
            vscode.window.showErrorMessage("请在 .md 文件上执行此命令");
            return;
        }
        const mdContent = fs.readFileSync(fileUri.fsPath, "utf8");
        const wikiContent = (0, converter_1.mdToWiki)(mdContent);
        const wikiPath = fileUri.fsPath.replace(/\.md$/, ".wiki");
        fs.writeFileSync(wikiPath, wikiContent, { encoding: "utf8" });
        const doc = await vscode.workspace.openTextDocument(wikiPath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`已生成：${path.basename(wikiPath)}`);
    });
    context.subscriptions.push(cmd);
}
function deactivate() { }
