"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFeature = registerFeature;
exports.getFeature = getFeature;
exports.getAllFeatures = getAllFeatures;
const _registry = new Map();
function registerFeature(def) {
    _registry.set(def.id, def);
}
function getFeature(id) {
    return _registry.get(id);
}
function getAllFeatures() {
    return Array.from(_registry.values());
}
