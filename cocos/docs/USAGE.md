# AutoFitContainer — 使用文档

## 快速上手

### 1. 导入脚本

将 `AutoFitContainer.ts` 复制到 Cocos Creator 项目的 `assets/scripts/` 目录中（或任意脚本目录，确保能被 Cocos 识别）。

### 2. 挂载组件

在编辑器中选中**容器节点**，在 Inspector 面板点击 **Add Component**，搜索 `AutoFitContainer` 并添加。

或在代码中动态添加：
```typescript
import { AutoFitContainer } from './components/AutoFitContainer';
containerNode.addComponent(AutoFitContainer);
```

### 3. 添加子节点

正常在容器节点下添加子节点（子节点必须挂载 `UITransform` 组件）。  
容器会在编辑器中实时或运行时启动后自动包围所有子节点。

---

## 配置说明

`AutoFitContainer` **没有可配置属性**，行为完全自动。  
影响结果的关键因素：

| 因素 | 说明 |
|------|------|
| 容器锚点 | 锚点不变，容器以锚点为中心对称或非对称扩展 |
| 子节点 active | 非活跃子节点不计入包围盒 |
| 子节点 UITransform | 无 UITransform 的子节点不计入包围盒 |

---

## 常见场景

### 场景 1：气泡提示框随文字长度自适应

```
Canvas
└── BubbleContainer  ← 挂载 AutoFitContainer，anchor (0.5, 0)
    ├── Background   ← 九宫格背景（随容器 size 拉伸）
    └── Label        ← 文字内容
```

Label 内容变化 → Label 的 ContentSize 变化 → AutoFitContainer 自动扩展 BubbleContainer。

### 场景 2：动态列表容器

```
Canvas
└── ListContainer  ← AutoFitContainer，anchor (0, 1)（左上角固定）
    ├── Item0
    ├── Item1
    └── Item2（动态增删）
```

增删 Item 时，ListContainer 自动缩放。

### 场景 3：容器在 Layout 内

```
Canvas
└── HorizontalLayout（挂载 Layout 组件，ResizeMode = Container）
    ├── Card0  ← AutoFitContainer（内含不同高度图标）
    ├── Card1  ← AutoFitContainer
    └── Card2  ← AutoFitContainer
```

每个 Card 的高度由其内容决定，HorizontalLayout 自动排列。

---

## API

### `forceUpdate(): void`

立即同步执行一次适配计算，无需等待下一帧。  
适用于在代码中动态添加子节点后需要立即获取容器正确尺寸的场景：

```typescript
const container = node.addComponent(AutoFitContainer);
const child = makeChildNode();
node.addChild(child);
// 此时 container 尚未执行 update，如需立即读取正确尺寸：
container.forceUpdate();
const size = node.getComponent(UITransform)!.contentSize;
console.log(size); // 已包围子节点的正确尺寸
```

---

## 注意事项

1. **子节点必须有 UITransform**：没有 UITransform 的节点会被跳过（不影响计算，但也不计入包围盒）。
2. **不要在容器自身挂载 Widget**：Widget 会在 lateUpdate 覆盖 ContentSize，与本组件冲突。
3. **九宫格背景的尺寸跟随**：如果背景 Sprite 使用 Sliced 模式且 UITransform 跟随容器（即背景是容器的直接子节点），其尺寸需通过代码或 Widget 绑定到容器，否则背景不会自动拉伸。

   推荐做法：将背景节点的 UITransform 尺寸用代码同步到容器，或者用 Widget 让背景拉满容器：
   ```
   背景节点挂载 Widget：Top=0, Bottom=0, Left=0, Right=0
   ```

4. **性能**：子节点数量极多（>500）时，每帧 O(N) 遍历可能产生 CPU 开销，可通过减少触发频率（节流）优化。
5. **编辑器中的行为**：添加组件后如果容器未立即更新，在 Inspector 中切换其他节点再切回即可触发刷新（或直接运行场景）。

---

## 测试场景使用说明

项目内附 `AutoFitContainerTest.ts`，包含 4 个测试案例：

| 案例 | 内容 | 验证方式 |
|------|------|----------|
| Case 1 | 3 个静态子节点，不同锚点 | 红色边框完整包围所有色块 |
| Case 2 | 1 个子节点做 tween 动画 | 红色边框实时跟随移动子节点 |
| Case 3 | 按空格键切换子节点 active | 边框随子节点消失/出现而缩减/扩展 |
| Case 4 | 容器放在横向 Layout 内 | Layout 根据每个容器的实际尺寸自动排列 |

**搭建步骤：**
1. 新建 Cocos Creator 3.8.6 项目（或打开 `C:\myProject\cocos` 目录）。
2. 确认 `assets/scripts/components/AutoFitContainer.ts` 和 `assets/scripts/AutoFitContainerTest.ts` 已存在。
3. 新建场景，在 Canvas 下创建空节点 `TestRoot`。
4. 将 `AutoFitContainerTest` 脚本挂载到 `TestRoot`。
5. 点击运行（`Ctrl+P`），四个测试案例自动生成。
