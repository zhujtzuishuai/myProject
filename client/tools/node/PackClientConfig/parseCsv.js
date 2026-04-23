"use strict";
Object.defineProperty(exports, "__esModule", { value: true});
exports.csvMgr = void 0;
const path = require("path");
const fs = require("fs");

const SPACE_CHAR = ";";
const DIRECTIVE_AUTO_INDEX = "# autoIndex";
const DIRECTIVE_GEN_TYPE = "# genType";

function pathExists(p) {
    try {
        fs.accessSync(p);
    } catch (err) {
        return false;
    }
    return true;
}


/**
 * 将类型字符串解析为类型 AST
 * 支持：string | number | boolean
 *       T[]  (数组，可嵌套)
 *       Record<K,V>  (可嵌套)
 * 返回：
 *   { type: 'primitive', name: string }
 *   { type: 'array', elem: TypeNode }
 *   { type: 'record', key: TypeNode, val: TypeNode }
 */
function parseType(str) {
    str = str ? str.trim() : "";
    if (!str) return { type: "primitive", name: "" };

    // Record<K,V>
    if (str.startsWith("Record<") && str.endsWith(">")) {
        const inner = str.slice(7, -1);
        let depth = 0;
        let splitIdx = -1;
        for (let i = 0; i < inner.length; i++) {
            if (inner[i] === "<") depth++;
            else if (inner[i] === ">") depth--;
            else if (inner[i] === "," && depth === 0) { splitIdx = i; break; }
        }
        if (splitIdx === -1) return { type: "primitive", name: str };
        return {
            type: "record",
            key: parseType(inner.slice(0, splitIdx)),
            val: parseType(inner.slice(splitIdx + 1)),
        };
    }

    // T[]（可多层，如 number[][]）
    if (str.endsWith("[]")) {
        return { type: "array", elem: parseType(str.slice(0, -2)) };
    }

    // 基础类型
    return { type: "primitive", name: str };
}

/** 检查类型字符串是否合法（递归验证 AST） */
function isValidType(str) {
    const node = parseType(str);
    return isValidTypeNode(node);
}

function isValidTypeNode(node) {
    if (!node) return false;
    if (node.type === "array") return isValidTypeNode(node.elem);
    if (node.type === "record") return isValidTypeNode(node.key) && isValidTypeNode(node.val);
    // primitive：只接受已知的 TS 基础类型
    return node.name === "string" || node.name === "number" || node.name === "boolean";
}

/** 将类型 AST 转为 TypeScript 类型字符串 */
function typeNodeToTs(node) {
    if (!node) return "any";
    if (node.type === "array") return `${typeNodeToTs(node.elem)}[]`;
    if (node.type === "record") return `Record<${typeNodeToTs(node.key)}, ${typeNodeToTs(node.val)}>`;
    return node.name || "any";
}

exports.parseType = parseType;
exports.typeNodeToTs = typeNodeToTs;

class CsvMgr {
    /**
     * 批量解析目录下所有 CSV 文件，结果写入 map
     * @param {string} rootPath - CSV 文件目录
     * @param {Object} map - 输出 map，key 格式为 "cfg/文件名"
     */
    static csv2jsonByDir(rootPath, map) {
        const tempDir = path.join(rootPath, ".temp");
        if (!pathExists(tempDir)) fs.mkdirSync(tempDir);
        for (const child of fs.readdirSync(rootPath).sort()) {
            if (!child.match(/\w.csv$/)) continue;
            const key = child.replace(".csv", "");
            const content = CsvMgr.csv2json(child, rootPath);
            map["cfg/" + key] = content;
            fs.writeFileSync(path.join(tempDir, key + ".json"), JSON.stringify(content));
        }
    }

    /**
     * 解析单个 CSV 文件为 JSON
     * @param {string} file - 文件名（含 .csv 后缀）
     * @param {string} rootPath - 所在目录
     * @returns {Object|Array} 解析结果
     */
    static csv2json(file, rootPath) {
        this.rootPath = rootPath;
        this.csvFile = file;
        const [_, fileName] = file.match("(.+).csv") || [null, null];
        if (!fileName) return;
        try {
            const lines = this.getCsvLines(path.join(rootPath, file));
            this.analysisHeader(lines);
            const map = {};
            this.propType = {};
            this.analysisData(lines, this.genType ? 3 : 2, map, 0);
            return this.changeToArray(map);
        } catch (e) {
            console.error(`[ParseCsv] 解析失败: ${file} — ${e.message}`);
            throw e;
        }
    }

    /**
     * 读取 CSV 文件，处理指令行，返回二维字符串数组。
     * 使用状态机解析：支持引号包裹的字段（字段内可含分隔符 SPACE_CHAR）。
     * @param {string} filePath - 文件路径
     * @returns {string[][]}
     */
    static getCsvLines(filePath) {
        const text = fs.readFileSync(filePath).toString();

        // 按行拆分，提取并移除指令行（# autoIndex / # genType / # typeName=）
        this.autoIndex = false;
        this.genType = false;
        this.typeName = null;
        const rawLines = text.trim().split("\n");
        for (let i = rawLines.length - 1; i >= 0; i--) {
            const line = rawLines[i].trimEnd();
            if (line.startsWith("# ")) {
                if (line.startsWith(DIRECTIVE_AUTO_INDEX)) this.autoIndex = true;
                if (line.startsWith(DIRECTIVE_GEN_TYPE)) this.genType = true;
                const m = line.match(/^# typeName=(.+)/);
                if (m) this.typeName = m[1].trim();
                rawLines.splice(i, 1);
            }
        }

        // 状态机解析 CSV：SPACE_CHAR 为列分隔符，双引号包裹的字段可含分隔符
        const lines = [];
        let line = [];
        let field = "";
        let inQuote = false;
        const src = rawLines.join("\n");

        for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (inQuote) {
                if (ch === '"') inQuote = false;
                else field += ch;
            } else if (ch === '"') {
                inQuote = true;
            } else if (ch === SPACE_CHAR) {
                line.push(field);
                field = "";
            } else if (ch === "\r") {
                // 跳过 CR（兼容 CRLF）
            } else if (ch === "\n") {
                line.push(field);
                field = "";
                lines.push(line);
                line = [];
            } else {
                field += ch;
            }
        }
        // 推入最后一行
        line.push(field);
        lines.push(line);

        return lines;
    }

    /**
     * 解析 CSV 前三行（描述行、字段名行、可选类型行），初始化列元信息
     * @param {string[][]} lines
     */
    static analysisHeader(lines) {
        this.varDescs = lines[0];
        this.varNames = lines[1];
        this.colKey = undefined;
        this.excludeColKey = false;
        this.groupKey = undefined;
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
            [_, key] = this.varNames[i].match(/(.+)\*/) || [null];
            if (key) {
                this.varNames[i] = key;
                this.groupKey = key;
                break;
            }
        }
        if (this.genType) {
            const typeRow = lines[2];
            const isValidTypeRow = typeRow && typeRow.some(t => t && t.trim()) &&
                typeRow.filter(t => t && t.trim()).every(t => isValidType(t.trim()));
            if (!isValidTypeRow) {
                throw new Error(
                    `[ParseCsv] ${this.csvFile} 声明了 # genType 但缺少有效的类型行（第3行），` +
                    `支持的类型：string | number | boolean | T[] | Record<K,V>`
                );
            }
            this.varTypes = typeRow;
        } else {
            this.varTypes = [];
        }
        this.parsedVarTypes = this.varTypes.map(t => parseType(t ? t.trim() : ""));
        this.defaults = [];
        // 动态收集可选列：读数据行时若某列出现空值则标记为可选
        this.optionalCols = new Set();
    }

    static changeToArray(map) {
        const keys = [];
        for (const key in map) {
            const num = Number(key);
            if (isNaN(num)) return map;
            keys.push(num);
        }
        keys.sort((l, r) => l - r);
        if (keys[0] !== 0) return map;
        for (let i = 1; i < keys.length; i++) {
            if (keys[i] - keys[i - 1] !== 1) return map;
        }
        return keys.map(k => map[k]);
    }

    static analysisData(lines, index, map, dep) {
        if (!lines[index]) return index;
        let count = 0;
        let i = index;
        for (; i < lines.length; i++) {
            const firstCell = lines[i][0];
            if (firstCell.match(/^\$#/)) {
                break;
            } else if (firstCell.match(/^\$.+/)) {
                const [_, prefix, key] = firstCell.match(/^(\$+)(.+)/) || [];
                if (prefix.length <= dep) { i--; break; }
                if (key) {
                    map[key] = {};
                    i = this.analysisData(lines, i + 1, map[key], dep + 1);
                    map[key] = this.changeToArray(map[key]);
                }
            } else {
                // 记录当前行号，供类型错误报告使用
                this._currentRow = i + 1;
                const info = {};
                for (let j = 0; j < lines[i].length; j++) {
                    let value = lines[i][j];
                    if (value.length === 0) {
                        // 该列出现空值，标记为可选列（仅顶层数据行）
                        if (dep === 0 && this.varNames[j] && this.varNames[j].length > 0) {
                            this.optionalCols.add(j);
                        }
                        if (this.defaults[j]) value = this.defaults[j];
                        else continue;
                    }
                    const parsedType = this.parsedVarTypes ? this.parsedVarTypes[j] : null;
                    const colName = (this.varNames[j] && this.varNames[j].length > 0) ? this.varNames[j] : `第${j + 1}列`;
                    value = this.getValueByType(value, parsedType, colName);
                    if (!this.varNames[j] || this.varNames[j].length === 0) {
                        info[j] = value;
                    } else {
                        const key = this.getKey(this.varNames[j]);
                        if (key) info[key] = value;
                    }
                }
                if (dep === 0 && this.autoIndex) info.index = i - index;
                if (this.groupKey) {
                    const groupVal = info[this.groupKey];
                    if (groupVal !== undefined) {
                        if (!map[groupVal]) map[groupVal] = [];
                        map[groupVal].push(info);
                    }
                } else if (this.colKey) {
                    const key = this.getKey(this.colKey);
                    if (this.varNames.length === 2 && this.excludeColKey && !this.autoIndex) {
                        let value;
                        for (const k in info) {
                            if (k !== this.colKey) { value = info[k]; break; }
                        }
                        map[info[key]] = value;
                    } else {
                        map[info[key]] = info;
                        if (this.excludeColKey) delete info[key];
                    }
                } else {
                    map[count++] = info;
                }
            }
        }
        return i;
    }

    static doEscapeChar(text) {
        const args = text.split("\\");
        for (let i = 1; i < args.length; i++) {
            if (args[i][0] === "n") args[i] = "\n" + args[i].substring(1);
            else args[i] = "\\" + args[i];
        }
        return args.join("");
    }

    /** 抛出类型不匹配异常，携带文件名和行号 */
    static _throwTypeError(value, expectedType, colName) {
        const col = colName ? `列 "${colName}"` : "未知列";
        throw new TypeError(
            `[ParseCsv] 类型不匹配：${col} 期望 ${expectedType}，实际值为 "${value}"` +
            `（文件: ${this.csvFile}, 第 ${this._currentRow} 行）`
        );
    }

    /**
     * 根据解析后的类型 AST 递归转换值，类型不匹配时抛出异常
     * @param {string} value - 原始字符串值
     * @param {Object} node - 类型 AST 节点
     * @param {string} [colName] - 列名，用于错误提示
     */
    static getValueByType(value, node, colName) {
        if (!node || node.type === "primitive") {
            return this.getValue(value, node ? node.name : undefined, colName);
        }

        if (node.type === "array") {
            if (value.match(/^JSON\[.+\]$/)) {
                const [_, text] = value.match(/^JSON(\[.+\])$/) || ["", "[]"];
                return JSON.parse(text);
            }
            if (value.match(/^\[.*\]$/)) {
                const text = value.slice(1, -1);
                if (!text.trim()) return [];
                return splitTopLevel(text, ",").map(item => this.getValueByType(item.trim(), node.elem, colName));
            }
            // 有值但格式不符合数组格式
            this._throwTypeError(value, typeNodeToTs(node), colName);
        }

        if (node.type === "record") {
            if (value.match(/^JSON\{.+\}$/)) {
                const [_, text] = value.match(/^JSON(\{.+\})$/) || ["", "{}"];
                return JSON.parse(text);
            }
            if (value.match(/^\{.*\}$/)) {
                const text = value.slice(1, -1);
                if (!text.trim()) return {};
                const result = {};
                for (const pair of splitTopLevel(text, ",")) {
                    const colonIdx = findTopLevelIndex(pair, ":");
                    if (colonIdx === -1) continue;
                    const typedKey = this.getValueByType(pair.slice(0, colonIdx).trim(), node.key, colName);
                    const typedVal = this.getValueByType(pair.slice(colonIdx + 1).trim(), node.val, colName);
                    result[typedKey] = typedVal;
                }
                return result;
            }
            // 有值但格式不符合 map 格式
            this._throwTypeError(value, typeNodeToTs(node), colName);
        }

        return this.getValue(value, undefined, colName);
    }

    // 原有值解析，处理 primitive 类型和无类型场景
    static getValue(value, type, colName) {
        if (type === "string") {
            return this.doEscapeChar(value);
        }
        if (type === "boolean") {
            if (value !== "true" && value !== "false" && value !== "1" && value !== "0") {
                this._throwTypeError(value, "boolean", colName);
            }
            return value === "true" || value === "1";
        }
        if (type === "number") {
            const num = Number(value);
            if (isNaN(num)) this._throwTypeError(value, type, colName);
            return num;
        }
        // 无类型声明时走自动推断，不做强校验
        if (value.match(/^\[.+\]$/)) {
            const [_, text] = value.match(/^\[(.+)\]$/) || ["", ""];
            return text.split(",").map(v => {
                const num = Number(v);
                return v !== "" && !isNaN(num) ? num : this.doEscapeChar(v);
            });
        }
        if (value.match(/^JSON[{[].+[}]$/)) {
            const [_, text] = value.match(/^JSON([{[].+[}])$/) || ["", ""];
            return JSON.parse(text);
        }
        if (value.match(/^{.+}$/)) {
            const [_, text] = value.match(/^{(.+)}$/) || ["", ""];
            const map = {};
            let index = 0;
            for (const part of text.split(",")) {
                const keys = part.split(":");
                if (keys.length === 1) map[index++] = keys[0];
                else map[keys[0]] = keys[1];
            }
            return map;
        }
        const num = Number(value);
        return value !== "" && !isNaN(num) ? num : this.doEscapeChar(value);
    }

    static getKey(key) {
        const num = Number(key);
        if (num || num === 0) return num;
        return key;
    }

    /** 返回最近一次 csv2json 的类型元信息，供外部生成 .d.ts 使用 */
    static getLastTypeInfo() {
        return {
            typeName: this.typeName,
            varDescs: this.varDescs ? [...this.varDescs] : [],
            varNames: this.varNames ? [...this.varNames] : [],
            varTypes: this.varTypes ? [...this.varTypes] : [],
            parsedVarTypes: this.parsedVarTypes ? [...this.parsedVarTypes] : [],
            genType: this.genType,
            autoIndex: this.autoIndex,
            groupKey: this.groupKey,
            // 出现过空值的列索引集合，生成 .d.ts 时标记为可选字段
            optionalCols: this.optionalCols ? new Set(this.optionalCols) : new Set(),
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
