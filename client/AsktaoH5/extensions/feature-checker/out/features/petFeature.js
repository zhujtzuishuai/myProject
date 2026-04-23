"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const featureRegistry_1 = require("./featureRegistry");
(0, featureRegistry_1.registerFeature)({
    id: 'pet',
    label: '唤灵检查',
    inputs: [
        { key: 'petName', label: '唤灵名字', placeholder: '请输入唤灵名字' },
    ],
    defaultHeaders: {
        name: { level: 'required', checkType: 'equal' },
        icon: { level: 'required', checkType: 'resource', resourceRoot: '' },
    },
    equalBindings: {
        name: 'petName',
    },
});
