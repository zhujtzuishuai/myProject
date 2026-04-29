System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Animation, Label, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, CombatState, STATE_TIPS, CombatManager;

  function _initializerDefineProperty(target, property, descriptor, context) { if (!descriptor) return; Object.defineProperty(target, property, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable, value: descriptor.initializer ? descriptor.initializer.call(context) : void 0 }); }

  function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) { var desc = {}; Object.keys(descriptor).forEach(function (key) { desc[key] = descriptor[key]; }); desc.enumerable = !!desc.enumerable; desc.configurable = !!desc.configurable; if ('value' in desc || desc.initializer) { desc.writable = true; } desc = decorators.slice().reverse().reduce(function (desc, decorator) { return decorator(target, property, desc) || desc; }, desc); if (context && desc.initializer !== void 0) { desc.value = desc.initializer ? desc.initializer.call(context) : void 0; desc.initializer = undefined; } if (desc.initializer === void 0) { Object.defineProperty(target, property, desc); desc = null; } return desc; }

  function _initializerWarningHelper(descriptor, context) { throw new Error('Decorating class property failed. Please ensure that ' + 'transform-class-properties is enabled and runs after the decorators transform.'); }

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      Animation = _cc.Animation;
      Label = _cc.Label;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "28457d1U8pAcKePJUAzxB9Z", "CombatManager", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'Animation', 'Label']);

      ({
        ccclass,
        property
      } = _decorator);

      CombatState = /*#__PURE__*/function (CombatState) {
        CombatState["IDLE"] = "IDLE";
        CombatState["A_ATTACKING"] = "A_ATTACKING";
        CombatState["B_HIT"] = "B_HIT";
        CombatState["B_DYING"] = "B_DYING";
        CombatState["ITEM_DROPPING"] = "ITEM_DROPPING";
        return CombatState;
      }(CombatState || {});

      STATE_TIPS = {
        [CombatState.A_ATTACKING]: 'A 正在攻击中...',
        [CombatState.B_HIT]: 'B 正在受击中...',
        [CombatState.B_DYING]: 'B 正在死亡中...',
        [CombatState.ITEM_DROPPING]: '道具掉落中...'
      };

      _export("CombatManager", CombatManager = (_dec = ccclass('CombatManager'), _dec2 = property(Node), _dec3 = property(Node), _dec4 = property(Node), _dec5 = property(Label), _dec(_class = (_class2 = class CombatManager extends Component {
        constructor(...args) {
          super(...args);

          _initializerDefineProperty(this, "modelA", _descriptor, this);

          _initializerDefineProperty(this, "modelB", _descriptor2, this);

          _initializerDefineProperty(this, "itemNode", _descriptor3, this);

          _initializerDefineProperty(this, "tipLabel", _descriptor4, this);

          this.state = CombatState.IDLE;
          this.bHp = 100;
          this.DAMAGE = 40;
          this.autoTimer = null;
        }

        get isBusy() {
          return this.state !== CombatState.IDLE;
        } // ── 按钮回调 ──────────────────────────────────────────


        onAttackClick() {
          if (this.isBusy) {
            var _STATE_TIPS$this$stat;

            this.showTip((_STATE_TIPS$this$stat = STATE_TIPS[this.state]) != null ? _STATE_TIPS$this$stat : '当前有动画未完成');
            return;
          }

          this.doAttack();
        }

        onAutoClick() {
          this.autoTimer ? this.stopAuto() : this.startAuto();
        } // ── 自动攻击 ──────────────────────────────────────────


        startAuto() {
          if (!this.isBusy) this.doAttack();
          this.autoTimer = setInterval(() => {
            if (!this.isBusy) this.doAttack();
          }, 500);
        }

        stopAuto() {
          clearInterval(this.autoTimer);
          this.autoTimer = null;
        } // ── 核心攻击流程 ──────────────────────────────────────


        async doAttack() {
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
        } // ── 工具：带超时的动画等待 ────────────────────────────


        playAnim(node, clipName, timeoutMs = 5000) {
          return new Promise((resolve, reject) => {
            const anim = node.getComponent(Animation);
            const timer = setTimeout(() => {
              reject(new Error(`[CombatManager] ${node.name} 动画 "${clipName}" 超时 (${timeoutMs}ms)，请检查动画片段是否存在或回调是否正常`));
            }, timeoutMs);
            anim.once(Animation.EventType.FINISHED, () => {
              clearTimeout(timer);
              resolve();
            });
            anim.play(clipName);
          });
        }

        showTip(msg) {
          this.tipLabel.string = msg;
          this.scheduleOnce(() => {
            this.tipLabel.string = '';
          }, 2);
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "modelA", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "modelB", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "itemNode", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "tipLabel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function () {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=7c72d17e942e49b04be89443178d7053d28fcf17.js.map