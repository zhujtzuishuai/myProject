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

// 将 csv 基础类型名映射到 TypeScript 类型名
const PRIMITIVE_TYPE_MAP = {
    "string": "string",
    "boolean": "boolean",
    "bool": "boolean",
    "number": "number",
    "int": "number",
    "float": "number",
};

/**
 * 将类型字符串解析为类型 AST
 * 支持：string | number | int | float | boolean | bool
 *       T[]  (数组，可嵌套)
 *       map<K,V>  (map，K/V 可嵌套)
 * 返回：
 *   { kind: 'primitive', name: string }
 *   { kind: 'array', elem: TypeNode }
 *   { kind: 'map', key: TypeNode, val: TypeNode }
 */
function parseType(str) {
    str = str ? str.trim() : "";
    if (!str) return { kind: "primitive", name: "" };

    // map<K,V> 或 Record<K,V>
    if ((str.startsWith("map<") || str.startsWith("Record<")) && str.endsWith(">")) {
        const prefixLen = str.startsWith("map<") ? 4 : 7;
        const inner = str.slice(prefixLen, -1);
        // 在顶层找逗号（跳过嵌套尖括号）
        let depth = 0;
        let splitIdx = -1;
        for (let i = 0; i < inner.length; i++) {
            if (inner[i] === "<") depth++;
            else if (inner[i] === ">") depth--;
            else if (inner[i] === "," && depth === 0) {
                splitIdx = i;
                break;
            }
        }
        if (splitIdx === -1) return { kind: "primitive", name: str };
        return {
            kind: "map",
            key: parseType(inner.slice(0, splitIdx)),
            val: parseType(inner.slice(splitIdx + 1)),
        };
    }

    // T[]（可多层，如 number[][]）
    if (str.endsWith("[]")) {
        return { kind: "array", elem: parseType(str.slice(0, -2)) };
    }

    // 基础类型
    return { kind: "primitive", name: str };
}

// 将类型 AST 转为 TypeScript 类型字符串
function typeNodeToTs(node) {
    if (!node) return "any";
    if (node.kind === "array") {
        const elemTs = typeNodeToTs(node.elem);
        return `${elemTs}[]`;
    }
    if (node.kind === "map") {
        const keyTs = typeNodeToTs(node.key);
        const valTs = typeNodeToTs(node.val);
        return `Record<${keyTs}, ${valTs}>`;
    }
    // primitive
    return PRIMITIVE_TYPE_MAP[node.name] || "any";
}

exports.parseType = parseType;
exports.typeNodeToTs = typeNodeToTs;

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
        this.typeName = null;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].match(/^# /)) {
                if (lines[i].match(/^# autoIndex/)) {
                    this.autoIndex = true;
                }
                if (lines[i].match(/^# autoGenerate/)) {
                    this.autoGenerate = true;
                }
                let typeNameMatch = lines[i].match(/^# typeName=(.+)/);
                if (typeNameMatch) {
                    this.typeName = typeNameMatch[1].trim();
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
        this.varDescs = lines[0];
        this.varNames = lines[1];
        this.colKey = undefined;
        this.excludeColKey = false;
        for (let i = 0; i < this.varNames.length; i++) {
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
        // 预解析类型，供运行时转换使用
        this.parsedVarTypes = this.varTypes.map(t => parseType(t ? t.trim() : ""));
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
        for (let i = 1; i < keys.length; i++) {
            if (keys[i] - keys[i - 1] != 1) return map;
        }
        let list = [];
        for (let i = 0; i < keys.length; i++) {
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
                    const parsedType = this.parsedVarTypes ? this.parsedVarTypes[j] : null;
                    value = this.getValueByType(value, parsedType);
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

    /**
     * 根据解析后的类型 AST 递归转换值
     * 无类型或 primitive 时走原有逻辑
     */
    static getValueByType(value, node) {
        if (!node || node.kind === "primitive") {
            return this.getValue(value, node ? node.name : undefined);
        }

        if (node.kind === "array") {
            // 支持 JSON 格式回退
            if (value.match(/^JSON\[.+\]$/)) {
                let [_, text] = value.match(/^JSON(\[.+\])$/) || ["", "[]"];
                return JSON.parse(text);
            }
            if (value.match(/^\[.*\]$/)) {
                const text = value.slice(1, -1);
                if (!text.trim()) return [];
                // 用逗号分割，但跳过嵌套括号内的逗号
                const items = splitTopLevel(text, ",");
                return items.map(item => this.getValueByType(item.trim(), node.elem));
            }
            return [];
        }

        if (node.kind === "map") {
            // 支持 JSON 格式回退
            if (value.match(/^JSON\{.+\}$/)) {
                let [_, text] = value.match(/^JSON(\{.+\})$/) || ["", "{}"];
                return JSON.parse(text);
            }
            if (value.match(/^\{.*\}$/)) {
                const text = value.slice(1, -1);
                if (!text.trim()) return {};
                const pairs = splitTopLevel(text, ",");
                const map = {};
                for (const pair of pairs) {
                    const colonIdx = findTopLevelIndex(pair, ":");
                    if (colonIdx === -1) continue;
                    const rawKey = pair.slice(0, colonIdx).trim();
                    const rawVal = pair.slice(colonIdx + 1).trim();
                    const typedKey = this.getValueByType(rawKey, node.key);
                    const typedVal = this.getValueByType(rawVal, node.val);
                    map[typedKey] = typedVal;
                }
                return map;
            }
            return {};
        }

        return this.getValue(value, undefined);
    }

    // 原有值解析，处理 primitive 类型和无类型场景
    static getValue(value, type) {
        if (type == "string") {
            return this.doEscapeChar(value);
        } else if (type == "boolean" || type == "bool") {
            return value === "true" || value === "1";
        } else if (type == "number" || type == "int" || type == "float") {
            let num = Number(value);
            return isNaN(num) ? 0 : num;
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

    // 返回最近一次 csv2json 的类型元信息，供外部生成 .d.ts 使用
    static getLastTypeInfo() {
        return {
            typeName: this.typeName,
            varDescs: this.varDescs ? [...this.varDescs] : [],
            varNames: this.varNames ? [...this.varNames] : [],
            varTypes: this.varTypes ? [...this.varTypes] : [],
            parsedVarTypes: this.parsedVarTypes ? [...this.parsedVarTypes] : [],
            autoGenerate: this.autoGenerate,
            autoIndex: this.autoIndex,
        };
    }
}

// 按顶层分隔符拆分字符串（跳过嵌套的 [] {} <> 内部）
function splitTopLevel(str, sep) {
    const result = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "[" || c === "{" || c === "<") depth++;
        else if (c === "]" || c === "}" || c === ">") depth--;
        else if (c === sep && depth === 0) {
            result.push(str.slice(start, i));
            start = i + 1;
        }
    }
    result.push(str.slice(start));
    return result;
}

// 找到顶层第一个指定字符的位置
function findTopLevelIndex(str, ch) {
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "[" || c === "{" || c === "<") depth++;
        else if (c === "]" || c === "}" || c === ">") depth--;
        else if (c === ch && depth === 0) return i;
    }
    return -1;
}

exports.CsvMgr = CsvMgr;
