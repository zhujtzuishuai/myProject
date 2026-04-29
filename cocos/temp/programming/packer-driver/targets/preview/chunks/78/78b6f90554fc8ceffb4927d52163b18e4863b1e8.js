System.register(["cc", "cc/env"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, UITransform, Label, EDITOR, _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _class, _class2, _descriptor, _descriptor2, _descriptor3, _descriptor4, _descriptor5, _crd, ccclass, property, disallowMultiple, executeInEditMode, Marquee;

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
      UITransform = _cc.UITransform;
      Label = _cc.Label;
    }, function (_ccEnv) {
      EDITOR = _ccEnv.EDITOR;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "21c72uXX51Lzb9Xe1fvWNcD", "Marquee", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'UITransform', 'Label']);

      ({
        ccclass,
        property,
        disallowMultiple,
        executeInEditMode
      } = _decorator);
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

      _export("Marquee", Marquee = (_dec = ccclass('Marquee'), _dec2 = property({
        type: Node,
        tooltip: '内容节点（直接子节点，锚点建议 0, 0.5）'
      }), _dec3 = property({
        tooltip: '滚动速度（像素/秒）'
      }), _dec4 = property({
        tooltip: '首次入场前的等待时间（秒）'
      }), _dec5 = property({
        tooltip: '每次循环结束后的等待时间（秒）'
      }), _dec6 = property({
        tooltip: '内容宽度 <= 容器宽度时是否强制滚动'
      }), _dec(_class = executeInEditMode(_class = disallowMultiple(_class = (_class2 = class Marquee extends Component {
        constructor() {
          super(...arguments);

          _initializerDefineProperty(this, "contentNode", _descriptor, this);

          _initializerDefineProperty(this, "speed", _descriptor2, this);

          _initializerDefineProperty(this, "delayBeforeStart", _descriptor3, this);

          _initializerDefineProperty(this, "delayBetweenLoop", _descriptor4, this);

          _initializerDefineProperty(this, "forceScroll", _descriptor5, this);

          // ── 内部状态 ──────────────────────────────────────────────────────────────
          this._viewWidth = 0;
          this._contentWidth = 0;
          this._running = false;
          this._paused = false;
          this._delayTimer = 0;
          this._waiting = false;
          this._pendingText = null;
          this._editorTimer = null;
          this._editorLastTime = 0;
        }

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

        update(dt) {
          if (EDITOR) return;
          if (!this._running || this._paused || !this.contentNode) return;

          this._tick(dt);
        } // ── 公开接口 ──────────────────────────────────────────────────────────────


        play() {
          if (!this.contentNode) {
            console.warn('[Marquee] contentNode 未设置');
            return;
          }

          this._pendingText = null;

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
          this._pendingText = null;

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

            this._startInternal();
          }
        }
        /**
         * 设置滚动文本（contentNode 上须有 Label 组件）。
         * - 若当前未在滚动，立即应用并开始播放。
         * - 若当前正在滚动，等到本轮内容完全离屏后再替换，避免跳变。
         */


        setText(text) {
          if (!this._running) {
            this._applyText(text);

            this._init();

            this.play();
            return;
          }

          this._pendingText = text;
        } // ── 内部方法 ──────────────────────────────────────────────────────────────


        _startInternal() {
          if (!this.contentNode || !this._needsScroll()) return;
          this._running = true;
          this._paused = false;

          this._resetToStart(); // 先复位到起点，再开始延迟


          this._startDelay(this.delayBeforeStart);
        }

        _tick(dt) {
          if (!this._running || this._paused || !this.contentNode) return;

          if (this._waiting) {
            this._delayTimer -= dt;

            if (this._delayTimer <= 0) {
              this._waiting = false;

              this._resetToStart();
            }

            return;
          }

          var pos = this.contentNode.position;
          var nextX = pos.x - this.speed * dt;
          var rightEdge = nextX + this._contentWidth;

          if (rightEdge < -this._viewWidth / 2) {
            // 本轮内容已完全离屏，检查是否有待替换文本
            if (this._pendingText !== null) {
              this._applyText(this._pendingText);

              this._pendingText = null;

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

        _applyText(text) {
          if (!this.contentNode) return;
          var label = this.contentNode.getComponent(Label);

          if (!label) {
            console.warn('[Marquee] contentNode 上未找到 Label 组件，setText 无效');
            return;
          }

          label.string = text;
        }

        _startEditorTimer() {
          this._stopEditorTimer();

          this._init();

          this._startInternal();

          this._editorLastTime = Date.now();
          this._editorTimer = setInterval(() => {
            var now = Date.now();
            var dt = (now - this._editorLastTime) / 1000;
            this._editorLastTime = now;

            this._tick(dt);
          }, 16);
        }

        _stopEditorTimer() {
          if (this._editorTimer !== null) {
            clearInterval(this._editorTimer);
            this._editorTimer = null;
          }
        }

        _init() {
          var _viewTrans$contentSiz;

          var viewTrans = this.node.getComponent(UITransform);
          this._viewWidth = (_viewTrans$contentSiz = viewTrans == null ? void 0 : viewTrans.contentSize.width) != null ? _viewTrans$contentSiz : 0;

          if (this.contentNode) {
            var _contentTrans$content;

            var contentTrans = this.contentNode.getComponent(UITransform);
            this._contentWidth = (_contentTrans$content = contentTrans == null ? void 0 : contentTrans.contentSize.width) != null ? _contentTrans$content : 0;
          }
        }

        _needsScroll() {
          return this.forceScroll || this._contentWidth > this._viewWidth;
        }
        /** 将内容节点复位到右侧入场起点 */


        _resetToStart() {
          if (!this.contentNode) return;
          var pos = this.contentNode.position;
          this.contentNode.setPosition(this._viewWidth / 2, pos.y, pos.z);
        }

        _startDelay(seconds) {
          if (seconds <= 0) {
            this._resetToStart();

            return;
          }

          this._waiting = true;
          this._delayTimer = seconds;
        }

      }, (_descriptor = _applyDecoratedDescriptor(_class2.prototype, "contentNode", [_dec2], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return null;
        }
      }), _descriptor2 = _applyDecoratedDescriptor(_class2.prototype, "speed", [_dec3], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 80;
        }
      }), _descriptor3 = _applyDecoratedDescriptor(_class2.prototype, "delayBeforeStart", [_dec4], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1;
        }
      }), _descriptor4 = _applyDecoratedDescriptor(_class2.prototype, "delayBetweenLoop", [_dec5], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return 1;
        }
      }), _descriptor5 = _applyDecoratedDescriptor(_class2.prototype, "forceScroll", [_dec6], {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer: function initializer() {
          return false;
        }
      })), _class2)) || _class) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=78b6f90554fc8ceffb4927d52163b18e4863b1e8.js.map