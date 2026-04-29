import { _decorator, Component, Node, UITransform, Rect, Layout, Widget } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, executeInEditMode, disallowMultiple, property } = _decorator;

/**
 * AutoFitContainerV2
 *
 * 在 AutoFitContainer 的基础上新增：
 *  - 四边 Padding（paddingLeft / paddingRight / paddingTop / paddingBottom）
 *  - 轴向开关（fitHorizontal / fitVertical），可单独只适配宽或高
 *  - 最小尺寸约束（minWidth / minHeight）
 *
 * 原有行为：
 *  - 动态将容器节点的 ContentSize 调整为恰好包围所有活跃子节点的最小矩形（含 Padding）。
 *  - 锚点（anchorPoint）保持不变。
 *  - 子节点的世界坐标不变；内部通过等量平移子节点本地坐标
 *    和容器父节点坐标来保持视觉位置不变。
 *  - 编辑器（executeInEditMode）与运行时均实时生效。
 *  - 子节点的 position / rotation / scale / size / anchor / active
 *    发生变化时自动触发重算（下一帧执行，同帧多次变化只算一次）。
 *  - Inspector 中修改任意属性后立即重算（setter 触发）。
 *
 * 限制：
 *  - 容器节点本身不能挂载 Layout 组件（两者均修改子节点位置，行为冲突）。
 *  - 容器节点本身不能挂载 Widget 组件（Widget 会覆盖本组件对 ContentSize 的修改）。
 *  - 上述冲突在编辑器模式下每帧检测（无论挂载顺序），检测到时输出 console.error
 *    并跳过本帧适配；冲突解除后自动恢复。
 *  - 子节点若挂载了 Widget 组件，可能与本组件产生轻微抖动，通常可忽略。
 */
@ccclass('AutoFitContainerV2')
@executeInEditMode
@disallowMultiple
export class AutoFitContainerV2 extends Component {

    // ─── Inspector 属性 ───────────────────────────────────────────────────────

    @property
    private _fitHorizontal = true;
    /** 启用后根据子节点宽度自动调整容器宽度 */
    @property({ displayName: '适配水平方向' })
    get fitHorizontal(): boolean { return this._fitHorizontal; }
    set fitHorizontal(v: boolean) { this._fitHorizontal = v; this._markDirty(); }

    @property
    private _fitVertical = true;
    /** 启用后根据子节点高度自动调整容器高度 */
    @property({ displayName: '适配垂直方向' })
    get fitVertical(): boolean { return this._fitVertical; }
    set fitVertical(v: boolean) { this._fitVertical = v; this._markDirty(); }

    @property
    private _paddingLeft = 0;
    /** 容器内容区左侧留白 */
    @property({ displayName: '左边距', min: 0 })
    get paddingLeft(): number { return this._paddingLeft; }
    set paddingLeft(v: number) { this._paddingLeft = v; this._markDirty(); }

    @property
    private _paddingRight = 0;
    /** 容器内容区右侧留白 */
    @property({ displayName: '右边距', min: 0 })
    get paddingRight(): number { return this._paddingRight; }
    set paddingRight(v: number) { this._paddingRight = v; this._markDirty(); }

    @property
    private _paddingTop = 0;
    /** 容器内容区上方留白 */
    @property({ displayName: '上边距', min: 0 })
    get paddingTop(): number { return this._paddingTop; }
    set paddingTop(v: number) { this._paddingTop = v; this._markDirty(); }

    @property
    private _paddingBottom = 0;
    /** 容器内容区下方留白 */
    @property({ displayName: '下边距', min: 0 })
    get paddingBottom(): number { return this._paddingBottom; }
    set paddingBottom(v: number) { this._paddingBottom = v; this._markDirty(); }

    @property
    private _minWidth = 0;
    /** 容器宽度下限，0 表示不限制 */
    @property({ displayName: '最小宽度', min: 0 })
    get minWidth(): number { return this._minWidth; }
    set minWidth(v: number) { this._minWidth = v; this._markDirty(); }

    @property
    private _minHeight = 0;
    /** 容器高度下限，0 表示不限制 */
    @property({ displayName: '最小高度', min: 0 })
    get minHeight(): number { return this._minHeight; }
    set minHeight(v: number) { this._minHeight = v; this._markDirty(); }

    // ─── 私有状态 ─────────────────────────────────────────────────────────────

    /** 下一帧需要重新计算 */
    private _dirty = false;
    /**
     * 正在执行自身更新，屏蔽由更新触发的子节点事件，防止循环调用。
     * 原因：步骤 1 中对子节点调用 setPosition 会触发 TRANSFORM_CHANGED，
     * 若不屏蔽则 _markDirty 被调用，导致下一帧再次重算（实为无意义重算）。
     */
    private _updating = false;
    /** 冲突错误已打印，避免每帧重复输出 */
    private _conflictLogged = false;

    // ─── 生命周期 ─────────────────────────────────────────────────────────────

    onLoad() {
        this.node.on(Node.EventType.CHILD_ADDED,   this._onChildAdded,   this);
        this.node.on(Node.EventType.CHILD_REMOVED, this._onChildRemoved, this);
        this._bindAllChildren();
        this._markDirty();
    }

    onDestroy() {
        this.node.off(Node.EventType.CHILD_ADDED,   this._onChildAdded,   this);
        this.node.off(Node.EventType.CHILD_REMOVED, this._onChildRemoved, this);
        this._unbindAllChildren();
    }

    /** 每帧检测脏标记，脏时执行适配。 */
    update() {
        if (EDITOR && this._checkConflicts()) { return; }
        if (!this._dirty) { return; }
        this._dirty = false;
        this._doFit();
    }

    // ─── 公共 API ─────────────────────────────────────────────────────────────

    /** 立即同步执行一次适配（无需等待下一帧）。可在代码中主动调用。 */
    public forceUpdate(): void {
        if (EDITOR && this._checkConflicts()) { return; }
        this._doFit();
    }

    // ─── 冲突检测（仅编辑器） ─────────────────────────────────────────────────

    /**
     * 检查当前节点是否存在与本组件冲突的组件。
     * 每帧调用，冲突时只打印一次错误；冲突解除后自动重置，可再次报告。
     * @returns 存在冲突返回 true，否则返回 false。
     */
    private _checkConflicts(): boolean {
        const hasLayout = !!this.node.getComponent(Layout);
        const hasWidget = !!this.node.getComponent(Widget);

        if (hasLayout || hasWidget) {
            if (!this._conflictLogged) {
                this._conflictLogged = true;
                if (hasLayout) {
                    console.error(
                        `[AutoFitContainerV2] 节点 "${this.node.name}" 同时挂载了 Layout 组件，` +
                        `两者均会修改子节点位置，行为不可预期。请移除其中一个。`,
                        this.node,
                    );
                }
                if (hasWidget) {
                    console.error(
                        `[AutoFitContainerV2] 节点 "${this.node.name}" 同时挂载了 Widget 组件，` +
                        `Widget 会覆盖本组件对 ContentSize 的修改，导致适配失效。请移除其中一个。`,
                        this.node,
                    );
                }
            }
            return true;
        }

        this._conflictLogged = false;
        return false;
    }

    // ─── 子节点事件管理 ───────────────────────────────────────────────────────

    private _bindAllChildren(): void {
        for (const child of this.node.children) {
            this._bindChild(child);
        }
    }

    private _unbindAllChildren(): void {
        for (const child of this.node.children) {
            this._unbindChild(child);
        }
    }

    private _bindChild(child: Node): void {
        child.on(Node.EventType.TRANSFORM_CHANGED,           this._markDirty, this);
        child.on(Node.EventType.SIZE_CHANGED,                this._markDirty, this);
        child.on(Node.EventType.ANCHOR_CHANGED,              this._markDirty, this);
        child.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
    }

    private _unbindChild(child: Node): void {
        child.off(Node.EventType.TRANSFORM_CHANGED,           this._markDirty, this);
        child.off(Node.EventType.SIZE_CHANGED,                this._markDirty, this);
        child.off(Node.EventType.ANCHOR_CHANGED,              this._markDirty, this);
        child.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
    }

    private _onChildAdded(child: Node): void {
        this._bindChild(child);
        this._markDirty();
    }

    private _onChildRemoved(child: Node): void {
        this._unbindChild(child);
        this._markDirty();
    }

    private _markDirty(): void {
        if (this._updating) { return; }
        this._dirty = true;
    }

    // ─── 核心适配逻辑 ─────────────────────────────────────────────────────────

    private _doFit(): void {
        const myUit = this.node.getComponent(UITransform);
        if (!myUit) { return; }

        const children = this.node.children;

        // ── 计算所有活跃子节点在容器本地坐标系下的 AABB ──────────────────────
        let minX = Infinity,  minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let hasValid = false;

        for (const child of children) {
            if (!child.active) { continue; }
            const uit = child.getComponent(UITransform);
            if (!uit) { continue; }

            // getBoundingBox() 返回该子节点在【容器本地坐标系】下的
            // 轴对齐包围盒（AABB），已自动处理子节点自身的
            // position / rotation / scale / anchorPoint / contentSize。
            const rect: Rect = uit.getBoundingBox();
            minX = Math.min(minX, rect.xMin);
            minY = Math.min(minY, rect.yMin);
            maxX = Math.max(maxX, rect.xMax);
            maxY = Math.max(maxY, rect.yMax);
            hasValid = true;
        }

        if (!hasValid) { return; }

        const ax = myUit.anchorX;
        const ay = myUit.anchorY;

        // ── 计算目标尺寸：children 包围盒 + Padding + 最小尺寸约束 ──────────
        //
        // 只对启用轴向的方向重新计算；未启用的轴保持容器当前尺寸不变。
        const oldSize = myUit.contentSize;

        const newW = this._fitHorizontal
            ? Math.max(maxX - minX + this._paddingLeft + this._paddingRight, this._minWidth)
            : oldSize.width;

        const newH = this._fitVertical
            ? Math.max(maxY - minY + this._paddingTop + this._paddingBottom, this._minHeight)
            : oldSize.height;

        // ── 偏移量推导 ──────────────────────────────────────────────────────
        //
        // 容器内容区左下角（本地坐标）= (-ax·newW, -ay·newH)
        // 子节点 AABB 目标左下角      = (-ax·newW + paddingLeft,  -ay·newH + paddingBottom)
        // 子节点 AABB 当前左下角      = (minX, minY)
        //
        // 需令 minX - shiftX = -ax·newW + paddingLeft
        //   => shiftX = minX + ax·newW - paddingLeft
        // 同理：
        //   => shiftY = minY + ay·newH - paddingBottom
        //
        // 对未启用的轴：shiftX/Y = 0，子节点与容器在该轴均不偏移。
        const shiftX = this._fitHorizontal ? minX + ax * newW - this._paddingLeft   : 0;
        const shiftY = this._fitVertical   ? minY + ay * newH - this._paddingBottom : 0;

        // ── 幂等守卫：状态已正确则跳过，避免浮点累积误差 ────────────────────
        const EPS = 0.5;
        const needResize = Math.abs(oldSize.width - newW) > EPS || Math.abs(oldSize.height - newH) > EPS;
        const needShift  = Math.abs(shiftX) > EPS || Math.abs(shiftY) > EPS;

        if (!needResize && !needShift) { return; }

        this._updating = true;

        // 步骤 1：子节点反向偏移，使其 AABB 与容器内容区（含 Padding）对齐
        if (needShift) {
            for (const child of children) {
                child.setPosition(
                    child.position.x - shiftX,
                    child.position.y - shiftY,
                    child.position.z,
                );
            }
        }

        // 步骤 2：设置新的 ContentSize
        myUit.setContentSize(newW, newH);

        // 步骤 3：容器在父节点坐标系做等量正向偏移，抵消步骤 1 的影响，
        //         使子节点世界坐标保持不变
        if (needShift) {
            this.node.setPosition(
                this.node.position.x + shiftX,
                this.node.position.y + shiftY,
                this.node.position.z,
            );
        }

        this._updating = false;
    }
}
