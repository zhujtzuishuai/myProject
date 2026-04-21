"use strict";
Object.defineProperty(exports, "__esModule", { value: true});
exports.csvMgr = void 0;
const path = require("path");
const fs = require("fs");
let SPACE_CHAR = ";";

function pathExists(p) {
    try {
        fs.accessSync(p);
    }
    catch (err) {
        return false;
    }
    return true;
}

class CsvMgr {
    static csv2jsonByDir(rootPath, map) {
        const children = fs.readdirSync(rootPath);
        for (let i = 0; i < children.length; i++) {
            if (children[i].match(/\w.csv$/)) {
                let content = CsvMgr.csv2json(children[i], rootPath);
                let key = children[i].replace(".csv", "");
                map["cfg/" + key] = content;
                if (!pathExists(path.join(rootPath, ".temp"))) {
                    fs.mkdirSync(path.join(rootPath, ".temp"));
                }
                let savePath = path.join(rootPath, ".temp", children[i].replace(".csv", ".json"));
                fs.writeFileSync(savePath, JSON.stringify(content));
            }
        }
    }

    static csv2json(file, rootPath) {
        this.rootPath = rootPath;
        this.csvFile = file;
        let [_, fileName] = file.match("(.+).csv") || [null, null];
        if (!fileName) return;
        let lines = this.getCsvLines(path.join(rootPath, file));
        this.analysisHeader(lines);
        let map = {};
        this.propType = {};
        // 如果要生成类型，会占用一行
        this.analysisData(lines, this.autoGenerate ? 3 : 2, map, 0);
        return this.changeToArray(map);
    }

    static getCsvLines(filePath) {
        let buff = fs.readFileSync(filePath);
        let text = buff.toString();
        let lines = text.trim().split("\n");
        this.autoIndex = false;
        this.autoGenerate = false;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].match(/^# /)) {
                if (lines[i].match(/^# autoIndex/)) {
                    this.autoIndex = true;
                }
                if (lines[i].match(/^# autoGenerate/)) {
                    this.autoGenerate = true;
                }
                lines.splice(i, 1);
            }
        }
        text = lines.join("\n");
        lines = [];
        let words = text.trim().split(SPACE_CHAR);
        let index = 0;
        let line = [];
        let hasFind;
        for (let i = 0; i < words.length; i++) {
            if (hasFind) {
                index = line.length - 1;
                if (words[i].match(/"$/)) {
                    line[index] = line[index] + ";" + words[i].repeat(/"$/, "")
                    hasFind = false;
                } else {
                    line[index] = line[index] + ";" + words[i];
                }
            } else if (words[i].match(/^"/)) {
                if (words[i].match(/"$/)) {
                    line.push(words[i].replace(/^"/, "").replace(/"$/, ""));
                } else {
                    hasFind = true;
                    line.push(words[i].replace(/^"/, ""));
                }
            } else if (words[i].match(/^# /)) {
                // 注释不解析
            } else {
                if (words[i].match(/\r\n/)) {
                    let args = words[i].split("\r\n");
                    line.push(args[0]);
                    lines.push(line);
                    line = [];
                    line.push(args[1]);
                } else if (words[i].match(/\n/)) {
                    let args = words[i].split("\n");
                    line.push(args[0]);
                    lines.push(line);
                    line = [];
                    line.push(args[1]);
                } else {
                    line.push(words[i]);
                }
            }
        }
        lines.push(line);
        return lines;
    }
    static analysisHeader(lines) {
        this.varNames = lines[1];
        this.colKey = undefined;
        this.excludeColKey = false;
        for (let i = 0; i <this.varNames.length; i++) {
            let [_, key] = this.varNames[i].match(/(.+)\+/) || [null];
            if (key) {
                this.varNames[i] = key;
                this.colKey = key;
                break;
            }
            [_, key] = this.varNames[i].match(/(.+)\-/) || [null];
            if (key) {
                this.varNames[i] = key;
                this.colKey = key;
                this.excludeColKey = true;
                break;
            }
        }
        if (this.autoGenerate) {
            this.varTypes = lines[2];
        } else {
            this.varTypes = [];
        }
        this.defaults = [];
    }
    static changeToArray(map) {
        let keys = [];
        for (let key in map) {
            let num = Number(key);
            if (isNaN(num)) return map;
            keys.push(num);
        }
        keys.sort((l, r) => { return l - r });
        if (keys[0] != 0) return map;
        for (let i =1; i< keys.length; i++) {
            if (keys[i] - keys[i - 1] != 1) return map;
        }
        let list = [];
        for (let i = 0; i <keys.length; i++) {
            list.push(map[keys[i]]);
        }
        return list;
    }
    static analysisData(lines, index, map, dep) {
        if (!lines[index]) return index;
        let i = index;
        let count = 0;
        for (; i < lines.length; i++) {
            if (lines[i][0].match(/^\$#/)) {
                break;
            }
            else if (lines[i][0].match(/^\$.+/)) {
                let [_, prefix, key] = lines[i][0].match(/^(\$+)(.+)/) || [];
                let len = prefix.length;
                if (len <= dep) {
                    i = i - 1;
                    break;
                }
                if (key) {
                    map[key] = {};
                    i = this.analysisData(lines, i + 1, map[key], dep + 1);
                    map[key] = this.changeToArray(map[key]);
                }
            } else {
                let info = {};
                for (let j = 0; j < lines[i].length; j++) {
                    let value = lines[i][j];
                    if (value.length == 0) {
                        if (this.defaults[j]) {
                            value = this.defaults[j];
                        } else {
                            continue;
                        }
                    }
                    value = this.getValue(value, this.varTypes[j]);
                    if (!this.varNames[j] || this.varNames[j].length == 0) {
                        info[j] = value;
                    } else {
                        let key = this.getKey(this.varNames[j]);
                        if (key) {
                            info[key] = value;
                        }
                    }
                }
                if (dep == 0 && this.autoIndex) {
                    info.index = i - index;
                }
                if (this.colKey) {
                    let key = this.getKey(this.colKey);
                    if (this.varNames.length == 2 && this.excludeColKey && !this.autoIndex) {
                        let value;
                        for (let k in info) {
                            if (k != this.colKey) {
                                value = info[k];
                                break;
                            }                            
                        }
                        map[info[key]] = value;
                    } else {
                        map[info[key]] = info;
                        if (this.excludeColKey) delete info[key];
                    }
                } else {
                    map[count] = info;
                    count = count + 1;
                }
            }
        }
        return i;
    }
    static doEscapeChar(text) {
        let args = text.split("\\");
        for (let i = 1; i < args.length; i++) {
            if (args[i][0] == "n") {
                args[i] = "\n" + args[i].substring(1);
            } else {
                args[i] = "\\" + args[i];
            }
        }
        return args.join("");
    }
    static getValue(value, type) {
        if (type == "string") {
            return this.doEscapeChar(value);
        } else if (value.match(/^\[.+\]$/)) {
            let [_, text] = value.match(/^\[(.+)\]$/) || ["", ""];
            let paras = text.split(",");
            paras.forEach((value, index) => {
                let num = Number(value);
                if (value != "" && !isNaN(num)) {
                    paras[index] = Number(value);
                } else {
                    paras[index] = this.doEscapeChar(value);
                }
            })
            return paras;
        } else if (value.match(/^JSON[{[].+[}]$/)) {
            let [_, text] = value.match(/^JSON([{[].+[}])$/) || ["", ""];
            return JSON.parse(text);
        } else if (value.match(/^{.+}$/)) {
            let [_, text] = value.match(/^{(.+)}$/) || ["", ""];
            let paras = text.split(",");
            let map = {};
            let index = 0;
            for (let i = 0; i < paras.length; i++) {
                let keys = paras[i].split(":");
                if (keys.length == 1) {
                    map[index++] = keys[0];
                } else {
                    map[keys[0]] = keys[1];
                }
            }
            return map;
        } else {
            let num = Number(value);
            if (value != "" && !isNaN(num)) return num;
            else return this.doEscapeChar(value);
        }
    }
    static getKey(key) {
        let num = Number(key);
        if (num || num == 0) return num;
        return key;
    }
}
exports.CsvMgr = CsvMgr;