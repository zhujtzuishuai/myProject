System.register(["__unresolved_0", "cc", "__unresolved_1"], function (_export, _context) {
  "use strict";

  var _reporterNs, _cclegacy, __checkObsolete__, __checkObsoleteInNamespace__, _decorator, Component, Node, UITransform, Graphics, Color, Layout, tween, v3, input, Input, KeyCode, AutoFitContainer, _dec, _class, _crd, ccclass, AutoFitContainerTest;

  // ── 工具函数 ──────────────────────────────────────────────────────────────────

  /** 创建带 UITransform 的空节点并添加到父节点 */
  function makeNode(parent, name) {
    const n = new Node(name);
    parent.addChild(n);
    n.addComponent(UITransform);
    return n;
  }
  /** 创建纯色矩形（用 Graphics 绘制，无需图片资源） */


  function makeBox(parent, name, w, h, x, y, col, anchorX = 0.5, anchorY = 0.5) {
    const n = new Node(name);
    parent.addChild(n);
    const uit = n.addComponent(UITransform);
    uit.setContentSize(w, h);
    uit.setAnchorPoint(anchorX, anchorY);
    const g = n.addComponent(Graphics);
    g.fillColor = col;
    g.rect(-anchorX * w, -anchorY * h, w, h);
    g.fill();
    n.setPosition(x, y, 0);
    return n;
  }
  /** 用 Graphics 绘制容器轮廓（红色虚线框，每帧刷新） */


  function drawOutline(g, uit) {
    const w = uit.width;
    const h = uit.height;
    const ax = uit.anchorX;
    const ay = uit.anchorY;
    g.clear();
    g.strokeColor = new Color(255, 60, 60, 220);
    g.lineWidth = 3;
    g.rect(-ax * w, -ay * h, w, h);
    g.stroke();
  }
  /** 创建 AutoFitContainer 容器节点，并附加用于可视化的红色轮廓线 */


  function makeContainer(parent, name, x, y, anchorX, anchorY) {
    const n = new Node(name);
    parent.addChild(n);
    n.setPosition(x, y, 0);
    const uit = n.addComponent(UITransform);
    uit.setContentSize(10, 10);
    uit.setAnchorPoint(anchorX, anchorY);
    n.addComponent(_crd && AutoFitContainer === void 0 ? (_reportPossibleCrUseOfAutoFitContainer({
      error: Error()
    }), AutoFitContainer) : AutoFitContainer); // 轮廓节点（本身是子节点，AutoFitContainer 会把它计入包围盒，
    // 因此给它一个极小尺寸使影响可忽略）

    const outlineNode = new Node('_outline');
    n.addChild(outlineNode);
    const outlineUit = outlineNode.addComponent(UITransform);
    outlineUit.setContentSize(0, 0);
    const g = outlineNode.addComponent(Graphics);
    return {
      node: n,
      outline: g
    };
  } // ─────────────────────────────────────────────────────────────────────────────


  function _reportPossibleCrUseOfAutoFitContainer(extras) {
    _reporterNs.report("AutoFitContainer", "./components/AutoFitContainer", _context.meta, extras);
  }

  return {
    setters: [function (_unresolved_) {
      _reporterNs = _unresolved_;
    }, function (_cc) {
      _cclegacy = _cc.cclegacy;
      __checkObsolete__ = _cc.__checkObsolete__;
      __checkObsoleteInNamespace__ = _cc.__checkObsoleteInNamespace__;
      _decorator = _cc._decorator;
      Component = _cc.Component;
      Node = _cc.Node;
      UITransform = _cc.UITransform;
      Graphics = _cc.Graphics;
      Color = _cc.Color;
      Layout = _cc.Layout;
      tween = _cc.tween;
      v3 = _cc.v3;
      input = _cc.input;
      Input = _cc.Input;
      KeyCode = _cc.KeyCode;
    }, function (_unresolved_2) {
      AutoFitContainer = _unresolved_2.AutoFitContainer;
    }],
    execute: function () {
      _crd = true;

      _cclegacy._RF.push({}, "4fd57FjC1JFspiqzDlr0Iqy", "AutoFitContainerTest", undefined);
      /**
       * AutoFitContainerTest
       *
       * 使用方式：
       *  1. 在 Cocos Creator 3.8.6 中新建场景。
       *  2. 在 Canvas 下新建一个空节点（命名 "TestRoot"），附加本脚本。
       *  3. 运行场景，三组测试案例将自动生成并验证。
       *
       * 测试案例：
       *  Case 1 - 静态：3 个子节点分散在不同位置，验证容器初始包围是否正确。
       *  Case 2 - 动态：1 个子节点做 tween 动画，验证容器实时跟随。
       *  Case 3 - 激活/隐藏：点击空格键切换子节点 active，验证容器缩减。
       *  Case 4 - 父节点 Layout：容器放入横向 Layout，验证 Layout 自适应容器尺寸。
       */


      __checkObsolete__(['_decorator', 'Component', 'Node', 'UITransform', 'Graphics', 'Color', 'Layout', 'tween', 'v3', 'director', 'game', 'input', 'Input', 'KeyCode', 'EventKeyboard']);

      ({
        ccclass
      } = _decorator);

      _export("AutoFitContainerTest", AutoFitContainerTest = (_dec = ccclass('AutoFitContainerTest'), _dec(_class = class AutoFitContainerTest extends Component {
        constructor(...args) {
          super(...args);
          this._outlines = [];
          this._toggleTarget = null;
        }

        onLoad() {
          this._buildCase1();

          this._buildCase2();

          this._buildCase3();

          this._buildCase4();

          this._setupKeyboard();
        }

        update() {
          // 每帧刷新所有容器轮廓
          for (const {
            node,
            g
          } of this._outlines) {
            const uit = node.getComponent(UITransform);
            drawOutline(g, uit);
          }
        } // ── Case 1：静态多子节点 ─────────────────────────────────────────────────


        _buildCase1() {
          const {
            node: c,
            outline: g
          } = makeContainer(this.node, 'Case1_Container', -400, 100, 0.5, 0.5);
          makeBox(c, 'A', 80, 60, 40, 30, new Color(100, 180, 255, 200));
          makeBox(c, 'B', 50, 50, -60, -40, new Color(255, 200, 100, 200));
          makeBox(c, 'C', 30, 80, 100, 10, new Color(150, 255, 150, 200));

          this._outlines.push({
            node: c,
            g
          }); // 节点 A 锚点(0,0)，B 锚点(1,1)，C 默认 (0.5, 0.5)


          c.getChildByName('A').getComponent(UITransform).setAnchorPoint(0, 0);
          c.getChildByName('B').getComponent(UITransform).setAnchorPoint(1, 1);
        } // ── Case 2：动态 tween ───────────────────────────────────────────────────


        _buildCase2() {
          const {
            node: c,
            outline: g
          } = makeContainer(this.node, 'Case2_Container', 0, 100, 0, 0);
          makeBox(c, 'Fixed', 60, 60, 80, 80, new Color(120, 120, 255, 200));
          const moving = makeBox(c, 'Moving', 50, 50, 0, 0, new Color(255, 100, 100, 200));

          this._outlines.push({
            node: c,
            g
          });

          tween(moving).repeatForever(tween(moving).to(1.5, {
            position: v3(160, -60, 0)
          }).to(1.5, {
            position: v3(-40, 130, 0)
          }).to(1.5, {
            position: v3(0, 0, 0)
          })).start();
        } // ── Case 3：切换 active（空格键） ─────────────────────────────────────────


        _buildCase3() {
          const {
            node: c,
            outline: g
          } = makeContainer(this.node, 'Case3_Container', 400, 100, 0.5, 0.5);
          makeBox(c, 'Always', 80, 80, 0, 0, new Color(200, 200, 200, 200));
          const toggled = makeBox(c, 'Toggle', 60, 60, 120, 80, new Color(255, 160, 0, 200));

          this._outlines.push({
            node: c,
            g
          });

          this._toggleTarget = toggled;
        } // ── Case 4：父节点有 Layout ──────────────────────────────────────────────


        _buildCase4() {
          // 父节点挂 Layout
          const layoutParent = makeNode(this.node, 'LayoutParent');
          layoutParent.setPosition(0, -150, 0);
          const lpUit = layoutParent.getComponent(UITransform);
          lpUit.setContentSize(600, 200);
          const layout = layoutParent.addComponent(Layout);
          layout.type = Layout.Type.HORIZONTAL;
          layout.spacingX = 20;
          layout.paddingLeft = 10;
          layout.paddingBottom = 10;
          layout.resizeMode = Layout.ResizeMode.CONTAINER;
          const sizes = [[40, 40], [80, 60], [30, 90]];
          const colors = [new Color(255, 160, 160, 200), new Color(160, 255, 160, 200), new Color(160, 160, 255, 200)];

          for (let i = 0; i < 3; i++) {
            const {
              node: c,
              outline: g
            } = makeContainer(layoutParent, `LC${i}`, 0, 0, 0, 0);
            const [w, h] = sizes[i];
            makeBox(c, 'child', w, h, 0, 0, colors[i]);

            this._outlines.push({
              node: c,
              g
            });
          }
        } // ── 键盘事件（Case 3 演示） ───────────────────────────────────────────────


        _setupKeyboard() {
          input.on(Input.EventType.KEY_DOWN, e => {
            if (e.keyCode === KeyCode.SPACE && this._toggleTarget) {
              this._toggleTarget.active = !this._toggleTarget.active;
            }
          }, this);
        }

        onDestroy() {
          input.off(Input.EventType.KEY_DOWN);
        }

      }) || _class));

      _cclegacy._RF.pop();

      _crd = false;
    }
  };
});
//# sourceMappingURL=1ab4e76155681eddb5b31d4ddee839e54560e634.js.map