"use strict";
const path = require("path");
const { CsvMgr, typeNodeToTs } = require("./parseCsv");
const fs = require("fs");

const ClinetRoot = "../../../AsktaoH5";

class PackCfgMgr {
    static doPack() {
        this.doPackCfg();
    }

    static doPackCfg() {
        const map = {};
        const typeInfoList = [];
        this.doPackCfgCsv(map, typeInfoList);

        const srcSavePath = path.join(ClinetRoot, "res/cfgs.json");
        fs.writeFileSync(srcSavePath, JSON.stringify(map));

        this.generateDts(typeInfoList);
    }

    static doPackCfgCsv(out, typeInfoList) {
        const rootPath = path.join(ClinetRoot, "res/cfg/csv");
        const children = fs.readdirSync(rootPath);
        for (let i = 0; i < children.length; i++) {
            if (children[i].match(/\w.csv$/)) {
                const fileName = children[i].replace(".csv", "");
                CsvMgr.csv2json(children[i], rootPath);
                const info = CsvMgr.getLastTypeInfo();
                info.fileName = fileName;
                typeInfoList.push(info);
            }
        }
        // 实际打包用原有方法
        CsvMgr.csv2jsonByDir(rootPath, out);
    }

    static generateDts(typeInfoList) {
        const lines = [];
        lines.push("// 此文件由 PackClientConfig 自动生成，请勿手动修改");
        lines.push("");

        for (const info of typeInfoList) {
            if (!info.autoGenerate) continue;

            const interfaceName = info.typeName
                ? info.typeName
                : info.fileName.charAt(0).toUpperCase() + info.fileName.slice(1) + "Cfg";

            lines.push(`interface ${interfaceName} {`);

            for (let i = 0; i < info.varNames.length; i++) {
                const name = info.varNames[i];
                if (!name || name.length === 0) continue;
                const cleanName = name.replace(/[+\-]$/, "");
                const tsType = typeNodeToTs(info.parsedVarTypes[i]);
                const desc = info.varDescs[i];
                if (desc && desc.trim()) {
                    lines.push(`    /** ${desc.trim()} */`);
                }
                lines.push(`    ${cleanName}: ${tsType};`);
            }

            if (info.autoIndex) {
                lines.push(`    index: number;`);
            }

            lines.push(`}`);
            lines.push("");
        }

        const dtsPath = path.join(ClinetRoot, "@types/autoCfg.d.ts");
        fs.writeFileSync(dtsPath, lines.join("\n"));
        console.log(`[PackCfg] 已生成类型声明: ${dtsPath}`);
    }
}

PackCfgMgr.doPack();
