"use strict";
const path = require("path");
const CsvMgr = require("./parseCsv").CsvMgr;
const fs = require("fs");

const ClinetRoot = "../../../AsktaoH5";

class PackCfgMgr {
    static doPack() {
        this.doPackCfg();
    }

    static doPackCfg() {
        const map = {};
        this.doPackCfgCsv(map);

        const srcSavePath = path.join(ClinetRoot, "res/cfgs.json");
        fs.writeFileSync(srcSavePath, JSON.stringify(map));
    }

    static doPackCfgCsv(out) {
        const rootPath = path.join(ClinetRoot, "res/cfg/csv");
        CsvMgr.csv2jsonByDir(rootPath, out);
    }
}
PackCfgMgr.doPack();