import { _decorator, Component, Node, Animation, Label } from 'cc';
const { ccclass, property } = _decorator;

enum CombatState {
    IDLE           = 'IDLE',
    A_ATTACKING    = 'A_ATTACKING',
    B_HIT          = 'B_HIT',
    B_DYING        = 'B_DYING',
    ITEM_DROPPING  = 'ITEM_DROPPING',
}

const STATE_TIPS: Partial<Record<CombatState, string>> = {
    [CombatState.A_ATTACKING]:   'A 正在攻击中...',
    [CombatState.B_HIT]:         'B 正在受击中...',
    [CombatState.B_DYING]:       'B 正在死亡中...',
    [CombatState.ITEM_DROPPING]: '道具掉落中...',
};

@ccclass('CombatManager')
export class CombatManager extends Component {
    @property(Node)  modelA:   Node  = null!;
    @property(Node)  modelB:   Node  = null!;
    @property(Node)  itemNode: Node  = null!;
    @property(Label) tipLabel: Label = null!;

    private state: CombatState = CombatState.IDLE;
    private bHp   = 100;
    private readonly DAMAGE = 40;
    private autoTimer: ReturnType<typeof setInterval> | null = null;

    get isBusy() { return this.state !== CombatState.IDLE; }

    // ── 按钮回调 ──────────────────────────────────────────

    onAttackClick() {
        if (this.isBusy) {
            this.showTip(STATE_TIPS[this.state] ?? '当前有动画未完成');
            return;
        }
        this.doAttack();
    }

    onAutoClick() {
        this.autoTimer ? this.stopAuto() : this.startAuto();
    }

    // ── 自动攻击 ──────────────────────────────────────────

    private startAuto() {
        if (!this.isBusy) this.doAttack();
        this.autoTimer = setInterval(() => {
            if (!this.isBusy) this.doAttack();
        }, 500);
    }

    private stopAuto() {
        clearInterval(this.autoTimer!);
        this.autoTimer = null;
    }

    // ── 核心攻击流程 ──────────────────────────────────────

    private async doAttack() {
        try {
            this.state = CombatState.A_ATTACKING;
            await this.playAnim(this.modelA, 'attack');

            this.bHp = Math.max(0, this.bHp - this.DAMAGE);

            if (this.bHp <= 0) {
                this.state = CombatState.B_DYING;
                await this.playAnim(this.modelB, 'die');
                this.stopAuto();
            } else {
                this.state = CombatState.B_HIT;
                await this.playAnim(this.modelB, 'hit');
            }

            this.state = CombatState.ITEM_DROPPING;
            await this.playAnim(this.itemNode, 'drop');

        } catch (err) {
            console.error('[CombatManager] 攻击流程异常:', err);
        } finally {
            this.state = CombatState.IDLE;
        }
    }

    // ── 工具：带超时的动画等待 ────────────────────────────

    private playAnim(node: Node, clipName: string, timeoutMs = 5000): Promise<void> {
        return new Promise((resolve, reject) => {
            const anim = node.getComponent(Animation)!;

            const timer = setTimeout(() => {
                reject(new Error(
                    `[CombatManager] ${node.name} 动画 "${clipName}" 超时 (${timeoutMs}ms)，请检查动画片段是否存在或回调是否正常`
                ));
            }, timeoutMs);

            anim.once(Animation.EventType.FINISHED, () => {
                clearTimeout(timer);
                resolve();
            });

            anim.play(clipName);
        });
    }

    private showTip(msg: string) {
        this.tipLabel.string = msg;
        this.scheduleOnce(() => { this.tipLabel.string = ''; }, 2);
    }
}
