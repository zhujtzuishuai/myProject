# Cocos Creator 3.8.6 引擎层自动多纹理合批

> 目标：在引擎处理渲染节点时，对满足条件的节点自动进行多纹理合批，无需手动配置每个 Sprite。

---

## 核心思路

```
普通合批：  [Sprite A tex0] [Sprite B tex1] → 2 draw call（tex 不同，打断）
多纹理合批：[Sprite A tex0] [Sprite B tex1] → 1 draw call（tex0→slot0, tex1→slot1）
```

用 sampler 数组替代单 sampler，在顶点数据中写入纹理槽索引，让 Batcher2D 在纹理不同时不打断批次，而是分配新槽位。

---

## 三个关键改动

### 1. 多纹理 Effect（Shader）

新建 `multi-texture-sprite.effect`：

```glsl
CCProgram sprite-vs %{
  precision highp float;
  #include <builtin/uniforms/cc-global>

  in vec3 a_position;
  in vec2 a_texCoord;
  in vec4 a_color;
  in float a_texIndex;   // 纹理槽索引，由 assembler 写入顶点

  out vec2 v_uv0;
  out vec4 v_color;
  out float v_texIndex;

  vec4 vert () {
    v_uv0      = a_texCoord;
    v_color    = a_color;
    v_texIndex = a_texIndex;
    return cc_matViewProj * vec4(a_position, 1.0);
  }
}%

CCProgram sprite-fs %{
  precision highp float;

  in vec2 v_uv0;
  in vec4 v_color;
  in float v_texIndex;

  // 最多 8 个槽，受 GPU 硬件限制（移动端通常 8~16）
  uniform sampler2D textures[8];

  vec4 frag () {
    int idx = int(v_texIndex + 0.5);
    vec4 c;
    // GLSL ES 不支持动态索引 sampler 数组，必须用 if-else 展开
    if      (idx == 0) c = texture(textures[0], v_uv0);
    else if (idx == 1) c = texture(textures[1], v_uv0);
    else if (idx == 2) c = texture(textures[2], v_uv0);
    else if (idx == 3) c = texture(textures[3], v_uv0);
    else if (idx == 4) c = texture(textures[4], v_uv0);
    else if (idx == 5) c = texture(textures[5], v_uv0);
    else if (idx == 6) c = texture(textures[6], v_uv0);
    else               c = texture(textures[7], v_uv0);
    return c * v_color;
  }
}%
```

---

### 2. 改造 Batcher2D（引擎层核心）

合批决策在 `cocos/2d/renderer/batcher-2d.ts` 的 `commitComp` 方法。
通过 monkey-patch 在运行时注入，避免直接改引擎源码：

```typescript
// MultiTexBatchPatcher.ts  —  在游戏启动时执行一次
import { director, gfx, Material, Texture2D } from 'cc';

const MAX_SLOTS = 8;

export function patchBatcher2D() {
    const batcher = (director.root as any).batcher2D;
    if (!batcher || batcher.__multiTexPatched) return;

    let slotMap: Map<Texture2D, number> = new Map();
    let slotList: Texture2D[] = [];

    const origCommitComp = batcher.commitComp.bind(batcher);

    batcher.commitComp = function(
        comp: any, renderData: any, frame: any, assembler: any, transform: any
    ) {
        const tex: Texture2D = frame?.texture ?? frame;

        if (tex) {
            if (!slotMap.has(tex)) {
                if (slotList.length >= MAX_SLOTS) {
                    // 槽满，先 flush 当前批次
                    this.autoMergeBatches(comp);
                    slotMap.clear();
                    slotList = [];
                }
                slotMap.set(tex, slotList.length);
                slotList.push(tex);
            }
            // 把槽索引写入 renderData，供 assembler 填充顶点
            renderData.__texSlot = slotMap.get(tex)!;
        }

        origCommitComp(comp, renderData, frame, assembler, transform);
    };

    // flush 前把所有槽位纹理绑定到 material
    const origMerge = batcher.autoMergeBatches.bind(batcher);
    batcher.autoMergeBatches = function(comp?: any) {
        if (slotList.length > 0 && this._currMaterial) {
            const pass = this._currMaterial.passes[0];
            slotList.forEach((tex, i) => {
                pass.setTextureView(`textures[${i}]`, tex.getGFXTextureView()!);
                pass.setSampler(`textures[${i}]`, tex.getGFXSampler()!);
            });
        }
        origMerge(comp);
        slotMap.clear();
        slotList = [];
    };

    batcher.__multiTexPatched = true;
}
```

---

### 3. 自定义顶点格式 + Assembler

```typescript
import { gfx, RenderData, UIRenderer } from 'cc';

const vfmtMultiTex = [
    new gfx.Attribute('a_position',  gfx.Format.RGB32F),
    new gfx.Attribute('a_texCoord',  gfx.Format.RG32F),
    new gfx.Attribute('a_color',     gfx.Format.RGBA32F),
    new gfx.Attribute('a_texIndex',  gfx.Format.R32F),   // 新增
];

// 在自定义 Assembler 的 fillBuffers 中写入槽索引
fillBuffers(comp: UIRenderer, renderer: any) {
    const renderData = comp.renderData!;
    const texSlot: number = (renderData as any).__texSlot ?? 0;
    const vb = renderData.chunk.vb;
    const stride = renderData.floatStride;

    for (let i = 0; i < 4; i++) {
        vb[i * stride + (stride - 1)] = texSlot;
    }
    // 其余顶点数据正常填充
}
```

---

### 4. 自动应用到所有 Sprite

```typescript
import { Sprite, Material, Node } from 'cc';

export function applyMultiTexMaterial(rootNode: Node, mat: Material) {
    rootNode.getComponentsInChildren(Sprite).forEach(sp => {
        sp.customMaterial = mat;
    });
}
```

---

## 关键限制

| 问题 | 说明 |
|---|---|
| GLSL 动态索引 | GLSL ES 不允许用变量索引 sampler 数组，必须 if-else 展开，槽数越多 shader 越大 |
| 移动端槽数上限 | `gl_MaxTextureImageUnits` 通常 8~16，建议不超过 8 |
| Mask/Graphics 打断 | 这两个组件无法参与任何合批，遇到它们必须 flush |
| 层级顺序 | 参与合批的节点在节点树中必须连续 |
| 引擎升级风险 | monkey-patch 依赖 `batcher2D` 内部字段名，引擎小版本更新可能失效 |

---

## 与 Dynamic Atlas 的对比

| 方案 | 适用场景 | 维护成本 |
|---|---|---|
| Dynamic Atlas（官方） | 小图、可合图的场景 | 低，官方维护 |
| 多纹理合批（本方案） | 大图、头像、地图块等无法合图的场景 | 高，需跟随引擎版本维护 |

---

## 参考资料

- [Cocos 3.8 合批规则文档](https://docs.cocos.com/creator/manual/en/ui-system/components/engine/ui-batch.html)
- [CocosCreator3.x UI Sprite shader 合批（自定义顶点参数）](https://www.cnblogs.com/bakabird/p/17789258.html)
- [cocos-engine GitHub](https://github.com/cocos/cocos-engine)
