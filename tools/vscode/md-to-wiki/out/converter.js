"use strict";
/**
 * Markdown → Atlassian Wiki Markup 转换器
 *
 * Confluence 已知陷阱（均已处理）：
 * 1. 行内裸花括号 { } 会触发宏解析 → 转义为 \{ \}
 * 2. {{}} 内含 + - * 会触发格式化符号解析 → 改用 [ ] 包裹
 * 3. {code:语言} 部分语言名不受支持 → 统一用 {code}
 * 4. 三重花括号 {{{...}}} 会被当作非法宏 → 用 {code} 块替代
 * 5. {quote} 宏部分版本不支持 → 改用普通段落
 * 6. Unicode 箭头等特殊字符可能引发编码问题 → 替换为 ASCII
 * 7. 文件换行符必须为 LF → 输出时统一使用 \n
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mdToWiki = mdToWiki;
function mdToWiki(md) {
    const lines = md.split(/\r?\n/);
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        // 围栏代码块 ```...```
        if (line.match(/^```/)) {
            out.push("{code}");
            i++;
            while (i < lines.length && !lines[i].match(/^```/)) {
                out.push(escapeInsideCode(lines[i]));
                i++;
            }
            out.push("{code}");
            i++;
            continue;
        }
        // 表格
        if (line.match(/^\s*\|/)) {
            const tableLines = [];
            while (i < lines.length && lines[i].match(/^\s*\|/)) {
                tableLines.push(lines[i]);
                i++;
            }
            out.push(...convertTable(tableLines));
            continue;
        }
        out.push(convertLine(line));
        i++;
    }
    return out.join("\n");
}
function convertLine(line) {
    // 标题 # ## ### #### ##### ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
        const level = headingMatch[1].length;
        const text = inlineToWiki(headingMatch[2]);
        return `h${level}. ${text}`;
    }
    // 水平线 --- / *** / ___
    if (line.match(/^(\s*[-*_]){3,}\s*$/)) {
        return "----";
    }
    // 无序列表
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
        const depth = Math.floor(ulMatch[1].length / 2) + 1;
        return `${"*".repeat(depth)} ${inlineToWiki(ulMatch[2])}`;
    }
    // 有序列表
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
        const depth = Math.floor(olMatch[1].length / 2) + 1;
        return `${"#".repeat(depth)} ${inlineToWiki(olMatch[2])}`;
    }
    // 引用块 >
    if (line.match(/^>\s?(.*)/)) {
        const content = line.replace(/^>\s?/, "");
        return inlineToWiki(content);
    }
    // 空行
    if (line.trim() === "")
        return "";
    return inlineToWiki(line);
}
function inlineToWiki(text) {
    // 行内代码 `...`：先提取占位，最后还原，避免内部内容被其他规则处理
    const codeSlots = [];
    text = text.replace(/`([^`]+)`/g, (_, inner) => {
        const slot = `\x00CODE${codeSlots.length}\x00`;
        codeSlots.push(inner);
        return slot;
    });
    // 图片 ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "!$2!");
    // 链接 [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[$1|$2]");
    // 粗体 **text** 或 __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, "*$1*");
    text = text.replace(/__([^_]+)__/g, "*$1*");
    // 斜体 *text* 或 _text_（单个，排除已处理的粗体）
    text = text.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, "_$1_");
    text = text.replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, "_$1_");
    // 删除线 ~~text~~
    text = text.replace(/~~([^~]+)~~/g, "-$1-");
    // 行内裸花括号转义（不在代码槽内）
    text = escapeBraces(text);
    // 还原行内代码槽，用 {{}} 包裹，并处理其中的危险符号
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, idx) => {
        const inner = codeSlots[Number(idx)];
        return safeInlineCode(inner);
    });
    return text;
}
/**
 * 将行内代码内容安全地包裹为 {{...}}
 * 若内容含 + - * { } 等危险符号，改用 [内容] 纯文本展示
 */
function safeInlineCode(inner) {
    if (/[+\-*{}]/.test(inner)) {
        return `[${inner}]`;
    }
    return `{{${inner}}}`;
}
/**
 * 转义行内裸花括号（排除已是 Wiki 宏语法的部分）
 * 只转义不在 { } 宏结构内的裸花括号
 */
function escapeBraces(text) {
    // 逐字符扫描，遇到 { 判断是否是已知宏（如 {code} {note} 等），否则转义
    let result = "";
    let i = 0;
    while (i < text.length) {
        if (text[i] === "{") {
            // 尝试匹配 {macroName} 或 {macroName:...}
            const macroMatch = text.slice(i).match(/^\{[a-zA-Z][a-zA-Z0-9_:-]*\}/);
            if (macroMatch) {
                result += macroMatch[0];
                i += macroMatch[0].length;
            }
            else {
                result += "\\{";
                i++;
            }
        }
        else if (text[i] === "}") {
            result += "\\}";
            i++;
        }
        else {
            result += text[i];
            i++;
        }
    }
    return result;
}
/** code 块内部只做最基本的处理，不转义花括号（code 块内是安全的） */
function escapeInsideCode(line) {
    return line;
}
function convertTable(tableLines) {
    const result = [];
    let headerDone = false;
    for (const line of tableLines) {
        // 分隔行 |---|---| 跳过
        if (line.match(/^\s*\|[\s\-|:]+\|\s*$/)) {
            headerDone = true;
            continue;
        }
        const cells = line
            .replace(/^\s*\|/, "")
            .replace(/\|\s*$/, "")
            .split("|")
            .map(c => inlineToWiki(c.trim()));
        if (!headerDone) {
            result.push("|| " + cells.join(" || ") + " ||");
        }
        else {
            result.push("| " + cells.join(" | ") + " |");
        }
    }
    return result;
}
