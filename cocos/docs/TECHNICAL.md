# AutoFitContainer — 技术文档

## 一、设计目标

在 Cocos Creator 3.x UI 系统中，节点的 `ContentSize` 通常由开发者或 Widget/Layout 手动管理。  
`AutoFitContainer` 的目标是：**让容器节点的 ContentSize（即 BoundingBox）始终自动包围其所有活跃子节点，且子节点的世界坐标不受影响。**

---

## 二、坐标系与 BoundingBox 基础

在 Cocos Creator 3.x 的 UI 系统中：

- 节点的本地坐标原点位于该节点的 **锚点（anchorPoint）** 处。
- 节点内容区（Content Area）的左下角 = `(-anchorX × width, -anchorY × height)`，右上角 = `((1-anchorX) × width, (1-anchorY) × height)`。
- `UITransform.getBoundingBox()` 返回节点在**父节点本地坐标系**下的轴对齐包围盒（AABB），已自动处理子节点自身的 position / rotation / scale / anchorPoint / contentSize。

---

## 三、核心算法

### 3.1 计算子节点 AABB

```
for each active child with UITransform:
    rect = child.getComponent(UITransform).getBoundingBox()
    minX = min(minX, rect.xMin)
    minY = min(minY, rect.yMin)
    maxX = max(maxX, rect.xMax)
    maxY = max(maxY, rect.yMax)

newW = maxX - minX
newH = maxY - minY
```

### 3.2 偏移量推导

容器新 ContentSize = `(newW, newH)`，锚点 `(ax, ay)` 不变。  
容器内容区左下角在本地坐标 = `(-ax·newW, -ay·newH)`。  
子节点 AABB 当前左下角 = `(minX, minY)`。

要使容器内容区**恰好**与子节点 AABB 对齐，需引入偏移：

```
shiftX = minX + ax · newW
shiftY = minY + ay · newH
```

### 3.3 三步应用（保证幂等性）

| 步骤 | 操作 | 目的 |
|------|------|------|
| 1 | 所有子节点本地坐标 `-= (shiftX, shiftY)` | 将子节点 AABB 对齐到容器内容区 |
| 2 | 容器 `setContentSize(newW, newH)` | 更新尺寸 |
| 3 | 容器父节点坐标 `+= (shiftX, shiftY)` | 抵消步骤 1 对子节点世界坐标的影响 |

**幂等性证明**：  
步骤 1 执行后，子节点 AABB 变为 `(-ax·newW, -ay·newH)` 到 `((1-ax)·newW, (1-ay)·newH)`，下次调用时 `minX = -ax·newW`，则 `shiftX = -ax·newW + ax·newW = 0`，算法不会再做任何修改。✓

### 3.4 EPS 守卫

为防止浮点误差导致每帧都触发无意义重算，当 `|shift| < 0.5` 且尺寸差 `< 0.5` 时直接跳过。

---

## 四、事件系统与脏标记

| 监听来源 | 监听事件 | 触发条件 |
|----------|----------|----------|
| 容器节点 | `CHILD_ADDED` | 添加子节点时绑定新子节点的事件 |
| 容器节点 | `CHILD_REMOVED` | 移除子节点时解绑 |
| 各子节点 | `TRANSFORM_CHANGED` | 子节点 position/rotation/scale 改变 |
| 各子节点 | `SIZE_CHANGED` | 子节点 contentSize 改变 |
| 各子节点 | `ANCHOR_CHANGED` | 子节点 anchorPoint 改变 |
| 各子节点 | `ACTIVE_IN_HIERARCHY_CHANGED` | 子节点 active 改变 |

所有事件仅设置脏标记 `_dirty = true`，实际计算在下一帧 `update()` 中执行（同帧多次事件只触发一次计算）。

**防循环机制**：  
步骤 1 中的 `setPosition` 会同步触发子节点的 `TRANSFORM_CHANGED`。  
通过 `_updating` 标志在执行期间屏蔽 `_markDirty`，避免无限循环。

---

## 五、与父节点 Layout / Widget 的兼容性

| 场景 | 行为 |
|------|------|
| 父节点有 `Layout` | Layout 监听容器的 SIZE_CHANGED，在下一帧重新排列容器位置。容器 ContentSize 变化后 Layout 自动响应。✓ |
| 父节点有 `Widget` | Widget 管理父节点自身的 size/position，不影响容器。✓ |
| **容器自身有 `Widget`** | ⚠️ Widget 会在 lateUpdate 覆盖 ContentSize，产生冲突，**不支持**。 |
| 子节点有 `Widget` | Widget 在容器 resize 后调整子节点位置，可能触发一次额外重算（因 `_updating` 保护，不会循环），轻微抖动通常可忽略。 |

---

## 六、编辑器模式（executeInEditMode）

- `@executeInEditMode` 使组件在 Cocos Creator 编辑器中同样执行 `onLoad` / `update`。
- 在编辑器中移动/缩放子节点时，事件驱动机制同样生效，容器实时更新。
- 编辑器帧率通常低于运行时，但不影响正确性。

---

## 七、性能特征

- **CPU**：脏标记设计保证每帧最多执行一次 `_doFit()`，且只在子节点实际变化时触发。
- **迭代**：`_doFit()` 对 N 个子节点是 O(N) 复杂度（一次遍历求 AABB + 一次遍历偏移）。
- **GC**：无动态分配（使用 `Rect` 返回值为临时对象，Cocos 内部有对象池）。

---

## 八、已知限制

1. 仅对直接子节点生效，不递归处理孙节点（孙节点的 AABB 已由 `getBoundingBox()` 展开到子节点层级）。
2. 容器节点本身不能带旋转或非均匀缩放（在父节点坐标系做的位移补偿仅为平移，不处理旋转/斜切）。
3. 容器自身挂载 `Widget` 时不支持。
