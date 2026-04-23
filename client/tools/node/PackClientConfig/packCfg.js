"use strict";
const path = require("path");
const { CsvMgr, typeNodeToTs } = require("./parseCsv");
const fs = require("fs");

const CLIENT_ROOT = "../../../AsktaoH5";

class PackCfgMgr {
    static doPack() {
        this.doPackCfg();
    }

    static doPackCfg() {
        const { map, typeInfoList } = this.doPackCfgCsv();

        const cfgsPath = path.join(CLIENT_ROOT, "res/cfgs.json");
        fs.writeFileSync(cfgsPath, JSON.stringify(map));

        this.generateDts(typeInfoList);
    }

    static doPackCfgCsv() {
        const rootPath = path.join(CLIENT_ROOT, "res/cfg/csv");
        return CsvMgr.csv2jsonByDir(rootPath);
    }

    /**
     * 解析现有 .d.ts 文件，返回以 fileName 为 key 的 interface 块 Map
     * 每个块包含 @source 注释行 + interface 内容行（含首尾括号行）
     * @param {string} content
     * @returns {Map<string, string[]>}
     */
    static _parseDtsBlocks(content) {
        const blocks = new Map();
        const lines = content.split("\n");
        let i = 0;
        while (i < lines.length) {
            const sourceMatch = lines[i].match(/^\s+\/\*\* @source (.+?)\.csv \*\//);
            if (sourceMatch) {
                const fileName = sourceMatch[1];
                const block = [lines[i]];
                i++;
                // 收集 interface 块直到匹配的 `    }`
                let depth = 0;
                while (i < lines.length) {
                    block.push(lines[i]);
                    if (lines[i].match(/^\s+interface\s+\w+\s*\{/)) depth++;
                    if (lines[i].match(/^\s+\}/) && depth > 0) {
                        depth--;
                        if (depth === 0) { i++; break; }
                    }
                    i++;
                }
                blocks.set(fileName, block);
            } else {
                i++;
            }
        }
        return blocks;
    }

    /**
     * 根据单个 typeInfo 构建 interface 块的行数组
     * @param {Object} info
     * @returns {string[]}
     */
    static _buildInterfaceBlock(info) {
        const interfaceName = info.typeName
            || (info.fileName.charAt(0).toUpperCase() + info.fileName.slice(1) + "Cfg");
        const block = [];
        block.push(`    /** @source ${info.fileName}.csv */`);
        block.push(`    interface ${interfaceName} {`);
        for (let i = 0; i < info.varNames.length; i++) {
            const name = info.varNames[i];
            if (!name || name.length === 0) continue;
            const cleanName = name.replace(/[+\-]$/, "");
            const tsType = typeNodeToTs(info.parsedVarTypes[i]);
            const optional = info.optionalCols && info.optionalCols.has(i) ? "?" : "";
            const desc = info.varDescs[i];
            if (desc && desc.trim()) block.push(`        /** ${desc.trim()} */`);
            block.push(`        ${cleanName}${optional}: ${tsType};`);
        }
        if (info.autoIndex) block.push(`        index: number;`);
        block.push(`    }`);
        return block;
    }

    /**
     * 增量更新 .d.ts 声明文件：
     * - 有 # genType 的 csv：已存在则更新，不存在则追加到末尾
     * - 失去 # genType 的 csv：保留原有 interface 块不动
     * @param {Object[]} typeInfoList
     */
    static generateDts(typeInfoList) {
        const dtsPath = path.join(CLIENT_ROOT, "@types/autoCfg.d.ts");
        const oldContent = fs.existsSync(dtsPath) ? fs.readFileSync(dtsPath, "utf8") : null;

        // 解析现有块，key 为 fileName
        const existingBlocks = oldContent ? this._parseDtsBlocks(oldContent) : new Map();

        // 以现有块为基础，更新有 genType 的文件
        for (const info of typeInfoList) {
            if (!info.genType) continue;
            existingBlocks.set(info.fileName, this._buildInterfaceBlock(info));
        }

        // 重新组装文件：保留所有块（含未更新的），新增的追加在末尾（已由 Map 顺序保证）
        const lines = [
            "// 此文件由 PackClientConfig 自动生成，请勿手动修改",
            "",
            "declare namespace Cfg {",
        ];
        for (const block of existingBlocks.values()) {
            lines.push(...block);
            lines.push("");
        }
        lines.push("}");

        const newContent = lines.join("\n");
        if (oldContent !== newContent) {
            fs.writeFileSync(dtsPath, newContent);
        }
    }
}

PackCfgMgr.doPack();
