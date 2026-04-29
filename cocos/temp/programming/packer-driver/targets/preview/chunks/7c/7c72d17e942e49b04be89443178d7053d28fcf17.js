System.register(["cc"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, Animation, Label, _dec, _dec2, _dec3, _dec4, _dec5, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _crd, ccclass, property, CombatState, STATE_TIPS, CombatManager;

  function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

  function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

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
        constructor() {
          super(...arguments);

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


        doAttack() {
          var _this = this;

          return _asyncToGenerator(function* () {
            try {
              _this.state = CombatState.A_ATTACKING;
              yield _this.playAnim(_this.modelA, 'attack');
              _this.bHp = Math.max(0, _this.bHp - _this.DAMAGE);

              if (_this.bHp <= 0) {
                _this.state = CombatState.B_DYING;
                yield _this.playAnim(_this.modelB, 'die');

                _this.stopAuto();
              } else {
                _this.state = CombatState.B_HIT;
                yield _this.playAnim(_this.modelB, 'hit');
              }

              _this.state = CombatState.ITEM_DROPPING;
              yield _this.playAnim(_this.itemNode, 'drop');
            } catch (err) {
              console.error('[CombatManager] 攻击流程异常:', err);
            } finally {
              _this.state = CombatState.IDLE;
            }
          })();
        } // ── 工具：带超时的动画等待 ────────────────────────────


        playAnim(node, clipName, timeoutMs) {
          if (timeoutMs === void 0) {
            timeoutMs = 5000;
          }

          return new Promise((resolve, reject) => {
            var anim = node.getComponent(Animation);
            var timer = setTimeout(() => {
              reject(new Error("[CombatManager] " + node.name + " \u52A8\u753B \"" + clipName + "\" \u8D85\u65F6 (" + timeoutMs + "ms)\uFF0C\u8BF7\u68C0\u67E5\u52A8\u753B\u7247\u6BB5\u662F\u5426\u5B58\u5728\u6216\u56DE\u8C03\u662F\u5426\u6B63\u5E38"));
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
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "modelB", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "itemNode", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "tipLabel", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      })), _class2)) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=7c72d17e942e49b04be89443178d7053d28fcf17.js.map