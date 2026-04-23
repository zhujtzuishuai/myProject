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
exports.runPipeline = runPipeline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const resMgrParser_1 = require("./resMgrParser");
const csvParser_1 = require("./csvParser");
function runPipeline(input) {
    const { workspaceRoot, resMgrFile, feature, inputs } = input;
    const warnings = [];
    const steps = [];
    for (const step of feature.steps) {
        try {
            const result = runStep(step, workspaceRoot, resMgrFile, inputs);
            steps.push(result);
        }
        catch (e) {
            steps.push({ id: step.id, label: step.label, status: 'fail', required: step.required, message: `执行出错: ${e.message}` });
        }
    }
    return { steps, warnings };
}
function interpolate(template, inputs) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => { var _a; return (_a = inputs[key]) !== null && _a !== void 0 ? _a : `{{${key}}}`; });
}
function runStep(step, root, resMgrFile, inputs) {
    var _a, _b, _c;
    const base = { id: step.id, label: step.label, required: step.required };
    switch (step.type) {
        case 'fileExists': {
            const resolved = path.resolve(root, interpolate(step.pathTemplate, inputs));
            const exists = fs.existsSync(resolved);
            return { ...base, status: exists ? 'pass' : 'fail', message: exists ? undefined : `文件不存在: ${resolved}` };
        }
        case 'resMgrKey': {
            const key = interpolate(step.keyTemplate, inputs);
            const absResMgr = path.resolve(root, resMgrFile);
            const map = (0, resMgrParser_1.parseResMgrModule)(absResMgr, step.modulePath || 'ui');
            const exists = key in map;
            return { ...base, status: exists ? 'pass' : 'fail', message: exists ? undefined : `ResMgr.${step.modulePath || 'ui'} 中不存在 key "${key}"` };
        }
        case 'csvField': {
            const absCSV = path.resolve(root, step.csvPath);
            const parsed = (0, csvParser_1.parseCsv)(absCSV);
            const filterVal = (_a = inputs[step.filterValueKey]) !== null && _a !== void 0 ? _a : '';
            const row = parsed.rows.find(r => r[step.filterField] === filterVal);
            if (!row) {
                return { ...base, status: 'fail', message: `CSV 中未找到 ${step.filterField}="${filterVal}" 的行` };
            }
            const val = (_b = row[step.checkField]) !== null && _b !== void 0 ? _b : '';
            return { ...base, status: val ? 'pass' : 'fail', message: val ? undefined : `字段 "${step.checkField}" 为空` };
        }
        case 'charResource': {
            const id = (_c = inputs[step.idKey]) !== null && _c !== void 0 ? _c : '';
            const padded = id.padStart(4, '0');
            const missing = [];
            const checks = [
                path.join(root, 'assets', 'rawChar', 'char', `0${padded}`),
                path.join(root, 'assets', 'raw', 'portraits', 'big', `0${padded}_01_b.png`),
                path.join(root, 'assets', 'raw', 'portraits', 'small', `0${padded}_01_s.png`),
            ];
            for (const p of checks) {
                if (!fs.existsSync(p)) {
                    missing.push(p);
                }
            }
            return { ...base, status: missing.length === 0 ? 'pass' : 'fail', message: missing.length ? `缺失资源:\n${missing.join('\n')}` : undefined };
        }
    }
}
