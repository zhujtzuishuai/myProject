System.register(["cc", "cc/env"], function (_export, _context) {
  "use strict";

  var _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, UITransform, Layout, Widget, EDITOR, _dec, _class, _crd, ccclass, executeInEditMode, disallowMultiple, AutoFitContainer;

  return {
    setters: [function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      UITransform = _cc.UITransform;
      Layout = _cc.Layout;
      Widget = _cc.Widget;
    }, function (_ccEnv) {
      EDITOR = _ccEnv.EDITOR;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "3eeddTF2RJH1qExQY7+GMe4", "AutoFitContainer", undefined);

      __checkObsolete__(['_decorator', 'Component', 'Node', 'UITransform', 'Rect', 'Layout', 'Widget']);

      ({
        ccclass,
        executeInEditMode,
        disallowMultiple
      } = _decorator);
      /**
       * AutoFitContainer
       *
       * 动态将容器节点的 ContentSize 调整为恰好包围所有活跃子节点的最小矩形。
       *
       * 行为说明：
       *  - 锚点（anchorPoint）保持不变。
       *  - 子节点的世界坐标不变；内部通过等量平移子节点本地坐标，和容器父节点坐标来保持视觉位置不变。
       *  - 编辑器（executeInEditMode）与运行时均实时生效。
       *  - 子节点的 position / rotation / scale / size / anchor / active ，发生变化时自动触发重算（下一帧执行，同帧多次变化只算一次）。
       *
       * 限制：
       *  - 容器节点本身不能挂载 Layout 组件（Layout 会修改子节点位置，与本组件冲突）。
       *  - 容器节点本身不能挂载 Widget 组件（Widget 会覆盖本组件对 size 的修改）。
       *  - 上述两种情况每帧均会检测（无论挂载顺序），检测到冲突时输出 console.error，并跳过本帧适配；冲突解除后自动恢复。
       *  - 子节点若挂载了 Widget 组件，可能与本组件产生轻微抖动（Widget 在 resize 后重新调整子节点位置），通常可忽略。
       */

      _export("AutoFitContainer", AutoFitContainer = (_dec = ccclass('AutoFitContainer'), _dec(_class = executeInEditMode(_class = disallowMultiple(_class = class AutoFitContainer extends Component {
        constructor() {
          super(...arguments);

          /** 下一帧需要重新计算 */
          this._dirty = false;

          /**
           * 正在执行自身更新，屏蔽由更新触发的子节点事件，防止循环调用。
           * 原因：步骤 1 中对子节点调用 setPosition 会触发 TRANSFORM_CHANGED，
           * 若不屏蔽则 _markDirty 被调用，导致下一帧再次重算（实为无意义重算）。
           */
          this._updating = false;

          /** 冲突错误已打印，避免每帧重复输出 */
          this._conflictLogged = false;
        }

        // ─── 生命周期 ─────────────────────────────────────────────────────────────
        onLoad() {
          this.node.on(Node.EventType.CHILD_ADDED, this._onChildAdded, this);
          this.node.on(Node.EventType.CHILD_REMOVED, this._onChildRemoved, this);

          this._bindAllChildren();

          this._markDirty();
        }

        onDestroy() {
          this.node.off(Node.EventType.CHILD_ADDED, this._onChildAdded, this);
          this.node.off(Node.EventType.CHILD_REMOVED, this._onChildRemoved, this);

          this._unbindAllChildren();
        }
        /** 每帧检测脏标记，脏时执行适配。 */


        update() {
          if (EDITOR && this._checkConflicts()) {
            return;
          }

          if (!this._dirty) {
            return;
          }

          this._dirty = false;

          this._doFit();
        } // ─── 公共 API ─────────────────────────────────────────────────────────────

        /** 立即同步执行一次适配（无需等待下一帧）。可在代码中主动调用。 */


        forceUpdate() {
          if (EDITOR && this._checkConflicts()) {
            return;
          }

          this._doFit();
        } // ─── 冲突检测 ─────────────────────────────────────────────────────────────

        /**
         * 检查当前节点是否存在与本组件冲突的组件。
         * 每帧调用，冲突时只打印一次错误；冲突解除后自动重置，可再次报告。
         * @returns 存在冲突返回 true，否则返回 false。
         */


        _checkConflicts() {
          var hasLayout = !!this.node.getComponent(Layout);
          var hasWidget = !!this.node.getComponent(Widget);

          if (hasLayout || hasWidget) {
            if (!this._conflictLogged) {
              this._conflictLogged = true;

              if (hasLayout) {
                console.error("[AutoFitContainer] \u8282\u70B9 \"" + this.node.name + "\" \u540C\u65F6\u6302\u8F7D\u4E86 Layout \u7EC4\u4EF6\uFF0C" + "\u4E24\u8005\u5747\u4F1A\u4FEE\u6539\u5B50\u8282\u70B9\u4F4D\u7F6E\uFF0C\u884C\u4E3A\u4E0D\u53EF\u9884\u671F\u3002\u8BF7\u79FB\u9664\u5176\u4E2D\u4E00\u4E2A\u3002", this.node);
              }

              if (hasWidget) {
                console.error("[AutoFitContainer] \u8282\u70B9 \"" + this.node.name + "\" \u540C\u65F6\u6302\u8F7D\u4E86 Widget \u7EC4\u4EF6\uFF0C" + "Widget \u4F1A\u8986\u76D6\u672C\u7EC4\u4EF6\u5BF9 ContentSize \u7684\u4FEE\u6539\uFF0C\u5BFC\u81F4\u9002\u914D\u5931\u6548\u3002\u8BF7\u79FB\u9664\u5176\u4E2D\u4E00\u4E2A\u3002", this.node);
              }
            }

            return true;
          }

          this._conflictLogged = false;
          return false;
        } // ─── 子节点事件管理 ───────────────────────────────────────────────────────


        _bindAllChildren() {
          for (var child of this.node.children) {
            this._bindChild(child);
          }
        }

        _unbindAllChildren() {
          for (var child of this.node.children) {
            this._unbindChild(child);
          }
        }

        _bindChild(child) {
          child.on(Node.EventType.TRANSFORM_CHANGED, this._markDirty, this);
          child.on(Node.EventType.SIZE_CHANGED, this._markDirty, this);
          child.on(Node.EventType.ANCHOR_CHANGED, this._markDirty, this);
          child.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
        }

        _unbindChild(child) {
          child.off(Node.EventType.TRANSFORM_CHANGED, this._markDirty, this);
          child.off(Node.EventType.SIZE_CHANGED, this._markDirty, this);
          child.off(Node.EventType.ANCHOR_CHANGED, this._markDirty, this);
          child.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this._markDirty, this);
        }

        _onChildAdded(child) {
          this._bindChild(child);

          this._markDirty();
        }

        _onChildRemoved(child) {
          this._unbindChild(child);

          this._markDirty();
        }

        _markDirty() {
          if (this._updating) {
            return;
          }

          this._dirty = true;
        } // ─── 核心适配逻辑 ─────────────────────────────────────────────────────────


        _doFit() {
          var children = this.node.children;

          if (children.length === 0) {
            return;
          }

          var minX = Infinity,
              minY = Infinity;
          var maxX = -Infinity,
              maxY = -Infinity;
          var hasValid = false;

          for (var child of children) {
            if (!child.active) {
              continue;
            }

            var uit = child.getComponent(UITransform);

            if (!uit) {
              continue;
            } // getBoundingBox() 返回该子节点在【容器本地坐标系】下的
            // 轴对齐包围盒（AABB），已自动处理子节点自身的
            // position / rotation / scale / anchorPoint / contentSize。


            var rect = uit.getBoundingBox();
            minX = Math.min(minX, rect.xMin);
            minY = Math.min(minY, rect.yMin);
            maxX = Math.max(maxX, rect.xMax);
            maxY = Math.max(maxY, rect.yMax);
            hasValid = true;
          }

          if (!hasValid) {
            return;
          }

          var newW = maxX - minX;
          var newH = maxY - minY;
          var myUit = this.node.getComponent(UITransform);

          if (!myUit) {
            return;
          }

          var ax = myUit.anchorX;
          var ay = myUit.anchorY; // ── 偏移量推导 ──────────────────────────────────────────────────────
          // 容器内容区左下角（本地坐标） = (-ax·newW, -ay·newH)
          // 子节点 AABB 当前左下角       = (minX, minY)
          // 目标：使两者重合，故需将全部子节点在本地坐标系向左下偏移：
          //   Δx = minX − (−ax·newW) = minX + ax·newW
          //   Δy = minY + ay·newH
          // 同时容器在父节点坐标系做等量正向平移，抵消子节点世界坐标的变化。

          var shiftX = minX + ax * newW;
          var shiftY = minY + ay * newH; // 幂等守卫：状态已正确则跳过，避免浮点累积误差

          var EPS = 0.5;
          var oldSize = myUit.contentSize;
          var needResize = Math.abs(oldSize.width - newW) > EPS || Math.abs(oldSize.height - newH) > EPS;
          var needShift = Math.abs(shiftX) > EPS || Math.abs(shiftY) > EPS;

          if (!needResize && !needShift) {
            return;
          }

          this._updating = true; // 步骤 1：子节点反向偏移，使其 AABB 与容器内容区对齐

          if (needShift) {
            for (var _child of children) {
              _child.setPosition(_child.position.x - shiftX, _child.position.y - shiftY, _child.position.z);
            }
          } // 步骤 2：设置新的 ContentSize


          if (needResize || needShift) {
            myUit.setContentSize(newW, newH);
          } // 步骤 3：容器在父节点坐标系做等量正向偏移，抵消步骤 1 的影响
          //         使子节点世界坐标保持不变


          if (needShift) {
            this.node.setPosition(this.node.position.x + shiftX, this.node.position.y + shiftY, this.node.position.z);
          }

          this._updating = false;
        }

      }) || _class) || _class) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=df7896aa99ba7c1506afcee98348dd48838bc44a.js.map