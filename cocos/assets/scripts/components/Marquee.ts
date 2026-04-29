import { _decorator, Component, Node, UITransform, Label, Vec3 } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, disallowMultiple, executeInEditMode } = _decorator;

/**
 * Marquee（走马灯）
 *
 * 用法：
 *  1. 挂载到一个带 Mask + UITransform 的容器节点上，该节点决定可视宽度。
 *  2. 将自定义内容节点（Label / 图文混排等）赋给 contentNode。
 *     内容节点须是本节点的直接子节点，锚点建议设为 (0, 0.5)。
 *  3. 运行时调用 play() 开始滚动，pause() 暂停，stop() 停止并复位。
 *     调用 setText(str) 可在当前滚动结束后替换文本并继续滚动。
 *     编辑器中挂载后自动预览滚动效果。
 *
 * 滚动逻辑：
 *  - 内容从容器右侧入场，向左匀速滚动。
 *  - 内容完全离开左侧后，从右侧重新入场，形成循环。
 *  - 若内容宽度 <= 容器宽度，默认不滚动（可通过 forceScroll 强制开启）。
 */
@ccclass('Marquee')
@executeInEditMode
@disallowMultiple
export class Marquee extends Component {

    @property({ type: Node, tooltip: '内容节点（直接子节点，锚点建议 0, 0.5）' })
    contentNode: Node = null!;

    @property({ tooltip: '滚动速度（像素/秒）' })
    speed: number = 80;

    @property({ tooltip: '首次入场前的等待时间（秒）' })
    delayBeforeStart: number = 1;

    @property({ tooltip: '每次循环结束后的等待时间（秒）' })
    delayBetweenLoop: number = 1;

    @property({ tooltip: '内容宽度 <= 容器宽度时是否强制滚动' })
    forceScroll: boolean = false;

    // ── 内部状态 ──────────────────────────────────────────────────────────────

    private _viewWidth: number = 0;
    private _contentWidth: number = 0;
    private _running: boolean = false;
    private _paused: boolean = false;
    private _delayTimer: number = 0;
    private _waiting: boolean = false;
    private _textQueue: string[] = [];
    private _editorTimer: any = null;
    private _editorLastTime: number = 0;

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    onEnable() {
        if (EDITOR) {
            this._init();
            this._startEditorTimer();
        }
    }

    onDisable() {
        this._running = false;
        this._stopEditorTimer();
        if (EDITOR) {
            this._resetToStart();
        }
    }

    start() {
        if (!EDITOR) {
            this._init();
        }
    }

    update(dt: number) {
        if (EDITOR) return;
        if (!this._running || this._paused || !this.contentNode) return;
        this._tick(dt);
    }

    // ── 公开接口 ──────────────────────────────────────────────────────────────

    play() {
        if (!this.contentNode) {
            console.warn('[Marquee] contentNode 未设置');
            return;
        }
        this._textQueue = [];
        this._init();
        this._startInternal();
    }

    pause() {
        this._paused = true;
    }

    resume() {
        this._paused = false;
    }

    stop() {
        this._running = false;
        this._paused = false;
        this._waiting = false;
        this._textQueue = [];
        this._resetToStart();
    }

    /**
     * 内容节点尺寸发生变化时（如动态更新文本/图片后），调用此方法刷新宽度缓存并重新开始滚动。
     */
    refresh() {
        this._init();
        if (this._running) {
            this._running = false;
            this._waiting = false;
            this._textQueue = [];
            this._startInternal();
        }
    }

    /**
     * 设置滚动文本（contentNode 上须有 Label 组件）。
     * - 若当前未在滚动，立即应用并开始播放。
     * - 若当前正在滚动，加入队列，按序在每轮结束后依次替换。
     */
    setText(text: string) {
        if (!this._running) {
            this._applyText(text);
            this._init();
            this.play();
            return;
        }
        this._textQueue.push(text);
    }

    // ── 内部方法 ──────────────────────────────────────────────────────────────

    private _startInternal() {
        if (!this.contentNode || !this._needsScroll()) return;
        this._running = true;
        this._paused = false;
        this._resetToStart();                       // 先复位到起点，再开始延迟
        this._startDelay(this.delayBeforeStart);
    }

    private _tick(dt: number) {
        if (!this._running || this._paused || !this.contentNode) return;

        if (this._waiting) {
            this._delayTimer -= dt;
            if (this._delayTimer <= 0) {
                this._waiting = false;
                this._resetToStart();
            }
            return;
        }

        const pos = this.contentNode.position;
        const nextX = pos.x - this.speed * dt;

        const rightEdge = nextX + this._contentWidth;
        if (rightEdge < -this._viewWidth / 2) {
            // 本轮内容已完全离屏，检查队列中是否有待替换文本
            if (this._textQueue.length > 0) {
                this._applyText(this._textQueue.shift()!);
                this._init();
                if (!this._needsScroll()) {
                    this._running = false;
                    this._resetToStart();
                    return;
                }
            }
            this._startDelay(this.delayBetweenLoop);
            return;
        }

        this.contentNode.setPosition(nextX, pos.y, pos.z);
    }

    private _applyText(text: string) {
        if (!this.contentNode) return;
        const label = this.contentNode.getComponent(Label);
        if (!label) {
            console.warn('[Marquee] contentNode 上未找到 Label 组件，setText 无效');
            return;
        }
        label.string = text;
    }

    private _startEditorTimer() {
        this._stopEditorTimer();
        this._init();
        this._startInternal();
        this._editorLastTime = Date.now();
        this._editorTimer = setInterval(() => {
            const now = Date.now();
            const dt = (now - this._editorLastTime) / 1000;
            this._editorLastTime = now;
            this._tick(dt);
        }, 16);
    }

    private _stopEditorTimer() {
        if (this._editorTimer !== null) {
            clearInterval(this._editorTimer);
            this._editorTimer = null;
        }
    }

    private _init() {
        const viewTrans = this.node.getComponent(UITransform);
        this._viewWidth = viewTrans?.contentSize.width ?? 0;

        if (this.contentNode) {
            const contentTrans = this.contentNode.getComponent(UITransform);
            this._contentWidth = contentTrans?.contentSize.width ?? 0;
        }
    }

    private _needsScroll(): boolean {
        return this.forceScroll || this._contentWidth > this._viewWidth;
    }

    /** 将内容节点复位到右侧入场起点 */
    private _resetToStart() {
        if (!this.contentNode) return;
        const pos = this.contentNode.position;
        this.contentNode.setPosition(this._viewWidth / 2, pos.y, pos.z);
    }

    private _startDelay(seconds: number) {
        if (seconds <= 0) {
            this._resetToStart();
            return;
        }
        this._waiting = true;
        this._delayTimer = seconds;
    }
    jumpCoordinate(from: Node, toCoordinateNode: Node, out: Vec3) {
        from.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(from.position, out);
        toCoordinateNode.getComponent(UITransform)!.convertToNodeSpaceAR(out, out)
    }
    getLocalPosRelativeTo(target: Node, relativeTo: Node) {
        const worldPos = target.getWorldPosition();
        const localPos = new Vec3();
        if (relativeTo.parent) {
            relativeTo.parent.inverseTransformPoint(localPos, worldPos);
        } else {
            Vec3.copy(localPos, worldPos);
        }
        return localPos;
    }
}



