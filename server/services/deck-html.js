// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// Written by scripts/build-deck-html.js from client/src/utils/generateHTML.js and what it
// imports; edit those, then run the script.

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/logidrom/lib/tree-utils.js
var require_tree_utils = __commonJS({
  "node_modules/logidrom/lib/tree-utils.js"(exports2) {
    "use strict";
    var isAttrs2 = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !Object.prototype.hasOwnProperty.call(v, "x");
    var firstChildIdx = (tree) => isAttrs2(tree[1]) ? 2 : 1;
    var getAttrs = (tree) => isAttrs2(tree[1]) ? tree[1] : null;
    var isLeafCone = (tree) => Array.isArray(tree) && tree.length === firstChildIdx(tree);
    var getWidth = (node) => {
      if (!Array.isArray(node)) return 1;
      const attrs = getAttrs(node);
      return attrs && attrs.width || 1;
    };
    var widther = (w) => w === 0 ? "zeroer" : w === 1 ? "scalar" : "vector";
    var nameOf = (node) => typeof node === "string" ? node : node.name;
    var pinLabel = (op, attrs) => {
      if (op !== "pin" && op !== "pout" && op !== "pinout") return null;
      if (!attrs) return null;
      const ins = attrs.instance || "";
      const pin = attrs.pin || "";
      return ins + "." + pin;
    };
    var pinLabels = (op, attrs) => {
      if (!attrs) return { instance: "", pin: "" };
      return { instance: attrs.instance || "", pin: attrs.pin || "" };
    };
    var leafDisplay = (branch) => {
      if (!Array.isArray(branch)) return nameOf(branch);
      const attrs = getAttrs(branch);
      const name = nameOf(branch[0]);
      const pl = pinLabel(name, attrs);
      if (pl !== null) return pl;
      return name;
    };
    var outDisplay = (assignTree) => {
      const attrs = getAttrs(assignTree);
      const op = nameOf(assignTree[0]);
      const pl = pinLabel(op, attrs);
      if (pl !== null) return pl;
      const start = firstChildIdx(assignTree);
      const branch = assignTree[start];
      const visible = Array.isArray(branch) ? nameOf(branch[0]) : nameOf(branch);
      return visible || (attrs && attrs.label || "");
    };
    var outTooltip = (assignTree) => {
      const attrs = getAttrs(assignTree);
      const op = nameOf(assignTree[0]);
      const pl = pinLabel(op, attrs);
      if (pl !== null) return pl;
      if (attrs && attrs.label) return attrs.label;
      const start = firstChildIdx(assignTree);
      const branch = assignTree[start];
      return Array.isArray(branch) ? nameOf(branch[0]) : nameOf(branch);
    };
    var inlineDisplay = (assignTree) => {
      const attrs = getAttrs(assignTree);
      const op = nameOf(assignTree[0]);
      const pl = pinLabel(op, attrs);
      if (pl !== null) return pl;
      const start = firstChildIdx(assignTree);
      const nameBranch = assignTree[start];
      const node = Array.isArray(nameBranch) ? nameBranch[0] : nameBranch;
      return node && node.name || "";
    };
    var isPinOp = (op) => op === "pin" || op === "pout" || op === "pinout";
    exports2.isAttrs = isAttrs2;
    exports2.firstChildIdx = firstChildIdx;
    exports2.getAttrs = getAttrs;
    exports2.isLeafCone = isLeafCone;
    exports2.getWidth = getWidth;
    exports2.widther = widther;
    exports2.leafDisplay = leafDisplay;
    exports2.outDisplay = outDisplay;
    exports2.outTooltip = outTooltip;
    exports2.inlineDisplay = inlineDisplay;
    exports2.isPinOp = isPinOp;
    exports2.pinLabel = pinLabel;
    exports2.pinLabels = pinLabels;
  }
});

// node_modules/logidrom/lib/render.js
var require_render = __commonJS({
  "node_modules/logidrom/lib/render.js"(exports2, module2) {
    "use strict";
    var { firstChildIdx } = require_tree_utils();
    function render(tree, state) {
      state.xmax = Math.max(state.xmax, state.x);
      const y = state.y;
      const start = firstChildIdx(tree);
      const ilen = tree.length;
      if (ilen === start) {
        tree[0] = { name: tree[0], x: state.x, y: state.y };
        state.y += 2;
        state.x--;
        return state;
      }
      const isAssign = tree[0] === "=" && ilen > start + 1;
      const childStart = isAssign ? start + 1 : start;
      const childYs = [];
      for (let i = childStart; i < ilen; i++) {
        const branch = tree[i];
        if (Array.isArray(branch)) {
          state = render(branch, {
            x: state.x + 1,
            y: state.y,
            xmax: state.xmax
          });
          const node = branch[0];
          if (node && typeof node === "object" && typeof node.y === "number") {
            childYs.push(node.y);
          }
        } else {
          const node = {
            name: branch,
            x: state.x + 1,
            y: state.y
          };
          tree[i] = node;
          state.xmax = Math.max(state.xmax, state.x + 1);
          childYs.push(node.y);
          state.y += 2;
        }
      }
      let gateY;
      if (childYs.length === 0) {
        gateY = y;
      } else {
        childYs.sort((a, b) => a - b);
        const mid = Math.floor(childYs.length / 2);
        if (childYs.length % 2 === 1) {
          gateY = childYs[mid];
        } else {
          gateY = Math.round((childYs[mid - 1] + childYs[mid]) / 2);
        }
      }
      tree[0] = { name: tree[0], x: state.x, y: gateY };
      if (isAssign) {
        const nameBranch = tree[start];
        if (Array.isArray(nameBranch)) {
          nameBranch[0] = { name: nameBranch[0], x: state.x, y: gateY };
        } else {
          tree[start] = { name: nameBranch, x: state.x, y: gateY };
        }
      }
      state.x--;
      return state;
    }
    module2.exports = render;
  }
});

// node_modules/tspan/lib/parse.js
var require_parse = __commonJS({
  "node_modules/tspan/lib/parse.js"(exports2, module2) {
    "use strict";
    var escapeMap = {
      "&": "&amp;",
      '"': "&quot;",
      "<": "&lt;",
      ">": "&gt;"
    };
    function xscape(val) {
      if (typeof val !== "string") {
        return val;
      }
      return val.replace(
        /([&"<>])/g,
        function(_, e) {
          return escapeMap[e];
        }
      );
    }
    var token = /<o>|<ins>|<s>|<sub>|<sup>|<b>|<i>|<tt>|<\/o>|<\/ins>|<\/s>|<\/sub>|<\/sup>|<\/b>|<\/i>|<\/tt>/;
    function update(s, cmd) {
      if (cmd.add) {
        cmd.add.split(";").forEach(function(e) {
          var arr = e.split(" ");
          s[arr[0]][arr[1]] = true;
        });
      }
      if (cmd.del) {
        cmd.del.split(";").forEach(function(e) {
          var arr = e.split(" ");
          delete s[arr[0]][arr[1]];
        });
      }
    }
    var trans = {
      "<o>": { add: "text-decoration overline" },
      "</o>": { del: "text-decoration overline" },
      "<ins>": { add: "text-decoration underline" },
      "</ins>": { del: "text-decoration underline" },
      "<s>": { add: "text-decoration line-through" },
      "</s>": { del: "text-decoration line-through" },
      "<b>": { add: "font-weight bold" },
      "</b>": { del: "font-weight bold" },
      "<i>": { add: "font-style italic" },
      "</i>": { del: "font-style italic" },
      "<sub>": { add: "baseline-shift sub;font-size .7em" },
      "</sub>": { del: "baseline-shift sub;font-size .7em" },
      "<sup>": { add: "baseline-shift super;font-size .7em" },
      "</sup>": { del: "baseline-shift super;font-size .7em" },
      "<tt>": { add: "font-family monospace" },
      "</tt>": { del: "font-family monospace" }
    };
    function dump(s) {
      return Object.keys(s).reduce(function(pre, cur) {
        var keys = Object.keys(s[cur]);
        if (keys.length > 0) {
          pre[cur] = keys.join(" ");
        }
        return pre;
      }, {});
    }
    function parse2(str7) {
      var state, res, i, m, a;
      if (str7 === void 0) {
        return [];
      }
      if (typeof str7 === "number") {
        return [str7 + ""];
      }
      if (typeof str7 !== "string") {
        return [str7];
      }
      res = [];
      state = {
        "text-decoration": {},
        "font-weight": {},
        "font-style": {},
        "baseline-shift": {},
        "font-size": {},
        "font-family": {}
      };
      while (true) {
        i = str7.search(token);
        if (i === -1) {
          res.push(["tspan", dump(state), xscape(str7)]);
          return res;
        }
        if (i > 0) {
          a = str7.slice(0, i);
          res.push(["tspan", dump(state), xscape(a)]);
        }
        m = str7.match(token)[0];
        update(state, trans[m]);
        str7 = str7.slice(i + m.length);
        if (str7.length === 0) {
          return res;
        }
      }
    }
    module2.exports = parse2;
  }
});

// node_modules/tspan/lib/reparse.js
var require_reparse = __commonJS({
  "node_modules/tspan/lib/reparse.js"(exports2, module2) {
    "use strict";
    var parse2 = require_parse();
    function deDash(str7) {
      var m = str7.match(/(\w+)-(\w)(\w+)/);
      if (m === null) {
        return str7;
      }
      var newStr = m[1] + m[2].toUpperCase() + m[3];
      return newStr;
    }
    function reparse(React) {
      var $ = React.createElement;
      function reTspan(e, i) {
        var tag = e[0];
        var attr = e[1];
        var newAttr = Object.keys(attr).reduce(function(res, key) {
          var newKey = deDash(key);
          res[newKey] = attr[key];
          return res;
        }, {});
        var body = e[2];
        newAttr.key = i;
        return $(tag, newAttr, body);
      }
      return function(str7) {
        return parse2(str7).map(reTspan);
      };
    }
    module2.exports = reparse;
  }
});

// node_modules/tspan/lib/index.js
var require_lib = __commonJS({
  "node_modules/tspan/lib/index.js"(exports2) {
    "use strict";
    var parse2 = require_parse();
    var reparse = require_reparse();
    exports2.parse = parse2;
    exports2.reparse = reparse;
  }
});

// node_modules/logidrom/lib/font-metrics.js
var require_font_metrics = __commonJS({
  "node_modules/logidrom/lib/font-metrics.js"(exports2) {
    "use strict";
    var CHAR_WIDTH_PX = 7.23;
    var getLabelWidth = (s, fontWidth) => {
      const charWidth = fontWidth !== void 0 ? fontWidth : CHAR_WIDTH_PX;
      return Math.ceil((String(s).length + 0.3) * charWidth / 8) * 8;
    };
    exports2.CHAR_WIDTH_PX = CHAR_WIDTH_PX;
    exports2.getLabelWidth = getLabelWidth;
  }
});

// node_modules/logidrom/lib/draw_body.js
var require_draw_body = __commonJS({
  "node_modules/logidrom/lib/draw_body.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var { getLabelWidth } = require_font_metrics();
    var circle = [
      "m",
      -6,
      -0,
      "a",
      3,
      3,
      0,
      1,
      1,
      6,
      0,
      "a",
      3,
      3,
      0,
      1,
      1,
      -6,
      0
    ];
    var buf1 = ["m", -12, -6, 12, 6, -12, 6, "z"];
    var and1 = [
      // reduction AND with 1 input
      "m",
      -16,
      -6,
      "h",
      6,
      "a",
      6,
      6,
      0,
      1,
      1,
      0,
      12,
      "h",
      -6,
      "z",
      "m",
      12,
      6,
      "h",
      4
    ];
    var or1 = [
      // reduction OR with 1 input
      "m",
      -17,
      6,
      "a",
      12,
      12,
      0,
      0,
      0,
      0,
      -12,
      "a",
      12,
      12,
      0,
      0,
      1,
      13,
      6,
      "a",
      12,
      12,
      0,
      0,
      1,
      -13,
      6,
      "z",
      "m",
      13,
      -6,
      "h",
      4
    ];
    var xor1 = [
      // reduction XOR with 1 input
      "m",
      -12,
      6,
      "a",
      12,
      12,
      0,
      0,
      0,
      0,
      -12,
      "a",
      12,
      12,
      0,
      0,
      1,
      9,
      6,
      "a",
      12,
      12,
      0,
      0,
      1,
      -9,
      6,
      "z",
      "m",
      -4,
      0,
      "a",
      12,
      12,
      0,
      0,
      0,
      2,
      -6,
      // second left
      "m",
      0,
      0,
      "a",
      12,
      12,
      0,
      0,
      0,
      -2,
      -6,
      "m",
      13,
      6,
      "h",
      3
    ];
    var and2 = [
      // AND gate with >1 inputs
      "m",
      -16,
      -12,
      "h",
      4,
      "a",
      12,
      12,
      0,
      1,
      1,
      0,
      24,
      "h",
      -4,
      "z"
    ];
    var or2 = [
      // OR gate with >1 inputs
      "m",
      -16,
      12,
      "a",
      28,
      28,
      0,
      0,
      0,
      0,
      -24,
      // left
      "a",
      18,
      18,
      0,
      0,
      1,
      16,
      12,
      // top
      "a",
      18,
      18,
      0,
      0,
      1,
      -16,
      12,
      // bottom
      "z"
    ];
    var xor2 = [
      // XOR gate with >1 inputs
      "m",
      -12,
      12,
      "a",
      28,
      28,
      0,
      0,
      0,
      0,
      -24,
      // left
      "a",
      18,
      18,
      0,
      0,
      1,
      12,
      12,
      // top
      "a",
      18,
      18,
      0,
      0,
      1,
      -12,
      12,
      // bottom
      "z",
      "m",
      -4,
      0,
      "a",
      28,
      28,
      0,
      0,
      0,
      3,
      -12,
      // second left
      "m",
      0,
      0,
      "a",
      28,
      28,
      0,
      0,
      0,
      -3,
      -12
    ];
    var circle2 = [
      "m",
      -10,
      -10,
      "a",
      10,
      10,
      0,
      1,
      1,
      0,
      20,
      "a",
      10,
      10,
      0,
      1,
      1,
      0,
      -20
    ];
    var gates = {
      "buf1": { w: 12, d: buf1 },
      "~": { w: 18, d: [...circle, ...buf1] },
      "&": { w: 16, d: and2 },
      "~&": { w: 22, d: [...circle, ...and2] },
      "&1": { w: 16, d: and1 },
      "~&1": { w: 22, d: [...circle, ...and1] },
      "|": { w: 16, d: or2 },
      "~|": { w: 22, d: [...circle, ...or2] },
      "|1": { w: 16, d: or1 },
      "~|1": { w: 22, d: [...circle, ...or1] },
      "^": { w: 16, d: xor2 },
      "~^": { w: 22, d: [...circle, ...xor2] },
      "^1": { w: 16, d: xor1 },
      "~^1": { w: 22, d: [...circle, ...xor1] },
      "+": { w: 16, d: ["m", -10, 5, 0, -10, "m", -5, 5, 10, 0, "m", 5, 0, ...circle2] },
      "*": { w: 16, d: ["m", -6, 4, -8, -8, "m", 0, 8, 8, -8, "m", 6, 4, ...circle2] },
      "-": { w: 16, d: ["m", -5, 0, -10, 0, "m", 15, 0, ...circle2] },
      "/": { w: 16, d: ["m", -6, -4, -8, 8, "m", 14, -4, ...circle2] },
      "%": { w: 16, d: [
        "m",
        -6,
        -4,
        -8,
        8,
        "m",
        1,
        -5,
        "a",
        2,
        2,
        0,
        1,
        1,
        0,
        -4,
        "a",
        2,
        2,
        0,
        1,
        1,
        0,
        4,
        // top left
        "m",
        6,
        2,
        "a",
        2,
        2,
        0,
        1,
        1,
        0,
        4,
        "a",
        2,
        2,
        0,
        1,
        1,
        0,
        -4,
        // bottom right
        "m",
        7,
        -1,
        ...circle2
      ] }
    };
    var aliasGates = {
      add: "+",
      mul: "*",
      sub: "-",
      and: "&",
      or: "|",
      xor: "^",
      andr: "&",
      orr: "|",
      xorr: "^",
      input: "buf1"
    };
    Object.keys(aliasGates).reduce((res, key) => {
      res[key] = gates[aliasGates[key]];
      return res;
    }, gates);
    var gater1 = {
      is: (type) => gates[type] !== void 0,
      render: (type) => ["path", { w: gates[type].w, h: 16, class: "gate", d: gates[type].d }]
    };
    var iec = {
      eq: "==",
      ne: "!=",
      slt: "<",
      sle: "<=",
      sgt: ">",
      sge: ">=",
      ult: "<",
      ule: "<=",
      ugt: ">",
      uge: ">=",
      BUF: 1,
      INV: 1,
      AND: "&",
      NAND: "&",
      OR: "≥1",
      NOR: "≥1",
      XOR: "=1",
      XNOR: "=1",
      box: "",
      CONCAT: "}",
      case: "C",
      casez: "Z",
      casex: "X"
    };
    var circled = { INV: 1, NAND: 1, NOR: 1, XNOR: 1 };
    var gater2 = {
      is: (type) => iec[type] !== void 0,
      render: (type, ymin, ymax) => {
        if (ymin === ymax) {
          ymin = -4;
          ymax = 4;
        }
        return [
          "g",
          { w: 16, h: ymax - ymin + 6 },
          ["path", {
            class: "gate",
            d: ["m", -16, ymin - 3, 16, 0, 0, ymax - ymin + 6, -16, 0, "z", ...circled[type] ? circle : []]
          }],
          ["text", { x: -14, y: 4, class: "wirename" }, ...tspan.parse(iec[type])]
        ];
      }
    };
    var isSlice = (type) => typeof type === "string" && type[0] === "[";
    function drawBody(type, ymin, ymax, fontWidth, attrs) {
      if (gater1.is(type)) {
        return gater1.render(type);
      }
      if (gater2.is(type)) {
        return gater2.render(type, ymin, ymax);
      }
      if (isSlice(type)) {
        const bodyW2 = getLabelWidth(type, fontWidth) + 8;
        return [
          "text",
          { w: bodyW2, h: 16, x: -bodyW2 / 2, y: 4, class: "slicelabel" },
          ...tspan.parse(type)
        ];
      }
      if (type === "MUX") {
        return [
          "g",
          { w: 12, h: 40, o: -8 },
          ["path", { class: "gate", d: [
            "m",
            -12,
            -24,
            12,
            6,
            0,
            20,
            -12,
            6,
            "z",
            "m",
            0,
            40,
            7,
            0,
            "m",
            0,
            0,
            0,
            -11
          ] }],
          ["text", { x: -7, y: -12, class: "bodylabel" }, "0"],
          ["text", { x: -7, y: 2, class: "bodylabel" }, "1"]
        ];
      }
      {
        const m = type.match(/^ff(?<negedge>n)?(?<enable>e)?((?<syncReset>[cp])?(?<syncResetPolarity>n)?)?(?<asyncReset>[rs])?((?<asyncResetPolarity>n)?)?$/);
        if (m) {
          const { negedge, enable, syncReset, syncResetPolarity, asyncReset, asyncResetPolarity } = m.groups;
          const hasNegedge = negedge === "n";
          const hasEnable = enable === "e";
          const hasSyncReset = syncReset !== void 0;
          const hasSyncSet = syncReset === "p";
          const hasSyncResetPolarity = syncResetPolarity === "n";
          const hasAsyncReset = asyncReset !== void 0;
          const hasAsyncSet = asyncReset === "s";
          const hasAsyncResetPolarity = asyncResetPolarity === "n";
          let h = 32;
          if (hasEnable) h += 16;
          if (hasSyncReset) h += 16;
          if (hasSyncSet) h += 16;
          if (hasAsyncReset) h += 16;
          if (hasAsyncSet) h += 16;
          let o = -(h / 2 - 8);
          return [
            "g",
            { w: 32, h, o },
            ["path", { class: "dff", d: [
              "m",
              -32,
              o - 7,
              "h",
              32,
              "v",
              30 + (hasEnable ? 16 : 0) + (hasSyncReset ? 16 : 0) + (hasSyncSet ? 16 : 0),
              "h",
              -32,
              "z",
              "m",
              0,
              19,
              6,
              4,
              -6,
              4,
              // wedge '>'
              ...hasNegedge ? ["m", 0, -4, "a", 3, 3, 0, 1, 1, -6, 0, "a", 3, 3, 0, 1, 1, 6, 0, "z", "m", 0, 4] : [],
              // negedge clock bubble
              ...hasEnable ? ["m", 0, 16] : [],
              // extra offset for enable
              ...hasSyncReset ? [
                "m",
                0,
                16,
                ...hasSyncResetPolarity ? ["m", 0, -4, "a", 3, 3, 0, 1, 1, -6, 0, "a", 3, 3, 0, 1, 1, 6, 0, "z", "m", 0, 4] : []
              ] : [],
              // extra offset for sync reset
              ...hasAsyncReset ? [
                // async reset/set wire extension
                "m",
                0,
                12 + (hasSyncSet ? 16 : 0),
                "h",
                16,
                "m",
                0,
                0,
                "v",
                ...hasAsyncResetPolarity ? [-3, "m", -16, -9] : [-9, "m", -16, -1]
              ] : [],
              ...hasAsyncResetPolarity ? ["m", 16, 3, "a", 3, 3, 0, 1, 1, 0, 6, "a", 3, 3, 0, 1, 1, 0, -6, "z"] : []
              // low-active async reset/set bubble
            ] }],
            // FF label
            ["text", { x: -16, y: o + 4, class: "bodylabel" }, "DFF"],
            // enable label
            ...hasEnable ? [["text", { x: -28, y: o + 36, class: "bodylabel" }, "E"]] : [],
            // sync reset label
            ...hasSyncReset ? [[
              "text",
              { x: -28, y: o + 36 + (hasEnable ? 16 : 0), class: "bodylabel" },
              hasSyncResetPolarity ? ["tspan", { "text-decoration": "overline" }, hasSyncSet ? "P" : "C"] : hasSyncSet ? "P" : "C"
            ]] : [],
            // sync preset value label
            ...hasSyncSet ? [["text", { x: -28, y: o + 36 + (hasEnable ? 16 : 0) + 16, class: "bodylabel" }, "V"]] : [],
            // async reset label
            ...hasAsyncReset ? [[
              "text",
              { x: -16, y: o + 16 + 5 + (hasEnable ? 16 : 0) + (hasSyncReset ? 16 : 0) + (hasSyncSet ? 16 : 0), class: "bodylabel" },
              hasAsyncResetPolarity ? ["tspan", { "text-decoration": "overline" }, hasAsyncSet ? "S" : "R"] : hasAsyncSet ? "S" : "R"
            ]] : [],
            // async set value label
            ...hasAsyncSet ? [["text", { x: -16, y: o + 36 + 16 + (hasEnable ? 16 : 0) + (hasSyncReset ? 16 : 0) + (hasSyncSet ? 16 : 0), class: "bodylabel" }, "INI"]] : []
          ];
        }
      }
      const label = attrs && attrs.imm ? type + " " + attrs.imm : type;
      const bodyW = getLabelWidth(label, fontWidth);
      return [
        "g",
        { w: bodyW, h: 16 },
        ["rect", { class: "gate", x: -bodyW, y: -8, width: bodyW, height: 16 }],
        ["text", { x: -bodyW / 2, y: 4, class: "bodylabel" }, ...tspan.parse(label)]
      ];
    }
    module2.exports = drawBody;
    module2.exports.isShape = (type) => gater1.is(type);
  }
});

// node_modules/logidrom/lib/draw_gate.js
var require_draw_gate = __commonJS({
  "node_modules/logidrom/lib/draw_gate.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var drawBody = require_draw_body();
    var { widther } = require_tree_utils();
    var INPUT_SPACING = 16;
    var SHAPE_BODY_HALF_H = 10;
    function drawGate(spec, attrs) {
      const nInputs = spec.length - 2;
      const [gateX, gateY] = spec[1];
      const ret = ["g"];
      const isShapeGate = drawBody.isShape(spec[0]);
      const targetYs = Array.from({ length: nInputs }, () => 0);
      if (nInputs) {
        if (isShapeGate && nInputs > 2) {
          for (let i = 0; i < nInputs; i++) {
            targetYs[i] = spec[2 + i][1];
          }
        } else {
          const baseYs = [];
          for (let r = 0; r < nInputs; r++) {
            baseYs.push(gateY + (r - (nInputs - 1) / 2) * INPUT_SPACING);
          }
          const order = [];
          for (let i = 0; i < nInputs; i++) order.push(i);
          order.sort((a, b) => {
            const ca = spec[2 + a][1];
            const cb = spec[2 + b][1];
            return ca - cb;
          });
          for (let rank = 0; rank < nInputs; rank++) {
            const idx = order[rank];
            targetYs[idx] = baseYs[rank];
          }
        }
      }
      const ymin = nInputs ? Math.min.apply(null, targetYs) : gateY;
      const ymax = nInputs ? Math.max.apply(null, targetYs) : gateY;
      const body = drawBody(spec[0], ymin - gateY, ymax - gateY, void 0, attrs);
      const bodyHalfL = body[1].w || 0;
      if (nInputs <= 2 || isShapeGate) {
        for (let i = 0; i < nInputs; i++) {
          const [cx, cy, cw] = spec[2 + i];
          const ty = targetYs[i];
          const runLen = gateX - cx - bodyHalfL;
          let d;
          if (cy === ty) {
            d = "M" + cx + "," + cy + " h" + runLen;
          } else {
            const half2 = runLen / 2;
            d = "M" + cx + "," + cy + " h" + half2 + " v" + (ty - cy) + " h" + half2;
          }
          const path = ["path", { d, class: ["wire", widther(cw)] }];
          if (cw > 1) path.push(["title", cw + " bits"]);
          ret.push(path);
        }
      } else {
        const inputs = [];
        for (let i2 = 0; i2 < nInputs; i2++) {
          const [cx, cy, cw] = spec[2 + i2];
          const ty = targetYs[i2];
          inputs.push({ cx, cy, cw, ty });
        }
        const backBaseX = gateX - bodyHalfL;
        let i = 0;
        for (; i < nInputs; i++) {
          const inp = inputs[i];
          const d = ["M", inp.cx, inp.cy];
          const deltaY = inp.ty - inp.cy;
          if (deltaY < 0) break;
          if (deltaY === 0) {
            d.push("H", backBaseX);
          } else {
            const x = backBaseX - (i + 1) * 8;
            d.push("H", x, "V", inp.ty, "H", backBaseX);
          }
          const path = ["path", { d, class: ["wire", widther(inp.cw)] }];
          if (inp.cw > 1) path.push(["title", inp.cw + " bits"]);
          ret.push(path);
        }
        for (let j = nInputs - 1; j >= i; j--) {
          const inp = inputs[j];
          const d = ["M", inp.cx, inp.cy];
          const channelIdx = nInputs - 1 - j;
          const x = backBaseX - (channelIdx + 1) * 8;
          d.push("H", x, "V", inp.ty, "H", backBaseX);
          const path = ["path", { d, class: ["wire", widther(inp.cw)] }];
          if (inp.cw > 1) path.push(["title", inp.cw + " bits"]);
          ret.push(path);
        }
      }
      if (nInputs > 2 && isShapeGate) {
        let bodyHalfH = SHAPE_BODY_HALF_H;
        if (Array.isArray(body) && body.length > 1 && body[1] && typeof body[1] === "object" && !Array.isArray(body[1])) {
          if (typeof body[1].h === "number") {
            bodyHalfH = Math.round(body[1].h / 2);
          }
        }
        bodyHalfH = Math.round(bodyHalfH / 8) * 8;
        const bodyTop = gateY - bodyHalfH - 4;
        const bodyBottom = gateY + bodyHalfH + 4;
        const backX = gateX - bodyHalfL;
        let topY = Infinity;
        let bottomY = -Infinity;
        for (let i = 0; i < nInputs; i++) {
          const ty = targetYs[i];
          if (ty < bodyTop && ty < topY) topY = ty;
          if (ty > bodyBottom && ty > bottomY) bottomY = ty;
        }
        const parts = [];
        if (topY < Infinity) {
          parts.push("M" + backX + "," + topY + " V" + bodyTop);
        }
        if (bottomY > -Infinity) {
          parts.push("M" + backX + "," + bodyBottom + " V" + bottomY);
        }
        if (parts.length) {
          ret.push(["path", { class: "gate", d: parts.join(" ") }]);
        }
      }
      ret.push([
        "g",
        { transform: "translate(" + gateX + "," + gateY + ")" },
        ["title", ...tspan.parse(spec[0])],
        body
      ]);
      return ret;
    }
    module2.exports = drawGate;
  }
});

// node_modules/logidrom/lib/draw_boxes.js
var require_draw_boxes = __commonJS({
  "node_modules/logidrom/lib/draw_boxes.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var drawGate = require_draw_gate();
    var drawBody = require_draw_body();
    var { getLabelWidth, CHAR_WIDTH_PX } = require_font_metrics();
    var { firstChildIdx, getAttrs, getWidth, widther, leafDisplay, outDisplay, outTooltip, inlineDisplay, isPinOp, pinLabel, pinLabels } = require_tree_utils();
    var LEAF_PAD_X = 4;
    var LEAF_HALF_H = 8;
    var INLINE_MIN_BOX_W = 32;
    var OUT_MIN_BOX_W = 32;
    var MIN_PASSTHRU_PX = 48;
    var textWidth = (s, fontWidth) => Math.ceil(String(s || "").length * (fontWidth || CHAR_WIDTH_PX));
    function portBoxWidth(gwInst, gwPin) {
      return gwInst + gwPin + 24;
    }
    function dirInBoxWidth(gw) {
      return gw + 14;
    }
    function dirOutBoxWidth(gw) {
      return gw + 16;
    }
    function pinPortPathD(gwPin) {
      return [
        "m",
        -gwPin - 14,
        -8,
        "l",
        6,
        8,
        "l",
        -6,
        8,
        "h",
        gwPin + 14,
        "v",
        -16,
        "z"
      ];
    }
    function pinBindPathD(gwInst, gwPin) {
      return [
        "m",
        -gwPin - 16,
        -8,
        "l",
        6,
        8,
        "l",
        -6,
        8,
        "h",
        -gwInst,
        "a",
        8,
        8,
        0,
        1,
        1,
        0,
        -16,
        "z"
      ];
    }
    function poutBindPathD(gwInst) {
      return [
        "m",
        -gwInst - 14,
        -8,
        "l",
        6,
        8,
        "l",
        -6,
        8,
        "h",
        gwInst + 6,
        "a",
        8,
        8,
        0,
        1,
        0,
        0,
        -16,
        "z"
      ];
    }
    function poutPortPathD(gwInst, gwPin) {
      return [
        "m",
        -gwInst - 16,
        -8,
        "l",
        6,
        8,
        "l",
        -6,
        8,
        "h",
        -gwPin - 8,
        "v",
        -16,
        "z"
      ];
    }
    function dirInPathD(gw) {
      return [
        "m",
        -gw - 14,
        -8,
        "l",
        6,
        8,
        "l",
        -6,
        8,
        "h",
        gw + 14,
        "v",
        -16,
        "z"
      ];
    }
    function dirOutPathD(gw) {
      return [
        "m",
        -6,
        8,
        "l",
        6,
        -8,
        "l",
        -6,
        -8,
        "h",
        -gw - 10,
        "v",
        16,
        "z"
      ];
    }
    function applyNavAttrs(groupAttrs, attrs) {
      if (!attrs) return;
      if (attrs.nodeId || attrs.siteKey) {
        groupAttrs.class = (groupAttrs.class ? groupAttrs.class + " " : "") + "rtl-node";
        if (attrs.nodeId) groupAttrs["data-node-id"] = attrs.nodeId;
        if (attrs.siteKey) groupAttrs["data-site-key"] = attrs.siteKey;
        if (attrs.module) groupAttrs["data-module"] = attrs.module;
        if (attrs.name) groupAttrs["data-name"] = attrs.name;
        if (attrs.loc) groupAttrs["data-loc"] = attrs.loc;
      }
    }
    function drawPortBox(tree, fx, fy, fontWidth) {
      const op = tree[0].name;
      const attrs = getAttrs(tree) || {};
      const labels = pinLabels(op, attrs);
      const gwInst = textWidth(labels.instance, fontWidth);
      const gwPin = textWidth(labels.pin, fontWidth);
      const tooltip = pinLabel(op, attrs) || "";
      const isPout = op === "pout";
      const portD = isPout ? poutPortPathD(gwInst, gwPin) : pinPortPathD(gwPin);
      const bindD = isPout ? poutBindPathD(gwInst) : pinBindPathD(gwInst, gwPin);
      let xLabelInst, xLabelPin;
      if (isPout) {
        xLabelInst = -Math.round((gwInst + 10) / 2);
        xLabelPin = -Math.round((2 * gwInst + gwPin + 40) / 2);
      } else {
        xLabelPin = -Math.round((gwPin + 10) / 2);
        xLabelInst = -Math.round((2 * gwPin + gwInst + 32) / 2);
      }
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      applyNavAttrs(groupAttrs, attrs);
      return [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(tooltip)],
        ["path", { class: "port", d: portD }],
        ["path", { class: "bind", d: bindD }],
        ["text", { x: xLabelInst, y: 4, class: "bodylabel" }, ...tspan.parse(labels.instance)],
        ["text", { x: xLabelPin, y: 4, class: "bodylabel" }, ...tspan.parse(labels.pin)]
      ];
    }
    function drawDirInBox(label, attrs, fx, fy, fontWidth) {
      const gw = textWidth(label, fontWidth);
      const d = dirInPathD(gw);
      const xLabel = -Math.round((gw + 10) / 2);
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      applyNavAttrs(groupAttrs, attrs);
      return [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(label)],
        ["path", { class: "port", d }],
        ["text", { x: xLabel, y: 4, class: "bodylabel" }, ...tspan.parse(label)]
      ];
    }
    function drawDirOutBox(label, attrs, fx, fy, fontWidth) {
      const gw = textWidth(label, fontWidth);
      const d = dirOutPathD(gw);
      const xLabel = -Math.round((gw + 20) / 2);
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      applyNavAttrs(groupAttrs, attrs);
      return [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(label)],
        ["path", { class: "port", d }],
        ["text", { x: xLabel, y: 4, class: "bodylabel" }, ...tspan.parse(label)]
      ];
    }
    function leafNodeOf(branch) {
      return Array.isArray(branch) ? branch[0] : branch;
    }
    function drawLeaf(branch, fontWidth) {
      const node = leafNodeOf(branch);
      const displayName = leafDisplay(branch);
      const fx = node.fx;
      const fy = node.fy;
      const attrs = getAttrs(branch) || {};
      if (Array.isArray(branch) && isPinOp(node.name)) {
        return drawPortBox(branch, fx, fy, fontWidth);
      }
      if (attrs.dir === "in") {
        return drawDirInBox(displayName, attrs, fx, fy, fontWidth);
      }
      const boxW = getLabelWidth(displayName, fontWidth) + 2 * LEAF_PAD_X;
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      if (attrs.nodeId || attrs.siteKey) {
        groupAttrs.class = "rtl-node";
        if (attrs.nodeId) groupAttrs["data-node-id"] = attrs.nodeId;
        if (attrs.siteKey) groupAttrs["data-site-key"] = attrs.siteKey;
        if (attrs.module) groupAttrs["data-module"] = attrs.module;
        if (attrs.name) groupAttrs["data-name"] = attrs.name;
        if (attrs.loc) groupAttrs["data-loc"] = attrs.loc;
      }
      return [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(node.name)],
        ["rect", {
          class: "siglabel",
          x: -boxW,
          y: -LEAF_HALF_H,
          width: boxW,
          height: 2 * LEAF_HALF_H
        }],
        ["text", { x: -LEAF_PAD_X, y: 4, class: "pinname" }, ...tspan.parse(displayName)]
      ];
    }
    function outBoxWidth(displayName, fontWidth) {
      return Math.max(getLabelWidth(displayName, fontWidth) + 2 * LEAF_PAD_X, OUT_MIN_BOX_W);
    }
    function drawOutLabel(tree, fx, fy, fontWidth) {
      const displayName = outDisplay(tree);
      const tooltip = outTooltip(tree);
      const boxW = outBoxWidth(displayName, fontWidth);
      const attrs = getAttrs(tree) || {};
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      if (attrs.nodeId) {
        groupAttrs.class = "rtl-node";
        groupAttrs["data-node-id"] = attrs.nodeId;
        if (attrs.module) groupAttrs["data-module"] = attrs.module;
        if (attrs.name) groupAttrs["data-name"] = attrs.name;
        if (attrs.loc) groupAttrs["data-loc"] = attrs.loc;
      }
      const group = [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(tooltip)],
        ["rect", {
          class: "siglabel",
          x: 0,
          y: -LEAF_HALF_H,
          width: boxW,
          height: 2 * LEAF_HALF_H
        }]
      ];
      if (displayName) {
        group.push(["text", { x: LEAF_PAD_X, y: 4, class: "wirename" }, ...tspan.parse(displayName)]);
      }
      return group;
    }
    function inlineBoxWidth(visibleName, fontWidth) {
      if (!visibleName) return 16;
      return Math.max(getLabelWidth(visibleName, fontWidth) + 2 * LEAF_PAD_X, INLINE_MIN_BOX_W);
    }
    function drawInlineBox(tree, fx, fy, fontWidth) {
      const attrs = getAttrs(tree) || {};
      const start = firstChildIdx(tree);
      const nameBranch = tree[start];
      const node = leafNodeOf(nameBranch);
      const visibleName = node && node.name || "";
      const displayName = inlineDisplay(tree);
      const tooltip = attrs.label || visibleName;
      const boxW = inlineBoxWidth(displayName, fontWidth);
      const groupAttrs = { transform: "translate(" + fx + "," + fy + ")" };
      if (attrs.nodeId) {
        groupAttrs.class = "rtl-node";
        groupAttrs["data-node-id"] = attrs.nodeId;
        if (attrs.module) groupAttrs["data-module"] = attrs.module;
        if (attrs.name) groupAttrs["data-name"] = attrs.name;
        if (attrs.loc) groupAttrs["data-loc"] = attrs.loc;
      }
      const group = [
        "g",
        groupAttrs,
        ["title", ...tspan.parse(tooltip)],
        ["rect", {
          class: "siglabel",
          x: -boxW,
          y: -LEAF_HALF_H,
          width: boxW,
          height: 2 * LEAF_HALF_H
        }]
      ];
      if (displayName) {
        group.push(["text", { x: -boxW / 2, y: 4, class: "bodylabel" }, ...tspan.parse(displayName)]);
      }
      return group;
    }
    function shiftFxSubtree(branch, delta) {
      if (!branch) return;
      if (Array.isArray(branch)) {
        const node = leafNodeOf(branch);
        if (node && typeof node.fx === "number") node.fx -= delta;
        const start = firstChildIdx(branch);
        const ilen = branch.length;
        for (let i = start; i < ilen; i++) {
          shiftFxSubtree(branch[i], delta);
        }
      } else if (typeof branch === "object") {
        if (typeof branch.fx === "number") branch.fx -= delta;
      }
    }
    function childSpec(branch, fontWidth) {
      if (Array.isArray(branch) && branch[0]) {
        const op = branch[0].name;
        const start = firstChildIdx(branch);
        const isEq = op === "=" && branch.length > start + 1;
        const isPin = isPinOp(op) && branch.length > start;
        if (isEq || isPin) {
          const exprBranch = isPin ? branch[start] : branch[start + 1];
          const [, exprFy] = childSpec(exprBranch, fontWidth);
          const node2 = leafNodeOf(branch);
          return [node2.fx, exprFy, getWidth(branch)];
        }
      }
      const node = leafNodeOf(branch);
      let fx = node.fx;
      let fy = node.fy;
      if (node && typeof node.name === "string") {
        const body = drawBody(node.name, 0, 0, fontWidth);
        const o = body[1].o;
        fy += o || 0;
      }
      return [fx, fy, getWidth(branch)];
    }
    function drawAssign(tree, xmax, start, isRoot, fontWidth) {
      const op = tree[0].name;
      const pinOp = isPinOp(op);
      const attrs = getAttrs(tree) || {};
      const dir = attrs.dir;
      const gateFx = tree[0].fx;
      const nameBranch = pinOp ? null : tree[start];
      const exprBranch = pinOp ? tree[start] : tree[start + 1];
      let [exprFx, exprFy] = childSpec(exprBranch, fontWidth);
      const exprW = getWidth(exprBranch);
      let boxW = 0;
      let shapeKind;
      if (pinOp) {
        const labels = pinLabels(op, attrs);
        boxW = portBoxWidth(
          textWidth(labels.instance, fontWidth),
          textWidth(labels.pin, fontWidth)
        );
        shapeKind = "port";
      } else if (dir === "out") {
        boxW = dirOutBoxWidth(textWidth(outDisplay(tree), fontWidth));
        shapeKind = "dir-out";
      } else if (dir === "in") {
        boxW = dirInBoxWidth(textWidth(outDisplay(tree), fontWidth));
        shapeKind = "dir-in";
      } else if (!isRoot) {
        const node = leafNodeOf(nameBranch);
        const visibleName = node && node.name || "";
        boxW = inlineBoxWidth(visibleName, fontWidth);
        shapeKind = "inline";
      } else {
        shapeKind = "out";
      }
      if (!isRoot && boxW > 0) {
        const gap = gateFx - exprFx;
        const need = boxW + MIN_PASSTHRU_PX - gap;
        if (need > 0) {
          shiftFxSubtree(exprBranch, need);
          [exprFx, exprFy] = childSpec(exprBranch, fontWidth);
        }
      }
      const ret = ["g"];
      const shapeFy = exprFy;
      const passthruEndX = isRoot ? gateFx : gateFx - boxW;
      let passthruD;
      if (exprFy === shapeFy) {
        passthruD = "M" + exprFx + "," + exprFy + " H" + passthruEndX;
      } else {
        const half2 = (passthruEndX - exprFx) / 2;
        passthruD = "M" + exprFx + "," + exprFy + " h" + half2 + " v" + (shapeFy - exprFy) + " h" + half2;
      }
      const passthru = ["path", {
        d: passthruD,
        class: ["wire", widther(exprW)]
      }];
      if (exprW > 1) passthru.push(["title", exprW + " bits"]);
      ret.push(passthru);
      ret.push(drawBoxes(exprBranch, xmax, false, fontWidth));
      const shapeAnchorX = isRoot ? gateFx + boxW : gateFx;
      ret.push(drawShape(shapeKind, tree, attrs, shapeAnchorX, gateFx, shapeFy, fontWidth));
      return ret;
    }
    function drawShape(shapeKind, tree, attrs, shapeAnchorX, gateFx, shapeFy, fontWidth) {
      switch (shapeKind) {
        case "port":
          return drawPortBox(tree, shapeAnchorX, shapeFy, fontWidth);
        case "dir-out":
          return drawDirOutBox(outDisplay(tree), attrs, shapeAnchorX, shapeFy, fontWidth);
        case "dir-in":
          return drawDirInBox(outDisplay(tree), attrs, shapeAnchorX, shapeFy, fontWidth);
        case "inline":
          return drawInlineBox(tree, gateFx, shapeFy, fontWidth);
        default:
          return drawOutLabel(tree, gateFx, shapeFy, fontWidth);
      }
    }
    var drawBoxesCallCount = 0;
    var MAX_DRAWBOXES_CALLS = 1e6;
    function resetDrawBoxesCallCount() {
      drawBoxesCallCount = 0;
    }
    function drawBoxes(tree, xmax, isRoot, fontWidth) {
      drawBoxesCallCount++;
      if (drawBoxesCallCount > MAX_DRAWBOXES_CALLS) {
        if (typeof console !== "undefined" && console.error) {
          console.error("drawBoxes exceeded " + MAX_DRAWBOXES_CALLS + " calls - possible infinite loop");
        }
        throw new Error("drawBoxes exceeded " + MAX_DRAWBOXES_CALLS + " calls");
      }
      if (Array.isArray(tree)) {
        const start = firstChildIdx(tree);
        const ilen = tree.length;
        if (ilen === start) {
          return ["g", drawLeaf(tree, fontWidth)];
        }
        if (tree[0].name === "=" && ilen > start + 1) {
          return drawAssign(tree, xmax, start, isRoot, fontWidth);
        }
        if (isPinOp(tree[0].name) && ilen > start) {
          return drawAssign(tree, xmax, start, isRoot, fontWidth);
        }
        const spec = [];
        spec.push(tree[0].name);
        spec.push([tree[0].fx, tree[0].fy, getWidth(tree)]);
        for (let i = start; i < ilen; i++) {
          spec.push(childSpec(tree[i], fontWidth));
        }
        const ret = ["g", drawGate(spec, getAttrs(tree))];
        for (let i = start; i < ilen; i++) {
          ret.push(drawBoxes(tree[i], xmax, false, fontWidth));
        }
        return ret;
      }
      return ["g", drawLeaf(tree, fontWidth)];
    }
    module2.exports = drawBoxes;
    module2.exports.resetCallCount = resetDrawBoxesCallCount;
    module2.exports.portBoxWidth = portBoxWidth;
    module2.exports.dirInBoxWidth = dirInBoxWidth;
    module2.exports.dirOutBoxWidth = dirOutBoxWidth;
    module2.exports.textWidth = textWidth;
  }
});

// node_modules/logidrom/lib/insert-svg-template-assign.js
var require_insert_svg_template_assign = __commonJS({
  "node_modules/logidrom/lib/insert-svg-template-assign.js"(exports2, module2) {
    "use strict";
    function insertSVGTemplateAssign() {
      return ["style", ".pinname {font-size:12px; font-style:normal; font-variant:normal; font-weight:500; font-stretch:normal; text-align:center; text-anchor:end; font-family:monospace} .wirename {font-size:12px; font-style:normal; font-variant:normal; font-weight:500; font-stretch:normal; text-align:center; text-anchor:start; font-family:monospace} .wirename:hover {fill:blue} .gate {color:#000; fill:#aaa; fill-opacity: 1;stroke:#000; stroke-width:1; stroke-opacity:1} .dff {color:#000; fill:#777; fill-opacity: 1; stroke:#000; stroke-width:1; stroke-opacity:1} .dff:hover {fill:#ff7 !important; } .gate:hover {fill:red !important; } .port {color:#000; fill:#cce; fill-opacity:1; stroke:#000; stroke-width:1; stroke-opacity:1} .port:hover {fill:#aaf !important; } .bind {color:#000; fill:#ecc; fill-opacity:1; stroke:#000; stroke-width:1; stroke-opacity:1} .bind:hover {fill:#faa !important; } .siglabel {fill:#eee; fill-opacity:1; stroke:#ccc; stroke-width:1} .slicelabel {font-size:12px; font-family:monospace; text-anchor:middle; font-weight:500; paint-order:stroke; stroke:#fff; stroke-width:3; fill:#000} .bodylabel {font-size:12px; font-family:monospace; text-anchor:middle; font-weight:500; fill:#000} .wire {fill:none; stroke:#000; stroke-width:1; stroke-opacity:1} .wire.vector {stroke-width:3} .wire.zeroer {stroke-width:0.5; stroke-dasharray:2,2} .grid {fill:#fff; fill-opacity:1; stroke:none}"];
    }
    module2.exports = insertSVGTemplateAssign;
  }
});

// node_modules/logidrom/lib/render-assign.js
var require_render_assign = __commonJS({
  "node_modules/logidrom/lib/render-assign.js"(exports2, module2) {
    "use strict";
    var render = require_render();
    var drawBoxes = require_draw_boxes();
    var drawBody = require_draw_body();
    var insertSVGTemplateAssign = require_insert_svg_template_assign();
    var { getLabelWidth } = require_font_metrics();
    var { firstChildIdx, getAttrs, leafDisplay, outDisplay, inlineDisplay, isPinOp, pinLabels } = require_tree_utils();
    var { portBoxWidth, dirInBoxWidth, dirOutBoxWidth, textWidth } = drawBoxes;
    var grid = 32;
    var ceilGrid = (n) => grid * Math.ceil(n / grid);
    var BOX_PAD_X = 4;
    var MIN_BOX_W = 32;
    var MIN_PASSTHRU_PX = 48;
    var boxW = (visible, fontWidth) => Math.max(getLabelWidth(visible, fontWidth) + 2 * BOX_PAD_X, MIN_BOX_W);
    var outBoxW = (tree, fontWidth) => boxW(outDisplay(tree), fontWidth);
    var leafBoxW = (visible, fontWidth) => getLabelWidth(visible, fontWidth) + 2 * BOX_PAD_X;
    var inlineBoxW = (visible, fontWidth) => visible ? boxW(visible, fontWidth) : 16;
    var leafNodeOf = (branch) => Array.isArray(branch) ? branch[0] : branch;
    var gateSize = (type, fontWidth, attrs) => {
      const body = drawBody(type, 0, 0, fontWidth, attrs);
      return {
        w: body[1].w || 0,
        h: body[1].h || 0
      };
    };
    var eqBoxW = (node, fontWidth, midTree) => {
      const attrs = getAttrs(node) || {};
      if (attrs.dir === "out") return dirOutBoxWidth(textWidth(outDisplay(node), fontWidth));
      if (attrs.dir === "in") return dirInBoxWidth(textWidth(outDisplay(node), fontWidth));
      return midTree ? inlineBoxW(inlineDisplay(node), fontWidth) : outBoxW(node, fontWidth);
    };
    var portBoxW = (node, fontWidth) => {
      const attrs = getAttrs(node) || {};
      const labels = pinLabels(node[0].name, attrs);
      return portBoxWidth(
        textWidth(labels.instance, fontWidth),
        textWidth(labels.pin, fontWidth)
      );
    };
    var leafConeW = (node, fontWidth) => {
      const op = node[0] && node[0].name;
      if (isPinOp(op)) return portBoxW(node, fontWidth);
      const attrs = getAttrs(node);
      if (attrs && attrs.dir === "in") {
        return dirInBoxWidth(textWidth(leafDisplay(node), fontWidth));
      }
      return leafBoxW(leafDisplay(node), fontWidth);
    };
    var measureExtents = (node, acc, isRoot, fontWidth) => {
      if (!Array.isArray(node)) {
        const fx = node && typeof node.fx === "number" ? node.fx : 0;
        acc.left = Math.max(acc.left, leafBoxW(leafDisplay(node), fontWidth) - fx);
        return;
      }
      const start = firstChildIdx(node);
      const ilen = node.length;
      if (ilen === start) {
        const fx = node[0].fx || 0;
        acc.left = Math.max(acc.left, leafConeW(node, fontWidth) - fx);
        return;
      }
      if (node[0].name === "=" && ilen > start + 1) {
        if (isRoot) {
          acc.root = Math.max(acc.root, eqBoxW(node, fontWidth, false));
        } else {
          const fx = node[0].fx || 0;
          acc.left = Math.max(acc.left, eqBoxW(node, fontWidth, true) - fx);
        }
        measureExtents(node[start + 1], acc, false, fontWidth);
        return;
      }
      if (isPinOp(node[0].name) && ilen > start) {
        const w = portBoxW(node, fontWidth);
        if (isRoot) {
          acc.root = Math.max(acc.root, w);
        } else {
          const fx = node[0].fx || 0;
          acc.left = Math.max(acc.left, w - fx);
        }
        measureExtents(node[start], acc, false, fontWidth);
        return;
      }
      for (let i = start; i < ilen; i++) {
        measureExtents(node[i], acc, false, fontWidth);
      }
    };
    var getNumChannels = (node) => {
      let downward = 0;
      let upward = 0;
      const y = node[0].y;
      const start = firstChildIdx(node);
      const ilen = node.length;
      for (let i = start; i < ilen; i++) {
        const child = node[i];
        if (!Array.isArray(child)) continue;
        const inputYdx = y + (i - start - (ilen - start - 1) / 2) * 2;
        if (child[0].y > inputYdx) {
          downward++;
        } else if (child[0].y < inputYdx) {
          upward++;
        }
      }
      const nChannels = Math.max(downward, upward);
      return nChannels;
    };
    var collectSlacks = (node, slacks, fontWidth) => {
      if (!Array.isArray(node)) return;
      const start = firstChildIdx(node);
      const ilen = node.length;
      const nChildren = ilen - start;
      if (nChildren > 0) {
        const name = node[0].name;
        if (name === "=") {
          if (nChildren > 1) collectSlacks(node[start + 1], slacks, fontWidth);
          return;
        }
        if (isPinOp(name)) {
          if (nChildren > 0) collectSlacks(node[start], slacks, fontWidth);
          return;
        }
        const { w } = gateSize(name, fontWidth, getAttrs(node));
        const routingSpace = drawBody.isShape(name) ? 0 : getNumChannels(node) * 8;
        const extra = w + routingSpace - (grid + 1 >> 1);
        if (extra > 0) {
          const col = node[0].x;
          slacks[col] = Math.max(slacks[col] || 0, extra);
        }
      }
      for (let i = start; i < ilen; i++) {
        collectSlacks(node[i], slacks, fontWidth);
      }
    };
    var shiftFxSubtree = (branch, delta) => {
      if (!branch) return;
      if (Array.isArray(branch)) {
        const node = leafNodeOf(branch);
        if (node && typeof node.fx === "number") node.fx -= delta;
        const start = firstChildIdx(branch);
        const ilen = branch.length;
        for (let i = start; i < ilen; i++) {
          shiftFxSubtree(branch[i], delta);
        }
      } else if (typeof branch === "object") {
        if (typeof branch.fx === "number") branch.fx -= delta;
      }
    };
    var shiftInlineExprs = (node, isRoot, fontWidth) => {
      if (!Array.isArray(node)) return;
      const start = firstChildIdx(node);
      const ilen = node.length;
      const op = node[0].name;
      if (op === "=" && ilen > start + 1) {
        if (!isRoot) {
          const exprBranch = node[start + 1];
          const exprNode = leafNodeOf(exprBranch);
          const gap = node[0].fx - exprNode.fx;
          const need = eqBoxW(node, fontWidth, true) + MIN_PASSTHRU_PX - gap;
          if (need > 0) {
            shiftFxSubtree(exprBranch, need);
          }
        }
        shiftInlineExprs(node[start + 1], false, fontWidth);
        return;
      }
      if (isPinOp(op) && ilen > start) {
        if (!isRoot) {
          const exprBranch = node[start];
          const exprNode = leafNodeOf(exprBranch);
          const gap = node[0].fx - exprNode.fx;
          const need = portBoxW(node, fontWidth) + MIN_PASSTHRU_PX - gap;
          if (need > 0) {
            shiftFxSubtree(exprBranch, need);
          }
        }
        shiftInlineExprs(node[start], false, fontWidth);
        return;
      }
      for (let i = start; i < ilen; i++) {
        shiftInlineExprs(node[i], false, fontWidth);
      }
    };
    var computeTrailing = (slacks, xmax) => {
      const trailing = Array.from({ length: xmax + 1 }, () => 0);
      for (let x = xmax - 1; x >= 0; x--) {
        trailing[x] = trailing[x + 1] + (slacks[x] || 0);
      }
      return trailing;
    };
    var pixelFx = (x, xmax, trailing) => 32 * (xmax - x) + (trailing[x] || 0);
    var setNodeFxFy = (layoutNode, xmax, trailing) => {
      layoutNode.fx = pixelFx(layoutNode.x, xmax, trailing);
      layoutNode.fy = 8 * layoutNode.y;
    };
    var assignFx = (node, xmax, trailing) => {
      if (!Array.isArray(node)) {
        setNodeFxFy(node, xmax, trailing);
        return;
      }
      const start = firstChildIdx(node);
      const ilen = node.length;
      setNodeFxFy(node[0], xmax, trailing);
      if (node[0].name === "=" && ilen > start + 1) {
        const nameBranch = node[start];
        const nameNode = Array.isArray(nameBranch) ? nameBranch[0] : nameBranch;
        setNodeFxFy(nameNode, xmax, trailing);
        assignFx(node[start + 1], xmax, trailing);
        return;
      }
      for (let i = start; i < ilen; i++) {
        assignFx(node[i], xmax, trailing);
      }
    };
    function renderAssign(index, source) {
      if (drawBoxes.resetCallCount) drawBoxes.resetCallCount();
      let state = { x: 0, y: 2, xmax: 0 };
      const tree = source.assign;
      const config = source.config || {};
      const fontWidth = config.fontWidth || 7.23;
      const treeSpacing = config.treeSpacing || 16;
      const ilen = tree.length;
      const treeSpacingY = Math.round(treeSpacing / 8);
      for (let i = 0; i < ilen; i++) {
        state = render(tree[i], state);
        state.x++;
        if (i < ilen - 1) {
          state.y += treeSpacingY;
        }
      }
      const xmax = state.xmax;
      const trailings = Array.from({ length: ilen }, () => 0);
      let totalSlack = 0;
      for (let i = 0; i < ilen; i++) {
        const slacks = [];
        collectSlacks(tree[i], slacks, fontWidth);
        const trailing = computeTrailing(slacks, xmax);
        trailings[i] = trailing;
        const coneSlack = trailing[0] || 0;
        if (coneSlack > totalSlack) totalSlack = coneSlack;
      }
      const acc = { left: 0, root: 0 };
      for (let i = 0; i < ilen; i++) {
        assignFx(tree[i], xmax, trailings[i]);
        shiftInlineExprs(tree[i], true, fontWidth);
        measureExtents(tree[i], acc, true, fontWidth);
      }
      const leftPad = ceilGrid(Math.max(0, acc.left));
      const rightPad = ceilGrid(Math.max(0, acc.root - (grid + 1)));
      const svg = ["g"];
      for (let i = 0; i < ilen; i++) {
        svg.push(drawBoxes(tree[i], xmax, true, fontWidth));
      }
      const width = leftPad + 32 * (xmax + 1) + 1 + rightPad + totalSlack;
      const height = 8 * (state.y + 1) - 7;
      return [
        "svg",
        {
          id: "svgcontent_" + index,
          viewBox: "0 0 " + width + " " + height,
          width,
          height
        },
        ...index === 0 ? [insertSVGTemplateAssign()] : [],
        ["g", { transform: "translate(" + (leftPad + 0.5) + ", 0.5)" }, svg]
      ];
    }
    module2.exports = renderAssign;
  }
});

// node_modules/bit-field/lib/render.js
var require_render2 = __commonJS({
  "node_modules/bit-field/lib/render.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var round3 = Math.round;
    var getSVG = (w, h) => ["svg", {
      xmlns: "http://www.w3.org/2000/svg",
      // TODO link ns?
      width: w,
      height: h,
      viewBox: [0, 0, w, h].join(" ")
    }];
    var tt = (x, y, obj) => Object.assign(
      { transform: "translate(" + x + (y ? "," + y : "") + ")" },
      typeof obj === "object" ? obj : {}
    );
    var colors = {
      // TODO compare with WaveDrom
      2: "#ff0000",
      // 'hsl(0,100%,50%)'
      3: "#aaff00",
      // 'hsl(80,100%,50%)'
      4: "#00ffd5",
      // 'hsl(170,100%,50%)'
      5: "#ffbf00",
      // 'hsl(45,100%,50%)'
      6: "#00ff19",
      // 'hsl(126,100%,50%)'
      7: "#006aff"
      // 'hsl(215,100%,50%)'
    };
    var typeStyle = (t) => colors[t] !== void 0 ? ";fill:" + colors[t] : "";
    var norm = (obj, other) => Object.assign(
      Object.keys(obj).reduce((prev, key) => {
        const val = Number(obj[key]);
        const valInt = isNaN(val) ? 0 : Math.round(val);
        if (valInt !== 0) {
          prev[key] = valInt;
        }
        return prev;
      }, {}),
      other
    );
    var trimText = (text2, availableSpace, charWidth) => {
      if (!(typeof text2 === "string" || text2 instanceof String))
        return text2;
      const textWidth = text2.length * charWidth;
      if (textWidth <= availableSpace)
        return text2;
      var end = text2.length - (textWidth - availableSpace) / charWidth - 3;
      if (end > 0)
        return text2.substring(0, round3(end)) + "...";
      return text2.substring(0, 1) + "...";
    };
    var text = (body, x, y, rotate) => {
      const props = { y: 6 };
      if (rotate !== void 0) {
        props.transform = "rotate(" + rotate + ")";
      }
      return ["g", tt(round3(x), round3(y)), ["text", props].concat(tspan.parse(body))];
    };
    var hline = (len2, x, y) => ["line", norm({ x1: x, x2: x + len2, y1: y, y2: y })];
    var vline = (len2, x, y) => ["line", norm({ x1: x, x2: x, y1: y, y2: y + len2 })];
    var getLabel = (val, x, y, step, len2, rotate) => {
      if (typeof val !== "number") {
        return text(val, x, y, rotate);
      }
      const res = ["g", {}];
      for (let i = 0; i < len2; i++) {
        res.push(text(
          val >> i & 1,
          x + step * (len2 / 2 - i - 0.5),
          y
        ));
      }
      return res;
    };
    var getAttr = (e, opt, step, lsbm, msbm) => {
      const x = opt.vflip ? step * ((msbm + lsbm) / 2) : step * (opt.mod - (msbm + lsbm) / 2 - 1);
      if (!Array.isArray(e.attr)) {
        return getLabel(e.attr, x, 0, step, e.bits);
      }
      return e.attr.reduce(
        (prev, a, i) => a === void 0 || a === null ? prev : prev.concat([getLabel(a, x, opt.fontsize * i, step, e.bits)]),
        ["g", {}]
      );
    };
    var labelArr = (desc, opt) => {
      const { margin, hspace, vspace, mod, index, fontsize, vflip, trim, compact, offset } = opt;
      const width = hspace - margin.left - margin.right - 1;
      const height = vspace - margin.top - margin.bottom;
      const step = width / mod;
      const blanks = ["g"];
      const bits = ["g", tt(round3(step / 2), -round3(0.5 * fontsize + 4))];
      const names = ["g", tt(round3(step / 2), round3(0.5 * height + 0.4 * fontsize - 6))];
      const attrs = ["g", tt(round3(step / 2), round3(height + 0.7 * fontsize - 2))];
      desc.map((e) => {
        let lsbm = 0;
        let msbm = mod - 1;
        let lsb = index * mod;
        let msb = (index + 1) * mod - 1;
        if (e.lsb / mod >> 0 === index) {
          lsbm = e.lsbm;
          lsb = e.lsb;
          if (e.msb / mod >> 0 === index) {
            msb = e.msb;
            msbm = e.msbm;
          }
        } else {
          if (e.msb / mod >> 0 === index) {
            msb = e.msb;
            msbm = e.msbm;
          } else if (!(lsb > e.lsb && msb < e.msb)) {
            return;
          }
        }
        if (!compact) {
          bits.push(text(lsb + offset, step * (vflip ? lsbm : mod - lsbm - 1)));
          if (lsbm !== msbm) {
            bits.push(text(msb + offset, step * (vflip ? msbm : mod - msbm - 1)));
          }
        }
        if (e.name !== void 0) {
          names.push(getLabel(
            trim ? trimText(e.name, step * e.bits, trim) : e.name,
            step * (vflip ? (msbm + lsbm) / 2 : mod - (msbm + lsbm) / 2 - 1),
            0,
            step,
            e.bits,
            e.rotate
          ));
        }
        if (e.name === void 0 || e.type !== void 0) {
          if (!(opt.compact && e.type === void 0)) {
            blanks.push(["rect", Object.assign(
              {},
              norm({
                x: step * (vflip ? lsbm : mod - msbm - 1),
                width: step * (msbm - lsbm + 1),
                height
              }, {
                field: e.name,
                style: "fill-opacity:0.1" + typeStyle(e.type)
              }),
              e.rect !== void 0 ? e.rect : {}
            )]);
          }
        }
        if (e.attr !== void 0) {
          attrs.push(getAttr(e, opt, step, lsbm, msbm));
        }
      });
      return ["g", blanks, bits, names, attrs];
    };
    var getLabelMask = (desc, mod) => {
      const mask = [];
      let idx = 0;
      desc.map((e) => {
        mask[idx % mod] = true;
        idx += e.bits;
        mask[(idx - 1) % mod] = true;
      });
      return mask;
    };
    var getLegendItems = (opt) => {
      const { hspace, margin, fontsize, legend } = opt;
      const width = hspace - margin.left - margin.right - 1;
      const items = ["g", tt(margin.left, -10)];
      const legendSquarePadding = 36;
      const legendNamePadding = 24;
      let x = width / 2 - Object.keys(legend).length / 2 * (legendSquarePadding + legendNamePadding);
      for (const key in legend) {
        const value = legend[key];
        items.push(["rect", norm({
          x,
          width: 12,
          height: 12
        }, {
          style: "fill-opacity:0.15; stroke: #000; stroke-width: 1.2;" + typeStyle(value)
        })]);
        x += legendSquarePadding;
        items.push(text(
          key,
          x,
          0.1 * fontsize + 4
        ));
        x += legendNamePadding;
      }
      return items;
    };
    var compactLabels = (desc, opt) => {
      const { hspace, margin, mod, fontsize, vflip, legend, offset } = opt;
      const width = hspace - margin.left - margin.right - 1;
      const step = width / mod;
      const labels = ["g", tt(margin.left, legend ? 0 : -3)];
      const mask = getLabelMask(desc, mod);
      for (let i = 0; i < mod; i++) {
        const idx = vflip ? i : mod - i - 1;
        if (mask[idx]) {
          labels.push(text(
            idx + offset,
            step * (i + 0.5),
            0.5 * fontsize + 4
          ));
        }
      }
      return labels;
    };
    var skipField = (desc, opt, globalIndex) => {
      if (!opt.compact) {
        return false;
      }
      const emptyField = (e) => e.name === void 0 && e.type === void 0;
      if (desc.findIndex((e) => emptyField(e) && globalIndex > e.lsb && globalIndex <= e.msb + 1) !== -1) {
        return true;
      }
      return false;
    };
    var cage = (desc, opt) => {
      const { hspace, vspace, mod, margin, index, vflip } = opt;
      const width = hspace - margin.left - margin.right - 1;
      const height = vspace - margin.top - margin.bottom;
      const res = [
        "g",
        {
          stroke: "black",
          "stroke-width": 1,
          "stroke-linecap": "round"
        }
      ];
      if (opt.sparse) {
        const skipEdge = opt.uneven && opt.bits % 2 === 1 && index === opt.lanes - 1;
        if (skipEdge) {
          if (vflip) {
            res.push(
              hline(width - width / mod, 0, 0),
              hline(width - width / mod, 0, height)
            );
          } else {
            res.push(
              hline(width - width / mod, width / mod, 0),
              hline(width - width / mod, width / mod, height)
            );
          }
        } else if (!opt.compact) {
          res.push(
            hline(width, 0, 0),
            hline(width, 0, height),
            vline(height, vflip ? width : 0, 0)
          );
        }
      } else {
        res.push(
          hline(width, 0, 0),
          vline(height, vflip ? width : 0, 0),
          hline(width, 0, height)
        );
      }
      let i = index * mod;
      const delta = vflip ? 1 : -1;
      let j = vflip ? 0 : mod;
      if (opt.sparse) {
        for (let k = 0; k <= mod; k++) {
          const xj = j * (width / mod);
          if (!skipField(desc, opt, i) && k !== 0 || !skipField(desc, opt, i + 1) && k !== mod) {
            if (k === 0 || k === mod || desc.some((e) => e.msb + 1 === i)) {
              res.push(vline(height, xj, 0));
            } else {
              res.push(vline(height >>> 3, xj, 0));
              res.push(vline(-(height >>> 3), xj, height));
            }
          }
          if (opt.compact && k !== 0 && !skipField(desc, opt, i)) {
            res.push(hline(width / mod, xj, 0));
            res.push(hline(width / mod, xj, height));
          }
          i++;
          j += delta;
        }
      } else {
        for (let k = 0; k < mod; k++) {
          const xj = j * (width / mod);
          if (k === 0 || desc.some((e) => e.lsb === i)) {
            res.push(vline(height, xj, 0));
          } else {
            res.push(
              vline(height >>> 3, xj, 0),
              vline(-(height >>> 3), xj, height)
            );
          }
          i++;
          j += delta;
        }
      }
      return res;
    };
    var lane = (desc, opt) => {
      const { index, vspace, hspace, margin, hflip, lanes, compact, label } = opt;
      const height = vspace - margin.top - margin.bottom;
      const width = hspace - margin.left - margin.right - 1;
      let tx = margin.left;
      const idx = hflip ? index : lanes - index - 1;
      let ty = round3(idx * vspace + margin.top);
      if (compact) {
        ty = round3(idx * height + margin.top);
      }
      const res = [
        "g",
        tt(tx, ty),
        cage(desc, opt),
        labelArr(desc, opt)
      ];
      if (label && label.left !== void 0) {
        const lab = label.left;
        let txt = index;
        if (typeof lab === "string") {
          txt = lab;
        } else if (typeof lab === "number") {
          txt += lab;
        } else if (typeof lab === "object") {
          txt = lab[index] || txt;
        }
        res.push([
          "g",
          { "text-anchor": "end" },
          text(txt, -4, round3(height / 2))
        ]);
      }
      if (label && label.right !== void 0) {
        const lab = label.right;
        let txt = index;
        if (typeof lab === "string") {
          txt = lab;
        } else if (typeof lab === "number") {
          txt += lab;
        } else if (typeof lab === "object") {
          txt = lab[index] || txt;
        }
        res.push([
          "g",
          { "text-anchor": "start" },
          text(txt, width + 4, round3(height / 2))
        ]);
      }
      return res;
    };
    var getMaxAttributes = (desc) => desc.reduce(
      (prev, field) => Math.max(
        prev,
        field.attr === void 0 ? 0 : Array.isArray(field.attr) ? field.attr.length : 1
      ),
      0
    );
    var getTotalBits = (desc) => desc.reduce((prev, field) => prev + (field.bits === void 0 ? 0 : field.bits), 0);
    var isIntGTorDefault = (opt) => (row) => {
      const [key, min, def] = row;
      const val = Math.round(opt[key]);
      opt[key] = typeof val === "number" && val >= min ? val : def;
    };
    var optDefaults = (opt) => {
      opt = typeof opt === "object" ? opt : {};
      [
        // key         min default
        // ['vspace', 20, 60],
        ["hspace", 40, 800],
        ["lanes", 1, 1],
        ["bits", 1, void 0],
        ["fontsize", 6, 14]
      ].map(isIntGTorDefault(opt));
      opt.fontfamily = opt.fontfamily || "sans-serif";
      opt.fontweight = opt.fontweight || "normal";
      opt.compact = opt.compact || false;
      opt.hflip = opt.hflip || false;
      opt.uneven = opt.uneven || false;
      opt.margin = opt.margin || {};
      opt.offset = opt.offset || 0;
      return opt;
    };
    var render = (desc, opt) => {
      opt = optDefaults(opt);
      const maxAttributes = getMaxAttributes(desc);
      opt.vspace = opt.vspace || (maxAttributes + 4) * opt.fontsize;
      if (opt.bits === void 0) {
        opt.bits = getTotalBits(desc);
      }
      const { hspace, vspace, lanes, margin, compact, fontsize, bits, label, legend } = opt;
      if (margin.right === void 0) {
        if (label && label.right !== void 0) {
          margin.right = round3(0.1 * hspace);
        } else {
          margin.right = 4;
        }
      }
      if (margin.left === void 0) {
        if (label && label.left !== void 0) {
          margin.left = round3(0.1 * hspace);
        } else {
          margin.left = 4;
        }
      }
      if (margin.top === void 0) {
        margin.top = 1.5 * fontsize;
        if (margin.bottom === void 0) {
          margin.bottom = fontsize * maxAttributes + 4;
        }
      } else {
        if (margin.bottom === void 0) {
          margin.bottom = 4;
        }
      }
      const width = hspace;
      let height = vspace * lanes;
      if (compact) {
        height -= (lanes - 1) * (margin.top + margin.bottom);
      }
      if (legend) {
        height += 12;
      }
      const res = [
        "g",
        tt(0.5, legend ? 12.5 : 0.5, {
          "text-anchor": "middle",
          "font-size": opt.fontsize,
          "font-family": opt.fontfamily,
          "font-weight": opt.fontweight
        })
      ];
      let lsb = 0;
      const mod = Math.ceil(bits * 1 / lanes);
      opt.mod = mod | 0;
      desc.map((e) => {
        e.lsb = lsb;
        e.lsbm = lsb % mod;
        lsb += e.bits;
        e.msb = lsb - 1;
        e.msbm = e.msb % mod;
      });
      for (let i = 0; i < lanes; i++) {
        opt.index = i;
        res.push(lane(desc, opt));
      }
      if (compact) {
        res.push(compactLabels(desc, opt));
      }
      if (legend) {
        res.push(getLegendItems(opt));
      }
      return getSVG(width, height).concat([res]);
    };
    module2.exports = render;
  }
});

// node_modules/wavedrom/lib/render-reg.js
var require_render_reg = __commonJS({
  "node_modules/wavedrom/lib/render-reg.js"(exports2, module2) {
    "use strict";
    var render = require_render2();
    function renderReg(index, source) {
      return render(source.reg, source.config);
    }
    module2.exports = renderReg;
  }
});

// node_modules/wavedrom/lib/rec.js
var require_rec = __commonJS({
  "node_modules/wavedrom/lib/rec.js"(exports2, module2) {
    "use strict";
    function rec(tmp, state) {
      let deltaX = 10;
      let name;
      if (typeof tmp[0] === "string" || typeof tmp[0] === "number") {
        name = tmp[0];
        deltaX = 25;
      }
      state.x += deltaX;
      for (let i = 0; i < tmp.length; i++) {
        if (typeof tmp[i] === "object") {
          if (Array.isArray(tmp[i])) {
            const oldY = state.y;
            state = rec(tmp[i], state);
            state.groups.push({ x: state.xx, y: oldY, height: state.y - oldY, name: state.name });
          } else {
            state.lanes.push(tmp[i]);
            state.width.push(state.x);
            state.y += 1;
          }
        }
      }
      state.xx = state.x;
      state.x -= deltaX;
      state.name = name;
      return state;
    }
    module2.exports = rec;
  }
});

// node_modules/wavedrom/lib/lane.js
var require_lane = __commonJS({
  "node_modules/wavedrom/lib/lane.js"(exports2, module2) {
    "use strict";
    var lane = {
      xs: 20,
      // tmpgraphlane0.width
      ys: 20,
      // tmpgraphlane0.height
      xg: 120,
      // tmpgraphlane0.x
      // yg     : 0,     // head gap
      yh0: 0,
      // head gap title
      yh1: 0,
      // head gap
      yf0: 0,
      // foot gap
      yf1: 0,
      // foot gap
      y0: 5,
      // tmpgraphlane0.y
      yo: 30,
      // tmpgraphlane1.y - y0;
      tgo: -10,
      // tmptextlane0.x - xg;
      ym: 15,
      // tmptextlane0.y - y0
      xlabel: 6,
      // tmptextlabel.x - xg;
      xmax: 1,
      scale: 1,
      head: {},
      foot: {}
    };
    module2.exports = lane;
  }
});

// node_modules/wavedrom/lib/parse-config.js
var require_parse_config = __commonJS({
  "node_modules/wavedrom/lib/parse-config.js"(exports2, module2) {
    "use strict";
    function parseConfig(source, lane) {
      function tonumber(x) {
        return x > 0 ? Math.round(x) : 1;
      }
      lane.hscale = 1;
      if (lane.hscale0) {
        lane.hscale = lane.hscale0;
      }
      if (source && source.config && source.config.hscale) {
        let hscale = Math.round(tonumber(source.config.hscale));
        if (hscale > 0) {
          if (hscale > 100) {
            hscale = 100;
          }
          lane.hscale = hscale;
        }
      }
      lane.yh0 = 0;
      lane.yh1 = 0;
      lane.head = source.head;
      lane.xmin_cfg = 0;
      lane.xmax_cfg = 1e12;
      if (source && source.config && source.config.hbounds && source.config.hbounds.length == 2) {
        source.config.hbounds[0] = Math.floor(source.config.hbounds[0]);
        source.config.hbounds[1] = Math.ceil(source.config.hbounds[1]);
        if (source.config.hbounds[0] < source.config.hbounds[1]) {
          lane.xmin_cfg = 2 * Math.floor(source.config.hbounds[0]);
          lane.xmax_cfg = 2 * Math.floor(source.config.hbounds[1]);
        }
      }
      if (source && source.head) {
        if (source.head.tick || source.head.tick === 0 || source.head.tock || source.head.tock === 0) {
          lane.yh0 = 20;
        }
        if (source.head.tick || source.head.tick === 0) {
          source.head.tick = source.head.tick + lane.xmin_cfg / 2;
        }
        if (source.head.tock || source.head.tock === 0) {
          source.head.tock = source.head.tock + lane.xmin_cfg / 2;
        }
        if (source.head.text) {
          lane.yh1 = 46;
          lane.head.text = source.head.text;
        }
      }
      lane.yf0 = 0;
      lane.yf1 = 0;
      lane.foot = source.foot;
      if (source && source.foot) {
        if (source.foot.tick || source.foot.tick === 0 || source.foot.tock || source.foot.tock === 0) {
          lane.yf0 = 20;
        }
        if (source.foot.tick || source.foot.tick === 0) {
          source.foot.tick = source.foot.tick + lane.xmin_cfg / 2;
        }
        if (source.foot.tock || source.foot.tock === 0) {
          source.foot.tock = source.foot.tock + lane.xmin_cfg / 2;
        }
        if (source.foot.text) {
          lane.yf1 = 46;
          lane.foot.text = source.foot.text;
        }
      }
    }
    module2.exports = parseConfig;
  }
});

// node_modules/wavedrom/lib/gen-brick.js
var require_gen_brick = __commonJS({
  "node_modules/wavedrom/lib/gen-brick.js"(exports2, module2) {
    "use strict";
    var genBrick = (texts, extra, times) => {
      const R = [];
      if (!Array.isArray(texts)) {
        texts = [texts];
      }
      if (texts.length === 4) {
        for (let j = 0; j < times; j += 1) {
          R.push(texts[0]);
          for (let i = 0; i < extra; i += 1) {
            R.push(texts[1]);
          }
          R.push(texts[2]);
          for (let i = 0; i < extra; i += 1) {
            R.push(texts[3]);
          }
        }
        return R;
      }
      if (texts.length === 1) {
        texts.push(texts[0]);
      }
      R.push(texts[0]);
      for (let i = 0; i < times * (2 * (extra + 1)) - 1; i += 1) {
        R.push(texts[1]);
      }
      return R;
    };
    module2.exports = genBrick;
  }
});

// node_modules/wavedrom/lib/gen-first-wave-brick.js
var require_gen_first_wave_brick = __commonJS({
  "node_modules/wavedrom/lib/gen-first-wave-brick.js"(exports2, module2) {
    "use strict";
    var genBrick = require_gen_brick();
    var lookUpTable = {
      p: ["pclk", "111", "nclk", "000"],
      n: ["nclk", "000", "pclk", "111"],
      P: ["Pclk", "111", "nclk", "000"],
      N: ["Nclk", "000", "pclk", "111"],
      l: "000",
      L: "000",
      0: "000",
      h: "111",
      H: "111",
      1: "111",
      "=": "vvv-2",
      2: "vvv-2",
      3: "vvv-3",
      4: "vvv-4",
      5: "vvv-5",
      6: "vvv-6",
      7: "vvv-7",
      8: "vvv-8",
      9: "vvv-9",
      d: "ddd",
      u: "uuu",
      z: "zzz",
      default: "xxx"
    };
    var genFirstWaveBrick = (text, extra, times) => genBrick(lookUpTable[text] || lookUpTable.default, extra, times);
    module2.exports = genFirstWaveBrick;
  }
});

// node_modules/wavedrom/lib/gen-wave-brick.js
var require_gen_wave_brick = __commonJS({
  "node_modules/wavedrom/lib/gen-wave-brick.js"(exports2, module2) {
    "use strict";
    var genBrick = require_gen_brick();
    function genWaveBrick(text, extra, times) {
      const x1 = { p: "pclk", n: "nclk", P: "Pclk", N: "Nclk", h: "pclk", l: "nclk", H: "Pclk", L: "Nclk" };
      const x2 = {
        "0": "0",
        "1": "1",
        "x": "x",
        "d": "d",
        "u": "u",
        "z": "z",
        "=": "v",
        "2": "v",
        "3": "v",
        "4": "v",
        "5": "v",
        "6": "v",
        "7": "v",
        "8": "v",
        "9": "v"
      };
      const x3 = {
        "0": "",
        "1": "",
        "x": "",
        "d": "",
        "u": "",
        "z": "",
        "=": "-2",
        "2": "-2",
        "3": "-3",
        "4": "-4",
        "5": "-5",
        "6": "-6",
        "7": "-7",
        "8": "-8",
        "9": "-9"
      };
      const y1 = {
        "p": "0",
        "n": "1",
        "P": "0",
        "N": "1",
        "h": "1",
        "l": "0",
        "H": "1",
        "L": "0",
        "0": "0",
        "1": "1",
        "x": "x",
        "d": "d",
        "u": "u",
        "z": "z",
        "=": "v",
        "2": "v",
        "3": "v",
        "4": "v",
        "5": "v",
        "6": "v",
        "7": "v",
        "8": "v",
        "9": "v"
      };
      const y2 = {
        "p": "",
        "n": "",
        "P": "",
        "N": "",
        "h": "",
        "l": "",
        "H": "",
        "L": "",
        "0": "",
        "1": "",
        "x": "",
        "d": "",
        "u": "",
        "z": "",
        "=": "-2",
        "2": "-2",
        "3": "-3",
        "4": "-4",
        "5": "-5",
        "6": "-6",
        "7": "-7",
        "8": "-8",
        "9": "-9"
      };
      const x4 = {
        "p": "111",
        "n": "000",
        "P": "111",
        "N": "000",
        "h": "111",
        "l": "000",
        "H": "111",
        "L": "000",
        "0": "000",
        "1": "111",
        "x": "xxx",
        "d": "ddd",
        "u": "uuu",
        "z": "zzz",
        "=": "vvv-2",
        "2": "vvv-2",
        "3": "vvv-3",
        "4": "vvv-4",
        "5": "vvv-5",
        "6": "vvv-6",
        "7": "vvv-7",
        "8": "vvv-8",
        "9": "vvv-9"
      };
      const x5 = { p: "nclk", n: "pclk", P: "nclk", N: "pclk" };
      const x6 = { p: "000", n: "111", P: "000", N: "111" };
      const xclude = { hp: "111", Hp: "111", ln: "000", Ln: "000", nh: "111", Nh: "111", pl: "000", Pl: "000" };
      const atext = text.split("");
      const tmp0 = x4[atext[1]];
      let tmp1 = x1[atext[1]];
      if (tmp1 === void 0) {
        const tmp2 = x2[atext[1]];
        if (tmp2 === void 0) {
          return genBrick("xxx", extra, times);
        } else {
          const tmp3 = y1[atext[0]];
          if (tmp3 === void 0) {
            return genBrick("xxx", extra, times);
          }
          return genBrick([tmp3 + "m" + tmp2 + y2[atext[0]] + x3[atext[1]], tmp0], extra, times);
        }
      } else {
        const tmp4 = xclude[text];
        if (tmp4 !== void 0) {
          tmp1 = tmp4;
        }
        const tmp5 = x5[atext[1]];
        if (tmp5 === void 0) {
          return genBrick([tmp1, tmp0], extra, times);
        }
        return genBrick([tmp1, tmp0, tmp5, x6[atext[1]]], extra, times);
      }
    }
    module2.exports = genWaveBrick;
  }
});

// node_modules/wavedrom/lib/find-lane-markers.js
var require_find_lane_markers = __commonJS({
  "node_modules/wavedrom/lib/find-lane-markers.js"(exports2, module2) {
    "use strict";
    function findLaneMarkers(lanetext) {
      let gcount = 0;
      let lcount = 0;
      const ret = [];
      lanetext.forEach(function(e) {
        if (e === "vvv-2" || e === "vvv-3" || e === "vvv-4" || e === "vvv-5" || e === "vvv-6" || e === "vvv-7" || e === "vvv-8" || e === "vvv-9") {
          lcount += 1;
        } else {
          if (lcount !== 0) {
            ret.push(gcount - (lcount + 1) / 2);
            lcount = 0;
          }
        }
        gcount += 1;
      });
      if (lcount !== 0) {
        ret.push(gcount - (lcount + 1) / 2);
      }
      return ret;
    }
    module2.exports = findLaneMarkers;
  }
});

// node_modules/wavedrom/lib/parse-wave-lane.js
var require_parse_wave_lane = __commonJS({
  "node_modules/wavedrom/lib/parse-wave-lane.js"(exports2, module2) {
    "use strict";
    var genFirstWaveBrick = require_gen_first_wave_brick();
    var genWaveBrick = require_gen_wave_brick();
    var findLaneMarkers = require_find_lane_markers();
    function parseWaveLane(src, extra, lane) {
      const Stack = src.split("");
      let Next = Stack.shift();
      let Repeats = 1;
      while (Stack[0] === "." || Stack[0] === "|") {
        Stack.shift();
        Repeats += 1;
      }
      let R = [];
      R = R.concat(genFirstWaveBrick(Next, extra, Repeats));
      let Top;
      let subCycle = false;
      while (Stack.length) {
        Top = Next;
        Next = Stack.shift();
        if (Next === "<") {
          subCycle = true;
          Next = Stack.shift();
        }
        if (Next === ">") {
          subCycle = false;
          Next = Stack.shift();
        }
        Repeats = 1;
        while (Stack[0] === "." || Stack[0] === "|") {
          Stack.shift();
          Repeats += 1;
        }
        if (subCycle) {
          R = R.concat(genWaveBrick(Top + Next, 0, Repeats - lane.period));
        } else {
          R = R.concat(genWaveBrick(Top + Next, extra, Repeats));
        }
      }
      const unseen_bricks = [];
      for (let i = 0; i < lane.phase; i += 1) {
        unseen_bricks.push(R.shift());
      }
      let num_unseen_markers;
      if (unseen_bricks.length > 0) {
        num_unseen_markers = findLaneMarkers(unseen_bricks).length;
        if (findLaneMarkers([unseen_bricks[unseen_bricks.length - 1]]).length == 1 && findLaneMarkers([R[0]]).length == 1) {
          num_unseen_markers -= 1;
        }
      } else {
        num_unseen_markers = 0;
      }
      return [R, num_unseen_markers];
    }
    module2.exports = parseWaveLane;
  }
});

// node_modules/wavedrom/lib/parse-wave-lanes.js
var require_parse_wave_lanes = __commonJS({
  "node_modules/wavedrom/lib/parse-wave-lanes.js"(exports2, module2) {
    "use strict";
    var parseWaveLane = require_parse_wave_lane();
    function data_extract(e, num_unseen_markers) {
      let ret_data = e.data;
      if (ret_data === void 0) {
        return null;
      }
      if (typeof ret_data === "string") {
        ret_data = ret_data.trim().split(/\s+/);
      }
      ret_data = ret_data.slice(num_unseen_markers);
      return ret_data;
    }
    function parseWaveLanes(sig, lane) {
      const content = [];
      const tmp0 = [];
      sig.map(function(sigx) {
        const current = [];
        content.push(current);
        lane.period = sigx.period || 1;
        lane.phase = (sigx.phase ? sigx.phase * 2 : 0) + lane.xmin_cfg;
        tmp0[0] = sigx.name || " ";
        tmp0[1] = (sigx.phase || 0) + lane.xmin_cfg / 2;
        let content_wave = null;
        let num_unseen_markers;
        if (typeof sigx.wave === "string") {
          const parsed_wave_lane = parseWaveLane(sigx.wave, lane.period * lane.hscale - 1, lane);
          content_wave = parsed_wave_lane[0];
          num_unseen_markers = parsed_wave_lane[1];
        }
        current.push(
          tmp0.slice(0),
          content_wave,
          data_extract(sigx, num_unseen_markers),
          sigx
        );
      });
      return content;
    }
    module2.exports = parseWaveLanes;
  }
});

// node_modules/onml/tt.js
var require_tt = __commonJS({
  "node_modules/onml/tt.js"(exports2, module2) {
    "use strict";
    module2.exports = (x, y, obj) => {
      let objt = {};
      if (x || y) {
        const tt = [x || 0].concat(y ? [y] : []);
        objt = { transform: "translate(" + tt.join(",") + ")" };
      }
      obj = typeof obj === "object" ? obj : {};
      return Object.assign(objt, obj);
    };
  }
});

// node_modules/wavedrom/lib/render-groups.js
var require_render_groups = __commonJS({
  "node_modules/wavedrom/lib/render-groups.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var tt = require_tt();
    function renderGroups(groups, index, lane) {
      const res = ["g"];
      groups.map((e, i) => {
        res.push([
          "path",
          {
            id: "group_" + i + "_" + index,
            d: "m " + (e.x + 0.5) + "," + (e.y * lane.yo + 3.5 + lane.yh0 + lane.yh1) + " c -3,0 -5,2 -5,5 l 0," + (e.height * lane.yo - 16) + " c 0,3 2,5 5,5",
            style: "stroke:#0041c4;stroke-width:1;fill:none"
          }
        ]);
        if (e.name === void 0) {
          return;
        }
        const x = e.x - 10;
        const y = lane.yo * (e.y + e.height / 2) + lane.yh0 + lane.yh1;
        const ts = tspan.parse(e.name);
        res.push([
          "g",
          tt(x, y),
          [
            "g",
            { transform: "rotate(270)" },
            ["text", {
              "text-anchor": "middle",
              class: "info",
              "xml:space": "preserve"
            }].concat(ts)
          ]
        ]);
      });
      return res;
    }
    module2.exports = renderGroups;
  }
});

// node_modules/wavedrom/lib/render-marks.js
var require_render_marks = __commonJS({
  "node_modules/wavedrom/lib/render-marks.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    function captext(cxt, anchor, y) {
      if (cxt[anchor] && cxt[anchor].text) {
        return [
          ["text", {
            x: cxt.xmax * cxt.xs / 2,
            y,
            fill: "#000",
            "text-anchor": "middle",
            "xml:space": "preserve"
          }].concat(tspan.parse(cxt[anchor].text))
        ];
      }
      return [];
    }
    function ticktock(cxt, ref1, ref2, x, dx, y, len2) {
      let offset;
      let L = [];
      if (cxt[ref1] === void 0 || cxt[ref1][ref2] === void 0) {
        return [];
      }
      let val = cxt[ref1][ref2];
      if (typeof val === "string") {
        val = val.trim().split(/\s+/);
      } else if (typeof val === "number" || typeof val === "boolean") {
        offset = Number(val);
        val = [];
        for (let i = 0; i < len2; i += 1) {
          val.push(i + offset);
        }
      }
      if (Array.isArray(val)) {
        if (val.length === 0) {
          return [];
        } else if (val.length === 1) {
          offset = Number(val[0]);
          if (isNaN(offset)) {
            L = val;
          } else {
            for (let i = 0; i < len2; i += 1) {
              L[i] = i + offset;
            }
          }
        } else if (val.length === 2) {
          offset = Number(val[0]);
          const step = Number(val[1]);
          const tmp = val[1].split(".");
          let dp = 0;
          if (tmp.length === 2) {
            dp = tmp[1].length;
          }
          if (isNaN(offset) || isNaN(step)) {
            L = val;
          } else {
            offset = step * offset;
            for (let i = 0; i < len2; i += 1) {
              L[i] = (step * i + offset).toFixed(dp);
            }
          }
        } else {
          L = val;
        }
      } else {
        return [];
      }
      const res = ["g", {
        class: "muted",
        "text-anchor": "middle",
        "xml:space": "preserve"
      }];
      for (let i = 0; i < len2; i += 1) {
        if (cxt[ref1] && cxt[ref1].every && (i + offset) % cxt[ref1].every != 0) {
          continue;
        }
        res.push(["text", { x: i * dx + x, y }].concat(tspan.parse(L[i])));
      }
      return [res];
    }
    function renderMarks(content, index, lane, source) {
      const mstep = 2 * lane.hscale;
      const mmstep = mstep * lane.xs;
      const marks = lane.xmax / mstep;
      const gy = content.length * lane.yo;
      const res = ["g", { id: "gmarks_" + index }];
      const gmarkLines = ["g", { style: "stroke:#888;stroke-width:0.5;stroke-dasharray:1,3" }];
      if (!(source && source.config && source.config.marks === false)) {
        for (let i = 0; i < marks + 1; i += 1) {
          gmarkLines.push(["line", {
            id: "gmark_" + i + "_" + index,
            x1: i * mmstep,
            y1: 0,
            x2: i * mmstep,
            y2: gy
          }]);
        }
        res.push(gmarkLines);
      }
      return res.concat(
        captext(lane, "head", lane.yh0 ? -33 : -13),
        captext(lane, "foot", gy + (lane.yf0 ? 45 : 25)),
        ticktock(lane, "head", "tick", 0, mmstep, -5, marks + 1),
        ticktock(lane, "head", "tock", mmstep / 2, mmstep, -5, marks),
        ticktock(lane, "foot", "tick", 0, mmstep, gy + 15, marks + 1),
        ticktock(lane, "foot", "tock", mmstep / 2, mmstep, gy + 15, marks)
      );
    }
    module2.exports = renderMarks;
  }
});

// node_modules/wavedrom/lib/arc-shape.js
var require_arc_shape = __commonJS({
  "node_modules/wavedrom/lib/arc-shape.js"(exports2, module2) {
    "use strict";
    function arcShape(Edge, from, to) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      let lx = (from.x + to.x) / 2;
      const ly = (from.y + to.y) / 2;
      let d;
      let style;
      switch (Edge.shape) {
        case "-": {
          break;
        }
        case "~": {
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + 0.3 * dx + ", " + dy + " " + dx + ", " + dy;
          break;
        }
        case "-~": {
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + dx + ", " + dy + " " + dx + ", " + dy;
          if (Edge.label) {
            lx = from.x + (to.x - from.x) * 0.75;
          }
          break;
        }
        case "~-": {
          d = "M " + from.x + "," + from.y + " c 0, 0 " + 0.3 * dx + ", " + dy + " " + dx + ", " + dy;
          if (Edge.label) {
            lx = from.x + (to.x - from.x) * 0.25;
          }
          break;
        }
        case "-|": {
          d = "m " + from.x + "," + from.y + " " + dx + ",0 0," + dy;
          if (Edge.label) {
            lx = to.x;
          }
          break;
        }
        case "|-": {
          d = "m " + from.x + "," + from.y + " 0," + dy + " " + dx + ",0";
          if (Edge.label) {
            lx = from.x;
          }
          break;
        }
        case "-|-": {
          d = "m " + from.x + "," + from.y + " " + dx / 2 + ",0 0," + dy + " " + dx / 2 + ",0";
          break;
        }
        case "->": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          break;
        }
        case "~>": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + 0.3 * dx + ", " + dy + " " + dx + ", " + dy;
          break;
        }
        case "-~>": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + dx + ", " + dy + " " + dx + ", " + dy;
          if (Edge.label) {
            lx = from.x + (to.x - from.x) * 0.75;
          }
          break;
        }
        case "~->": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "M " + from.x + "," + from.y + " c 0, 0 " + 0.3 * dx + ", " + dy + " " + dx + ", " + dy;
          if (Edge.label) {
            lx = from.x + (to.x - from.x) * 0.25;
          }
          break;
        }
        case "-|>": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "m " + from.x + "," + from.y + " " + dx + ",0 0," + dy;
          if (Edge.label) {
            lx = to.x;
          }
          break;
        }
        case "|->": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "m " + from.x + "," + from.y + " 0," + dy + " " + dx + ",0";
          if (Edge.label) {
            lx = from.x;
          }
          break;
        }
        case "-|->": {
          style = "marker-end:url(#arrowhead);stroke:#0041c4;stroke-width:1;fill:none";
          d = "m " + from.x + "," + from.y + " " + dx / 2 + ",0 0," + dy + " " + dx / 2 + ",0";
          break;
        }
        case "<->": {
          style = "marker-end:url(#arrowhead);marker-start:url(#arrowtail);stroke:#0041c4;stroke-width:1;fill:none";
          break;
        }
        case "<~>": {
          style = "marker-end:url(#arrowhead);marker-start:url(#arrowtail);stroke:#0041c4;stroke-width:1;fill:none";
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + 0.3 * dx + ", " + dy + " " + dx + ", " + dy;
          break;
        }
        case "<-~>": {
          style = "marker-end:url(#arrowhead);marker-start:url(#arrowtail);stroke:#0041c4;stroke-width:1;fill:none";
          d = "M " + from.x + "," + from.y + " c " + 0.7 * dx + ", 0 " + dx + ", " + dy + " " + dx + ", " + dy;
          if (Edge.label) {
            lx = from.x + (to.x - from.x) * 0.75;
          }
          break;
        }
        case "<-|>": {
          style = "marker-end:url(#arrowhead);marker-start:url(#arrowtail);stroke:#0041c4;stroke-width:1;fill:none";
          d = "m " + from.x + "," + from.y + " " + dx + ",0 0," + dy;
          if (Edge.label) {
            lx = to.x;
          }
          break;
        }
        case "<-|->": {
          style = "marker-end:url(#arrowhead);marker-start:url(#arrowtail);stroke:#0041c4;stroke-width:1;fill:none";
          d = "m " + from.x + "," + from.y + " " + dx / 2 + ",0 0," + dy + " " + dx / 2 + ",0";
          break;
        }
        case "+": {
          style = "marker-end:url(#tee);marker-start:url(#tee);fill:none;stroke:#00F;stroke-width:1";
          break;
        }
        default: {
          style = "fill:none;stroke:#F00;stroke-width:1";
        }
      }
      return {
        lx,
        ly,
        d,
        style
      };
    }
    module2.exports = arcShape;
  }
});

// node_modules/wavedrom/lib/char-width.json
var require_char_width = __commonJS({
  "node_modules/wavedrom/lib/char-width.json"(exports2, module2) {
    module2.exports = { chars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 34, 47, 74, 74, 118, 89, 25, 44, 44, 52, 78, 37, 44, 37, 37, 74, 74, 74, 74, 74, 74, 74, 74, 74, 74, 37, 37, 78, 78, 78, 74, 135, 89, 89, 96, 96, 89, 81, 103, 96, 37, 67, 89, 74, 109, 96, 103, 89, 103, 96, 89, 81, 96, 89, 127, 89, 87, 81, 37, 37, 37, 61, 74, 44, 74, 74, 67, 74, 74, 37, 74, 74, 30, 30, 67, 30, 112, 74, 74, 74, 74, 44, 67, 37, 74, 67, 95, 66, 65, 67, 44, 34, 44, 78, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 37, 43, 74, 74, 74, 74, 34, 74, 44, 98, 49, 74, 78, 0, 98, 73, 53, 73, 44, 44, 44, 77, 71, 37, 44, 44, 49, 74, 111, 111, 111, 81, 89, 89, 89, 89, 89, 89, 133, 96, 89, 89, 89, 89, 37, 37, 37, 37, 96, 96, 103, 103, 103, 103, 103, 78, 103, 96, 96, 96, 96, 87, 89, 81, 74, 74, 74, 74, 74, 74, 118, 67, 74, 74, 74, 74, 36, 36, 36, 36, 74, 74, 74, 74, 74, 74, 74, 73, 81, 74, 74, 74, 74, 65, 74, 65, 89, 74, 89, 74, 89, 74, 96, 67, 96, 67, 96, 67, 96, 67, 96, 82, 96, 74, 89, 74, 89, 74, 89, 74, 89, 74, 89, 74, 103, 74, 103, 74, 103, 74, 103, 74, 96, 74, 96, 74, 37, 36, 37, 36, 37, 36, 37, 30, 37, 36, 98, 59, 67, 30, 89, 67, 67, 74, 30, 74, 30, 74, 39, 74, 44, 74, 30, 96, 74, 96, 74, 96, 74, 80, 96, 74, 103, 74, 103, 74, 103, 74, 133, 126, 96, 44, 96, 44, 96, 44, 89, 67, 89, 67, 89, 67, 89, 67, 81, 38, 81, 50, 81, 37, 96, 74, 96, 74, 96, 74, 96, 74, 96, 74, 96, 74, 127, 95, 87, 65, 87, 81, 67, 81, 67, 81, 67, 30, 84, 97, 91, 84, 91, 84, 94, 92, 73, 104, 109, 91, 84, 81, 84, 100, 82, 76, 74, 103, 91, 131, 47, 40, 99, 77, 37, 79, 130, 100, 84, 104, 114, 87, 126, 101, 87, 84, 93, 84, 69, 84, 46, 52, 82, 52, 82, 114, 89, 102, 96, 100, 98, 91, 70, 88, 88, 77, 70, 85, 89, 77, 67, 84, 39, 65, 61, 39, 189, 173, 153, 111, 105, 61, 123, 123, 106, 89, 74, 37, 30, 103, 74, 96, 74, 96, 74, 96, 74, 96, 74, 96, 74, 81, 91, 81, 91, 81, 130, 131, 102, 84, 103, 84, 87, 78, 104, 81, 104, 81, 88, 76, 37, 189, 173, 153, 103, 84, 148, 90, 100, 84, 89, 74, 133, 118, 103, 81], other: 114 };
  }
});

// node_modules/wavedrom/lib/text-width.js
var require_text_width = __commonJS({
  "node_modules/wavedrom/lib/text-width.js"(exports2, module2) {
    "use strict";
    var charWidth = require_char_width();
    module2.exports = function(str7, size) {
      size = size || 11;
      let width = 0;
      for (let i = 0; i < str7.length; i++) {
        const c = str7.charCodeAt(i);
        let w = charWidth.chars[c];
        if (w === void 0) {
          w = charWidth.other;
        }
        width += w;
      }
      return width * size / 100;
    };
  }
});

// node_modules/wavedrom/lib/render-label.js
var require_render_label = __commonJS({
  "node_modules/wavedrom/lib/render-label.js"(exports2, module2) {
    "use strict";
    var tspan = require_lib();
    var tt = require_tt();
    var textWidth = require_text_width();
    function renderLabel(p, text, fontSize) {
      fontSize = fontSize || 11;
      const w = textWidth(text, fontSize) + 2;
      return [
        "g",
        tt(p.x, p.y),
        ["rect", {
          x: -(w >> 1),
          y: -(fontSize >> 1),
          width: w,
          height: fontSize,
          style: "fill:#FFF;"
        }],
        ["text", {
          "text-anchor": "middle",
          y: Math.round(0.3 * fontSize),
          style: "font-size:" + fontSize + "px;"
        }].concat(tspan.parse(text))
      ];
    }
    module2.exports = renderLabel;
  }
});

// node_modules/wavedrom/lib/render-arcs.js
var require_render_arcs = __commonJS({
  "node_modules/wavedrom/lib/render-arcs.js"(exports2, module2) {
    "use strict";
    var arcShape = require_arc_shape();
    var renderLabel = require_render_label();
    var renderArc = (Edge, from, to, shapeProps) => ["path", {
      id: "gmark_" + Edge.from + "_" + Edge.to,
      d: shapeProps.d || "M " + from.x + "," + from.y + " " + to.x + "," + to.y,
      style: shapeProps.style || "fill:none;stroke:#00F;stroke-width:1"
    }];
    var labeler = (lane, Events) => (element, i) => {
      const text = element.node;
      lane.period = element.period ? element.period : 1;
      lane.phase = (element.phase ? element.phase * 2 : 0) + lane.xmin_cfg;
      if (text) {
        const stack = text.split("");
        let pos = 0;
        while (stack.length) {
          const eventname = stack.shift();
          if (eventname !== ".") {
            Events[eventname] = {
              x: lane.xs * (2 * pos * lane.period * lane.hscale - lane.phase) + lane.xlabel,
              y: i * lane.yo + lane.y0 + lane.ys * 0.5
            };
          }
          pos += 1;
        }
      }
    };
    var archer = (res, Events, arcFontSize) => (element) => {
      const words = element.trim().split(/\s+/);
      const Edge = {
        words,
        label: element.substring(words[0].length).substring(1),
        from: words[0].substr(0, 1),
        to: words[0].substr(-1, 1),
        shape: words[0].slice(1, -1)
      };
      const from = Events[Edge.from];
      const to = Events[Edge.to];
      if (from && to) {
        const shapeProps = arcShape(Edge, from, to);
        const lx = shapeProps.lx;
        const ly = shapeProps.ly;
        res.push(renderArc(Edge, from, to, shapeProps));
        if (Edge.label) {
          res.push(renderLabel({ x: lx, y: ly }, Edge.label, arcFontSize));
        }
      }
    };
    function renderArcs(lanes, index, source, lane) {
      const arcFontSize = source && source.config && source.config.arcFontSize ? source.config.arcFontSize : 11;
      const res = ["g", { id: "wavearcs_" + index }];
      const Events = {};
      if (Array.isArray(lanes)) {
        lanes.map(labeler(lane, Events));
        if (Array.isArray(source.edge)) {
          source.edge.map(archer(res, Events, arcFontSize));
        }
        Object.keys(Events).map(function(k) {
          if (k === k.toLowerCase()) {
            if (Events[k].x > 0) {
              res.push(renderLabel({
                x: Events[k].x,
                y: Events[k].y
              }, k + "", arcFontSize));
            }
          }
        });
      }
      return res;
    }
    module2.exports = renderArcs;
  }
});

// node_modules/wavedrom/lib/render-gaps.js
var require_render_gaps = __commonJS({
  "node_modules/wavedrom/lib/render-gaps.js"(exports2, module2) {
    "use strict";
    var tt = require_tt();
    function renderGapUses(text, lane) {
      const res = [];
      const Stack = (text || "").split("");
      let pos = 0;
      let subCycle = false;
      while (Stack.length) {
        let next = Stack.shift();
        if (next === "<") {
          subCycle = true;
          next = Stack.shift();
        }
        if (next === ">") {
          subCycle = false;
          next = Stack.shift();
        }
        if (subCycle) {
          pos += 1;
        } else {
          pos += 2 * lane.period;
        }
        if (next === "|") {
          res.push(["use", tt(
            lane.xs * ((pos - (subCycle ? 0 : lane.period)) * lane.hscale - lane.phase),
            0,
            { "xlink:href": "#gap" }
          )]);
        }
      }
      return res;
    }
    function renderGaps(lanes, index, source, lane) {
      let res = [];
      if (lanes) {
        const lanesLen = lanes.length;
        const vline = (x) => ["line", {
          x1: x,
          x2: x,
          y2: lanesLen * lane.yo,
          style: "stroke:#000;stroke-width:1px"
        }];
        const lineStyle = "fill:none;stroke:#000;stroke-width:1px";
        const bracket = {
          square: {
            left: ["path", { d: "M  2 0 h -4 v " + (lanesLen * lane.yo - 1) + " h  4", style: lineStyle }],
            right: ["path", { d: "M -2 0 h  4 v " + (lanesLen * lane.yo - 1) + " h -4", style: lineStyle }]
          },
          round: {
            left: ["path", { d: "M  2 0 a 4 4 0 0 0 -4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 0 0 0  4 4", style: lineStyle }],
            right: ["path", { d: "M -2 0 a 4 4 1 0 1  4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 1 0 1 -4 4", style: lineStyle }],
            rightLeft: ["path", {
              d: "M -5 0 a 4 4 1 0 1  4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 1 0 1 -4 4M  5 0 a 4 4 0 0 0 -4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 0 0 0  4 4",
              style: lineStyle
            }],
            leftLeft: ["path", {
              d: "M  2 0 a 4 4 0 0 0 -4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 0 0 0  4 4M  5 1 a 3 3 0 0 0 -3 3 v " + (lanesLen * lane.yo - 9) + " a 3 3 0 0 0  3 3",
              style: lineStyle
            }],
            rightRight: ["path", {
              d: "M -5 1 a 3 3 1 0 1  3 3 v " + (lanesLen * lane.yo - 9) + " a 3 3 1 0 1 -3 3M -2 0 a 4 4 1 0 1  4 4 v " + (lanesLen * lane.yo - 9) + " a 4 4 1 0 1 -4 4",
              style: lineStyle
            }]
          }
        };
        const backDrop = (w) => ["rect", {
          x: -w / 2,
          width: w,
          height: lanesLen * lane.yo,
          style: "fill:#ffffffcc;stroke:none"
        }];
        if (source && typeof source.gaps === "string") {
          const scale = lane.hscale * lane.xs * 2;
          const gaps = source.gaps.trim().split(/\s+/);
          for (let x = 0; x < gaps.length; x++) {
            const c = gaps[x];
            if (c.match(/^[.]$/)) {
              continue;
            }
            const offset = c === c.toLowerCase() ? 0.5 : 0;
            let marks = [];
            switch (c) {
              case "0":
                marks = [backDrop(4)];
                break;
              case "1":
                marks = [backDrop(4), vline(0)];
                break;
              case "|":
                marks = [backDrop(4), vline(0)];
                break;
              case "2":
                marks = [backDrop(4), vline(-2), vline(2)];
                break;
              case "3":
                marks = [backDrop(6), vline(-3), vline(0), vline(3)];
                break;
              case "[":
                marks = [backDrop(4), bracket.square.left];
                break;
              case "]":
                marks = [backDrop(4), bracket.square.right];
                break;
              case "(":
                marks = [backDrop(4), bracket.round.left];
                break;
              case ")":
                marks = [backDrop(4), bracket.round.right];
                break;
              case ")(":
                marks = [backDrop(8), bracket.round.rightLeft];
                break;
              case "((":
                marks = [backDrop(8), bracket.round.leftLeft];
                break;
              case "))":
                marks = [backDrop(8), bracket.round.rightRight];
                break;
              case "s":
                for (let idx = 0; idx < lanesLen; idx++) {
                  if (lanes[idx] && lanes[idx].wave && lanes[idx].wave.length > x) {
                    marks.push(["use", tt(2, 5 + lane.yo * idx, { "xlink:href": "#gap" })]);
                  }
                }
                break;
            }
            res.push(["g", tt(scale * (x + offset))].concat(marks));
          }
        }
        for (let idx = 0; idx < lanesLen; idx++) {
          const val = lanes[idx];
          lane.period = val.period ? val.period : 1;
          lane.phase = (val.phase ? val.phase * 2 : 0) + lane.xmin_cfg;
          if (typeof val.wave === "string") {
            const gaps = renderGapUses(val.wave, lane);
            res = res.concat([["g", tt(
              0,
              lane.y0 + idx * lane.yo,
              { id: "wavegap_" + idx + "_" + index }
            )].concat(gaps)]);
          }
        }
      }
      return ["g", { id: "wavegaps_" + index }].concat(res);
    }
    module2.exports = renderGaps;
  }
});

// node_modules/wavedrom/lib/render-piece-wise.js
var require_render_piece_wise = __commonJS({
  "node_modules/wavedrom/lib/render-piece-wise.js"(exports2, module2) {
    "use strict";
    var tt = require_tt();
    var scaled = (d, sx, sy) => {
      if (sy === void 0) {
        sy = sx;
      }
      let i = 0;
      while (i < d.length) {
        switch (d[i].toLowerCase()) {
          case "h":
            while (i < d.length && !isNaN(d[i + 1])) {
              d[i + 1] *= sx;
              i++;
            }
            break;
          case "v":
            while (i < d.length && !isNaN(d[i + 1])) {
              d[i + 1] *= sy;
              i++;
            }
            break;
          case "m":
          case "l":
          case "t":
            while (i + 1 < d.length && !isNaN(d[i + 1])) {
              d[i + 1] *= sx;
              d[i + 2] *= sy;
              i += 2;
            }
            break;
          case "q":
            while (i + 3 < d.length && !isNaN(d[i + 1])) {
              d[i + 1] *= sx;
              d[i + 2] *= sy;
              d[i + 3] *= sx;
              d[i + 4] *= sy;
              i += 4;
            }
            break;
          case "a":
            while (i + 6 < d.length && !isNaN(d[i + 1])) {
              d[i + 1] *= sx;
              d[i + 2] *= sy;
              d[i + 6] *= sx;
              d[i + 7] *= sy;
              i += 7;
            }
            break;
        }
        i++;
      }
      return d;
    };
    function scale(d, cfg) {
      if (typeof d === "string") {
        d = d.trim().split(/[\s,]+/);
      }
      if (!Array.isArray(d)) {
        return;
      }
      return scaled(d, 2 * cfg.xs, -cfg.ys);
    }
    function renderLane(wave, idx, cfg) {
      if (Array.isArray(wave)) {
        const tag = wave[0];
        const attr = wave[1];
        if (tag === "pw" && typeof attr === "object") {
          const d = scale(attr.d, cfg);
          return [
            "g",
            tt(0, cfg.yo * idx + cfg.ys + cfg.y0),
            ["path", { style: "fill:none;stroke:#000;stroke-width:1px;", d }]
          ];
        }
      }
    }
    function renderPieceWise(lanes, index, cfg) {
      let res = ["g"];
      lanes.map((row, idx) => {
        const wave = row.wave;
        if (Array.isArray(wave)) {
          res.push(renderLane(wave, idx, cfg));
        }
      });
      return res;
    }
    module2.exports = renderPieceWise;
  }
});

// node_modules/wavedrom/lib/render-lanes.js
var require_render_lanes = __commonJS({
  "node_modules/wavedrom/lib/render-lanes.js"(exports2, module2) {
    "use strict";
    var renderMarks = require_render_marks();
    var renderArcs = require_render_arcs();
    var renderGaps = require_render_gaps();
    var renderPieceWise = require_render_piece_wise();
    function renderLanes(index, content, waveLanes, ret, source, lane) {
      return [
        renderMarks(content, index, lane, source)
      ].concat(
        waveLanes.res,
        [
          renderArcs(ret.lanes, index, source, lane),
          renderGaps(ret.lanes, index, source, lane),
          renderPieceWise(ret.lanes, index, lane)
        ]
      );
    }
    module2.exports = renderLanes;
  }
});

// node_modules/wavedrom/lib/render-over-under.js
var require_render_over_under = __commonJS({
  "node_modules/wavedrom/lib/render-over-under.js"(exports2, module2) {
    "use strict";
    var tt = require_tt();
    var colors = {
      1: "#000000",
      2: "#e90000",
      3: "#3edd00",
      4: "#0074cd",
      5: "#ff15db",
      6: "#af9800",
      7: "#00864f",
      8: "#a076ff"
    };
    function renderOverUnder(el, key, lane) {
      const xs = lane.xs;
      const ys = lane.ys;
      const period = (el.period || 1) * 2 * xs;
      const xoffset = -(el.phase || 0) * 2 * xs;
      const gap1 = 12;
      const serif = 7;
      let color2;
      const y = key === "under" ? ys : 0;
      let start;
      function line(x) {
        return start === void 0 ? [] : [["line", {
          style: "stroke:" + color2,
          x1: period * start + gap1,
          x2: period * x
        }]];
      }
      if (el[key]) {
        let res = ["g", tt(
          xoffset,
          y,
          { style: "stroke-width:3" }
        )];
        const arr = el[key].split("");
        arr.map(function(dot2, i) {
          if (dot2 !== "." && start !== void 0) {
            res = res.concat(line(i));
            if (key === "over") {
              res.push(["path", {
                style: "stroke:none;fill:" + color2,
                d: "m" + (period * i - serif) + " 0 l" + serif + " " + serif + " v-" + serif + " z"
              }]);
            }
          }
          if (dot2 === "0") {
            start = void 0;
          } else if (dot2 !== ".") {
            start = i;
            color2 = colors[dot2] || colors[1];
          }
        });
        if (start !== void 0) {
          res = res.concat(line(arr.length));
        }
        return [res];
      }
      return [];
    }
    module2.exports = renderOverUnder;
  }
});

// node_modules/wavedrom/lib/render-wave-lane.js
var require_render_wave_lane = __commonJS({
  "node_modules/wavedrom/lib/render-wave-lane.js"(exports2, module2) {
    "use strict";
    var tt = require_tt();
    var tspan = require_lib();
    var textWidth = require_text_width();
    var findLaneMarkers = require_find_lane_markers();
    var renderOverUnder = require_render_over_under();
    function renderLaneUses(cont, lane) {
      const res = [];
      if (cont[1]) {
        cont[1].map(function(ref, i) {
          res.push(["use", tt(i * lane.xs, 0, { "xlink:href": "#" + ref })]);
        });
        if (cont[2] && cont[2].length) {
          const labels = findLaneMarkers(cont[1]);
          if (labels.length) {
            labels.map(function(label, i) {
              if (cont[2] && cont[2][i] !== void 0) {
                res.push(["text", {
                  x: label * lane.xs + lane.xlabel,
                  y: lane.ym,
                  "text-anchor": "middle",
                  "xml:space": "preserve"
                }].concat(tspan.parse(cont[2][i])));
              }
            });
          }
        }
      }
      return res;
    }
    function renderWaveLane(content, index, lane) {
      let xmax = 0;
      const glengths = [];
      const res = [];
      content.map(function(el, j) {
        const name = el[0][0];
        if (name) {
          let xoffset = el[0][1];
          xoffset = xoffset > 0 ? Math.ceil(2 * xoffset) - 2 * xoffset : -2 * xoffset;
          res.push(
            ["g", tt(
              0,
              lane.y0 + j * lane.yo,
              { id: "wavelane_" + j + "_" + index }
            )].concat([
              ["text", {
                x: lane.tgo,
                y: lane.ym,
                class: "info",
                "text-anchor": "end",
                "xml:space": "preserve"
              }].concat(tspan.parse(name))
            ]).concat([
              ["g", tt(
                xoffset * lane.xs,
                0,
                { id: "wavelane_draw_" + j + "_" + index }
              )].concat(renderLaneUses(el, lane))
            ]).concat(
              renderOverUnder(el[3], "over", lane),
              renderOverUnder(el[3], "under", lane)
            )
          );
          xmax = Math.max(xmax, (el[1] || []).length);
          glengths.push(name.textWidth ? name.textWidth : name.charCodeAt ? textWidth(name, 11) : 0);
        }
      });
      lane.xmax = Math.min(xmax, lane.xmax_cfg - lane.xmin_cfg);
      const xgmax = 0;
      lane.xg = xgmax + 20;
      return { glengths, res };
    }
    module2.exports = renderWaveLane;
  }
});

// node_modules/wavedrom/lib/w3.js
var require_w3 = __commonJS({
  "node_modules/wavedrom/lib/w3.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      svg: "http://www.w3.org/2000/svg",
      xlink: "http://www.w3.org/1999/xlink",
      xmlns: "http://www.w3.org/XML/1998/namespace"
    };
  }
});

// node_modules/wavedrom/lib/insert-svg-template.js
var require_insert_svg_template = __commonJS({
  "node_modules/wavedrom/lib/insert-svg-template.js"(exports2, module2) {
    "use strict";
    var tt = require_tt();
    var w3 = require_w3();
    function insertSVGTemplate(index, source, lane, waveSkin, content, lanes, groups, notFirstSignal) {
      const waveSkinNames = Object.keys(waveSkin);
      let skin = waveSkin.default || waveSkin[waveSkinNames[0]];
      if (source && source.config && source.config.skin && waveSkin[source.config.skin]) {
        skin = waveSkin[source.config.skin];
      }
      const e = notFirstSignal ? ["svg", { id: "svg", xmlns: w3.svg, "xmlns:xlink": w3.xlink }, ["g"]] : skin;
      const width = lane.xg + lane.xs * (lane.xmax + 1);
      const height = content.length * lane.yo + lane.yh0 + lane.yh1 + lane.yf0 + lane.yf1;
      const body = e[e.length - 1];
      body[1] = { id: "waves_" + index };
      body[2] = ["rect", { width, height, style: "stroke:none;fill:white" }];
      body[3] = ["g", tt(
        lane.xg + 0.5,
        lane.yh0 + lane.yh1 + 0.5,
        { id: "lanes_" + index }
      )].concat(lanes);
      body[4] = ["g", {
        id: "groups_" + index
      }, groups];
      const head = e[1];
      head.id = "svgcontent_" + index;
      head.xmlns = w3.svg;
      head["xmlns:xlink"] = w3.xlink;
      head.height = height;
      head.width = width;
      head.viewBox = "0 0 " + width + " " + height;
      head.overflow = "hidden";
      return e;
    }
    module2.exports = insertSVGTemplate;
  }
});

// node_modules/wavedrom/lib/render-signal.js
var require_render_signal = __commonJS({
  "node_modules/wavedrom/lib/render-signal.js"(exports2, module2) {
    "use strict";
    var rec = require_rec();
    var lane = require_lane();
    var parseConfig = require_parse_config();
    var parseWaveLanes = require_parse_wave_lanes();
    var renderGroups = require_render_groups();
    var renderLanes = require_render_lanes();
    var renderWaveLane = require_render_wave_lane();
    var insertSVGTemplate = require_insert_svg_template();
    function laneParamsFromSkin(index, source, lane2, waveSkin) {
      if (index !== 0) {
        return;
      }
      const waveSkinNames = Object.keys(waveSkin);
      if (waveSkinNames.length === 0) {
        throw new Error("no skins found");
      }
      let skin = waveSkin.default || waveSkin[waveSkinNames[0]];
      if (source && source.config && source.config.skin && waveSkin[source.config.skin]) {
        skin = waveSkin[source.config.skin];
      }
      const socket = skin[3][1][2][1];
      lane2.xs = Number(socket.width);
      lane2.ys = Number(socket.height);
      lane2.xlabel = Number(socket.x);
      lane2.ym = Number(socket.y);
    }
    function renderSignal(index, source, waveSkin, notFirstSignal) {
      laneParamsFromSkin(index, source, lane, waveSkin);
      parseConfig(source, lane);
      const ret = rec(source.signal, { x: 0, y: 0, xmax: 0, width: [], lanes: [], groups: [] });
      const content = parseWaveLanes(ret.lanes, lane);
      const waveLanes = renderWaveLane(content, index, lane);
      const waveGroups = renderGroups(ret.groups, index, lane);
      const xmax = waveLanes.glengths.reduce((res, len2, i) => Math.max(res, len2 + ret.width[i]), 0);
      lane.xg = Math.ceil((xmax - lane.tgo) / lane.xs) * lane.xs;
      return insertSVGTemplate(
        index,
        source,
        lane,
        waveSkin,
        content,
        renderLanes(index, content, waveLanes, ret, source, lane),
        waveGroups,
        notFirstSignal
      );
    }
    module2.exports = renderSignal;
  }
});

// node_modules/wavedrom/lib/render-any.js
var require_render_any = __commonJS({
  "node_modules/wavedrom/lib/render-any.js"(exports2, module2) {
    "use strict";
    var renderAssign = require_render_assign();
    var renderReg = require_render_reg();
    var renderSignal = require_render_signal();
    var w3 = require_w3();
    function renderAny2(index, source, waveSkin, notFirstSignal) {
      const res = source.signal ? renderSignal(index, source, waveSkin, notFirstSignal) : source.assign ? renderAssign(index, source) : source.reg ? renderReg(index, source) : ["div", {}];
      if (res[0] === "svg") {
        res[1].xmlns = w3.svg;
        res[1]["xmlns:xlink"] = w3.xlink;
      }
      res[1].class = "WaveDrom";
      return res;
    }
    module2.exports = renderAny2;
  }
});

// node_modules/wavedrom/skins/default.js
var require_default = __commonJS({
  "node_modules/wavedrom/skins/default.js"(exports2, module2) {
    var WaveSkin = WaveSkin || {};
    WaveSkin.default = ["svg", { id: "svg", height: "0" }, ["style", { type: "text/css" }, "text{font-size:11pt;font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;text-align:center;fill-opacity:1;font-family:Helvetica}.h1{font-size:33pt;font-weight:bold}.h2{font-size:27pt;font-weight:bold}.h3{font-size:20pt;font-weight:bold}.h4{font-size:14pt;font-weight:bold}.h5{font-size:11pt;font-weight:bold}.h6{font-size:8pt;font-weight:bold}.muted{fill:#aaa}.warning{fill:#f6b900}.error{fill:#f60000}.info{fill:#0041c4}.success{fill:#00ab00}.s1{fill:none;stroke:#000;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}.s2{fill:none;stroke:#000;stroke-width:0.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}.s3{color:#000;fill:none;stroke:#000;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:1, 3;stroke-dashoffset:0;marker:none;visibility:visible;display:inline;overflow:visible}.s4{color:#000;fill:none;stroke:#000;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0;marker:none;visibility:visible;display:inline;overflow:visible}.s5{fill:#fff;stroke:none}.s6{fill:#000;fill-opacity:1;stroke:none}.s7{color:#000;fill:#fff;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s8{color:#000;fill:#ffffb4;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s9{color:#000;fill:#ffe0b9;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s10{color:#000;fill:#b9e0ff;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s11{color:#000;fill:#ccfdfe;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s12{color:#000;fill:#cdfdc5;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s13{color:#000;fill:#f0c1fb;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s14{color:#000;fill:#f5c2c0;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s15{fill:#0041c4;fill-opacity:1;stroke:none}.s16{fill:none;stroke:#0041c4;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}"], ["defs", ["g", { id: "socket" }, ["rect", { y: "15", x: "6", height: "20", width: "20" }]], ["g", { id: "pclk" }, ["path", { d: "M0,20 0,0 20,0", class: "s1" }]], ["g", { id: "nclk" }, ["path", { d: "m0,0 0,20 20,0", class: "s1" }]], ["g", { id: "000" }, ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "0m0" }, ["path", { d: "m0,20 3,0 3,-10 3,10 11,0", class: "s1" }]], ["g", { id: "0m1" }, ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "0mx" }, ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 5,20", class: "s2" }], ["path", { d: "M20,0 4,16", class: "s2" }], ["path", { d: "M15,0 6,9", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "0md" }, ["path", { d: "m8,20 10,0", class: "s3" }], ["path", { d: "m0,20 5,0", class: "s1" }]], ["g", { id: "0mu" }, ["path", { d: "m0,20 3,0 C 7,10 10.107603,0 20,0", class: "s1" }]], ["g", { id: "0mz" }, ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "111" }, ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "1m0" }, ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }]], ["g", { id: "1m1" }, ["path", { d: "M0,0 3,0 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "1mx" }, ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 6,9", class: "s2" }], ["path", { d: "M10,0 5,5", class: "s2" }], ["path", { d: "M3.5,1.5 5,0", class: "s2" }]], ["g", { id: "1md" }, ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }]], ["g", { id: "1mu" }, ["path", { d: "M0,0 5,0", class: "s1" }], ["path", { d: "M8,0 18,0", class: "s3" }]], ["g", { id: "1mz" }, ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }]], ["g", { id: "xxx" }, ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,5 5,0", class: "s2" }], ["path", { d: "M0,10 10,0", class: "s2" }], ["path", { d: "M0,15 15,0", class: "s2" }], ["path", { d: "M0,20 20,0", class: "s2" }], ["path", { d: "M5,20 20,5", class: "s2" }], ["path", { d: "M10,20 20,10", class: "s2" }], ["path", { d: "m15,20 5,-5", class: "s2" }]], ["g", { id: "xm0" }, ["path", { d: "M0,0 4,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,5 4,1", class: "s2" }], ["path", { d: "M0,10 5,5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 7,13", class: "s2" }], ["path", { d: "M5,20 8,17", class: "s2" }]], ["g", { id: "xm1" }, ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 4,20 9,0", class: "s1" }], ["path", { d: "M0,5 5,0", class: "s2" }], ["path", { d: "M0,10 9,1", class: "s2" }], ["path", { d: "M0,15 7,8", class: "s2" }], ["path", { d: "M0,20 5,15", class: "s2" }]], ["g", { id: "xmx" }, ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,5 5,0", class: "s2" }], ["path", { d: "M0,10 10,0", class: "s2" }], ["path", { d: "M0,15 15,0", class: "s2" }], ["path", { d: "M0,20 20,0", class: "s2" }], ["path", { d: "M5,20 20,5", class: "s2" }], ["path", { d: "M10,20 20,10", class: "s2" }], ["path", { d: "m15,20 5,-5", class: "s2" }]], ["g", { id: "xmd" }, ["path", { d: "m0,0 4,0 c 3,10 6,20 16,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,5 4,1", class: "s2" }], ["path", { d: "M0,10 5.5,4.5", class: "s2" }], ["path", { d: "M0,15 6.5,8.5", class: "s2" }], ["path", { d: "M0,20 8,12", class: "s2" }], ["path", { d: "m5,20 5,-5", class: "s2" }], ["path", { d: "m10,20 2.5,-2.5", class: "s2" }]], ["g", { id: "xmu" }, ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "m0,20 4,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,5 5,0", class: "s2" }], ["path", { d: "M0,10 10,0", class: "s2" }], ["path", { d: "M0,15 10,5", class: "s2" }], ["path", { d: "M0,20 6,14", class: "s2" }]], ["g", { id: "xmz" }, ["path", { d: "m0,0 4,0 c 6,10 11,10 16,10", class: "s1" }], ["path", { d: "m0,20 4,0 C 10,10 15,10 20,10", class: "s1" }], ["path", { d: "M0,5 4.5,0.5", class: "s2" }], ["path", { d: "M0,10 6.5,3.5", class: "s2" }], ["path", { d: "M0,15 8.5,6.5", class: "s2" }], ["path", { d: "M0,20 11.5,8.5", class: "s2" }]], ["g", { id: "ddd" }, ["path", { d: "m0,20 20,0", class: "s3" }]], ["g", { id: "dm0" }, ["path", { d: "m0,20 10,0", class: "s3" }], ["path", { d: "m12,20 8,0", class: "s1" }]], ["g", { id: "dm1" }, ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "dmx" }, ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 5,20", class: "s2" }], ["path", { d: "M20,0 4,16", class: "s2" }], ["path", { d: "M15,0 6,9", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "dmd" }, ["path", { d: "m0,20 20,0", class: "s3" }]], ["g", { id: "dmu" }, ["path", { d: "m0,20 3,0 C 7,10 10.107603,0 20,0", class: "s1" }]], ["g", { id: "dmz" }, ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "uuu" }, ["path", { d: "M0,0 20,0", class: "s3" }]], ["g", { id: "um0" }, ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }]], ["g", { id: "um1" }, ["path", { d: "M0,0 10,0", class: "s3" }], ["path", { d: "m12,0 8,0", class: "s1" }]], ["g", { id: "umx" }, ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 6,9", class: "s2" }], ["path", { d: "M10,0 5,5", class: "s2" }], ["path", { d: "M3.5,1.5 5,0", class: "s2" }]], ["g", { id: "umd" }, ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }]], ["g", { id: "umu" }, ["path", { d: "M0,0 20,0", class: "s3" }]], ["g", { id: "umz" }, ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s4" }]], ["g", { id: "zzz" }, ["path", { d: "m0,10 20,0", class: "s1" }]], ["g", { id: "zm0" }, ["path", { d: "m0,10 6,0 3,10 11,0", class: "s1" }]], ["g", { id: "zm1" }, ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "zmx" }, ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 6.5,8.5", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "zmd" }, ["path", { d: "m0,10 7,0 c 3,5 8,10 13,10", class: "s1" }]], ["g", { id: "zmu" }, ["path", { d: "m0,10 7,0 C 10,5 15,0 20,0", class: "s1" }]], ["g", { id: "zmz" }, ["path", { d: "m0,10 20,0", class: "s1" }]], ["g", { id: "gap" }, ["path", { d: "m7,-2 -4,0 c -5,0 -5,24 -10,24 l 4,0 C 2,22 2,-2 7,-2 z", class: "s5" }], ["path", { d: "M-7,22 C -2,22 -2,-2 3,-2", class: "s1" }], ["path", { d: "M-3,22 C 2,22 2,-2 7,-2", class: "s1" }]], ["g", { id: "Pclk" }, ["path", { d: "M-3,12 0,3 3,12 C 1,11 -1,11 -3,12 z", class: "s6" }], ["path", { d: "M0,20 0,0 20,0", class: "s1" }]], ["g", { id: "Nclk" }, ["path", { d: "M-3,8 0,17 3,8 C 1,9 -1,9 -3,8 z", class: "s6" }], ["path", { d: "m0,0 0,20 20,0", class: "s1" }]], ["g", { id: "0mv-2" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s7" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-2" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s7" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-2" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s7" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-2" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s7" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-2" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s7" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-2" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s7" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-2" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s7" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-2" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-2" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s7" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-2" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s7" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-2" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s7" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-3" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s8" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-3" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s8" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-3" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s8" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-3" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s8" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-3" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s8" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-3" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s8" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-3" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s8" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-3" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-3" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s8" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-3" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s8" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-3" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s8" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-4" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s9" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-4" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s9" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-4" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s9" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-4" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s9" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-4" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s9" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-4" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s9" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-4" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s9" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-4" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-4" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s9" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-4" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s9" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-4" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s9" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-5" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s10" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-5" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s10" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-5" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s10" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-5" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s10" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-5" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s10" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-5" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s10" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-5" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s10" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-5" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-5" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s10" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-5" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s10" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-5" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s10" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-6" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s11" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-6" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s11" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-6" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s11" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-6" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s11" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-6" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s11" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-6" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s11" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-6" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s11" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-6" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-6" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s11" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-6" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s11" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-6" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s11" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-7" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s12" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-7" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s12" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-7" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s12" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-7" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s12" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-7" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s12" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-7" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s12" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-7" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s12" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-7" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-7" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s12" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-7" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s12" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-7" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s12" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-8" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s13" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-8" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s13" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-8" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s13" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-8" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s13" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-8" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s13" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-8" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s13" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-8" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s13" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-8" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-8" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s13" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-8" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s13" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-8" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s13" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "0mv-9" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s14" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "1mv-9" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s14" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "xmv-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,5 3.5,1.5", class: "s2" }], ["path", { d: "M0,10 4.5,5.5", class: "s2" }], ["path", { d: "M0,15 6,9", class: "s2" }], ["path", { d: "M0,20 4,16", class: "s2" }]], ["g", { id: "dmv-9" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s14" }], ["path", { d: "M3,20 9,0 20,0", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "umv-9" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s14" }], ["path", { d: "m3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "zmv-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "m6,10 3,10 11,0", class: "s1" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s1" }]], ["g", { id: "vvv-9" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s14" }], ["path", { d: "m0,20 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vm0-9" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s14" }], ["path", { d: "M0,0 3,0 9,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vm1-9" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s14" }], ["path", { d: "M0,0 20,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0", class: "s1" }]], ["g", { id: "vmx-9" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }], ["path", { d: "m20,15 -5,5", class: "s2" }], ["path", { d: "M20,10 10,20", class: "s2" }], ["path", { d: "M20,5 8,17", class: "s2" }], ["path", { d: "M20,0 7,13", class: "s2" }], ["path", { d: "M15,0 7,8", class: "s2" }], ["path", { d: "M10,0 9,1", class: "s2" }]], ["g", { id: "vmd-9" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s14" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s1" }], ["path", { d: "m0,20 20,0", class: "s1" }]], ["g", { id: "vmu-9" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s14" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s1" }], ["path", { d: "M0,0 20,0", class: "s1" }]], ["g", { id: "vmz-9" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s14" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s1" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s1" }]], ["g", { id: "vmv-2-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s7" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-2-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s7" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-3-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-4-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-5-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-6-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-7-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-8-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "vmv-9-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s1" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s1" }]], ["g", { id: "arrow0" }, ["path", { d: "m-12,-3 9,3 -9,3 c 1,-2 1,-4 0,-6 z", class: "s15" }], ["path", { d: "M0,0 -15,0", class: "s16" }]], ["marker", { id: "arrowhead", style: "fill:#0041c4", markerHeight: 7, markerWidth: 10, markerUnits: "strokeWidth", viewBox: "0 -4 11 8", refX: 15, refY: 0, orient: "auto" }, ["path", { d: "M0 -4 11 0 0 4z" }]], ["marker", { id: "arrowtail", style: "fill:#0041c4", markerHeight: 7, markerWidth: 10, markerUnits: "strokeWidth", viewBox: "-11 -4 11 8", refX: -15, refY: 0, orient: "auto" }, ["path", { d: "M0 -4 -11 0 0 4z" }]], ["marker", { id: "tee", style: "fill:#0041c4", markerHeight: 6, markerWidth: 1, markerUnits: "strokeWidth", viewBox: "0 0 1 6", refX: 0, refY: 3, orient: "auto" }, ["path", { d: "M 0 0 L 0 6", style: "stroke:#0041c4;stroke-width:2" }]]], ["g", { id: "waves" }, ["g", { id: "lanes" }], ["g", { id: "groups" }]]];
    try {
      module2.exports = WaveSkin;
    } catch (err) {
    }
  }
});

// node_modules/wavedrom/skins/dark.js
var require_dark = __commonJS({
  "node_modules/wavedrom/skins/dark.js"(exports2, module2) {
    var WaveSkin = WaveSkin || {};
    WaveSkin.dark = ["svg", { id: "svg", height: "0" }, ["style", { type: "text/css" }, "text{font-size:11pt;font-style:normal;font-variant:normal;font-weight:normal;font-stretch:normal;text-align:center;fill-opacity:1;font-family:Helvetica}.h1{font-size:33pt;font-weight:bold}.h2{font-size:27pt;font-weight:bold}.h3{font-size:20pt;font-weight:bold}.h4{font-size:14pt;font-weight:bold}.h5{font-size:11pt;font-weight:bold}.h6{font-size:8pt;font-weight:bold}.muted{fill:#aaa}.warning{fill:#ffe000}.error{fill:#ff232a}.info{fill:#b8fffc}.success{fill:#24ff23}text{fill:#ffffff}.s1{fill:none;stroke:#ffffff;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}.s2{fill:none;stroke:#fff;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}.s3{fill:none;stroke:#fff;stroke-width:0.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}.s4{color:#000;fill:none;stroke:#fff;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:1, 3;stroke-dashoffset:0;marker:none;visibility:visible;display:inline;overflow:visible}.s5{color:#000;fill:none;stroke:#fff;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none;stroke-dashoffset:0;marker:none;visibility:visible;display:inline;overflow:visible}.s6{fill:#000000;stroke:none;fill-opacity:1}.s7{fill:#ffffff;fill-opacity:1;stroke:none}.s8{color:#000;fill:#000;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s9{color:#000;fill:#0010c0;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s10{color:#000;fill:#2d6500;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s11{color:#000;fill:#870500;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s12{color:#000;fill:#007a80;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s13{color:#000;fill:#680066;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s14{color:#000;fill:#5f5f5f;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s15{color:#000;fill:#2e005e;fill-opacity:1;fill-rule:nonzero;stroke:none;stroke-width:1px;marker:none;visibility:visible;display:inline;overflow:visible}.s16{fill:#fff400;fill-opacity:1;stroke:none}.s17{fill:none;stroke:#fff400;stroke-width:1;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-opacity:1;stroke-dasharray:none}"], ["defs", ["g", { id: "socket" }, ["rect", { y: "15", x: "6", height: "20", width: "20" }]], ["g", { id: "pclk" }, ["path", { d: "M0,20 0,0 20,0", class: "s1" }]], ["g", { id: "nclk" }, ["path", { d: "m0,0 0,20 20,0", class: "s2" }]], ["g", { id: "000" }, ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "0m0" }, ["path", { d: "m0,20 3,0 3,-10 3,10 11,0", class: "s2" }]], ["g", { id: "0m1" }, ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "0mx" }, ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 5,20", class: "s3" }], ["path", { d: "M20,0 4,16", class: "s3" }], ["path", { d: "M15,0 6,9", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "0md" }, ["path", { d: "m8,20 10,0", class: "s4" }], ["path", { d: "m0,20 5,0", class: "s2" }]], ["g", { id: "0mu" }, ["path", { d: "m0,20 3,0 C 7,10 10.107603,0 20,0", class: "s2" }]], ["g", { id: "0mz" }, ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "111" }, ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "1m0" }, ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }]], ["g", { id: "1m1" }, ["path", { d: "M0,0 3,0 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "1mx" }, ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 6,9", class: "s3" }], ["path", { d: "M10,0 5,5", class: "s3" }], ["path", { d: "M3.5,1.5 5,0", class: "s3" }]], ["g", { id: "1md" }, ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }]], ["g", { id: "1mu" }, ["path", { d: "M0,0 5,0", class: "s2" }], ["path", { d: "M8,0 18,0", class: "s4" }]], ["g", { id: "1mz" }, ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }]], ["g", { id: "xxx" }, ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,5 5,0", class: "s3" }], ["path", { d: "M0,10 10,0", class: "s3" }], ["path", { d: "M0,15 15,0", class: "s3" }], ["path", { d: "M0,20 20,0", class: "s3" }], ["path", { d: "M5,20 20,5", class: "s3" }], ["path", { d: "M10,20 20,10", class: "s3" }], ["path", { d: "m15,20 5,-5", class: "s3" }]], ["g", { id: "xm0" }, ["path", { d: "M0,0 4,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,5 4,1", class: "s3" }], ["path", { d: "M0,10 5,5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 7,13", class: "s3" }], ["path", { d: "M5,20 8,17", class: "s3" }]], ["g", { id: "xm1" }, ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 4,20 9,0", class: "s2" }], ["path", { d: "M0,5 5,0", class: "s3" }], ["path", { d: "M0,10 9,1", class: "s3" }], ["path", { d: "M0,15 7,8", class: "s3" }], ["path", { d: "M0,20 5,15", class: "s3" }]], ["g", { id: "xmx" }, ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,5 5,0", class: "s3" }], ["path", { d: "M0,10 10,0", class: "s3" }], ["path", { d: "M0,15 15,0", class: "s3" }], ["path", { d: "M0,20 20,0", class: "s3" }], ["path", { d: "M5,20 20,5", class: "s3" }], ["path", { d: "M10,20 20,10", class: "s3" }], ["path", { d: "m15,20 5,-5", class: "s3" }]], ["g", { id: "xmd" }, ["path", { d: "m0,0 4,0 c 3,10 6,20 16,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,5 4,1", class: "s3" }], ["path", { d: "M0,10 5.5,4.5", class: "s3" }], ["path", { d: "M0,15 6.5,8.5", class: "s3" }], ["path", { d: "M0,20 8,12", class: "s3" }], ["path", { d: "m5,20 5,-5", class: "s3" }], ["path", { d: "m10,20 2.5,-2.5", class: "s3" }]], ["g", { id: "xmu" }, ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "m0,20 4,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,5 5,0", class: "s3" }], ["path", { d: "M0,10 10,0", class: "s3" }], ["path", { d: "M0,15 10,5", class: "s3" }], ["path", { d: "M0,20 6,14", class: "s3" }]], ["g", { id: "xmz" }, ["path", { d: "m0,0 4,0 c 6,10 11,10 16,10", class: "s2" }], ["path", { d: "m0,20 4,0 C 10,10 15,10 20,10", class: "s2" }], ["path", { d: "M0,5 4.5,0.5", class: "s3" }], ["path", { d: "M0,10 6.5,3.5", class: "s3" }], ["path", { d: "M0,15 8.5,6.5", class: "s3" }], ["path", { d: "M0,20 11.5,8.5", class: "s3" }]], ["g", { id: "ddd" }, ["path", { d: "m0,20 20,0", class: "s4" }]], ["g", { id: "dm0" }, ["path", { d: "m0,20 10,0", class: "s4" }], ["path", { d: "m12,20 8,0", class: "s2" }]], ["g", { id: "dm1" }, ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "dmx" }, ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 5,20", class: "s3" }], ["path", { d: "M20,0 4,16", class: "s3" }], ["path", { d: "M15,0 6,9", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "dmd" }, ["path", { d: "m0,20 20,0", class: "s4" }]], ["g", { id: "dmu" }, ["path", { d: "m0,20 3,0 C 7,10 10.107603,0 20,0", class: "s2" }]], ["g", { id: "dmz" }, ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "uuu" }, ["path", { d: "M0,0 20,0", class: "s4" }]], ["g", { id: "um0" }, ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }]], ["g", { id: "um1" }, ["path", { d: "M0,0 10,0", class: "s4" }], ["path", { d: "m12,0 8,0", class: "s2" }]], ["g", { id: "umx" }, ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 6,9", class: "s3" }], ["path", { d: "M10,0 5,5", class: "s3" }], ["path", { d: "M3.5,1.5 5,0", class: "s3" }]], ["g", { id: "umd" }, ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }]], ["g", { id: "umu" }, ["path", { d: "M0,0 20,0", class: "s4" }]], ["g", { id: "umz" }, ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s5" }]], ["g", { id: "zzz" }, ["path", { d: "m0,10 20,0", class: "s2" }]], ["g", { id: "zm0" }, ["path", { d: "m0,10 6,0 3,10 11,0", class: "s2" }]], ["g", { id: "zm1" }, ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "zmx" }, ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 6.5,8.5", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "zmd" }, ["path", { d: "m0,10 7,0 c 3,5 8,10 13,10", class: "s2" }]], ["g", { id: "zmu" }, ["path", { d: "m0,10 7,0 C 10,5 15,0 20,0", class: "s2" }]], ["g", { id: "zmz" }, ["path", { d: "m0,10 20,0", class: "s2" }]], ["g", { id: "gap" }, ["path", { d: "m7,-2 -4,0 c -5,0 -5,24 -10,24 l 4,0 C 2,22 2,-2 7,-2 z", class: "s6" }], ["path", { d: "M-7,22 C -2,22 -2,-2 3,-2", class: "s2" }], ["path", { d: "M-3,22 C 2,22 2,-2 7,-2", class: "s2" }]], ["g", { id: "Pclk" }, ["path", { d: "M-3,12 0,3 3,12 C 1,11 -1,11 -3,12 z", class: "s7" }], ["path", { d: "M0,20 0,0 20,0", class: "s2" }]], ["g", { id: "Nclk" }, ["path", { d: "M-3,8 0,17 3,8 C 1,9 -1,9 -3,8 z", class: "s7" }], ["path", { d: "m0,0 0,20 20,0", class: "s2" }]], ["g", { id: "0mv-2" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s8" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-2" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s8" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-2" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s8" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-2" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s8" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-2" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s8" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-2" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s8" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-2" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s8" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-2" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-2" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s8" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-2" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s8" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-2" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s8" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-3" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s9" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-3" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s9" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-3" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s9" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-3" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s9" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-3" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s9" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-3" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s9" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-3" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s9" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-3" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-3" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s9" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-3" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s9" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-3" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s9" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-4" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s10" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-4" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s10" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-4" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s10" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-4" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s10" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-4" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s10" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-4" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s10" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-4" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s10" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-4" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-4" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s10" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-4" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s10" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-4" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s10" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-5" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s11" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-5" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s11" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-5" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s11" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-5" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s11" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-5" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s11" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-5" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s11" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-5" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s11" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-5" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-5" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s11" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-5" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s11" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-5" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s11" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-6" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s12" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-6" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s12" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-6" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s12" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-6" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s12" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-6" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s12" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-6" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s12" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-6" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s12" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-6" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-6" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s12" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-6" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s12" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-6" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s12" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-7" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s13" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-7" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s13" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-7" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s13" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-7" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s13" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-7" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s13" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-7" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s13" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-7" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s13" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-7" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-7" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s13" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-7" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s13" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-7" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s13" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-8" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s14" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-8" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s14" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-8" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s14" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-8" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s14" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-8" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s14" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-8" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s14" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-8" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s14" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-8" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-8" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s14" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-8" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s14" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-8" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s14" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "0mv-9" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s15" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "1mv-9" }, ["path", { d: "M2.875,0 20,0 20,20 9,20 z", class: "s15" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "xmv-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,5 3.5,1.5", class: "s3" }], ["path", { d: "M0,10 4.5,5.5", class: "s3" }], ["path", { d: "M0,15 6,9", class: "s3" }], ["path", { d: "M0,20 4,16", class: "s3" }]], ["g", { id: "dmv-9" }, ["path", { d: "M9,0 20,0 20,20 3,20 z", class: "s15" }], ["path", { d: "M3,20 9,0 20,0", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "umv-9" }, ["path", { d: "M3,0 20,0 20,20 9,20 z", class: "s15" }], ["path", { d: "m3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "zmv-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "m6,10 3,10 11,0", class: "s2" }], ["path", { d: "M0,10 6,10 9,0 20,0", class: "s2" }]], ["g", { id: "vvv-9" }, ["path", { d: "M20,20 0,20 0,0 20,0", class: "s15" }], ["path", { d: "m0,20 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vm0-9" }, ["path", { d: "M0,20 0,0 3,0 9,20", class: "s15" }], ["path", { d: "M0,0 3,0 9,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vm1-9" }, ["path", { d: "M0,0 0,20 3,20 9,0", class: "s15" }], ["path", { d: "M0,0 20,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0", class: "s2" }]], ["g", { id: "vmx-9" }, ["path", { d: "M0,0 0,20 3,20 6,10 3,0", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }], ["path", { d: "m20,15 -5,5", class: "s3" }], ["path", { d: "M20,10 10,20", class: "s3" }], ["path", { d: "M20,5 8,17", class: "s3" }], ["path", { d: "M20,0 7,13", class: "s3" }], ["path", { d: "M15,0 7,8", class: "s3" }], ["path", { d: "M10,0 9,1", class: "s3" }]], ["g", { id: "vmd-9" }, ["path", { d: "m0,0 0,20 20,0 C 10,20 7,10 3,0", class: "s15" }], ["path", { d: "m0,0 3,0 c 4,10 7,20 17,20", class: "s2" }], ["path", { d: "m0,20 20,0", class: "s2" }]], ["g", { id: "vmu-9" }, ["path", { d: "m0,0 0,20 3,0 C 7,10 10,0 20,0", class: "s15" }], ["path", { d: "m0,20 3,0 C 7,10 10,0 20,0", class: "s2" }], ["path", { d: "M0,0 20,0", class: "s2" }]], ["g", { id: "vmz-9" }, ["path", { d: "M0,0 3,0 C 10,10 15,10 20,10 15,10 10,10 3,20 L 0,20", class: "s15" }], ["path", { d: "m0,0 3,0 c 7,10 12,10 17,10", class: "s2" }], ["path", { d: "m0,20 3,0 C 10,10 15,10 20,10", class: "s2" }]], ["g", { id: "vmv-2-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-2" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s8" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-3" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s9" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-4" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s10" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-5" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s11" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-6" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s12" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-7" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s13" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-8" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s14" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-2-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s8" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-3-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s9" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-4-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s10" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-5-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s11" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-6-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s12" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-7-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s13" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-8-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s14" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "vmv-9-9" }, ["path", { d: "M9,0 20,0 20,20 9,20 6,10 z", class: "s15" }], ["path", { d: "M3,0 0,0 0,20 3,20 6,10 z", class: "s15" }], ["path", { d: "m0,0 3,0 6,20 11,0", class: "s2" }], ["path", { d: "M0,20 3,20 9,0 20,0", class: "s2" }]], ["g", { id: "arrow0" }, ["path", { d: "m-12,-3 9,3 -9,3 c 1,-2 1,-4 0,-6 z", class: "s16" }], ["path", { d: "M0,0 -15,0", class: "s17" }]], ["marker", { id: "arrowhead", style: "fill:#0041c4", markerHeight: 7, markerWidth: 10, markerUnits: "strokeWidth", viewBox: "0 -4 11 8", refX: 15, refY: 0, orient: "auto" }, ["path", { d: "M0 -4 11 0 0 4z" }]], ["marker", { id: "arrowtail", style: "fill:#0041c4", markerHeight: 7, markerWidth: 10, markerUnits: "strokeWidth", viewBox: "-11 -4 11 8", refX: -15, refY: 0, orient: "auto" }, ["path", { d: "M0 -4 -11 0 0 4z" }]], ["marker", { id: "tee", style: "fill:#0041c4", markerHeight: 6, markerWidth: 1, markerUnits: "strokeWidth", viewBox: "0 0 1 6", refX: 0, refY: 3, orient: "auto" }, ["path", { d: "M 0 0 L 0 6", style: "stroke:#0041c4;stroke-width:2" }]]], ["g", { id: "waves" }, ["g", { id: "lanes" }], ["g", { id: "groups" }]]];
    try {
      module2.exports = WaveSkin;
    } catch (err) {
    }
  }
});

// node_modules/json5/lib/unicode.js
var require_unicode = __commonJS({
  "node_modules/json5/lib/unicode.js"(exports2, module2) {
    module2.exports.Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
    module2.exports.ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
    module2.exports.ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
  }
});

// node_modules/json5/lib/util.js
var require_util = __commonJS({
  "node_modules/json5/lib/util.js"(exports2, module2) {
    var unicode = require_unicode();
    module2.exports = {
      isSpaceSeparator(c) {
        return typeof c === "string" && unicode.Space_Separator.test(c);
      },
      isIdStartChar(c) {
        return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "$" || c === "_" || unicode.ID_Start.test(c));
      },
      isIdContinueChar(c) {
        return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "$" || c === "_" || c === "‌" || c === "‍" || unicode.ID_Continue.test(c));
      },
      isDigit(c) {
        return typeof c === "string" && /[0-9]/.test(c);
      },
      isHexDigit(c) {
        return typeof c === "string" && /[0-9A-Fa-f]/.test(c);
      }
    };
  }
});

// node_modules/json5/lib/parse.js
var require_parse2 = __commonJS({
  "node_modules/json5/lib/parse.js"(exports2, module2) {
    var util = require_util();
    var source;
    var parseState;
    var stack;
    var pos;
    var line;
    var column;
    var token;
    var key;
    var root;
    module2.exports = function parse2(text, reviver) {
      source = String(text);
      parseState = "start";
      stack = [];
      pos = 0;
      line = 1;
      column = 0;
      token = void 0;
      key = void 0;
      root = void 0;
      do {
        token = lex();
        parseStates[parseState]();
      } while (token.type !== "eof");
      if (typeof reviver === "function") {
        return internalize({ "": root }, "", reviver);
      }
      return root;
    };
    function internalize(holder, name, reviver) {
      const value = holder[name];
      if (value != null && typeof value === "object") {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const key2 = String(i);
            const replacement = internalize(value, key2, reviver);
            if (replacement === void 0) {
              delete value[key2];
            } else {
              Object.defineProperty(value, key2, {
                value: replacement,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        } else {
          for (const key2 in value) {
            const replacement = internalize(value, key2, reviver);
            if (replacement === void 0) {
              delete value[key2];
            } else {
              Object.defineProperty(value, key2, {
                value: replacement,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        }
      }
      return reviver.call(holder, name, value);
    }
    var lexState;
    var buffer;
    var doubleQuote;
    var sign;
    var c;
    function lex() {
      lexState = "default";
      buffer = "";
      doubleQuote = false;
      sign = 1;
      for (; ; ) {
        c = peek();
        const token2 = lexStates[lexState]();
        if (token2) {
          return token2;
        }
      }
    }
    function peek() {
      if (source[pos]) {
        return String.fromCodePoint(source.codePointAt(pos));
      }
    }
    function read() {
      const c2 = peek();
      if (c2 === "\n") {
        line++;
        column = 0;
      } else if (c2) {
        column += c2.length;
      } else {
        column++;
      }
      if (c2) {
        pos += c2.length;
      }
      return c2;
    }
    var lexStates = {
      default() {
        switch (c) {
          case "	":
          case "\v":
          case "\f":
          case " ":
          case " ":
          case "\uFEFF":
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            read();
            return;
          case "/":
            read();
            lexState = "comment";
            return;
          case void 0:
            read();
            return newToken("eof");
        }
        if (util.isSpaceSeparator(c)) {
          read();
          return;
        }
        return lexStates[parseState]();
      },
      comment() {
        switch (c) {
          case "*":
            read();
            lexState = "multiLineComment";
            return;
          case "/":
            read();
            lexState = "singleLineComment";
            return;
        }
        throw invalidChar(read());
      },
      multiLineComment() {
        switch (c) {
          case "*":
            read();
            lexState = "multiLineCommentAsterisk";
            return;
          case void 0:
            throw invalidChar(read());
        }
        read();
      },
      multiLineCommentAsterisk() {
        switch (c) {
          case "*":
            read();
            return;
          case "/":
            read();
            lexState = "default";
            return;
          case void 0:
            throw invalidChar(read());
        }
        read();
        lexState = "multiLineComment";
      },
      singleLineComment() {
        switch (c) {
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            read();
            lexState = "default";
            return;
          case void 0:
            read();
            return newToken("eof");
        }
        read();
      },
      value() {
        switch (c) {
          case "{":
          case "[":
            return newToken("punctuator", read());
          case "n":
            read();
            literal("ull");
            return newToken("null", null);
          case "t":
            read();
            literal("rue");
            return newToken("boolean", true);
          case "f":
            read();
            literal("alse");
            return newToken("boolean", false);
          case "-":
          case "+":
            if (read() === "-") {
              sign = -1;
            }
            lexState = "sign";
            return;
          case ".":
            buffer = read();
            lexState = "decimalPointLeading";
            return;
          case "0":
            buffer = read();
            lexState = "zero";
            return;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            buffer = read();
            lexState = "decimalInteger";
            return;
          case "I":
            read();
            literal("nfinity");
            return newToken("numeric", Infinity);
          case "N":
            read();
            literal("aN");
            return newToken("numeric", NaN);
          case '"':
          case "'":
            doubleQuote = read() === '"';
            buffer = "";
            lexState = "string";
            return;
        }
        throw invalidChar(read());
      },
      identifierNameStartEscape() {
        if (c !== "u") {
          throw invalidChar(read());
        }
        read();
        const u = unicodeEscape();
        switch (u) {
          case "$":
          case "_":
            break;
          default:
            if (!util.isIdStartChar(u)) {
              throw invalidIdentifier();
            }
            break;
        }
        buffer += u;
        lexState = "identifierName";
      },
      identifierName() {
        switch (c) {
          case "$":
          case "_":
          case "‌":
          case "‍":
            buffer += read();
            return;
          case "\\":
            read();
            lexState = "identifierNameEscape";
            return;
        }
        if (util.isIdContinueChar(c)) {
          buffer += read();
          return;
        }
        return newToken("identifier", buffer);
      },
      identifierNameEscape() {
        if (c !== "u") {
          throw invalidChar(read());
        }
        read();
        const u = unicodeEscape();
        switch (u) {
          case "$":
          case "_":
          case "‌":
          case "‍":
            break;
          default:
            if (!util.isIdContinueChar(u)) {
              throw invalidIdentifier();
            }
            break;
        }
        buffer += u;
        lexState = "identifierName";
      },
      sign() {
        switch (c) {
          case ".":
            buffer = read();
            lexState = "decimalPointLeading";
            return;
          case "0":
            buffer = read();
            lexState = "zero";
            return;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            buffer = read();
            lexState = "decimalInteger";
            return;
          case "I":
            read();
            literal("nfinity");
            return newToken("numeric", sign * Infinity);
          case "N":
            read();
            literal("aN");
            return newToken("numeric", NaN);
        }
        throw invalidChar(read());
      },
      zero() {
        switch (c) {
          case ".":
            buffer += read();
            lexState = "decimalPoint";
            return;
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
          case "x":
          case "X":
            buffer += read();
            lexState = "hexadecimal";
            return;
        }
        return newToken("numeric", sign * 0);
      },
      decimalInteger() {
        switch (c) {
          case ".":
            buffer += read();
            lexState = "decimalPoint";
            return;
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalPointLeading() {
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalFraction";
          return;
        }
        throw invalidChar(read());
      },
      decimalPoint() {
        switch (c) {
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalFraction";
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalFraction() {
        switch (c) {
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalExponent() {
        switch (c) {
          case "+":
          case "-":
            buffer += read();
            lexState = "decimalExponentSign";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalExponentInteger";
          return;
        }
        throw invalidChar(read());
      },
      decimalExponentSign() {
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalExponentInteger";
          return;
        }
        throw invalidChar(read());
      },
      decimalExponentInteger() {
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      hexadecimal() {
        if (util.isHexDigit(c)) {
          buffer += read();
          lexState = "hexadecimalInteger";
          return;
        }
        throw invalidChar(read());
      },
      hexadecimalInteger() {
        if (util.isHexDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      string() {
        switch (c) {
          case "\\":
            read();
            buffer += escape();
            return;
          case '"':
            if (doubleQuote) {
              read();
              return newToken("string", buffer);
            }
            buffer += read();
            return;
          case "'":
            if (!doubleQuote) {
              read();
              return newToken("string", buffer);
            }
            buffer += read();
            return;
          case "\n":
          case "\r":
            throw invalidChar(read());
          case "\u2028":
          case "\u2029":
            separatorChar(c);
            break;
          case void 0:
            throw invalidChar(read());
        }
        buffer += read();
      },
      start() {
        switch (c) {
          case "{":
          case "[":
            return newToken("punctuator", read());
        }
        lexState = "value";
      },
      beforePropertyName() {
        switch (c) {
          case "$":
          case "_":
            buffer = read();
            lexState = "identifierName";
            return;
          case "\\":
            read();
            lexState = "identifierNameStartEscape";
            return;
          case "}":
            return newToken("punctuator", read());
          case '"':
          case "'":
            doubleQuote = read() === '"';
            lexState = "string";
            return;
        }
        if (util.isIdStartChar(c)) {
          buffer += read();
          lexState = "identifierName";
          return;
        }
        throw invalidChar(read());
      },
      afterPropertyName() {
        if (c === ":") {
          return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      beforePropertyValue() {
        lexState = "value";
      },
      afterPropertyValue() {
        switch (c) {
          case ",":
          case "}":
            return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      beforeArrayValue() {
        if (c === "]") {
          return newToken("punctuator", read());
        }
        lexState = "value";
      },
      afterArrayValue() {
        switch (c) {
          case ",":
          case "]":
            return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      end() {
        throw invalidChar(read());
      }
    };
    function newToken(type, value) {
      return {
        type,
        value,
        line,
        column
      };
    }
    function literal(s) {
      for (const c2 of s) {
        const p = peek();
        if (p !== c2) {
          throw invalidChar(read());
        }
        read();
      }
    }
    function escape() {
      const c2 = peek();
      switch (c2) {
        case "b":
          read();
          return "\b";
        case "f":
          read();
          return "\f";
        case "n":
          read();
          return "\n";
        case "r":
          read();
          return "\r";
        case "t":
          read();
          return "	";
        case "v":
          read();
          return "\v";
        case "0":
          read();
          if (util.isDigit(peek())) {
            throw invalidChar(read());
          }
          return "\0";
        case "x":
          read();
          return hexEscape();
        case "u":
          read();
          return unicodeEscape();
        case "\n":
        case "\u2028":
        case "\u2029":
          read();
          return "";
        case "\r":
          read();
          if (peek() === "\n") {
            read();
          }
          return "";
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          throw invalidChar(read());
        case void 0:
          throw invalidChar(read());
      }
      return read();
    }
    function hexEscape() {
      let buffer2 = "";
      let c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
      c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
      return String.fromCodePoint(parseInt(buffer2, 16));
    }
    function unicodeEscape() {
      let buffer2 = "";
      let count = 4;
      while (count-- > 0) {
        const c2 = peek();
        if (!util.isHexDigit(c2)) {
          throw invalidChar(read());
        }
        buffer2 += read();
      }
      return String.fromCodePoint(parseInt(buffer2, 16));
    }
    var parseStates = {
      start() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        push();
      },
      beforePropertyName() {
        switch (token.type) {
          case "identifier":
          case "string":
            key = token.value;
            parseState = "afterPropertyName";
            return;
          case "punctuator":
            pop();
            return;
          case "eof":
            throw invalidEOF();
        }
      },
      afterPropertyName() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        parseState = "beforePropertyValue";
      },
      beforePropertyValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        push();
      },
      beforeArrayValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        if (token.type === "punctuator" && token.value === "]") {
          pop();
          return;
        }
        push();
      },
      afterPropertyValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        switch (token.value) {
          case ",":
            parseState = "beforePropertyName";
            return;
          case "}":
            pop();
        }
      },
      afterArrayValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        switch (token.value) {
          case ",":
            parseState = "beforeArrayValue";
            return;
          case "]":
            pop();
        }
      },
      end() {
      }
    };
    function push() {
      let value;
      switch (token.type) {
        case "punctuator":
          switch (token.value) {
            case "{":
              value = {};
              break;
            case "[":
              value = [];
              break;
          }
          break;
        case "null":
        case "boolean":
        case "numeric":
        case "string":
          value = token.value;
          break;
      }
      if (root === void 0) {
        root = value;
      } else {
        const parent2 = stack[stack.length - 1];
        if (Array.isArray(parent2)) {
          parent2.push(value);
        } else {
          Object.defineProperty(parent2, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      if (value !== null && typeof value === "object") {
        stack.push(value);
        if (Array.isArray(value)) {
          parseState = "beforeArrayValue";
        } else {
          parseState = "beforePropertyName";
        }
      } else {
        const current = stack[stack.length - 1];
        if (current == null) {
          parseState = "end";
        } else if (Array.isArray(current)) {
          parseState = "afterArrayValue";
        } else {
          parseState = "afterPropertyValue";
        }
      }
    }
    function pop() {
      stack.pop();
      const current = stack[stack.length - 1];
      if (current == null) {
        parseState = "end";
      } else if (Array.isArray(current)) {
        parseState = "afterArrayValue";
      } else {
        parseState = "afterPropertyValue";
      }
    }
    function invalidChar(c2) {
      if (c2 === void 0) {
        return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
      }
      return syntaxError(`JSON5: invalid character '${formatChar(c2)}' at ${line}:${column}`);
    }
    function invalidEOF() {
      return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
    }
    function invalidIdentifier() {
      column -= 5;
      return syntaxError(`JSON5: invalid identifier character at ${line}:${column}`);
    }
    function separatorChar(c2) {
      console.warn(`JSON5: '${formatChar(c2)}' in strings is not valid ECMAScript; consider escaping`);
    }
    function formatChar(c2) {
      const replacements = {
        "'": "\\'",
        '"': '\\"',
        "\\": "\\\\",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "	": "\\t",
        "\v": "\\v",
        "\0": "\\0",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029"
      };
      if (replacements[c2]) {
        return replacements[c2];
      }
      if (c2 < " ") {
        const hexString = c2.charCodeAt(0).toString(16);
        return "\\x" + ("00" + hexString).substring(hexString.length);
      }
      return c2;
    }
    function syntaxError(message) {
      const err = new SyntaxError(message);
      err.lineNumber = line;
      err.columnNumber = column;
      return err;
    }
  }
});

// node_modules/json5/lib/stringify.js
var require_stringify = __commonJS({
  "node_modules/json5/lib/stringify.js"(exports2, module2) {
    var util = require_util();
    module2.exports = function stringify(value, replacer, space) {
      const stack = [];
      let indent = "";
      let propertyList;
      let replacerFunc;
      let gap = "";
      let quote;
      if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
        space = replacer.space;
        quote = replacer.quote;
        replacer = replacer.replacer;
      }
      if (typeof replacer === "function") {
        replacerFunc = replacer;
      } else if (Array.isArray(replacer)) {
        propertyList = [];
        for (const v of replacer) {
          let item;
          if (typeof v === "string") {
            item = v;
          } else if (typeof v === "number" || v instanceof String || v instanceof Number) {
            item = String(v);
          }
          if (item !== void 0 && propertyList.indexOf(item) < 0) {
            propertyList.push(item);
          }
        }
      }
      if (space instanceof Number) {
        space = Number(space);
      } else if (space instanceof String) {
        space = String(space);
      }
      if (typeof space === "number") {
        if (space > 0) {
          space = Math.min(10, Math.floor(space));
          gap = "          ".substr(0, space);
        }
      } else if (typeof space === "string") {
        gap = space.substr(0, 10);
      }
      return serializeProperty("", { "": value });
      function serializeProperty(key, holder) {
        let value2 = holder[key];
        if (value2 != null) {
          if (typeof value2.toJSON5 === "function") {
            value2 = value2.toJSON5(key);
          } else if (typeof value2.toJSON === "function") {
            value2 = value2.toJSON(key);
          }
        }
        if (replacerFunc) {
          value2 = replacerFunc.call(holder, key, value2);
        }
        if (value2 instanceof Number) {
          value2 = Number(value2);
        } else if (value2 instanceof String) {
          value2 = String(value2);
        } else if (value2 instanceof Boolean) {
          value2 = value2.valueOf();
        }
        switch (value2) {
          case null:
            return "null";
          case true:
            return "true";
          case false:
            return "false";
        }
        if (typeof value2 === "string") {
          return quoteString(value2, false);
        }
        if (typeof value2 === "number") {
          return String(value2);
        }
        if (typeof value2 === "object") {
          return Array.isArray(value2) ? serializeArray(value2) : serializeObject(value2);
        }
        return void 0;
      }
      function quoteString(value2) {
        const quotes = {
          "'": 0.1,
          '"': 0.2
        };
        const replacements = {
          "'": "\\'",
          '"': '\\"',
          "\\": "\\\\",
          "\b": "\\b",
          "\f": "\\f",
          "\n": "\\n",
          "\r": "\\r",
          "	": "\\t",
          "\v": "\\v",
          "\0": "\\0",
          "\u2028": "\\u2028",
          "\u2029": "\\u2029"
        };
        let product = "";
        for (let i = 0; i < value2.length; i++) {
          const c = value2[i];
          switch (c) {
            case "'":
            case '"':
              quotes[c]++;
              product += c;
              continue;
            case "\0":
              if (util.isDigit(value2[i + 1])) {
                product += "\\x00";
                continue;
              }
          }
          if (replacements[c]) {
            product += replacements[c];
            continue;
          }
          if (c < " ") {
            let hexString = c.charCodeAt(0).toString(16);
            product += "\\x" + ("00" + hexString).substring(hexString.length);
            continue;
          }
          product += c;
        }
        const quoteChar = quote || Object.keys(quotes).reduce((a, b) => quotes[a] < quotes[b] ? a : b);
        product = product.replace(new RegExp(quoteChar, "g"), replacements[quoteChar]);
        return quoteChar + product + quoteChar;
      }
      function serializeObject(value2) {
        if (stack.indexOf(value2) >= 0) {
          throw TypeError("Converting circular structure to JSON5");
        }
        stack.push(value2);
        let stepback = indent;
        indent = indent + gap;
        let keys = propertyList || Object.keys(value2);
        let partial = [];
        for (const key of keys) {
          const propertyString = serializeProperty(key, value2);
          if (propertyString !== void 0) {
            let member = serializeKey(key) + ":";
            if (gap !== "") {
              member += " ";
            }
            member += propertyString;
            partial.push(member);
          }
        }
        let final;
        if (partial.length === 0) {
          final = "{}";
        } else {
          let properties;
          if (gap === "") {
            properties = partial.join(",");
            final = "{" + properties + "}";
          } else {
            let separator = ",\n" + indent;
            properties = partial.join(separator);
            final = "{\n" + indent + properties + ",\n" + stepback + "}";
          }
        }
        stack.pop();
        indent = stepback;
        return final;
      }
      function serializeKey(key) {
        if (key.length === 0) {
          return quoteString(key, true);
        }
        const firstChar = String.fromCodePoint(key.codePointAt(0));
        if (!util.isIdStartChar(firstChar)) {
          return quoteString(key, true);
        }
        for (let i = firstChar.length; i < key.length; i++) {
          if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
            return quoteString(key, true);
          }
        }
        return key;
      }
      function serializeArray(value2) {
        if (stack.indexOf(value2) >= 0) {
          throw TypeError("Converting circular structure to JSON5");
        }
        stack.push(value2);
        let stepback = indent;
        indent = indent + gap;
        let partial = [];
        for (let i = 0; i < value2.length; i++) {
          const propertyString = serializeProperty(String(i), value2);
          partial.push(propertyString !== void 0 ? propertyString : "null");
        }
        let final;
        if (partial.length === 0) {
          final = "[]";
        } else {
          if (gap === "") {
            let properties = partial.join(",");
            final = "[" + properties + "]";
          } else {
            let separator = ",\n" + indent;
            let properties = partial.join(separator);
            final = "[\n" + indent + properties + ",\n" + stepback + "]";
          }
        }
        stack.pop();
        indent = stepback;
        return final;
      }
    };
  }
});

// node_modules/json5/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/json5/lib/index.js"(exports2, module2) {
    var parse2 = require_parse2();
    var stringify = require_stringify();
    var JSON52 = {
      parse: parse2,
      stringify
    };
    module2.exports = JSON52;
  }
});

// deck-html.js
var deck_html_exports = {};
__export(deck_html_exports, {
  generateRevealHTML: () => generateRevealHTML
});
module.exports = __toCommonJS(deck_html_exports);

// client/src/utils/shapeGeometry.js
var CLOSED_SHAPES = ["rect", "rounded-rect", "circle", "triangle", "diamond", "arrow-right", "star"];
var num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
var round = (v) => Math.round(v * 100) / 100;
var escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function dashArray(style, width) {
  return style === "dashed" ? `${width * 3} ${width * 2}` : style === "dotted" ? `${width} ${width * 1.5}` : void 0;
}
function starPoints(el, w, h, sw) {
  const cx = el.starCx != null ? num(el.starCx) : w / 2;
  const cy = el.starCy != null ? num(el.starCy) : h / 2;
  const outerR = el.starOuterR != null ? num(el.starOuterR) : Math.min(w, h) / 2 - sw;
  const innerR = el.starInnerR != null ? num(el.starInnerR) : outerR * 0.4;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 5 * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function polygonPoints(el, w, h, sw) {
  switch (el.shape) {
    case "triangle":
      return [[w / 2, sw], [w - sw, h - sw], [sw, h - sw]];
    case "diamond":
      return [[w / 2, sw], [w - sw, h / 2], [w / 2, h - sw], [sw, h / 2]];
    case "arrow-right":
      return [[sw, h * 0.35], [w * 0.6, h * 0.35], [w * 0.6, sw], [w - sw, h / 2], [w * 0.6, h - sw], [w * 0.6, h * 0.65], [sw, h * 0.65]];
    case "star":
      return starPoints(el, w, h, sw);
    default:
      return null;
  }
}
var cornerRadius = (el, w, h, sw) => Math.max(0, Math.min(el.shape === "rounded-rect" ? Math.min(w, h) * 0.15 : num(el.borderRadius), (w - sw) / 2, (h - sw) / 2));
function shapeParts(el) {
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth);
  const shape = el.shape || "rect";
  if (shape === "line" || shape === "line-arrow") {
    const lw = num(el.strokeWidth) || 3;
    const color2 = el.stroke && el.stroke !== "none" ? el.stroke : el.fill || "#ffffff";
    const dash = dashArray(el.strokeDasharray, lw);
    const lines = [{ tag: "line", attrs: { x1: lw, y1: h / 2, x2: w - lw, y2: h / 2, stroke: color2, "stroke-width": lw, "stroke-dasharray": dash, fill: "none" } }];
    if (shape === "line-arrow") {
      const hs = Math.max(lw * 3, h * 0.3);
      lines.push({ tag: "polyline", attrs: {
        points: `${w - lw - hs},${h / 2 - hs} ${w - lw},${h / 2} ${w - lw - hs},${h / 2 + hs}`,
        stroke: color2,
        "stroke-width": lw,
        fill: "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      } });
    }
    return { lines };
  }
  const group = { fill: el.fill || "#6366f1", stroke: el.stroke || "none", "stroke-width": sw, "stroke-dasharray": dashArray(el.strokeDasharray, sw) };
  const poly = polygonPoints({ ...el, shape }, w, h, sw);
  const body = poly ? { tag: "polygon", attrs: { points: poly.map((p) => p.join(",")).join(" ") } } : shape === "circle" ? { tag: "ellipse", attrs: { cx: w / 2, cy: h / 2, rx: Math.max(0, w / 2 - sw / 2), ry: Math.max(0, h / 2 - sw / 2) } } : { tag: "rect", attrs: { x: sw / 2, y: sw / 2, width: w - sw, height: h - sw, rx: shape === "rect" || shape === "rounded-rect" ? cornerRadius({ ...el, shape }, w, h, sw) : 0 } };
  return { group, body };
}
function shapeOutline(el, n = 64) {
  const shape = el.shape || "rect";
  if (!CLOSED_SHAPES.includes(shape)) return null;
  const w = num(el.width), h = num(el.height), sw = num(el.strokeWidth);
  let dense = polygonPoints({ ...el, shape }, w, h, sw);
  if (shape === "circle") {
    const rx = Math.max(0, w / 2 - sw / 2), ry = Math.max(0, h / 2 - sw / 2);
    dense = Array.from({ length: 256 }, (_, i) => {
      const a = 2 * Math.PI * i / 256 - Math.PI / 2;
      return [w / 2 + rx * Math.cos(a), h / 2 + ry * Math.sin(a)];
    });
  } else if (!dense) {
    const r = cornerRadius({ ...el, shape }, w, h, sw), x0 = sw / 2, y0 = sw / 2, x1 = w - sw / 2, y1 = h - sw / 2;
    const arc = (cx2, cy, from) => Array.from({ length: 17 }, (_, i) => {
      const a = from + Math.PI / 2 * (i / 16);
      return [cx2 + r * Math.cos(a), cy + r * Math.sin(a)];
    });
    dense = [...arc(x1 - r, y0 + r, -Math.PI / 2), ...arc(x1 - r, y1 - r, 0), ...arc(x0 + r, y1 - r, Math.PI / 2), ...arc(x0 + r, y0 + r, Math.PI)];
  }
  const area = dense.reduce((a, p, i) => {
    const q = dense[(i + 1) % dense.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area < 0) dense.reverse();
  const cx = w / 2;
  let top = null;
  dense.forEach((p, i) => {
    const q = dense[(i + 1) % dense.length];
    if ((p[0] - cx) * (q[0] - cx) > 0 || p[0] === q[0]) return;
    const y = p[1] + (q[1] - p[1]) * ((cx - p[0]) / (q[0] - p[0]));
    if (!top || y < top.y) top = { i, y };
  });
  if (top) dense = [[cx, top.y], ...dense.slice(top.i + 1), ...dense.slice(0, top.i + 1)];
  const lengths = dense.map((p, i) => {
    const q = dense[(i + 1) % dense.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const points = [];
  let edge = 0, walked = 0;
  for (let k = 0; k < n; k++) {
    const at = total * k / n;
    while (edge < dense.length - 1 && walked + lengths[edge] < at) walked += lengths[edge++];
    const p = dense[edge], q = dense[(edge + 1) % dense.length], t = lengths[edge] ? (at - walked) / lengths[edge] : 0;
    points.push([round(p[0] + (q[0] - p[0]) * t), round(p[1] + (q[1] - p[1]) * t)]);
  }
  return points;
}
var outlinePath = (points) => `M${points.map((p) => p.join(" ")).join("L")}Z`;
var attrsHtml = (attrs) => Object.entries(attrs).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => ` ${k}="${escapeAttr(typeof v === "number" ? round(v) : v)}"`).join("");
function shapeSvgString(el, morph = null) {
  const w = num(el.width), h = num(el.height);
  const parts = shapeParts(el);
  const inner = parts.lines ? parts.lines.map(({ tag, attrs }) => `<${tag}${attrsHtml(attrs)} />`).join("") : `<g${attrsHtml(parts.group)}>${morph ? `<path d="${escapeAttr(morph.d)}" data-morph="${escapeAttr(morph.outlines)}" />` : `<${parts.body.tag}${attrsHtml(parts.body.attrs)} />`}</g>`;
  const label = el.text ? `<text${attrsHtml({ x: morph ? "50%" : w / 2, y: morph ? "50%" : h / 2, "dominant-baseline": "middle", "text-anchor": "middle", "font-size": num(el.fontSize) || 16, fill: el.textColor || "#ffffff" })} style="font-family:inherit;">${escapeAttr(el.text)}</text>` : "";
  const box = morph ? "" : ` viewBox="0 0 ${round(w)} ${round(h)}" preserveAspectRatio="none"`;
  return `<svg width="100%" height="100%"${box} style="position:absolute;inset:0;overflow:visible;">${inner}${label}</svg>`;
}

// client/src/utils/drawingUtils.js
function pointsToPath(points, smooth = true) {
  if (!points || points.length < 2) return "";
  if (!smooth || points.length < 3) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
  }
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

// client/src/utils/bibtexParser.js
function splitNames(str7) {
  const names = [];
  let depth = 0, from = 0;
  for (let i = 0; i < str7.length; i++) {
    if (str7[i] === "{") depth++;
    else if (str7[i] === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && str7[i] === " " && str7.slice(i, i + 5).toLowerCase() === " and ") {
      names.push(str7.slice(from, i));
      from = i + 5;
      i += 4;
    }
  }
  names.push(str7.slice(from));
  return names;
}
function parseAuthors(authorStr) {
  if (!authorStr) return [];
  return splitNames(authorStr.replace(/\s+/g, " ")).map((a) => {
    a = a.trim();
    if (/^\{[^{}]*\}$/.test(a)) return { first: "", last: a.slice(1, -1).trim() };
    a = a.replace(/[{}]/g, "");
    if (a.includes(",")) {
      const [last, first] = a.split(",").map((s) => s.trim());
      return { first, last };
    }
    const parts = a.split(/\s+/);
    if (parts.length === 1) return { first: "", last: parts[0] };
    return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
  });
}
function formatAuthorsShort(authors) {
  if (!authors || authors.length === 0) return "";
  if (authors.length === 1) return authors[0].last;
  if (authors.length === 2) return `${authors[0].last} & ${authors[1].last}`;
  return `${authors[0].last} et al.`;
}
function formatCitation(entry, style, index) {
  const authors = parseAuthors(entry.author);
  const year = entry.year || "";
  if (style === "author-year") {
    return `(${formatAuthorsShort(authors)}, ${year})`;
  }
  return `[${index + 1}]`;
}
function webLink(url) {
  const href = String(url || "").trim();
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    return { href, site: new URL(href).hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

// client/src/utils/citationIndex.js
var BARE_NUMBER_RE = /\[(\d{1,3})\]/g;
var OPEN_TAG_RE = /^<(sup|span)(?=[\s/>])/i;
var CITE_ATTR_RE = /(?:^|[\s"'])data-cite="([^"]*)"/i;
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var escapeText = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var unescapeAttr = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function allIndexesOf(haystack, needle) {
  if (!needle) return [];
  const found = [];
  const re = new RegExp(escapeRegExp(needle), "g");
  let m;
  while ((m = re.exec(haystack)) !== null) found.push(m.index);
  return found;
}
function scanTags(html) {
  const tags = [];
  let lt = html.indexOf("<");
  while (lt !== -1) {
    const gt = html.indexOf(">", lt);
    if (gt === -1) break;
    const start = html.lastIndexOf("<", gt);
    tags.push({ from: lt, start, end: gt + 1, text: html.slice(start, gt + 1) });
    lt = html.indexOf("<", gt + 1);
  }
  return tags;
}
function openTag(tag) {
  const m = OPEN_TAG_RE.exec(tag.text);
  if (!m) return null;
  const cite = CITE_ATTR_RE.exec(tag.text);
  return { name: m[1].toLowerCase(), key: cite ? unescapeAttr(cite[1]) : null };
}
var isClose = (tag, name) => tag.text.toLowerCase() === `</${name}>`;
function nextCloses(tags) {
  const next = { sup: new Array(tags.length), span: new Array(tags.length) };
  let sup = -1, span = -1;
  for (let i = tags.length - 1; i >= 0; i--) {
    if (isClose(tags[i], "sup")) sup = i;
    if (isClose(tags[i], "span")) span = i;
    next.sup[i] = sup;
    next.span[i] = span;
  }
  return next;
}
function keyedMarkers(html) {
  if (!html || html.indexOf("data-cite") === -1) return [];
  const tags = scanTags(html), closes = nextCloses(tags), found = [];
  for (let i = 0; i < tags.length; i++) {
    const open = openTag(tags[i]);
    if (!open || open.key === null) continue;
    const c = closes[open.name][i + 1] ?? -1;
    if (c === -1) continue;
    found.push({ start: tags[i].start, end: tags[c].end, key: open.key, inner: [tags[i].end, tags[c].start] });
    i = c;
  }
  return found;
}
function replaceRanges(html, ranges, replace) {
  if (!ranges.length) return html;
  let out = "", at = 0;
  for (const r of ranges) {
    out += html.slice(at, r.start) + replace(r);
    at = r.end;
  }
  return out + html.slice(at);
}
var ENTITIES = { "&amp;": "&", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function blank(length) {
  return " ".repeat(length);
}
function visibleText(html, onMarker) {
  let out = replaceRanges(html, keyedMarkers(html), (m) => {
    onMarker(m.key, m.start);
    return blank(m.end - m.start);
  });
  out = replaceRanges(out, scanTags(out).map((t) => ({ start: t.from, end: t.end })), (r) => blank(r.end - r.start));
  out = out.replace(/&[a-z#0-9]+;/gi, (match) => {
    const decoded = ENTITIES[match.toLowerCase()];
    return decoded ? decoded + blank(match.length - decoded.length) : blank(match.length);
  });
  return out;
}
function findCitations(text, bibliography = []) {
  if (!text) return [];
  const byKey = new Map(bibliography.map((e) => [e.key, e]));
  const hits = [];
  const visible = visibleText(text, (key, pos) => {
    if (byKey.has(key)) hits.push({ pos, key });
  });
  let m;
  BARE_NUMBER_RE.lastIndex = 0;
  while ((m = BARE_NUMBER_RE.exec(visible)) !== null) {
    const entry = bibliography[parseInt(m[1], 10) - 1];
    if (entry) hits.push({ pos: m.index, key: entry.key });
  }
  for (const entry of bibliography) {
    for (const pos of allIndexesOf(visible, entry.key)) hits.push({ pos, key: entry.key });
    const short = formatAuthorsShort(parseAuthors(entry.author));
    for (const pos of allIndexesOf(visible, short)) hits.push({ pos, key: entry.key });
  }
  return hits.sort((a, b) => a.pos - b.pos);
}
function citedKeysInPresentationOrder(bibliography, slides) {
  const known = new Set(bibliography.map((e) => e.key));
  const seen = /* @__PURE__ */ new Set();
  const keys = [];
  const cite = (key) => {
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  };
  for (const slide of slides || []) {
    const elements = [...slide.elements || []].sort((a, b) => (a.y || 0) - (b.y || 0) || (a.x || 0) - (b.x || 0));
    for (const el of elements) {
      const text = [el.content, el.citationText].filter(Boolean).join("\n");
      for (const { key } of findCitations(text, bibliography)) cite(key);
      if ((el.citationText || el.citationLink) && known.has(el.citationKey)) cite(el.citationKey);
    }
  }
  return keys;
}
function alphabeticalSortKey(entry) {
  const authors = parseAuthors(entry.author);
  const lead = authors[0]?.last || entry.author || entry.title || "";
  return [lead.toLowerCase(), entry.year || "", (entry.title || "").toLowerCase()];
}
function buildCitationIndex(presentation) {
  const bibliography = presentation?.bibliography || [];
  const order = presentation?.citationOrder === "alphabetical" ? "alphabetical" : "presentation";
  const style = presentation?.citationStyle || "numbered";
  const citedKeys = citedKeysInPresentationOrder(bibliography, presentation?.slides || []);
  const byKey = new Map(bibliography.map((e) => [e.key, e]));
  let entries = citedKeys.map((k) => byKey.get(k)).filter(Boolean);
  if (order === "alphabetical") {
    entries = [...entries].sort((a, b) => {
      const ka = alphabeticalSortKey(a), kb = alphabeticalSortKey(b);
      for (let i = 0; i < ka.length; i++) {
        const cmp = String(ka[i]).localeCompare(String(kb[i]));
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }
  const numberByKey = {};
  const labelByKey = {};
  entries.forEach((entry, i) => {
    numberByKey[entry.key] = i + 1;
    labelByKey[entry.key] = formatCitation(entry, style, i);
  });
  return { entries, numberByKey, labelByKey, order, style, citedCount: entries.length };
}
var CITATION_CSS = `
    sup[data-cite] { font-weight:700; }`;
function resolveCitationsInHtml(html, labelByKey) {
  if (!html || typeof html !== "string" || html.indexOf("data-cite") === -1) return html;
  const markers = keyedMarkers(html).filter((m) => labelByKey?.[m.key]);
  return replaceRanges(html, markers, (m) => html.slice(m.start, m.inner[0]) + escapeText(labelByKey[m.key]) + html.slice(m.inner[1], m.end));
}

// server:plugin-registry
var plugin_registry_default = { getSandboxHtml: () => null };

// client/src/plugins/pluginEmbed.js
function staticBridge({ data, width, height }) {
  const json = JSON.stringify(data || {}).replace(/</g, "\\u003c");
  return `<script>
(function(){
  var _data = ${json};
  var _width = ${Number(width) || 0};
  var _height = ${Number(height) || 0};
  var _dataCallbacks = [];
  function copy() { return JSON.parse(JSON.stringify(_data)); }
  window.parallax = Object.freeze({
    get data() { return copy(); },
    get width() { return _width; },
    get height() { return _height; },
    updateData: function(patch) {
      Object.assign(_data, patch);
      _dataCallbacks.forEach(function(cb) { cb(copy()); });
    },
    onDataChanged: function(cb) { _dataCallbacks.push(cb); },
    onResize: function() {},
    onCaptureSnapshot: function() {},
    reportError: function(msg) { console.error('[plugin] ' + msg); },
    fetch: function(url, opts) { return window.fetch(url, opts); }
  });
})();
</script><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>`;
}
function buildStaticPluginSrcdoc(sandboxHtml, { data, width, height }) {
  const injection = staticBridge({ data, width, height });
  if (/<head[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<head[^>]*>/i, (m) => m + injection);
  if (/<html[^>]*>/i.test(sandboxHtml)) return sandboxHtml.replace(/<html[^>]*>/i, (m) => m + injection);
  return injection + sandboxHtml;
}

// client/src/utils/generateHTML.js
var import_libraries3 = require("./libraries");

// client/src/utils/modelViewer.js
var import_libraries = require("./libraries");
var MODEL_DEFAULTS = {
  color: "#b8c2cc",
  background: "transparent",
  view: "iso",
  autoRotate: false,
  edges: false
};
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function modelViewerHtml(el, { src = el.src, snapshotKey = null, print = false } = {}) {
  const options = {
    src: src || "",
    color: el.color || MODEL_DEFAULTS.color,
    background: el.background || MODEL_DEFAULTS.background,
    view: el.view || MODEL_DEFAULTS.view,
    // 'auto': STL has no up axis and is nearly always Z-up (CAD, slicers);
    // glTF is Y-up by definition
    up: el.upAxis === "y" || el.upAxis === "z" ? el.upAxis : "auto",
    autoRotate: !!el.autoRotate,
    edges: !!el.edges,
    snapshotKey,
    print
  };
  const imports = {
    three: (0, import_libraries.libUrl)("three", "build/three.module.js")
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script type="importmap">${scriptJson({ imports })}</script>
</head><body><div id="status">Loading model…</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from '${(0, import_libraries.libUrl)("three", "examples/jsm/controls/OrbitControls.js")}';
import { GLTFLoader } from '${(0, import_libraries.libUrl)("three", "examples/jsm/loaders/GLTFLoader.js")}';
import { STLLoader } from '${(0, import_libraries.libUrl)("three", "examples/jsm/loaders/STLLoader.js")}';
import { RoomEnvironment } from '${(0, import_libraries.libUrl)("three", "examples/jsm/environments/RoomEnvironment.js")}';

const O = ${scriptJson(options)};
const status = document.getElementById('status');
function fail(message) { status.className = 'error'; status.textContent = message; }

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
} catch (e) {
  fail('3D needs WebGL, which this browser has turned off.');
  throw e;
}
// How much the deck or editor enlarges this frame, which it can't see (a CSS
// transform): it draws at that size to stay sharp, at least 2 in a PDF
let shownScale = 1;
const pixelRatio = () => Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * (O.print ? Math.max(shownScale, 2) : shownScale)));
renderer.setPixelRatio(pixelRatio());
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
if (O.background !== 'transparent') scene.background = new THREE.Color(O.background);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(0.5, 1, 1);
camera.add(key);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = O.autoRotate;
controls.autoRotateSpeed = 1.5;

let dirty = true, touched = false, model = null, snapshotSent = false;
controls.addEventListener('change', () => { dirty = true; });
controls.addEventListener('start', () => { touched = true; });

const VIEWS = { iso: [1, 0.75, 1], front: [0, 0, 1], top: [0, 1, 0.0001], right: [1, 0, 0] };

// The model's bounding sphere just fills the frame, seen from O.view
function frame() {
  if (!model) return;
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  const radius = sphere.radius || 1;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = 1.15 * radius / Math.sin(Math.min(vFov, hFov) / 2);
  const dir = new THREE.Vector3(...(VIEWS[O.view] || VIEWS.iso)).normalize();
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(dir, distance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.update();
  dirty = true;
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Loaded on a hidden slide, it was framed at no size: frame it again
  // when shown, unless someone has already turned it
  if (!touched) frame();
  dirty = true;
}
window.addEventListener('resize', resize);
window.addEventListener('message', e => {
  if (e.source !== window.parent) return;
  if (e.data === 'parallax-resize') resize();
  if (e.data && e.data.type === 'scale' && typeof e.data.scale === 'number' && e.data.scale > 0) {
    shownScale = Math.min(8, Math.max(0.1, e.data.scale));
    renderer.setPixelRatio(pixelRatio());
    resize();
  }
});
resize();

function addEdges(root) {
  const material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 });
  const meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), material));
}

function isGlb(buffer) {
  return buffer.byteLength >= 4 && new DataView(buffer).getUint32(0, true) === 0x46546C67;
}

function parse(buffer) {
  if (isGlb(buffer)) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().parse(buffer, '', gltf => resolve({ object: gltf.scene, zUp: O.up === 'z' }), err => {
        const message = String(err && err.message || err);
        reject(new Error(/draco|meshopt|KHR_|EXT_/i.test(message)
          ? 'This GLB uses compression or an extension the viewer can’t read. Export it again without compression.'
          : message));
      });
    });
  }
  const unreadable = new Error('This file isn’t an STL or GLB model the viewer can read.');
  let geometry;
  try { geometry = new STLLoader().parse(buffer); } catch (e) { throw unreadable; }
  if (!geometry.attributes.position || !geometry.attributes.position.count) throw unreadable;
  const material = new THREE.MeshStandardMaterial({
    color: geometry.hasColors ? 0xffffff : O.color,
    vertexColors: !!geometry.hasColors,
    metalness: 0.1,
    roughness: 0.55,
  });
  return { object: new THREE.Mesh(geometry, material), zUp: O.up !== 'y' };
}

function sendSnapshot() {
  if (!O.snapshotKey || snapshotSent) return;
  snapshotSent = true;
  try {
    parent.postMessage({ source: 'parallax-embed', type: 'snapshot', key: O.snapshotKey, dataUrl: renderer.domElement.toDataURL('image/png') }, '*');
  } catch (e) { /* the thumbnail keeps its placeholder */ }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
  if (model) sendSnapshot();
}
animate();

if (!O.src) {
  fail('No model file yet. Choose an STL or GLB file in the properties panel.');
} else {
  fetch(O.src)
    .then(res => {
      if (!res.ok) throw new Error('The model file couldn’t be loaded (' + res.status + ').');
      return res.arrayBuffer();
    })
    .then(parse)
    .then(({ object, zUp }) => {
      const holder = new THREE.Group();
      if (zUp) holder.rotation.x = -Math.PI / 2;
      holder.add(object);
      if (O.edges) addEdges(holder);
      scene.add(holder);
      model = holder;
      status.textContent = '';
      frame();
    })
    .catch(err => fail(err && err.message ? err.message : 'The model couldn’t be read.'));
}
</script></body></html>`;
}

// client/src/utils/moleculeViewer.js
var import_libraries2 = require("./libraries");
var MOLECULE_FORMATS = {
  ".pdb": "pdb",
  ".ent": "pdb",
  ".pqr": "pqr",
  ".cif": "cif",
  ".mmcif": "cif",
  ".sdf": "sdf",
  ".mol": "sdf",
  ".mol2": "mol2",
  ".xyz": "xyz",
  ".gro": "gro"
};
var MOLECULE_STYLES = [
  ["auto", "Auto"],
  ["cartoon", "Cartoon"],
  ["ballstick", "Ball and stick"],
  ["stick", "Sticks"],
  ["sphere", "Space-filling"],
  ["line", "Wireframe"]
];
var MOLECULE_COLORS = [
  ["auto", "Auto"],
  ["element", "By element"],
  ["chain", "By chain"],
  ["spectrum", "Rainbow (N → C)"],
  ["ss", "Secondary structure"]
];
var MOLECULE_DEFAULTS = {
  style: "auto",
  color: "auto",
  hydrogens: true,
  surface: false,
  background: "transparent",
  spin: false
};
function moleculeFormat(name) {
  const lower = String(name || "").toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  return lower.includes(".") ? MOLECULE_FORMATS[ext] || null : null;
}
function scriptJson2(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function pick(value, allowed, fallback) {
  return allowed.some(([v]) => v === value) ? value : fallback;
}
function savedView(view) {
  return Array.isArray(view) && view.length >= 8 && view.every((n) => typeof n === "number" && Number.isFinite(n)) ? view.slice(0, 8) : null;
}
function moleculeViewerHtml(el, { src = el.src, snapshotKey = null, viewKey = null, print = false } = {}) {
  const options = {
    src: src || "",
    format: Object.values(MOLECULE_FORMATS).includes(el.format) ? el.format : moleculeFormat(el.src) || "pdb",
    style: pick(el.style, MOLECULE_STYLES, MOLECULE_DEFAULTS.style),
    color: pick(el.color, MOLECULE_COLORS, MOLECULE_DEFAULTS.color),
    hydrogens: el.hydrogens !== false,
    surface: !!el.surface,
    background: el.background || MOLECULE_DEFAULTS.background,
    spin: !!el.spin && !print,
    view: savedView(el.view),
    snapshotKey,
    viewKey,
    print
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}#stage{position:absolute;inset:0}canvas{display:block;outline:none}#status{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;text-align:center;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:rgba(128,128,128,0.9);pointer-events:none}#status.error{color:#e5484d}</style>
<script src="${(0, import_libraries2.libUrl)("3dmol", "build/3Dmol-min.js")}"></script>
</head><body><div id="stage"></div><div id="status">Loading molecule…</div>
<script>
(function () {
var O = ${scriptJson2(options)};
var stage = document.getElementById('stage');
var status = document.getElementById('status');
function fail(message) { status.className = 'error'; status.textContent = message; }

// How much the deck or editor enlarges this frame, which it can't see (a CSS
// transform). 3Dmol sizes its canvas by window.devicePixelRatio, so that is
// raised to match: sharp when enlarged, at least 2 in a PDF
var baseRatio = window.devicePixelRatio || 1;
var shownScale = 1;
try {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get: function () { return Math.min(4, Math.max(1, baseRatio * (O.print ? Math.max(shownScale, 2) : shownScale))); },
  });
} catch (e) { /* drawn at the screen's own ratio */ }

if (typeof window.$3Dmol === 'undefined') { fail('The molecule viewer couldn’t be loaded.'); return; }
var $3Dmol = window.$3Dmol;

// Surfaces are worked out in workers started from a blob: URL, which a
// sandboxed frame may not be allowed to start; then they're worked out here
if ($3Dmol.SurfaceWorker) {
  try { new Worker($3Dmol.SurfaceWorker).terminate(); } catch (e) { $3Dmol.setSyncSurface(true); }
}

// 3Dmol draws on an OffscreenCanvas it shares between viewers, and copies
// each frame to the page's canvas as a bitmap, which drops the transparent
// background (it showed white). With one viewer, it may as well draw on the
// page's canvas itself
try { window.OffscreenCanvas = undefined; } catch (e) { /* drawn the shared way */ }

var viewer = null;
try {
  viewer = $3Dmol.createViewer(stage, {
    backgroundColor: O.background === 'transparent' ? 'white' : O.background,
    backgroundAlpha: O.background === 'transparent' ? 0 : 1,
    antialias: true,
  });
} catch (e) { viewer = null; }
if (!viewer) { fail('3D needs WebGL, which this browser has turned off.'); return; }

var WATER = { resn: ['HOH', 'WAT', 'H2O', 'DOD', 'SOL', 'TIP3'] };
var model = null, touched = false, snapshotSent = false, reportTimer = 0;

function colors(kind) {
  var c = O.color === 'auto' ? (kind === 'cartoon' ? 'spectrum' : 'element') : O.color;
  if (c === 'chain') return { colorscheme: 'chain' };
  if (c === 'spectrum') return kind === 'cartoon' ? { color: 'spectrum' } : { colorscheme: 'Jmol' };
  if (c === 'ss') return { colorscheme: 'ssPyMol' };
  return { colorscheme: 'Jmol' };
}

function atomStyle(kind, c) {
  function w(extra) { var o = {}; for (var k in c) o[k] = c[k]; for (var k2 in extra) o[k2] = extra[k2]; return o; }
  if (kind === 'cartoon') return { cartoon: w({}) };
  if (kind === 'stick') return { stick: w({ radius: 0.2 }) };
  if (kind === 'sphere') return { sphere: w({}) };
  if (kind === 'line') return { line: w({}) };
  return { stick: w({ radius: 0.14 }), sphere: w({ scale: 0.25 }) };
}

function applyStyle() {
  // A protein or nucleic acid: its backbone is in ATOM records (SDF and XYZ
  // atoms are all HETATM to 3Dmol)
  var polymer = model.selectedAtoms({ atom: ['CA', 'P'], hetflag: false }).length > 0;
  var kind = O.style === 'auto' ? (polymer ? 'cartoon' : 'ballstick') : O.style;
  if (kind === 'cartoon' && !polymer) kind = 'ballstick';
  viewer.setStyle({}, {});
  if (kind === 'cartoon') {
    viewer.setStyle({ hetflag: false }, atomStyle('cartoon', colors('cartoon')));
    // Ligands and ions stand out against it, with green carbons; water is left out
    viewer.setStyle({ and: [{ hetflag: true }, { not: WATER }] }, atomStyle('ballstick', { colorscheme: 'greenCarbon' }));
  } else {
    viewer.setStyle(polymer ? { not: WATER } : {}, atomStyle(kind, colors(kind)));
  }
  if (!O.hydrogens) viewer.setStyle({ elem: 'H' }, {});
  if (O.surface) {
    var c = O.color === 'chain' ? { colorscheme: 'chain' } : O.color === 'ss' ? { colorscheme: 'ssPyMol' } : { colorscheme: 'Jmol' };
    c.opacity = 0.7;
    var around = polymer ? { hetflag: false } : O.hydrogens ? {} : { not: { elem: 'H' } };
    viewer.addSurface($3Dmol.SurfaceType.VDW, c, around, around);
  }
}

// Framed to fit, or as it was kept in the editor
function applyView() {
  viewer.zoomTo();
  if (O.view) viewer.setView(O.view);
  viewer.render();
}

function sendSnapshot() {
  if (!O.snapshotKey || snapshotSent) return;
  snapshotSent = true;
  try { parent.postMessage({ source: 'parallax-embed', type: 'snapshot', key: O.snapshotKey, dataUrl: viewer.pngURI() }, '*'); } catch (e) { /* the thumbnail keeps its placeholder */ }
}

function reportView() {
  if (!O.viewKey) return;
  clearTimeout(reportTimer);
  reportTimer = setTimeout(function () {
    try { parent.postMessage({ source: 'parallax-embed', type: 'molecule-view', key: O.viewKey, view: viewer.getView() }, '*'); } catch (e) { /* nothing to keep */ }
  }, 250);
}

// Taking hold of it stops a spin, so it stays where it's turned to
function touch() {
  touched = true;
  if (O.spin) viewer.spin(false);
}
stage.addEventListener('pointerdown', touch, true);
stage.addEventListener('wheel', touch, { capture: true, passive: true });
stage.addEventListener('touchstart', touch, { capture: true, passive: true });
viewer.setViewChangeCallback(function () { if (touched) reportView(); });

function resize() {
  viewer.resize();
  // Loaded on a hidden slide, it was framed at no size: frame it again
  // when shown, unless someone has already turned it
  if (model && !touched) applyView();
}
window.addEventListener('resize', resize);
window.addEventListener('message', function (e) {
  if (e.source !== window.parent) return;
  if (e.data === 'parallax-resize') resize();
  if (e.data && e.data.type === 'scale' && typeof e.data.scale === 'number' && e.data.scale > 0) {
    shownScale = Math.min(8, Math.max(0.1, e.data.scale));
    resize();
  }
});

if (!O.src) {
  fail('No structure yet. Choose a molecule in the properties panel.');
  return;
}
fetch(O.src)
  .then(function (res) {
    if (!res.ok) throw new Error('The structure file couldn’t be loaded (' + res.status + ').');
    return res.text();
  })
  .then(function (text) {
    model = viewer.addModel(text, O.format, { keepH: O.hydrogens });
    if (!model || !model.selectedAtoms({}).length) throw new Error('This file has no atoms the viewer can read.');
    applyStyle();
    status.textContent = '';
    applyView();
    viewer.render(sendSnapshot);
    if (O.spin) viewer.spin('y', 0.6);
  })
  .catch(function (err) { fail(err && err.message ? err.message : 'The structure couldn’t be read.'); });
})();
</script></body></html>`;
}

// client/src/utils/graphParser.js
function createMathParser() {
  const FUNCS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    sec: (x) => 1 / Math.cos(x),
    csc: (x) => 1 / Math.sin(x),
    cot: (x) => 1 / Math.tan(x),
    arcsin: Math.asin,
    arccos: Math.acos,
    arctan: (y, x) => x === void 0 ? Math.atan(y) : Math.atan2(y, x),
    asin: Math.asin,
    acos: Math.acos,
    atan: (y, x) => x === void 0 ? Math.atan(y) : Math.atan2(y, x),
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    sgn: Math.sign,
    min: Math.min,
    max: Math.max,
    mod: (a, b) => (a % b + b) % b
  };
  const ARITY = { min: [1, 99], max: [1, 99], mod: [2, 2], arctan: [1, 2], atan: [1, 2] };
  const INVERSE = { sin: "arcsin", cos: "arccos", tan: "arctan" };
  const CONSTANTS = { pi: Math.PI, tau: 2 * Math.PI, e: Math.E };
  const GREEK2 = ["alpha", "beta", "gamma", "delta", "epsilon", "lambda", "sigma", "omega", "phi", "rho"];
  const RESERVED = ["x", "y", "t", "theta", "r"];
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTANTS), ["theta"], GREEK2).sort((a, b) => b.length - a.length);
  const UNICODE = {
    "−": "-",
    "–": "-",
    "·": "*",
    "×": "*",
    "⋅": "*",
    "÷": "/",
    "≤": "<=",
    "≥": ">=",
    "π": "pi",
    "θ": "theta",
    "τ": "tau",
    "√": "sqrt",
    "²": "^2",
    "³": "^3",
    "α": "alpha",
    "β": "beta",
    "γ": "gamma",
    "δ": "delta",
    "ε": "epsilon",
    "λ": "lambda",
    "σ": "sigma",
    "ω": "omega",
    "φ": "phi",
    "ρ": "rho"
  };
  const CMP = ["=", "<", ">", "<=", ">="];
  function fail2(message) {
    const e = new Error(message);
    e.graphError = true;
    throw e;
  }
  function normalize(text) {
    let out = "";
    for (const ch of String(text)) out += UNICODE[ch] !== void 0 ? UNICODE[ch] : ch;
    return out;
  }
  const isDigit = (c) => c >= "0" && c <= "9";
  const isLetter = (c) => c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  const isWord = (c) => isLetter(c) || isDigit(c);
  function tokenize3(text) {
    const s = normalize(text);
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "	" || c === "\n" || c === "\r") {
        i++;
        continue;
      }
      if (isDigit(c) || c === "." && isDigit(s[i + 1])) {
        let j = i;
        while (isDigit(s[j])) j++;
        if (s[j] === ".") {
          j++;
          while (isDigit(s[j])) j++;
        }
        tokens.push({ t: "num", v: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (isLetter(c)) {
        const word = NAMES.find((n) => s.startsWith(n, i));
        let name = word || c;
        let j = i + name.length;
        if (!word || !FUNCS[word]) {
          if (s[j] === "_") {
            if (s[j + 1] === "{") {
              const end = s.indexOf("}", j + 2);
              if (end < 0) fail2("A subscript _{ needs its }");
              const sub2 = s.slice(j + 2, end).trim();
              if (!sub2 || ![...sub2].every(isWord)) fail2("Subscripts are letters and digits, like a_1");
              name += "_" + sub2;
              j = end + 1;
            } else {
              let k = j + 1;
              while (k < s.length && isWord(s[k])) k++;
              if (k === j + 1) fail2("Put a letter or digit after _, like a_1");
              name += "_" + s.slice(j + 1, k);
              j = k;
            }
          }
        }
        tokens.push({ t: word && FUNCS[word] ? "fn" : "id", v: name });
        i = j;
        continue;
      }
      const two = s.slice(i, i + 2);
      if (two === "<=" || two === ">=") {
        tokens.push({ t: "op", v: two });
        i += 2;
        continue;
      }
      if (two === "**") {
        tokens.push({ t: "op", v: "^" });
        i += 2;
        continue;
      }
      if ("+-*/^(),|{}=<>:".includes(c)) {
        tokens.push({ t: "op", v: c });
        i++;
        continue;
      }
      fail2("“" + c + "” isn’t something a graph can read");
    }
    return tokens;
  }
  function parser(tokens, userFns) {
    let pos = 0;
    let absDepth = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => pos < tokens.length && tokens[pos].t === "op" && tokens[pos].v === v;
    function expect(v, what) {
      if (!isOp(v)) fail2(pos < tokens.length ? "Expected " + (what || v) + " before “" + tokens[pos].v + "”" : "Expected " + (what || v) + " at the end");
      pos++;
    }
    function startsFactor(tok) {
      if (!tok) return false;
      if (tok.t !== "op") return true;
      return tok.v === "(" || tok.v === "{" || tok.v === "|" && absDepth === 0;
    }
    function expr() {
      let a = term();
      while (isOp("+") || isOp("-")) {
        const op = tokens[pos++].v;
        a = { k: "bin", op, a, b: term() };
      }
      return a;
    }
    function term() {
      let a = unary();
      for (; ; ) {
        if (isOp("*") || isOp("/")) {
          const op = tokens[pos++].v;
          a = { k: "bin", op, a, b: unary() };
        } else if (startsFactor(peek())) {
          a = { k: "bin", op: "*", a, b: power() };
        } else {
          return a;
        }
      }
    }
    function unary() {
      if (isOp("-")) {
        pos++;
        return { k: "neg", a: unary() };
      }
      if (isOp("+")) {
        pos++;
        return unary();
      }
      return power();
    }
    function power() {
      const base = primary();
      if (isOp("^")) {
        pos++;
        return { k: "bin", op: "^", a: base, b: exponent() };
      }
      return base;
    }
    function exponent() {
      if (isOp("{")) {
        pos++;
        const e = expr();
        expect("}");
        return e;
      }
      return unary();
    }
    function args() {
      const list = [expr()];
      while (isOp(",")) {
        pos++;
        list.push(expr());
      }
      expect(")");
      return list;
    }
    function chain2(first) {
      const parts = [first || expr()];
      const ops = [];
      while (pos < tokens.length && tokens[pos].t === "op" && CMP.includes(tokens[pos].v)) {
        ops.push(tokens[pos++].v);
        parts.push(expr());
      }
      return { parts, ops };
    }
    function piecewise() {
      const branches = [];
      let otherwise = null;
      for (; ; ) {
        const c = chain2();
        if (!c.ops.length) {
          otherwise = c.parts[0];
          if (!isOp("}")) fail2("In { }, the value for “otherwise” goes last");
          break;
        }
        let value = null;
        if (isOp(":")) {
          pos++;
          value = expr();
        }
        branches.push({ cond: c, value });
        if (!isOp(",")) break;
        pos++;
      }
      expect("}");
      return { k: "piece", branches, otherwise };
    }
    function fn() {
      let name = tokens[pos++].v;
      let pow = null;
      if (isOp("^")) {
        pos++;
        pow = exponent();
      }
      if (pow && INVERSE[name] && pow.k === "neg" && pow.a.k === "num" && pow.a.v === 1) {
        name = INVERSE[name];
        pow = null;
      }
      let list;
      if (isOp("(")) {
        pos++;
        list = args();
      } else {
        if (!startsFactor(peek())) fail2(name + " needs something to work on, like " + name + "(x)");
        let a = power();
        while (startsFactor(peek()) && peek().t !== "fn") a = { k: "bin", op: "*", a, b: power() };
        list = [a];
      }
      const [least, most] = ARITY[name] || [1, 1];
      if (list.length < least || list.length > most) {
        fail2(name + " takes " + (least === most ? least : least + " or " + most) + " value" + (most === 1 ? "" : "s"));
      }
      const call = { k: "call", f: name, args: list };
      return pow ? { k: "bin", op: "^", a: call, b: pow } : call;
    }
    function primary() {
      const tok = peek();
      if (!tok) fail2("Something’s missing at the end");
      if (tok.t === "num") {
        pos++;
        return { k: "num", v: tok.v };
      }
      if (tok.t === "fn") return fn();
      if (tok.t === "id") {
        pos++;
        if (userFns.has(tok.v) && isOp("(")) {
          pos++;
          return { k: "ucall", f: tok.v, args: args() };
        }
        return { k: "var", n: tok.v };
      }
      if (isOp("(")) {
        pos++;
        const saved = absDepth;
        absDepth = 0;
        const items = args();
        absDepth = saved;
        return items.length === 1 ? items[0] : { k: "tuple", items };
      }
      if (isOp("|")) {
        pos++;
        absDepth++;
        const a = expr();
        absDepth--;
        expect("|", "a closing |");
        return { k: "call", f: "abs", args: [a] };
      }
      if (isOp("{")) {
        pos++;
        return piecewise();
      }
      fail2("“" + tok.v + "” is out of place");
    }
    return {
      statement() {
        const c = chain2();
        if (pos < tokens.length) fail2("“" + tokens[pos].v + "” is out of place");
        return c;
      }
    };
  }
  function parseStatement(text, userFns) {
    return parser(tokenize3(text), userFns || /* @__PURE__ */ new Set()).statement();
  }
  function freeVars(node, into, bound) {
    const out = into || /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n) return;
      switch (n.k) {
        case "var":
          if (!(n.n in CONSTANTS) && !(bound && bound.includes(n.n))) out.add(n.n);
          break;
        case "neg":
          walk(n.a);
          break;
        case "bin":
          walk(n.a);
          walk(n.b);
          break;
        case "call":
        case "ucall":
          n.args.forEach(walk);
          break;
        case "tuple":
          n.items.forEach(walk);
          break;
        case "piece":
          n.branches.forEach((b) => {
            b.cond.parts.forEach(walk);
            walk(b.value);
          });
          walk(n.otherwise);
          break;
      }
    };
    walk(node);
    return out;
  }
  function usedFns(node, into) {
    const out = into || /* @__PURE__ */ new Set();
    const walk = (n) => {
      if (!n) return;
      if (n.k === "ucall") out.add(n.f);
      if (n.a) walk(n.a);
      if (n.b) walk(n.b);
      if (n.args) n.args.forEach(walk);
      if (n.items) n.items.forEach(walk);
      if (n.branches) n.branches.forEach((b) => {
        b.cond.parts.forEach(walk);
        walk(b.value);
      });
      if (n.otherwise) walk(n.otherwise);
    };
    walk(node);
    return out;
  }
  const approxEqual = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const COMPARE = {
    "=": approxEqual,
    "<": (a, b) => a < b,
    ">": (a, b) => a > b,
    "<=": (a, b) => a <= b,
    ">=": (a, b) => a >= b
  };
  function compile(node, formals, fns) {
    const c = (n) => compile(n, formals, fns);
    switch (node.k) {
      case "num": {
        const v = node.v;
        return () => v;
      }
      case "var": {
        if (node.n in CONSTANTS) {
          const v = CONSTANTS[node.n];
          return () => v;
        }
        const i = formals ? formals.indexOf(node.n) : -1;
        if (i >= 0) return (env, a) => a[i];
        if (fns[node.n]) fail2(node.n + " is a function: write " + node.n + "(x)");
        const name = node.n;
        return (env) => {
          const v = env[name];
          return typeof v === "number" ? v : NaN;
        };
      }
      case "neg": {
        const a = c(node.a);
        return (env, x) => -a(env, x);
      }
      case "bin": {
        const a = c(node.a), b = c(node.b);
        switch (node.op) {
          case "+":
            return (env, x) => a(env, x) + b(env, x);
          case "-":
            return (env, x) => a(env, x) - b(env, x);
          case "*":
            return (env, x) => a(env, x) * b(env, x);
          case "/":
            return (env, x) => a(env, x) / b(env, x);
          default:
            return (env, x) => Math.pow(a(env, x), b(env, x));
        }
      }
      case "call": {
        const f = FUNCS[node.f];
        const list = node.args.map(c);
        if (list.length === 1) {
          const a = list[0];
          return (env, x) => f(a(env, x));
        }
        if (list.length === 2) {
          const a = list[0], b = list[1];
          return (env, x) => f(a(env, x), b(env, x));
        }
        return (env, x) => f.apply(null, list.map((g) => g(env, x)));
      }
      case "ucall": {
        const def = fns[node.f];
        if (!def) fail2(node.f + "(…) has an error");
        if (def.formals.length !== node.args.length) fail2(node.f + " takes " + def.formals.length + " value" + (def.formals.length === 1 ? "" : "s"));
        const list = node.args.map(c);
        return (env, x) => def.call(env, list.map((g) => g(env, x)));
      }
      case "piece": {
        const branches = node.branches.map((b) => ({ test: condition(b.cond, formals, fns), value: b.value ? c(b.value) : () => 1 }));
        const otherwise = node.otherwise ? c(node.otherwise) : () => NaN;
        return (env, x) => {
          for (let i = 0; i < branches.length; i++) if (branches[i].test(env, x)) return branches[i].value(env, x);
          return otherwise(env, x);
        };
      }
      case "tuple":
        fail2("A point ( , ) can’t be used inside a calculation");
    }
    fail2("Couldn’t read this");
  }
  function condition(ch, formals, fns) {
    const parts = ch.parts.map((p) => compile(p, formals, fns));
    const tests = ch.ops.map((op) => COMPARE[op]);
    return (env, x) => {
      let left = parts[0](env, x);
      for (let i = 0; i < tests.length; i++) {
        const right = parts[i + 1](env, x);
        if (!tests[i](left, right)) return false;
        left = right;
      }
      return true;
    };
  }
  const FN_DEF = /^\s*([A-Za-z](?:_(?:\{[A-Za-z0-9]+\}|[A-Za-z0-9]+))?)\s*\(\s*([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*)\s*\)\s*=(?![=<>])/;
  function literal(node) {
    if (node.k === "num") return node.v;
    if (node.k === "neg" && node.a.k === "num") return -node.a.v;
    return null;
  }
  const isVar = (node, name) => node.k === "var" && node.n === name;
  const only = (set, names) => [...set].every((v) => !RESERVED.includes(v) || names.includes(v));
  const has3 = (set, names) => names.some((n) => set.has(n));
  function analyze(expressions) {
    const items = (expressions || []).map((e) => ({ id: e.id, text: String(e.text || "") }));
    const fns = {};
    for (const item of items) {
      const text = normalize(item.text);
      const m = FN_DEF.exec(text);
      if (!m) continue;
      const name = m[1].replace(/[{}]/g, "");
      const formals = m[2].split(",").map((s) => s.trim());
      if (FUNCS[name] || name in CONSTANTS || RESERVED.includes(name)) continue;
      if (!formals.every((f) => f.length === 1 || f === "theta" || GREEK2.includes(f))) continue;
      if (fns[name]) {
        item.kind = "error";
        item.error = name + " is defined twice";
        continue;
      }
      item.kind = "function";
      item.name = name;
      item.formals = formals;
      item.bodyText = text.slice(m[0].length);
      fns[name] = { formals, item };
    }
    const userFns = new Set(Object.keys(fns));
    for (const item of items) {
      if (item.kind === "error") continue;
      if (!item.text.trim()) {
        item.kind = "empty";
        continue;
      }
      try {
        if (item.kind === "function") {
          const st = parseStatement(item.bodyText, userFns);
          if (st.ops.length) fail2("A function is one expression after =");
          item.body = st.parts[0];
        } else {
          item.stmt = parseStatement(item.text, userFns);
        }
      } catch (e) {
        if (!e.graphError) throw e;
        item.kind = "error";
        item.error = e.message;
      }
    }
    const params = /* @__PURE__ */ new Set();
    for (const item of items) {
      if (!item.stmt || item.kind) continue;
      const { parts, ops } = item.stmt;
      if (ops.length !== 1 || ops[0] !== "=" || parts[0].k !== "var") continue;
      const name = parts[0].n;
      if (RESERVED.includes(name) || name in CONSTANTS) continue;
      if (has3(freeVars(parts[1]), RESERVED)) continue;
      if (params.has(name)) {
        item.kind = "error";
        item.error = name + " is defined twice";
        continue;
      }
      params.add(name);
      item.kind = "param";
      item.name = name;
      item.value = parts[1];
      item.literal = literal(parts[1]);
      item.slider = item.literal !== null;
    }
    for (const name of params) {
      if (fns[name]) Object.assign(fns[name].item, { kind: "error", error: name + " is already a slider" });
    }
    const known = new Set(RESERVED.concat([...params], [...userFns]));
    const missing = /* @__PURE__ */ new Set();
    const note = (vars, item) => vars.forEach((v) => {
      if (known.has(v)) return;
      missing.add(v);
      if (item) (item.missing = item.missing || []).push(v);
    });
    const reaches = (name, seen) => {
      const def = fns[name];
      if (!def || !def.item.body) return false;
      for (const f of usedFns(def.item.body)) {
        if (seen.has(f)) return true;
        if (reaches(f, /* @__PURE__ */ new Set([...seen, f]))) return true;
      }
      return false;
    };
    for (const name of userFns) {
      const item = fns[name].item;
      if (item.kind === "function" && reaches(name, /* @__PURE__ */ new Set([name]))) {
        item.kind = "error";
        item.error = name + " uses itself";
      }
    }
    const callable = {};
    for (const name of userFns) if (fns[name].item.kind === "function") callable[name] = fns[name];
    for (const name of Object.keys(callable)) {
      const def = callable[name];
      let body = null;
      def.call = (env, a) => body ? body(env, a) : NaN;
      def.compile = () => {
        body = compile(def.item.body, def.formals, callable);
      };
    }
    for (const name of Object.keys(callable)) {
      try {
        callable[name].compile();
      } catch (e) {
        if (!e.graphError) throw e;
        callable[name].item.kind = "error";
        callable[name].item.error = e.message;
      }
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const name of Object.keys(callable)) {
        const item = callable[name].item;
        if (item.kind !== "function") {
          delete callable[name];
          changed = true;
          continue;
        }
        const broken = [...usedFns(item.body)].find((f) => !callable[f] || callable[f].item.kind !== "function");
        if (broken) {
          Object.assign(item, { kind: "error", error: broken + "(…) has an error" });
          changed = true;
        }
      }
    }
    const cf = (node) => compile(node, null, callable);
    for (const item of items) {
      try {
        if (item.kind === "function") {
          const vars = freeVars(item.body, null, item.formals);
          note(vars, item);
          if (item.formals.length === 1 && item.formals[0] === "x" && only(vars, ["x"])) {
            item.graph = "y";
            const def = callable[item.name];
            item.f = (env) => def.call(env, [env.x]);
          }
        } else if (item.kind === "param") {
          note(freeVars(item.value), item);
          item.f = cf(item.value);
        } else if (item.stmt && !item.kind) {
          classify(item);
        }
      } catch (e) {
        if (!e.graphError) throw e;
        item.kind = "error";
        item.error = e.message;
      }
    }
    function classify(item) {
      const { parts, ops } = item.stmt;
      const vars = /* @__PURE__ */ new Set();
      parts.forEach((p) => freeVars(p, vars));
      note(vars, item);
      if (!ops.length) {
        let node = parts[0];
        let restrict = null;
        if (node.k === "bin" && node.op === "*" && node.a.k === "tuple") {
          restrict = node.b;
          node = node.a;
        }
        if (node.k === "tuple") {
          if (node.items.length !== 2) fail2("A point has two coordinates, like (1, 2)");
          const [nx, ny] = restrict ? node.items.map((n) => ({ k: "bin", op: "*", a: n, b: restrict })) : node.items;
          if (vars.has("t")) {
            if (!only(vars, ["t"])) fail2("A curve (x(t), y(t)) can use only t and sliders");
            item.kind = "parametric";
          } else {
            if (has3(vars, RESERVED)) fail2("A point’s coordinates are numbers or sliders; for a curve use t");
            item.kind = "point";
            item.dragX = node.items[0].k === "var" && params.has(node.items[0].n) ? node.items[0].n : null;
            item.dragY = node.items[1].k === "var" && params.has(node.items[1].n) ? node.items[1].n : null;
          }
          item.fx = cf(nx);
          item.fy = cf(ny);
          return;
        }
        if (has3(vars, ["y", "t", "theta", "r"])) fail2("Write it as an equation, like y = …");
        item.f = cf(node);
        item.kind = vars.has("x") ? "explicit" : "value";
        item.axis = "y";
        return;
      }
      if (ops.every((op) => op === "=")) {
        if (ops.length > 1) fail2("Only one = per line");
        const [l, r] = parts;
        for (const [side, other] of [[l, r], [r, l]]) {
          const ov = freeVars(other);
          if (isVar(side, "y") && only(ov, ["x"])) {
            item.kind = "explicit";
            item.axis = "y";
            item.f = cf(other);
            return;
          }
          if (isVar(side, "x") && only(ov, ["y"])) {
            item.kind = "explicit";
            item.axis = "x";
            item.f = cf(other);
            return;
          }
          if (isVar(side, "r") && only(ov, ["theta"])) {
            item.kind = "polar";
            item.f = cf(other);
            return;
          }
        }
        if (isVar(l, "t") || isVar(l, "theta")) fail2(l.n + " is what curves are drawn over; call this something else");
        if (!only(vars, ["x", "y"])) fail2("An equation uses x, y and sliders; for curves over t or θ, see the examples");
        if (!has3(vars, ["x", "y"])) fail2("There’s no x or y to draw");
        const lf = cf(l), rf = cf(r);
        item.kind = "implicit";
        item.F = (env) => lf(env) - rf(env);
        return;
      }
      if (ops.includes("=")) fail2("Use either = or <, >, ≤, ≥ in one line");
      if (!only(vars, ["x", "y"])) fail2("An inequality uses x, y and sliders");
      if (!has3(vars, ["x", "y"])) fail2("There’s no x or y to shade");
      if (ops.length === 1) {
        const [l, r] = parts;
        const op = ops[0];
        const strict = op === "<" || op === ">";
        const less = op === "<" || op === "<=";
        for (const [axis, other] of [["y", "x"], ["x", "y"]]) {
          if (isVar(l, axis) && only(freeVars(r), [other])) {
            Object.assign(item, { kind: "region", axis, f: cf(r), side: less ? "below" : "above", strict });
            return;
          }
          if (isVar(r, axis) && only(freeVars(l), [other])) {
            Object.assign(item, { kind: "region", axis, f: cf(l), side: less ? "above" : "below", strict });
            return;
          }
        }
      }
      item.kind = "region";
      item.axis = null;
      item.comps = ops.map((op, i) => {
        const lf = cf(parts[i]), rf = cf(parts[i + 1]);
        const test = COMPARE[op];
        return { g: (env) => lf(env) - rf(env), test: (env) => test(lf(env), rf(env)), strict: op === "<" || op === ">" };
      });
    }
    return { items, params: [...params], missing: [...missing], fns: Object.keys(callable) };
  }
  function paramValues(analysis, values) {
    const env = {};
    const pending = analysis.items.filter((it) => it.kind === "param");
    for (const it of pending) {
      if (it.slider) env[it.name] = values && typeof values[it.name] === "number" ? values[it.name] : it.literal;
    }
    let rest = pending.filter((it) => !it.slider);
    const passes = rest.length + 1;
    for (let pass = 0; pass < passes && rest.length; pass++) {
      rest = rest.filter((it) => {
        const v = it.f(env);
        if (Number.isNaN(v) && [...freeVars(it.value)].some((n) => env[n] === void 0)) return true;
        env[it.name] = v;
        return false;
      });
    }
    return env;
  }
  return { tokenize: tokenize3, parseStatement, freeVars, compile, analyze, paramValues, normalize, RESERVED };
}

// client/src/utils/graphRuntime.js
function graphRuntime(P, config) {
  let C2 = config;
  const THEMES = {
    light: {
      axis: "#2b2b2b",
      major: "rgba(0,0,0,0.14)",
      minor: "rgba(0,0,0,0.055)",
      text: "#3a3a3a",
      halo: "rgba(255,255,255,0.85)",
      panel: "rgba(255,255,255,0.94)",
      panelText: "#222",
      border: "rgba(0,0,0,0.14)",
      accent: "#2d70b3"
    },
    dark: {
      axis: "rgba(255,255,255,0.85)",
      major: "rgba(255,255,255,0.16)",
      minor: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.8)",
      halo: "rgba(18,18,28,0.8)",
      panel: "rgba(24,24,36,0.9)",
      panelText: "#eee",
      border: "rgba(255,255,255,0.16)",
      accent: "#6fa8ff"
    }
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  const MATH_FONT2 = '"Cambria Math", "Latin Modern Math", "STIX Two Math", "Times New Roman", serif';
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;left:0;top:0;display:block;touch-action:none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  let theme = THEMES.light;
  let analysis = null;
  let values = {};
  let view = null;
  let step = 0;
  let hover = null;
  let playing = {};
  let snapshotSent = false;
  let frame = 0;
  let shownScale = 1;
  const density = () => Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * (C2.print ? Math.max(shownScale, 3) : shownScale)));
  const clamp4 = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const copyView = (v) => ({ xMin: +v.xMin, xMax: +v.xMax, yMin: +v.yMin, yMax: +v.yMax });
  const sameView = (a, b) => ["xMin", "xMax", "yMin", "yMax"].every((k) => Math.abs(a[k] - b[k]) < 1e-9 * Math.max(1, Math.abs(a[k])));
  function setConfig(next, keepState) {
    C2 = next;
    theme = THEMES[C2.theme] || THEMES.light;
    analysis = P.analyze(C2.expressions || []);
    const kept = values;
    values = {};
    for (const it of analysis.items) {
      if (it.kind === "param" && it.slider) values[it.name] = keepState && typeof kept[it.name] === "number" && !C2.editor ? kept[it.name] : it.literal;
    }
    if (!keepState || C2.editor) view = copyView(C2.view);
    playing = {};
    for (const e of C2.expressions || []) {
      const it = analysis.items.find((i) => i.id === e.id);
      if (it && it.kind === "param" && it.slider && e.slider && e.slider.play && !C2.print) playing[it.name] = 1;
    }
    step = C2.showAll ? Infinity : step;
    buildPanel();
    request();
  }
  function shown() {
    if (C2.equalScale === false || !W || !H) return view;
    const half2 = (view.xMax - view.xMin) * H / W / 2;
    const mid = (view.yMin + view.yMax) / 2;
    return { xMin: view.xMin, xMax: view.xMax, yMin: mid - half2, yMax: mid + half2 };
  }
  function exprOf(it) {
    return (C2.expressions || []).find((e) => e.id === it.id) || {};
  }
  function visible(it) {
    const e = exprOf(it);
    if (e.hidden) return false;
    return !(e.step > 0) || e.step <= step;
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return { step: nice * p, minor: nice === 2 ? 4 : 5 };
  }
  function ticksBetween(lo, hi, stepSize) {
    if (!(stepSize > 0) || !isFinite(lo) || !isFinite(hi)) return [];
    const first = Math.ceil(lo / stepSize), last2 = Math.floor(hi / stepSize);
    if (!(last2 - first < 500)) return [];
    const out = [];
    for (let i = 0; i <= last2 - first; i++) out.push((first + i) * stepSize);
    return out;
  }
  function tickLabel(v, stepSize) {
    if (Math.abs(v) < stepSize * 1e-6) return "0";
    if (stepSize >= 1e6 || stepSize < 1e-5) return v.toExponential(2).replace(/\.?0+e/, "e").replace("-", "−");
    const decimals = Math.max(0, -Math.floor(Math.log10(stepSize) + 1e-9));
    return (Math.round(v / stepSize) * stepSize).toFixed(decimals).replace("-", "−");
  }
  function fmt(v) {
    if (!isFinite(v)) return "undefined";
    if (v !== 0 && (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-4)) return v.toExponential(3).replace("-", "−");
    return String(parseFloat(v.toPrecision(4))).replace("-", "−");
  }
  function prettyName(name) {
    const greek = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", lambda: "λ", sigma: "σ", omega: "ω", phi: "φ", rho: "ρ", theta: "θ" };
    const i = name.indexOf("_");
    const base = i < 0 ? name : name.slice(0, i);
    return { base: greek[base] || base, sub: i < 0 ? "" : name.slice(i + 1) };
  }
  let X0, X1, Y0, Y1;
  const sx = (x) => (x - X0) / (X1 - X0) * W;
  const sy = (y) => H - (y - Y0) / (Y1 - Y0) * H;
  const wx = (px) => X0 + px / W * (X1 - X0);
  const wy = (py) => Y0 + (H - py) / H * (Y1 - Y0);
  const clampPx = (v) => v > 1e5 ? 1e5 : v < -1e5 ? -1e5 : v;
  function env() {
    const e = P.paramValues(analysis, values);
    e.x = 0;
    e.y = 0;
    e.t = 0;
    e.theta = 0;
    return e;
  }
  function draw() {
    if (!W || !H || !analysis) return;
    const v = shown();
    X0 = v.xMin;
    X1 = v.xMax;
    Y0 = v.yMin;
    Y1 = v.yMax;
    ctx.clearRect(0, 0, W, H);
    if (C2.background && C2.background !== "transparent") {
      ctx.fillStyle = C2.background;
      ctx.fillRect(0, 0, W, H);
    }
    const E = env();
    const ticks = gridAndAxes();
    const items = analysis.items.filter(visible);
    const each = (kinds, fn) => {
      for (const it of items) {
        if (!kinds.includes(it.kind)) continue;
        try {
          fn(it);
        } catch (e) {
          ctx.globalAlpha = 1;
          ctx.setLineDash([]);
        }
      }
    };
    each(["region"], (it) => drawRegion(it, E));
    each(["explicit", "function", "polar", "parametric", "implicit"], (it) => {
      if (it.kind === "explicit" || it.kind === "function" && it.graph) strokeRuns(explicitRuns(it.f, E, it.axis || "y"), exprOf(it));
      else if (it.kind === "polar") strokeRuns(curveRuns(it, E, "theta"), exprOf(it));
      else if (it.kind === "parametric") strokeRuns(curveRuns(it, E, "t"), exprOf(it));
      else if (it.kind === "implicit") strokeRuns(contour(it.F, E), exprOf(it));
    });
    axisNumbers(ticks);
    axisLabels();
    each(["point"], (it) => drawPoint(it, E));
    if (hover) drawHover();
    if (C2.snapshotKey && !snapshotSent && analysis.items.length) {
      snapshotSent = true;
      try {
        parent.postMessage({ source: "parallax-embed", type: "snapshot", key: C2.snapshotKey, dataUrl: canvas.toDataURL("image/png") }, "*");
      } catch (e) {
      }
    }
  }
  function gridAndAxes() {
    const px = 90;
    const tx = niceStep((X1 - X0) * px / W);
    const ty = C2.equalScale === false ? niceStep((Y1 - Y0) * px / H) : tx;
    const line = (x0, y0, x1, y1) => {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    };
    if (C2.grid !== false) {
      ctx.lineWidth = 1;
      for (const [t, major] of [[tx.step / tx.minor, false], [tx.step, true]]) {
        ctx.beginPath();
        ctx.strokeStyle = major ? theme.major : theme.minor;
        for (const v of ticksBetween(X0, X1, t)) {
          const p = Math.round(sx(v)) + 0.5;
          line(p, 0, p, H);
        }
        const u = major ? ty.step : ty.step / ty.minor;
        for (const v of ticksBetween(Y0, Y1, u)) {
          const p = Math.round(sy(v)) + 0.5;
          line(0, p, W, p);
        }
        ctx.stroke();
      }
    }
    if (C2.axes !== false) {
      ctx.beginPath();
      ctx.strokeStyle = theme.axis;
      ctx.lineWidth = 1.25;
      if (X0 <= 0 && X1 >= 0) {
        const p = Math.round(sx(0)) + 0.5;
        line(p, 0, p, H);
      }
      if (Y0 <= 0 && Y1 >= 0) {
        const p = Math.round(sy(0)) + 0.5;
        line(0, p, W, p);
      }
      ctx.stroke();
    }
    return { tx, ty };
  }
  function haloText(text, x, y, align, baseline, font, color2) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.halo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color2 || theme.text;
    ctx.fillText(text, x, y);
  }
  function axisNumbers({ tx, ty }) {
    if (C2.axisNumbers === false || C2.axes === false) return;
    const font = "12px " + FONT;
    const ay = Math.min(Math.max(sy(0), 2), H - 18);
    const ax = Math.min(Math.max(sx(0), 30), W - 4);
    const originShown = X0 <= 0 && X1 >= 0 && Y0 <= 0 && Y1 >= 0;
    for (const v of ticksBetween(X0, X1, tx.step)) {
      if (Math.abs(v) < tx.step * 1e-6) continue;
      const p = sx(v);
      if (p < 12 || p > W - 12) continue;
      haloText(tickLabel(v, tx.step), p, ay + 4, "center", "top", font);
    }
    for (const v of ticksBetween(Y0, Y1, ty.step)) {
      if (Math.abs(v) < ty.step * 1e-6) continue;
      const p = sy(v);
      if (p < 10 || p > H - 10) continue;
      haloText(tickLabel(v, ty.step), ax - 5, p, "right", "middle", font);
    }
    if (originShown) haloText("0", sx(0) - 5, sy(0) + 4, "right", "top", font);
  }
  function axisLabels() {
    const font = "italic 16px " + MATH_FONT2;
    if (C2.xLabel) haloText(C2.xLabel, W - 8, Math.min(Math.max(sy(0), 20), H - 24) - 6, "right", "bottom", font);
    if (C2.yLabel) haloText(C2.yLabel, Math.min(Math.max(sx(0), 8), W - 40) + 8, 8, "left", "top", font);
  }
  function styleFor(e) {
    ctx.strokeStyle = e.color || "#c74440";
    ctx.lineWidth = e.width || 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const w = ctx.lineWidth;
    ctx.setLineDash(e.style === "dashed" ? [w * 3.2, w * 2.4] : e.style === "dotted" ? [0.01, w * 2.2] : []);
  }
  function strokeRuns(runs, e) {
    styleFor(e);
    ctx.beginPath();
    for (const run of runs) {
      if (run.length < 2) continue;
      ctx.moveTo(run[0][0], run[0][1]);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function explicitRuns(f, E, axis) {
    const horiz = axis === "y";
    const k = Math.min(2, density());
    const n = Math.ceil((horiz ? W : H) * k);
    const toWorld = horiz ? (px) => wx(px / k) : (px) => wy(px / k);
    const toPx = horiz ? sy : sx;
    const key = horiz ? "x" : "y";
    const at = (u) => {
      E[key] = u;
      return f(E);
    };
    const place = (u, val) => horiz ? [sx(u), clampPx(sy(val))] : [clampPx(sx(val)), sy(u)];
    const runs = [];
    let run = [], pu = 0, pv = NaN;
    for (let i = 0; i <= n; i++) {
      const u = toWorld(i);
      const val = at(u);
      if (!isFinite(val)) {
        if (run.length) {
          runs.push(run);
          run = [];
        }
        pv = NaN;
        continue;
      }
      if (isFinite(pv) && Math.abs(toPx(val) - toPx(pv)) > 24) {
        let a = pu, b = u, fa = pv, fb = val, broken = false;
        const left = [], right = [];
        for (let k2 = 0; k2 < 30; k2++) {
          const m = (a + b) / 2;
          const fm = at(m);
          if (!isFinite(fm)) {
            broken = true;
            break;
          }
          if (Math.abs(fm - fa) > Math.abs(fb - fm)) {
            b = m;
            fb = fm;
            right.push(place(m, fm));
          } else {
            a = m;
            fa = fm;
            left.push(place(m, fm));
          }
        }
        if (broken || Math.abs(toPx(fb) - toPx(fa)) > 2) {
          run.push(...left);
          runs.push(run);
          run = right.reverse();
        }
      }
      run.push(place(u, val));
      pv = val;
      pu = u;
    }
    if (run.length) runs.push(run);
    return runs;
  }
  function curveRuns(it, E, key) {
    const e = exprOf(it);
    const lo = isFinite(+e.min) && e.min !== "" && e.min != null ? +e.min : 0;
    const hi = isFinite(+e.max) && e.max !== "" && e.max != null ? +e.max : 2 * Math.PI;
    const n = Math.min(2e4, Math.max(800, Math.ceil(Math.abs(hi - lo) * 150)));
    const runs = [];
    let run = [];
    let prev = null;
    for (let i = 0; i <= n; i++) {
      E[key] = lo + (hi - lo) * i / n;
      let x, y;
      if (key === "t") {
        x = it.fx(E);
        y = it.fy(E);
      } else {
        const r = it.f(E);
        x = r * Math.cos(E.theta);
        y = r * Math.sin(E.theta);
      }
      if (!isFinite(x) || !isFinite(y)) {
        if (run.length) runs.push(run);
        run = [];
        prev = null;
        continue;
      }
      const p = [clampPx(sx(x)), clampPx(sy(y))];
      if (prev && Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]) > W + H) {
        runs.push(run);
        run = [];
      }
      run.push(p);
      prev = p;
    }
    if (run.length) runs.push(run);
    return runs;
  }
  function contour(F, E, cellPx) {
    const cell = cellPx || clamp4(6 / density(), 2, 4);
    const nx = Math.ceil(W / cell) + 1, ny = Math.ceil(H / cell) + 1;
    const vals = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      E.y = wy(j * cell);
      for (let i = 0; i < nx; i++) {
        E.x = wx(i * cell);
        vals[j * nx + i] = F(E);
      }
    }
    const points = /* @__PURE__ */ new Map();
    const cross = (key, i0, j0, i1, j1) => {
      if (points.has(key)) return points.get(key);
      const a = vals[j0 * nx + i0], b = vals[j1 * nx + i1];
      const t = a / (a - b);
      const px = (i0 + (i1 - i0) * t) * cell, py = (j0 + (j1 - j0) * t) * cell;
      E.x = wx(px);
      E.y = wy(py);
      const fp = F(E);
      const p = Math.abs(fp) < 0.5 * (Math.abs(a) + Math.abs(b)) ? [px, py] : null;
      points.set(key, p);
      return p;
    };
    const edges = /* @__PURE__ */ new Map();
    const segs = [];
    const add2 = (k1, p1, k2, p2) => {
      if (!p1 || !p2) return;
      const s = segs.length;
      segs.push([k1, p1, k2, p2]);
      for (const k of [k1, k2]) {
        if (!edges.has(k)) edges.set(k, []);
        edges.get(k).push(s);
      }
    };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = vals[j * nx + i], b = vals[j * nx + i + 1], c = vals[(j + 1) * nx + i + 1], d = vals[(j + 1) * nx + i];
        if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d))) continue;
        const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = () => ["h" + (j * nx + i), cross("h" + (j * nx + i), i, j, i + 1, j)];
        const B = () => ["h" + ((j + 1) * nx + i), cross("h" + ((j + 1) * nx + i), i, j + 1, i + 1, j + 1)];
        const L = () => ["v" + (j * nx + i), cross("v" + (j * nx + i), i, j, i, j + 1)];
        const R = () => ["v" + (j * nx + i + 1), cross("v" + (j * nx + i + 1), i + 1, j, i + 1, j + 1)];
        const seg = (e1, e2) => {
          const p = e1(), q = e2();
          add2(p[0], p[1], q[0], q[1]);
        };
        switch (idx) {
          case 1:
          case 14:
            seg(L, T);
            break;
          case 2:
          case 13:
            seg(T, R);
            break;
          case 3:
          case 12:
            seg(L, R);
            break;
          case 4:
          case 11:
            seg(R, B);
            break;
          case 6:
          case 9:
            seg(T, B);
            break;
          case 7:
          case 8:
            seg(L, B);
            break;
          case 5:
          case 10: {
            E.x = wx((i + 0.5) * cell);
            E.y = wy((j + 0.5) * cell);
            const centerPositive = F(E) > 0;
            if (idx === 5 === centerPositive) {
              seg(T, R);
              seg(B, L);
            } else {
              seg(L, T);
              seg(R, B);
            }
            break;
          }
        }
      }
    }
    const used = new Uint8Array(segs.length);
    const runs = [];
    const walk = (s, fromKey) => {
      const out = [];
      let key = fromKey;
      while (s >= 0 && !used[s]) {
        used[s] = 1;
        const [k1, p1, k2, p2] = segs[s];
        const [nextKey, p] = k1 === key ? [k2, p2] : [k1, p1];
        out.push(p);
        key = nextKey;
        s = (edges.get(key) || []).find((o) => !used[o]);
        if (s === void 0) s = -1;
      }
      return out;
    };
    const order = [...edges.entries()].filter(([, list]) => list.length === 1).map(([k, list]) => [list[0], k]);
    for (let s = 0; s < segs.length; s++) order.push([s, segs[s][0]]);
    for (const [s, key] of order) {
      if (used[s]) continue;
      const start = segs[s][0] === key ? segs[s][1] : segs[s][3];
      runs.push([start].concat(walk(s, key)));
    }
    return runs;
  }
  function fillStyle(e) {
    ctx.fillStyle = e.color || "#c74440";
    ctx.globalAlpha = 0.28;
  }
  function drawRegion(it, E) {
    const e = exprOf(it);
    if (it.axis) {
      const runs = explicitRuns(it.f, E, it.axis);
      const horiz = it.axis === "y";
      const edge = horiz ? it.side === "below" ? H + 2 : -2 : it.side === "below" ? -2 : W + 2;
      fillStyle(e);
      ctx.beginPath();
      for (const run of runs) {
        if (run.length < 2) continue;
        ctx.moveTo(run[0][0], run[0][1]);
        for (const p of run) ctx.lineTo(p[0], p[1]);
        const last2 = run[run.length - 1], first = run[0];
        if (horiz) {
          ctx.lineTo(last2[0], edge);
          ctx.lineTo(first[0], edge);
        } else {
          ctx.lineTo(edge, last2[1]);
          ctx.lineTo(edge, first[1]);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      strokeRuns(runs, Object.assign({}, e, { style: it.strict ? "dashed" : e.style }));
      return;
    }
    const cell = clamp4(4.5 / density(), 1.5, 3);
    fillStyle(e);
    ctx.beginPath();
    for (let py = 0; py < H; py += cell) {
      E.y = wy(py + cell / 2);
      let start = -1;
      for (let px = 0; px <= W; px += cell) {
        E.x = wx(px + cell / 2);
        const inside = px < W && it.comps.every((c) => c.test(E));
        if (inside && start < 0) start = px;
        if (!inside && start >= 0) {
          ctx.rect(start, py, px - start, cell);
          start = -1;
        }
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    for (const c of it.comps) strokeRuns(contour(c.g, E), Object.assign({}, e, { style: c.strict ? "dashed" : e.style }));
  }
  function pointAt(it, E) {
    const x = it.fx(E), y = it.fy(E);
    return isFinite(x) && isFinite(y) ? { x, y, px: sx(x), py: sy(y) } : null;
  }
  function drawPoint(it, E) {
    const p = pointAt(it, E);
    if (!p) return;
    const e = exprOf(it);
    ctx.beginPath();
    ctx.arc(p.px, p.py, (e.width || 2.5) + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = e.color || "#c74440";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.halo;
    ctx.stroke();
    if (it.dragX || it.dragY) {
      ctx.beginPath();
      ctx.arc(p.px, p.py, (e.width || 2.5) + 8, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const label = e.label ? e.label : e.showCoords ? "(" + fmt(p.x) + ", " + fmt(p.y) + ")" : "";
    if (label) haloText(label, p.px + 9, p.py - 7, "left", "bottom", "13px " + FONT, e.color);
  }
  function drawHover() {
    const { px, py, x, y, color: color2 } = hover;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color2;
    ctx.fill();
    const text = "(" + fmt(x) + ", " + fmt(y) + ")";
    ctx.font = "12px " + FONT;
    const w = ctx.measureText(text).width + 12;
    const bx = Math.min(Math.max(px + 10, 2), W - w - 2), by = Math.max(py - 30, 2);
    ctx.fillStyle = theme.panel;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(bx, by, w, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.panelText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + 6, by + 11);
  }
  let last = 0;
  function request() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    const names = Object.keys(playing);
    if (names.length) {
      const dt = last ? Math.min(0.1, (now - last) / 1e3) : 0;
      last = now;
      for (const name of names) animate(name, dt);
      syncPanel();
      draw();
      request();
    } else {
      last = 0;
      draw();
    }
  }
  function sliderOf(name) {
    const it = analysis.items.find((i) => i.kind === "param" && i.name === name);
    const e = it ? exprOf(it) : {};
    const s = e.slider || {};
    const min = isFinite(+s.min) && s.min !== "" ? +s.min : -10;
    const max = isFinite(+s.max) && s.max !== "" ? +s.max : 10;
    const stepSize = isFinite(+s.step) && +s.step > 0 ? +s.step : 0;
    return { min: Math.min(min, max), max: Math.max(min, max), step: stepSize, speed: +s.speed > 0 ? +s.speed : 1 };
  }
  function animate(name, dt) {
    const s = sliderOf(name);
    if (s.max === s.min) return;
    let v = values[name] + playing[name] * (s.max - s.min) * dt * s.speed / 4;
    if (v > s.max) {
      v = s.max - (v - s.max);
      playing[name] = -1;
    }
    if (v < s.min) {
      v = s.min + (s.min - v);
      playing[name] = 1;
    }
    values[name] = Math.min(s.max, Math.max(s.min, v));
  }
  const panel = document.createElement("div");
  document.body.appendChild(panel);
  let rows = [];
  function buildPanel() {
    panel.innerHTML = "";
    rows = [];
    const params = analysis.items.filter((it) => it.kind === "param" && it.slider && !exprOf(it).hidden);
    const show = C2.showSliders !== false && !C2.print && params.length > 0;
    panel.style.cssText = "position:absolute;left:8px;bottom:8px;display:" + (show ? "flex" : "none") + ";flex-direction:column;gap:4px;padding:6px 10px;border-radius:8px;max-height:45%;overflow:auto;background:" + theme.panel + ";border:1px solid " + theme.border + ";color:" + theme.panelText + ";font:13px " + FONT + ";box-shadow:0 2px 10px rgba(0,0,0,0.15);";
    for (const it of params) {
      const s = sliderOf(it.name);
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;white-space:nowrap;";
      const play = document.createElement("button");
      play.type = "button";
      play.style.cssText = "width:22px;height:22px;border-radius:50%;border:1px solid " + theme.border + ";background:transparent;color:" + theme.panelText + ";cursor:pointer;font-size:10px;line-height:1;padding:0;flex:none;";
      play.title = "Play";
      play.addEventListener("click", () => {
        if (playing[it.name]) delete playing[it.name];
        else playing[it.name] = 1;
        syncPanel();
        request();
      });
      const label = document.createElement("span");
      const nm = prettyName(it.name);
      const base = document.createElement("i");
      base.textContent = nm.base;
      base.style.fontFamily = MATH_FONT2;
      base.style.fontSize = "15px";
      label.appendChild(base);
      if (nm.sub) {
        const sub2 = document.createElement("sub");
        sub2.textContent = nm.sub;
        label.appendChild(sub2);
      }
      const value = document.createElement("span");
      value.style.cssText = "min-width:44px;font-variant-numeric:tabular-nums;";
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(s.min);
      range.max = String(s.max);
      range.step = s.step ? String(s.step) : "any";
      range.style.cssText = "width:120px;accent-color:" + theme.accent + ";";
      range.addEventListener("input", () => {
        values[it.name] = +range.value;
        delete playing[it.name];
        syncPanel();
        request();
      });
      range.addEventListener("change", () => postEditor({ type: "param", name: it.name, value: values[it.name] }));
      row.append(play, label, document.createTextNode("="), value, range);
      panel.appendChild(row);
      rows.push({ name: it.name, play, value, range });
    }
    syncPanel();
  }
  function syncPanel() {
    for (const r of rows) {
      const v = values[r.name];
      r.value.textContent = fmt(v);
      if (document.activeElement !== r.range) r.range.value = String(v);
      r.play.textContent = playing[r.name] ? "❚❚" : "▶";
      r.play.title = playing[r.name] ? "Pause" : "Play";
    }
  }
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "⟲";
  reset.title = "Back to the starting view";
  document.body.appendChild(reset);
  function styleReset() {
    const changed = view && C2.view && !sameView(view, copyView(C2.view));
    reset.style.cssText = "position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1;padding:0;background:" + theme.panel + ";border:1px solid " + theme.border + ";color:" + theme.panelText + ";display:" + (changed && !C2.editor && !C2.print ? "block" : "none") + ";";
  }
  reset.addEventListener("click", () => {
    view = copyView(C2.view);
    styleReset();
    request();
  });
  function postEditor(msg) {
    if (!C2.editor) return;
    try {
      parent.postMessage(Object.assign({ source: "parallax-graph" }, msg), "*");
    } catch (e) {
    }
  }
  let viewTimer = 0;
  function viewChanged() {
    styleReset();
    request();
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => postEditor({ type: "view", view: copyView(view) }), 200);
  }
  function zoom(factor, px, py) {
    const v = shown();
    const cx = v.xMin + px / W * (v.xMax - v.xMin);
    const cy = v.yMin + (H - py) / H * (v.yMax - v.yMin);
    const span = Math.min(view.xMax - view.xMin, view.yMax - view.yMin);
    const least = 1e-12 * Math.max(1, Math.abs(cx), Math.abs(cy));
    factor = Math.min(Math.max(factor, least / span), 1e12 / Math.max(view.xMax - view.xMin, view.yMax - view.yMin));
    if (!(factor > 0) || !isFinite(factor)) return;
    view = {
      xMin: cx - (cx - view.xMin) * factor,
      xMax: cx + (view.xMax - cx) * factor,
      yMin: cy - (cy - view.yMin) * factor,
      yMax: cy + (view.yMax - cy) * factor
    };
    viewChanged();
  }
  const pointers = /* @__PURE__ */ new Map();
  let drag = null;
  function pos(ev) {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }
  function snap(name, v) {
    const s = sliderOf(name);
    return s.step ? Math.round(v / s.step) * s.step : parseFloat(v.toPrecision(6));
  }
  canvas.addEventListener("pointerdown", (ev) => {
    const [px, py] = pos(ev);
    pointers.set(ev.pointerId, [px, py]);
    canvas.setPointerCapture(ev.pointerId);
    hover = null;
    if (pointers.size === 2) {
      drag = { kind: "pinch", view: copyView(view), start: [...pointers.values()] };
      return;
    }
    const E = env();
    for (const it of analysis.items) {
      if (it.kind !== "point" || !(it.dragX || it.dragY) || !visible(it)) continue;
      const p = pointAt(it, E);
      if (p && Math.hypot(p.px - px, p.py - py) < 14) {
        drag = { kind: "point", it };
        return;
      }
    }
    if (!C2.lockView) drag = { kind: "pan", view: copyView(view), start: [px, py], shown: shown() };
  });
  canvas.addEventListener("pointermove", (ev) => {
    const [px, py] = pos(ev);
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, [px, py]);
    if (!drag) {
      trace(px, py);
      return;
    }
    if (drag.kind === "point") {
      const v = shown();
      if (drag.it.dragX) values[drag.it.dragX] = snap(drag.it.dragX, v.xMin + px / W * (v.xMax - v.xMin));
      if (drag.it.dragY) values[drag.it.dragY] = snap(drag.it.dragY, v.yMin + (H - py) / H * (v.yMax - v.yMin));
      if (drag.it.dragX) delete playing[drag.it.dragX];
      if (drag.it.dragY) delete playing[drag.it.dragY];
      syncPanel();
      request();
    } else if (drag.kind === "pan") {
      const dx = (px - drag.start[0]) / W * (drag.shown.xMax - drag.shown.xMin);
      const dy = (py - drag.start[1]) / H * (drag.shown.yMax - drag.shown.yMin);
      view = { xMin: drag.view.xMin - dx, xMax: drag.view.xMax - dx, yMin: drag.view.yMin + dy, yMax: drag.view.yMax + dy };
      viewChanged();
    } else if (drag.kind === "pinch" && pointers.size === 2 && !C2.lockView) {
      const [a, b] = [...pointers.values()];
      const [a0, b0] = drag.start;
      const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), d1 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d0 > 10 && d1 > 10) {
        view = copyView(drag.view);
        zoom(d0 / d1, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
    }
  });
  const end = (ev) => {
    pointers.delete(ev.pointerId);
    if (drag && drag.kind === "point") {
      for (const name of [drag.it.dragX, drag.it.dragY]) if (name) postEditor({ type: "param", name, value: values[name] });
    }
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => {
    if (hover) {
      hover = null;
      request();
    }
  });
  canvas.addEventListener("wheel", (ev) => {
    if (C2.lockView) return;
    ev.preventDefault();
    const [px, py] = pos(ev);
    zoom(Math.exp(ev.deltaY * 15e-4), px, py);
  }, { passive: false });
  canvas.addEventListener("dblclick", (ev) => {
    if (C2.lockView) return;
    const [px, py] = pos(ev);
    zoom(0.5, px, py);
  });
  function trace(px, py) {
    let best = null;
    const E = env();
    for (const it of analysis.items) {
      const curve = it.kind === "explicit" || it.kind === "function" && it.graph;
      if (!curve || !visible(it)) continue;
      const e = exprOf(it);
      const horiz = (it.axis || "y") === "y";
      const u = horiz ? wx(px) : wy(py);
      E[horiz ? "x" : "y"] = u;
      const val = it.f(E);
      if (!isFinite(val)) continue;
      const d = horiz ? Math.abs(sy(val) - py) : Math.abs(sx(val) - px);
      if (d < 10 && (!best || d < best.d)) {
        best = horiz ? { d, px, py: sy(val), x: u, y: val, color: e.color } : { d, px: sx(val), py, x: val, y: u, color: e.color };
      }
    }
    const had = !!hover;
    hover = best;
    canvas.style.cursor = best ? "crosshair" : C2.lockView ? "default" : "grab";
    if (best || had) request();
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return;
    W = w;
    H = h;
    const d = density();
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }
  window.addEventListener("resize", resize);
  const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Home", "End"];
  window.addEventListener("keydown", (ev) => {
    if (C2.editor || ev.altKey || ev.ctrlKey || ev.metaKey || !NAV_KEYS.includes(ev.key)) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    ev.preventDefault();
    try {
      parent.postMessage({ source: "parallax-graph", type: "key", key: ev.key, shift: ev.shiftKey }, "*");
    } catch (e) {
    }
  });
  window.addEventListener("message", (ev) => {
    if (ev.source !== window.parent) return;
    const data = ev.data;
    if (data === "parallax-resize") {
      resize();
      return;
    }
    if (!data || typeof data !== "object") return;
    if (data.type === "scale" && typeof data.scale === "number" && data.scale > 0) {
      shownScale = clamp4(data.scale, 0.1, 8);
      resize();
      return;
    }
    if (data.source === "parallax-deck" && data.type === "graph-step" && typeof data.step === "number" && !C2.showAll) {
      step = data.step;
      request();
    } else if (data.source === "parallax-graph-editor" && data.type === "config" && data.config) {
      setConfig(Object.assign({}, data.config, { editor: true, showAll: true }), true);
      styleReset();
    }
  });
  setConfig(C2, false);
  styleReset();
  canvas.style.cursor = C2.lockView ? "default" : "grab";
  resize();
}

// client/src/utils/graphPage.js
var GRAPH_FIELDS = ["expressions", "view", "equalScale", "grid", "axes", "axisNumbers", "xLabel", "yLabel", "theme", "background", "showSliders", "lockView"];
var DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
function validView(v) {
  const n = (k) => v && isFinite(+v[k]) ? +v[k] : DEFAULT_VIEW[k];
  let { xMin, xMax, yMin, yMax } = { xMin: n("xMin"), xMax: n("xMax"), yMin: n("yMin"), yMax: n("yMax") };
  if (!(xMax > xMin)) ({ xMin, xMax } = DEFAULT_VIEW);
  if (!(yMax > yMin)) ({ yMin, yMax } = DEFAULT_VIEW);
  return { xMin, xMax, yMin, yMax };
}
function graphConfig(el, { snapshotKey = null, print = false, editor = false, showAll = false } = {}) {
  const config = {};
  for (const key of GRAPH_FIELDS) if (el[key] !== void 0) config[key] = el[key];
  config.expressions = Array.isArray(el.expressions) ? el.expressions : [];
  config.view = validView(el.view);
  return { ...config, snapshotKey, print, editor, showAll: showAll || print || editor };
}
var pageCode = null;
function graphPageHtml(el, opts = {}) {
  const config = graphConfig(el, opts);
  if (!pageCode) {
    pageCode = `(${graphRuntime.toString()})((${createMathParser.toString()})(), `.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "< !--");
  }
  const code = `${pageCode}${JSON.stringify(config).replace(/</g, "\\u003c")});`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none}</style></head><body><script>${code}</script></body></html>`;
}
function graphSteps(el) {
  const steps = /* @__PURE__ */ new Set();
  for (const e of el?.expressions || []) {
    const n = Number(e?.step);
    if (Number.isInteger(n) && n >= 1 && n <= 1e3 && !e.hidden) steps.add(n);
  }
  return [...steps].sort((a, b) => a - b);
}
function graphStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    if (el.type !== "graph") continue;
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const n of graphSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-graph-step="${id}" data-graph-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasGraphs(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "graph"));
}
var GRAPH_DECK_SCRIPT = `
    (function() {
      function stepOf(frame) {
        var slide = frame.closest('section'), id = frame.getAttribute('data-graph-id'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-graph-step]').forEach(function(m) {
          if (m.getAttribute('data-graph-step') === id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-graph-step-at') || 0);
        });
        return n;
      }
      function send(frame) {
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'graph-step', step: stepOf(frame) }, '*'); } catch (e) {}
      }
      function sendAll() { document.querySelectorAll('iframe[data-graph-id]').forEach(send); }
      document.querySelectorAll('iframe[data-graph-id]').forEach(function(frame) {
        frame.addEventListener('load', function() { send(frame); });
      });
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sendAll); });
      window.addEventListener('message', function(e) {
        var d = e.data;
        if (!d || d.source !== 'parallax-graph' || d.type !== 'key') return;
        var fromGraph = Array.prototype.some.call(document.querySelectorAll('iframe[data-graph-id]'), function(f) { return f.contentWindow === e.source; });
        if (!fromGraph) return;
        var k = d.key;
        if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !d.shift)) Reveal.next();
        else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && d.shift)) Reveal.prev();
        else if (k === 'ArrowDown') Reveal.down();
        else if (k === 'ArrowUp') Reveal.up();
        else if (k === 'Home') Reveal.slide(0);
        else if (k === 'End') Reveal.slide(Number.MAX_VALUE);
      });
    })();
`;

// client/src/utils/equationRuntime.js
function equationRuntime(root, cfg, katex) {
  const doc = root.ownerDocument;
  const win = doc.defaultView || window;
  const SAFE = /^[A-Za-z0-9_-]+$/;
  const NS = "http://www.w3.org/2000/svg";
  const FALLBACK = ["#5aa9ff", "#ff9a52", "#4cc36a", "#c58cff", "#f0c04b", "#ff7aa2"];
  const fontSize = cfg.fontSize || 44;
  const labelSize2 = cfg.labelSize || 18;
  const style = cfg.labelStyle || "callout";
  if (!doc.getElementById("pxeq-style")) {
    const css = doc.createElement("style");
    css.id = "pxeq-style";
    css.textContent = [
      ".pxeq{position:relative;width:100%;height:100%;line-height:normal;text-align:center}",
      ".pxeq .pxeq-body{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.45em}",
      ".pxeq .pxeq-math{max-width:none}",
      ".pxeq .pxeq-math .katex-display{margin:0}",
      ".pxeq .pxeq-math .katex{font-size:1em}",
      ".pxeq .katex,.pxeq .katex *{transition:color .35s ease,border-color .35s ease}",
      ".pxeq.pxeq-dim .katex{color:color-mix(in srgb,currentColor 28%,transparent)}",
      ".pxeq [data-term].pxeq-past{color:color-mix(in srgb,var(--tc) 50%,transparent)}",
      ".pxeq [data-term].pxeq-lit{color:var(--tc)}",
      ".pxeq.pxeq-hover [data-term]{cursor:pointer}",
      ".pxeq .pxeq-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}",
      ".pxeq .pxeq-annos{position:absolute;inset:0;pointer-events:none}",
      ".pxeq .pxeq-brace{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:pxeq-draw .45s ease-out forwards}",
      ".pxeq .pxeq-leader{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;opacity:.8}",
      ".pxeq .pxeq-tint{animation:pxeq-fade .3s ease-out both}",
      ".pxeq .pxeq-label,.pxeq .pxeq-card{position:absolute;box-sizing:border-box;max-width:22em;font-size:var(--pxeq-label);line-height:1.3;animation:pxeq-rise .35s ease-out both}",
      ".pxeq .pxeq-label{text-align:center}",
      ".pxeq .pxeq-label b,.pxeq .pxeq-card b{display:block;font-weight:700;color:var(--tc)}",
      ".pxeq .pxeq-label span,.pxeq .pxeq-card span{display:block;padding-top:.2em;font-size:.85em;color:color-mix(in srgb,currentColor 80%,transparent)}",
      ".pxeq .pxeq-card{text-align:left;padding:.4em .75em .5em;border:2px solid var(--tc);border-radius:.45em;background:color-mix(in srgb,var(--tc) 12%,transparent)}",
      ".pxeq .pxeq-compact b{white-space:nowrap}",
      ".pxeq .pxeq-above{--pxeq-dy:-6px}",
      ".pxeq .pxeq-below{--pxeq-dy:6px}",
      ".pxeq .pxeq-sentence{margin:0;max-width:min(100%,34em);font-size:calc(var(--pxeq-label) * 1.2);line-height:1.5;color:color-mix(in srgb,currentColor 72%,transparent);text-wrap:balance}",
      ".pxeq .pxeq-sentence.pxeq-off{display:none}",
      ".pxeq .pxeq-phr{transition:color .3s ease,border-color .3s ease;border-bottom:.12em solid transparent}",
      ".pxeq .pxeq-phr.pxeq-past{color:color-mix(in srgb,var(--tc) 60%,transparent)}",
      ".pxeq .pxeq-phr.pxeq-lit{color:var(--tc);border-bottom-color:var(--tc)}",
      ".pxeq .pxeq-sentence.pxeq-rest .pxeq-phr.pxeq-lit{border-bottom-color:transparent}",
      "@keyframes pxeq-draw{to{stroke-dashoffset:0}}",
      "@keyframes pxeq-rise{from{opacity:0;transform:translateY(var(--pxeq-dy,6px))}to{opacity:1;transform:none}}",
      "@keyframes pxeq-fade{from{opacity:0}to{opacity:1}}",
      ".pxeq.pxeq-static .pxeq-label,.pxeq.pxeq-static .pxeq-card,.pxeq.pxeq-static .pxeq-tint{animation:none}",
      ".pxeq.pxeq-static .pxeq-brace{animation:none;stroke-dashoffset:0}",
      ".pxeq.pxeq-static .katex,.pxeq.pxeq-static .katex *,.pxeq.pxeq-static .pxeq-phr{transition:none}",
      "@media (prefers-reduced-motion:reduce){.pxeq .pxeq-label,.pxeq .pxeq-card,.pxeq .pxeq-tint{animation:none}.pxeq .pxeq-brace{animation:none;stroke-dashoffset:0}.pxeq .katex,.pxeq .katex *,.pxeq .pxeq-phr{transition:none}}"
    ].join("\n");
    (doc.head || doc.documentElement).appendChild(css);
  }
  const make = (tag, cls) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };
  root.textContent = "";
  const wrap = make("div", "pxeq" + (cfg.static ? " pxeq-static" : "") + (cfg.hover ? " pxeq-hover" : ""));
  const svg = doc.createElementNS(NS, "svg");
  svg.setAttribute("class", "pxeq-svg");
  svg.setAttribute("aria-hidden", "true");
  const body = make("div", "pxeq-body");
  const math = make("div", "pxeq-math");
  const sentence = make("div", "pxeq-sentence");
  const annos = make("div", "pxeq-annos");
  annos.setAttribute("aria-hidden", "true");
  body.appendChild(math);
  body.appendChild(sentence);
  wrap.appendChild(svg);
  wrap.appendChild(body);
  wrap.appendChild(annos);
  wrap.style.fontSize = fontSize + "px";
  wrap.style.setProperty("--pxeq-label", labelSize2 + "px");
  if (cfg.textColor) wrap.style.color = cfg.textColor;
  root.appendChild(wrap);
  const trust = (ctx) => ctx.command === "\\htmlData" && Object.keys(ctx.attributes || {}).every((k) => (k === "data-term" || k === "data-pk") && SAFE.test(ctx.attributes[k]));
  try {
    katex.render(cfg.latex || "", math, {
      displayMode: true,
      throwOnError: false,
      trust,
      strict: (code) => code === "htmlExtension" ? "ignore" : "warn",
      macros: { "\\term": "\\htmlData{term=#1}{#2}" }
    });
  } catch (e) {
    math.textContent = String(e && e.message || e);
  }
  const termEls = Array.prototype.slice.call(math.querySelectorAll(".katex-html [data-term]"));
  const terms = [];
  const byId = {};
  const add2 = (t) => {
    byId[t.id] = t;
    terms.push(t);
  };
  (cfg.terms || []).forEach((t) => {
    if (t && !byId[t.id] && termEls.some((e) => e.getAttribute("data-term") === t.id)) add2({ id: t.id, label: t.label || "", note: t.note || "", color: t.color || FALLBACK[terms.length % 6] });
  });
  termEls.forEach((e) => {
    const id = e.getAttribute("data-term");
    if (!byId[id]) add2({ id, label: "", note: "", color: FALLBACK[terms.length % 6] });
  });
  const order = terms.map((t) => t.id);
  termEls.forEach((e) => e.style.setProperty("--tc", byId[e.getAttribute("data-term")].color));
  const phrases = [];
  if (style === "sentence" && cfg.sentence) {
    const re = /\[([^\]]+)\]\(([A-Za-z][A-Za-z0-9_-]*)\)/g;
    const text = cfg.sentence;
    let last = 0;
    let m;
    while (m = re.exec(text)) {
      sentence.appendChild(doc.createTextNode(text.slice(last, m.index)));
      const span = make("span", "pxeq-phr");
      span.textContent = m[1];
      if (byId[m[2]]) {
        span.setAttribute("data-term", m[2]);
        span.style.setProperty("--tc", byId[m[2]].color);
        phrases.push(span);
      }
      sentence.appendChild(span);
      last = re.lastIndex;
    }
    sentence.appendChild(doc.createTextNode(text.slice(last)));
  } else {
    sentence.classList.add("pxeq-off");
  }
  const stateAt = (n) => {
    if (cfg.interaction === "hover") return { kind: "rest" };
    const k = n - (cfg.stepStart || 1);
    if (k < 0 || !order.length) return { kind: "plain" };
    if (k < order.length) return { kind: "term", index: k };
    return cfg.showAll === false ? { kind: "term", index: order.length - 1 } : { kind: "all" };
  };
  let stepState = cfg.interaction === "hover" ? { kind: "rest" } : { kind: "plain" };
  let hoverId = null;
  let shown = null;
  function look() {
    const st = hoverId ? { kind: "focus", id: hoverId } : stepState;
    const s = { lit: [], past: [], dim: false, anno: [], compact: false, rest: false };
    if (st.kind === "plain") s.rest = true;
    else if (st.kind === "rest") {
      s.lit = order;
      s.rest = true;
    } else if (st.kind === "all") {
      s.lit = order;
      s.anno = order;
      s.compact = order.length > 1;
    } else if (st.kind === "term" && order[st.index]) {
      s.lit = [order[st.index]];
      s.past = cfg.keepTinted ? order.slice(0, st.index) : [];
      s.dim = true;
      s.anno = s.lit;
    } else if (st.kind === "focus") {
      s.lit = [st.id];
      s.dim = true;
      s.anno = s.lit;
    }
    return s;
  }
  function apply(force) {
    const s = look();
    const key = JSON.stringify(s);
    if (!force && key === shown) return;
    shown = key;
    wrap.classList.toggle("pxeq-dim", s.dim);
    termEls.concat(phrases).forEach((e) => {
      const id = e.getAttribute("data-term");
      e.classList.toggle("pxeq-lit", s.lit.indexOf(id) >= 0);
      e.classList.toggle("pxeq-past", s.past.indexOf(id) >= 0);
    });
    sentence.classList.toggle("pxeq-rest", s.rest);
    draw(s);
  }
  function measure() {
    const rr = wrap.getBoundingClientRect();
    const w = wrap.offsetWidth;
    if (!w || !rr.width) return null;
    const sc = rr.width / w;
    const box = (node) => {
      let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      const grow = (l, t, r, b) => {
        if (r - l <= 0 || b - t <= 0) return;
        L = Math.min(L, l);
        T = Math.min(T, t);
        R = Math.max(R, r);
        B = Math.max(B, b);
      };
      const range = doc.createRange();
      const walker = doc.createTreeWalker(node, 4);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.nodeValue.trim()) continue;
        range.selectNodeContents(n);
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const trim = (rects[i].bottom - rects[i].top) * 0.06;
          grow(rects[i].left, rects[i].top + trim, rects[i].right, rects[i].bottom - trim);
        }
      }
      node.querySelectorAll("svg, .frac-line, .rule, .overline-line, .underline-line, .hline").forEach((e) => {
        const r = e.getBoundingClientRect();
        const p = (e.tagName.toLowerCase() === "svg" && e.parentElement ? e.parentElement : e).getBoundingClientRect();
        grow(Math.max(r.left, p.left), Math.max(r.top, p.top), Math.min(r.right, p.right), Math.min(r.bottom, p.bottom));
      });
      if (L === Infinity) return null;
      return { left: (L - rr.left) / sc, top: (T - rr.top) / sc, right: (R - rr.left) / sc, bottom: (B - rr.top) / sc };
    };
    return { w, box };
  }
  const draw1 = (tag, attrs, css) => {
    const e = doc.createElementNS(NS, tag);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    if (css) e.setAttribute("style", css);
    svg.appendChild(e);
    return e;
  };
  const bracePath = (x0, x1, y, d) => {
    const xm = (x0 + x1) / 2, q = Math.min(labelSize2 * 0.6, (x1 - x0) / 4), h = d / 2;
    return "M" + x0 + "," + y + " Q" + x0 + "," + (y + h) + " " + (x0 + q) + "," + (y + h) + " L" + (xm - q) + "," + (y + h) + " Q" + xm + "," + (y + h) + " " + xm + "," + (y + d) + " Q" + xm + "," + (y + h) + " " + (xm + q) + "," + (y + h) + " L" + (x1 - q) + "," + (y + h) + " Q" + x1 + "," + (y + h) + " " + x1 + "," + y;
  };
  const labelFor = (cls, t, compact, side) => {
    if (!t.label && (compact || !t.note)) return null;
    const d = make("div", cls + " pxeq-" + side + (compact ? " pxeq-compact" : ""));
    d.style.setProperty("--tc", t.color);
    if (t.label) {
      const b = make("b");
      b.textContent = t.label;
      d.appendChild(b);
    }
    if (!compact && t.note) {
      const n = make("span");
      n.textContent = t.note;
      d.appendChild(n);
    }
    annos.appendChild(d);
    return d;
  };
  function draw(s) {
    svg.textContent = "";
    annos.textContent = "";
    if (style === "sentence" || !s.anno.length) return;
    const m = measure();
    const html = math.querySelector(".katex-html");
    const eq = m && html && m.box(html);
    if (!eq) return;
    const mid = (eq.top + eq.bottom) / 2, eqH = eq.bottom - eq.top;
    const L = labelSize2, gap = L * 0.6;
    const items = [];
    s.anno.forEach((id) => {
      const boxes = termEls.filter((e) => e.getAttribute("data-term") === id).map(m.box).filter(Boolean);
      if (!byId[id] || !boxes.length) return;
      const first = boxes[0];
      const side = (first.top + first.bottom) / 2 < mid - eqH * 0.12 ? "above" : "below";
      items.push({ t: byId[id], boxes, side, cx: (first.left + first.right) / 2 });
    });
    const rows = { above: [], below: [] };
    const row = (side, i) => rows[side][i] = rows[side][i] || { spans: [], posts: [] };
    const covers = (l, r, x) => x > l - gap / 2 && x < r + gap / 2;
    const place = (item, w) => {
      const lo = w > m.w ? (m.w - w) / 2 : 0, hi = w > m.w ? (m.w - w) / 2 : m.w - w;
      const want = Math.max(lo, Math.min(hi, item.cx - w / 2));
      const others = items.filter((o) => o !== item && o.side === item.side).map((o) => o.cx);
      const fits = (i2, l) => {
        const r = row(item.side, i2);
        if (!r.spans.every((sp) => l + w + gap <= sp[0] || l >= sp[1] + gap)) return false;
        if (r.posts.some((x) => covers(l, l + w, x))) return false;
        if (i2 === 0 && others.some((x) => covers(l, l + w, x))) return false;
        for (let j = 0; j < i2; j++) if (row(item.side, j).spans.some((sp) => covers(sp[0], sp[1], item.cx))) return false;
        return true;
      };
      const nudge = style === "callout" ? Math.min(w * 0.45, L * 5) : 0;
      for (let i2 = 0; i2 < 6; i2++) {
        let at = fits(i2, want) ? want : null;
        if (at === null && nudge) {
          const near = [];
          row(item.side, i2).spans.forEach((sp) => near.push(sp[1] + gap, sp[0] - gap - w));
          const ok = near.filter((l) => l >= lo && l <= hi && Math.abs(l - want) <= nudge && fits(i2, l));
          if (ok.length) at = ok.sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
        }
        if (at !== null) {
          row(item.side, i2).spans.push([at, at + w]);
          for (let j = 0; j < i2; j++) row(item.side, j).posts.push(item.cx);
          return { x: at, row: i2 };
        }
      }
      const i = rows[item.side].length;
      row(item.side, i).spans.push([want, want + w]);
      return { x: want, row: i };
    };
    items.forEach((item) => {
      const { t, boxes, side, cx } = item;
      const dir = side === "below" ? 1 : -1;
      if (style === "brace") {
        const y0 = side === "below" ? eq.bottom + L * 0.45 : eq.top - L * 0.45;
        const depth = L * 0.75 * dir;
        boxes.forEach((b) => draw1("path", { class: "pxeq-brace", d: bracePath(b.left + 1, b.right - 1, y0, depth), pathLength: 1 }, "stroke:" + t.color));
        const lab = labelFor("pxeq-label", t, s.compact, side);
        if (!lab) return;
        const w = lab.offsetWidth, h = lab.offsetHeight;
        const at = place(item, w);
        const tipY = y0 + depth;
        const top = side === "below" ? tipY + L * 0.35 + at.row * L * 1.75 : tipY - L * 0.35 - h - at.row * L * 1.75;
        lab.style.left = at.x + "px";
        lab.style.top = top + "px";
        if (at.row > 0) {
          const edge = side === "below" ? top - 3 : top + h + 3;
          draw1("path", { class: "pxeq-leader pxeq-tint", d: "M" + cx + "," + (tipY + 3 * dir) + " L" + cx + "," + edge }, "stroke:" + t.color);
        }
      } else {
        const padX = fontSize * 0.07, padY = fontSize * 0.07;
        boxes.forEach((b) => draw1("rect", {
          class: "pxeq-tint",
          x: b.left - padX,
          y: b.top - padY,
          width: b.right - b.left + 2 * padX,
          height: b.bottom - b.top + 2 * padY,
          rx: fontSize * 0.18
        }, "fill:" + t.color + ";fill-opacity:.12;stroke:" + t.color + ";stroke-opacity:.55;stroke-width:1.5"));
        const card = labelFor("pxeq-card", t, s.compact, side);
        if (!card) return;
        const w = card.offsetWidth, h = card.offsetHeight;
        const at = place(item, w);
        const out = s.compact ? L * 1.9 : L * 2.3;
        const top = side === "below" ? eq.bottom + out + at.row * L * 2.4 : eq.top - out - h - at.row * L * 2.4;
        card.style.left = at.x + "px";
        card.style.top = top + "px";
        const cardX = Math.max(at.x + L, Math.min(at.x + w - L, cx));
        const cardEdge = side === "below" ? top : top + h;
        boxes.forEach((b) => {
          const ax = (b.left + b.right) / 2, ay = side === "below" ? b.bottom + padY : b.top - padY;
          const midY = side === "below" ? Math.max(ay + L * 0.6, eq.bottom + L * 0.9) : Math.min(ay - L * 0.6, eq.top - L * 0.9);
          draw1("path", { class: "pxeq-leader pxeq-tint", d: "M" + ax + "," + ay + " L" + ax + "," + midY + " L" + cardX + "," + midY + " L" + cardX + "," + cardEdge }, "stroke:" + t.color);
          draw1("circle", { class: "pxeq-tint", cx: ax, cy: ay, r: L * 0.22 }, "fill:" + t.color);
        });
      }
    });
  }
  let timer = 0;
  const setHover = (id) => {
    win.clearTimeout(timer);
    if (hoverId === id) return;
    hoverId = id;
    apply();
  };
  const leave = () => {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => setHover(null), 200);
  };
  const termAt = (target) => {
    const t = target && target.closest ? target.closest("[data-term]") : null;
    return t && wrap.contains(t) && byId[t.getAttribute("data-term")] ? t.getAttribute("data-term") : null;
  };
  const onOver = (e) => {
    if (e.pointerType === "touch") return;
    const id = termAt(e.target);
    if (id) setHover(id);
    else leave();
  };
  const onClick = (e) => {
    const id = termAt(e.target);
    const tap = e.pointerType === "touch" || e.pointerType === "pen";
    if (id) setHover(tap && hoverId === id ? null : id);
    else if (hoverId) setHover(null);
  };
  if (cfg.hover) {
    wrap.addEventListener("pointerover", onOver);
    wrap.addEventListener("pointerleave", leave);
    wrap.addEventListener("click", onClick);
  }
  const redraw = () => apply(true);
  const ro = win.ResizeObserver ? new win.ResizeObserver(redraw) : null;
  if (ro) ro.observe(wrap);
  const fonts = doc.fonts;
  if (fonts && fonts.addEventListener) fonts.addEventListener("loadingdone", redraw);
  apply(true);
  return {
    step(n) {
      stepState = stateAt(n);
      apply();
    },
    show(kind, index) {
      stepState = kind === "term" ? { kind, index: index || 0 } : { kind };
      apply();
    },
    focus(id) {
      setHover(id && byId[id] ? id : null);
    },
    terms: order,
    wrap,
    math,
    redraw,
    // A node's box in the wrapper's own pixels, or null while it isn't shown
    box(node) {
      const m = measure();
      return m && node ? m.box(node) : null;
    },
    destroy() {
      win.clearTimeout(timer);
      if (ro) ro.disconnect();
      if (fonts && fonts.removeEventListener) fonts.removeEventListener("loadingdone", redraw);
      root.textContent = "";
    }
  };
}

// client/src/utils/equationTerms.js
var EQUATION_COLORS = {
  dark: ["#5aa9ff", "#ff9a52", "#4cc36a", "#c58cff", "#f0c04b", "#ff7aa2"],
  light: ["#1d6fd8", "#cc5410", "#12855a", "#8a3ec2", "#9f6600", "#c02a5c"]
};
var LABEL_STYLES = ["callout", "brace", "sentence"];
var INTERACTIONS = ["steps", "hover", "both"];
var MAX_TERMS = 40;
var TERM_ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
var COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
var ARGS = {
  frac: "mm",
  dfrac: "mm",
  tfrac: "mm",
  cfrac: "mm",
  binom: "mm",
  dbinom: "mm",
  tbinom: "mm",
  sqrt: "om",
  overset: "mm",
  underset: "mm",
  stackrel: "mm",
  xrightarrow: "om",
  xleftarrow: "om",
  overbrace: "m",
  underbrace: "m",
  overline: "m",
  underline: "m",
  boxed: "m",
  hat: "m",
  widehat: "m",
  tilde: "m",
  widetilde: "m",
  bar: "m",
  vec: "m",
  dot: "m",
  ddot: "m",
  dddot: "m",
  check: "m",
  breve: "m",
  acute: "m",
  grave: "m",
  mathring: "m",
  overrightarrow: "m",
  overleftarrow: "m",
  overleftrightarrow: "m",
  underrightarrow: "m",
  underleftarrow: "m",
  cancel: "m",
  bcancel: "m",
  xcancel: "m",
  sout: "m",
  phantom: "m",
  hphantom: "m",
  vphantom: "m",
  smash: "om",
  mathrm: "m",
  mathbf: "m",
  mathit: "m",
  mathsf: "m",
  mathtt: "m",
  mathcal: "m",
  mathbb: "m",
  mathfrak: "m",
  mathscr: "m",
  mathnormal: "m",
  boldsymbol: "m",
  bm: "m",
  pmb: "m",
  mathop: "m",
  mathbin: "m",
  mathrel: "m",
  mathord: "m",
  mathopen: "m",
  mathclose: "m",
  mathpunct: "m",
  mathinner: "m",
  text: "t",
  textrm: "t",
  textbf: "t",
  textit: "t",
  textsf: "t",
  texttt: "t",
  textnormal: "t",
  textup: "t",
  emph: "t",
  mbox: "t",
  hbox: "t",
  operatorname: "t",
  "operatorname*": "t",
  tag: "t",
  "tag*": "t",
  label: "t",
  color: "t",
  textcolor: "tm",
  colorbox: "tt",
  fcolorbox: "ttt",
  href: "tm",
  url: "t",
  htmlData: "tm",
  htmlClass: "tm",
  htmlId: "tm",
  htmlStyle: "tm",
  hspace: "t",
  kern: "",
  mkern: "",
  mskip: "",
  hskip: ""
};
var STRUCTURAL = /* @__PURE__ */ new Set(["over", "atop", "choose", "above", "brace", "brack", "\\", "cr", "newline", "right", "middle", "end", "hline", "hdashline", "nonumber", "notag"]);
var OPERATORS = /* @__PURE__ */ new Set([
  "sum",
  "prod",
  "coprod",
  "int",
  "iint",
  "iiint",
  "oint",
  "oiint",
  "bigcup",
  "bigcap",
  "bigvee",
  "bigwedge",
  "bigoplus",
  "bigotimes",
  "bigodot",
  "biguplus",
  "bigsqcup",
  "lim",
  "liminf",
  "limsup",
  "max",
  "min",
  "sup",
  "inf",
  "det",
  "gcd",
  "Pr",
  "argmax",
  "argmin",
  "varlimsup",
  "varliminf",
  "injlim",
  "projlim",
  "overbrace",
  "underbrace",
  "overbracket",
  "underbracket",
  "operatorname*",
  "mathop"
]);
var ENV_ARG = /* @__PURE__ */ new Set(["array", "darray", "subarray", "alignat", "alignat*", "alignedat"]);
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "%") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === " " || c === "	" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "\\") {
      const word = /^[A-Za-z@]+\*?/.exec(src.slice(i + 1, i + 64));
      if (word) {
        out.push({ t: "cmd", name: word[0], start: i, end: i + 1 + word[0].length });
        i += 1 + word[0].length;
      } else if (i + 1 < src.length) {
        out.push({ t: "cmd", name: src[i + 1], start: i, end: i + 2 });
        i += 2;
      } else {
        out.push({ t: "char", start: i, end: i + 1 });
        i++;
      }
      continue;
    }
    const len2 = src.codePointAt(i) > 65535 ? 2 : 1;
    out.push({ t: "{}^_&[]".includes(c) ? c : "char", start: i, end: i + len2 });
    i += len2;
  }
  return out;
}
function parseLatex(src) {
  src = String(src || "");
  const toks = tokenize(src);
  let p = 0;
  const isCmd = (tok, ...names) => !!tok && tok.t === "cmd" && names.includes(tok.name);
  const mkList = (atoms2, start, end, braced) => ({ start, end, braced, atoms: atoms2, parent: null });
  const mk = (kind, start, end, lists, extra) => ({ kind, start, end, lists, wrap: true, parent: null, index: 0, ...extra });
  function items(stop) {
    const atoms2 = [];
    while (p < toks.length && !stop(toks[p])) {
      const a = atom();
      if (a) atoms2.push(a);
    }
    return atoms2;
  }
  function group() {
    const open = toks[p++];
    const atoms2 = items((tok) => tok.t === "}");
    const close = toks[p] && toks[p].t === "}" ? toks[p++] : null;
    const innerEnd = close ? close.start : atoms2.length ? atoms2[atoms2.length - 1].end : open.end;
    return { inner: mkList(atoms2, open.end, innerEnd, true), end: close ? close.end : innerEnd };
  }
  function skipArg() {
    const tok = toks[p];
    if (!tok) return src.length;
    if (tok.t !== "{") {
      p++;
      return tok.end;
    }
    let depth = 0;
    while (p < toks.length) {
      const t = toks[p++];
      if (t.t === "{") depth++;
      else if (t.t === "}" && --depth === 0) return t.end;
    }
    return src.length;
  }
  function mathArg() {
    const tok = toks[p];
    if (!tok || tok.t === "}" || tok.t === "&") return null;
    if (tok.t === "{") {
      const g = group();
      return { list: g.inner, end: g.end };
    }
    const a = base();
    return a ? { list: mkList([a], a.start, a.end, false), end: a.end } : null;
  }
  function base() {
    const tok = toks[p];
    if (tok.t === "{") {
      const g = group();
      return mk("group", tok.start, g.end, [g.inner]);
    }
    if (tok.t === "cmd") return command();
    p++;
    return mk("char", tok.start, tok.end, [], { wrap: tok.t !== "&" && tok.t !== "}" });
  }
  function atom() {
    const tok = toks[p];
    if (tok.t === "}") {
      p++;
      return null;
    }
    const b = tok.t === "^" || tok.t === "_" ? null : base();
    if (b && !b.wrap) return b;
    const scripts = [];
    let end = b ? b.end : tok.start, any = false;
    while (p < toks.length) {
      const t = toks[p];
      if (isCmd(t, "limits", "nolimits")) {
        end = t.end;
        p++;
        continue;
      }
      if (t.t === "char" && src[t.start] === "'") {
        end = t.end;
        p++;
        any = true;
        continue;
      }
      if (t.t !== "^" && t.t !== "_") break;
      p++;
      any = true;
      const arg = mathArg();
      if (!arg) {
        end = t.end;
        continue;
      }
      scripts.push(arg.list);
      end = arg.end;
    }
    if (!any) return b;
    const lists = [];
    if (b) {
      if (b.kind === "cmd" && OPERATORS.has(b.name)) lists.push(...b.lists);
      else lists.push(mkList([b], b.start, b.end, false));
    }
    lists.push(...scripts);
    return mk("scripts", b ? b.start : tok.start, end, lists);
  }
  function command() {
    const tok = toks[p++];
    const name = tok.name;
    if (name === "left") return leftRight(tok);
    if (name === "begin") return environment(tok);
    if (name === "term") return term(tok);
    if (STRUCTURAL.has(name)) {
      let end2 = tok.end;
      if (name === "middle" || name === "right") {
        const d = toks[p];
        if (d) {
          p++;
          end2 = d.end;
        }
      }
      if (name === "\\" && toks[p] && toks[p].t === "[") {
        p++;
        items((t) => t.t === "]");
        if (toks[p]) end2 = toks[p++].end;
      }
      return mk("cmd", tok.start, end2, [], { name, wrap: false });
    }
    const lists = [];
    let end = tok.end;
    const spec = ARGS[name];
    if (spec === void 0) {
      while (toks[p] && toks[p].t === "{" && toks[p].start === end) {
        const g = group();
        lists.push(g.inner);
        end = g.end;
      }
    } else {
      for (const kind of spec) {
        const t = toks[p];
        if (!t) break;
        if (kind === "o") {
          if (t.t !== "[") continue;
          p++;
          const atoms2 = items((x) => x.t === "]");
          const close = toks[p] && toks[p].t === "]" ? toks[p++] : null;
          lists.push(mkList(atoms2, t.end, close ? close.start : end, true));
          end = close ? close.end : atoms2.length ? atoms2[atoms2.length - 1].end : t.end;
        } else if (kind === "t") {
          end = skipArg();
        } else {
          const arg = mathArg();
          if (!arg) break;
          lists.push(arg.list);
          end = arg.end;
        }
      }
    }
    return mk("cmd", tok.start, end, lists, { name });
  }
  function leftRight(tok) {
    let end = tok.end;
    if (toks[p]) end = toks[p++].end;
    const open = end;
    const atoms2 = items((t) => isCmd(t, "right"));
    const close = toks[p] ? toks[p].start : src.length;
    if (isCmd(toks[p], "right")) {
      end = toks[p++].end;
      if (toks[p]) end = toks[p++].end;
    } else if (atoms2.length) end = atoms2[atoms2.length - 1].end;
    return mk("leftright", tok.start, end, [mkList(atoms2, open, close, true)]);
  }
  function environment(tok) {
    const nameTok = toks[p];
    let end = skipArg();
    const env = nameTok && nameTok.t === "{" ? src.slice(nameTok.end, end - 1).trim() : "";
    if (ENV_ARG.has(env)) end = skipArg();
    const cells = [];
    for (; ; ) {
      const from = toks[p] ? toks[p].start : src.length;
      const atoms2 = items((t2) => t2.t === "&" || isCmd(t2, "\\", "cr", "end", "hline", "hdashline"));
      const t = toks[p];
      cells.push(mkList(atoms2, from, t ? t.start : src.length, true));
      if (!t) break;
      p++;
      if (isCmd(t, "end")) {
        end = skipArg();
        break;
      }
      if (isCmd(t, "\\") && toks[p] && toks[p].t === "[") {
        p++;
        items((x) => x.t === "]");
        if (toks[p]) p++;
      }
    }
    return mk("env", tok.start, end, cells, { name: env });
  }
  function term(tok) {
    let id = "", end = tok.end;
    if (toks[p] && toks[p].t === "{") {
      const from = toks[p].end;
      end = skipArg();
      id = src.slice(from, end - 1).trim();
    }
    const arg = mathArg();
    if (!arg) return mk("cmd", tok.start, end, [], { name: "term", wrap: false, term: id });
    return mk("term", tok.start, arg.end, [arg.list], { term: id, body: arg.list });
  }
  const root = mkList(items(() => false), 0, src.length, true);
  const atoms = [];
  const link = (list, parent2) => {
    list.parent = parent2;
    list.atoms.forEach((a, i) => {
      a.parent = list;
      a.index = i;
      atoms.push(a);
      a.lists.forEach((l) => link(l, a));
    });
  };
  link(root, null);
  return { src, root, atoms };
}
function termAtoms(tree) {
  return tree.atoms.filter((a) => a.kind === "term").sort((a, b) => a.start - b.start);
}
function termIdsIn(latex) {
  const ids = [];
  for (const a of termAtoms(parseLatex(latex))) if (TERM_ID.test(a.term) && !ids.includes(a.term)) ids.push(a.term);
  return ids;
}
var int = (v, min, max, dflt) => Number.isInteger(+v) && +v >= min && +v <= max ? +v : dflt;
var num2 = (v, min, max, dflt) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
var str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
var isDark = (hex) => {
  const h = hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (d) => d + d) : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};
function equationConfig(el) {
  const latex = str(el?.latex, 2e4);
  const ids = termIdsIn(latex);
  const textColor = typeof el?.textColor === "string" && COLOR.test(el.textColor) ? el.textColor : null;
  const palette = EQUATION_COLORS[textColor && isDark(textColor) ? "light" : "dark"];
  const given = Array.isArray(el?.terms) ? el.terms : [];
  const terms = [];
  for (const t of given) {
    if (!t || !ids.includes(t.id) || terms.some((u) => u.id === t.id)) continue;
    terms.push({ id: t.id, label: str(t.label, 200), note: str(t.note, 500), color: COLOR.test(t.color || "") ? t.color : null });
  }
  for (const id of ids) if (!terms.some((t) => t.id === id)) terms.push({ id, label: "", note: "", color: null });
  terms.splice(MAX_TERMS);
  terms.forEach((t, i) => {
    if (!t.color) t.color = palette[i % palette.length];
  });
  return {
    latex,
    terms,
    labelStyle: LABEL_STYLES.includes(el?.labelStyle) ? el.labelStyle : "callout",
    sentence: str(el?.sentence, 2e3),
    interaction: INTERACTIONS.includes(el?.interaction) ? el.interaction : "steps",
    stepStart: int(el?.stepStart, 1, 1e3, 1),
    showAll: el?.showAll !== false,
    keepTinted: !!el?.keepTinted,
    fontSize: num2(el?.fontSize, 8, 200, 44),
    labelSize: num2(el?.labelSize, 6, 120, 18),
    textColor
  };
}
function equationSteps(el) {
  if (el?.type !== "equation") return [];
  const cfg = equationConfig(el);
  if (cfg.interaction === "hover") return [];
  const steps = cfg.terms.map((t, i) => [cfg.stepStart + i, i]);
  if (steps.length && cfg.showAll) steps.push([cfg.stepStart + steps.length, "all"]);
  return steps.filter(([n]) => n <= 1e3);
}
function equationStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n] of equationSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-eq-step="${id}" data-eq-step-at="${n}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasEquations(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "equation"));
}
function equationConfigAttr(el, extra = {}) {
  return JSON.stringify({ ...equationConfig(el), ...extra }).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var runtimeCode = null;
function runtimeSource() {
  if (!runtimeCode) runtimeCode = `(${equationRuntime.toString()})`.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "< !--");
  return runtimeCode;
}
function equationDeckScript() {
  return `
    (function() {
      var run = ${runtimeSource()};
      var items = [];
      document.querySelectorAll('[data-eq-config]').forEach(function(el) {
        try {
          var cfg = JSON.parse(el.getAttribute('data-eq-config'));
          cfg.hover = cfg.interaction !== 'steps';
          items.push({ el: el, id: el.getAttribute('data-eq'), eq: run(el, cfg, window.katex) });
        } catch (e) {}
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-eq-step]').forEach(function(m) {
          if (m.getAttribute('data-eq-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-eq-step-at') || 0);
        });
        return n;
      }
      function sync() { items.forEach(function(item) { item.eq.step(stepOf(item)); }); }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
    })();
`;
}

// client/src/utils/tikzDiagram.js
function sanitizeSvg(svg) {
  if (typeof svg !== "string") return "";
  const start = svg.search(/<svg\b/i);
  let end = -1;
  for (const m of svg.matchAll(/<\/svg\s*>/gi)) end = m.index + m[0].length;
  if (start < 0 || end <= start) return "";
  return withoutPairs(svg.slice(start, end)).replace(/<(script|iframe|object|embed)\b[^>]*>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*(?:"|$)|'[^']*(?:'|$)|[^\s>]+)/gi, "").replace(/\s((?:xlink:)?href)\s*=\s*("\s*javascript:[^"]*(?:"|$)|'\s*javascript:[^']*(?:'|$))/gi, ' $1="#"');
}
function withoutPairs(html) {
  const lower = html.toLowerCase();
  const noCloseFrom = {};
  const open = /<(script|iframe|object|embed)\b/gi;
  let out = "", kept = 0, m;
  while (m = open.exec(html)) {
    const tag = m[1].toLowerCase();
    if (m.index >= (noCloseFrom[tag] ?? Infinity)) continue;
    const close = new RegExp(`</${tag}\\s*>`, "g");
    close.lastIndex = m.index;
    const c = close.exec(lower);
    if (!c) {
      noCloseFrom[tag] = m.index;
      continue;
    }
    out += html.slice(kept, m.index);
    kept = open.lastIndex = c.index + c[0].length;
  }
  return out + html.slice(kept);
}
function tikzDiagramSvg(el) {
  return sanitizeSvg(el.svg).replace(/^<svg\b/i, '<svg style="width:100%;height:100%;display:block;overflow:visible"');
}

// client/src/utils/diagramCore.js
var MATH_FONT = "'Latin Modern Roman', 'Times New Roman', Times, serif";
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n1 = (v) => String(Math.round(v * 10) / 10);
var GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω" };
var SYM = { pm: "±", mp: "∓", to: "→", prime: "′", ell: "ℓ", ast: "∗", times: "×", cdot: "·", infty: "∞", partial: "∂", hbar: "ℏ", ",": " ", ";": " ", " ": " ", "!": "", quad: "  " };
var SET_SYM = { cup: " ∪ ", cap: " ∩ ", setminus: " ∖ ", smallsetminus: " ∖ ", triangle: " △ ", ominus: " ⊖ ", oplus: " ⊕ ", subseteq: " ⊆ ", supseteq: " ⊇ ", subset: " ⊂ ", supset: " ⊃ ", subsetneq: " ⊊ ", supsetneq: " ⊋ ", neq: " ≠ ", ne: " ≠ ", mid: " | ", in: " ∈ ", notin: " ∉ ", varnothing: "∅", emptyset: "∅", complement: "ᶜ" };
var ACCENT = { bar: 772, overline: 773, tilde: 771, hat: 770 };
var UPRIGHT = { mathrm: 1, text: 1, rm: 1, mathbf: 1 };
var SCRIPT = { A: "𝒜", B: "ℬ", C: "𝒞", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ" };
var COMBINING = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
function texRuns(src) {
  src = String(src || "");
  const runs = [];
  let i = 0;
  const push = (t, lvl, it) => {
    if (!t) return;
    const r = runs[runs.length - 1];
    if (r && r.lvl === lvl && r.it === it) r.t += t;
    else runs.push({ t, lvl, it });
  };
  function atom(lvl, up) {
    const c = src[i];
    if (c === void 0) return;
    if (c === "{") {
      i++;
      group(lvl, up, "}");
      return;
    }
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      if (!m) {
        i++;
        return;
      }
      i += m[0].length;
      const name = m[1];
      if (ACCENT[name]) {
        const before = runs.length, lastLen = before ? runs[before - 1].t.length : 0;
        while (src[i] === " ") i++;
        atom(lvl, up);
        const mark = String.fromCharCode(ACCENT[name]);
        if (runs.length > before) {
          const r = runs[before];
          r.t = r.t.slice(0, 1) + mark + r.t.slice(1);
        } else if (before && runs[before - 1].t.length > lastLen) {
          const r = runs[before - 1];
          r.t = r.t.slice(0, lastLen + 1) + mark + r.t.slice(lastLen + 1);
        }
        return;
      }
      if (UPRIGHT[name]) {
        while (src[i] === " ") i++;
        atom(lvl, true);
        return;
      }
      if (name === "mathcal") {
        while (src[i] === " ") i++;
        const before = runs.length;
        atom(lvl, true);
        for (const r of runs.slice(Math.max(0, before - 1))) r.t = r.t.replace(/[A-Z]/g, (c2) => SCRIPT[c2] || c2);
        return;
      }
      if (name === "mathbin" || name === "mathrel" || name === "mathop") {
        while (src[i] === " ") i++;
        atom(lvl, up);
        return;
      }
      if (GREEK[name]) {
        push(GREEK[name], lvl, !up && name[0] === name[0].toLowerCase());
        return;
      }
      if (SYM[name] !== void 0) {
        push(SYM[name], lvl, false);
        return;
      }
      if (SET_SYM[name] !== void 0) {
        push(SET_SYM[name], lvl, false);
        return;
      }
      push(name, lvl, false);
      return;
    }
    i++;
    if (/[A-Za-z]/.test(c)) push(c, lvl, !up);
    else if (c === "-") push("−", lvl, false);
    else if (c === "'") push("′", lvl, false);
    else if (c === "~") push(" ", lvl, false);
    else if (c !== " ") push(c, lvl, false);
  }
  function group(lvl, up, end) {
    while (i < src.length && src[i] !== end) {
      if (src[i] === "^" || src[i] === "_") {
        const l = src[i] === "^" ? 1 : -1;
        i++;
        atom(lvl || l, up);
        continue;
      }
      if (src[i] === "}") {
        i++;
        continue;
      }
      atom(lvl, up);
    }
    if (end && src[i] === end) i++;
  }
  group(0, false, null);
  return runs;
}
function texBox(src, fs) {
  let w = 0, sup = false, sub2 = false;
  for (const r of texRuns(src)) {
    w += r.t.replace(COMBINING, "").length * fs * 0.5 * (r.lvl ? 0.7 : 1);
    if (r.lvl > 0) sup = true;
    if (r.lvl < 0) sub2 = true;
  }
  return { w: Math.max(w, fs * 0.4), h: fs * (1 + (sup ? 0.25 : 0) + (sub2 ? 0.2 : 0)) };
}
function texLiteHtml(src) {
  return texRuns(src).map((r) => {
    const t = r.it ? `<i>${esc(r.t)}</i>` : esc(r.t);
    return r.lvl > 0 ? `<sup>${t}</sup>` : r.lvl < 0 ? `<sub>${t}</sub>` : t;
  }).join("");
}
function texSvg(src, X, Y, fs, fill) {
  let cur = 0, spans = "";
  for (const r of texRuns(src)) {
    const target = r.lvl > 0 ? -0.42 : r.lvl < 0 ? 0.24 : 0;
    const dy = (target - cur) * fs;
    cur = target;
    spans += `<tspan dy="${n1(dy)}" font-size="${n1(r.lvl ? fs * 0.7 : fs)}" font-style="${r.it ? "italic" : "normal"}">${esc(r.t)}</tspan>`;
  }
  return `<text x="${n1(X)}" y="${n1(Y + fs * 0.34)}" text-anchor="middle" font-family="${esc(MATH_FONT)}" font-size="${n1(fs)}" fill="${esc(fill)}">${spans}</text>`;
}
function applyDiagramStep(root, cur, animate, dim) {
  var parts = root.querySelectorAll(".pxfx-part"), i, p, at, best = -1;
  for (i = 0; i < parts.length; i++) {
    p = parts[i];
    at = +p.getAttribute("data-fx-at") || 0;
    p.classList.toggle("pxfx-off", at > cur);
    p.classList.toggle("pxfx-past", !!dim && cur > 0 && at < cur);
    p.classList.remove("pxfx-new");
    if (animate && at === cur && at > 0) {
      void p.getBoundingClientRect();
      p.classList.add("pxfx-new");
    }
  }
  var caps = root.querySelectorAll("[data-fx-cap]");
  for (i = 0; i < caps.length; i++) {
    at = +caps[i].getAttribute("data-fx-cap");
    if (at <= cur && at > best) best = at;
  }
  for (i = 0; i < caps.length; i++) caps[i].classList.toggle("pxfx-off", +caps[i].getAttribute("data-fx-cap") !== best);
  var spans = root.querySelectorAll("[data-fx-in]"), r;
  for (i = 0; i < spans.length; i++) {
    r = spans[i].getAttribute("data-fx-in").split("-");
    spans[i].classList.toggle("pxfx-off", cur < +r[0] || r[1] !== "" && cur > +r[1]);
  }
}
var DIAGRAM_CSS = [
  ".pxfx-part.pxfx-off,.pxfx-cap.pxfx-off{visibility:hidden}",
  "[data-fx-in].pxfx-off{display:none}",
  ".pxfx-part{transition:opacity .35s ease}",
  ".pxfx-part.pxfx-past{opacity:.34}",
  ".pxfx-reveal{stroke-dasharray:1 1;stroke-dashoffset:0}",
  ".pxfx-new .pxfx-reveal{animation:pxfx-draw .75s ease-in-out both}",
  ".pxfx-new .pxfx-fade,.pxfx-new.pxfx-v{animation:pxfx-fade .35s .45s ease-out both}",
  "@keyframes pxfx-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}",
  "@keyframes pxfx-fade{from{opacity:0}to{opacity:1}}",
  // A circuit's current: dots that run the way conventional current flows
  ".pxcx-flow{animation:pxcx-flow .6s linear infinite}",
  "@keyframes pxcx-flow{to{stroke-dashoffset:-14}}",
  // A logic signal that changed: it fades in after those before it in the logic
  ".pxlg-sig{animation:pxfx-fade .28s ease-out both}",
  // A Venn diagram's shading, numbers or verdict: in at once, with nothing drawn first
  ".pxfx-new .pxvn-in{animation:pxfx-fade .45s ease-out both}",
  "@media (prefers-reduced-motion:reduce){.pxfx-new .pxfx-reveal,.pxfx-new .pxfx-fade,.pxfx-new.pxfx-v,.pxcx-flow,.pxlg-sig,.pxfx-new .pxvn-in{animation:none}.pxfx-part{transition:none}}"
].join("\n");
var deckScript = null;
function diagramDeckScript() {
  if (!deckScript) deckScript = `
    (function() {
      var apply = (${applyDiagramStep.toString()});
      // The labels, now rather than when the deck is ready
      if (window.katex) document.querySelectorAll('[data-fx] span[data-math-latex]').forEach(function(el) {
        try { window.katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false }); el.style.fontFamily = ''; } catch (e) {}
      });
      var css = document.createElement('style');
      css.textContent = ${JSON.stringify(DIAGRAM_CSS)};
      document.head.appendChild(css);
      var items = [];
      document.querySelectorAll('[data-fx]').forEach(function(el) {
        items.push({ el: el, id: el.getAttribute('data-fx'), dim: el.getAttribute('data-fx-dim') === '1', at: -1 });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-fx-step]').forEach(function(m) {
          if (m.getAttribute('data-fx-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-fx-step-at') || 0);
        });
        return n;
      }
      function sync(ev) {
        var forward = !!ev && ev.type === 'fragmentshown';
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n === item.at) return;
          apply(item.el, n, forward && n > item.at, item.dim);
          item.at = n;
        });
      }
      ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      sync();
    })();
`;
  return deckScript;
}

// client/src/utils/feynmanDiagram.js
var UNIT = 64;
var AMP = 0.085;
var HALF = 0.155;
var PITCH = 0.19;
var COIL = 0.1;
var DBL = 0.032;
var LABEL = 0.3;
var CAPTION = 0.27;
var FEYNMAN_TYPES = {
  fermion: { name: "Fermion", tikz: "fermion", arrow: 1, fermion: true, key: "f", usual: "e, μ, q, t", chips: ["e^-", "\\mu^-", "q", "t", "\\nu_e"] },
  antifermion: { name: "Antifermion", tikz: "anti fermion", arrow: -1, fermion: true, key: "a", usual: "e⁺, antiquarks", chips: ["e^+", "\\bar{q}", "\\bar{\\nu}_e"] },
  photon: { name: "Photon", tikz: "photon", deco: "wave", key: "p", usual: "γ, Z, W", chips: ["\\gamma", "\\gamma^*", "Z", "W^-"] },
  chargedBoson: { name: "Charged boson", tikz: "charged boson", deco: "wave", arrow: 1, usual: "W⁺, W⁻", chips: ["W^+", "W^-"] },
  gluon: { name: "Gluon", tikz: "gluon", deco: "coil", key: "g", usual: "g", chips: ["g"] },
  scalar: { name: "Scalar", tikz: "scalar", dash: "7 5", key: "s", usual: "H, φ, π⁰", chips: ["H", "\\phi", "\\pi^0"] },
  chargedScalar: { name: "Charged scalar", tikz: "charged scalar", dash: "7 5", arrow: 1, usual: "H⁺, π⁺, K⁺", chips: ["H^+", "\\pi^+", "K^+"] },
  ghost: { name: "Ghost", tikz: "ghost", dash: "dot", arrow: 1, usual: "Faddeev–Popov ghost", chips: ["c", "\\bar{c}"] },
  graviton: { name: "Graviton", tikz: "graviton", deco: "wave2", usual: "graviton", chips: ["h_{\\mu\\nu}"] },
  plain: { name: "Plain", tikz: "plain", usual: "any, or a Majorana line", chips: [] },
  double: { name: "Double", tikz: "double", deco: "double", usual: "heavy quark, composite", chips: ["Q", "B"] }
};
var VERTEX_KINDS = [["auto", "Auto"], ["none", "None"], ["dot", "Dot"], ["blob", "Blob"], ["crossed", "Crossed"], ["empty", "Empty"], ["square", "Square"]];
var KIND_R = { blob: 0.36, crossed: 0.125, empty: 0.072 };
var LABEL_AT = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] };
var esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n12 = (v) => String(Math.round(v * 10) / 10);
var clamp = (v, a, b) => Math.min(b, Math.max(a, v));
var ID = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR2 = /^#[0-9a-f]{6}$/i;
var num3 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? clamp(v, lo, hi) : dflt;
var int2 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? clamp(Math.round(v), lo, hi) : dflt;
var str2 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function feynmanModel(el) {
  const vertices = [], edges = [], ids = /* @__PURE__ */ new Set();
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID.test(v.id) || ids.has(v.id)) continue;
    ids.add(v.id);
    vertices.push({
      id: v.id,
      x: num3(v.x, -1e3, 1e3, 0),
      y: num3(v.y, -1e3, 1e3, 0),
      kind: VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : "auto",
      label: str2(v.label, 200),
      labelAt: LABEL_AT[v.labelAt] ? v.labelAt : "auto",
      color: COLOR2.test(v.color || "") ? v.color : null,
      step: v.step == null ? null : int2(v.step, 0, 1e3, null)
    });
  }
  const edgeIds = /* @__PURE__ */ new Set();
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1e3) : []) {
    if (!e || !ID.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to)) continue;
    edgeIds.add(e.id);
    const out = {
      id: e.id,
      from: e.from,
      to: e.to,
      particle: FEYNMAN_TYPES[e.particle] ? e.particle : "plain",
      bend: num3(e.bend, -1.6, 1.6, 0),
      label: str2(e.label, 200),
      labelSide: e.labelSide === -1 ? -1 : 1,
      momentum: str2(e.momentum, 200),
      momentumSide: e.momentumSide === 1 ? 1 : -1,
      momentumReverse: !!e.momentumReverse,
      color: COLOR2.test(e.color || "") ? e.color : null,
      step: int2(e.step, 0, 1e3, 0)
    };
    if (e.from === e.to) {
      out.loopAngle = int2(e.loopAngle, -360, 720, 90);
      out.loopSize = num3(e.loopSize, 0.3, 6, 1.2);
    }
    edges.push(out);
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    vertices,
    edges,
    captions,
    color: COLOR2.test(el?.color || "") ? el.color : "#ffffff",
    stepStart: int2(el?.stepStart, 1, 1e3, 1),
    dimPast: el?.dimPast !== false
  };
}
function lineGeometry(V, e) {
  const A = V[e.from], B = V[e.to];
  if (!A || !B) return null;
  if (e.from === e.to) {
    const r = (e.loopSize || 1.2) / 2, ang = (e.loopAngle ?? 90) * Math.PI / 180;
    const cx2 = A.x + r * Math.cos(ang), cy2 = A.y + r * Math.sin(ang), a0 = ang + Math.PI;
    return {
      len: 2 * Math.PI * r,
      curved: true,
      at: (t) => {
        const th = a0 - 2 * Math.PI * t;
        return [cx2 + r * Math.cos(th), cy2 + r * Math.sin(th), Math.sin(th), -Math.cos(th)];
      }
    };
  }
  const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-9;
  const b = e.bend || 0;
  if (Math.abs(b) < 0.02) return { len: d, at: (t) => [A.x + dx * t, A.y + dy * t, dx / d, dy / d] };
  const h = d / 2, s = b * h, R = (h * h + s * s) / (2 * Math.abs(s));
  const nx = -dy / d, ny = dx / d, off = s - Math.sign(s) * R;
  const cx = (A.x + B.x) / 2 + nx * off, cy = (A.y + B.y) / 2 + ny * off;
  const th0 = Math.atan2(A.y - cy, A.x - cx), th1 = Math.atan2(B.y - cy, B.x - cx);
  let sw = th1 - th0;
  if (s > 0) {
    while (sw >= 0) sw -= 2 * Math.PI;
    while (sw < -2 * Math.PI) sw += 2 * Math.PI;
  } else {
    while (sw <= 0) sw += 2 * Math.PI;
    while (sw > 2 * Math.PI) sw -= 2 * Math.PI;
  }
  const sg = Math.sign(sw);
  return {
    len: R * Math.abs(sw),
    curved: true,
    at: (t) => {
      const th = th0 + sw * t;
      return [cx + R * Math.cos(th), cy + R * Math.sin(th), -sg * Math.sin(th), sg * Math.cos(th)];
    }
  };
}
var part = (g, t0, t1) => ({ len: g.len * (t1 - t0), curved: g.curved, at: (t) => g.at(t0 + (t1 - t0) * t) });
function basePoints(g, off = 0) {
  const n = g.curved ? 72 : 1, pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, y, tx, ty] = g.at(i / n);
    pts.push([x - ty * off, y + tx * off]);
  }
  return pts;
}
function wavePoints(g, off = 0) {
  const k = Math.max(2, Math.round(g.len / HALF)), n = k * 10, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y, tx, ty] = g.at(t), o = AMP * Math.sin(Math.PI * k * t) + off;
    pts.push([x - ty * o, y + tx * o]);
  }
  return pts;
}
function coilPoints(g) {
  const L = g.len, N = Math.max(2, Math.round(L / PITCH)), n = N * 20, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, th = 2 * Math.PI * N * u;
    const q = Math.min(u, 1 - u) * N * 2, w = q >= 1 ? 1 : q * q * (3 - 2 * q);
    const s = u * L - COIL * w * Math.sin(th), o = -COIL * w * Math.cos(th);
    const tc = clamp(s / L, 0, 1), [x, y, tx, ty] = g.at(tc), ex = s - tc * L;
    pts.push([x + tx * ex - ty * o, y + ty * ex + tx * o]);
  }
  return pts;
}
var decoAmp = (t) => t.deco === "wave" ? AMP : t.deco === "wave2" ? AMP + DBL : t.deco === "coil" ? COIL + 0.02 : t.deco === "double" ? DBL : 0;
function vertexMap(m) {
  const V = {};
  for (const v of m.vertices) V[v.id] = v;
  return V;
}
function degrees(m) {
  const d = {};
  for (const v of m.vertices) d[v.id] = 0;
  for (const e of m.edges) {
    d[e.from] = (d[e.from] || 0) + 1;
    d[e.to] = (d[e.to] || 0) + 1;
  }
  return d;
}
var shownKind = (v, deg) => v.kind && v.kind !== "auto" ? v.kind : deg[v.id] >= 3 ? "dot" : "none";
function vertexStep(m, v) {
  if (v.step != null) return v.step;
  let s = Infinity;
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0);
  return isFinite(s) ? s : 0;
}
function maxStep(m) {
  let s = 0;
  for (const e of m.edges) s = Math.max(s, e.step || 0);
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step);
  return s;
}
function legDirections(m, V, v) {
  const dirs = [];
  for (const e of m.edges) {
    if (e.from !== v.id && e.to !== v.id) continue;
    const g = lineGeometry(V, e);
    if (!g) continue;
    if (e.from === v.id) {
      const [, , tx, ty] = g.at(0.01);
      dirs.push([tx, ty]);
    }
    if (e.to === v.id) {
      const [, , tx, ty] = g.at(0.99);
      dirs.push([-tx, -ty]);
    }
  }
  return dirs;
}
function labelDirection(m, V, v) {
  if (LABEL_AT[v.labelAt]) return LABEL_AT[v.labelAt];
  const dirs = legDirections(m, V, v);
  if (!dirs.length) return [0, 1];
  let sx = 0, sy = 0;
  for (const d of dirs) {
    sx += d[0];
    sy += d[1];
  }
  const sl = Math.hypot(sx, sy);
  if (dirs.length === 1) return [-sx / sl, -sy / sl];
  let best = [0, 1], score = -Infinity;
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8, c = [Math.cos(a), Math.sin(a)];
    let gap = Infinity;
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp(c[0] * d[0] + c[1] * d[1], -1, 1)));
    const sc = gap + (sl > 0.2 ? 0.25 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + 0.06 * c[1];
    if (sc > score) {
      score = sc;
      best = c;
    }
  }
  return best;
}
function drawDiagram(m, o = {}) {
  const u = o.U || UNIT, k = u / 64, V = vertexMap(m), deg = degrees(m);
  const lw = o.lw || 2.2, fs = LABEL * u;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const stepped = deck == null && o.step != null;
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const P = (pts, measure = true) => {
    let d = "";
    pts.forEach((p, i) => {
      const X = p[0] * u, Y = -p[1] * u;
      if (measure) grow(X, Y, lw);
      d += (i ? "L" : "M") + n12(X) + " " + n12(Y);
    });
    return d;
  };
  const stroke = (d, ink, extra = "", w = lw) => `<path d="${d}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  const label = (tex, X, Y, size, ink) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc2(tex)}" style="font-family:${esc2(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n12(X - w / 2)}" y="${n12(Y - h / 2)}" width="${n12(w)}" height="${n12(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n12(size / 1.21)}px;color:${esc2(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  const visible = (s) => !stepped || s <= o.step;
  const wrap = (s, lines, labels, revealPts, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? " pxfx-v" : ""}`;
      if (s > 0 && revealPts) {
        const mid = `pxfxm-${deck}-${id}`;
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${P(revealPts, false)}" fill="none" stroke="#fff" stroke-width="${n12(40 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`;
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`;
    }
    const faded = stepped && o.dim && o.step > 0 && s < o.step;
    return `<g${faded ? ' opacity=".34"' : ""}>${lines}${labels}</g>`;
  };
  let out = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    out += `<defs><pattern id="pxfx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc2(o.mark)}" fill-opacity=".5"/></pattern><pattern id="pxfx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.7" fill="${esc2(o.mark)}" fill-opacity=".75"/></pattern></defs><rect x="${n12(gx)}" y="${n12(gy)}" width="${n12(v.w * u)}" height="${n12(v.h * u)}" fill="url(#pxfx-g1)"/><rect x="${n12(gx)}" y="${n12(gy)}" width="${n12(v.w * u)}" height="${n12(v.h * u)}" fill="url(#pxfx-g2)"/>`;
  }
  for (const e of m.edges) {
    const g0 = lineGeometry(V, e);
    if (!g0) continue;
    const s = e.step || 0;
    if (!visible(s)) continue;
    const t = FEYNMAN_TYPES[e.particle] || FEYNMAN_TYPES.plain;
    const ink = e.color || o.ink || "#ffffff";
    const loop = e.from === e.to;
    const trim = (id) => (KIND_R[shownKind(V[id], deg)] || 0) / g0.len;
    const t0 = loop ? 0 : Math.min(0.45, trim(e.from)), t1 = loop ? 1 : 1 - Math.min(0.45, trim(e.to));
    const g = t0 > 0 || t1 < 1 ? part(g0, t0, t1) : g0;
    let lines = "";
    if (o.editor && o.sel && o.sel.kind === "e" && o.sel.id === e.id) lines += `<path d="${P(basePoints(g0))}" fill="none" stroke="${esc2(o.accent)}" stroke-opacity=".32" stroke-width="${n12(14 * k)}" stroke-linecap="round"/>`;
    if (t.deco === "wave") lines += stroke(P(wavePoints(g)), ink);
    else if (t.deco === "wave2") lines += stroke(P(wavePoints(g, DBL)), ink) + stroke(P(wavePoints(g, -DBL)), ink);
    else if (t.deco === "coil") lines += stroke(P(coilPoints(g)), ink);
    else if (t.deco === "double") lines += stroke(P(basePoints(g, DBL)), ink, "", lw * 0.8) + stroke(P(basePoints(g, -DBL)), ink, "", lw * 0.8);
    else if (t.dash === "dot") lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="0.1 ${n12(6 * k)}"`, lw * 1.45);
    else if (t.dash) lines += stroke(P(basePoints(g)), ink, ` stroke-dasharray="${t.dash.split(" ").map((x) => n12(x * k)).join(" ")}"`);
    else lines += stroke(P(basePoints(g)), ink);
    if (t.arrow) {
      const [x, y, tx, ty] = g.at(0.5), X = x * u, Y = -y * u;
      const dx = tx * t.arrow, dy = -ty * t.arrow, nx = -dy, ny = dx, aL = 7.5 * k, aW = 5.4 * k;
      lines += `<path d="M${n12(X + dx * aL)} ${n12(Y + dy * aL)}L${n12(X - dx * aL * 0.75 + nx * aW)} ${n12(Y - dy * aL * 0.75 + ny * aW)}L${n12(X - dx * aL * 0.75 - nx * aW)} ${n12(Y - dy * aL * 0.75 - ny * aW)}Z" fill="${esc2(ink)}"/>`;
    }
    let labels = "";
    const amp = decoAmp(t), ms = e.momentumSide || -1, ls = e.labelSide || 1;
    if (e.momentum) {
      const off = amp + 0.2, pts = [];
      for (let i = 0; i <= 18; i++) {
        const [x2, y2, tx2, ty2] = g.at(0.3 + 0.4 * i / 18);
        pts.push([x2 - ty2 * off * ms, y2 + tx2 * off * ms]);
      }
      if (e.momentumReverse) pts.reverse();
      const a = pts[pts.length - 2], b = pts[pts.length - 1];
      const hx = (b[0] - a[0]) * u, hy = -(b[1] - a[1]) * u, hl = Math.hypot(hx, hy) || 1, ux = hx / hl, uy = hy / hl;
      const BX = b[0] * u, BY = -b[1] * u, hs = 6 * k;
      labels += stroke(P(pts), ink, "", 1.4 * k);
      labels += `<path d="M${n12(BX - ux * hs - uy * hs * 0.6)} ${n12(BY - uy * hs + ux * hs * 0.6)}L${n12(BX)} ${n12(BY)}L${n12(BX - ux * hs + uy * hs * 0.6)} ${n12(BY - uy * hs - ux * hs * 0.6)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.4 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ms, nY = tx * ms;
      const bx = texBox(e.momentum, fs * 0.85), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u;
      const L = off + 0.1 + ext;
      labels += label(e.momentum, (x + nX * L) * u, -(y + nY * L) * u, fs * 0.85, ink);
    }
    if (e.label) {
      const [x, y, tx, ty] = g.at(0.5), nX = -ty * ls, nY = tx * ls;
      const bx = texBox(e.label, fs), ext = (Math.abs(nX) * bx.w / 2 + Math.abs(nY) * bx.h / 2) / u;
      const L = amp + 0.13 + ext + (e.momentum && ms === ls ? 0.5 : 0);
      labels += label(e.label, (x + nX * L) * u, -(y + nY * L) * u, fs, ink);
    }
    if (o.editor) labels += `<path class="pxfx-hit" data-e="${esc2(e.id)}" d="${P(basePoints(g0), false)}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="${n12(16 * k)}" pointer-events="stroke"/>`;
    out += wrap(s, lines, labels, basePoints(g0), false, e.id);
  }
  const warn = new Set(o.warn || []);
  for (const v of m.vertices) {
    const s = vertexStep(m, v);
    if (!visible(s)) continue;
    const kind = shownKind(v, deg), ink = v.color || o.ink || "#ffffff", X = v.x * u, Y = -v.y * u;
    let mark = "";
    if (kind === "dot") {
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(4.3 * k)}" fill="${esc2(ink)}"/>`;
      grow(X, Y, 4.3 * k);
    } else if (kind === "empty") {
      const r = KIND_R.empty * u;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.8 * k)}"/>`;
      grow(X, Y, r);
    } else if (kind === "square") {
      mark += `<rect x="${n12(X - 4.6 * k)}" y="${n12(Y - 4.6 * k)}" width="${n12(9.2 * k)}" height="${n12(9.2 * k)}" fill="${esc2(ink)}"/>`;
      grow(X, Y, 4.6 * k);
    } else if (kind === "crossed") {
      const r = KIND_R.crossed * u, c = r * 0.7;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="none" stroke="${esc2(ink)}" stroke-width="${n12(1.8 * k)}"/><path d="M${n12(X - c)} ${n12(Y - c)}L${n12(X + c)} ${n12(Y + c)}M${n12(X - c)} ${n12(Y + c)}L${n12(X + c)} ${n12(Y - c)}" stroke="${esc2(ink)}" stroke-width="${n12(1.6 * k)}"/>`;
      grow(X, Y, r);
    } else if (kind === "blob") {
      const r = KIND_R.blob * u;
      mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(r)}" fill="${esc2(ink)}" fill-opacity=".22" stroke="${esc2(ink)}" stroke-width="${n12(2 * k)}"/>`;
      grow(X, Y, r);
    } else if (o.editor) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="3" fill="none" stroke="${esc2(o.mark)}" stroke-width="1.2"/>`;
    let labels = "";
    if (v.label) {
      const d = labelDirection(m, V, v);
      const bx = texBox(v.label, fs), ext = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u;
      const L = (KIND_R[kind] || (kind === "none" ? 0 : 0.07)) + 0.12 + ext;
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs, ink);
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(13 * k)}" fill="none" stroke="${esc2(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Fermion arrows don’t flow through this vertex</title></circle>`;
      if (o.sel && o.sel.kind === "v" && o.sel.id === v.id) mark += `<circle cx="${n12(X)}" cy="${n12(Y)}" r="${n12(10 * k)}" fill="${esc2(o.accent)}" fill-opacity=".22" stroke="${esc2(o.accent)}" stroke-width="2"/>`;
      labels += `<circle data-v="${esc2(v.id)}" cx="${n12(X)}" cy="${n12(Y)}" r="${n12(12 * k)}" fill="#000" fill-opacity="0"/>`;
    }
    out += wrap(s, mark, labels, null, true, v.id);
  }
  if (o.editor && o.sel && o.sel.kind === "e") {
    const e = m.edges.find((x) => x.id === o.sel.id), g = e && lineGeometry(V, e);
    if (g) {
      const [x, y] = g.at(0.5), loop = e.from === e.to;
      out += `<circle data-h="${loop ? "loop" : "bend"}" cx="${n12(x * u)}" cy="${n12(-y * u)}" r="${n12(6.5 * k)}" fill="${esc2(o.accent)}" stroke="#fff" stroke-width="2"><title>${loop ? "Drag to turn and resize the loop" : "Drag to bend the line"}</title></circle>`;
    }
  }
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n12(cx)}" y="${n12(y + cs)}" text-anchor="middle" font-size="${n12(cs)}" fill="${esc2(o.ink || "#ffffff")}">${esc2(text)}</text>`;
      return `<foreignObject${cls} x="${n12(cx - w / 2)}" y="${n12(y)}" width="${n12(w)}" height="${n12(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n12(cs)}px;line-height:1.3;color:${esc2(o.ink || "#ffffff")}">${esc2(text)}</div></foreignObject>`;
    };
    if (deck != null) out += capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const cur = stepped ? o.step : maxStep(m);
      const shown = capSteps.filter((n) => n <= cur).pop();
      if (shown != null) out += one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 5 * u, y1: 2.5 * u });
  return { svg: out, box };
}
function feynmanBox(el) {
  const { box } = drawDiagram(feynmanModel(el), { captions: true });
  const pad = 0.18 * UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function feynmanSvg(el, opts = {}) {
  const m = feynmanModel(el);
  const b = feynmanBox(el);
  const { svg } = drawDiagram(m, { ink: m.color, labels: opts.labels || "text", captions: true, deck: opts.deck, step: opts.step, dim: m.dimPast });
  const size = opts.standalone ? ` width="${n12(b.w)}" height="${n12(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n12(b.x)} ${n12(b.y)} ${n12(b.w)} ${n12(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function feynmanSteps(el) {
  if (el?.type !== "feynman") return [];
  const m = feynmanModel(el), steps = /* @__PURE__ */ new Set();
  for (const e of m.edges) if (e.step > 0) steps.add(e.step);
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step);
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n);
  return [...steps].sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function feynmanStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of feynmanSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasFeynman(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "feynman"));
}
function template(key, name, verts, edges, captions) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, label]) => ({ id, x, y, kind: "auto", label: label || "", labelAt: "auto", color: null, step: null })),
      edges: edges.map(([from, to, particle, opts], i) => ({ id: "e" + (i + 1), from, to, particle, bend: 0, label: "", labelSide: 1, momentum: "", momentumSide: -1, momentumReverse: false, color: null, step: 0, ...opts || {} })),
      captions: { ...captions || {} }
    };
  } };
}
var FEYNMAN_TEMPLATES = [
  template(
    "ee",
    "e⁺e⁻ → μ⁺μ⁻",
    [["i1", 0, 2, "e^-"], ["i2", 0, 0, "e^+"], ["a", 1.5, 1], ["b", 3.6, 1], ["f1", 5.1, 2, "\\mu^-"], ["f2", 5.1, 0, "\\mu^+"]],
    [["i1", "a", "fermion", { step: 1 }], ["a", "i2", "fermion", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", momentum: "q", step: 2 }], ["b", "f1", "fermion", { step: 3 }], ["f2", "b", "fermion", { step: 3 }]],
    { 1: "An electron and a positron annihilate", 2: "into a virtual photon,", 3: "which makes a muon pair." }
  ),
  template(
    "ggf",
    "Gluon fusion to a Higgs",
    [["g1", 0, 2.6, "g"], ["g2", 0, -0.6, "g"], ["a", 2, 2], ["b", 2, 0], ["c", 3.6, 1], ["h", 5.6, 1, "H"]],
    [["g1", "a", "gluon", { step: 1 }], ["g2", "b", "gluon", { step: 1 }], ["a", "c", "fermion", { label: "t", step: 2 }], ["c", "b", "fermion", { step: 2 }], ["b", "a", "fermion", { step: 2 }], ["c", "h", "scalar", { step: 3 }]],
    { 1: "Two gluons, one from each proton,", 2: "fuse through a loop of top quarks", 3: "and make a Higgs boson." }
  ),
  template(
    "compton",
    "Compton scattering",
    [["i", 0, 0, "e^-"], ["a", 1.6, 0], ["b", 3.4, 0], ["f", 5, 0, "e^-"], ["g1", 0.2, 1.8, "\\gamma"], ["g2", 4.8, 1.8, "\\gamma"]],
    [["i", "a", "fermion", { step: 1 }], ["g1", "a", "photon", { step: 1 }], ["a", "b", "fermion", { label: "e^-", labelSide: -1, step: 2 }], ["b", "f", "fermion", { step: 3 }], ["b", "g2", "photon", { step: 3 }]],
    { 1: "An electron absorbs a photon,", 2: "travels as a virtual electron", 3: "and emits a photon." }
  ),
  template(
    "moller",
    "Møller scattering (t-channel)",
    [["i1", 0, 2.6, "e^-"], ["a", 2.4, 2.2], ["f1", 4.8, 2.6, "e^-"], ["i2", 0, -0.4, "e^-"], ["b", 2.4, 0], ["f2", 4.8, -0.4, "e^-"]],
    [["i1", "a", "fermion", { step: 1 }], ["i2", "b", "fermion", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", momentum: "q", step: 2 }], ["a", "f1", "fermion", { step: 3 }], ["b", "f2", "fermion", { step: 3 }]],
    { 1: "Two electrons approach,", 2: "exchange a virtual photon", 3: "and scatter." }
  ),
  template(
    "self",
    "Electron self-energy",
    [["i", 0, 0, "e^-"], ["a", 1.4, 0], ["b", 3.6, 0], ["f", 5, 0, "e^-"]],
    [["i", "a", "fermion", { step: 1 }], ["a", "b", "fermion", { step: 1 }], ["b", "f", "fermion", { step: 1 }], ["a", "b", "photon", { bend: 1, label: "\\gamma", step: 2 }]],
    { 1: "An electron propagates,", 2: "emitting and reabsorbing a virtual photon." }
  ),
  template(
    "vacpol",
    "Vacuum polarization",
    [["i", 0, 1], ["a", 1.6, 1], ["b", 3.4, 1], ["f", 5, 1]],
    [["i", "a", "photon", { label: "\\gamma", step: 1 }], ["a", "b", "fermion", { bend: 1, label: "e^-", step: 2 }], ["b", "a", "fermion", { bend: 1, label: "e^+", step: 2 }], ["b", "f", "photon", { label: "\\gamma", step: 3 }]],
    { 1: "A photon", 2: "briefly becomes an electron–positron pair", 3: "and carries on." }
  ),
  template(
    "vertex",
    "QED vertex correction",
    [["g", 2.5, 3.1, "\\gamma"], ["v", 2.5, 2], ["a", 1.4, 0.9], ["b", 3.6, 0.9], ["i", 0.4, -0.3, "e^-"], ["f", 4.6, -0.3, "e^-"]],
    [["i", "a", "fermion", { step: 1 }], ["a", "v", "fermion", { step: 1 }], ["v", "b", "fermion", { step: 1 }], ["b", "f", "fermion", { step: 1 }], ["g", "v", "photon", { step: 1 }], ["a", "b", "photon", { label: "\\gamma", labelSide: -1, step: 2 }]],
    { 1: "An electron scatters off a photon.", 2: "A virtual photon across the vertex is the one-loop correction behind g − 2." }
  ),
  template(
    "beta",
    "β⁻ decay",
    [["i", 0, 0, "d"], ["v1", 2, 0.5], ["u", 4.8, 0, "u"], ["v2", 3.2, 2.1], ["e", 4.8, 3, "e^-"], ["n", 4.8, 1.4, "\\bar{\\nu}_e"]],
    [["i", "v1", "fermion", { step: 1 }], ["v1", "u", "fermion", { step: 1 }], ["v1", "v2", "photon", { label: "W^-", step: 2 }], ["v2", "e", "fermion", { step: 3 }], ["v2", "n", "antifermion", { step: 3 }]],
    { 1: "A down quark turns into an up quark", 2: "by emitting a virtual W⁻,", 3: "which decays to an electron and an electron antineutrino." }
  ),
  { key: "blank", name: "Blank", build: () => ({ vertices: [], edges: [], captions: {} }) }
];

// client/src/utils/circuitParts.js
var CIRCUIT_PARTS = {
  wire: { name: "Wire", key: "w", kind: "short" },
  resistor: { name: "Resistor", key: "r", tikz: "R", kind: "R", unit: "Ω", dflt: 100, chips: ["R", "R_1", "R_2"] },
  capacitor: { name: "Capacitor", key: "c", tikz: "C", kind: "open", unit: "F", dflt: 1e-6, chips: ["C", "C_1"] },
  inductor: { name: "Inductor", key: "l", tikz: "L", kind: "short", unit: "H", dflt: 1e-3, chips: ["L", "L_1"] },
  battery: { name: "Battery", key: "b", tikz: "battery1", kind: "V", unit: "V", dflt: 9, polar: true, chips: ["\\mathcal{E}", "V_0"] },
  vsource: { name: "DC source", key: "e", tikz: "V", kind: "V", unit: "V", dflt: 5, polar: true, chips: ["V_s", "V_1"] },
  acsource: { name: "AC source", tikz: "sV", kind: "V0", unit: "V", dflt: 10, polar: true, chips: ["V_0", "v(t)"] },
  isource: { name: "Current source", key: "i", tikz: "I", kind: "I", unit: "A", dflt: 0.01, polar: true, chips: ["I_s", "I_0"] },
  switch: { name: "Switch", key: "s", tikz: "nos", kind: "switch", chips: ["S", "S_1"] },
  diode: { name: "Diode", key: "d", tikz: "D", kind: "diode", polar: true, chips: ["D", "D_1"] },
  lamp: { name: "Lamp", key: "x", tikz: "lamp", kind: "R", unit: "Ω", dflt: 12, chips: ["B", "B_1"] },
  ammeter: { name: "Ammeter", key: "a", tikz: "ammeter", kind: "short", meter: "A", chips: ["A"] },
  voltmeter: { name: "Voltmeter", key: "m", tikz: "voltmeter", kind: "open", meter: "V", chips: ["V"] }
};
var CIRCUIT_VERTEX_KINDS = [["auto", "Auto"], ["none", "None"], ["dot", "Dot"], ["terminal", "Terminal"]];
var GROUND_DIRS = { down: 0, left: 90, up: 180, right: -90 };
var PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, "µ": 1e-6, "μ": 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
function parseValue(s) {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([pnuµμmkMG])?/.exec(String(s ?? ""));
  return m ? parseFloat(m[1]) * (m[2] ? PREFIX[m[2]] : 1) : null;
}
function formatSI(v, unit) {
  if (v == null || !isFinite(v)) return "";
  const a = Math.abs(v);
  if (a < 1e-13) return `0 ${unit}`;
  const steps = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"]];
  let pick2 = steps[steps.length - 1];
  for (const s of steps) if (a >= s[0] * 0.9995) {
    pick2 = s;
    break;
  }
  const num8 = v / pick2[0];
  const str7 = Math.abs(num8) >= 99.95 ? String(Math.round(num8)) : String(Number(num8.toPrecision(3)));
  return `${str7} ${pick2[1]}${unit}`;
}
var valueOf = (e) => {
  const v = parseValue(e.value);
  return v == null ? CIRCUIT_PARTS[e.part].dflt ?? 0 : v;
};
var closedAt = (e, step) => !!e.closed !== (e.flipAt != null && step >= e.flipAt);
var isShort = (e, step) => CIRCUIT_PARTS[e.part].kind === "short" || e.part === "switch" && closedAt(e, step);
var ID2 = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR3 = /^#[0-9a-f]{6}$/i;
var LABEL_AT2 = ["above", "below", "left", "right"];
var num4 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
var int3 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
var str3 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function circuitModel(el) {
  const vertices = [], edges = [], ids = /* @__PURE__ */ new Set(), edgeIds = /* @__PURE__ */ new Set();
  for (const v of Array.isArray(el?.vertices) ? el.vertices.slice(0, 500) : []) {
    if (!v || !ID2.test(v.id) || ids.has(v.id)) continue;
    ids.add(v.id);
    vertices.push({
      id: v.id,
      x: num4(v.x, -1e3, 1e3, 0),
      y: num4(v.y, -1e3, 1e3, 0),
      kind: CIRCUIT_VERTEX_KINDS.some(([k]) => k === v.kind) ? v.kind : "auto",
      ground: GROUND_DIRS[v.ground] !== void 0 ? v.ground : null,
      label: str3(v.label, 200),
      labelAt: LABEL_AT2.includes(v.labelAt) ? v.labelAt : "auto",
      step: v.step == null ? null : int3(v.step, 0, 1e3, null)
    });
  }
  for (const e of Array.isArray(el?.edges) ? el.edges.slice(0, 1e3) : []) {
    if (!e || !ID2.test(e.id) || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    edgeIds.add(e.id);
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      part: CIRCUIT_PARTS[e.part] ? e.part : "wire",
      label: str3(e.label, 200),
      value: str3(e.value, 40),
      flip: !!e.flip,
      current: str3(e.current, 200),
      voltage: str3(e.voltage, 200),
      closed: !!e.closed,
      flipAt: e.flipAt == null ? null : int3(e.flipAt, 1, 1e3, null),
      step: int3(e.step, 0, 1e3, 0)
    });
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    vertices,
    edges,
    captions,
    color: COLOR3.test(el?.color || "") ? el.color : "#ffffff",
    symbols: el?.symbols === "iec" ? "iec" : "us",
    flow: el?.flow !== false,
    readings: el?.readings !== false,
    stepStart: int3(el?.stepStart, 1, 1e3, 1),
    // Off unless chosen: the current runs through what came before too
    dimPast: !!el?.dimPast
  };
}

// client/src/utils/circuitSolve.js
var VF = 0.7;
var GON = 1e3;
var LEAK = 1e-12;
function gauss(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-14) return null;
    if (p !== c) {
      [A[c], A[p]] = [A[p], A[c]];
      [b[c], b[p]] = [b[p], b[c]];
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}
function solveCircuit(m, step = Infinity) {
  const edges = m.edges.filter((e) => (e.step || 0) <= step && e.from !== e.to && CIRCUIT_PARTS[e.part]);
  if (!edges.length) return { status: "empty" };
  const kind = (e) => CIRCUIT_PARTS[e.part].kind;
  const ids = /* @__PURE__ */ new Set();
  for (const e of edges) {
    ids.add(e.from);
    ids.add(e.to);
  }
  const grounded = m.vertices.filter((v) => v.ground && ids.has(v.id)).map((v) => v.id);
  const GND = ":ground";
  const parent2 = { [GND]: GND };
  for (const id of ids) parent2[id] = id;
  const find = (a) => {
    while (parent2[a] !== a) {
      parent2[a] = parent2[parent2[a]];
      a = parent2[a];
    }
    return a;
  };
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent2[a] = b;
  };
  const shorts = [];
  for (const e of edges) if (isShort(e, step)) {
    unite(e.from, e.to);
    shorts.push([e.from, e.to, e.id]);
  }
  for (const g of grounded) {
    unite(g, GND);
    shorts.push([g, GND, null]);
  }
  const sources = edges.filter((e) => ["V", "V0", "I"].includes(kind(e)));
  if (!sources.length) return { status: "nosource" };
  const vsrc = edges.filter((e) => kind(e) === "V" || kind(e) === "V0");
  for (const e of vsrc) if (find(e.from) === find(e.to)) return { status: "shorted", id: e.id };
  const ref = grounded.length ? find(GND) : find(sources[0].from);
  const nodeOf = {};
  let N = 0;
  for (const id of [...ids, GND]) {
    const r = find(id);
    if (r !== ref && nodeOf[r] == null) nodeOf[r] = N++;
  }
  const ix = (id) => {
    const r = find(id);
    return r === ref ? -1 : nodeOf[r];
  };
  const S = N + vsrc.length;
  const diodes = edges.filter((e) => kind(e) === "diode");
  const on = new Map(diodes.map((d) => [d.id, true]));
  let x = null;
  const volt = (id) => {
    const i = ix(id);
    return i < 0 ? 0 : x[i];
  };
  for (let iter = 0; iter < 30; iter++) {
    const A = Array.from({ length: S }, () => new Float64Array(S)), z = new Float64Array(S);
    const conductance = (a, b, g) => {
      if (a >= 0) A[a][a] += g;
      if (b >= 0) A[b][b] += g;
      if (a >= 0 && b >= 0) {
        A[a][b] -= g;
        A[b][a] -= g;
      }
    };
    for (let i = 0; i < N; i++) A[i][i] += LEAK;
    for (const e of edges) {
      const a = ix(e.from), b = ix(e.to);
      if (kind(e) === "R") conductance(a, b, 1 / Math.max(1e-6, valueOf(e)));
      else if (kind(e) === "diode" && on.get(e.id)) {
        conductance(a, b, GON);
        if (a >= 0) z[a] += GON * VF;
        if (b >= 0) z[b] -= GON * VF;
      } else if (kind(e) === "I") {
        const I2 = valueOf(e);
        if (a >= 0) z[a] -= I2;
        if (b >= 0) z[b] += I2;
      }
    }
    vsrc.forEach((e, k) => {
      const p = ix(e.to), n = ix(e.from), r = N + k;
      if (p >= 0) {
        A[p][r] += 1;
        A[r][p] += 1;
      }
      if (n >= 0) {
        A[n][r] -= 1;
        A[r][n] -= 1;
      }
      z[r] = kind(e) === "V0" ? 0 : valueOf(e);
    });
    x = gauss(A, z);
    if (!x) return { status: "conflict" };
    let changed = false;
    for (const d of diodes) {
      const dv = volt(d.from) - volt(d.to);
      if (on.get(d.id) && GON * (dv - VF) < -1e-9) {
        on.set(d.id, false);
        changed = true;
      } else if (!on.get(d.id) && dv > VF + 1e-6) {
        on.set(d.id, true);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const V = {}, I = {}, P = {}, inj = {};
  for (const id of ids) V[id] = volt(id);
  for (const e of edges) {
    if (isShort(e, step)) continue;
    const dv = volt(e.from) - volt(e.to);
    let c = 0;
    if (kind(e) === "R") {
      const R = Math.max(1e-6, valueOf(e));
      c = dv / R;
      P[e.id] = c * c * R;
    } else if (kind(e) === "diode") c = on.get(e.id) ? GON * (dv - VF) : 0;
    else if (kind(e) === "I") c = valueOf(e);
    else if (kind(e) === "V" || kind(e) === "V0") c = -x[N + vsrc.indexOf(e)];
    I[e.id] = c;
    inj[e.from] = (inj[e.from] || 0) - c;
    inj[e.to] = (inj[e.to] || 0) + c;
  }
  const adj = {};
  for (const [a, b, id] of shorts) {
    (adj[a] = adj[a] || []).push([b, id, 1]);
    (adj[b] = adj[b] || []).push([a, id, -1]);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const [start] of shorts) {
    if (seen.has(start)) continue;
    const order = [start], via = { [start]: null };
    seen.add(start);
    for (let q = 0; q < order.length; q++) {
      for (const [next, id, dir] of adj[order[q]] || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        order.push(next);
        via[next] = [order[q], id, dir];
      }
    }
    const beyond = {};
    for (let q = order.length - 1; q >= 0; q--) {
      const node = order[q];
      beyond[node] = (beyond[node] || 0) + (inj[node] || 0);
      if (!via[node]) continue;
      const [toward, id, dir] = via[node];
      if (id) I[id] = dir === 1 ? -beyond[node] : beyond[node];
      beyond[toward] = (beyond[toward] || 0) + beyond[node];
    }
  }
  for (const e of edges) if (I[e.id] == null || Math.abs(I[e.id]) < 1e-9) I[e.id] = 0;
  const maxI = Math.max(0, ...edges.map((e) => Math.abs(I[e.id])));
  return { status: maxI < 1e-9 ? "still" : "ok", V, I, P, maxI };
}

// client/src/utils/circuitDiagram.js
var CIRCUIT_UNIT = 48;
var BODY = 1;
var LW = 2;
var LABEL2 = 0.34;
var CAPTION2 = 0.3;
var DIRS = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0] };
var esc3 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n13 = (v) => String(Math.round(v * 10) / 10);
var n2 = (v) => String(Math.round(v * 100) / 100);
var clamp2 = (v, a, b) => Math.min(b, Math.max(a, v));
function flowColorFor(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || "");
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140;
  return light ? "#ffbf47" : "#c26a00";
}
function vertexMap2(m) {
  const V = {};
  for (const v of m.vertices) V[v.id] = v;
  return V;
}
var shownAt = (s, step) => step == null || s <= step;
function connections(m, step = null) {
  const d = {};
  for (const v of m.vertices) d[v.id] = v.ground ? 1 : 0;
  for (const e of m.edges) if (shownAt(e.step || 0, step)) {
    d[e.from] = (d[e.from] || 0) + 1;
    d[e.to] = (d[e.to] || 0) + 1;
  }
  return d;
}
var shownKind2 = (v, conn) => v.kind && v.kind !== "auto" ? v.kind : conn[v.id] >= 3 ? "dot" : "none";
function vertexStep2(m, v) {
  if (v.step != null) return v.step;
  let s = Infinity;
  for (const e of m.edges) if (e.from === v.id || e.to === v.id) s = Math.min(s, e.step || 0);
  return isFinite(s) ? s : 0;
}
function maxStep2(m) {
  let s = 0;
  for (const e of m.edges) {
    s = Math.max(s, e.step || 0);
    if (e.part === "switch" && e.flipAt != null) s = Math.max(s, e.flipAt);
  }
  for (const v of m.vertices) if (v.step != null) s = Math.max(s, v.step);
  return s;
}
function partShape(part2, len2, u, k, lw, ink, style) {
  const L = (x1, y1, x2, y2, w = lw) => `<path d="M${n13(x1)} ${n13(y1)}L${n13(x2)} ${n13(y2)}" stroke="${esc3(ink)}" stroke-width="${n13(w)}" stroke-linecap="round" fill="none"/>`;
  const circ = (cx, r) => `<circle cx="${n13(cx)}" cy="0" r="${n13(r)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
  const b = part2 === "wire" ? 0 : Math.max(Math.min(BODY * u, len2 - 0.3 * u), Math.min(len2 * 0.7, 0.5 * u));
  const a = (len2 - b) / 2, c = len2 / 2;
  const leads = () => L(0, 0, a, 0) + L(a + b, 0, len2, 0);
  const out = { body: "", ext: [0.06 * u, 0.06 * u], glyphs: [], a, b };
  if (part2 === "wire") {
    out.body = L(0, 0, len2, 0);
    out.ext = [0.04 * u, 0.04 * u];
  } else if (part2 === "resistor") {
    if (style === "iec") out.body = leads() + `<rect x="${n13(a)}" y="${n13(-0.14 * u)}" width="${n13(b)}" height="${n13(0.28 * u)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
    else {
      const h = 0.16 * u;
      let d = `M${n13(a)} 0`;
      for (let i = 0; i < 6; i++) d += `L${n13(a + (2 * i + 1) * b / 12)} ${n13(i % 2 ? h : -h)}`;
      out.body = leads() + `<path d="${d}L${n13(a + b)} 0" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linejoin="round"/>`;
    }
    out.ext = [0.17 * u, 0.17 * u];
  } else if (part2 === "capacitor") {
    const g = 0.08 * u, p = 0.3 * u;
    out.body = L(0, 0, c - g, 0) + L(c + g, 0, len2, 0) + L(c - g, -p, c - g, p, lw * 1.4) + L(c + g, -p, c + g, p, lw * 1.4);
    out.ext = [p, p];
  } else if (part2 === "inductor") {
    if (style === "iec") {
      out.body = leads() + `<rect x="${n13(a)}" y="${n13(-0.11 * u)}" width="${n13(b)}" height="${n13(0.22 * u)}" fill="${esc3(ink)}"/>`;
      out.ext = [0.12 * u, 0.12 * u];
    } else {
      const r = b / 8;
      let d = `M${n13(a)} 0`;
      for (let i = 0; i < 4; i++) d += `A${n13(r)} ${n13(r)} 0 0 1 ${n13(a + (i + 1) * 2 * r)} 0`;
      out.body = leads() + `<path d="${d}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw)}"/>`;
      out.ext = [r + 0.02 * u, 0.04 * u];
    }
  } else if (part2 === "battery") {
    const offs = [-0.27, -0.09, 0.09, 0.27].map((o) => c + o * u);
    out.body = L(0, 0, offs[0], 0) + L(offs[3], 0, len2, 0) + offs.map((x, i) => i % 2 ? L(x, -0.32 * u, x, 0.32 * u) : L(x, -0.15 * u, x, 0.15 * u, lw * 2.2)).join("");
    out.glyphs.push([offs[3] + 0.16 * u, -0.34 * u, "+", 0.3 * u]);
    out.ext = [0.34 * u, 0.33 * u];
  } else if (["vsource", "acsource", "isource", "ammeter", "voltmeter", "lamp"].includes(part2)) {
    const r = 0.3 * u;
    out.body = L(0, 0, c - r, 0) + L(c + r, 0, len2, 0) + circ(c, r);
    out.ext = [r, r];
    if (part2 === "vsource") {
      if (style === "iec") out.body += L(c - r, 0, c + r, 0);
      else {
        out.glyphs.push([c + 0.15 * u, 0, "+", 0.26 * u]);
        out.glyphs.push([c - 0.15 * u, 0, "−", 0.26 * u]);
      }
    } else if (part2 === "acsource") {
      let d = "";
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        d += `${i ? "L" : "M"}${n13(c - 0.17 * u + t * 0.34 * u)} ${n13(-0.1 * u * Math.sin(2 * Math.PI * t))}`;
      }
      out.body += `<path d="${d}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.85)}"/>`;
    } else if (part2 === "isource") {
      if (style === "iec") out.body += L(c, -r, c, r);
      else out.body += L(c - 0.17 * u, 0, c + 0.08 * u, 0) + `<path d="M${n13(c + 0.19 * u)} 0L${n13(c + 0.05 * u)} ${n13(-0.08 * u)}L${n13(c + 0.05 * u)} ${n13(0.08 * u)}Z" fill="${esc3(ink)}"/>`;
    } else if (part2 === "lamp") {
      const q = 0.21 * u;
      out.body += L(c - q, -q, c + q, q, lw * 0.9) + L(c - q, q, c + q, -q, lw * 0.9);
    } else out.glyphs.push([c, 0, CIRCUIT_PARTS[part2].meter, 0.3 * u, 600]);
  } else if (part2 === "switch") {
    const tr = 0.06 * u, x0 = a, x1 = a + b, ang = 28 * Math.PI / 180;
    const ring = (x) => `<circle cx="${n13(x)}" cy="0" r="${n13(tr)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.8)}"/>`;
    out.body = L(0, 0, x0 - tr, 0) + L(x1 + tr, 0, len2, 0) + ring(x0) + ring(x1);
    out.blade = (closed) => closed ? L(x0, 0, x1, 0) : L(x0, 0, x0 + b * Math.cos(ang), -b * Math.sin(ang));
    out.ext = [b * Math.sin(ang) + 0.04 * u, 0.08 * u];
  } else if (part2 === "diode") {
    const t = 0.2 * u, h = 0.22 * u;
    out.body = L(0, 0, c - t, 0) + L(c + t, 0, len2, 0) + `<path d="M${n13(c - t)} ${n13(-h)}L${n13(c - t)} ${n13(h)}L${n13(c + t)} 0Z" fill="${style === "iec" ? "none" : esc3(ink)}" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linejoin="round"/>` + L(c + t, -h, c + t, h);
    out.ext = [h, h];
  }
  return out;
}
function drawCircuit(m, o = {}) {
  const u = o.U || CIRCUIT_UNIT, k = u / 48, lw = (o.lw || LW) * k, fs = LABEL2 * u;
  const ink = o.ink || "#ffffff", flowColor = o.flowColor || flowColorFor(ink), V = vertexMap2(m);
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const state = step == null ? Infinity : step;
  const conn = connections(m, step);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const label = (tex, X, Y, size) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc3(tex)}" style="font-family:${esc3(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n13(X - w / 2)}" y="${n13(Y - h / 2)}" width="${n13(w)}" height="${n13(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n13(size / 1.21)}px;color:${esc3(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  const plain2 = (t, X, Y, size, color2 = ink, weight = 400) => {
    grow(X, Y, Math.max(String(t).length * size * 0.5, size * 0.4) / 2, size * 0.55);
    return `<text x="${n13(X)}" y="${n13(Y + size * 0.34)}" text-anchor="middle" font-family="${esc3(MATH_FONT)}" font-size="${n13(size)}" font-weight="${weight}" fill="${esc3(color2)}">${esc3(t)}</text>`;
  };
  const wrap = (s, lines, labels, reveal, isVertex, id) => {
    if (deck != null) {
      const cls = `pxfx-part${isVertex ? " pxfx-v" : ""}`;
      if (s > 0 && reveal) {
        const mid = `pxfxm-${deck}-${id}`;
        return `<g class="${cls}" data-fx-at="${s}"><mask id="${mid}" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><path class="pxfx-reveal" pathLength="1" d="${reveal}" fill="none" stroke="#fff" stroke-width="${n13(46 * k)}" stroke-linecap="round"/></mask><g mask="url(#${mid})">${lines}</g><g class="pxfx-fade">${labels}</g></g>`;
      }
      return `<g class="${cls}" data-fx-at="${s}">${lines}${labels}</g>`;
    }
    const faded = step != null && o.dim && step > 0 && s < step;
    return `<g${faded ? ' opacity=".34"' : ""}>${lines}${labels}</g>`;
  };
  let grid = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    grid = `<defs><pattern id="pxcx-g1" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1" fill="${esc3(o.mark)}" fill-opacity=".55"/></pattern><pattern id="pxcx-g2" width="${u}" height="${u}" x="${-u / 2}" y="${-u / 2}" patternUnits="userSpaceOnUse"><circle cx="${u / 2}" cy="${u / 2}" r="1.6" fill="${esc3(o.mark)}" fill-opacity=".8"/></pattern></defs><rect x="${n13(gx)}" y="${n13(gy)}" width="${n13(v.w * u)}" height="${n13(v.h * u)}" fill="url(#pxcx-g1)"/><rect x="${n13(gx)}" y="${n13(gy)}" width="${n13(v.w * u)}" height="${n13(v.h * u)}" fill="url(#pxcx-g2)"/>`;
  }
  const warn = new Set(o.warn || []);
  const placed = {};
  let parts = "";
  for (const e of m.edges) {
    const A = V[e.from], B = V[e.to];
    if (!A || !B || A === B) continue;
    const s = e.step || 0;
    if (deck == null && !shownAt(s, step)) continue;
    const P = CIRCUIT_PARTS[e.part] || CIRCUIT_PARTS.wire;
    const X1 = A.x * u, Y1 = -A.y * u, X2 = B.x * u, Y2 = -B.y * u, dx = X2 - X1, dy = Y2 - Y1, len2 = Math.hypot(dx, dy) || 1;
    const ux = dx / len2, uy = dy / len2, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const G2 = (sx, sy) => [X1 + ux * sx - uy * sy, Y1 + uy * sx + ux * sy];
    const sh = partShape(e.part, len2, u, k, lw, ink, o.style);
    let body = sh.body;
    if (sh.blade) {
      if (deck != null && e.flipAt != null) body += `<g data-fx-in="0-${e.flipAt - 1}">${sh.blade(!!e.closed)}</g><g data-fx-in="${e.flipAt}-">${sh.blade(!e.closed)}</g>`;
      else body += sh.blade(closedAt(e, state));
    }
    grow(X1, Y1, lw);
    grow(X2, Y2, lw);
    for (const [gx, gy] of [G2(len2 / 2, -sh.ext[0]), G2(len2 / 2, sh.ext[1])]) grow(gx, gy);
    let lines = "";
    if (o.editor && o.sel && o.sel.kind === "e" && o.sel.id === e.id) lines += `<path d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="${esc3(o.accent)}" stroke-opacity=".3" stroke-width="${n13(16 * k)}" stroke-linecap="round"/>`;
    if (o.editor && warn.has(e.id)) lines += `<path d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="${esc3(o.warnColor)}" stroke-opacity=".45" stroke-width="${n13(16 * k)}" stroke-linecap="round"/>`;
    lines += `<g transform="translate(${n13(X1)} ${n13(Y1)}) rotate(${n13(ang)})">${body}</g>`;
    for (const [gxs, gys, t, size, weight] of sh.glyphs) {
      const [gx, gy] = G2(gxs, gys);
      lines += plain2(t, gx, gy, size, ink, weight || 400);
    }
    let labels = "";
    const side = e.flip ? 1 : -1;
    const place = (sx, sd, gap, bx) => {
      const extPx = sd < 0 ? sh.ext[0] : sh.ext[1], nx = -uy * sd, ny = ux * sd;
      const reach = Math.abs(nx) * bx.w / 2 + Math.abs(ny) * bx.h / 2;
      const [px, py] = G2(sx, sd * (extPx + gap));
      return [px + nx * reach, py + ny * reach, reach * 2];
    };
    if (e.label && e.part !== "wire") {
      const [x, y] = place(len2 / 2, side, 0.12 * u, texBox(e.label, fs));
      labels += label(e.label, x, y, fs);
    }
    let depth = 0;
    const parsed = parseValue(e.value);
    const valueText = P.unit && e.value !== "" ? parsed != null ? formatSI(parsed, P.unit) : e.value : "";
    if (valueText) {
      const bx = { w: Math.max(valueText.length * fs * 0.9 * 0.5, fs * 0.4), h: fs * 0.95 };
      const [x, y, d] = place(len2 / 2, -side, 0.12 * u, bx);
      depth = d;
      labels += plain2(valueText, x, y, fs * 0.9);
    }
    if (e.current) {
      const sx = e.part === "wire" ? len2 * 0.62 : len2 - sh.a / 2, hs = 0.12 * u;
      const [tx, ty] = G2(sx + hs * 0.6, 0), [b1x, b1y] = G2(sx - hs * 0.6, -hs * 0.65), [b2x, b2y] = G2(sx - hs * 0.6, hs * 0.65);
      labels += `<path d="M${n13(tx)} ${n13(ty)}L${n13(b1x)} ${n13(b1y)}L${n13(b2x)} ${n13(b2y)}Z" fill="${esc3(ink)}"/>`;
      const [x, y] = place(sx, side, 0.16 * u, texBox(e.current, fs * 0.85));
      labels += label(e.current, x, y, fs * 0.85);
    }
    if (e.voltage && e.part !== "wire") {
      const inset = Math.max(Math.min(sh.a * 0.5, len2 * 0.2), 0.12 * u), off = -side * (sh.ext[side < 0 ? 1 : 0] + 0.2 * u);
      const [px, py] = G2(inset, off), [qx, qy] = G2(len2 - inset, off);
      labels += plain2("+", px, py, fs * 0.85) + plain2("−", qx, qy, fs * 0.85);
      const [x, y, d] = place(len2 / 2, -side, 0.12 * u + depth, texBox(e.voltage, fs * 0.9));
      depth += d + 0.06 * u;
      labels += label(e.voltage, x, y, fs * 0.9);
    }
    if (o.editor) labels += `<path class="pxcx-hit" data-e="${esc3(e.id)}" d="M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}" stroke="#000" stroke-opacity="0" stroke-width="${n13(18 * k)}" pointer-events="stroke"/>`;
    placed[e.id] = { e, X1, Y1, X2, Y2, len: len2, G: G2, at: s, reading: (text, size) => place(len2 / 2, -side, 0.12 * u + depth, { w: text.length * size * 0.5, h: size * 1.05 }) };
    parts += wrap(s, lines, labels, `M${n13(X1)} ${n13(Y1)}L${n13(X2)} ${n13(Y2)}`, false, e.id);
  }
  let verts = "";
  for (const v of m.vertices) {
    const s = vertexStep2(m, v);
    if (deck == null && !shownAt(s, step)) continue;
    const kind = shownKind2(v, conn), X = v.x * u, Y = -v.y * u;
    let mark = "", labels = "";
    if (v.ground) {
      const g = 0.3 * u;
      mark += `<g transform="translate(${n13(X)} ${n13(Y)}) rotate(${GROUND_DIRS[v.ground] ?? 0})" stroke="${esc3(ink)}" stroke-width="${n13(lw)}" stroke-linecap="round" fill="none"><path d="M0 0V${n13(g)}M${n13(-0.27 * u)} ${n13(g)}H${n13(0.27 * u)}M${n13(-0.17 * u)} ${n13(g + 0.09 * u)}H${n13(0.17 * u)}M${n13(-0.07 * u)} ${n13(g + 0.18 * u)}H${n13(0.07 * u)}"/></g>`;
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[v.ground];
      grow(X + d[0] * 0.48 * u, Y + d[1] * 0.48 * u, 0.27 * u);
    }
    if (kind === "dot") {
      mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(3.4 * k)}" fill="${esc3(ink)}"/>`;
      grow(X, Y, 3.4 * k);
    } else if (kind === "terminal") {
      mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(4.2 * k)}" fill="none" stroke="${esc3(ink)}" stroke-width="${n13(lw * 0.9)}"/>`;
      grow(X, Y, 4.2 * k);
    } else if (o.editor && conn[v.id] <= 2) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="2.6" fill="none" stroke="${esc3(o.mark)}" stroke-width="1.1"/>`;
    if (v.label) {
      let d = DIRS[v.labelAt];
      if (!d) {
        const legs = [];
        for (const e of m.edges) {
          if (deck == null && !shownAt(e.step || 0, step)) continue;
          const other = e.from === v.id ? V[e.to] : e.to === v.id ? V[e.from] : null;
          if (other) {
            const l = Math.hypot(other.x - v.x, other.y - v.y) || 1;
            legs.push([(other.x - v.x) / l, (other.y - v.y) / l]);
          }
        }
        if (v.ground) legs.push({ down: [0, -1], up: [0, 1], left: [-1, 0], right: [1, 0] }[v.ground]);
        d = awayFrom(legs);
      }
      const bx = texBox(v.label, fs), reach = (Math.abs(d[0]) * bx.w / 2 + Math.abs(d[1]) * bx.h / 2) / u, L = 0.16 + reach;
      labels += label(v.label, (v.x + d[0] * L) * u, -(v.y + d[1] * L) * u, fs);
    }
    if (o.editor) {
      if (warn.has(v.id)) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(11 * k)}" fill="none" stroke="${esc3(o.warnColor)}" stroke-width="2" stroke-dasharray="4 3"><title>Connected to nothing</title></circle>`;
      if (o.sel && o.sel.kind === "v" && o.sel.id === v.id) mark += `<circle cx="${n13(X)}" cy="${n13(Y)}" r="${n13(9 * k)}" fill="${esc3(o.accent)}" fill-opacity=".22" stroke="${esc3(o.accent)}" stroke-width="2"/>`;
      labels += `<circle data-v="${esc3(v.id)}" cx="${n13(X)}" cy="${n13(Y)}" r="${n13(11 * k)}" fill="#000" fill-opacity="0"/>`;
    }
    if (mark || labels) verts += wrap(s, mark, labels, null, true, v.id);
  }
  const overlay = (sol, upTo) => {
    let under2 = "", over2 = "";
    if (!sol || sol.status !== "ok" && sol.status !== "still") return { under: under2, over: over2 };
    for (const p of Object.values(placed)) {
      const { e } = p;
      if (upTo != null && p.at > upTo) continue;
      const I = sol.I[e.id];
      if (I == null) continue;
      if (o.flow && e.part === "lamp" && (sol.P[e.id] || 0) > 1e-4) {
        const bright = clamp2(sol.P[e.id] / (sol.P[e.id] + 0.35), 0.25, 1), [cx, cy] = p.G(p.len / 2, 0);
        for (const [r, a] of [[0.72, 0.16], [0.52, 0.24], [0.38, 0.36]]) under2 += `<circle cx="${n13(cx)}" cy="${n13(cy)}" r="${n13(r * u)}" fill="#ffcf6b" fill-opacity="${n2(a * bright)}"/>`;
      }
      if (o.flow && sol.maxI > 0 && Math.abs(I) > Math.max(1e-9, sol.maxI * 2e-3)) {
        const f = 0.25 + 0.75 * Math.abs(I) / sol.maxI;
        const d = I > 0 ? `M${n13(p.X1)} ${n13(p.Y1)}L${n13(p.X2)} ${n13(p.Y2)}` : `M${n13(p.X2)} ${n13(p.Y2)}L${n13(p.X1)} ${n13(p.Y1)}`;
        over2 += `<path class="pxcx-flow" d="${d}" fill="none" stroke="${esc3(flowColor)}" stroke-width="${n13(4.2 * k)}" stroke-linecap="round" stroke-dasharray="0.1 14" style="animation-duration:${(0.42 / f).toFixed(2)}s"/>`;
      }
      const meter = CIRCUIT_PARTS[e.part].meter;
      if (o.readings && meter) {
        const text = meter === "A" ? formatSI(Math.abs(I), "A") : formatSI(Math.abs((sol.V[e.from] || 0) - (sol.V[e.to] || 0)), "V");
        const [x, y] = p.reading(text, fs * 0.92);
        over2 += plain2(text, x, y, fs * 0.92, flowColor, 600);
      }
    }
    return { under: under2, over: over2 };
  };
  let under = "", over = "";
  if (o.flow || o.readings) {
    if (deck != null) {
      for (const run of o.runs || []) {
        const lay = overlay(run.sol, run.from);
        const span = `${run.from}-${run.to ?? ""}`;
        if (lay.under) under += `<g data-fx-in="${span}">${lay.under}</g>`;
        if (lay.over) over += `<g data-fx-in="${span}">${lay.over}</g>`;
      }
    } else ({ under, over } = overlay(o.sol, step));
    if (under) under = `<g pointer-events="none">${under}</g>`;
    if (over) over = `<g pointer-events="none">${over}</g>`;
  }
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION2 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n13(cx)}" y="${n13(y + cs)}" text-anchor="middle" font-size="${n13(cs)}" fill="${esc3(ink)}">${esc3(text)}</text>`;
      return `<foreignObject${cls} x="${n13(cx - w / 2)}" y="${n13(y)}" width="${n13(w)}" height="${n13(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n13(cs)}px;line-height:1.3;color:${esc3(ink)}">${esc3(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const shown = capSteps.filter((n) => n <= (step ?? maxStep2(m))).pop();
      if (shown != null) caps = one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u });
  return { svg: grid + under + parts + verts + over + caps, box };
}
function awayFrom(dirs) {
  if (!dirs.length) return [0, 1];
  let best = [0, 1], score = -Infinity, sx = 0, sy = 0;
  for (const d of dirs) {
    sx += d[0];
    sy += d[1];
  }
  const sl = Math.hypot(sx, sy);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = [Math.round(Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6];
    let gap = Infinity;
    for (const d of dirs) gap = Math.min(gap, Math.acos(clamp2(c[0] * d[0] + c[1] * d[1], -1, 1)));
    const sc = gap + (sl > 0.2 ? 0.3 * (-(sx * c[0] + sy * c[1]) / sl) : 0) + (i % 2 ? -0.05 : 0) + 0.04 * c[1];
    if (sc > score) {
      score = sc;
      best = c;
    }
  }
  return best;
}
function circuitSteps(el) {
  if (el?.type !== "circuit") return [];
  const m = circuitModel(el);
  return modelSteps(m).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function modelSteps(m) {
  const steps = /* @__PURE__ */ new Set();
  for (const e of m.edges) {
    if (e.step > 0) steps.add(e.step);
    if (e.part === "switch" && e.flipAt != null) steps.add(e.flipAt);
  }
  for (const v of m.vertices) if (v.step > 0) steps.add(v.step);
  for (const n of Object.keys(m.captions)) if (+n > 0) steps.add(+n);
  return [...steps].sort((a, b) => a - b);
}
function circuitStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of circuitSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasCircuits(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "circuit"));
}
function solutionRuns(m) {
  const starts = [0, ...modelSteps(m)];
  return starts.map((from, i) => ({ from, to: i + 1 < starts.length ? starts[i + 1] - 1 : null, sol: solveCircuit(m, from) }));
}
var baseOptions = (m) => ({ ink: m.color, style: m.symbols, captions: true, flow: m.flow, readings: m.readings });
function circuitBox(el) {
  const m = circuitModel(el);
  const { box } = drawCircuit(m, { ...baseOptions(m), sol: m.flow || m.readings ? solveCircuit(m) : null });
  const pad = 0.2 * CIRCUIT_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function circuitSvg(el, opts = {}) {
  const m = circuitModel(el), b = circuitBox(el), solved = m.flow || m.readings;
  const o = { ...baseOptions(m), labels: opts.labels || "text" };
  const { svg } = opts.deck != null ? drawCircuit(m, { ...o, deck: opts.deck, runs: solved ? solutionRuns(m) : [] }) : drawCircuit(m, { ...o, step: opts.step ?? null, dim: m.dimPast, sol: solved ? solveCircuit(m, opts.step ?? Infinity) : null });
  const size = opts.standalone ? ` width="${n13(b.w)}" height="${n13(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n13(b.x)} ${n13(b.y)} ${n13(b.w)} ${n13(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function template2(key, name, verts, edges, captions = {}) {
  return { key, name, build() {
    return {
      vertices: verts.map(([id, x, y, more]) => ({ id, x, y, kind: "auto", ground: null, label: "", labelAt: "auto", step: null, ...more || {} })),
      edges: edges.map(([from, to, part2, more], i) => ({ id: "e" + (i + 1), from, to, part: part2, label: "", value: "", flip: false, current: "", voltage: "", closed: false, flipAt: null, step: 0, ...more || {} })),
      captions: { ...captions }
    };
  } };
}
var CIRCUIT_TEMPLATES = [
  template2(
    "lamp",
    "Switch and lamp",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0], ["f", 2.5, 0], ["g", 6.5, 3], ["h", 6.5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "9", step: 1 }],
      ["b", "c", "switch", { label: "S", flipAt: 3, step: 1 }],
      ["c", "d", "resistor", { label: "R", value: "18", step: 1 }],
      ["d", "e", "lamp", { label: "B", value: "12", step: 1 }],
      ["e", "f", "ammeter", { step: 1 }],
      ["f", "a", "wire", { step: 1 }],
      ["d", "g", "wire", { step: 2 }],
      ["g", "h", "voltmeter", { flip: true, step: 2 }],
      ["h", "e", "wire", { step: 2 }]
    ],
    { 1: "A battery, a switch, a resistor and a lamp in series,", 2: "with a voltmeter across the lamp.", 3: "Close the switch: 300 mA flows, and the lamp lights." }
  ),
  template2(
    "parallel",
    "Parallel branches",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 4.5, 3], ["e", 6.5, 3], ["f", 2.5, 0], ["g", 4.5, 0], ["h", 6.5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "6", step: 1 }],
      ["b", "c", "ammeter", { step: 1 }],
      ["c", "f", "resistor", { label: "R_1", value: "10", step: 1 }],
      ["f", "a", "wire", { step: 1 }],
      ["c", "d", "wire", { step: 2 }],
      ["d", "g", "resistor", { label: "R_2", value: "20", step: 2 }],
      ["g", "f", "wire", { step: 2 }],
      ["d", "e", "wire", { step: 3 }],
      ["e", "h", "resistor", { label: "R_3", value: "30", step: 3 }],
      ["h", "g", "wire", { step: 3 }]
    ],
    { 1: "One resistor draws 600 mA.", 2: "A second branch adds 300 mA,", 3: "and a third 200 mA: 1.1 A from the battery." }
  ),
  template2(
    "divider",
    "Voltage divider",
    [["a", 0, 0, { ground: "down" }], ["b", 0, 4], ["c", 3, 4], ["d", 3, 2], ["e", 3, 0], ["o", 5.5, 2, { label: "V_\\mathrm{out}", labelAt: "right" }], ["p", 5.5, 0]],
    [
      ["a", "b", "vsource", { label: "V_s", value: "10" }],
      ["b", "c", "wire"],
      ["c", "d", "resistor", { label: "R_1", value: "1k" }],
      ["d", "e", "resistor", { label: "R_2", value: "2k" }],
      ["e", "a", "wire"],
      ["d", "o", "wire"],
      ["o", "p", "voltmeter"],
      ["p", "e", "wire"]
    ]
  ),
  template2(
    "bridge",
    "Wheatstone bridge",
    [["L", 0, 1.5], ["T", 2, 3.5], ["R", 4, 1.5], ["B", 2, -0.5], ["p", 0, -2], ["q", 4, -2]],
    [
      ["L", "T", "resistor", { label: "R_1", value: "100" }],
      ["T", "R", "resistor", { label: "R_2", value: "200" }],
      ["B", "L", "resistor", { label: "R_3", value: "100" }],
      ["R", "B", "resistor", { label: "R_x", value: "300" }],
      ["T", "B", "ammeter", { label: "G" }],
      ["L", "p", "wire"],
      ["p", "q", "battery", { label: "\\mathcal{E}", value: "12" }],
      ["q", "R", "wire"]
    ]
  ),
  template2(
    "diode",
    "Diode and resistor",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [["a", "b", "vsource", { label: "V_s", value: "5" }], ["b", "c", "resistor", { label: "R", value: "430" }], ["c", "d", "diode", { label: "D" }], ["d", "e", "ammeter"], ["e", "a", "wire"]]
  ),
  template2(
    "rc",
    "RC circuit",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [
      ["a", "b", "battery", { label: "\\mathcal{E}", value: "9", step: 1 }],
      ["b", "c", "switch", { label: "S", flipAt: 2, step: 1 }],
      ["c", "d", "resistor", { label: "R", value: "10k", step: 1 }],
      ["d", "e", "capacitor", { label: "C", value: "100u", voltage: "V_C", step: 1 }],
      ["e", "a", "wire", { step: 1 }]
    ],
    { 2: "Closing the switch charges C through R. Once it has charged, no current flows." }
  ),
  template2(
    "rlc",
    "Series RLC (AC)",
    [["a", 0, 0], ["b", 0, 3], ["c", 2.5, 3], ["d", 5, 3], ["e", 5, 0]],
    [
      ["a", "b", "acsource", { label: "v(t)" }],
      ["b", "c", "resistor", { label: "R", value: "50" }],
      ["c", "d", "inductor", { label: "L", value: "10m" }],
      ["d", "e", "capacitor", { label: "C", value: "1u" }],
      ["e", "a", "wire", { current: "i(t)" }]
    ]
  ),
  { key: "blank", name: "Blank", build: () => ({ vertices: [], edges: [], captions: {} }) }
];

// client/src/utils/logicParts.js
var LOGIC_PARTS = {
  input: { name: "Input", key: "i", tikz: "ocirc" },
  output: { name: "Output", key: "o", tikz: "ocirc" },
  clock: { name: "Clock", key: "k", tikz: "ocirc" },
  and: { name: "AND", key: "a", gate: "and", multi: true, iec: "&", tikz: "and port" },
  or: { name: "OR", key: "r", gate: "or", multi: true, iec: "≥1", tikz: "or port" },
  not: { name: "NOT", key: "n", gate: "buf", inv: true, iec: "1", tikz: "not port" },
  nand: { name: "NAND", gate: "and", inv: true, multi: true, iec: "&", tikz: "nand port" },
  nor: { name: "NOR", gate: "or", inv: true, multi: true, iec: "≥1", tikz: "nor port" },
  xor: { name: "XOR", key: "x", gate: "xor", multi: true, iec: "=1", tikz: "xor port" },
  xnor: { name: "XNOR", gate: "xor", inv: true, multi: true, iec: "=1", tikz: "xnor port" },
  buf: { name: "Buffer", gate: "buf", iec: "1", tikz: "buffer port" },
  dff: { name: "D flip-flop", key: "f", tikz: "flipflop D" }
};
var LOGIC_GATES = Object.keys(LOGIC_PARTS).filter((k) => LOGIC_PARTS[k].gate);
var LOGIC_SNAP = 0.25;
function pinsOf(p) {
  const K = LOGIC_PARTS[p.kind];
  if (K.gate) {
    const n = K.multi ? Math.min(4, Math.max(2, p.inputs || 2)) : 1;
    const ins = Array.from({ length: n }, (_, i) => ({ name: "in" + (i + 1), x: p.x - 0.75, y: p.y + ((n - 1) / 2 - i) * 0.5, io: "in" }));
    return [...ins, { name: "out", x: p.x + 0.75, y: p.y, io: "out" }];
  }
  if (p.kind === "input" || p.kind === "clock") return [{ name: "out", x: p.x + 0.75, y: p.y, io: "out" }];
  if (p.kind === "output") return [{ name: "in", x: p.x - 0.75, y: p.y, io: "in" }];
  return [
    { name: "d", x: p.x - 1, y: p.y + 0.5, io: "in" },
    { name: "clk", x: p.x - 1, y: p.y - 0.5, io: "in" },
    { name: "q", x: p.x + 1, y: p.y + 0.5, io: "out" },
    { name: "qn", x: p.x + 1, y: p.y - 0.5, io: "out" }
  ];
}
function endpoints(m, step = null) {
  const E = /* @__PURE__ */ new Map();
  for (const p of m.parts) if (step == null || (p.step || 0) <= step) for (const pin of pinsOf(p)) E.set(`${p.id}.${pin.name}`, { ...pin, part: p });
  for (const n of m.nodes) if (step == null || (n.step || 0) <= step) E.set(n.id, { x: n.x, y: n.y, node: n });
  return E;
}
var snapTo = (v) => Math.round(v / LOGIC_SNAP) * LOGIC_SNAP;
function route(P, Q, mx) {
  if (Math.abs(P.y - Q.y) < 1e-9) return [P, Q];
  const x = mx ?? snapTo((P.x + Q.x) / 2);
  return [P, { x, y: P.y }, { x, y: Q.y }, Q].filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) > 1e-9);
}
var inputAt = (p, s) => {
  let v = p.value ? 1 : 0;
  for (const f of p.flips || []) if (f <= s) v = 1 - v;
  return v;
};
var clockAt = (p, s) => {
  const a = p.start ?? 1, b = p.end ?? 8;
  return s >= a && s <= b ? (s - a) % 2 === 0 ? 1 : 0 : 0;
};
var ID3 = /^[A-Za-z0-9_-]{1,40}$/;
var COLOR4 = /^#[0-9a-f]{6}$/i;
var num5 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
var int4 = (v, lo, hi, dflt) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
var str4 = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
function logicModel(el) {
  const parts = [], nodes = [], wires = [], ids = /* @__PURE__ */ new Set();
  for (const p of Array.isArray(el?.parts) ? el.parts.slice(0, 300) : []) {
    if (!p || !ID3.test(p.id) || ids.has(p.id) || !LOGIC_PARTS[p.kind]) continue;
    ids.add(p.id);
    const K = LOGIC_PARTS[p.kind];
    const out = { id: p.id, kind: p.kind, x: num5(p.x, -1e3, 1e3, 0), y: num5(p.y, -1e3, 1e3, 0), label: str4(p.label, 200), step: int4(p.step, 0, 1e3, 0) };
    if (K.multi) out.inputs = int4(p.inputs, 2, 4, 2);
    if (p.kind === "input") {
      out.value = p.value ? 1 : 0;
      out.flips = [...new Set((Array.isArray(p.flips) ? p.flips : []).filter((f) => Number.isInteger(f) && f >= 1 && f <= 1e3))].sort((a, b) => a - b).slice(0, 200);
    }
    if (p.kind === "clock") {
      out.start = int4(p.start, 0, 1e3, 1);
      out.end = Math.max(out.start, int4(p.end, 0, 1e3, 8));
    }
    parts.push(out);
  }
  for (const n of Array.isArray(el?.nodes) ? el.nodes.slice(0, 500) : []) {
    if (!n || !ID3.test(n.id) || ids.has(n.id)) continue;
    ids.add(n.id);
    nodes.push({ id: n.id, x: num5(n.x, -1e3, 1e3, 0), y: num5(n.y, -1e3, 1e3, 0), step: int4(n.step, 0, 1e3, 0) });
  }
  const E = endpoints({ parts, nodes });
  const wireIds = /* @__PURE__ */ new Set();
  for (const w of Array.isArray(el?.wires) ? el.wires.slice(0, 1e3) : []) {
    if (!w || !ID3.test(w.id) || wireIds.has(w.id) || !E.has(w.from) || !E.has(w.to) || w.from === w.to) continue;
    wireIds.add(w.id);
    wires.push({ id: w.id, from: w.from, to: w.to, mx: typeof w.mx === "number" && isFinite(w.mx) ? num5(w.mx, -1e3, 1e3, 0) : null, step: int4(w.step, 0, 1e3, 0) });
  }
  const captions = {};
  if (el?.captions && typeof el.captions === "object") {
    for (const [k, v] of Object.entries(el.captions)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 0 && n <= 1e3 && typeof v === "string" && v.trim()) captions[n] = v.slice(0, 500);
    }
  }
  return {
    parts,
    nodes,
    wires,
    captions,
    color: COLOR4.test(el?.color || "") ? el.color : "#ffffff",
    symbols: el?.symbols === "iec" ? "iec" : "us",
    values: el?.values !== false,
    table: !!el?.table,
    stepStart: int4(el?.stepStart, 1, 1e3, 1)
  };
}

// client/src/utils/logicSim.js
function gateOut(kind, ins) {
  const K = LOGIC_PARTS[kind];
  let v;
  if (K.gate === "and") v = ins.some((x) => x === 0) ? 0 : ins.every((x) => x === 1) ? 1 : null;
  else if (K.gate === "or") v = ins.some((x) => x === 1) ? 1 : ins.every((x) => x === 0) ? 0 : null;
  else if (K.gate === "xor") v = ins.some((x) => x == null) ? null : ins.reduce((a, b) => a ^ b, 0);
  else v = ins[0] ?? null;
  return v == null ? null : K.inv ? 1 - v : v;
}
var everythingAtOnce = (m) => ({ ...m, parts: m.parts.map((p) => ({ ...p, step: 0 })), wires: m.wires.map((w) => ({ ...w, step: 0 })), nodes: m.nodes.map((n) => ({ ...n, step: 0 })) });
function simulateLogic(m, upto, override = null) {
  const states = [], outVal = {}, ffQ = {}, lastClk = {};
  for (const p of m.parts) if (p.kind === "dff") ffQ[p.id] = 0;
  for (let s = 0; s <= upto; s++) {
    const E = endpoints(m, s);
    const parts = m.parts.filter((p) => (p.step || 0) <= s);
    const wires = m.wires.filter((w) => (w.step || 0) <= s && E.has(w.from) && E.has(w.to));
    const parent2 = {};
    for (const id of E.keys()) parent2[id] = id;
    const find = (a) => {
      while (parent2[a] !== a) {
        parent2[a] = parent2[parent2[a]];
        a = parent2[a];
      }
      return a;
    };
    for (const w of wires) {
      const a = find(w.from), b = find(w.to);
      if (a !== b) parent2[a] = b;
    }
    const drivers = {};
    for (const [id, e] of E) if (e.io === "out") (drivers[find(id)] = drivers[find(id)] || []).push(id);
    const conflicts = /* @__PURE__ */ new Set();
    const netVal = (net) => {
      const ds = drivers[net];
      if (!ds) return null;
      const vals = [...new Set(ds.map((d) => outVal[d] ?? null))];
      if (vals.length > 1) {
        if (!vals.includes(null)) conflicts.add(net);
        return null;
      }
      return vals[0];
    };
    const pinIn = (id) => netVal(find(id));
    let oscillates = false;
    const relax = (again = true) => {
      for (let iter = 0; iter < 200; iter++) {
        let changed = false;
        const set = (id, v) => {
          if (outVal[id] !== v) {
            outVal[id] = v;
            changed = true;
          }
        };
        for (const p of parts) {
          if (p.kind === "input") set(`${p.id}.out`, override && override.has(p.id) ? override.get(p.id) : inputAt(p, s));
          else if (p.kind === "clock") set(`${p.id}.out`, clockAt(p, s));
          else if (p.kind === "dff") {
            set(`${p.id}.q`, ffQ[p.id]);
            set(`${p.id}.qn`, ffQ[p.id] == null ? null : 1 - ffQ[p.id]);
          } else if (LOGIC_PARTS[p.kind].gate) set(`${p.id}.out`, gateOut(p.kind, pinsOf(p).filter((x) => x.io === "in").map((x) => pinIn(`${p.id}.${x.name}`))));
        }
        if (!changed) return;
      }
      oscillates = true;
      if (!again) return;
      for (const p of parts) if (LOGIC_PARTS[p.kind].gate) outVal[`${p.id}.out`] = null;
      relax(false);
    };
    relax();
    for (let round3 = 0; round3 < 10; round3++) {
      const fired = [];
      for (const p of parts) {
        if (p.kind !== "dff") continue;
        const clk = pinIn(`${p.id}.clk`);
        if (s > 0 && lastClk[p.id] === 0 && clk === 1) fired.push([p.id, pinIn(`${p.id}.d`)]);
        lastClk[p.id] = clk;
      }
      if (!fired.length) break;
      for (const [id, d] of fired) ffQ[id] = d;
      relax();
    }
    const at = {}, wire = {};
    for (const id of E.keys()) at[id] = netVal(find(id));
    for (const w of wires) wire[w.id] = netVal(find(w.from));
    const floating = parts.flatMap((p) => pinsOf(p).filter((x) => x.io === "in" && !drivers[find(`${p.id}.${x.name}`)]).map((x) => `${p.id}.${x.name}`));
    states.push({ at, wire, floating, conflicts: conflicts.size, oscillates });
  }
  return states;
}
var inputsOf = (m) => m.parts.filter((p) => p.kind === "input").sort((a, b) => b.y - a.y || a.x - b.x);
var outputsOf = (m) => m.parts.filter((p) => p.kind === "output").sort((a, b) => b.y - a.y || a.x - b.x);
function netsOf(m) {
  const E = endpoints(m), parent2 = {};
  for (const id of E.keys()) parent2[id] = id;
  const find = (a) => {
    while (parent2[a] !== a) {
      parent2[a] = parent2[parent2[a]];
      a = parent2[a];
    }
    return a;
  };
  for (const w of m.wires) if (E.has(w.from) && E.has(w.to)) {
    const a = find(w.from), b = find(w.to);
    if (a !== b) parent2[a] = b;
  }
  return find;
}
function hasFeedback(m) {
  const find = netsOf(m);
  const gates = m.parts.filter((p) => LOGIC_PARTS[p.kind].gate);
  const feeds = new Map(gates.map((g) => [g.id, gates.filter((h) => pinsOf(h).some((x) => x.io === "in" && find(`${h.id}.${x.name}`) === find(`${g.id}.out`))).map((h) => h.id)]));
  const state = {};
  const visit = (id) => {
    if (state[id] === 1) return true;
    if (state[id] === 2) return false;
    state[id] = 1;
    for (const n of feeds.get(id) || []) if (visit(n)) return true;
    state[id] = 2;
    return false;
  };
  return gates.some((g) => visit(g.id));
}
function truthTable(m) {
  if (m.parts.some((p) => p.kind === "dff" || p.kind === "clock")) return { why: "It has a flip-flop or a clock, so it remembers: no truth table." };
  const ins = inputsOf(m), outs = outputsOf(m);
  if (!ins.length || !outs.length) return { why: "Add inputs and outputs for a truth table." };
  if (ins.length > 6) return { why: "More than six inputs: too many rows for a truth table." };
  if (hasFeedback(m)) return { why: "It has feedback, so it can remember: no truth table." };
  const flat = everythingAtOnce(m), rows = [];
  for (let k = 0; k < 2 ** ins.length; k++) {
    const vals = ins.map((p, i) => k >> ins.length - 1 - i & 1);
    const st = simulateLogic(flat, 0, new Map(ins.map((p, i) => [p.id, vals[i]])))[0];
    rows.push([...vals, ...outs.map((o) => st.at[`${o.id}.in`])]);
  }
  return { ins, outs, rows };
}
function rowOf(tt, state) {
  if (!tt.rows || !state) return -1;
  return tt.rows.findIndex((r) => tt.ins.every((p, i) => state.at[`${p.id}.out`] === r[i]));
}
function logicDepths(m) {
  const find = netsOf(m), level = {};
  for (const p of m.parts) for (const x of pinsOf(p)) if (x.io === "out" && !LOGIC_PARTS[p.kind].gate) level[find(`${p.id}.${x.name}`)] = 0;
  const gates = m.parts.filter((p) => LOGIC_PARTS[p.kind].gate);
  for (let i = 0; i < gates.length + 2; i++) {
    for (const g of gates) {
      const ins = pinsOf(g).filter((x) => x.io === "in").map((x) => level[find(`${g.id}.${x.name}`)] ?? 0);
      level[find(`${g.id}.out`)] = Math.min(12, 1 + Math.max(0, ...ins));
    }
  }
  return (id) => level[find(id)] ?? 0;
}

// client/src/utils/logicDiagram.js
var LOGIC_UNIT = 56;
var LW2 = 2;
var CAPTION3 = 0.3;
var esc4 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n14 = (v) => String(Math.round(v * 10) / 10);
function signalColors(ink) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(ink || "");
  const light = !m || 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140;
  return light ? { hi: "#4ade80", lo: "#5d6a85", unk: "#f5a524" } : { hi: "#16a34a", lo: "#a7b0c2", unk: "#d97706" };
}
function maxStep3(m) {
  let s = 0;
  for (const p of m.parts) {
    s = Math.max(s, p.step || 0, ...p.flips || []);
    if (p.kind === "clock") s = Math.max(s, p.end ?? 8);
  }
  for (const w of m.wires) s = Math.max(s, w.step || 0);
  for (const n of m.nodes) s = Math.max(s, n.step || 0);
  for (const k of Object.keys(m.captions || {})) s = Math.max(s, +k);
  return s;
}
function logicBounds(m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of m.parts) {
    const r = p.kind === "dff" ? 1.1 : 0.9, hh = p.kind === "dff" ? 1 : Math.max(0.5, ((p.inputs || 2) - 1) * 0.25 + 0.3);
    x0 = Math.min(x0, p.x - r - (p.kind === "input" || p.kind === "clock" ? 0.6 : 0));
    x1 = Math.max(x1, p.x + r + (p.kind === "output" ? 0.6 : 0));
    y0 = Math.min(y0, p.y - hh);
    y1 = Math.max(y1, p.y + hh);
  }
  for (const n of m.nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 6, y1: 3 };
}
function gateGeometry(p, u) {
  const K = LOGIC_PARTS[p.kind], ins = pinsOf(p).filter((x) => x.io === "in"), n = ins.length;
  const h = (K.multi ? Math.max(0.47, (n - 1) * 0.25 + 0.22) : 0.36) * u;
  return { K, ins, n, h };
}
function partBase(p, u, ink, style, label) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u, lw = LW2;
  const stroke = `fill="none" stroke="${esc4(ink)}" stroke-width="${n14(lw)}" stroke-linejoin="round"`;
  const text = (t, x, y, fs) => `<text x="${n14(x)}" y="${n14(y + fs * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(fs)}" fill="${esc4(ink)}">${esc4(t)}</text>`;
  let out = "";
  if (K.gate) {
    const { h } = gateGeometry(p, u), xb = X - 0.5 * u, xf = X + 0.5 * u;
    let front = xf;
    if (style === "iec") {
      out += `<rect x="${n14(X - 0.42 * u)}" y="${n14(Y - h)}" width="${n14(0.84 * u)}" height="${n14(2 * h)}" ${stroke}/>` + text(K.iec, X, Y, 0.3 * u);
      front = X + 0.42 * u;
    } else if (K.gate === "and") {
      const rx = Math.min(h, 0.55 * u);
      out += `<path d="M${n14(xb)} ${n14(Y - h)}H${n14(xf - rx)}A${n14(rx)} ${n14(h)} 0 0 1 ${n14(xf - rx)} ${n14(Y + h)}H${n14(xb)}Z" ${stroke}/>`;
    } else if (K.gate === "or" || K.gate === "xor") {
      const c = 0.22 * u;
      out += `<path d="M${n14(xb)} ${n14(Y - h)}Q${n14(xb + c)} ${n14(Y)} ${n14(xb)} ${n14(Y + h)}Q${n14(X + 0.15 * u)} ${n14(Y + h)} ${n14(xf)} ${n14(Y)}Q${n14(X + 0.15 * u)} ${n14(Y - h)} ${n14(xb)} ${n14(Y - h)}Z" ${stroke}/>`;
      if (K.gate === "xor") out += `<path d="M${n14(xb - 0.14 * u)} ${n14(Y - h)}Q${n14(xb - 0.14 * u + c)} ${n14(Y)} ${n14(xb - 0.14 * u)} ${n14(Y + h)}" ${stroke}/>`;
    } else {
      out += `<path d="M${n14(X - 0.35 * u)} ${n14(Y - 0.33 * u)}L${n14(X - 0.35 * u)} ${n14(Y + 0.33 * u)}L${n14(X + 0.3 * u)} ${n14(Y)}Z" ${stroke}/>`;
      front = X + 0.3 * u;
    }
    if (K.inv) out += `<circle cx="${n14(front + 0.08 * u)}" cy="${n14(Y)}" r="${n14(0.08 * u)}" ${stroke}/>`;
    if (p.label) out += label(p.label, X, Y - h - 0.24 * u, 0.28 * u);
  } else if (p.kind === "input" || p.kind === "clock") {
    out += `<rect x="${n14(X - 0.32 * u)}" y="${n14(Y - 0.27 * u)}" width="${n14(0.64 * u)}" height="${n14(0.54 * u)}" rx="${n14(0.08 * u)}" ${stroke}/>`;
    if (p.label) {
      const b = texBox(p.label, 0.32 * u);
      out += label(p.label, X - 0.48 * u - b.w / 2, Y, 0.32 * u);
    }
  } else if (p.kind === "output") {
    out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" ${stroke}/>`;
    if (p.label) {
      const b = texBox(p.label, 0.32 * u);
      out += label(p.label, X + 0.45 * u + b.w / 2, Y, 0.32 * u);
    }
  } else if (p.kind === "dff") {
    const x0 = X - 0.6 * u, fs = 0.26 * u;
    out += `<rect x="${n14(x0)}" y="${n14(Y - 0.9 * u)}" width="${n14(1.2 * u)}" height="${n14(1.8 * u)}" ${stroke}/>`;
    out += text("D", x0 + 0.18 * u, Y - 0.5 * u, fs) + texSvg("Q", X + 0.42 * u, Y - 0.5 * u, fs, ink) + texSvg("\\overline{Q}", X + 0.42 * u, Y + 0.5 * u, fs, ink);
    out += `<path d="M${n14(x0)} ${n14(Y + 0.38 * u)}L${n14(x0 + 0.16 * u)} ${n14(Y + 0.5 * u)}L${n14(x0)} ${n14(Y + 0.62 * u)}" ${stroke}/>`;
    if (p.label) out += label(p.label, X, Y - 1.14 * u, 0.28 * u);
  }
  return out;
}
function backAt(p, u, style, pyPx) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u;
  if (style === "iec") return X - 0.42 * u;
  if (K.gate === "buf") return X - 0.35 * u;
  if (K.gate === "and") return X - 0.5 * u;
  const { h } = gateGeometry(p, u), t = (pyPx - (Y - h)) / (2 * h);
  return X - 0.5 * u - (K.gate === "xor" ? 0.14 * u : 0) + 2 * t * (1 - t) * 0.22 * u;
}
function partSignals(p, u, ink, style, at, color2) {
  const K = LOGIC_PARTS[p.kind], X = p.x * u, Y = -p.y * u;
  const line = (x1, y1, x2, y2, c) => `<path d="M${n14(x1)} ${n14(y1)}L${n14(x2)} ${n14(y2)}" stroke="${esc4(c)}" stroke-width="${n14(LW2)}" stroke-linecap="round" fill="none"/>`;
  const sig = (name) => color2(at ? at[`${p.id}.${name}`] : void 0);
  let out = "";
  if (K.gate) {
    for (const pin of pinsOf(p).filter((x) => x.io === "in")) {
      const py = -pin.y * u;
      out += line(pin.x * u, py, backAt(p, u, style, py), py, sig(pin.name));
    }
    const front = style === "iec" ? X + 0.42 * u : K.gate === "buf" ? X + 0.3 * u : X + 0.5 * u;
    out += line(front + (K.inv ? 0.16 * u : 0), Y, X + 0.75 * u, Y, sig("out"));
  } else if (p.kind === "input" || p.kind === "clock") {
    const v = at ? at[`${p.id}.out`] : void 0;
    out += line(X + 0.32 * u, Y, X + 0.75 * u, Y, color2(v));
    if (p.kind === "clock") {
      const a = 0.18 * u, b = 0.12 * u;
      out += `<path d="M${n14(X - a)} ${n14(Y + b)}H${n14(X - a / 2)}V${n14(Y - b)}H${n14(X + a / 2)}V${n14(Y + b)}H${n14(X + a)}" fill="none" stroke="${esc4(v == null ? ink : color2(v))}" stroke-width="${n14(LW2 * 0.9)}" stroke-linejoin="round"/>`;
    } else if (v != null) out += `<text x="${n14(X)}" y="${n14(Y + 0.32 * u * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(0.32 * u)}" font-weight="700" fill="${esc4(color2(v))}">${v}</text>`;
  } else if (p.kind === "output") {
    const v = at ? at[`${p.id}.in`] : void 0;
    out += line(X - 0.75 * u, Y, X - 0.27 * u, Y, color2(v));
    if (v === 1) out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.5 * u)}" fill="${esc4(color2(1))}" fill-opacity=".18"/><circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" fill="${esc4(color2(1))}"/>`;
    else if (v === null) out += `<circle cx="${n14(X)}" cy="${n14(Y)}" r="${n14(0.27 * u)}" fill="none" stroke="${esc4(color2(null))}" stroke-width="${n14(LW2)}" stroke-dasharray="3 3"/>`;
  } else if (p.kind === "dff") {
    for (const pin of pinsOf(p)) {
      const px = pin.x * u, py = -pin.y * u;
      out += pin.io === "in" ? line(px, py, X - 0.6 * u, py, sig(pin.name)) : line(X + 0.6 * u, py, px, py, sig(pin.name));
    }
  }
  return out;
}
function drawLogic(m, o = {}) {
  const u = o.U || LOGIC_UNIT, ink = o.ink || "#ffffff", pal = signalColors(ink);
  const color2 = o.values ? (v) => v === 1 ? pal.hi : v === 0 ? pal.lo : v === null ? pal.unk : ink : () => ink;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const max = maxStep3(m);
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (X, Y, rx = 0, ry = rx) => {
    box.x0 = Math.min(box.x0, X - rx);
    box.x1 = Math.max(box.x1, X + rx);
    box.y0 = Math.min(box.y0, Y - ry);
    box.y1 = Math.max(box.y1, Y + ry);
  };
  const label = (tex, X, Y, size) => {
    const b = texBox(tex, size);
    grow(X, Y, b.w / 2, b.h / 2);
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc4(tex)}" style="font-family:${esc4(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n14(X - w / 2)}" y="${n14(Y - h / 2)}" width="${n14(w)}" height="${n14(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n14(size / 1.21)}px;color:${esc4(ink)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, X, Y, size, ink);
  };
  for (const p of m.parts) {
    const b = logicBounds({ parts: [p], nodes: [] });
    grow((b.x0 + b.x1) / 2 * u, -(b.y0 + b.y1) / 2 * u, (b.x1 - b.x0) / 2 * u, (b.y1 - b.y0) / 2 * u);
  }
  for (const n of m.nodes) grow(n.x * u, -n.y * u);
  const flat = everythingAtOnce(m);
  const tt = o.table ? truthTable(m) : null;
  const deep = logicDepths(m);
  const states = deck != null ? simulateLogic(m, max) : step == null ? simulateLogic(flat, 0) : simulateLogic(m, step);
  const signals = (s, state, prev, model) => {
    const E = endpoints(model, s);
    const shown = (x) => s == null || (x.step || 0) <= s;
    let out = "";
    const fan = {};
    for (const w of model.wires) if (shown(w) && E.has(w.from) && E.has(w.to)) {
      fan[w.from] = (fan[w.from] || 0) + 1;
      fan[w.to] = (fan[w.to] || 0) + 1;
    }
    for (const w of model.wires) {
      if (!shown(w) || !E.has(w.from) || !E.has(w.to)) continue;
      const d = route(E.get(w.from), E.get(w.to), w.mx ?? void 0).map((p, i) => `${i ? "L" : "M"}${n14(p.x * u)} ${n14(-p.y * u)}`).join("");
      const v = state.wire[w.id], c = color2(v), dash = o.values && v === null ? ' stroke-dasharray="5 4"' : "";
      const path = (cls, col, extra = "") => `<path${cls} d="${d}" fill="none" stroke="${esc4(col)}" stroke-width="${n14(LW2 * 1.15)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
      const fresh = deck != null && (w.step || 0) === s && s > 0;
      const changed = prev && o.values && prev.wire[w.id] !== void 0 && prev.wire[w.id] !== v;
      if (deck != null && (fresh || changed)) {
        if (changed) out += path("", color2(prev.wire[w.id]));
        out += path(` class="pxlg-sig" style="animation-delay:${(deep(w.from) * 0.14).toFixed(2)}s"`, c, dash);
      } else out += path("", c, dash);
    }
    for (const [id, e] of E) {
      const f = fan[id] || 0;
      if (e.node && f >= 3 || !e.node && f >= 2) out += `<circle cx="${n14(e.x * u)}" cy="${n14(-e.y * u)}" r="3.6" fill="${esc4(color2(state.at[id]))}"/>`;
    }
    for (const p of model.parts) if (shown(p)) out += partSignals(p, u, ink, o.style, state.at, color2);
    if (tt && tt.rows) {
      const row = rowOf(tt, state);
      if (row >= 0) out += tableRow(row);
    }
    return out;
  };
  let tableBase = "", tableRow = () => "";
  if (tt && tt.rows) {
    const b = logicBounds(m), cw = 0.62 * u, rh = 0.44 * u, cols = tt.ins.length + tt.outs.length;
    const x0 = (b.x1 + 0.9) * u, top = -b.y1 * u + 0.1 * u, fs = 0.27 * u;
    [...tt.ins, ...tt.outs].forEach((p, c) => {
      tableBase += label(p.label || p.id, x0 + (c + 0.5) * cw, top + rh * 0.5, fs);
    });
    tableBase += `<path d="M${n14(x0 - 0.08 * u)} ${n14(top + rh)}H${n14(x0 + cols * cw + 0.08 * u)}M${n14(x0 + tt.ins.length * cw)} ${n14(top + 0.06 * u)}V${n14(top + rh * (tt.rows.length + 1))}" stroke="${esc4(ink)}" stroke-width="1.2" opacity=".6"/>`;
    tt.rows.forEach((r, ri) => r.forEach((v, c) => {
      tableBase += `<text x="${n14(x0 + (c + 0.5) * cw)}" y="${n14(top + rh * (ri + 1.5) + fs * 0.34)}" text-anchor="middle" font-family="${esc4(MATH_FONT)}" font-size="${n14(fs)}" fill="${esc4(ink)}">${v == null ? "?" : v}</text>`;
    }));
    grow(x0 + cols * cw / 2, top + rh * (tt.rows.length + 1) / 2, cols * cw / 2 + 0.1 * u, rh * (tt.rows.length + 1) / 2);
    tableRow = (row) => `<rect x="${n14(x0 - 0.08 * u)}" y="${n14(top + rh * (row + 1))}" width="${n14(cols * cw + 0.16 * u)}" height="${n14(rh)}" rx="4" fill="${esc4(o.accent || pal.hi)}" fill-opacity=".26"/>`;
  }
  let layers = "";
  if (deck != null) {
    for (let s = 0; s <= max; s++) layers += `<g data-fx-in="${s}-${s === max ? "" : s}">${signals(s, states[s], s ? states[s - 1] : null, m)}</g>`;
  } else layers = signals(step, states[states.length - 1], null, step == null ? flat : m);
  let bases = "";
  for (const p of m.parts) {
    if (step != null && (p.step || 0) > step) continue;
    let g = partBase(p, u, ink, o.style, label);
    if (o.editor) {
      const sel = o.sel && o.sel.kind === "p" && o.sel.id === p.id;
      const hw = (p.kind === "dff" ? 1 : 0.62) * u, hh = (p.kind === "dff" ? 0.95 : Math.max(0.45, ((p.inputs || 2) - 1) * 0.25 + 0.3)) * u;
      if (sel) g = `<rect x="${n14(p.x * u - hw)}" y="${n14(-p.y * u - hh)}" width="${n14(2 * hw)}" height="${n14(2 * hh)}" rx="6" fill="${esc4(o.accent)}" fill-opacity=".14" stroke="${esc4(o.accent)}" stroke-width="1.5"/>` + g;
      g += `<rect data-p="${esc4(p.id)}" x="${n14(p.x * u - hw * 0.8)}" y="${n14(-p.y * u - hh * 0.9)}" width="${n14(1.6 * hw)}" height="${n14(1.8 * hh)}" fill="#000" fill-opacity="0"/>`;
      if (p.kind === "input") g += `<rect data-toggle="${esc4(p.id)}" x="${n14(p.x * u - 0.32 * u)}" y="${n14(-p.y * u - 0.27 * u)}" width="${n14(0.64 * u)}" height="${n14(0.54 * u)}" fill="#000" fill-opacity="0"><title>Click to set it to ${p.value ? 0 : 1}</title></rect>`;
      for (const pin of pinsOf(p)) {
        const id = `${p.id}.${pin.name}`, floating = (o.warn || []).includes(id);
        g += `<circle data-pin="${esc4(id)}" cx="${n14(pin.x * u)}" cy="${n14(-pin.y * u)}" r="${floating ? 6 : 2.6}" fill="${floating ? esc4(o.warnColor) : "none"}" fill-opacity="${floating ? ".35" : "0"}" stroke="${esc4(floating ? o.warnColor : o.mark)}" stroke-width="1.2"/>`;
      }
    }
    bases += deck != null && (p.step || 0) > 0 ? `<g class="pxfx-part pxfx-v" data-fx-at="${p.step}">${g}</g>` : `<g>${g}</g>`;
  }
  let editor = "";
  if (o.editor) {
    const E = endpoints(m);
    for (const w of m.wires) {
      if (!E.has(w.from) || !E.has(w.to)) continue;
      const pts = route(E.get(w.from), E.get(w.to), w.mx ?? void 0);
      const d = pts.map((p, i) => `${i ? "L" : "M"}${n14(p.x * u)} ${n14(-p.y * u)}`).join("");
      const sel = o.sel && o.sel.kind === "w" && o.sel.id === w.id;
      if (sel) editor += `<path d="${d}" fill="none" stroke="${esc4(o.accent)}" stroke-opacity=".3" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>`;
      editor += `<path data-w="${esc4(w.id)}" d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="14" pointer-events="stroke"/>`;
      if (sel && pts.length === 4) editor += `<circle data-h="${esc4(w.id)}" cx="${n14(pts[1].x * u)}" cy="${n14(-(pts[1].y + pts[2].y) / 2 * u)}" r="6" fill="${esc4(o.accent)}" stroke="#fff" stroke-width="2"><title>Drag to move the upright</title></circle>`;
    }
    for (const n of m.nodes) {
      const sel = o.sel && o.sel.kind === "n" && o.sel.id === n.id;
      editor += `<circle data-n="${esc4(n.id)}" cx="${n14(n.x * u)}" cy="${n14(-n.y * u)}" r="${sel ? 7 : 5}" fill="${sel ? esc4(o.accent) : "#000"}" fill-opacity="${sel ? ".35" : "0"}"/>`;
    }
  }
  let grid = "";
  if (o.editor && o.grid && o.view) {
    const v = o.view, gx = v.x0 * u, gy = -(v.y0 + v.h) * u;
    grid = `<defs><pattern id="pxlg-g" width="${u / 2}" height="${u / 2}" x="${-u / 4}" y="${-u / 4}" patternUnits="userSpaceOnUse"><circle cx="${u / 4}" cy="${u / 4}" r="1.1" fill="${esc4(o.mark)}" fill-opacity=".7"/></pattern></defs><rect x="${n14(gx)}" y="${n14(gy)}" width="${n14(v.w * u)}" height="${n14(v.h * u)}" fill="url(#pxlg-g)"/>`;
  }
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length && isFinite(box.x0)) {
    const cs = CAPTION3 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text") return `<text${cls} x="${n14(cx)}" y="${n14(y + cs)}" text-anchor="middle" font-size="${n14(cs)}" fill="${esc4(ink)}">${esc4(text)}</text>`;
      return `<foreignObject${cls} x="${n14(cx - w / 2)}" y="${n14(y)}" width="${n14(w)}" height="${n14(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n14(cs)}px;line-height:1.3;color:${esc4(ink)}">${esc4(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const shown = capSteps.filter((n) => n <= (step ?? 0)).pop();
      if (shown != null) caps = one(shown, "");
    }
    grow(cx, y + h / 2, w / 2, h / 2);
  }
  if (!isFinite(box.x0)) Object.assign(box, { x0: 0, y0: 0, x1: 6 * u, y1: 3 * u });
  return { svg: grid + `<g pointer-events="none">${layers}</g>` + bases + tableBase + editor + caps, box };
}
var baseOptions2 = (m) => ({ ink: m.color, style: m.symbols, values: m.values, table: m.table, captions: true });
function logicBox(el) {
  const m = logicModel(el);
  const { box } = drawLogic(m, baseOptions2(m));
  const pad = 0.2 * LOGIC_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function logicSvg(el, opts = {}) {
  const m = logicModel(el), b = logicBox(el);
  const { svg } = drawLogic(m, { ...baseOptions2(m), labels: opts.labels || "text", deck: opts.deck, step: opts.step ?? null });
  const size = opts.standalone ? ` width="${n14(b.w)}" height="${n14(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n14(b.x)} ${n14(b.y)} ${n14(b.w)} ${n14(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function logicSteps(el) {
  if (el?.type !== "logic") return [];
  const m = logicModel(el), steps = /* @__PURE__ */ new Set();
  for (const p of m.parts) {
    if (p.step > 0) steps.add(p.step);
    for (const f of p.flips || []) steps.add(f);
    if (p.kind === "clock") for (let s = Math.max(1, p.start); s <= p.end + 1; s++) steps.add(s);
  }
  for (const w of m.wires) if (w.step > 0) steps.add(w.step);
  for (const n of m.nodes) if (n.step > 0) steps.add(n.step);
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k);
  return [...steps].filter((s) => s <= maxStep3(m)).sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function logicStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of logicSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasLogic(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "logic"));
}
function template3(key, name, parts, nodes, wires, extra = {}) {
  return { key, name, build() {
    return {
      parts: parts.map(([id, kind, x, y, more]) => ({
        id,
        kind,
        x,
        y,
        label: "",
        step: 0,
        ...LOGIC_PARTS[kind].multi ? { inputs: 2 } : {},
        ...kind === "input" ? { value: 0, flips: [] } : {},
        ...kind === "clock" ? { start: 1, end: 8 } : {},
        ...more || {}
      })),
      nodes: nodes.map(([id, x, y]) => ({ id, x, y, step: 0 })),
      wires: wires.map(([from, to, more], i) => ({ id: "w" + (i + 1), from, to, mx: null, step: 0, ...more || {} })),
      captions: { ...extra.captions || {} },
      table: !!extra.table
    };
  } };
}
var LOGIC_TEMPLATES = [
  template3(
    "half",
    "Half adder",
    [["A", "input", 0, 2, { label: "A", flips: [2] }], ["B", "input", 0, 0, { label: "B", flips: [1, 2, 3] }], ["g1", "xor", 3, 1.75], ["g2", "and", 3, 0.25], ["S", "output", 5.25, 1.75, { label: "S" }], ["C", "output", 5.25, 0.25, { label: "C" }]],
    [["nA", 1.25, 2], ["nB", 1.75, 0]],
    [["A.out", "nA"], ["nA", "g1.in1"], ["nA", "g2.in1", { mx: 1.25 }], ["B.out", "nB"], ["nB", "g2.in2"], ["nB", "g1.in2", { mx: 1.75 }], ["g1.out", "S.in"], ["g2.out", "C.in"]],
    { table: true, captions: { 0: "0 + 0: sum 0, carry 0", 1: "0 + 1: sum 1", 2: "1 + 0: sum 1", 3: "1 + 1: sum 0, carry 1" } }
  ),
  template3(
    "mux",
    "2-to-1 multiplexer",
    [
      ["D0", "input", 0, 3, { label: "D_0", value: 1 }],
      ["Sel", "input", 0, 1.75, { label: "S", flips: [1, 3] }],
      ["D1", "input", 0, 0.5, { label: "D_1", flips: [2] }],
      ["inv", "not", 2.5, 2.5],
      ["g1", "and", 4.5, 2.75],
      ["g2", "and", 4.5, 0.75],
      ["g3", "or", 7, 1.75],
      ["Y", "output", 9, 1.75, { label: "Y" }]
    ],
    [["j", 1.25, 1.75]],
    [
      ["D0.out", "g1.in1"],
      ["Sel.out", "j"],
      ["j", "inv.in1", { mx: 1.25 }],
      ["j", "g2.in1", { mx: 1.25 }],
      ["inv.out", "g1.in2"],
      ["D1.out", "g2.in2"],
      ["g1.out", "g3.in1", { mx: 5.75 }],
      ["g2.out", "g3.in2", { mx: 5.75 }],
      ["g3.out", "Y.in"]
    ],
    { table: true, captions: { 0: "S = 0 passes D₀", 1: "S = 1 passes D₁", 2: "D₁ rises, and Y with it", 3: "Back to D₀" } }
  ),
  template3(
    "latch",
    "SR latch (NOR)",
    [
      ["R", "input", 0, 2.75, { label: "R", flips: [3, 4] }],
      ["S", "input", 0, 0.25, { label: "S", flips: [1, 2] }],
      ["g1", "nor", 3, 2.5],
      ["g2", "nor", 3, 0.5],
      ["Q", "output", 6, 2.5, { label: "Q" }],
      ["Qn", "output", 6, 0.5, { label: "\\overline{Q}" }]
    ],
    [["q", 4.5, 2.5], ["k1", 4.5, 1.75], ["k2", 1.75, 1.75], ["qn", 4.5, 0.5], ["k3", 4.5, 1.25], ["k4", 1.5, 1.25]],
    [
      ["R.out", "g1.in1"],
      ["S.out", "g2.in2"],
      ["g1.out", "q"],
      ["q", "Q.in"],
      ["q", "k1"],
      ["k1", "k2"],
      ["k2", "g2.in1", { mx: 1.75 }],
      ["g2.out", "qn"],
      ["qn", "Qn.in"],
      ["qn", "k3"],
      ["k3", "k4"],
      ["k4", "g1.in2", { mx: 1.5 }]
    ],
    { captions: { 0: "With both inputs low, Q could be either.", 1: "S sets it: Q = 1.", 2: "S goes low, and the latch remembers.", 3: "R resets it: Q = 0.", 4: "And it holds." } }
  ),
  template3(
    "counter",
    "2-bit ripple counter",
    [["clk", "clock", 0, 1, { label: "\\mathrm{CLK}", start: 1, end: 8 }], ["f1", "dff", 3, 1.5], ["f2", "dff", 7, 1.5], ["Q0", "output", 5.75, 3.5, { label: "Q_0" }], ["Q1", "output", 9.75, 3.5, { label: "Q_1" }]],
    [["a1", 4.5, 1], ["a2", 4.5, 2.75], ["a3", 1.5, 2.75], ["b1", 8.5, 1], ["b2", 8.5, 2.75], ["b3", 5.5, 2.75]],
    [
      ["clk.out", "f1.clk"],
      ["f1.qn", "a1"],
      ["a1", "a2"],
      ["a2", "a3"],
      ["a3", "f1.d", { mx: 1.5 }],
      ["a1", "f2.clk"],
      ["f2.qn", "b1"],
      ["b1", "b2"],
      ["b2", "b3"],
      ["b3", "f2.d", { mx: 5.5 }],
      ["f1.q", "Q0.in", { mx: 4.25 }],
      ["f2.q", "Q1.in", { mx: 8.25 }]
    ],
    { captions: { 1: "The clock rises: count 1.", 3: "Q₀ falls, so its inverse rises and clocks Q₁: count 2.", 5: "Count 3.", 7: "And back to 0." } }
  ),
  { key: "blank", name: "Blank", build: () => ({ parts: [], nodes: [], wires: [], captions: {}, table: false }) }
];

// client/src/utils/freebodySolve.js
var G = 9.8;
var FORCE_KINDS = {
  weight: { name: "Weight", key: "w", label: "F_g", chips: ["F_g", "mg", "W", "F_G"] },
  normal: { name: "Normal", key: "n", label: "F_N", chips: ["F_N", "N", "n", "F_{\\perp}"] },
  friction: { name: "Friction", key: "f", label: "f", chips: ["f", "f_s", "f_k", "F_f"] },
  tension: { name: "Tension", key: "t", label: "T", chips: ["T", "T_1", "T_2", "F_T"] },
  applied: { name: "Applied", key: "a", label: "F_{\\text{app}}", chips: ["F", "F_{\\text{app}}", "P", "F_{\\text{push}}"] },
  drag: { name: "Drag", key: "d", label: "F_D", chips: ["F_D", "F_{\\text{air}}", "D", "bv"] },
  spring: { name: "Spring", key: "s", label: "F_s", chips: ["F_s", "kx", "F_{\\text{sp}}"] },
  custom: { name: "Other", key: "o", label: "F", chips: ["F", "qE", "F_E", "F_B", "F_b"] }
};
var ID4 = /^[A-Za-z0-9_-]{1,40}$/;
var HEX = /^#[0-9a-f]{6}$/i;
var num6 = (v, lo, hi, d) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
var int5 = (v, lo, hi, d) => Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d;
var str5 = (v, max, d = "") => typeof v === "string" ? v.slice(0, max) : d;
var oneOf = (v, list, d) => list.includes(v) ? v : d;
var typed = (v, d = "") => typeof v === "number" && isFinite(v) ? String(v) : typeof v === "string" ? v.slice(0, 20) : d;
var readNumber = (s) => {
  if (s == null || String(s).trim() === "") return null;
  const v = parseFloat(String(s).replace(",", "."));
  return isFinite(v) ? v : null;
};
function freebodyModel(el) {
  const b = el?.body || {}, s = el?.surface || {}, n = el?.net || {};
  const forces = [], ids = /* @__PURE__ */ new Set();
  for (const f of Array.isArray(el?.forces) ? el.forces.slice(0, 40) : []) {
    if (!f || !ID4.test(f.id) || ids.has(f.id) || !FORCE_KINDS[f.kind]) continue;
    ids.add(f.id);
    let magMode = oneOf(f.magMode, ["given", "solve", "mass", "mu"], "given");
    if (magMode === "mass" && f.kind !== "weight" || magMode === "mu" && f.kind !== "friction") magMode = "given";
    const cl = Array.isArray(f.compLabels) ? f.compLabels : [];
    forces.push({
      id: f.id,
      kind: f.kind,
      label: str5(f.label, 120, FORCE_KINDS[f.kind].label),
      magMode,
      mag: typed(f.mag),
      mu: typed(f.mu, "0.3"),
      dir: { from: oneOf(f.dir?.from, ["level", "surface"], "level"), deg: num6(f.dir?.deg, -360, 360, 0) },
      push: !!f.push,
      comps: !!f.comps,
      compLabels: [str5(cl[0], 120), str5(cl[1], 120)],
      angle: oneOf(f.angle, ["none", "level", "vertical", "surface", "normal"], "none"),
      angleLabel: str5(f.angleLabel, 60, "\\theta"),
      rope: !!f.rope,
      color: HEX.test(f.color || "") ? f.color : null,
      step: int5(f.step, 0, 1e3, 0)
    });
  }
  const captions = {};
  for (const [k, v] of Object.entries(el?.captions && typeof el.captions === "object" ? el.captions : {})) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i <= 1e3 && typeof v === "string" && v.trim()) captions[i] = v.slice(0, 300);
  }
  return {
    body: { shape: oneOf(b.shape, ["box", "ball", "dot"], "box"), w: num6(b.w, 0.3, 6, 1.6), h: num6(b.h, 0.3, 6, 1), label: str5(b.label, 60, "m"), mass: typed(b.mass) },
    surface: { kind: oneOf(s.kind, ["none", "floor", "incline", "wall", "ceiling"], "floor"), angle: num6(s.angle, -60, 60, 30), angleLabel: str5(s.angleLabel, 60, "\\theta"), show: s.show !== false },
    model: oneOf(el?.model, ["particle", "extended"], "particle"),
    axes: oneOf(el?.axes, ["none", "level", "surface"], "level"),
    motion: oneOf(el?.motion, ["rest", "slide", "free"], "rest"),
    forceScale: num6(el?.forceScale, 0.01, 1e6, 10),
    values: !!el?.values,
    net: { show: n.show !== false, step: int5(n.step, 0, 1e3, 0), label: str5(n.label, 60, "F_{\\text{net}}") },
    forces,
    captions,
    color: HEX.test(el?.color || "") ? el.color : "#ffffff",
    stepStart: int5(el?.stepStart, 1, 1e3, 1),
    dimPast: !!el?.dimPast
  };
}
var D2R = Math.PI / 180;
var uvec = (deg) => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
var add = (a, b) => [a[0] + b[0], a[1] + b[1]];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
var mul = (a, k) => [a[0] * k, a[1] * k];
var dot = (a, b) => a[0] * b[0] + a[1] * b[1];
var len = (a) => Math.hypot(a[0], a[1]);
var angOf = (v) => Math.atan2(v[1], v[0]) / D2R;
var wrap180 = (d) => {
  d = ((d + 180) % 360 + 360) % 360 - 180;
  return d === -180 ? 180 : d;
};
var angDiff = (a, b) => wrap180(b - a);
function alpha(m) {
  const k = m.surface.kind;
  return k === "incline" ? m.surface.angle : k === "wall" ? -90 : k === "ceiling" ? 180 : 0;
}
var bodyRot = (m) => m.surface.kind === "none" ? 0 : alpha(m);
function half(m) {
  const b = m.body;
  if (b.shape === "dot") return [0.09, 0.09];
  if (b.shape === "ball") return [b.h / 2, b.h / 2];
  return [b.w / 2, b.h / 2];
}
var absDeg = (m, f) => (f.dir.from === "surface" ? alpha(m) : 0) + f.dir.deg;
function axesFrame(m) {
  const a = m.axes === "surface" ? alpha(m) : 0;
  return [uvec(a), uvec(a + 90)];
}
function contact(m) {
  return mul(uvec(alpha(m) + 90), -half(m)[1]);
}
function boundary(m, u) {
  const [hw, hh] = half(m);
  if (m.body.shape !== "box") return mul(u, hw);
  const r = -bodyRot(m) * D2R;
  const lx = u[0] * Math.cos(r) - u[1] * Math.sin(r), ly = u[0] * Math.sin(r) + u[1] * Math.cos(r);
  const t = Math.min(Math.abs(lx) > 1e-9 ? hw / Math.abs(lx) : Infinity, Math.abs(ly) > 1e-9 ? hh / Math.abs(ly) : Infinity);
  return mul(u, t);
}
function solveFreebody(m) {
  const fs = m.forces, mass = readNumber(m.body.mass);
  const out = { mag: {}, how: {}, notes: [], net: [0, 0], acc: null, status: "ok", unknowns: 0 };
  const note = (text, ...labels) => {
    if (!out.notes.some((n3) => n3.text === text && n3.labels.join() === labels.join())) out.notes.push({ text, labels });
  };
  const normal = fs.find((f) => f.kind === "normal");
  const vars = [], expr = {};
  for (const f of fs) {
    if (f.magMode === "solve" && m.motion !== "free") {
      expr[f.id] = { c: 0, k: { [vars.length]: 1 } };
      vars.push({ id: f.id, label: f.label });
    }
  }
  for (const f of fs) {
    if (expr[f.id] !== void 0 || f.magMode === "mu") continue;
    if (f.magMode === "mass") {
      expr[f.id] = mass != null ? { c: mass * G, k: {} } : null;
      if (mass == null) note("{0} is mg, but the body has no mass yet.", f.label);
    } else if (f.magMode === "given") {
      const v = readNumber(f.mag);
      expr[f.id] = v != null ? { c: v, k: {} } : null;
    } else {
      expr[f.id] = null;
      note("Nothing is worked out in free motion: give {0} a value.", f.label);
    }
  }
  for (const f of fs) {
    if (f.magMode !== "mu") continue;
    const mu = readNumber(f.mu), ne = normal ? expr[normal.id] : null;
    if (!normal) note("{0} is μ times the normal force, but there’s no normal force.", f.label);
    expr[f.id] = mu != null && ne ? { c: mu * ne.c, k: Object.fromEntries(Object.entries(ne.k).map(([i, v]) => [i, mu * v])) } : null;
  }
  const s = uvec(alpha(m));
  let accVar = -1;
  if (m.motion === "slide") {
    if (mass == null) note("Give the body a mass to work out how fast it slides.");
    else {
      accVar = vars.length;
      vars.push({ acc: true, label: "a" });
    }
  }
  const n = vars.length;
  const A = [new Array(n).fill(0), new Array(n).fill(0)], b = [0, 0];
  for (const f of fs) {
    const e = expr[f.id];
    if (!e) continue;
    const u = uvec(absDeg(m, f));
    for (let r = 0; r < 2; r++) {
      b[r] -= u[r] * e.c;
      for (const [k, v] of Object.entries(e.k)) A[r][k] += u[r] * v;
    }
  }
  if (accVar >= 0) for (let r = 0; r < 2; r++) A[r][accVar] -= mass * s[r];
  out.unknowns = n;
  let x = null;
  if (n === 0) x = [];
  else if (n === 1) {
    const c = [A[0][0], A[1][0]], cc = dot(c, c);
    if (cc > 1e-12) x = [dot(b, c) / cc];
    else {
      out.status = "unsolved";
      note("{0} has nothing to balance: it doesn’t enter the sums.", vars[0].label);
    }
  } else if (n === 2) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    if (Math.abs(det) < 1e-9) {
      out.status = "unsolved";
      note("{0} and {1} act along one line, so they can’t both be worked out.", vars[0].label, vars[1].label);
    } else x = [(b[0] * A[1][1] - A[0][1] * b[1]) / det, (A[0][0] * b[1] - b[0] * A[1][0]) / det];
  } else {
    out.status = "unsolved";
    note(`${n} unknowns: only two can be worked out. Give the others values.`);
  }
  const value = (e) => {
    if (!e) return null;
    let v = e.c;
    for (const [k, c] of Object.entries(e.k)) {
      if (!x) return null;
      v += c * x[k];
    }
    return isFinite(v) ? v : null;
  };
  for (const f of fs) {
    const v = value(expr[f.id]);
    out.mag[f.id] = v;
    out.how[f.id] = v == null && f.magMode === "given" ? "none" : f.magMode;
    if (v == null && f.magMode === "given") note("{0} has no value, so it isn’t counted.", f.label);
    if (v != null && v < -1e-9) {
      if (f.kind === "normal") note("{0} comes out negative: the body would leave the surface.", f.label);
      else if (f.kind === "tension") note("{0} comes out negative: a rope can only pull.", f.label);
      else if (f.kind === "friction") note("{0} comes out negative, so friction points the other way. It’s drawn that way.", f.label);
      else if (f.magMode === "solve") note("{0} comes out negative, so it points the other way. It’s drawn that way.", f.label);
    }
    if (v != null) out.net = add(out.net, mul(uvec(absDeg(m, f)), v));
  }
  if (Math.abs(out.net[0]) < 1e-9) out.net[0] = 0;
  if (Math.abs(out.net[1]) < 1e-9) out.net[1] = 0;
  if (m.motion === "rest") {
    out.acc = [0, 0];
    if (len(out.net) > 1e-6 && n === 1 && x) note("With only {0} unknown, the forces can’t balance: what’s left is the net force.", vars[0].label);
  } else if (m.motion === "slide") out.acc = accVar >= 0 && x ? mul(s, x[accVar]) : null;
  else out.acc = mass ? mul(out.net, 1 / mass) : null;
  return out;
}

// client/src/utils/freebodyDiagram.js
var FREEBODY_UNIT = 56;
var DEFAULT_LEN = 1.6;
var MAX_LEN = 12;
var CAPTION4 = 0.3;
var esc5 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n15 = (v) => String(Math.round(v * 10) / 10);
function sig3(v) {
  const a = Math.abs(v);
  if (a < 5e-3) return "0";
  return a >= 100 ? String(Math.round(v)) : String(Number(v.toPrecision(3)));
}
var PUSHABLE = (k) => !["weight", "normal", "friction"].includes(k);
var isPush = (m, f) => m.model === "extended" && f.push && PUSHABLE(f.kind);
function forceGeom(m, f, sol) {
  const mag = sol.mag[f.id];
  let deg = absDeg(m, f);
  if (mag != null && mag < 0) deg += 180;
  const u = uvec(deg);
  const L = mag == null ? DEFAULT_LEN : Math.min(MAX_LEN, Math.max(0.3, Math.abs(mag) / m.forceScale));
  let tail = [0, 0];
  if (m.model === "extended") {
    if (f.kind === "normal" || f.kind === "friction") tail = m.surface.kind === "none" ? boundary(m, mul(u, -1)) : contact(m);
    else if (isPush(m, f)) tail = sub(boundary(m, mul(u, -1)), mul(u, L));
    else if (f.kind !== "weight") tail = boundary(m, u);
  }
  return { u, deg, L, tail, head: add(tail, mul(u, L)) };
}
function ropeGeom(m, f, sol) {
  const g = forceGeom(m, f, sol), u = uvec(absDeg(m, f));
  const start = m.body.shape === "dot" ? [0, 0] : boundary(m, u);
  return { u, start, end: add(start, mul(u, Math.max(2.6, g.L + 0.9))) };
}
function surfaceGeom(m) {
  const k = m.surface.kind;
  if (k === "none") return null;
  const a = alpha(m), s = uvec(a), n = uvec(a + 90), P = contact(m);
  if (k === "incline") {
    const E1 = add(P, mul(s, -3.2)), E2 = add(P, mul(s, 2));
    const low = E1[1] <= E2[1] ? E1 : E2, high = low === E1 ? E2 : E1;
    return { k, a, s, n, P, line: [E1, E2], low, high, B: [high[0], low[1]] };
  }
  return { k, a, s, n, P, line: [add(P, mul(s, -2.6)), add(P, mul(s, 2.6))] };
}
function inclineArc(sg) {
  const a0 = sg.B[0] > sg.low[0] ? 0 : 180;
  return { a0, d: angDiff(a0, angOf(sub(sg.high, sg.low))) };
}
function angleRef(m, f, deg) {
  const a = alpha(m);
  const cands = f.angle === "level" ? [0, 180] : f.angle === "vertical" ? [90, -90] : f.angle === "surface" ? [a, a + 180] : f.angle === "normal" ? [a + 90, a - 90] : [];
  let best = null;
  for (const c of cands) if (best == null || Math.abs(angDiff(c, deg)) < Math.abs(angDiff(best, deg))) best = c;
  return best;
}
function compLabel(label, axis) {
  if (label.endsWith("}")) {
    let depth = 0, i = label.length - 1;
    for (; i >= 0; i--) {
      depth += label[i] === "}" ? 1 : label[i] === "{" ? -1 : 0;
      if (!depth) break;
    }
    if (i > 0 && label[i - 1] === "_") return `${label.slice(0, i - 1)}_{${label.slice(i + 1, -1)},${axis}}`;
  }
  const m = /^(.*)_([A-Za-z0-9])$/.exec(label);
  if (m) return `${m[1]}_{${m[2]},${axis}}`;
  return label.includes("_") ? `{${label}}_${axis}` : `${label}_${axis}`;
}
function labelText(m, f, sol) {
  const v = sol.mag[f.id];
  return m.values && v != null ? `${f.label} = ${sig3(Math.abs(v))}\\,\\text{N}` : f.label;
}
var netLabel = (m, sol) => m.values ? `${m.net.label} = ${sig3(len(sol.net))}\\,\\text{N}` : m.net.label;
var netShown = (m, sol) => m.net.show && len(sol.net) > 0.01;
function netGeom(m, sol, box) {
  if (!netShown(m, sol)) return null;
  const u = mul(sol.net, 1 / len(sol.net)), L = Math.min(MAX_LEN, Math.max(0.3, len(sol.net) / m.forceScale));
  const xs = (isFinite(box.x1) ? box.x1 : 1) + 0.8;
  const tail = [xs + Math.max(0, -u[0]) * L, -(u[1] * L) / 2];
  let side = [-u[1], u[0]];
  if (Math.abs(side[0]) > 0.2 ? side[0] < 0 : side[1] < 0) side = mul(side, -1);
  return { u, L, tail, head: add(tail, mul(u, L)), mid: add(tail, mul(u, L / 2)), side };
}
function bodyLabelAt(m, sol) {
  const dirs = [];
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol);
    if (len(g.tail) < 0.05) dirs.push(g.deg);
  }
  if (m.axes !== "none") {
    const a = m.axes === "surface" ? alpha(m) : 0;
    dirs.push(a, a + 90, a + 180, a - 90);
  }
  if (!dirs.length) return [0, 0];
  let best = 45, score = -1;
  for (let k = 0; k < 16; k++) {
    const c = 45 + k * 22.5, d = Math.min(...dirs.map((x) => Math.abs(angDiff(c, x))));
    if (d > score + 1e-6) {
      score = d;
      best = c;
    }
  }
  return mul(uvec(best), m.body.shape === "dot" ? 0.42 : 0.36);
}
function drawFreebody(m, o = {}) {
  const u = o.U || FREEBODY_UNIT, ink = o.ink || m.color;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const step = deck != null ? null : o.step ?? null;
  const sol = o.sol || solveFreebody(m);
  const bx = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const ext = (p, r = 0) => {
    bx.x0 = Math.min(bx.x0, p[0] - r);
    bx.y0 = Math.min(bx.y0, p[1] - r);
    bx.x1 = Math.max(bx.x1, p[0] + r);
    bx.y1 = Math.max(bx.y1, p[1] + r);
  };
  const X = (p) => n15(p[0] * u), Y = (p) => n15(-p[1] * u);
  const fs = 0.4 * u;
  const shown = (s) => step == null || s <= step;
  const part2 = (s, inner) => deck != null && s > 0 ? `<g class="pxfx-part" data-fx-at="${s}">${inner}</g>` : inner;
  const line = (a, b, attrs) => `<path d="M${X(a)} ${Y(a)}L${X(b)} ${Y(b)}" ${attrs}/>`;
  function label(tex, at, dir, size, color2) {
    const b = texBox(tex, size);
    const reach = (Math.abs(dir[0]) * b.w / 2 + Math.abs(dir[1]) * b.h / 2) / u + 0.14;
    const c = add(at, mul(dir, reach));
    ext([c[0] - b.w / 2 / u, c[1] - b.h / 2 / u]);
    ext([c[0] + b.w / 2 / u, c[1] + b.h / 2 / u]);
    const Xc = c[0] * u, Yc = -c[1] * u;
    if (o.labels === "deck" || typeof o.labels === "function") {
      const w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc5(tex)}" style="font-family:${esc5(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n15(Xc - w / 2)}" y="${n15(Yc - h / 2)}" width="${n15(w)}" height="${n15(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n15(size / 1.21)}px;color:${esc5(color2)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, Xc, Yc, size, color2);
  }
  function arrow(t, h, color2, w, dash) {
    const v = sub(h, t), L = len(v);
    if (L < 1e-6) return { shaft: "", head: "" };
    const e = mul(v, 1 / L), k = w / 2.6, hl = Math.min(0.3 * k, L * 0.6), hw2 = 0.115 * k + 0.02;
    const base = sub(h, mul(e, hl * 0.82)), p = [-e[1], e[0]], back2 = sub(h, mul(e, hl));
    const a = add(back2, mul(p, hw2)), c = sub(back2, mul(p, hw2));
    ext(h, 0.15);
    ext(t);
    return {
      shaft: `<path${deck != null && !dash ? ' class="pxfx-reveal" pathLength="1"' : ""} d="M${X(t)} ${Y(t)}L${X(base)} ${Y(base)}" stroke="${esc5(color2)}" stroke-width="${n15(w * u / 46)}" stroke-linecap="round" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
      head: `<path d="M${X(h)} ${Y(h)}L${X(a)} ${Y(a)}L${X(c)} ${Y(c)}Z" fill="${esc5(color2)}"/>`
    };
  }
  function hatch(a, b, out) {
    const L = len(sub(b, a)), s = mul(sub(b, a), 1 / L), d = mul(add(out, mul(s, -0.85)), 1 / Math.hypot(1, 0.85));
    let p = "";
    for (let t = 0.12; t < L - 0.05; t += 0.22) {
      const q = add(a, mul(s, t)), r = add(q, mul(d, 0.24));
      p += `M${X(q)} ${Y(q)}L${X(r)} ${Y(r)}`;
      ext(r);
    }
    return `<path d="${p}" stroke="${esc5(ink)}" stroke-opacity=".5" stroke-width="1.2" fill="none"/>`;
  }
  const lw = (w) => n15(w * u / 46);
  let back = "", mid = "", front = "", top = "";
  const sg = surfaceGeom(m);
  if (sg && m.surface.show) {
    if (sg.k === "incline") {
      const { low, high, B } = sg;
      back += `<path d="M${X(low)} ${Y(low)}L${X(B)} ${Y(B)}L${X(high)} ${Y(high)}Z" fill="${esc5(ink)}" fill-opacity=".07" stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`;
      back += hatch(low, B, [0, -1]);
      ext(low);
      ext(high);
      ext(B);
      const { a0, d } = inclineArc(sg);
      if (Math.abs(d) > 1) {
        const r = 0.85, p0 = add(low, mul(uvec(a0), r)), p1 = add(low, mul(uvec(a0 + d), r));
        back += `<path d="M${X(p0)} ${Y(p0)}A${n15(r * u)} ${n15(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc5(ink)}" stroke-width="${lw(1.4)}" fill="none"/>`;
        back += label(m.surface.angleLabel || "\\theta", add(low, mul(uvec(a0 + d / 2), r)), uvec(a0 + d / 2), fs * 0.9, ink);
      }
    } else {
      back += line(sg.line[0], sg.line[1], `stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linecap="round"`);
      back += hatch(sg.line[0], sg.line[1], mul(sg.n, -1));
      ext(sg.line[0]);
      ext(sg.line[1]);
    }
  }
  if (m.axes !== "none") {
    const [ex2, ey2] = axesFrame(m), r = 2.3;
    for (const [e, nm] of [[ex2, "x"], [ey2, "y"]]) {
      const a = mul(e, -r), b = mul(e, r), p = [-e[1], e[0]], hb = sub(b, mul(e, 0.2));
      mid += line(a, sub(b, mul(e, 0.12)), `stroke="${esc5(ink)}" stroke-opacity=".45" stroke-width="${lw(1.2)}"`);
      mid += `<path d="M${X(b)} ${Y(b)}L${X(add(hb, mul(p, 0.07)))} ${Y(add(hb, mul(p, 0.07)))}L${X(sub(hb, mul(p, 0.07)))} ${Y(sub(hb, mul(p, 0.07)))}Z" fill="${esc5(ink)}" fill-opacity=".45"/>`;
      mid += `<g opacity=".6">${label(nm, b, e, fs * 0.8, ink)}</g>`;
      ext(a);
      ext(b);
    }
  }
  for (const f of m.forces) {
    if (!f.rope || !m.surface.show) continue;
    const { u: d, start, end } = ropeGeom(m, f, sol), p = [-d[1], d[0]];
    ext(end, 0.45);
    if (!shown(f.step)) continue;
    mid += part2(f.step, line(start, end, `stroke="${esc5(ink)}" stroke-opacity=".55" stroke-width="${lw(1.6)}"`) + line(add(end, mul(p, 0.38)), sub(end, mul(p, 0.38)), `stroke="${esc5(ink)}" stroke-width="${lw(2.2)}" stroke-linecap="round"`) + hatch(sub(end, mul(p, 0.38)), add(end, mul(p, 0.38)), d));
  }
  const [hw, hh] = half(m);
  const bodyHit = o.editor ? ' data-body="1"' : "";
  if (m.body.shape === "box") {
    const r = bodyRot(m) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [x * cs - y * sn, x * sn + y * cs]);
    pts.forEach((p) => ext(p));
    mid += `<path${bodyHit} d="M${pts.map((p) => `${X(p)} ${Y(p)}`).join("L")}Z" fill="${esc5(ink)}" fill-opacity=".1" stroke="${esc5(ink)}" stroke-width="${lw(2)}" stroke-linejoin="round"/>`;
  } else if (m.body.shape === "ball") {
    ext([0, 0], hw);
    mid += `<circle${bodyHit} cx="0" cy="0" r="${n15(hw * u)}" fill="${esc5(ink)}" fill-opacity=".1" stroke="${esc5(ink)}" stroke-width="${lw(2)}"/>`;
  }
  if (m.body.shape === "dot" || m.model === "particle") {
    const dot0 = m.body.shape === "dot";
    mid += `<circle cx="0" cy="0" r="${n15((dot0 ? 0.11 : 0.06) * u)}" fill="${esc5(ink)}"/>`;
    if (dot0 && o.editor) mid += `<circle data-body="1" cx="0" cy="0" r="${n15(0.45 * u)}" fill="#000" fill-opacity="0"/>`;
    ext([0, 0], 0.2);
  }
  if (m.body.label) {
    const at = bodyLabelAt(m, sol);
    mid += `<g opacity=".85">${label(m.body.label, at, [0, 0], fs * 0.85, ink)}</g>`;
  }
  const [ex, ey] = axesFrame(m);
  for (const f of m.forces) {
    const g = forceGeom(m, f, sol), color2 = f.color || ink;
    if (!shown(f.step)) {
      ext(g.head, 0.6);
      ext(g.tail);
      continue;
    }
    let fade = "";
    if (f.comps && m.axes !== "none") {
      const vec = mul(g.u, g.L);
      for (const [e, k, lb] of [[ex, dot(vec, ex), f.compLabels[0] || compLabel(f.label, "x")], [ey, dot(vec, ey), f.compLabels[1] || compLabel(f.label, "y")]]) {
        if (Math.abs(k) < 0.08) continue;
        const tip = add(g.tail, mul(e, k)), a2 = arrow(g.tail, tip, color2, 1.7, `${n15(6 * u / 46)} ${n15(4 * u / 46)}`);
        fade += line(g.head, tip, `stroke="${esc5(color2)}" stroke-opacity=".55" stroke-width="${lw(1.1)}" stroke-dasharray="${n15(2 * u / 46)} ${n15(4 * u / 46)}"`) + a2.shaft + a2.head;
        fade += label(lb, tip, mul(e, Math.sign(k)), fs * 0.82, color2);
      }
    }
    if (f.angle !== "none") {
      const ref = angleRef(m, f, g.deg), d = ref == null ? 0 : angDiff(ref, g.deg);
      if (Math.abs(d) > 1) {
        const r = Math.min(0.75, g.L * 0.55), p0 = add(g.tail, mul(uvec(ref), r)), p1 = add(g.tail, mul(uvec(ref + d), r));
        fade += `<path d="M${X(p0)} ${Y(p0)}A${n15(r * u)} ${n15(r * u)} 0 0 ${d > 0 ? 0 : 1} ${X(p1)} ${Y(p1)}" stroke="${esc5(color2)}" stroke-width="${lw(1.3)}" fill="none"/>`;
        fade += label(f.angleLabel || "\\theta", add(g.tail, mul(uvec(ref + d / 2), r)), uvec(ref + d / 2), fs * 0.8, color2);
        if (f.angle === "level" || f.angle === "vertical") fade += line(g.tail, add(g.tail, mul(uvec(ref), r + 0.35)), `stroke="${esc5(color2)}" stroke-opacity=".5" stroke-width="${lw(1.1)}" stroke-dasharray="${n15(3 * u / 46)} ${n15(3 * u / 46)}"`);
      }
    }
    const a = arrow(g.tail, g.head, color2, 2.6, "");
    fade = a.head + label(labelText(m, f, sol), g.head, g.u, fs, color2) + fade;
    let s = "";
    if (o.editor && o.sel === f.id) s += line(g.tail, g.head, `stroke="${esc5(o.accent)}" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"`);
    s += a.shaft + (deck != null && f.step > 0 ? `<g class="pxfx-fade">${fade}</g>` : fade);
    if (o.editor) {
      s += `<path data-f="${esc5(f.id)}" d="M${X(g.tail)} ${Y(g.tail)}L${X(g.head)} ${Y(g.head)}" stroke="#000" stroke-opacity="0" stroke-width="18" stroke-linecap="round" fill="none"/>`;
      if (o.sel === f.id) {
        const hp = isPush(m, f) ? g.tail : g.head;
        top += `<circle data-h="${esc5(f.id)}" cx="${X(hp)}" cy="${Y(hp)}" r="7" fill="${esc5(o.accent)}" stroke="${esc5(o.bg || "#fff")}" stroke-width="2"><title>Drag to turn it</title></circle>`;
      }
    }
    front += part2(f.step, `<g>${s}</g>`);
  }
  const ng = netGeom(m, sol, { ...bx });
  if (ng) {
    ext(ng.tail);
    ext(ng.head, 0.15);
    const nl = netLabel(m, sol);
    const lb = label(nl, add(ng.mid, mul(ng.side, 0.05)), ng.side, fs, ink);
    if (shown(m.net.step)) {
      const a = arrow(ng.tail, ng.head, ink, 2.2, `${n15(7 * u / 46)} ${n15(5 * u / 46)}`);
      const inner = a.shaft + a.head + lb;
      front += part2(m.net.step, deck != null && m.net.step > 0 ? `<g class="pxfx-fade">${inner}</g>` : inner);
    }
  }
  if (!isFinite(bx.x0)) ext([0, 0], 2);
  const box = { x0: bx.x0 * u, x1: bx.x1 * u, y0: -bx.y1 * u, y1: -bx.y0 * u };
  let caps = "";
  const capSteps = Object.keys(m.captions || {}).map(Number).sort((a, b) => a - b);
  if (o.captions && capSteps.length) {
    const cs = CAPTION4 * u, w = Math.max(box.x1 - box.x0, 6 * u), cx = (box.x0 + box.x1) / 2, y = box.y1 + cs * 0.6, h = cs * 2.8;
    const one = (n, cls) => {
      const text = m.captions[n];
      if (o.labels === "text" || !o.labels) return `<text${cls} x="${n15(cx)}" y="${n15(y + cs)}" text-anchor="middle" font-size="${n15(cs)}" fill="${esc5(ink)}">${esc5(text)}</text>`;
      return `<foreignObject${cls} x="${n15(cx - w / 2)}" y="${n15(y)}" width="${n15(w)}" height="${n15(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n15(cs)}px;line-height:1.3;color:${esc5(ink)}">${esc5(text)}</div></foreignObject>`;
    };
    if (deck != null) caps = capSteps.map((n) => one(n, ` class="pxfx-cap" data-fx-cap="${n}"`)).join("");
    else {
      const at = capSteps.filter((n) => n <= (step ?? 0)).pop();
      if (at != null) caps = one(at, "");
    }
    box.x0 = Math.min(box.x0, cx - w / 2);
    box.x1 = Math.max(box.x1, cx + w / 2);
    box.y1 = Math.max(box.y1, y + h);
  }
  return { svg: back + mid + front + top + caps, box, sol, net: ng };
}
var baseOptions3 = (m) => ({ ink: m.color, captions: true });
function freebodyBox(el) {
  const m = freebodyModel(el);
  const { box } = drawFreebody(m, baseOptions3(m));
  const pad = 0.2 * FREEBODY_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function freebodySvg(el, opts = {}) {
  const m = freebodyModel(el), b = freebodyBox(el);
  const { svg } = drawFreebody(m, { ...baseOptions3(m), labels: opts.labels || "text", deck: opts.deck, step: opts.step ?? null });
  const size = opts.standalone ? ` width="${n15(b.w)}" height="${n15(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n15(b.x)} ${n15(b.y)} ${n15(b.w)} ${n15(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function freebodySteps(el) {
  if (el?.type !== "freebody") return [];
  const m = freebodyModel(el), steps = /* @__PURE__ */ new Set();
  for (const f of m.forces) if (f.step > 0) steps.add(f.step);
  if (m.net.show && m.net.step > 0 && netShown(m, solveFreebody(m))) steps.add(m.net.step);
  for (const k of Object.keys(m.captions)) if (+k > 0) steps.add(+k);
  return [...steps].sort((a, b) => a - b).map((s) => [m.stepStart - 1 + s, s]).filter(([n]) => n <= 1e3);
}
function freebodyStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of freebodySteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasFreebody(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "freebody"));
}

// client/src/utils/vennExpr.js
var OVERLINE = String.fromCharCode(773);
var MAX_MEMBERS = 200;
var popcount = (m) => {
  let c = 0;
  while (m) {
    c += m & 1;
    m >>>= 1;
  }
  return c;
};
var fullMask = (n) => (1 << (1 << n)) - 1;
var has = (mask, m) => (mask >>> m & 1) === 1;
function setMask(i, n) {
  let r = 0;
  for (let m = 0; m < 1 << n; m++) if (m >> i & 1) r |= 1 << m;
  return r;
}
function regionsOf(mask, n) {
  const out = [];
  for (let m = 0; m < 1 << n; m++) if (has(mask, m)) out.push(m);
  return out;
}
var WORDS = {
  or: "or",
  union: "or",
  cup: "or",
  and: "and",
  intersect: "and",
  intersection: "and",
  cap: "and",
  minus: "diff",
  without: "diff",
  setminus: "diff",
  except: "diff",
  xor: "xor",
  symdiff: "xor",
  not: "not",
  complement: "not",
  empty: "empty",
  emptyset: "empty"
};
var CMDS = {
  cup: "or",
  lor: "or",
  vee: "or",
  bigcup: "or",
  cap: "and",
  land: "and",
  wedge: "and",
  bigcap: "and",
  cdot: "and",
  setminus: "diff",
  smallsetminus: "diff",
  backslash: "diff",
  triangle: "xor",
  vartriangle: "xor",
  bigtriangleup: "xor",
  triangleup: "xor",
  Delta: "xor",
  ominus: "xor",
  oplus: "xor",
  veebar: "xor",
  neg: "not",
  lnot: "not",
  complement: "not",
  overline: "bar",
  bar: "bar",
  widebar: "bar",
  overbar: "bar",
  emptyset: "empty",
  varnothing: "empty",
  prime: "comp"
};
var SKIP = /* @__PURE__ */ new Set(["left", "right", "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr", "middle", ",", ";", ":", "!", "quad", "qquad", "displaystyle", "textstyle"]);
var WRAP = /* @__PURE__ */ new Set(["mathrm", "text", "textrm", "mathsf", "mathit", "mathbf", "textit", "operatorname", "mathnormal", "mathbin"]);
var REL_CMDS = { neq: "≠", ne: "≠", subseteq: "⊆", subset: "⊆", supseteq: "⊇", supset: "⊇", equiv: "=", subsetneq: "⊂", supsetneq: "⊃" };
var REL_CHARS = { "=": "=", "≡": "=", "≠": "≠", "⊆": "⊆", "⊂": "⊆", "⊇": "⊇", "⊃": "⊇", "⊊": "⊂", "⊋": "⊃" };
var CHAR_OPS = {
  "∪": "or",
  "|": "or",
  "+": "or",
  "∨": "or",
  "∩": "and",
  "&": "and",
  "∧": "and",
  "·": "and",
  "⋅": "and",
  "*": "and",
  "∖": "diff",
  "-": "diff",
  "−": "diff",
  "Δ": "xor",
  "△": "xor",
  "∆": "xor",
  "⊕": "xor",
  "⊖": "xor",
  "⊻": "xor",
  "¬": "not",
  "~": "not",
  "!": "not",
  "∅": "empty",
  "⌀": "empty",
  "Ø": "empty",
  "'": "comp",
  "′": "comp",
  "ᶜ": "comp",
  "(": "lp",
  "[": "lp",
  "{": "lp",
  ")": "rp",
  "]": "rp",
  "}": "rp"
};
var UNIVERSE_CHARS = ["Ω", "ξ", "ℰ", "𝒰", "ε"];
var UNIVERSE_CMDS = { Omega: 1, xi: 1, varepsilon: 1 };
var UNIVERSE_TEXT = { "\\Omega": "Ω", "\\xi": "ξ", "\\mathcal{E}": "ℰ", "\\mathcal{U}": "𝒰", "\\varepsilon": "ε" };
var OP_TEXT = { or: "∪", and: "∩", diff: "∖", xor: "Δ", not: "′", comp: "′", lp: "(", rp: ")" };
function fail(msg, at, len2) {
  const e = new Error(msg);
  e.at = at;
  e.len = len2 || 1;
  e.venn = true;
  throw e;
}
var listNames = (ids) => ids.length === 1 ? ids[0] : ids.slice(0, -1).join(", ") + " and " + ids[ids.length - 1];
function tokenize2(src, ctx) {
  const toks = [];
  const ids = ctx.ids;
  const uni = String(ctx.universe || "U");
  const uniLetter = /^[A-Za-z]$/.test(uni) && !ids.includes(uni) ? uni : null;
  const push = (k, at, len2, v) => toks.push({ k, at, len: len2, v });
  function letter(c, at) {
    if (ids.includes(c)) return push("set", at, 1, ids.indexOf(c));
    if (c === uniLetter || c === "U" && !ids.includes("U")) return push("U", at, 1);
    const up = c.toUpperCase(), lo = c.toLowerCase();
    const alt = c === up ? lo : up;
    if (ids.includes(alt) && !ids.includes(c)) return push("set", at, 1, ids.indexOf(alt));
    fail(`There's no set ${c}. The sets here are ${listNames(ids)}.`, at, 1);
  }
  function readGroup(i2) {
    let depth = 0;
    for (let j = i2; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") {
        depth--;
        if (depth === 0) return [src.slice(i2 + 1, j), j + 1];
      }
    }
    fail("A { here is never closed.", i2, 1);
  }
  const skipBraces = /* @__PURE__ */ new Set();
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      if (!m) {
        push("diff", i, 1);
        i++;
        continue;
      }
      const name = m[1], at = i;
      i += m[0].length;
      if (name === " " || name === "\\") {
        push("diff", at, 1);
        continue;
      }
      if (SKIP.has(name)) {
        if ((name === "left" || name === "right") && src[i] === ".") i++;
        continue;
      }
      if (name === "{") {
        if (src.startsWith("\\}", i)) {
          push("empty", at, i + 2 - at);
          i += 2;
          continue;
        }
        fail("Lists of members go in the panel’s Elements box, not in the expression.", at, 2);
      }
      if (WRAP.has(name)) {
        while (src[i] === " ") i++;
        if (src[i] === "{") {
          const close = readGroup(i)[1] - 1;
          skipBraces.add(close);
          i++;
        }
        continue;
      }
      if (name === "mathcal" || name === "mathscr" || name === "mathbb") {
        while (src[i] === " ") i++;
        let inner, next;
        if (src[i] === "{") [inner, next] = readGroup(i);
        else {
          inner = src[i] || "";
          next = i + 1;
        }
        i = next;
        if (/^\s*[UE]\s*$/.test(inner)) {
          push("U", at, i - at);
          continue;
        }
        fail(`\\${name}{${inner}} isn't a set here.`, at, i - at);
      }
      if (UNIVERSE_CMDS[name]) {
        push("U", at, i - at);
        continue;
      }
      if (REL_CMDS[name]) {
        push("rel", at, i - at, REL_CMDS[name]);
        continue;
      }
      if (CMDS[name]) {
        const k = CMDS[name];
        if (k === "not" && name === "complement" && toks.length && endsAtom(toks[toks.length - 1])) {
          push("comp", at, i - at);
          continue;
        }
        push(k, at, i - at);
        continue;
      }
      if (/^[A-Za-z]$/.test(name) && ids.includes(name)) {
        push("diff", at, 1);
        push("set", at + 1, 1, ids.indexOf(name));
        continue;
      }
      fail(`\\${name} isn't something a set expression can use.`, at, i - at);
    }
    if (c === "^") {
      const at = i;
      i++;
      while (src[i] === " ") i++;
      let inner;
      if (src[i] === "{") {
        const g = readGroup(i);
        inner = g[0];
        i = g[1];
      } else if (src[i] === "\\") {
        const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
        inner = m[0];
        i += m[0].length;
      } else {
        inner = src[i] || "";
        i++;
      }
      const norm = inner.replace(/\\(mathrm|mathsf|text|textrm|mathit)\s*/g, "").replace(/[{}\s]/g, "");
      if (["c", "C", "\\complement", "∁", "\\prime", "'", "′", "\\mathcal{C}", "\\mathcalC"].includes(norm)) {
        push("comp", at, i - at);
        continue;
      }
      fail("A superscript can only be c here, for the complement: A^c.", at, i - at);
    }
    if (c === "∁") {
      push(toks.length && endsAtom(toks[toks.length - 1]) ? "comp" : "not", i, 1);
      i++;
      continue;
    }
    if (c === "!" && src[i + 1] === "=") {
      push("rel", i, 2, "≠");
      i += 2;
      continue;
    }
    if (REL_CHARS[c]) {
      push("rel", i, 1, REL_CHARS[c]);
      i++;
      continue;
    }
    const u = UNIVERSE_CHARS.find((s) => src.startsWith(s, i));
    if (u) {
      push("U", i, u.length);
      i += u.length;
      continue;
    }
    if (c === "}" && skipBraces.has(i)) {
      i++;
      continue;
    }
    if (CHAR_OPS[c]) {
      push(CHAR_OPS[c], i, 1);
      i++;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(src.slice(i));
      const run = m[0], at = i;
      i += run.length;
      if (src[i] === "_") fail("Sets are named by one letter, without subscripts. Their labels on the diagram can be anything.", i, 1);
      const w = WORDS[run.toLowerCase()];
      if (w && run.length > 1) {
        push(w, at, run.length);
        continue;
      }
      if (run.length > 3 && !run.split("").every((ch) => ids.includes(ch) || ids.includes(ch.toUpperCase()))) {
        fail(`“${run}” isn't an operation or a set. Sets are named by one letter.`, at, run.length);
      }
      for (let k = 0; k < run.length; k++) letter(run[k], at + k);
      continue;
    }
    if (/[0-9]/.test(c)) fail("Numbers go in the panel’s Facts box. Expressions are made of sets.", i, 1);
    fail(`“${c}” doesn't mean anything in a set expression.`, i, 1);
  }
  push("end", src.length, 0);
  return toks;
}
var endsAtom = (t) => t.k === "set" || t.k === "U" || t.k === "empty" || t.k === "rp" || t.k === "comp";
var startsAtom = (t) => t.k === "set" || t.k === "U" || t.k === "empty" || t.k === "lp" || t.k === "not" || t.k === "bar";
var LEVEL1 = { or: 1, diff: 1, xor: 1 };
function parse(src, ctx) {
  src = String(src == null ? "" : src);
  const toks = tokenize2(src, ctx);
  let p = 0;
  const flags = { andInOr: false, mixed: false, implicit: false };
  const peek = () => toks[p];
  const next = () => toks[p++];
  const what = (t) => t.k === "end" ? "the end" : `“${src.slice(t.at, t.at + t.len)}”`;
  function expectAtom(after) {
    const t = peek();
    if (t.k === "end") fail(after ? `Something's missing after ${after}.` : "Type an expression, such as A ∩ (B ∪ C).", src.length, 0);
    fail(`Expected a set before ${what(t)}.`, t.at, t.len);
  }
  function parseRel() {
    const a = parseExpr();
    const t = peek();
    if (t.k === "rel") {
      next();
      const b = parseExpr();
      if (peek().k === "rel") fail("One relation at a time: compare two sides.", peek().at, peek().len);
      if (peek().k !== "end") fail(`Unexpected ${what(peek())}.`, peek().at, peek().len);
      return { t: "rel", op: t.v, a, b };
    }
    if (t.k === "rp") fail("This bracket closes one that was never opened.", t.at, t.len);
    if (t.k !== "end") fail(`Unexpected ${what(t)}.`, t.at, t.len);
    return a;
  }
  function parseExpr() {
    let left = parseTerm();
    let lastOp = null, grouped = left.paren;
    while (LEVEL1[peek().k]) {
      const op = next().k;
      if (lastOp && lastOp !== op) flags.mixed = true;
      if (lastOp === "diff" && op === "diff") flags.mixed = true;
      const right = parseTerm(OP_TEXT[op]);
      if (left.t === "and" && !left.paren) flags.andInOr = true;
      if (right.t === "and" && !right.paren) flags.andInOr = true;
      left = { t: op, a: left, b: right };
      lastOp = op;
    }
    return left;
  }
  function parseTerm(after) {
    let left = parseFactor(after);
    for (; ; ) {
      const t = peek();
      if (t.k === "and") {
        next();
        left = { t: "and", a: left, b: parseFactor("∩") };
        continue;
      }
      if (startsAtom(t)) {
        flags.implicit = true;
        left = { t: "and", a: left, b: parseFactor() };
        continue;
      }
      return left;
    }
  }
  function parseFactor(after) {
    if (peek().k === "not") {
      const t = next();
      return { t: "not", a: parseFactor(src.slice(t.at, t.at + t.len)) };
    }
    let a = parseAtom(after);
    while (peek().k === "comp") {
      next();
      a = { t: "not", a };
    }
    return a;
  }
  function parseAtom(after) {
    const t = peek();
    if (t.k === "set") {
      next();
      return { t: "set", i: t.v };
    }
    if (t.k === "U") {
      next();
      return { t: "U" };
    }
    if (t.k === "empty") {
      next();
      return { t: "empty" };
    }
    if (t.k === "lp") {
      next();
      if (peek().k === "rp") fail("There’s nothing inside these brackets.", t.at, peek().at - t.at + 1);
      const e = parseExpr();
      if (peek().k !== "rp") {
        if (peek().k === "end") fail("This bracket is never closed.", t.at, t.len);
        fail(`Unexpected ${what(peek())}.`, peek().at, peek().len);
      }
      next();
      return Object.assign({}, e, { paren: true });
    }
    if (t.k === "bar") {
      next();
      return { t: "not", a: parseAtom("a bar") };
    }
    expectAtom(after);
  }
  const ast = parseRel();
  const notes = [];
  if (flags.andInOr) notes.push("∩ is read before ∪, ∖ and Δ, the way × comes before +.");
  if (flags.mixed) notes.push("∪, ∖ and Δ are read from left to right. Brackets make it certain.");
  return { ast, notes, readAs: flags.andInOr || flags.mixed, implicit: flags.implicit };
}
function evaluate(node, n) {
  switch (node.t) {
    case "set":
      return setMask(node.i, n);
    case "U":
      return fullMask(n);
    case "empty":
      return 0;
    case "not":
      return fullMask(n) & ~evaluate(node.a, n);
    case "and":
      return evaluate(node.a, n) & evaluate(node.b, n);
    case "or":
      return evaluate(node.a, n) | evaluate(node.b, n);
    case "diff":
      return evaluate(node.a, n) & ~evaluate(node.b, n);
    case "xor":
      return evaluate(node.a, n) ^ evaluate(node.b, n);
  }
  throw new Error("Unknown node " + node.t);
}
var prec = (node) => LEVEL1[node.t] ? 1 : node.t === "and" ? 2 : node.t === "not" ? 3 : 4;
function needsParens(child, parent2, side) {
  const pc = prec(child);
  if (pc >= 3) return false;
  if (LEVEL1[parent2.t]) {
    if (pc === 2) return true;
    return !(side === "a" && child.t === parent2.t && (parent2.t === "or" || parent2.t === "xor"));
  }
  if (parent2.t === "and") return pc === 1 || side === "b";
  return false;
}
var escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function universeText(u) {
  return UNIVERSE_TEXT[u] || String(u).replace(/[\\{}]/g, "");
}
function format(node, style) {
  const out = style.out || "text", comp = style.comp || "prime", ids = style.ids;
  const S = out === "tex" ? { or: " \\cup ", and: " \\cap ", diff: " \\setminus ", xor: " \\mathbin{\\triangle} ", empty: "\\varnothing", U: style.universe || "U", lp: "(", rp: ")" } : { or: " ∪ ", and: " ∩ ", diff: " ∖ ", xor: " Δ ", empty: "∅", U: universeText(style.universe || "U"), lp: "(", rp: ")" };
  if (out === "html") S.U = `<i>${escHtml(S.U)}</i>`;
  if (out === "tex" && style.xor === "plain") S.xor = " \\triangle ";
  const set = (i) => out === "html" ? `<i>${escHtml(ids[i])}</i>` : ids[i];
  function f(nd) {
    switch (nd.t) {
      case "set":
        return set(nd.i);
      case "U":
        return S.U;
      case "empty":
        return S.empty;
      case "not": {
        const a = nd.a, inner = f(a), atom = prec(a) >= 3;
        if (comp === "bar") {
          if (out === "tex") return `\\overline{${inner}}`;
          if (out === "html") return `<span class="ov">${inner}</span>`;
          if (a.t === "set") return ids[a.i] + OVERLINE;
        }
        const body = atom ? inner : S.lp + inner + S.rp;
        if (comp === "c" || comp === "bar" && out === "text") return out === "tex" ? `${a.t === "not" ? `{${body}}` : body}^{c}` : out === "html" ? `${body}<sup>c</sup>` : body + "ᶜ";
        return out === "tex" ? body + "'" : body + "′";
      }
      default: {
        const l = needsParens(nd.a, nd, "a") ? S.lp + f(nd.a) + S.rp : f(nd.a);
        const r = needsParens(nd.b, nd, "b") ? S.lp + f(nd.b) + S.rp : f(nd.b);
        return l + S[nd.t] + r;
      }
    }
  }
  if (node.t === "rel") {
    const R = out === "tex" ? { "=": " = ", "≠": " \\neq ", "⊆": " \\subseteq ", "⊇": " \\supseteq ", "⊂": " \\subsetneq ", "⊃": " \\supsetneq " } : { "=": " = ", "≠": " ≠ ", "⊆": " ⊆ ", "⊇": " ⊇ ", "⊂": " ⊊ ", "⊃": " ⊋ " };
    return f(node.a) + R[node.op] + f(node.b);
  }
  return f(node);
}
var S_ = (i) => ({ t: "set", i });
var chain = (t, items) => items.reduce((acc, x) => acc ? { t, a: acc, b: x } : x, null);
var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
var REGION_ORDER = {
  1: [1, 0],
  2: [1, 3, 2, 0],
  3: [1, 3, 2, 5, 7, 6, 4, 0],
  4: [1, 2, 4, 8, 3, 5, 9, 6, 10, 12, 7, 11, 13, 14, 15, 0]
};
var regionNumber = (m, n) => ROMAN[REGION_ORDER[n].indexOf(m)];
function regionAst(m, n) {
  const lits = [];
  for (let i = 0; i < n; i++) lits.push(m >> i & 1 ? S_(i) : { t: "not", a: S_(i) });
  return chain("and", lits);
}
function parseNumber(s) {
  s = String(s).trim().replace(/\s+/g, "");
  let m = /^\\[dt]?frac\{(-?[\d.]+)\}\{([\d.]+)\}$/.exec(s);
  if (m) return +m[1] / +m[2];
  m = /^(-?[\d.]+)\/([\d.]+)$/.exec(s);
  if (m) return +m[1] / +m[2];
  m = /^(-?[\d.]+)(\\?%)$/.exec(s);
  if (m) return +m[1] / 100;
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return +s;
  return null;
}
function splitGiven(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (depth === 0 && c === "|") return [s.slice(0, i), s.slice(i + 1)];
    else if (depth === 0 && s.startsWith("\\mid", i)) return [s.slice(0, i), s.slice(i + 4)];
  }
  return [s, null];
}
function parseFact(line, ctx, n) {
  const raw = line;
  line = line.replace(/\\left|\\right|\\big|\\Big/g, "").trim();
  if (!line || line.startsWith("%") || line.startsWith("//")) return null;
  const eq = line.lastIndexOf("=");
  if (eq < 0) fail("A fact needs an equals sign: |A| = 12.", 0, raw.length);
  const lhs = line.slice(0, eq).trim(), rhs = parseNumber(line.slice(eq + 1));
  if (rhs == null) fail("The right side should be a number, such as 12, 0.35, 35% or 1/3.", eq + 1, raw.length - eq - 1);
  let m, kind = "n";
  let inner = null;
  if (m = /^\|(.*)\|$/.exec(lhs)) inner = m[1];
  else if (m = /^(?:n|N|#)\s*\((.*)\)$/.exec(lhs)) inner = m[1];
  else if (m = /^#\s*(.+)$/.exec(lhs)) inner = m[1];
  else if (m = /^(?:P|Pr|\\Pr|\\mathbb\{P\}|ℙ)\s*[([](.*)[)\]]$/.exec(lhs)) {
    inner = m[1];
    kind = "P";
  } else fail("Write a fact as |A ∩ B| = 7, n(A) = 22 or P(A) = 0.3.", 0, eq);
  const [a, b] = kind === "P" ? splitGiven(inner) : [inner, null];
  const pa = parse(a, ctx);
  if (pa.ast.t === "rel") fail("A fact measures one set, not a relation.", 0, eq);
  const out = { kind, a: evaluate(pa.ast, n), rhs };
  if (b != null) {
    const pb = parse(b, ctx);
    if (pb.ast.t === "rel") fail("A fact measures one set, not a relation.", 0, eq);
    out.b = evaluate(pb.ast, n);
  }
  return out;
}
function solveFacts(text, ctx, n, mode, shaded) {
  const R = 1 << n;
  const rows = [], notes = [], errors = [];
  const lines = String(text || "").split("\n");
  let anyP = false, anyN = false;
  lines.forEach((line, k) => {
    try {
      const f = parseFact(line, ctx, n);
      if (!f) return;
      if (f.kind === "P") anyP = true;
      else anyN = true;
      const coef = new Array(R).fill(0);
      if (f.b != null) {
        for (let m = 0; m < R; m++) coef[m] = (has(f.a & f.b, m) ? 1 : 0) - (has(f.b, m) ? f.rhs : 0);
        rows.push({ coef, rhs: 0, line: k });
      } else {
        for (let m = 0; m < R; m++) coef[m] = has(f.a, m) ? 1 : 0;
        rows.push({ coef, rhs: f.rhs, line: k });
      }
    } catch (e) {
      if (!e.venn) throw e;
      errors.push({ line: k, msg: e.message });
    }
  });
  if (mode === "probability") rows.unshift({ coef: new Array(R).fill(1), rhs: 1, line: -1 });
  if (mode === "counts" && anyP && !anyN) notes.push("These facts are probabilities. Switch to Probability to count them out of 1.");
  const basis = [];
  const eps = 1e-9;
  const contradictions = [], redundant = [];
  for (const row of rows) {
    const c = row.coef.slice();
    let r = row.rhs;
    for (const b of basis) {
      const k2 = c[b.pivot];
      if (Math.abs(k2) > eps) {
        for (let j = 0; j < R; j++) c[j] -= k2 * b.coef[j];
        r -= k2 * b.rhs;
      }
    }
    let piv = -1, big = 0;
    for (let j = 0; j < R; j++) if (Math.abs(c[j]) > big + eps) {
      big = Math.abs(c[j]);
      piv = j;
    }
    if (piv < 0 || big < 1e-7) {
      if (Math.abs(r) > 1e-6) contradictions.push(row.line);
      else if (row.line >= 0) redundant.push(row.line);
      continue;
    }
    const k = c[piv];
    for (let j = 0; j < R; j++) c[j] /= k;
    r /= k;
    for (const b of basis) {
      const kk = b.coef[piv];
      if (Math.abs(kk) > eps) {
        for (let j = 0; j < R; j++) b.coef[j] -= kk * c[j];
        b.rhs -= kk * r;
      }
    }
    basis.push({ coef: c, rhs: r, pivot: piv });
  }
  const pivotOf = new Map(basis.map((b) => [b.pivot, b]));
  const free = [];
  for (let j = 0; j < R; j++) if (!pivotOf.has(j)) free.push(j);
  const value = new Array(R).fill(null);
  for (let m = 0; m < R; m++) {
    const b = pivotOf.get(m);
    if (b && free.every((f) => Math.abs(b.coef[f]) < 1e-7)) value[m] = Math.abs(b.rhs) < 1e-12 ? 0 : b.rhs;
  }
  function total(mask) {
    let c = 0;
    for (const f of free) {
      let k = has(mask, f) ? 1 : 0;
      for (const b of basis) if (has(mask, b.pivot)) k -= b.coef[f];
      if (Math.abs(k) > 1e-7) return null;
    }
    for (const b of basis) if (has(mask, b.pivot)) c += b.rhs;
    return Math.abs(c) < 1e-12 ? 0 : c;
  }
  const unknown = value.filter((v) => v == null).length;
  return { value, total, shadedTotal: shaded == null ? null : total(shaded), errors, contradictions, redundant, notes, unknown, facts: rows.filter((r) => r.line >= 0).length };
}
function placeMembers(members, ids) {
  const n = ids.length;
  const parse2 = (s) => {
    const out = [];
    for (const part2 of String(s || "").split(",")) {
      const t = part2.trim();
      if (!t || out.length >= MAX_MEMBERS) continue;
      const r = /^(-?\d+)\s*\.\.\s*(-?\d+)$/.exec(t);
      if (r) {
        const a = +r[1], b = +r[2], d = a <= b ? 1 : -1;
        for (let v = a; d > 0 ? v <= b : v >= b; v += d) {
          if (out.length >= MAX_MEMBERS) break;
          if (!out.includes(String(v))) out.push(String(v));
        }
        continue;
      }
      if (!out.includes(t)) out.push(t.slice(0, 40));
    }
    return out;
  };
  const lists = ids.map((id) => parse2(members[id]));
  const uniGiven = parse2(members.U);
  const order = uniGiven.length ? uniGiven.slice() : [];
  const notes = [];
  lists.forEach((list, i) => list.forEach((x) => {
    if (!order.includes(x)) {
      if (uniGiven.length) notes.push(`${x} is in ${ids[i]} but not in the universe.`);
      order.push(x);
    }
  }));
  const region = new Array(1 << n).fill(null).map(() => []);
  const where = /* @__PURE__ */ new Map();
  for (const x of order) {
    let m = 0;
    lists.forEach((list, i) => {
      if (list.includes(x)) m |= 1 << i;
    });
    region[m].push(x);
    where.set(x, m);
  }
  return { region, order, where, notes, universeGiven: uniGiven.length > 0 };
}

// client/src/utils/vennGeometry.js
var TAU = Math.PI * 2;
var D2R2 = Math.PI / 180;
function shapeFns(s) {
  const c = Math.cos(s.rot * D2R2), sn = Math.sin(s.rot * D2R2);
  return {
    // Negative inside, positive outside
    F(px, py) {
      const dx = px - s.x, dy = py - s.y, u = dx * c + dy * sn, v = -dx * sn + dy * c;
      return (u / s.rx) ** 2 + (v / s.ry) ** 2 - 1;
    },
    at(t) {
      const a = s.rx * Math.cos(t), b = s.ry * Math.sin(t);
      return [s.x + a * c - b * sn, s.y + a * sn + b * c];
    },
    // About how far a point is from the outline
    dist(px, py) {
      const dx = px - s.x, dy = py - s.y, u = dx * c + dy * sn, v = -dx * sn + dy * c;
      if (Math.abs(s.rx - s.ry) < 1e-9) return Math.abs(Math.hypot(u, v) - s.rx);
      const r = Math.hypot(u / s.rx, v / s.ry), F = r * r - 1;
      const g = 2 * Math.hypot(u / (s.rx * s.rx), v / (s.ry * s.ry));
      const radial = r > 1e-9 ? Math.abs(1 - 1 / r) * Math.hypot(u, v) : Math.min(s.rx, s.ry);
      return g > 1e-9 ? Math.min(Math.abs(F) / g, radial) : radial;
    },
    // Where a ray from the centre in direction d crosses the outline
    ray(d) {
      const u = d[0] * c + d[1] * sn, v = -d[0] * sn + d[1] * c;
      const k = 1 / Math.hypot(u / s.rx, v / s.ry);
      return [s.x + d[0] * k, s.y + d[1] * k];
    }
  };
}
function arrangement(shapes, box) {
  const n = shapes.length, fns = shapes.map(shapeFns), N = 720;
  const arcs = [];
  for (let i = 0; i < n; i++) {
    const cuts = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      let prev = fns[j].F(...fns[i].at(0));
      for (let k = 1; k <= N; k++) {
        const t = k / N * TAU, cur = fns[j].F(...fns[i].at(t));
        if (prev < 0 !== cur < 0) {
          let a = (k - 1) / N * TAU, b = t, fa = prev;
          for (let it = 0; it < 48; it++) {
            const mid = (a + b) / 2, fm = fns[j].F(...fns[i].at(mid));
            if (fm < 0 === fa < 0) {
              a = mid;
              fa = fm;
            } else b = mid;
          }
          cuts.push((a + b) / 2);
        }
        prev = cur;
      }
    }
    cuts.sort((a, b) => a - b);
    const segs = cuts.length ? cuts.map((t0, k) => [t0, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + TAU]) : [[0, TAU]];
    for (const [t0, t1] of segs) {
      const p = fns[i].at((t0 + t1) / 2);
      let others = 0;
      for (let j = 0; j < n; j++) if (j !== i && fns[j].F(p[0], p[1]) < 0) others |= 1 << j;
      arcs.push({ i, t0, t1, full: !cuts.length, others, p0: fns[i].at(t0), p1: fns[i].at(t1) });
    }
  }
  const regions = [];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5;
  for (let m = 0; m < 1 << n; m++) {
    const mine = arcs.filter((a) => a.others === (m & ~(1 << a.i))).map((a) => {
      const fwd = (m >> a.i & 1) === 1;
      return { arc: a, fwd, start: fwd ? a.p0 : a.p1, end: fwd ? a.p1 : a.p0 };
    });
    const loops = [];
    const unused = mine.slice();
    while (unused.length) {
      const first = unused.shift(), loop = [first];
      if (!first.arc.full) {
        let cur = first;
        for (let guard = 0; guard < 64 && !near(cur.end, first.start); guard++) {
          let k = -1, bd = Infinity;
          unused.forEach((x, j) => {
            const d = Math.hypot(x.start[0] - cur.end[0], x.start[1] - cur.end[1]);
            if (d < bd) {
              bd = d;
              k = j;
            }
          });
          if (k < 0 || bd > 1e-4) break;
          cur = unused.splice(k, 1)[0];
          loop.push(cur);
        }
      }
      loops.push(loop);
    }
    if (m === 0 && box) loops.push([{ rect: box }]);
    let area = 0;
    const poly = [];
    for (const loop of loops) {
      const pts = [];
      for (const seg of loop) {
        if (seg.rect) {
          const b = seg.rect;
          pts.push([b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]);
          continue;
        }
        const a = seg.arc, steps = Math.max(8, Math.ceil((a.t1 - a.t0) / 0.05));
        for (let k = 0; k < steps; k++) {
          const t = seg.fwd ? a.t0 + (a.t1 - a.t0) * (k / steps) : a.t1 - (a.t1 - a.t0) * (k / steps);
          pts.push(fns[a.i].at(t));
        }
      }
      for (let k = 0; k < pts.length; k++) {
        const p = pts[k], q = pts[(k + 1) % pts.length];
        area += (p[0] * q[1] - q[0] * p[1]) / 2;
      }
      poly.push(pts);
    }
    regions.push({ m, loops, area: m === 0 && !box ? Infinity : area, poly });
  }
  return { shapes, fns, arcs, regions };
}
function regionPoles(geo, box, opts = {}) {
  const n = geo.shapes.length, fns = geo.fns;
  const h = opts.step || 0.09;
  const best = new Array(1 << n).fill(null);
  const bit = (x, y) => {
    let m = 0;
    for (let i = 0; i < n; i++) if (fns[i].F(x, y) < 0) m |= 1 << i;
    return m;
  };
  const avoid = opts.avoid || [];
  const score = (x, y) => {
    let d = Math.min(x - box.x0, box.x1 - x, y - box.y0, box.y1 - y);
    for (let i = 0; i < n; i++) d = Math.min(d, fns[i].dist(x, y));
    for (const a of avoid) {
      const dx = Math.max(0, Math.abs(x - a.x) - a.w / 2), dy = Math.max(0, Math.abs(y - a.y) - a.h / 2);
      d = Math.min(d, Math.hypot(dx, dy) * 1.2);
    }
    return d;
  };
  for (let x = box.x0 + h / 2; x < box.x1; x += h) {
    for (let y = box.y0 + h / 2; y < box.y1; y += h) {
      const m = bit(x, y), d = score(x, y);
      if (!best[m] || d > best[m].d) best[m] = { x, y, d };
    }
  }
  for (let m = 0; m < best.length; m++) {
    const b = best[m];
    if (!b) continue;
    for (let k = 0; k < 2; k++) {
      const hh = h / (k ? 8 : 3);
      let bx = b.x, by = b.y, bd = b.d;
      for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
        const x = b.x + dx * hh, y = b.y + dy * hh;
        if (bit(x, y) !== m) continue;
        const d = score(x, y);
        if (d > bd) {
          bd = d;
          bx = x;
          by = y;
        }
      }
      b.x = bx;
      b.y = by;
      b.d = bd;
    }
  }
  return best;
}
function placeLabels(shapes, sizes) {
  const n = shapes.length, fns = shapes.map(shapeFns);
  const cx = shapes.reduce((s, p) => s + p.x, 0) / n, cy = shapes.reduce((s, p) => s + p.y, 0) / n;
  const samples = fns.map((f) => Array.from({ length: 32 }, (_, k) => f.at(k / 32 * TAU)));
  const within = (i, j) => samples[i].every((q) => fns[j].F(q[0], q[1]) < 0);
  const placed = [];
  return shapes.map((s, i) => {
    const { w, h } = sizes[i];
    let out = [s.x - cx, s.y - cy];
    const ol = Math.hypot(out[0], out[1]);
    out = ol > 1e-6 ? [out[0] / ol, out[1] / ol] : [-0.6, 0.8];
    let best = null;
    for (let k = 0; k < 64; k++) {
      const a = k / 64 * TAU, d = [Math.cos(a), Math.sin(a)];
      const e = fns[i].ray(d);
      const r = 0.12 + Math.abs(d[0]) * w / 2 + Math.abs(d[1]) * h / 2;
      const p = [e[0] + d[0] * r, e[1] + d[1] * r];
      let clear = 1;
      const corners = [p, [p[0] - w / 2, p[1] - h / 2], [p[0] + w / 2, p[1] - h / 2], [p[0] - w / 2, p[1] + h / 2], [p[0] + w / 2, p[1] + h / 2]];
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const inside = within(i, j);
        for (const q of corners) {
          const F = fns[j].F(q[0], q[1]), dd = fns[j].dist(q[0], q[1]);
          clear = Math.min(clear, F < 0 && !inside ? -dd : dd);
        }
      }
      let score = Math.min(clear, 0.45) * 4 + 0.8 * (d[0] * out[0] + d[1] * out[1]) + 0.25 * d[1] - 0.05 * d[0];
      for (const o of placed) if (Math.abs(o.x - p[0]) < (o.w + w) / 2 + 0.1 && Math.abs(o.y - p[1]) < (o.h + h) / 2 + 0.05) score -= 3;
      if (!best || score > best.score) best = { x: p[0], y: p[1], w, h, score };
    }
    placed.push(best);
    return best;
  });
}
var cache = /* @__PURE__ */ new Map();
function layoutGeometry(shapes, sizes, universe) {
  const key = JSON.stringify([shapes, sizes, universe]);
  const hit = cache.get(key);
  if (hit) return hit;
  const fns = shapes.map(shapeFns);
  const labels = placeLabels(shapes, sizes);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ext = (x, y) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  fns.forEach((f) => {
    for (let k = 0; k < 96; k++) {
      const p = f.at(k / 96 * TAU);
      ext(p[0], p[1]);
    }
  });
  labels.forEach((l) => {
    ext(l.x - l.w / 2, l.y - l.h / 2);
    ext(l.x + l.w / 2, l.y + l.h / 2);
  });
  const pad = 0.4;
  const box = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  let ulab = null;
  if (universe) {
    const { w, h } = universe;
    const place = () => ({ x: box.x0 + 0.18 + w / 2, y: box.y1 - 0.14 - h / 2, w, h });
    ulab = place();
    const clash = () => [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].some(([sx, sy]) => {
      const qx = ulab.x + sx * w / 2, qy = ulab.y + sy * h / 2;
      return fns.some((f) => f.F(qx, qy) < 0.08) || labels.some((l) => Math.abs(qx - l.x) < l.w / 2 + 0.05 && Math.abs(qy - l.y) < l.h / 2 + 0.05);
    });
    for (let k = 0; k < 6 && clash(); k++) {
      box.y1 += 0.18;
      box.x0 -= 0.12;
      ulab = place();
    }
  }
  const geo = arrangement(shapes, box);
  const poles = regionPoles(geo, box, { avoid: labels.concat(ulab ? [ulab] : []) });
  let drawn = 0;
  geo.regions.forEach((r) => {
    if (r.area > 0.02 && poles[r.m]) drawn |= 1 << r.m;
  });
  const res = { shapes, fns, labels, box, ulab, geo, poles, drawn };
  cache.set(key, res);
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return res;
}
var has2 = (mask, m) => (mask >>> m & 1) === 1;
function regionPolys(g, mask) {
  const out = [];
  for (const r of g.geo.regions) if (has2(mask, r.m)) out.push(...r.poly);
  return out;
}
function hatchSegments(polys, deg, spacing) {
  const c = Math.cos(deg * D2R2), s = Math.sin(deg * D2R2);
  const rot = ([x, y]) => [x * c + y * s, -x * s + y * c];
  const back = ([u, v]) => [u * c - v * s, u * s + v * c];
  const rp = polys.map((p) => p.map(rot));
  let v0 = Infinity, v1 = -Infinity;
  for (const p of rp) for (const q of p) {
    v0 = Math.min(v0, q[1]);
    v1 = Math.max(v1, q[1]);
  }
  const segs = [];
  if (!isFinite(v0)) return segs;
  for (let v = Math.ceil(v0 / spacing) * spacing; v < v1; v += spacing) {
    const xs = [];
    for (const p of rp) {
      for (let k = 0; k < p.length; k++) {
        const a = p[k], b = p[(k + 1) % p.length];
        if (a[1] <= v !== b[1] <= v) xs.push(a[0] + (v - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-3) segs.push([back([xs[k], v]), back([xs[k + 1], v])]);
  }
  return segs;
}
function insidePolys(polys, x, y) {
  let inside = false;
  for (const p of polys) {
    for (let k = 0, j = p.length - 1; k < p.length; j = k++) {
      const a = p[k], b = p[j];
      if (a[1] > y !== b[1] > y && x < a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])) inside = !inside;
    }
  }
  return inside;
}
function dotPoints(polys, spacing) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const q of p) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  const pts = [];
  if (!isFinite(x0)) return pts;
  let row = 0;
  for (let y = Math.ceil(y0 / spacing) * spacing; y < y1; y += spacing * 0.87, row++) {
    for (let x = Math.ceil(x0 / spacing) * spacing + (row % 2 ? spacing / 2 : 0); x < x1; x += spacing) if (insidePolys(polys, x, y)) pts.push([x, y]);
  }
  return pts;
}
var C = (x, y, r) => ({ x, y, rx: r, ry: r, rot: 0 });
var VENN_LAYOUTS = {
  1: [{ id: "one", name: "One circle", shapes: [C(0, 0, 1.6)] }],
  2: [
    { id: "overlap", name: "Overlapping", shapes: [C(-0.95, 0, 1.6), C(0.95, 0, 1.6)] },
    { id: "inside", name: "{0} inside {1}", shapes: [C(-0.45, -0.15, 0.95), C(0, 0, 1.9)] },
    { id: "apart", name: "Apart", shapes: [C(-1.85, 0, 1.45), C(1.85, 0, 1.45)] }
  ],
  3: [
    { id: "classic", name: "Overlapping", shapes: [C(-0.9, 0.52, 1.5), C(0.9, 0.52, 1.5), C(0, -1.04, 1.5)] },
    { id: "row", name: "In a row", shapes: [C(-1.9, 0, 1.3), C(0, 0, 1.3), C(1.9, 0, 1.3)] },
    { id: "nested", name: "Nested", shapes: [C(0, -0.55, 0.85), C(0, -0.2, 1.45), C(0, 0.2, 2.1)] }
  ],
  4: [
    { id: "ellipses", name: "Ellipses", shapes: [
      { x: -0.8, y: -0.4, rx: 2.4, ry: 1.56, rot: -50 },
      { x: 0, y: 0.3, rx: 2.4, ry: 1.56, rot: -50 },
      { x: 0, y: 0.3, rx: 2.4, ry: 1.56, rot: 50 },
      { x: 0.8, y: -0.4, rx: 2.4, ry: 1.56, rot: 50 }
    ] }
  ]
};

// client/src/utils/vennDiagram.js
var VENN_UNIT = 56;
var SET_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7"];
var SHADE_COLOR = "#818cf8";
var VENN_STYLES = [
  { id: "fill", name: "Solid" },
  { id: "hatch-ne", name: "Lines ╱" },
  { id: "hatch-nw", name: "Lines ╲" },
  { id: "hatch-h", name: "Lines ─" },
  { id: "hatch-v", name: "Lines │" },
  { id: "dots", name: "Dots" },
  { id: "outline", name: "Outline" }
];
var STYLE_IDS = VENN_STYLES.map((s) => s.id);
var HATCH_DEG = { "hatch-ne": 45, "hatch-nw": 135, "hatch-h": 0, "hatch-v": 90 };
var REL_TEX = { "=": "=", "≠": "\\neq", "⊆": "\\subseteq", "⊇": "\\supseteq", "⊂": "\\subsetneq", "⊃": "\\supsetneq" };
var GAP = 1.6;
var LABEL_FS = 0.46;
var UNIVERSE_FS = 0.44;
var CAPTION5 = 0.3;
var OK = "#22c55e";
var BAD = "#ef4444";
var esc6 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n16 = (v) => String(Math.round(v * 10) / 10);
var HEX2 = /^#[0-9a-f]{6}$/i;
var ID5 = /^[A-Za-z0-9_-]{1,40}$/;
var num7 = (v, lo, hi, d) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
var int6 = (v, lo, hi, d) => Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : d;
var str6 = (v, max, d = "") => typeof v === "string" ? v.slice(0, max) : d;
var oneOf2 = (v, list, d) => list.includes(v) ? v : d;
function vennModel(el) {
  const sets = [];
  for (const s of Array.isArray(el?.sets) ? el.sets.slice(0, 4) : []) {
    if (!s || !/^[A-Za-z]$/.test(s.id) || sets.some((x) => x.id === s.id)) continue;
    sets.push({ id: s.id, label: str6(s.label, 80, s.id), color: HEX2.test(s.color || "") ? s.color : SET_COLORS[sets.length] });
  }
  if (!sets.length) for (const id of ["A", "B", "C"]) sets.push({ id, label: id, color: SET_COLORS[sets.length] });
  const n = sets.length;
  const presets = VENN_LAYOUTS[n];
  let layout = typeof el?.layout === "string" ? el.layout : presets[0].id;
  let shapes = Array.isArray(el?.shapes) && el.shapes.length === n ? el.shapes.map((s) => ({ x: num7(s?.x, -20, 20, 0), y: num7(s?.y, -20, 20, 0), rx: num7(s?.rx, 0.3, 6, 1.5), ry: num7(s?.ry, 0.3, 6, 1.5), rot: num7(s?.rot, -180, 180, 0) })) : null;
  if (!shapes) {
    const p = presets.find((l) => l.id === layout) || presets[0];
    layout = p.id;
    shapes = p.shapes.map((s) => ({ ...s }));
  } else if (layout !== "custom" && !presets.some((l) => l.id === layout)) layout = "custom";
  const u = el?.universe || {}, r = el?.result || {}, g = el?.regions || {}, v = el?.verdict || {};
  const layers = [], ids = /* @__PURE__ */ new Set();
  for (const L of Array.isArray(el?.layers) ? el.layers.slice(0, 40) : []) {
    if (!L || !ID5.test(L.id) || ids.has(L.id)) continue;
    ids.add(L.id);
    const step = int6(L.step, 0, 1e3, 0);
    const until = Number.isInteger(L.until) ? Math.min(1e3, Math.max(step, L.until)) : null;
    layers.push({ id: L.id, expr: str6(L.expr, 400), style: oneOf2(L.style, STYLE_IDS, "fill"), color: HEX2.test(L.color || "") ? L.color : null, step, until, panel: L.panel === 1 ? 1 : 0 });
  }
  const captions = {};
  for (const [k, c] of Object.entries(el?.captions && typeof el.captions === "object" ? el.captions : {})) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i <= 1e3 && typeof c === "string" && c.trim()) captions[i] = c.slice(0, 300);
  }
  const members = {};
  const mem = el?.members && typeof el.members === "object" ? el.members : {};
  for (const k of ["U", ...sets.map((s) => s.id)]) if (typeof mem[k] === "string" && mem[k].trim()) members[k] = mem[k].slice(0, 600);
  const rs = Array.isArray(r.steps) ? r.steps : [];
  return {
    sets,
    layout,
    shapes,
    universe: { show: u.show !== false, label: str6(u.label, 40, "U").trim() || "U" },
    notation: { complement: oneOf2(el?.notation?.complement, ["prime", "c", "bar"], "prime") },
    outlines: oneOf2(el?.outlines, ["ink", "sets"], "ink"),
    expr: str6(el?.expr, 400),
    // The expression Build It Up wrote the steps for, to say when they're out of date
    builtFrom: str6(el?.builtFrom, 400),
    result: { style: oneOf2(r.style, STYLE_IDS, "fill"), color: HEX2.test(r.color || "") ? r.color : null, steps: [int6(rs[0], 0, 1e3, 0), int6(rs[1], 0, 1e3, 0)] },
    layers,
    regions: {
      label: oneOf2(g.label, ["none", "roman", "name"], "none"),
      values: oneOf2(g.values, ["none", "counts", "probability", "elements"], "none"),
      reveal: oneOf2(g.reveal, ["together", "inside-out"], "together"),
      step: int6(g.step, 0, 1e3, 0)
    },
    facts: (Array.isArray(el?.facts) ? el.facts : []).filter((f) => typeof f === "string").slice(0, 40).map((f) => f.slice(0, 160)),
    members,
    verdict: { show: v.show !== false, step: int6(v.step, 0, 1e3, 0) },
    captions,
    color: HEX2.test(el?.color || "") ? el.color : "#ffffff",
    stepStart: int6(el?.stepStart, 1, 1e3, 1),
    dimPast: !!el?.dimPast
  };
}
var ctxOf = (m) => ({ ids: m.sets.map((s) => s.id), universe: m.universe.label });
var styleOf = (m, out) => ({ out, comp: m.notation.complement, ids: m.sets.map((s) => s.id), universe: m.universe.label });
var labelSize = (tex, fs) => {
  const b = texBox(tex, fs * VENN_UNIT);
  return { w: b.w / VENN_UNIT, h: fs * 1.15 };
};
function vennGeometry(m) {
  return layoutGeometry(m.shapes, m.sets.map((s) => labelSize(s.label, LABEL_FS)), m.universe.show ? labelSize(m.universe.label, UNIVERSE_FS) : null);
}
function analyzeVenn(m) {
  const n = m.sets.length, ctx = ctxOf(m), all = fullMask(n);
  const a = { n, all, ctx, sides: [], masks: [], rel: null, err: null, parsed: null, layers: [], warnings: [], notes: [] };
  try {
    const p = parse(m.expr, ctx);
    a.parsed = p;
    if (p.ast.t === "rel") {
      a.rel = p.ast.op;
      a.sides = [p.ast.a, p.ast.b];
    } else a.sides = [p.ast];
    a.masks = a.sides.map((s) => evaluate(s, n));
  } catch (e) {
    if (!e.venn) throw e;
    a.err = e;
  }
  a.layers = m.layers.map((L) => {
    try {
      const p = parse(L.expr, ctx);
      if (p.ast.t === "rel") return { L, err: "A layer shades one set, not a relation." };
      return { L, mask: evaluate(p.ast, n), ast: p.ast };
    } catch (e) {
      if (!e.venn) throw e;
      return { L, err: e.message };
    }
  });
  a.g = vennGeometry(m);
  a.visible = a.g.drawn & (m.universe.show ? all : all & ~1);
  const nameOf = (r) => format(regionAst(r, n), styleOf(m, "text"));
  const listMask = (mask) => listNames(regionsOf(mask, n).map(nameOf));
  a.nameOf = nameOf;
  a.listMask = listMask;
  a.masks.forEach((mask, p) => {
    const lost = mask & ~a.g.drawn;
    const several = popcount(lost) > 1;
    if (lost) a.notes.push(`${listMask(lost)} ${several ? "are" : "is"} shaded${a.rel ? p ? " on the right" : " on the left" : ""}, but this layout leaves no room for ${several ? "them" : "it"}, so ${several ? "they count" : "it counts"} as empty.`);
    if (!m.universe.show && mask & 1) a.warnings.push(`The outside, ${nameOf(0)}, is shaded, but the universe isn’t drawn.`);
  });
  if (a.rel) a.verdict = verdictOf(a.rel, a.masks[0], a.masks[1], a.g.drawn, all, listMask);
  const shaded = a.masks.length === 1 ? a.masks[0] : null;
  if (m.regions.values === "counts" || m.regions.values === "probability") a.num = solveFacts(m.facts.join("\n"), ctx, n, m.regions.values, shaded);
  if (m.regions.values === "elements") a.mem = placeMembers(m.members, ctx.ids);
  a.maxStep = maxStep4(m, a);
  a.staleBuild = m.layers.length > 0 && !!m.builtFrom && m.builtFrom !== m.expr;
  return a;
}
function verdictOf(op, L, R, drawn, all, listMask) {
  const judge = (room) => {
    const onlyL = L & ~R & room, onlyR = R & ~L & room;
    const holds = op === "=" ? !onlyL && !onlyR : op === "≠" ? !!(onlyL || onlyR) : op === "⊆" ? !onlyL : op === "⊇" ? !onlyR : op === "⊂" ? !onlyL && !!onlyR : !onlyR && !!onlyL;
    return { holds, onlyL, onlyR };
  };
  const v = judge(drawn), anyway = judge(all);
  const isAre = (mask) => popcount(mask) > 1 ? "are" : "is";
  let text;
  if (op === "=" || op === "≠") {
    if (!v.onlyL && !v.onlyR) text = "Both sides shade the same regions.";
    else text = [v.onlyL && `${listMask(v.onlyL)} ${isAre(v.onlyL)} shaded only on the left.`, v.onlyR && `${listMask(v.onlyR)} ${isAre(v.onlyR)} shaded only on the right.`].filter(Boolean).join(" ");
  } else if (op === "⊆" || op === "⊂") {
    text = v.onlyL ? `${listMask(v.onlyL)} ${isAre(v.onlyL)} shaded on the left but not on the right.` : "Every region shaded on the left is shaded on the right.";
    if (op === "⊂" && !v.onlyL && !v.onlyR) text += " But the sides are equal, so it isn’t a proper subset.";
  } else {
    text = v.onlyR ? `${listMask(v.onlyR)} ${isAre(v.onlyR)} shaded on the right but not on the left.` : "Every region shaded on the right is shaded on the left.";
    if (op === "⊃" && !v.onlyL && !v.onlyR) text += " But the sides are equal, so it isn’t a proper superset.";
  }
  const short = op === "=" ? v.holds ? "Equal" : "Not equal" : op === "≠" ? v.holds ? "Not equal" : "Equal after all" : v.holds ? "Holds" : "Doesn’t hold";
  const layoutNote = v.holds !== anyway.holds ? `Only because this layout leaves no room for ${listMask(all & ~drawn & (L ^ R))}.` : "";
  return { holds: v.holds, text, short, layoutNote };
}
function valueStep(m, n, r) {
  return m.regions.reveal === "inside-out" ? m.regions.step + (n - popcount(r)) : m.regions.step;
}
function maxStep4(m, a) {
  let s = 0;
  for (const L of m.layers) {
    s = Math.max(s, L.step);
    if (L.until != null) s = Math.max(s, L.until);
  }
  for (let p = 0; p < Math.max(1, a.sides.length); p++) s = Math.max(s, m.result.steps[p]);
  if (a.rel && m.verdict.show) s = Math.max(s, m.verdict.step);
  if (m.regions.values !== "none") s = Math.max(s, valueStep(m, a.n, 0));
  for (const k of Object.keys(m.captions)) s = Math.max(s, +k);
  return Math.min(s, 1e3);
}
function fmtValue(v, mode) {
  if (v == null) return "?";
  if (mode === "probability") return String(+v.toFixed(3));
  return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2);
}
function regionPath(a, mask, off, u) {
  const g = a.g, X = (x) => n16((x + off) * u), Y = (y) => n16(-y * u);
  let d = "";
  for (const r of g.geo.regions) {
    if (!has(mask, r.m) || !has(a.visible, r.m)) continue;
    for (const loop of r.loops) {
      if (loop[0].rect) {
        const b = loop[0].rect;
        d += `M${X(b.x0)} ${Y(b.y0)}H${X(b.x1)}V${Y(b.y1)}H${X(b.x0)}Z`;
        continue;
      }
      loop.forEach((seg, k) => {
        const arc = seg.arc, s = g.shapes[arc.i];
        if (k === 0) d += `M${X(seg.start[0])} ${Y(seg.start[1])}`;
        const cmd = (p, large) => `A${n16(s.rx * u)} ${n16(s.ry * u)} ${n16(-s.rot)} ${large ? 1 : 0} ${seg.fwd ? 0 : 1} ${X(p[0])} ${Y(p[1])}`;
        if (arc.full) d += cmd(g.fns[arc.i].at(arc.t0 + Math.PI), false) + cmd(seg.end, false);
        else d += cmd(seg.end, arc.t1 - arc.t0 > Math.PI);
      });
      d += "Z";
    }
  }
  return d;
}
function vennFrame(m, a) {
  const box = a.g.box, W = box.x1 - box.x0;
  const panels = a.rel ? 2 : 1;
  const offs = panels === 2 ? [0, W + GAP] : [0];
  const verdict = a.rel && m.verdict.show ? 0.85 : 0;
  return { box, W, panels, offs, x0: box.x0 - 0.12, x1: box.x1 + offs[panels - 1] + 0.12, y0: box.y0 - 0.12 - verdict, y1: box.y1 + 0.12 };
}
function drawVenn(m, o = {}) {
  const u = VENN_UNIT, ink = o.ink || m.color;
  const deck = o.deck != null ? String(o.deck).replace(/[^A-Za-z0-9_-]/g, "") : null;
  const a = o.a || analyzeVenn(m);
  const g = a.g, n = a.n, fr = vennFrame(m, a), box = g.box;
  const step = deck != null ? null : o.step == null ? a.maxStep : o.step;
  const shown = (at, until) => deck != null || step >= at && (until == null || step <= until);
  const part2 = (at, until, inner) => {
    if (deck == null) return inner;
    let s = at > 0 ? `<g class="pxvn-in">${inner}</g>` : inner;
    if (until != null) s = `<g data-fx-in="0-${until}">${s}</g>`;
    return at > 0 ? `<g class="pxfx-part" data-fx-at="${at}">${s}</g>` : s;
  };
  function label(tex, cx, cy, size, color2) {
    if (o.labels === "deck" || typeof o.labels === "function") {
      const b = texBox(tex, size), w = b.w * 2 + size * 2, h = b.h * 1.6 + size;
      const inner = o.labels === "deck" ? `<span data-math-latex="${esc6(tex)}" style="font-family:${esc6(MATH_FONT)}">${texLiteHtml(tex)}</span>` : o.labels(tex);
      return `<foreignObject x="${n16(cx - w / 2)}" y="${n16(cy - h / 2)}" width="${n16(w)}" height="${n16(h)}" pointer-events="none" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;line-height:1;font-size:${n16(size / 1.21)}px;color:${esc6(color2)}">${inner}</div></foreignObject>`;
    }
    return texSvg(tex, cx, cy, size, color2);
  }
  const text = (t, cx, cy, size, color2, extra = "") => `<text x="${n16(cx)}" y="${n16(cy + size * 0.34)}" text-anchor="middle" font-family="${esc6(MATH_FONT)}" font-size="${n16(size)}" fill="${esc6(color2)}"${extra}>${esc6(t)}</text>`;
  function shade(mask, style, color2, off) {
    mask &= a.visible;
    if (!mask) return "";
    if (style === "fill" || style === "outline") {
      const d2 = regionPath(a, mask, off, u);
      return style === "fill" ? `<path d="${d2}" fill-rule="evenodd" fill="${esc6(color2)}" fill-opacity="0.45"/>` : `<path d="${d2}" fill-rule="evenodd" fill="none" stroke="${esc6(color2)}" stroke-width="5" stroke-linejoin="round"/>`;
    }
    const polys = regionPolys(g, mask & a.visible);
    const X = (x) => n16((x + off) * u), Y = (y) => n16(-y * u);
    if (style === "dots") {
      const r = 0.035 * u;
      let d2 = "";
      for (const [x, y] of dotPoints(polys, 0.18)) d2 += `M${n16((x + off) * u - r)} ${Y(y)}a${n16(r)} ${n16(r)} 0 1 0 ${n16(2 * r)} 0a${n16(r)} ${n16(r)} 0 1 0 ${n16(-2 * r)} 0`;
      return d2 ? `<path d="${d2}" fill="${esc6(color2)}"/>` : "";
    }
    let d = "";
    for (const [p, q] of hatchSegments(polys, HATCH_DEG[style], 0.15)) d += `M${X(p[0])} ${Y(p[1])}L${X(q[0])} ${Y(q[1])}`;
    return d ? `<path d="${d}" stroke="${esc6(color2)}" stroke-width="1.8" stroke-linecap="round" fill="none"/>` : "";
  }
  let svg = "";
  for (let p = 0; p < fr.panels; p++) {
    const off = fr.offs[p];
    const X = (x) => (x + off) * u, Y = (y) => -y * u;
    if (m.universe.show) svg += `<rect x="${n16(X(box.x0))}" y="${n16(Y(box.y1))}" width="${n16((box.x1 - box.x0) * u)}" height="${n16((box.y1 - box.y0) * u)}" fill="none" stroke="${esc6(ink)}" stroke-width="2"/>`;
    const items = [];
    if (a.masks[p] != null) items.push({ mask: a.masks[p], style: m.result.style, color: m.result.color || SHADE_COLOR, at: m.result.steps[p], until: null });
    for (const l of a.layers) {
      if (l.err || fr.panels === 2 && l.L.panel !== p) continue;
      items.push({ mask: l.mask, style: l.L.style, color: l.L.color || SHADE_COLOR, at: l.L.step, until: l.L.until });
    }
    for (const it of items) {
      if (!shown(it.at, it.until)) continue;
      const s = shade(it.mask, it.style, it.color, off);
      if (s) svg += part2(it.at, it.until, s);
    }
    if (o.hover && o.hover.p === p && o.hover.r != null && has(a.visible, o.hover.r)) {
      svg += `<path d="${regionPath(a, 1 << o.hover.r, off, u)}" fill-rule="evenodd" fill="${esc6(o.accent)}" fill-opacity="0.16" stroke="${esc6(o.accent)}" stroke-width="2.5" stroke-dasharray="7 5"/>`;
    }
    g.shapes.forEach((s, i) => {
      const color2 = m.outlines === "sets" ? m.sets[i].color : ink;
      const cx = n16(X(s.x)), cy = n16(Y(s.y)), rot = Math.abs(s.rot) > 1e-9 ? ` transform="rotate(${n16(-s.rot)} ${cx} ${cy})"` : "";
      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${n16(s.rx * u)}" ry="${n16(s.ry * u)}"${rot} fill="none" stroke="${esc6(color2)}" stroke-width="2.4"/>`;
      if (o.sel === i) svg += `<ellipse cx="${cx}" cy="${cy}" rx="${n16(s.rx * u + 6)}" ry="${n16(s.ry * u + 6)}"${rot} fill="none" stroke="${esc6(o.accent)}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      const l = g.labels[i];
      svg += label(m.sets[i].label, X(l.x), Y(l.y), LABEL_FS * u, color2);
    });
    if (g.ulab) svg += label(m.universe.label, X(g.ulab.x), Y(g.ulab.y), UNIVERSE_FS * u, ink);
    const vals = m.regions.values, named = m.regions.label !== "none";
    if (named || vals !== "none") {
      for (let r = 0; r < 1 << n; r++) {
        const pole = g.poles[r];
        if (!has(a.visible, r) || !pole) continue;
        const cx = X(pole.x), cy = Y(pole.y);
        let value = "", rows = [];
        if ((vals === "counts" || vals === "probability") && a.num) value = fmtValue(a.num.value[r], vals);
        if (vals === "elements" && a.mem) {
          const items2 = a.mem.region[r], per = items2.length <= 3 ? items2.length : items2.length <= 6 ? 3 : 4;
          for (let k = 0; k < items2.length; k += per) rows.push(items2.slice(k, k + per).join(",\\ "));
        }
        const vh = value ? 0.42 : rows.length * 0.36;
        const nameFs = (m.regions.label === "name" ? 0.27 : 0.25) * u;
        const top = cy - (vh * u + (named ? nameFs * 1.2 : 0)) / 2;
        if (named) {
          const ny = top + nameFs * 0.6;
          svg += `<g opacity="0.7">${m.regions.label === "roman" ? text(regionNumber(r, n), cx, ny, nameFs, ink, ' letter-spacing="0.5"') : label(format(regionAst(r, n), styleOf(m, "tex")), cx, ny, nameFs, ink)}</g>`;
        }
        const vy = top + (named ? nameFs * 1.2 : 0);
        const at = valueStep(m, n, r);
        if (value && shown(at, null)) svg += part2(at, null, text(value, cx, vy + 0.21 * u, 0.42 * u, ink, a.num.value[r] == null ? ' opacity="0.55"' : ""));
        if (rows.length && shown(at, null)) svg += part2(at, null, rows.map((row, k) => label(row, cx, vy + (k + 0.5) * 0.36 * u, 0.32 * u, ink)).join(""));
      }
    }
  }
  if (a.rel) {
    svg += label(REL_TEX[a.rel], (box.x1 + GAP / 2) * u, -((box.y0 + box.y1) / 2) * u, 0.95 * u, ink);
    if (m.verdict.show && a.verdict && shown(m.verdict.step, null)) {
      const v = a.verdict;
      svg += part2(m.verdict.step, null, text(`${v.holds ? "✓" : "✗"} ${v.short}`, (fr.x0 + fr.x1) / 2 * u, -(box.y0 - 0.48) * u, 0.4 * u, v.holds ? OK : BAD));
    }
  }
  const pbox = { x0: fr.x0 * u, x1: fr.x1 * u, y0: -fr.y1 * u, y1: -fr.y0 * u };
  const capSteps = Object.keys(m.captions).map(Number).sort((x, y) => x - y);
  if (o.captions && capSteps.length) {
    const cs = CAPTION5 * u, w = Math.max(pbox.x1 - pbox.x0, 6 * u), cx = (pbox.x0 + pbox.x1) / 2, y = pbox.y1 + cs * 0.6, h = cs * 2.8;
    const one = (k, cls) => {
      const t = m.captions[k];
      if (o.labels === "text" || !o.labels) return `<text${cls} x="${n16(cx)}" y="${n16(y + cs)}" text-anchor="middle" font-family="${esc6(MATH_FONT)}" font-size="${n16(cs)}" fill="${esc6(ink)}">${esc6(captionText(t))}</text>`;
      return `<foreignObject${cls} x="${n16(cx - w / 2)}" y="${n16(y)}" width="${n16(w)}" height="${n16(h)}" pointer-events="none"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;font-size:${n16(cs)}px;line-height:1.3;color:${esc6(ink)}">${captionHtml(t, o.labels)}</div></foreignObject>`;
    };
    if (deck != null) svg += capSteps.map((k) => one(k, ` class="pxfx-cap" data-fx-cap="${k}"`)).join("");
    else {
      const at = capSteps.filter((k) => k <= step).pop();
      if (at != null) svg += one(at, "");
    }
    pbox.x0 = Math.min(pbox.x0, cx - w / 2);
    pbox.x1 = Math.max(pbox.x1, cx + w / 2);
    pbox.y1 = Math.max(pbox.y1, y + h);
  }
  return { svg, box: pbox, a, frame: fr };
}
function captionHtml(t, labels) {
  return String(t).split(/(\$[^$]*\$)/).map((seg) => {
    if (!(seg.length > 1 && seg.startsWith("$") && seg.endsWith("$"))) return esc6(seg);
    const tex = seg.slice(1, -1);
    return labels === "deck" ? `<span data-math-latex="${esc6(tex)}" style="font-family:${esc6(MATH_FONT)}">${texLiteHtml(tex)}</span>` : labels(tex);
  }).join("");
}
function captionText(t) {
  return String(t).split(/(\$[^$]*\$)/).map((seg) => seg.length > 1 && seg.startsWith("$") && seg.endsWith("$") ? texRuns(seg.slice(1, -1)).map((r) => r.t).join("") : seg).join("");
}
var baseOptions4 = (m) => ({ ink: m.color, captions: true });
function vennBox(el) {
  const m = vennModel(el);
  const { box } = drawVenn(m, baseOptions4(m));
  const pad = 0.15 * VENN_UNIT;
  return { x: box.x0 - pad, y: box.y0 - pad, w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
}
function vennSvg(el, opts = {}) {
  const m = vennModel(el), b = vennBox(el);
  const { svg } = drawVenn(m, { ...baseOptions4(m), labels: opts.labels || "text", deck: opts.deck, step: opts.step ?? null });
  const size = opts.standalone ? ` width="${n16(b.w)}" height="${n16(b.h)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n16(b.x)} ${n16(b.y)} ${n16(b.w)} ${n16(b.h)}" preserveAspectRatio="xMidYMid meet"${size} style="width:100%;height:100%;display:block;overflow:visible">${svg}</svg>`;
}
function vennSteps(el) {
  if (el?.type !== "venn") return [];
  const m = vennModel(el), a = analyzeVenn(m), steps = /* @__PURE__ */ new Set();
  const add2 = (k) => {
    if (k > 0 && k <= a.maxStep) steps.add(k);
  };
  for (const l of a.layers) if (!l.err) {
    add2(l.L.step);
    if (l.L.until != null) add2(l.L.until + 1);
  }
  a.masks.forEach((_, p) => add2(m.result.steps[p]));
  if (m.regions.values !== "none") {
    for (let r = 0; r < 1 << a.n; r++) if (has(a.visible, r)) add2(valueStep(m, a.n, r));
  }
  if (a.rel && m.verdict.show) add2(m.verdict.step);
  for (const k of Object.keys(m.captions)) add2(+k);
  return [...steps].sort((x, y) => x - y).map((s) => [m.stepStart - 1 + s, s]).filter(([k]) => k <= 1e3);
}
function vennStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [k, s] of vennSteps(el)) html += `<span class="fragment" data-fragment-index="${k}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasVenn(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "venn"));
}

// client/src/utils/timingDiagram.js
var import_wavedrom_render_any = __toESM(require_render_any(), 1);
var import_default = __toESM(require_default(), 1);
var import_dark = __toESM(require_dark(), 1);
var import_json5 = __toESM(require_lib2(), 1);
var SKINS = { ...import_default.default, ...import_dark.default };
var esc7 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n17 = (v) => String(Math.round(v * 10) / 10);
var LIMITS = { source: 4e4, signals: 80, wave: 400, hscale: 8, bits: 512 };
function parseTiming(source) {
  const text = String(source ?? "");
  if (text.length > LIMITS.source) return { error: `That's ${text.length.toLocaleString("en-US")} characters; a diagram can have up to ${LIMITS.source.toLocaleString("en-US")}.` };
  let json;
  try {
    json = import_json5.default.parse(text);
  } catch (err) {
    const where = err.lineNumber ? `Line ${err.lineNumber}: ` : "";
    return { error: where + String(err.message || err).replace(/^JSON5: /, "").replace(/ at \d+:\d+$/, "") };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { error: "Write an object: { signal: [ … ] } for waveforms, or { reg: [ … ] } for a register." };
  if (json.signal) {
    if (!Array.isArray(json.signal)) return { error: 'signal must be a list: signal: [ { name: "clk", wave: "p...." } ]' };
    let count = 0, bad = null;
    const walk = (list) => list.forEach((s) => {
      if (Array.isArray(s)) {
        walk(s.slice(1));
        return;
      }
      if (!s || typeof s !== "object") return;
      count++;
      if (s.wave != null && typeof s.wave !== "string") bad = bad || `${s.name || "A signal"}'s wave must be a string, like "p...."`;
      else if (String(s.wave || "").length > LIMITS.wave) bad = bad || `${s.name || "A signal"}'s wave is ${s.wave.length} steps long; up to ${LIMITS.wave} are drawn`;
      if (s.data != null && !Array.isArray(s.data) && typeof s.data !== "string") bad = bad || `${s.name || "A signal"}'s data must be a list of labels`;
    });
    walk(json.signal);
    if (bad) return { error: bad };
    if (count > LIMITS.signals) return { error: `${count} signals; a diagram can have up to ${LIMITS.signals}.` };
    const hs = Number(json.config?.hscale);
    if (json.config?.hscale != null && !(hs > 0 && hs <= LIMITS.hscale)) return { error: `hscale must be between 0 and ${LIMITS.hscale}.` };
    return { json, kind: "signal" };
  }
  if (json.reg) {
    if (!Array.isArray(json.reg)) return { error: 'reg must be a list of fields: reg: [ { bits: 8, name: "data" } ]' };
    const bits = json.reg.reduce((n, f) => n + (Number(f?.bits) || 0), 0);
    if (bits > LIMITS.bits) return { error: `${bits} bits; a register can have up to ${LIMITS.bits}.` };
    return { json, kind: "reg" };
  }
  if (json.assign) {
    if (!Array.isArray(json.assign)) return { error: 'assign must be a list, like assign: [ ["out", ["&", "a", "b"]] ]' };
    return { json, kind: "assign" };
  }
  return { error: "Nothing to draw: give it a signal list for waveforms, reg for a register, or assign for logic." };
}
var ATTR_PROPS = /* @__PURE__ */ new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "font-size",
  "font-style",
  "font-weight",
  "font-family",
  "text-anchor"
]);
var DEFAULTS = { "stroke-linejoin": "miter", "stroke-miterlimit": "4", "stroke-opacity": "1", "stroke-dasharray": "none", "stroke-dashoffset": "0", "fill-opacity": "1", "font-style": "normal", "font-weight": "normal", "fill-rule": "nonzero", opacity: "1" };
function parseCss(css) {
  const rules = [];
  String(css).replace(/\/\*[\s\S]*?\*\//g, "").split("}").forEach((chunk) => {
    const at = chunk.indexOf("{");
    if (at < 0) return;
    const decls = {};
    chunk.slice(at + 1).split(";").forEach((d) => {
      const m = /^\s*([\w-]+)\s*:\s*(.+?)\s*(?:!important)?\s*$/.exec(d);
      if (m && ATTR_PROPS.has(m[1])) decls[m[1]] = m[2];
    });
    chunk.slice(0, at).split(",").forEach((sel) => {
      const s = sel.trim(), m = /^([a-z]+)$/i.exec(s) || /^\.([\w-]+)$/.exec(s);
      if (m) rules.push(s[0] === "." ? { cls: m[1], decls } : { tag: m[1].toLowerCase(), decls });
    });
  });
  return rules;
}
var TAGS = /* @__PURE__ */ new Set(["svg", "g", "path", "rect", "line", "polyline", "polygon", "circle", "ellipse", "text", "tspan", "marker", "defs", "clipPath", "title", "desc"]);
var tagName = (t) => {
  const s = String(t);
  for (const k of TAGS) if (k.toLowerCase() === s.toLowerCase()) return k;
  return null;
};
var ENT = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
var unesc = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e) => {
  if (e[0] !== "#") return ENT[e.toLowerCase()];
  const c = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1);
  return c > 0 && c <= 1114111 ? String.fromCodePoint(c) : m;
});
function toXml(n) {
  if (!Array.isArray(n)) return n == null || typeof n === "object" ? "" : esc7(unesc(n));
  const tag = tagName(n[0]);
  if (!tag) return "";
  let s = "<" + tag;
  for (const [k, v] of Object.entries(attrsOf(n) || {})) {
    if (v == null || typeof v === "object" && !Array.isArray(v)) continue;
    if (!/^[A-Za-z][\w:-]*$/.test(k) || /^on/i.test(k) || /href$/i.test(k)) continue;
    let val = Array.isArray(v) ? v.join(" ") : String(v);
    if (/url\(/i.test(val)) val = val.replace(/url\(\s*(?!#[\w-]+\s*\))[^)]*\)/gi, "none");
    if (/javascript:|expression\(/i.test(val)) continue;
    s += " " + k + '="' + esc7(val) + '"';
  }
  const kids = kidsOf(n);
  return kids.length ? s + ">" + kids.map(toXml).join("") + "</" + tag + ">" : s + "/>";
}
var isAttrs = (x) => x && typeof x === "object" && !Array.isArray(x);
var attrsOf = (n) => isAttrs(n[1]) ? n[1] : null;
var kidsOf = (n) => n.slice(isAttrs(n[1]) ? 2 : 1);
var clone = (n) => JSON.parse(JSON.stringify(n));
var DARK = { ink: "#e8ecf3", blue: "#79b8ff", soft: "#1e1e2e" };
function recolor(value) {
  return String(value).replace(/#0041c4|#00f\b|#0000ff/gi, DARK.blue).replace(/#ffffffcc/gi, DARK.soft + "cc").replace(/fill:\s*(?:#fff(?:fff)?|white)(?![\w-])/gi, "fill:" + DARK.soft).replace(/(^|[^\w#-])(?:#000000|#000|black)(?![\w-])/gi, (m, p) => p + DARK.ink);
}
function plain(tree, { prefix, dark }) {
  const rules = [], bricks = {}, markers = [];
  const gather = (n) => {
    if (!Array.isArray(n)) return;
    if (n[0] === "style") {
      rules.push(...parseCss(kidsOf(n).filter((k) => typeof k === "string").join("")));
      return;
    }
    if (n[0] === "defs") {
      for (const k of kidsOf(n)) {
        if (!Array.isArray(k)) continue;
        const id = attrsOf(k)?.id;
        if (k[0] === "marker" && id) markers.push(k);
        else if (id) bricks[id] = k;
      }
      return;
    }
    kidsOf(n).forEach(gather);
  };
  gather(tree);
  const tagRules = {}, clsRules = {};
  rules.forEach((r) => {
    if (r.tag) Object.assign(tagRules[r.tag] = tagRules[r.tag] || {}, r.decls);
    else Object.assign(clsRules[r.cls] = clsRules[r.cls] || {}, r.decls);
  });
  const markerIds = new Set(markers.map((m) => attrsOf(m).id));
  const fixUrls = (v) => String(v).replace(/url\(#([\w-]+)\)/g, (m, id) => markerIds.has(id) ? `url(#${prefix}-${id})` : "none");
  let depth = 0;
  const walk = (n) => {
    if (!Array.isArray(n)) return n;
    if (n[0] === "style" || n[0] === "defs") return null;
    if (n[0] === "use") {
      const a2 = attrsOf(n) || {}, id2 = String(a2["xlink:href"] || a2.href || "").replace(/^#/, ""), brick = bricks[id2];
      if (!brick || depth > 8) return null;
      depth++;
      const g = ["g", a2.transform ? { transform: a2.transform } : {}, ...kidsOf(clone(brick)).map(walk).filter(Boolean)];
      depth--;
      return g;
    }
    const a = { ...attrsOf(n) || {} }, tag = String(n[0]).toLowerCase();
    if (dark) {
      for (const k of ["fill", "stroke", "style", "color"]) if (a[k] != null) a[k] = recolor(a[k]);
    }
    Object.assign(a, tagRules[tag] || {});
    String(a.class || "").split(/\s+/).forEach((c) => {
      if (clsRules[c]) Object.assign(a, clsRules[c]);
    });
    delete a.class;
    for (const [k, v] of Object.entries(DEFAULTS)) if (a[k] != null && String(a[k]).trim() === v) delete a[k];
    const id = String(a.id || "");
    if (/^lanes_\d+$/.test(id)) a["data-tm"] = "lanes";
    else if (/^(wavelane_draw_\d+_\d+|wavearcs_\d+|wavegaps_\d+)$/.test(id)) a["data-tm"] = "clip";
    else if (/^gmarks_\d+$/.test(id)) a["data-tm"] = "marks";
    else if (/^wavelane_\d+_\d+$/.test(id)) a["data-tm"] = "lane";
    delete a.id;
    for (const k of Object.keys(a)) {
      if (k === "style" || k === "marker-end" || k === "marker-start") a[k] = fixUrls(a[k]);
      if (k === "xml:space" || k === "xmlns:xlink") delete a[k];
    }
    if (tag === "rect" && /fill:\s*white/.test(a.style || "") && /stroke:\s*none/.test(a.style || "")) return null;
    return [tag, a, ...kidsOf(n).map(walk).filter((x) => x != null)];
  };
  const out = walk(tree);
  const defs = markers.map((m) => {
    const c = clone(m), a = attrsOf(c);
    a.id = `${prefix}-${a.id}`;
    if (dark) {
      for (const k of ["style", "fill", "stroke"]) if (a[k]) a[k] = recolor(a[k]);
    }
    return ["marker", a, ...kidsOf(c).map((k) => Array.isArray(k) && attrsOf(k) && dark ? [k[0], Object.fromEntries(Object.entries(attrsOf(k)).map(([key, v]) => [key, key === "style" || key === "fill" || key === "stroke" ? recolor(v) : v])), ...kidsOf(k)] : k)];
  });
  return { tree: out, defs };
}
function findAll(n, test, out = []) {
  if (!Array.isArray(n)) return out;
  if (test(n)) out.push(n);
  kidsOf(n).forEach((k) => findAll(k, test, out));
  return out;
}
var cache2 = /* @__PURE__ */ new Map();
var CACHE_SIZE = 60;
function drawTiming(el, prefix = "tm") {
  const theme = el?.theme === "light" ? "light" : "dark";
  const key = theme + "\n" + prefix + "\n" + (el?.source ?? "");
  const hit = cache2.get(key);
  if (hit) return hit;
  let out;
  const p = parseTiming(el?.source);
  if (p.error) out = { error: p.error };
  else {
    try {
      const json = clone(p.json);
      if (p.kind === "signal") json.config = { ...json.config || {}, skin: theme === "dark" ? "dark" : "default" };
      const tree = (0, import_wavedrom_render_any.default)(0, json, SKINS);
      if (!Array.isArray(tree) || tree[0] !== "svg") throw new Error("WaveDrom drew nothing for this");
      const a = attrsOf(tree);
      const w = Number(a.width) || 400, h = Number(a.height) || 100;
      const { tree: body, defs } = plain(tree, { prefix, dark: theme === "dark" });
      out = { kind: p.kind, w, h, body: kidsOf(body), defs, rootAttrs: attrsOf(body) || {} };
      if (p.kind === "signal") {
        const lanes = findAll(body, (n) => attrsOf(n)?.["data-tm"] === "lanes")[0];
        const t = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)/.exec(attrsOf(lanes || [])?.transform || "");
        const grid = findAll(lanes || [], (n) => attrsOf(n)?.["data-tm"] === "marks")[0] || [];
        const lines = findAll(grid, (n) => n[0] === "line");
        const marks = lines.map((n) => Number(attrsOf(n).x1)).sort((x, y) => x - y);
        const hscale = Number(p.json.config?.hscale) || 1;
        let period = marks.length > 1 ? marks[1] - marks[0] : 40 * hscale;
        if (!(period > 0)) period = 40 * hscale;
        const laneH = Math.max(0, ...lines.map((n) => Number(attrsOf(n).y2) || 0));
        out.lanes = { x: t ? +t[1] : 0, y: t ? +t[2] : 0, h: laneH || h, period, cycles: marks.length > 1 ? marks.length - 1 : Math.round((w - (t ? +t[1] : 0)) / period) };
      }
    } catch (err) {
      out = { error: "WaveDrom couldn’t draw this: " + (err?.message || String(err)) };
    }
  }
  if (cache2.size >= CACHE_SIZE) cache2.delete(cache2.keys().next().value);
  cache2.set(key, out);
  return out;
}
function timingModel(el) {
  const steps = (Array.isArray(el?.steps) ? el.steps : []).slice(0, 200).map((s) => ({
    to: Math.max(0, Math.min(1e4, Math.round((Number(s?.to) || 0) * 2) / 2)),
    caption: typeof s?.caption === "string" ? s.caption.slice(0, 300) : ""
  }));
  const start = Math.round(Number(el?.stepStart));
  return {
    source: String(el?.source ?? ""),
    theme: el?.theme === "light" ? "light" : "dark",
    steps,
    revealFrom: Math.max(0, Math.min(1e4, Math.round((Number(el?.revealFrom) || 0) * 2) / 2)),
    cursor: el?.cursor !== false,
    stepStart: start >= 1 && start <= 1e3 ? start : 1
  };
}
var CAPTION_H = 30;
var idOf = (el) => "tm" + String(el?.id || "x").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
function timingSvg(el, opts = {}) {
  const m = timingModel(el), prefix = idOf(el) + (opts.deck ? "" : opts.step != null ? "s" + opts.step : "c");
  const d = drawTiming(m, prefix);
  const dark = m.theme === "dark";
  if (d.error) {
    const w = 480, h = 120;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet"${opts.standalone ? ` width="${w}" height="${h}"` : ""} style="width:100%;height:100%;display:block;overflow:visible"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="none" stroke="${dark ? "#f5a524" : "#b45309"}" stroke-dasharray="6 4"/><text x="${w / 2}" y="${h / 2 - 6}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="600" fill="${dark ? "#f5a524" : "#b45309"}">Timing diagram</text><text x="${w / 2}" y="${h / 2 + 16}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${dark ? "#e8ecf3" : "#333"}">${esc7(d.error.length > 70 ? d.error.slice(0, 69) + "…" : d.error)}</text></svg>`;
  }
  const hasCaps = m.steps.some((s) => s.caption);
  const W = d.w, H = d.h + (hasCaps ? CAPTION_H : 0);
  const ink = dark ? DARK.ink : "#222222", accent = dark ? "#ff8a65" : "#d9480f";
  let defs = d.defs.map(toXml).join("");
  let body = d.body;
  const steps = d.kind === "signal" && m.steps.length ? m.steps : null;
  const at = opts.step != null ? Math.max(0, Math.min(m.steps.length, opts.step)) : null;
  let over = "";
  if (steps && (opts.deck || at != null)) {
    const L = d.lanes, x = (cyc) => cyc * L.period;
    const reveal = (k) => k === 0 ? m.revealFrom : steps[k - 1].to;
    const range = (k) => k === steps.length ? `${k}-` : `${k}-${k}`;
    const ks = opts.deck ? steps.map((_, i) => i + 1).concat(0) : [at];
    const clipId = `${prefix}-reveal`;
    defs += `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">` + ks.map((k) => `<rect${opts.deck ? ` data-fx-in="${range(k)}"` : ""} x="-4" y="-10000" width="${n17(x(reveal(k)) + 4)}" height="20000"/>`).join("") + "</clipPath>";
    body = clipLanes(body, clipId);
    if (m.cursor) {
      over += ks.filter((k) => reveal(k) > 0 && reveal(k) < L.cycles).map((k) => {
        const cx = L.x + x(reveal(k));
        return `<line${opts.deck ? ` data-fx-in="${range(k)}"` : ""} x1="${n17(cx)}" y1="${n17(L.y - 8)}" x2="${n17(cx)}" y2="${n17(L.y + L.h + 4)}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      }).join("");
    }
  }
  if (hasCaps && d.kind === "signal") {
    const caps = m.steps.map((s, i) => [i + 1, s.caption]).filter(([, c]) => c);
    const shown = opts.deck ? caps : at != null ? caps.filter(([k]) => k <= at).slice(-1) : [];
    over += shown.map(([k, c]) => `<text class="pxfx-cap"${opts.deck ? ` data-fx-cap="${k}"` : ""} x="${n17(W / 2)}" y="${n17(d.h + CAPTION_H - 10)}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="${ink}">${esc7(c)}</text>`).join("");
  }
  const inner = body.map(toXml).join("");
  const rootFill = d.kind !== "signal" && dark ? ` fill="${DARK.ink}"` : "";
  const size = opts.standalone ? ` width="${n17(W)}" height="${n17(H)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n17(W)} ${n17(H)}" preserveAspectRatio="xMidYMid meet"${size}${rootFill} style="width:100%;height:100%;display:block;overflow:visible">` + (defs ? `<defs>${defs}</defs>` : "") + inner + over + "</svg>";
}
function clipLanes(nodes, clipId) {
  const walk = (n) => {
    if (!Array.isArray(n)) return n;
    const a = attrsOf(n);
    if (a && a["data-tm"] === "clip") return [n[0], { ...a, "clip-path": `url(#${clipId})` }, ...kidsOf(n)];
    return [n[0], ...a ? [a] : [], ...kidsOf(n).map(walk)];
  };
  return nodes.map(walk);
}
function timingSteps(el) {
  if (el?.type !== "timing") return [];
  const m = timingModel(el);
  if (!m.steps.length) return [];
  return m.steps.map((_, i) => [m.stepStart + i, i + 1]).filter(([n]) => n <= 1e3);
}
function timingStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of timingSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-fx-step="${id}" data-fx-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasTiming(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "timing"));
}

// client/src/utils/periodicData.js
var PERIODIC_ROWS = [
  [1, "H", "Hydrogen", "1.0080", "1s1", "", 2.2, 120, 13.598, 0.754, "+1, -1", "Gas", 0, 13.81, 20.28, 8988e-8, "Nonmetal", 1766],
  [2, "He", "Helium", "4.00260", "1s2", "", null, 140, 24.587, null, "0", "Gas", 0, 0.95, 4.22, 1785e-7, "Noble gas", 1868],
  [3, "Li", "Lithium", "7.0", "[He] 2s1", "", 0.98, 182, 5.392, 0.618, "+1", "Solid", 0, 453.65, 1615, 0.534, "Alkali metal", 1817],
  [4, "Be", "Beryllium", "9.012183", "[He] 2s2", "", 1.57, 153, 9.323, null, "+2", "Solid", 0, 1560, 2744, 1.85, "Alkaline earth metal", 1798],
  [5, "B", "Boron", "10.81", "[He] 2s2 2p1", "", 2.04, 192, 8.298, 0.277, "+3", "Solid", 0, 2348, 4273, 2.37, "Metalloid", 1808],
  [6, "C", "Carbon", "12.011", "[He] 2s2 2p2", "", 2.55, 170, 11.26, 1.263, "+4, +2, -4", "Solid", 0, 3823, 4098, 2.267, "Nonmetal", "Ancient"],
  [7, "N", "Nitrogen", "14.007", "[He] 2s2 2p3", "", 3.04, 155, 14.534, null, "+5, +4, +3, +2, +1, -1, -2, -3", "Gas", 0, 63.15, 77.36, 12506e-7, "Nonmetal", 1772],
  [8, "O", "Oxygen", "15.999", "[He] 2s2 2p4", "", 3.44, 152, 13.618, 1.461, "-2", "Gas", 0, 54.36, 90.2, 1429e-6, "Nonmetal", 1774],
  [9, "F", "Fluorine", "18.99840316", "[He] 2s2 2p5", "", 3.98, 135, 17.423, 3.339, "-1", "Gas", 0, 53.53, 85.03, 1696e-6, "Halogen", 1670],
  [10, "Ne", "Neon", "20.180", "[He] 2s2 2p6", "", null, 154, 21.565, null, "0", "Gas", 0, 24.56, 27.07, 8999e-7, "Noble gas", 1898],
  [11, "Na", "Sodium", "22.9897693", "[Ne] 3s1", "", 0.93, 227, 5.139, 0.548, "+1", "Solid", 0, 370.95, 1156, 0.97, "Alkali metal", 1807],
  [12, "Mg", "Magnesium", "24.305", "[Ne] 3s2", "", 1.31, 173, 7.646, null, "+2", "Solid", 0, 923, 1363, 1.74, "Alkaline earth metal", 1808],
  [13, "Al", "Aluminum", "26.981538", "[Ne] 3s2 3p1", "", 1.61, 184, 5.986, 0.441, "+3", "Solid", 0, 933.437, 2792, 2.7, "Post-transition metal", 1825],
  [14, "Si", "Silicon", "28.085", "[Ne] 3s2 3p2", "", 1.9, 210, 8.152, 1.385, "+4, +2, -4", "Solid", 0, 1687, 3538, 2.3296, "Metalloid", 1854],
  [15, "P", "Phosphorus", "30.97376200", "[Ne] 3s2 3p3", "", 2.19, 180, 10.487, 0.746, "+5, +3, -3", "Solid", 0, 317.3, 553.65, 1.82, "Nonmetal", 1669],
  [16, "S", "Sulfur", "32.07", "[Ne] 3s2 3p4", "", 2.58, 180, 10.36, 2.077, "+6, +4, -2", "Solid", 0, 388.36, 717.75, 2.067, "Nonmetal", "Ancient"],
  [17, "Cl", "Chlorine", "35.45", "[Ne] 3s2 3p5", "", 3.16, 175, 12.968, 3.617, "+7, +5, +1, -1", "Gas", 0, 171.65, 239.11, 3214e-6, "Halogen", 1774],
  [18, "Ar", "Argon", "39.9", "[Ne] 3s2 3p6", "", null, 188, 15.76, null, "0", "Gas", 0, 83.8, 87.3, 17837e-7, "Noble gas", 1894],
  [19, "K", "Potassium", "39.0983", "[Ar] 4s1", "", 0.82, 275, 4.341, 0.501, "+1", "Solid", 0, 336.53, 1032, 0.89, "Alkali metal", 1807],
  [20, "Ca", "Calcium", "40.08", "[Ar] 4s2", "", 1, 231, 6.113, null, "+2", "Solid", 0, 1115, 1757, 1.54, "Alkaline earth metal", 1808],
  [21, "Sc", "Scandium", "44.95591", "[Ar] 4s2 3d1", "", 1.36, 211, 6.561, 0.188, "+3", "Solid", 0, 1814, 3109, 2.99, "Transition metal", 1879],
  [22, "Ti", "Titanium", "47.867", "[Ar] 4s2 3d2", "", 1.54, 187, 6.828, 0.079, "+4, +3, +2", "Solid", 0, 1941, 3560, 4.5, "Transition metal", 1791],
  [23, "V", "Vanadium", "50.9415", "[Ar] 4s2 3d3", "", 1.63, 179, 6.746, 0.525, "+5, +4, +3, +2", "Solid", 0, 2183, 3680, 6, "Transition metal", 1801],
  [24, "Cr", "Chromium", "51.996", "[Ar] 4s1 3d5", "", 1.66, 189, 6.767, 0.666, "+6, +3, +2", "Solid", 0, 2180, 2944, 7.15, "Transition metal", 1797],
  [25, "Mn", "Manganese", "54.93804", "[Ar] 4s2 3d5", "", 1.55, 197, 7.434, null, "+7, +4, +3, +2", "Solid", 0, 1519, 2334, 7.3, "Transition metal", 1774],
  [26, "Fe", "Iron", "55.84", "[Ar] 4s2 3d6", "", 1.83, 194, 7.902, 0.163, "+3, +2", "Solid", 0, 1811, 3134, 7.874, "Transition metal", "Ancient"],
  [27, "Co", "Cobalt", "58.93319", "[Ar] 4s2 3d7", "", 1.88, 192, 7.881, 0.661, "+3, +2", "Solid", 0, 1768, 3200, 8.86, "Transition metal", 1735],
  [28, "Ni", "Nickel", "58.693", "[Ar] 4s2 3d8", "", 1.91, 163, 7.64, 1.156, "+3, +2", "Solid", 0, 1728, 3186, 8.912, "Transition metal", 1751],
  [29, "Cu", "Copper", "63.55", "[Ar] 4s1 3d10", "", 1.9, 140, 7.726, 1.228, "+2, +1", "Solid", 0, 1357.77, 2835, 8.933, "Transition metal", "Ancient"],
  [30, "Zn", "Zinc", "65.4", "[Ar] 4s2 3d10", "", 1.65, 139, 9.394, null, "+2", "Solid", 0, 692.68, 1180, 7.134, "Transition metal", 1746],
  [31, "Ga", "Gallium", "69.723", "[Ar] 4s2 3d10 4p1", "", 1.81, 187, 5.999, 0.3, "+3", "Solid", 0, 302.91, 2477, 5.91, "Post-transition metal", 1875],
  [32, "Ge", "Germanium", "72.63", "[Ar] 4s2 3d10 4p2", "", 2.01, 211, 7.9, 1.35, "+4, +2", "Solid", 0, 1211.4, 3106, 5.323, "Metalloid", 1886],
  [33, "As", "Arsenic", "74.92159", "[Ar] 4s2 3d10 4p3", "", 2.18, 185, 9.815, 0.81, "+5, +3, -3", "Solid", 0, 1090, 887, 5.776, "Metalloid", "Ancient"],
  [34, "Se", "Selenium", "78.97", "[Ar] 4s2 3d10 4p4", "", 2.55, 190, 9.752, 2.021, "+6, +4, -2", "Solid", 0, 493.65, 958, 4.809, "Nonmetal", 1817],
  [35, "Br", "Bromine", "79.90", "[Ar] 4s2 3d10 4p5", "", 2.96, 183, 11.814, 3.365, "+5, +1, -1", "Liquid", 0, 265.95, 331.95, 3.11, "Halogen", 1826],
  [36, "Kr", "Krypton", "83.80", "[Ar] 4s2 3d10 4p6", "", 3, 202, 14, null, "0", "Gas", 0, 115.79, 119.93, 3733e-6, "Noble gas", 1898],
  [37, "Rb", "Rubidium", "85.468", "[Kr] 5s1", "", 0.82, 303, 4.177, 0.468, "+1", "Solid", 0, 312.46, 961, 1.53, "Alkali metal", 1861],
  [38, "Sr", "Strontium", "87.62", "[Kr] 5s2", "", 0.95, 249, 5.695, null, "+2", "Solid", 0, 1050, 1655, 2.64, "Alkaline earth metal", 1790],
  [39, "Y", "Yttrium", "88.90584", "[Kr] 5s2 4d1", "", 1.22, 219, 6.217, 0.307, "+3", "Solid", 0, 1795, 3618, 4.47, "Transition metal", 1794],
  [40, "Zr", "Zirconium", "91.22", "[Kr] 5s2 4d2", "", 1.33, 186, 6.634, 0.426, "+4", "Solid", 0, 2128, 4682, 6.52, "Transition metal", 1789],
  [41, "Nb", "Niobium", "92.90637", "[Kr] 5s1 4d4", "", 1.6, 207, 6.759, 0.893, "+5, +3", "Solid", 0, 2750, 5017, 8.57, "Transition metal", 1801],
  [42, "Mo", "Molybdenum", "95.95", "[Kr] 5s1 4d5", "", 2.16, 209, 7.092, 0.746, "+6", "Solid", 0, 2896, 4912, 10.2, "Transition metal", 1778],
  [43, "Tc", "Technetium", "96.90636", "[Kr] 5s2 4d5", "", 1.9, 209, 7.28, 0.55, "+7, +6, +4", "Solid", 0, 2430, 4538, 11, "Transition metal", 1937],
  [44, "Ru", "Ruthenium", "101.1", "[Kr] 5s1 4d7", "", 2.2, 207, 7.361, 1.05, "+3", "Solid", 0, 2607, 4423, 12.1, "Transition metal", 1827],
  [45, "Rh", "Rhodium", "102.9055", "[Kr] 5s1 4d8", "", 2.28, 195, 7.459, 1.137, "+3", "Solid", 0, 2237, 3968, 12.4, "Transition metal", 1803],
  [46, "Pd", "Palladium", "106.42", "[Kr] 4d10", "", 2.2, 202, 8.337, 0.557, "+3, +2", "Solid", 0, 1828.05, 3236, 12, "Transition metal", 1803],
  [47, "Ag", "Silver", "107.868", "[Kr] 5s1 4d10", "", 1.93, 172, 7.576, 1.302, "+1", "Solid", 0, 1234.93, 2435, 10.501, "Transition metal", "Ancient"],
  [48, "Cd", "Cadmium", "112.41", "[Kr] 5s2 4d10", "", 1.69, 158, 8.994, null, "+2", "Solid", 0, 594.22, 1040, 8.69, "Transition metal", 1817],
  [49, "In", "Indium", "114.818", "[Kr] 5s2 4d10 5p1", "", 1.78, 193, 5.786, 0.3, "+3", "Solid", 0, 429.75, 2345, 7.31, "Post-transition metal", 1863],
  [50, "Sn", "Tin", "118.71", "[Kr] 5s2 4d10 5p2", "", 1.96, 217, 7.344, 1.2, "+4, +2", "Solid", 0, 505.08, 2875, 7.287, "Post-transition metal", "Ancient"],
  [51, "Sb", "Antimony", "121.760", "[Kr] 5s2 4d10 5p3", "", 2.05, 206, 8.64, 1.07, "+5, +3, -3", "Solid", 0, 903.78, 1860, 6.685, "Metalloid", "Ancient"],
  [52, "Te", "Tellurium", "127.6", "[Kr] 5s2 4d10 5p4", "", 2.1, 206, 9.01, 1.971, "+6, +4, -2", "Solid", 0, 722.66, 1261, 6.232, "Metalloid", 1782],
  [53, "I", "Iodine", "126.9045", "[Kr] 5s2 4d10 5p5", "", 2.66, 198, 10.451, 3.059, "+7, +5, +1, -1", "Solid", 0, 386.85, 457.55, 4.93, "Halogen", 1811],
  [54, "Xe", "Xenon", "131.29", "[Kr] 5s2 4d10 5p6", "", 2.6, 216, 12.13, null, "0", "Gas", 0, 161.36, 165.03, 5887e-6, "Noble gas", 1898],
  [55, "Cs", "Cesium", "132.9054520", "[Xe] 6s1", "", 0.79, 343, 3.894, 0.472, "+1", "Solid", 0, 301.59, 944, 1.93, "Alkali metal", 1860],
  [56, "Ba", "Barium", "137.33", "[Xe] 6s2", "", 0.89, 268, 5.212, null, "+2", "Solid", 0, 1e3, 2170, 3.62, "Alkaline earth metal", 1808],
  [57, "La", "Lanthanum", "138.9055", "[Xe] 6s2 5d1", "", 1.1, 240, 5.577, 0.5, "+3", "Solid", 0, 1191, 3737, 6.15, "Lanthanide", 1839],
  [58, "Ce", "Cerium", "140.116", "[Xe] 6s2 4f1 5d1", "", 1.12, 235, 5.539, 0.5, "+4, +3", "Solid", 0, 1071, 3697, 6.77, "Lanthanide", 1803],
  [59, "Pr", "Praseodymium", "140.90766", "[Xe] 6s2 4f3", "", 1.13, 239, 5.464, null, "+3", "Solid", 0, 1204, 3793, 6.77, "Lanthanide", 1885],
  [60, "Nd", "Neodymium", "144.24", "[Xe] 6s2 4f4", "", 1.14, 229, 5.525, null, "+3", "Solid", 0, 1294, 3347, 7.01, "Lanthanide", 1885],
  [61, "Pm", "Promethium", "144.91276", "[Xe] 6s2 4f5", "", null, 236, 5.55, null, "+3", "Solid", 0, 1315, 3273, 7.26, "Lanthanide", 1945],
  [62, "Sm", "Samarium", "150.4", "[Xe] 6s2 4f6", "", 1.17, 229, 5.644, null, "+3, +2", "Solid", 0, 1347, 2067, 7.52, "Lanthanide", 1879],
  [63, "Eu", "Europium", "151.964", "[Xe] 6s2 4f7", "", null, 233, 5.67, null, "+3, +2", "Solid", 0, 1095, 1802, 5.24, "Lanthanide", 1901],
  [64, "Gd", "Gadolinium", "157.25", "[Xe] 6s2 4f7 5d1", "", 1.2, 237, 6.15, null, "+3", "Solid", 0, 1586, 3546, 7.9, "Lanthanide", 1880],
  [65, "Tb", "Terbium", "158.92535", "[Xe] 6s2 4f9", "", null, 221, 5.864, null, "+3", "Solid", 0, 1629, 3503, 8.23, "Lanthanide", 1843],
  [66, "Dy", "Dysprosium", "162.500", "[Xe] 6s2 4f10", "", 1.22, 229, 5.939, null, "+3", "Solid", 0, 1685, 2840, 8.55, "Lanthanide", 1886],
  [67, "Ho", "Holmium", "164.93033", "[Xe] 6s2 4f11", "", 1.23, 216, 6.022, null, "+3", "Solid", 0, 1747, 2973, 8.8, "Lanthanide", 1878],
  [68, "Er", "Erbium", "167.26", "[Xe] 6s2 4f12", "", 1.24, 235, 6.108, null, "+3", "Solid", 0, 1802, 3141, 9.07, "Lanthanide", 1843],
  [69, "Tm", "Thulium", "168.93422", "[Xe] 6s2 4f13", "", 1.25, 227, 6.184, null, "+3", "Solid", 0, 1818, 2223, 9.32, "Lanthanide", 1879],
  [70, "Yb", "Ytterbium", "173.05", "[Xe] 6s2 4f14", "", null, 242, 6.254, null, "+3, +2", "Solid", 0, 1092, 1469, 6.9, "Lanthanide", 1878],
  [71, "Lu", "Lutetium", "174.9667", "[Xe] 6s2 4f14 5d1", "", 1.27, 221, 5.426, null, "+3", "Solid", 0, 1936, 3675, 9.84, "Lanthanide", 1907],
  [72, "Hf", "Hafnium", "178.49", "[Xe] 6s2 4f14 5d2", "", 1.3, 212, 6.825, null, "+4", "Solid", 0, 2506, 4876, 13.3, "Transition metal", 1923],
  [73, "Ta", "Tantalum", "180.9479", "[Xe] 6s2 4f14 5d3", "", 1.5, 217, 7.89, 0.322, "+5", "Solid", 0, 3290, 5731, 16.4, "Transition metal", 1802],
  [74, "W", "Tungsten", "183.84", "[Xe] 6s2 4f14 5d4", "", 2.36, 210, 7.98, 0.815, "+6", "Solid", 0, 3695, 5828, 19.3, "Transition metal", 1783],
  [75, "Re", "Rhenium", "186.207", "[Xe] 6s2 4f14 5d5", "", 1.9, 217, 7.88, 0.15, "+7, +6, +4", "Solid", 0, 3459, 5869, 20.8, "Transition metal", 1925],
  [76, "Os", "Osmium", "190.2", "[Xe] 6s2 4f14 5d6", "", 2.2, 216, 8.7, 1.1, "+4, +3", "Solid", 0, 3306, 5285, 22.57, "Transition metal", 1803],
  [77, "Ir", "Iridium", "192.22", "[Xe] 6s2 4f14 5d7", "", 2.2, 202, 9.1, 1.565, "+4, +3", "Solid", 0, 2719, 4701, 22.42, "Transition metal", 1803],
  [78, "Pt", "Platinum", "195.08", "[Xe] 6s1 4f14 5d9", "", 2.28, 209, 9, 2.128, "+4, +2", "Solid", 0, 2041.55, 4098, 21.46, "Transition metal", 1735],
  [79, "Au", "Gold", "196.96657", "[Xe] 6s1 4f14 5d10", "", 2.54, 166, 9.226, 2.309, "+3, +1", "Solid", 0, 1337.33, 3129, 19.282, "Transition metal", "Ancient"],
  [80, "Hg", "Mercury", "200.59", "[Xe] 6s2 4f14 5d10", "", 2, 209, 10.438, null, "+2, +1", "Liquid", 0, 234.32, 629.88, 13.5336, "Transition metal", "Ancient"],
  [81, "Tl", "Thallium", "204.383", "[Xe] 6s2 4f14 5d10 6p1", "", 1.62, 196, 6.108, 0.2, "+3, +1", "Solid", 0, 577, 1746, 11.8, "Post-transition metal", 1861],
  [82, "Pb", "Lead", "207", "[Xe] 6s2 4f14 5d10 6p2", "", 2.33, 202, 7.417, 0.36, "+4, +2", "Solid", 0, 600.61, 2022, 11.342, "Post-transition metal", "Ancient"],
  [83, "Bi", "Bismuth", "208.98040", "[Xe] 6s2 4f14 5d10 6p3", "", 2.02, 207, 7.289, 0.946, "+5, +3", "Solid", 0, 544.55, 1837, 9.807, "Post-transition metal", 1753],
  [84, "Po", "Polonium", "208.98243", "[Xe] 6s2 4f14 5d10 6p4", "", 2, 197, 8.417, 1.9, "+4, +2", "Solid", 0, 527, 1235, 9.32, "Metalloid", 1898],
  [85, "At", "Astatine", "209.98715", "[Xe] 6s2 4f14 5d10 6p5", "", 2.2, 202, 9.5, 2.8, "+7, +5, +3, +1, -1", "Solid", 0, 575, null, 7, "Halogen", 1940],
  [86, "Rn", "Radon", "222.01758", "[Xe] 6s2 4f14 5d10 6p6", "", null, 220, 10.745, null, "0", "Gas", 0, 202, 211.45, 973e-5, "Noble gas", 1900],
  [87, "Fr", "Francium", "223.01973", "[Rn] 7s1", "", 0.7, 348, 3.9, 0.47, "+1", "Solid", 0, 300, null, null, "Alkali metal", 1939],
  [88, "Ra", "Radium", "226.02541", "[Rn] 7s2", "", 0.9, 283, 5.279, null, "+2", "Solid", 0, 973, 1413, 5, "Alkaline earth metal", 1898],
  [89, "Ac", "Actinium", "227.02775", "[Rn] 7s2 6d1", "", 1.1, 260, 5.17, null, "+3", "Solid", 0, 1324, 3471, 10.07, "Actinide", 1899],
  [90, "Th", "Thorium", "232.038", "[Rn] 7s2 6d2", "", 1.3, 237, 6.08, null, "+4", "Solid", 0, 2023, 5061, 11.72, "Actinide", 1828],
  [91, "Pa", "Protactinium", "231.03588", "[Rn] 7s2 5f2 6d1", "", 1.5, 243, 5.89, null, "+5, +4", "Solid", 0, 1845, null, 15.37, "Actinide", 1913],
  [92, "U", "Uranium", "238.0289", "[Rn] 7s2 5f3 6d1", "", 1.38, 240, 6.194, null, "+6, +5, +4, +3", "Solid", 0, 1408, 4404, 18.95, "Actinide", 1789],
  [93, "Np", "Neptunium", "237.048172", "[Rn] 7s2 5f4 6d1", "", 1.36, 221, 6.266, null, "+6, +5, +4, +3", "Solid", 0, 917, 4175, 20.25, "Actinide", 1940],
  [94, "Pu", "Plutonium", "244.06420", "[Rn] 7s2 5f6", "", 1.28, 243, 6.06, null, "+6, +5, +4, +3", "Solid", 0, 913, 3501, 19.84, "Actinide", 1940],
  [95, "Am", "Americium", "243.061380", "[Rn] 7s2 5f7", "", 1.3, 244, 5.993, null, "+6, +5, +4, +3", "Solid", 0, 1449, 2284, 13.69, "Actinide", 1944],
  [96, "Cm", "Curium", "247.07035", "[Rn] 7s2 5f7 6d1", "", 1.3, 245, 6.02, null, "+3", "Solid", 0, 1618, 3400, 13.51, "Actinide", 1944],
  [97, "Bk", "Berkelium", "247.07031", "[Rn] 7s2 5f9", "", 1.3, 244, 6.23, null, "+4, +3", "Solid", 0, 1323, null, 14, "Actinide", 1949],
  [98, "Cf", "Californium", "251.07959", "[Rn] 7s2 5f10", "", 1.3, 245, 6.3, null, "+3", "Solid", 0, 1173, null, null, "Actinide", 1950],
  [99, "Es", "Einsteinium", "252.0830", "[Rn] 7s2 5f11", "", 1.3, 245, 6.42, null, "+3", "Solid", 0, 1133, null, null, "Actinide", 1952],
  [100, "Fm", "Fermium", "257.09511", "[Rn] 7s2 5f12", "", 1.3, null, 6.5, null, "+3", "Solid", 0, 1800, null, null, "Actinide", 1952],
  [101, "Md", "Mendelevium", "258.09843", "[Rn] 7s2 5f13", "", 1.3, null, 6.58, null, "+3, +2", "Solid", 0, 1100, null, null, "Actinide", 1955],
  [102, "No", "Nobelium", "259.10100", "[Rn] 7s2 5f14", "", 1.3, null, 6.65, null, "+3, +2", "Solid", 0, 1100, null, null, "Actinide", 1957],
  [103, "Lr", "Lawrencium", "266.120", "[Rn] 7s2 5f14 7p1", "", 1.3, null, null, null, "+3", "Solid", 0, 1900, null, null, "Actinide", 1961],
  [104, "Rf", "Rutherfordium", "267.122", "[Rn] 7s2 5f14 6d2", "", null, null, null, null, "+4", "Solid", 0, null, null, null, "Transition metal", 1964],
  [105, "Db", "Dubnium", "268.126", "[Rn] 7s2 5f14 6d3", "", null, null, null, null, "+5, +4, +3", "Solid", 0, null, null, null, "Transition metal", 1967],
  [106, "Sg", "Seaborgium", "269.128", "[Rn] 7s2 5f14 6d4", "", null, null, null, null, "+6, +5, +4, +3, 0", "Solid", 0, null, null, null, "Transition metal", 1974],
  [107, "Bh", "Bohrium", "270.133", "[Rn] 7s2 5f14 6d5", "", null, null, null, null, "+7, +5, +4, +3", "Solid", 0, null, null, null, "Transition metal", 1976],
  [108, "Hs", "Hassium", "269.1336", "[Rn] 7s2 5f14 6d6", "", null, null, null, null, "+8, +6, +5, +4, +3, +2", "Solid", 0, null, null, null, "Transition metal", 1984],
  [109, "Mt", "Meitnerium", "277.154", "[Rn] 7s2 5f14 6d7", "calculated", null, null, null, null, "+9, +8, +6, +4, +3, +1", "Solid", 0, null, null, null, "Transition metal", 1982],
  [110, "Ds", "Darmstadtium", "282.166", "[Rn] 7s2 5f14 6d8", "predicted", null, null, null, null, "+8, +6, +4, +2, 0", "Solid", 1, null, null, null, "Transition metal", 1994],
  [111, "Rg", "Roentgenium", "282.169", "[Rn] 7s2 5f14 6d9", "predicted", null, null, null, null, "+5, +3, +1, -1", "Solid", 1, null, null, null, "Transition metal", 1994],
  [112, "Cn", "Copernicium", "286.179", "[Rn] 7s2 5f14 6d10", "predicted", null, null, null, null, "+2, +1, 0", "Solid", 1, null, null, null, "Transition metal", 1996],
  [113, "Nh", "Nihonium", "286.182", "[Rn] 7s2 5f14 6d10 7p1", "predicted", null, null, null, null, "", "Solid", 1, null, null, null, "Post-transition metal", 2004],
  [114, "Fl", "Flerovium", "290.192", "[Rn] 7s2 5f14 6d10 7p2", "predicted", null, null, null, null, "+6, +4, +2, +1, 0", "Solid", 1, null, null, null, "Post-transition metal", 1998],
  [115, "Mc", "Moscovium", "290.196", "[Rn] 7s2 5f14 6d10 7p3", "predicted", null, null, null, null, "+3, +1", "Solid", 1, null, null, null, "Post-transition metal", 2003],
  [116, "Lv", "Livermorium", "293.205", "[Rn] 7s2 5f14 6d10 7p4", "predicted", null, null, null, null, "+4, +2, -2", "Solid", 1, null, null, null, "Post-transition metal", 2e3],
  [117, "Ts", "Tennessine", "294.211", "[Rn] 7s2 5f14 6d10 7p5", "predicted", null, null, null, null, "+5, +3, +1, -1", "Solid", 1, null, null, null, "Halogen", 2010],
  [118, "Og", "Oganesson", "295.216", "[Rn] 7s2 5f14 6d10 7p6", "predicted", null, null, null, null, "+6, +4, +2, +1, 0, -1", "Gas", 1, null, null, null, "Noble gas", 2006]
];

// client/src/utils/periodicTable.js
function periodicRuntime(ROWS) {
  var SPDF = "spdf";
  var CORE_Z = { He: 2, Ne: 10, Ar: 18, Kr: 36, Xe: 54, Rn: 86 };
  var SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  var MONO = "Menlo, Consolas, monospace";
  var NS = "http://www.w3.org/2000/svg";
  function esc8(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function n18(v) {
    return String(Math.round(v * 10) / 10);
  }
  function clamp4(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  var EL = {}, BY_SYMBOL = {};
  ROWS.forEach(function(r) {
    var e = {
      z: r[0],
      sym: r[1],
      name: r[2],
      mass: r[3],
      config: r[4],
      note: r[5],
      en: r[6],
      radius: r[7],
      ie: r[8],
      ea: r[9],
      ox: r[10],
      state: r[11],
      predicted: !!r[12],
      mp: r[13],
      bp: r[14],
      density: r[15],
      cat: r[16],
      year: typeof r[17] === "number" ? r[17] : null,
      yearText: r[17] == null ? "" : String(r[17])
    };
    e.massNum = parseFloat(e.mass);
    EL[e.z] = e;
    BY_SYMBOL[e.sym.toLowerCase()] = e.z;
  });
  function zOf(v) {
    if (typeof v === "number" || /^\s*\d+\s*$/.test(String(v))) {
      var n = Math.round(+v);
      return n >= 1 && n <= 118 ? n : null;
    }
    return BY_SYMBOL[String(v == null ? "" : v).trim().toLowerCase()] || null;
  }
  var parsed = {};
  function madelung(a, b) {
    return a.n + a.l - (b.n + b.l) || a.n - b.n;
  }
  function parse2(z) {
    if (parsed[z]) return parsed[z];
    var s = EL[z].config, core = null, m = /^\[(\w+)\]\s*/.exec(s), subs = [];
    if (m) {
      core = m[1];
      s = s.slice(m[0].length);
    }
    s.split(/\s+/).forEach(function(t) {
      var mm = /^(\d)([spdf])(\d+)$/.exec(t);
      if (mm) subs.push({ n: +mm[1], l: SPDF.indexOf(mm[2]), e: +mm[3] });
    });
    subs.sort(madelung);
    return parsed[z] = { core, subs };
  }
  function fullSubs(z) {
    var p = parse2(z);
    return (p.core ? fullSubs(CORE_Z[p.core]) : []).concat(p.subs).sort(madelung);
  }
  function shellCounts(z) {
    var counts = [];
    fullSubs(z).forEach(function(s) {
      counts[s.n - 1] = (counts[s.n - 1] || 0) + s.e;
    });
    for (var i = 0; i < counts.length; i++) counts[i] = counts[i] || 0;
    return counts;
  }
  function unpaired(z) {
    return fullSubs(z).reduce(function(a, s) {
      var k = 2 * s.l + 1;
      return a + (s.e <= k ? s.e : 2 * k - s.e);
    }, 0);
  }
  function subName(s) {
    return s.n + SPDF[s.l];
  }
  function pos(z, g3) {
    if (z === 1) return { r: 1, c: 1 };
    if (z === 2) return { r: 1, c: 18 };
    var i;
    if (z <= 10) {
      i = z - 3;
      return { r: 2, c: i < 2 ? i + 1 : i + 11 };
    }
    if (z <= 18) {
      i = z - 11;
      return { r: 3, c: i < 2 ? i + 1 : i + 11 };
    }
    if (z <= 36) return { r: 4, c: z - 18 };
    if (z <= 54) return { r: 5, c: z - 36 };
    var base = z <= 86 ? 55 : 87, r = z <= 86 ? 6 : 7, fr = z <= 86 ? 9 : 10;
    i = z - base;
    if (i < 2) return { r, c: i + 1 };
    var fi = i - 2;
    if (fi <= 14) {
      if (g3 === "la") return fi === 0 ? { r, c: 3 } : { r: fr, c: 3 + fi };
      if (g3 === "lu") return fi === 14 ? { r, c: 3 } : { r: fr, c: 4 + fi };
      return { r: fr, c: 3 + fi };
    }
    return { r, c: i - 13 };
  }
  function blockOf(z, g3) {
    var p = pos(z, g3);
    if (p.r >= 9) return "f";
    if (z === 2 || p.c <= 2) return "s";
    return p.c >= 13 ? "p" : "d";
  }
  function groupOf(z, g3) {
    var p = pos(z, g3);
    return p.r <= 7 ? p.c : null;
  }
  function periodOf(z, g3) {
    var p = pos(z, g3);
    return p.r <= 7 ? p.r : p.r - 3;
  }
  var CATEGORIES = ["Alkali metal", "Alkaline earth metal", "Transition metal", "Post-transition metal", "Metalloid", "Nonmetal", "Halogen", "Noble gas", "Lanthanide", "Actinide"];
  var CAT_HUE = { "Alkali metal": 4, "Alkaline earth metal": 32, "Transition metal": 210, "Post-transition metal": 166, "Metalloid": 70, "Nonmetal": 118, "Halogen": 190, "Noble gas": 268, "Lanthanide": 318, "Actinide": 342 };
  var BLOCK_HUE = { s: 4, p: 118, d: 210, f: 318 };
  var STATES = ["Solid", "Liquid", "Gas"];
  var STATE_HUE = { Solid: 32, Liquid: 205, Gas: 150 };
  var PROPS = {
    en: { label: "Electronegativity", unit: "", key: "en", dp: 2 },
    ie: { label: "Ionization energy", unit: "eV", key: "ie", dp: 2 },
    ea: { label: "Electron affinity", unit: "eV", key: "ea", dp: 2 },
    radius: { label: "Van der Waals radius", unit: "pm", key: "radius", dp: 0 },
    mp: { label: "Melting point", unit: "K", key: "mp", dp: 0 },
    bp: { label: "Boiling point", unit: "K", key: "bp", dp: 0 },
    density: { label: "Density", unit: "g/cm³", key: "density", log: true, dp: 3 },
    mass: { label: "Atomic mass", unit: "u", key: "massNum", dp: 1 },
    year: { label: "Year discovered", unit: "", key: "year", dp: 0 }
  };
  var RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
  var THEMES = {
    light: { dark: false, fg: "#16202a", muted: "#56636f", faint: "#87929c", line: "#d6dce1", surface: "#ffffff", accent: "#1d5fa6", onAccent: "#ffffff", code: "#e8ecef", pos: "#cf5a1f", neg: "#2470cc", tileS: 72, tileL: 89, strongS: 58, strongL: 44, edge: 0.09 },
    dark: { dark: true, fg: "#e3e8ed", muted: "#9ba7b3", faint: "#7a8692", line: "#3a4652", surface: "#151c22", accent: "#7db0ff", onAccent: "#0e1317", code: "#1f2a33", pos: "#ff9759", neg: "#63a6f7", tileS: 32, tileL: 23, strongS: 62, strongL: 64, edge: 0.08 }
  };
  function hsl(h, s, l) {
    s /= 100;
    l /= 100;
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12;
      return ("0" + Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16)).slice(-2);
    }
    return "#" + f(0) + f(8) + f(4);
  }
  function rgbOf(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rampAt(t, dark) {
    var stops = dark ? RAMP.slice(1).reverse() : RAMP;
    t = clamp4(t, 0, 1) * (stops.length - 1);
    var i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = rgbOf(stops[i]), b = rgbOf(stops[i + 1]);
    var c = a.map(function(v, k) {
      return Math.round(v + (b[k] - v) * f);
    });
    var lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    return { bg: "#" + c.map(function(v) {
      return ("0" + v.toString(16)).slice(-2);
    }).join(""), ink: lum < 0.5 ? "#ffffff" : "#0f1720" };
  }
  var ranges = {};
  function propRange(p) {
    if (ranges[p.key]) return ranges[p.key];
    var vals = [];
    for (var z = 1; z <= 118; z++) {
      var v = EL[z][p.key];
      if (v != null && isFinite(v) && (!p.log || v > 0)) vals.push(p.log ? Math.log10(v) : v);
    }
    return ranges[p.key] = [Math.min.apply(null, vals), Math.max.apply(null, vals)];
  }
  function heatT(p, v) {
    if (v == null || !isFinite(v) || p.log && v <= 0) return null;
    var r = propRange(p), x = p.log ? Math.log10(v) : v;
    return (x - r[0]) / (r[1] - r[0] || 1);
  }
  function fmtVal(p, v) {
    if (v == null || !isFinite(v)) return "—";
    if (p.key === "density") return v < 0.01 ? v.toExponential(1) : v < 1 ? v.toFixed(3) : v.toFixed(2);
    return (p.dp === 0 ? String(Math.round(v)) : v.toFixed(p.dp)).replace("-", "−");
  }
  function keyOf(z, colorBy, g3) {
    var e = EL[z];
    return colorBy === "category" ? e.cat : colorBy === "block" ? blockOf(z, g3) : colorBy === "state" ? e.state : null;
  }
  function hueOf(z, colorBy, g3) {
    var e = EL[z];
    return colorBy === "block" ? BLOCK_HUE[blockOf(z, g3)] : colorBy === "state" ? STATE_HUE[e.state] : CAT_HUE[e.cat];
  }
  var COLOR_BY = ["category", "block", "state", "en", "ie", "ea", "radius", "mp", "bp", "density", "mass", "year"];
  var VIEWS = ["boxes", "shells", "clouds", "none"];
  var SHOWS = ["all", "periods-1-4", "main-group", "periods-1-3", "element"];
  var TILE_LABELS = ["auto", "name", "mass", "valence", "none"];
  var TRENDS = {
    en: { label: "Electronegativity", right: true, up: true },
    ie: { label: "Ionization energy", right: true, up: true },
    ea: { label: "Electron affinity", right: true, up: true },
    radius: { label: "Atomic radius", right: false, up: false },
    metallic: { label: "Metallic character", right: false, up: false }
  };
  var HL_KINDS = ["group", "period", "block", "category", "state", "z"];
  function pick2(v, list, d) {
    return list.indexOf(v) >= 0 ? v : d;
  }
  function parseHighlight(spec) {
    var out = [];
    String(spec || "").split(";").forEach(function(part2) {
      var m = /^\s*(\w+)\s*:\s*(.*)$/.exec(part2);
      if (!m || HL_KINDS.indexOf(m[1]) < 0) return;
      var kind = m[1], vals = [];
      m[2].split(",").forEach(function(raw) {
        var v = raw.trim(), n = +v, hit = null;
        if (kind === "group") hit = n >= 1 && n <= 18 && n % 1 === 0 ? n : null;
        else if (kind === "period") hit = n >= 1 && n <= 7 && n % 1 === 0 ? n : null;
        else if (kind === "block") hit = /^[spdf]$/.test(v) ? v : null;
        else if (kind === "category") hit = CATEGORIES.filter(function(c) {
          return c.toLowerCase() === v.toLowerCase();
        })[0] || null;
        else if (kind === "state") hit = STATES.filter(function(c) {
          return c.toLowerCase() === v.toLowerCase();
        })[0] || null;
        else hit = zOf(v);
        if (hit != null && vals.indexOf(hit) < 0) vals.push(hit);
      });
      if (vals.length) out.push({ kind, vals });
    });
    return out;
  }
  function cleanHighlight(spec) {
    return parseHighlight(spec).map(function(h) {
      return h.kind + ":" + h.vals.join(",");
    }).join(";");
  }
  var hlCache = {};
  function highlighted(spec, z, g3) {
    var hs = hlCache[spec] || (hlCache[spec] = parseHighlight(spec));
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], v = h.kind === "group" ? groupOf(z, g3) : h.kind === "period" ? periodOf(z, g3) : h.kind === "block" ? blockOf(z, g3) : h.kind === "category" ? EL[z].cat : h.kind === "state" ? EL[z].state : z;
      if (h.vals.indexOf(v) >= 0) return true;
    }
    return false;
  }
  function normStep(st) {
    st = st && typeof st === "object" ? st : {};
    return { highlight: cleanHighlight(st.highlight), pin: zOf(st.pin), arrow: TRENDS[st.arrow] ? st.arrow : "", colorBy: pick2(st.colorBy, COLOR_BY, "") };
  }
  function normalize(el) {
    el = el && typeof el === "object" ? el : {};
    var start = Math.round(+el.stepStart);
    return {
      colorBy: pick2(el.colorBy, COLOR_BY, "category"),
      orbitalView: pick2(el.orbitalView, VIEWS, "boxes"),
      showCore: !!el.showCore,
      group3: pick2(el.group3, ["gap", "la", "lu"], "gap"),
      show: pick2(el.show, SHOWS, "all"),
      restingElement: el.restingElement === null ? null : zOf(el.restingElement) || 26,
      card: pick2(el.card, ["gap", "side", "none"], "gap"),
      tileLabel: pick2(el.tileLabel, TILE_LABELS, "auto"),
      labels: el.labels !== false,
      legend: el.legend !== false,
      source: el.source !== false,
      theme: el.theme === "light" ? "light" : "dark",
      highlight: cleanHighlight(el.highlight),
      arrow: TRENDS[el.arrow] ? el.arrow : "",
      stepStart: start >= 1 && start <= 1e3 ? start : 1,
      steps: (Array.isArray(el.steps) ? el.steps : []).slice(0, 60).map(normStep)
    };
  }
  function viewAt(s, n) {
    var st = n > 0 ? s.steps[n - 1] : null;
    if (!st) return { colorBy: s.colorBy, highlight: s.highlight, arrow: s.arrow, pin: null };
    return { colorBy: st.colorBy || s.colorBy, highlight: st.highlight, arrow: st.arrow, pin: st.pin };
  }
  var CARD_WIDE = { w: 636, h: 188 }, CARD_TALL = { w: 372, h: 360 };
  var ROW_H = 18;
  function textW(s, fs, k) {
    return String(s).length * fs * (k || 0.52);
  }
  function legendItems(colorBy, g3) {
    if (colorBy === "category") return CATEGORIES.map(function(c) {
      return { key: c, label: c, hue: CAT_HUE[c] };
    });
    if (colorBy === "block") return ["s", "p", "d", "f"].map(function(b) {
      return { key: b, label: b + "-block", hue: BLOCK_HUE[b] };
    });
    if (colorBy === "state") return STATES.map(function(c) {
      return { key: c, label: c, hue: STATE_HUE[c] };
    }).concat([{ key: null, label: "Dashed: predicted" }]);
    return null;
  }
  function flowLegend(items, w) {
    var x = 0, row = 0, out = [];
    items.forEach(function(it) {
      var iw = (it.key != null ? 15 : 0) + textW(it.label, 11);
      if (x > 0 && x + iw > w) {
        x = 0;
        row++;
      }
      out.push({ it, x, row, w: iw });
      x += iw + 14;
    });
    return { items: out, rows: row + 1 };
  }
  function legendRows(colorBy, w) {
    var items = legendItems(colorBy);
    return items ? flowLegend(items, w).rows : w >= 700 ? 1 : 2;
  }
  function layout(s) {
    var arrows = !!s.arrow || s.steps.some(function(st) {
      return !!st.arrow;
    });
    if (s.show === "element") {
      var cw = CARD_WIDE.w, ch = CARD_WIDE.h;
      return { W: cw, H: ch, tiles: [], glabels: [], plabels: [], flabels: [], ph: [], card: { x: 0, y: 0, w: cw, h: ch, mode: "wide" }, legend: null, bands: false, vb: { x: -4, y: -4, w: cw + 8, h: ch + 8 } };
    }
    var wide = s.show === "all" || s.show === "periods-1-4";
    var ox = arrows ? 34 : 0, oy = arrows ? 34 : 0, lab = s.labels ? 24 : 0;
    var ncol = wide ? 18 : 8;
    var maxPeriod = s.show === "periods-1-4" ? 4 : s.show === "periods-1-3" ? 3 : 7;
    var withF = s.show === "all";
    var colOf = function(c) {
      return wide ? c : c <= 2 ? c : c - 10;
    };
    var X = function(col2) {
      return ox + lab + (col2 - 1) * 64;
    };
    var Y = function(r2) {
      return oy + lab + (r2 <= 7 ? (r2 - 1) * 64 : 466 + (r2 - 9) * 64);
    };
    var L = { tiles: [], glabels: [], plabels: [], flabels: [], ph: [], bands: arrows, ox, oy };
    for (var z = 1; z <= 118; z++) {
      var p = pos(z, s.group3);
      if (p.r > 7 ? !withF : p.r > maxPeriod) continue;
      if (!wide && p.c > 2 && p.c < 13) continue;
      L.tiles.push({ z, x: X(colOf(p.c)), y: Y(p.r), r: p.r, c: colOf(p.c) });
    }
    var GROUPS = wide ? null : [1, 2, 13, 14, 15, 16, 17, 18];
    if (s.labels) {
      for (var col = 1; col <= ncol; col++) L.glabels.push({ x: X(col) + 30, y: oy + 14, t: String(GROUPS ? GROUPS[col - 1] : col) });
      for (var r = 1; r <= maxPeriod; r++) L.plabels.push({ x: ox + 9, y: Y(r) + 34, t: String(r) });
    }
    if (withF) {
      var fStart = s.group3 === "gap" ? 3 : 4;
      L.flabels.push({ x: X(fStart) - 7, y: Y(9) + 34, t: "Lanthanides" }, { x: X(fStart) - 7, y: Y(10) + 34, t: "Actinides" });
      if (s.group3 === "gap") L.ph.push({ x: X(3), y: Y(6), t: "57–71", cat: "Lanthanide", from: 57, to: 71 }, { x: X(3), y: Y(7), t: "89–103", cat: "Actinide", from: 89, to: 103 });
    }
    var right = X(ncol) + 60, bottom = withF ? Y(10) + 60 : Y(maxPeriod) + 60;
    L.tx0 = X(1);
    L.tx1 = right;
    L.ty0 = Y(1);
    L.ty1 = Y(maxPeriod) + 60;
    var card = null;
    if (s.card === "gap" && wide) card = { x: X(3), y: Y(1), w: CARD_WIDE.w, h: CARD_WIDE.h, mode: "wide" };
    else if (s.card !== "none") card = maxPeriod <= 3 && !withF ? { x: right + 16, y: Y(1), w: CARD_WIDE.w, h: CARD_WIDE.h, mode: "wide" } : { x: right + 16, y: Y(1), w: CARD_TALL.w, h: CARD_TALL.h, mode: "tall" };
    L.card = card;
    var W = card ? Math.max(right, card.x + card.w) : right;
    var H = card ? Math.max(bottom, card.y + card.h) : bottom;
    L.legend = null;
    if (s.legend) {
      var lw = right - ox - lab;
      var rows = Math.max(legendRows("category", lw), legendRows("block", lw), legendRows("state", lw), legendRows("en", lw));
      L.legend = { x: ox + lab, y: H + 14, w: lw, h: rows * ROW_H };
      H = L.legend.y + L.legend.h;
    }
    L.W = W;
    L.H = H;
    L.vb = { x: -6, y: -6, w: W + 12, h: H + 12 };
    return L;
  }
  function fit(w, max, fs, min) {
    return w > max ? Math.max(min || 5, fs * max / w) : fs;
  }
  function text(x, y, s, a) {
    return '<text x="' + n18(x) + '" y="' + n18(y) + '"' + (a || "") + ">" + esc8(s) + "</text>";
  }
  function supText(x, y, runs, fs, a, sep) {
    var out = "", down = false;
    runs.forEach(function(r, i) {
      out += "<tspan" + (down ? ' dy="' + n18(fs * 0.38) + '"' : "") + ">" + esc8((i && sep ? sep : "") + r[0]) + "</tspan>";
      down = false;
      if (r[1]) {
        out += '<tspan dy="' + n18(-fs * 0.38) + '" font-size="' + n18(fs * 0.7) + '">' + esc8(r[1]) + "</tspan>";
        down = true;
      }
    });
    return '<text x="' + n18(x) + '" y="' + n18(y) + '" font-size="' + n18(fs) + '"' + (a || "") + ">" + out + "</text>";
  }
  function runsW(runs, fs, k, sep) {
    return runs.reduce(function(w, r, i) {
      return w + ((i && sep ? sep.length : 0) + r[0].length) * fs * k + (r[1] || "").length * fs * k * 0.7;
    }, 0);
  }
  function configRuns(z, full) {
    var p = parse2(z), subs = full ? fullSubs(z) : p.subs;
    var runs = subs.map(function(s) {
      return [subName(s), String(s.e)];
    });
    if (!full && p.core) runs.unshift(["[" + p.core + "]", ""]);
    return runs;
  }
  function look(z, v, s, th) {
    var e = EL[z], prop = PROPS[v.colorBy];
    if (prop) {
      var val = e[prop.key], t = heatT(prop, val);
      if (t == null) return { fill: th.surface, fillOp: 0, ink: th.muted, stroke: th.faint, dash: true, value: prop.key === "year" && e.yearText ? e.yearText : "—" };
      var c = rampAt(t, th.dark);
      return { fill: c.bg, ink: c.ink, value: fmtVal(prop, val) };
    }
    var h = hueOf(z, v.colorBy, s.group3), strong = hsl(h, th.strongS, th.strongL);
    return { fill: hsl(h, th.tileS, th.tileL), ink: th.fg, stripe: strong, stroke: v.colorBy === "state" && e.predicted ? strong : null, dash: v.colorBy === "state" && e.predicted };
  }
  function shortMass(m) {
    var v = parseFloat(m);
    return isFinite(v) ? String(Number(v.toFixed(3))) : m;
  }
  function tileSvg(t, s, v, th, o) {
    var z = t.z, e = EL[z], lk = look(z, v, s, th);
    var a = ' data-pt-z="' + z + '" transform="translate(' + t.x + " " + t.y + ')"' + (dimmed(z, v, s, o.key) ? ' opacity="0.22"' : "");
    if (o.mode === "deck") a += ' tabindex="' + (z === o.tab ? 0 : -1) + '" role="button" aria-label="' + esc8(e.name + ", " + z) + '" style="cursor:pointer;outline:none;transition:opacity .18s"';
    else if (o.mode === "canvas") a += ' style="cursor:pointer;transition:opacity .18s"';
    var h = "<g" + a + '><rect width="60" height="60" rx="6" fill="' + lk.fill + '"' + (lk.fillOp === 0 ? ' fill-opacity="0"' : "");
    h += lk.dash ? ' stroke="' + lk.stroke + '" stroke-dasharray="3 2"/>' : ' stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"/>';
    if (lk.stripe) h += '<rect x="5" y="55" width="50" height="2" rx="1" fill="' + lk.stripe + '" opacity="0.85"/>';
    h += text(5, 12.5, z, ' font-family="' + MONO + '" font-size="9.5" fill="' + lk.ink + '" opacity="0.8"');
    h += text(30, 38, e.sym, ' text-anchor="middle" font-size="22" font-weight="700" fill="' + lk.ink + '"');
    var mode = s.tileLabel === "auto" ? lk.value != null ? "value" : "name" : s.tileLabel;
    var a2 = ' text-anchor="middle" fill="' + lk.ink + '"';
    if (mode === "value" || mode === "name" && lk.value != null && s.tileLabel === "auto") {
      h += text(30, 50.5, lk.value, a2 + ' font-family="' + MONO + '" font-size="' + n18(fit(textW(lk.value, 8.6, 0.6), 54, 8.6)) + '"');
    } else if (mode === "name") {
      h += text(30, 50.5, e.name, a2 + ' font-size="' + n18(fit(textW(e.name, 8.6), 54, 8.6, 6)) + '"');
    } else if (mode === "mass") {
      var m = shortMass(e.mass);
      h += text(30, 50.5, m, a2 + ' font-family="' + MONO + '" font-size="' + n18(fit(textW(m, 8.6, 0.6), 54, 8.6)) + '"');
    } else if (mode === "valence") {
      var runs = configRuns(z).filter(function(r) {
        return r[1];
      });
      var fs = fit(runsW(runs, 8.6, 0.6), 54, 8.6, 5);
      h += supText(30, 51, runs, fs, a2 + ' font-family="' + MONO + '"');
    }
    return h + "</g>";
  }
  function dimmed(z, v, s, key) {
    return !!v.highlight && !highlighted(v.highlight, z, s.group3) || key != null && keyOf(z, v.colorBy, s.group3) !== key;
  }
  function phDimmed(p, v, s, key) {
    for (var z = p.from; z <= p.to; z++) if (!dimmed(z, v, s, key)) return false;
    return true;
  }
  function ringsSvg(L, shown, pinned, th) {
    var t = tileAt(L, shown), p = tileAt(L, pinned);
    var tr = function(x) {
      return x ? ' transform="translate(' + x.x + " " + x.y + ')"' : ' visibility="hidden"';
    };
    return '<g data-pt-rings style="pointer-events:none"><rect data-pt-ring="1" x="-1.5" y="-1.5" width="63" height="63" rx="7.5" fill="none" stroke="' + th.accent + '" stroke-width="2.4"' + tr(t) + '/><rect data-pt-ring="2" x="-5.5" y="-5.5" width="71" height="71" rx="10" fill="none" stroke="' + th.accent + '" stroke-width="1.2"' + tr(p) + "/></g>";
  }
  function tileAt(L, z) {
    for (var i = 0; z && i < L.tiles.length; i++) if (L.tiles[i].z === z) return L.tiles[i];
    return null;
  }
  function factRows(e) {
    var u = function(v, unit, dp) {
      return v == null ? "—" : (dp != null ? v.toFixed(dp) : String(v)).replace("-", "−") + (unit ? " " + unit : "");
    };
    return [
      ["en", "Electronegativity", u(e.en, "", 2)],
      ["ie", "Ionization energy", u(e.ie, "eV", 3)],
      ["ea", "Electron affinity", u(e.ea, "eV", 3)],
      ["radius", "Van der Waals radius", u(e.radius, "pm")],
      ["ox", "Oxidation states", (e.ox || "—").replace(/-/g, "−")],
      ["mp", "Melting point", u(e.mp, "K")],
      ["bp", "Boiling point", u(e.bp, "K")],
      ["density", "Density", e.density == null ? "—" : fmtVal(PROPS.density, e.density) + " g/cm³"]
    ];
  }
  function cardSvg(z, s, v, th, o, C2, at) {
    if (!z || !EL[z]) return "";
    var e = EL[z], lk = look(z, v, s, th), prop = PROPS[v.colorBy];
    var h = '<rect width="' + C2.w + '" height="' + C2.h + '" rx="8" fill="' + th.surface + '" stroke="' + th.line + '"/>';
    h += '<rect x="8" y="8" width="108" height="104" rx="7" fill="' + (lk.fillOp === 0 ? th.code : lk.fill) + '" stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"/>';
    var ink = lk.fillOp === 0 ? th.fg : lk.ink;
    h += text(15, 21, z, ' font-family="' + MONO + '" font-size="11" fill="' + ink + '"');
    h += text(109, 21, e.mass, ' text-anchor="end" font-family="' + MONO + '" font-size="' + n18(fit(textW(e.mass, 9.5, 0.6), 64, 9.5)) + '" fill="' + ink + '" opacity="0.72"');
    h += text(62, 72, e.sym, ' text-anchor="middle" font-size="44" font-weight="700" fill="' + ink + '"');
    h += text(62, 98, e.name, ' text-anchor="middle" font-size="' + n18(fit(textW(e.name, 13), 100, 13, 8)) + '" font-weight="600" fill="' + ink + '"');
    var cat = hsl(CAT_HUE[e.cat], th.strongS, th.strongL);
    h += '<rect x="8" y="121" width="8" height="8" rx="2" fill="' + cat + '"/>';
    h += text(20, 129, e.cat, ' font-size="' + n18(fit(textW(e.cat, 10.5), 96, 10.5, 7)) + '" font-weight="600" fill="' + th.fg + '"');
    var meta = [(e.predicted ? "Predicted " + e.state.toLowerCase() : e.state) + " at 298 K", blockOf(z, s.group3) + "-block", e.year ? "Discovered " + e.year : e.yearText === "Ancient" ? "Known since antiquity" : ""];
    meta.forEach(function(m, i) {
      if (m) h += text(8, 144 + i * 14, m, ' font-size="' + n18(fit(textW(m, 10.5), 108, 10.5, 7)) + '" fill="' + th.muted + '"');
    });
    var x0 = 128, x1 = 364, runs = configRuns(z);
    var note = e.note ? " (" + e.note + ")" : "";
    var cfs = fit(runsW(runs, 13, 0.6, " ") + textW(note, 10, 0.55), 236, 13, 7);
    h += supText(x0, 25, runs, cfs, ' font-family="' + MONO + '" fill="' + th.fg + '"', " ").replace("</text>", note ? '<tspan dy="' + (runs[runs.length - 1][1] ? n18(cfs * 0.38) : 0) + '" font-family="' + SANS + '" font-size="' + n18(cfs * 0.75) + '" fill="' + th.muted + '">' + esc8(note) + "</tspan></text>" : "</text>");
    factRows(e).forEach(function(r, i) {
      var y = 48 + i * 16, hl = prop && (prop.key === r[0] || prop.key === "massNum" && r[0] === "mass");
      var col = hl ? th.accent : th.muted, vcol = hl ? th.accent : th.fg;
      var lw = textW(r[1], 11) + 8, val = r[2];
      if (textW(val, 11, 0.6) > 236 - lw) val = val.replace(/, /g, ",");
      h += text(x0, y, r[1], ' font-size="11" fill="' + col + '"');
      h += text(x1, y, val, ' text-anchor="end" font-family="' + MONO + '" font-size="' + n18(fit(textW(val, 11, 0.6), 236 - lw, 11, 6.5)) + '" fill="' + vcol + '"');
    });
    if (s.source) h += text(C2.mode === "wide" ? x1 : C2.w - 8, C2.h - 7, "Data: PubChem", ' text-anchor="end" font-size="8.5" fill="' + th.faint + '"');
    var B = C2.mode === "wide" ? { x: 376, y: 8, w: C2.w - 384, h: C2.h - 16 } : { x: 8, y: 190, w: C2.w - 16, h: C2.h - 210 };
    if (s.orbitalView === "boxes") h += boxesSvg(z, B, s, th);
    else if (s.orbitalView === "shells") h += shellsSvg(z, B, th, o.mode === "deck" && o.animate);
    else if (s.orbitalView === "clouds") h += cloudsSvg(z, B, th, o, C2, at);
    if (o.mode === "deck" && o.pinned === z) h += text(C2.mode === "wide" ? x0 : 8, C2.h - 7, "Pinned · Esc to let go", ' font-family="' + MONO + '" font-size="9" fill="' + th.accent + '"');
    return h;
  }
  function header(B, s, th) {
    return text(B.x, B.y + 10, s, ' font-family="' + MONO + '" font-size="10" fill="' + th.muted + '"');
  }
  function boxesSvg(z, B, s, th) {
    var p = parse2(z), all = fullSubs(z), subs = s.showCore ? all : p.subs.slice(), front = all[all.length - 1];
    var h = header(B, "Orbital boxes · " + unpaired(z) + " unpaired", th);
    var area = { x: B.x, y: B.y + 20, w: B.w, h: B.h - 20 };
    var core = !s.showCore && p.core ? "[" + p.core + "]" : null;
    var sizes = [18, 15, 13, 11, 9, 7], place = null, bw = 7;
    for (var si = 0; si < sizes.length && !place; si++) {
      bw = sizes[si];
      var bh = bw + 4, x = 0, y = 0, items = [], rowH = 12 + bh + 7;
      var add2 = function(w, item) {
        if (x > 0 && x + w > area.w) {
          x = 0;
          y += rowH;
        }
        item.x = x;
        item.y = y;
        items.push(item);
        x += w + 9;
      };
      if (core) add2(textW(core, 11, 0.6) + 12, { core: true });
      subs.forEach(function(sub2) {
        add2((2 * sub2.l + 1) * bw + 1, { sub: sub2 });
      });
      if (y + rowH - 7 <= area.h || si === sizes.length - 1) place = { items, bh };
    }
    place.items.forEach(function(it) {
      var X = area.x + it.x, Y = area.y + it.y;
      if (it.core) {
        var cw = textW(core, 11, 0.6) + 12;
        h += '<rect x="' + n18(X) + '" y="' + n18(Y + 12) + '" width="' + n18(cw) + '" height="' + n18(place.bh) + '" rx="4" fill="' + th.code + '"/>';
        h += text(X + cw / 2, Y + 12 + place.bh / 2 + 3.8, core, ' text-anchor="middle" font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"');
        return;
      }
      var sb = it.sub, k = 2 * sb.l + 1, up = Math.min(sb.e, k), down = Math.max(0, sb.e - k);
      var isFront = sb.n === front.n && sb.l === front.l, w = bw, bh2 = place.bh;
      h += text(X, Y + 9, subName(sb), ' font-family="' + MONO + '" font-size="10" fill="' + (isFront ? th.accent : th.muted) + '"');
      for (var i = 0; i < k; i++) {
        var bx = X + i * w + 0.5, by = Y + 12.5;
        h += '<rect x="' + n18(bx) + '" y="' + n18(by) + '" width="' + w + '" height="' + bh2 + '" fill="none" stroke="' + th.muted + '"/>';
        var a1 = bx + w * 0.34, a2 = bx + w * 0.66, t = by + bh2 * 0.18, bt = by + bh2 * 0.82, hd = w * 0.2;
        var line = ' fill="none" stroke="' + th.fg + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
        if (i < up) h += '<path d="M' + n18(a1) + " " + n18(bt) + "V" + n18(t) + "l" + n18(-hd) + " " + n18(hd * 1.2) + '"' + line;
        if (i < down) h += '<path d="M' + n18(a2) + " " + n18(t) + "V" + n18(bt) + "l" + n18(hd) + " " + n18(-hd * 1.2) + '"' + line;
      }
    });
    return h;
  }
  function shellsSvg(z, B, th, animate) {
    var counts = shellCounts(z), N = counts.length, e = EL[z];
    var h = header(B, "Bohr shells · " + counts.join(" · "), th);
    var area = { x: B.x, y: B.y + 16, w: B.w, h: B.h - 16 };
    var R = Math.max(20, Math.min(area.h / 2 - 2, (area.w - 56) / 2)), cx = area.x + R + 2, cy = area.y + area.h / 2;
    var rIn = Math.max(10, R * 0.28), nucleus = R * 0.17;
    h += '<circle cx="' + n18(cx) + '" cy="' + n18(cy) + '" r="' + n18(nucleus) + '" fill="' + hsl(CAT_HUE[e.cat], th.strongS, th.strongL) + '"/>';
    h += text(cx, cy + nucleus * 0.3, e.sym, ' text-anchor="middle" font-size="' + n18(nucleus * 0.85) + '" font-weight="700" fill="' + th.surface + '"');
    for (var k = 0; k < N; k++) {
      var r = N === 1 ? R * 0.55 : rIn + k * (R - rIn) / (N - 1), outer = k === N - 1, n = counts[k], off = k * 0.5;
      h += '<circle cx="' + n18(cx) + '" cy="' + n18(cy) + '" r="' + n18(r) + '" fill="none" stroke="' + th.line + '"/>';
      h += "<g>";
      for (var j = 0; j < n; j++) {
        var a = off + j * 2 * Math.PI / n;
        h += '<circle cx="' + n18(cx + r * Math.cos(a)) + '" cy="' + n18(cy + r * Math.sin(a)) + '" r="' + n18(R * (n > 18 ? 0.029 : 0.035)) + '" fill="' + (outer ? th.accent : th.fg) + '"/>';
      }
      if (animate) {
        var dur = 14 + k * 7, from = k % 2 ? 360 : 0;
        h += '<animateTransform attributeName="transform" type="rotate" from="' + from + " " + n18(cx) + " " + n18(cy) + '" to="' + (360 - from) + " " + n18(cx) + " " + n18(cy) + '" dur="' + dur + 's" repeatCount="indefinite"/>';
      }
      h += "</g>";
      h += text(cx + R + 14, area.y + 12 + k * 15, "KLMNOPQ"[k] + " " + n, ' font-family="' + MONO + '" font-size="10.5" fill="' + (outer ? th.accent : th.muted) + '"');
    }
    return h;
  }
  var ANG = [
    [{ f: function() {
      return 1;
    }, lab: ["s", ""] }],
    [{ f: function(x) {
      return x;
    }, lab: ["p", "x"] }, { f: function(x, y) {
      return y;
    }, lab: ["p", "y"] }, { f: function(x, y, z) {
      return z;
    }, lab: ["p", "z"] }],
    [
      { f: function(x, y) {
        return x * y;
      }, lab: ["d", "xy"] },
      { f: function(x, y, z) {
        return y * z;
      }, lab: ["d", "yz"] },
      { f: function(x, y, z) {
        return 3 * z * z - 1;
      }, lab: ["d", "z²"] },
      { f: function(x, y, z) {
        return x * z;
      }, lab: ["d", "xz"] },
      { f: function(x, y) {
        return x * x - y * y;
      }, lab: ["d", "x²−y²"] }
    ],
    [
      { f: function(x, y) {
        return y * (3 * x * x - y * y);
      }, lab: ["f", "y(3x²−y²)"] },
      { f: function(x, y, z) {
        return x * y * z;
      }, lab: ["f", "xyz"] },
      { f: function(x, y, z) {
        return y * (5 * z * z - 1);
      }, lab: ["f", "yz²"] },
      { f: function(x, y, z) {
        return z * (5 * z * z - 3);
      }, lab: ["f", "z³"] },
      { f: function(x, y, z) {
        return x * (5 * z * z - 1);
      }, lab: ["f", "xz²"] },
      { f: function(x, y, z) {
        return z * (x * x - y * y);
      }, lab: ["f", "z(x²−y²)"] },
      { f: function(x, y) {
        return x * (x * x - 3 * y * y);
      }, lab: ["f", "x(x²−3y²)"] }
    ]
  ];
  function laguerre(k, a, x) {
    if (k === 0) return 1;
    var L0 = 1, L1 = 1 + a - x;
    for (var i = 1; i < k; i++) {
      var L2 = ((2 * i + 1 + a - x) * L1 - (i + a) * L0) / (i + 1);
      L0 = L1;
      L1 = L2;
    }
    return L1;
  }
  function radial(n, l, r) {
    var rho = 2 * r / n;
    return Math.pow(rho, l) * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
  }
  function rng(seed) {
    return function() {
      seed = seed + 1831565813 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var CLOUD_N = [2600, 1700, 1100, 900];
  var clouds = {};
  function samples(n, l, m) {
    var key = n + "_" + l + "_" + m;
    if (clouds[key]) return clouds[key];
    var rand = rng(n * 1e3 + l * 100 + m + 1);
    var dir = function() {
      var x, y, z, d2;
      do {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
        d2 = x * x + y * y + z * z;
      } while (d2 > 1 || d2 < 1e-6);
      d2 = Math.sqrt(d2);
      return [x / d2, y / d2, z / d2];
    };
    var rmax = 3 * n * n + 10, G2 = 1200, cdf = new Float64Array(G2 + 1), acc = 0, i;
    for (i = 1; i <= G2; i++) {
      var rr0 = rmax * i / G2, R0 = radial(n, l, rr0);
      acc += rr0 * rr0 * R0 * R0;
      cdf[i] = acc;
    }
    var Y = ANG[l][m].f, ymax = 0;
    for (i = 0; i < 4e3; i++) {
      var d0 = dir(), v0 = Y(d0[0], d0[1], d0[2]);
      if (v0 * v0 > ymax) ymax = v0 * v0;
    }
    ymax *= 1.15;
    var count = CLOUD_N[l], pts = new Float32Array(count * 4), rs = [];
    for (var k = 0; k < count; k++) {
      var u = rand() * acc, lo = 0, hi = G2;
      while (hi - lo > 1) {
        var mid = lo + hi >> 1;
        if (cdf[mid] < u) lo = mid;
        else hi = mid;
      }
      var rr = rmax * (lo + rand()) / G2, d, yv;
      do {
        d = dir();
        yv = Y(d[0], d[1], d[2]);
      } while (rand() * ymax > yv * yv);
      pts[k * 4] = d[0] * rr;
      pts[k * 4 + 1] = d[1] * rr;
      pts[k * 4 + 2] = d[2] * rr;
      pts[k * 4 + 3] = radial(n, l, rr) * yv >= 0 ? 1 : -1;
      rs.push(rr);
    }
    rs.sort(function(a, b) {
      return a - b;
    });
    return clouds[key] = { pts, r90: rs[Math.floor(rs.length * 0.92)] };
  }
  function cloudChoice(z, sub2) {
    var p = parse2(z), valence = p.subs.length ? p.subs : fullSubs(z);
    var names = valence.map(subName), front = valence[valence.length - 1];
    valence.forEach(function(v) {
      if (v.e < 2 * (2 * v.l + 1) && (front.e >= 2 * (2 * front.l + 1) || v.l > front.l)) front = v;
    });
    var i = names.indexOf(sub2);
    return { valence, sel: i >= 0 ? valence[i] : front };
  }
  function cloudCells(sub2, w, h) {
    var k = 2 * sub2.l + 1, up = Math.min(sub2.e, k), down = Math.max(0, sub2.e - k);
    var rows = k === 1 ? [1] : k === 3 ? [3] : k === 5 ? [3, 2] : [4, 3];
    var labH = 13, cellH = (h - rows.length * labH) / rows.length, cw0 = w / rows[0], cells = [], m = 0;
    rows.forEach(function(cnt, ri) {
      var off = (w - cnt * cw0) / 2;
      for (var c = 0; c < cnt; c++, m++) cells.push({ x: off + c * cw0, y: ri * (cellH + labH), w: cw0, h: cellH, m, occ: (m < up ? 1 : 0) + (m < down ? 1 : 0) });
    });
    return cells;
  }
  function projectCell(sub2, c, a, count, each) {
    var data = samples(sub2.n, sub2.l, c.m), pts = data.pts, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(0.42), sb = Math.sin(0.42);
    var R = Math.min(c.w, c.h) / 2 * 0.92 / data.r90, cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    var n = Math.min(count || Infinity, pts.length / 4);
    for (var i = 0; i < n * 4; i += 4) {
      var x = pts[i], y = pts[i + 1], z = pts[i + 2];
      var x1 = x * ca - y * sa, y1 = x * sa + y * ca, y2 = y1 * cb - z * sb, z2 = y1 * sb + z * cb;
      each(cx + x1 * R, cy - z2 * R, clamp4(y2 / (data.r90 || 1), -1, 1), pts[i + 3]);
    }
  }
  var STILL = [900, 520, 340, 240];
  function cloudsSvg(z, B, th, o, C2, at) {
    var ch = cloudChoice(z, o.sub), s = ch.sel;
    var h = "", x = B.x;
    ch.valence.forEach(function(v) {
      var nm = subName(v), on = nm === subName(s), w = textW(nm, 10, 0.6) + 10;
      h += "<g" + (o.mode !== "static" ? ' data-pt-sub="' + nm + '" style="cursor:pointer"' : "") + '><rect x="' + n18(x) + '" y="' + n18(B.y) + '" width="' + n18(w) + '" height="14" rx="3" fill="' + (on ? th.accent : th.surface) + '" stroke="' + (on ? th.accent : th.line) + '"/>';
      h += text(x + w / 2, B.y + 10.5, nm, ' text-anchor="middle" font-family="' + MONO + '" font-size="10" fill="' + (on ? th.onAccent : th.fg) + '"') + "</g>";
      x += w + 4;
    });
    if (x + 70 < B.x + B.w) h += text(B.x + B.w, B.y + 10.5, "ψ ", ' text-anchor="end" font-family="' + MONO + '" font-size="10" fill="' + th.muted + '"').replace("ψ </text>", 'ψ <tspan fill="' + th.pos + '">+</tspan> <tspan fill="' + th.neg + '">−</tspan></text>');
    var A = { x: B.x, y: B.y + 20, w: B.w, h: B.h - 20 };
    var cells = cloudCells(s, A.w, A.h), k = 2 * s.l + 1, sz = k >= 5 ? 1.1 : 1.3;
    var paths = {};
    cells.forEach(function(c) {
      var base = c.occ ? 1 : 0.16;
      projectCell(s, c, 0.6, STILL[s.l], function(px, py, depth, sign) {
        var bucket = Math.min(3, Math.floor((depth + 1) * 2)), key = (sign > 0 ? "p" : "n") + bucket + (base < 1 ? "e" : "");
        var d = paths[key] || (paths[key] = { d: [], sign, op: base * (0.42 - 0.22 * (bucket / 2 - 0.75)) });
        d.d.push("M" + n18(A.x + px - sz / 2) + " " + n18(A.y + py - sz / 2) + "h" + sz + "v" + sz + "h-" + sz + "z");
      });
    });
    h += "<g data-pt-cloud-static>";
    Object.keys(paths).sort().forEach(function(key) {
      var p = paths[key];
      h += '<path d="' + p.d.join("") + '" fill="' + (p.sign > 0 ? th.pos : th.neg) + '" fill-opacity="' + n18(p.op * 100) / 100 + '"/>';
    });
    h += "</g>";
    h += '<rect data-pt-cloud data-n="' + s.n + '" data-l="' + s.l + '" data-e="' + s.e + '" data-x="' + n18(at.x + A.x) + '" data-y="' + n18(at.y + A.y) + '" data-w="' + n18(A.w) + '" data-h="' + n18(A.h) + '" x="' + n18(A.x) + '" y="' + n18(A.y) + '" width="' + n18(A.w) + '" height="' + n18(A.h) + '" fill="none"/>';
    cells.forEach(function(c) {
      var lab = ANG[s.l][c.m].lab, occ = c.occ === 2 ? " ↑↓" : c.occ === 1 ? " ↑" : "";
      h += '<text x="' + n18(A.x + c.x + c.w / 2) + '" y="' + n18(A.y + c.y + c.h + 10) + '" text-anchor="middle" font-family="' + MONO + '" font-size="10" fill="' + (c.occ ? th.fg : th.muted) + '">' + esc8(lab[0]) + (lab[1] ? '<tspan dy="2.5" font-size="7.5">' + esc8(lab[1]) + '</tspan><tspan dy="-2.5">' + esc8(occ) + "</tspan>" : esc8(occ)) + "</text>";
    });
    return h;
  }
  function legendSvg(L, s, v, th, o, shown) {
    var G2 = L.legend;
    if (!G2) return "";
    var items = legendItems(v.colorBy), h = "";
    if (items) {
      flowLegend(items, G2.w).items.forEach(function(f) {
        var x = G2.x + f.x, y = G2.y + f.row * ROW_H + 12, it = f.it, on = o.key != null && o.key === it.key;
        if (it.key == null) {
          h += text(x, y, it.label, ' font-size="11" fill="' + th.muted + '" font-style="italic"');
          return;
        }
        h += "<g" + (o.mode === "deck" ? ' data-pt-key="' + esc8(it.key) + '" style="cursor:pointer"' : "") + ">";
        h += '<rect x="' + n18(x - 3) + '" y="' + n18(y - 12) + '" width="' + n18(f.w + 6) + '" height="16" fill="' + th.surface + '" fill-opacity="0"' + (on ? ' stroke="' + th.accent + '" rx="4"' : "") + "/>";
        h += '<rect x="' + n18(x) + '" y="' + n18(y - 9) + '" width="10" height="10" rx="2" fill="' + hsl(it.hue, th.strongS, th.strongL) + '"/>';
        h += text(x + 15, y, it.label, ' font-size="11" fill="' + th.fg + '"') + "</g>";
      });
      return h;
    }
    var prop = PROPS[v.colorBy], r = propRange(prop), lo = prop.log ? Math.pow(10, r[0]) : r[0], hi = prop.log ? Math.pow(10, r[1]) : r[1];
    var e = shown ? EL[shown] : null, t = e ? heatT(prop, e[prop.key]) : null;
    var title = prop.label + (prop.unit ? " (" + prop.unit + ")" : "") + (t != null ? " · " + e.sym + " " + fmtVal(prop, e[prop.key]) : "");
    var oneRow = G2.w >= 700, tw = oneRow ? Math.min(300, textW(title, 11.5) + 16) : 0;
    var by = oneRow ? G2.y + 3 : G2.y + ROW_H + 3, bx = G2.x + tw + textW(fmtVal(prop, lo), 11, 0.6) + 8;
    var bw = Math.max(80, Math.min(320, G2.w - (bx - G2.x) - textW(fmtVal(prop, hi), 11, 0.6) - 100));
    h += text(G2.x, G2.y + 12, title, ' font-size="' + n18(fit(textW(title, 11.5), oneRow ? tw - 16 : G2.w, 11.5, 8)) + '" font-weight="600" fill="' + th.fg + '"');
    h += text(bx - 6, by + 10, fmtVal(prop, lo), ' text-anchor="end" font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"');
    for (var i = 0; i < 24; i++) h += '<rect x="' + n18(bx + i * bw / 24) + '" y="' + by + '" width="' + n18(bw / 24 + 0.4) + '" height="12" fill="' + rampAt((i + 0.5) / 24, th.dark).bg + '"/>';
    if (t != null) h += '<rect data-pt-mark x="' + n18(bx + t * bw - 1) + '" y="' + (by - 4) + '" width="2" height="20" rx="1" fill="' + th.fg + '"/>';
    h += text(bx + bw + 6, by + 10, fmtVal(prop, hi), ' font-family="' + MONO + '" font-size="11" fill="' + th.muted + '"');
    var nx = bx + bw + 14 + textW(fmtVal(prop, hi), 11, 0.6);
    h += '<rect x="' + n18(nx) + '" y="' + by + '" width="12" height="12" rx="3" fill="none" stroke="' + th.faint + '" stroke-dasharray="3 2"/>' + text(nx + 17, by + 10, "no data", ' font-size="11" fill="' + th.muted + '"');
    return h;
  }
  function arrowsSvg(L, v, th) {
    if (!v.arrow || !L.bands) return "";
    var t = TRENDS[v.arrow], label = t.label + " increases", fs = 12, tw = textW(label, fs) + 16;
    var a = ' stroke="' + th.accent + '" stroke-width="2" stroke-linecap="round"';
    var head = function(x2, y2, dx, dy) {
      return '<path d="M' + n18(x2) + " " + n18(y2) + "l" + n18(-dx * 10 + dy * 5) + " " + n18(-dy * 10 - dx * 5) + "l" + n18(-dy * 10) + " " + n18(dx * 10) + 'z" fill="' + th.accent + '"/>';
    };
    var y = L.oy - 17, x0 = L.tx0, x1 = L.tx1, mx = (x0 + x1) / 2;
    var h = '<line x1="' + n18(x0) + '" y1="' + n18(y) + '" x2="' + n18(mx - tw / 2) + '" y2="' + n18(y) + '"' + a + '/><line x1="' + n18(mx + tw / 2) + '" y1="' + n18(y) + '" x2="' + n18(x1) + '" y2="' + n18(y) + '"' + a + "/>";
    h += t.right ? head(x1 + 2, y, 1, 0) : head(x0 - 2, y, -1, 0);
    h += text(mx, y + 4.2, label, ' text-anchor="middle" font-size="' + fs + '" font-weight="600" fill="' + th.accent + '"');
    var x = L.ox - 17, y0 = L.ty0, y1 = L.ty1, my = (y0 + y1) / 2, th2 = Math.min(tw, y1 - y0 - 40), vfs = fit(tw - 16, th2 - 16, fs, 7);
    h += '<line x1="' + n18(x) + '" y1="' + n18(y0) + '" x2="' + n18(x) + '" y2="' + n18(my - th2 / 2) + '"' + a + '/><line x1="' + n18(x) + '" y1="' + n18(my + th2 / 2) + '" x2="' + n18(x) + '" y2="' + n18(y1) + '"' + a + "/>";
    h += t.up ? head(x, y0 - 2, 0, -1) : head(x, y1 + 2, 0, 1);
    h += '<text transform="translate(' + n18(x + 4.2) + " " + n18(my) + ') rotate(-90)" text-anchor="middle" font-size="' + n18(vfs) + '" font-weight="600" fill="' + th.accent + '">' + esc8(label) + "</text>";
    return h;
  }
  function render(s, o) {
    o = o || {};
    var v = o.view || viewAt(s, 0), th = THEMES[s.theme], L = layout(s);
    var pinned = o.pinned !== void 0 ? o.pinned : v.pin;
    var shown = o.shown !== void 0 ? o.shown : pinned || s.restingElement;
    var mode = o.mode || "static", ro = { mode, key: o.key == null ? null : o.key, sub: o.sub, pinned, animate: o.animate, tab: shown || L.tiles[0] && L.tiles[0].z };
    var h = "";
    if (L.bands) h += "<g data-pt-arrows>" + arrowsSvg(L, v, th) + "</g>";
    var lab = ' font-family="' + MONO + '" font-size="10" fill="' + th.faint + '" text-anchor="middle"';
    L.glabels.forEach(function(g) {
      h += text(g.x, g.y, g.t, lab);
    });
    L.plabels.forEach(function(g) {
      h += text(g.x, g.y, g.t, lab);
    });
    L.flabels.forEach(function(g) {
      h += text(g.x, g.y, g.t, ' font-size="10.5" fill="' + th.muted + '" text-anchor="end"');
    });
    L.ph.forEach(function(p) {
      var hue = CAT_HUE[p.cat], heat = !!PROPS[v.colorBy];
      h += '<g data-pt-ph="' + p.from + '" transform="translate(' + p.x + " " + p.y + ')"' + (phDimmed(p, v, s, ro.key) ? ' opacity="0.22"' : "") + '><rect width="60" height="60" rx="6" fill="' + (heat ? th.surface : hsl(hue, th.tileS, th.tileL)) + '"' + (heat ? ' fill-opacity="0" stroke="' + th.faint + '" stroke-dasharray="3 2"' : ' stroke="' + th.fg + '" stroke-opacity="' + th.edge + '"') + "/>" + text(30, 34, p.t, ' text-anchor="middle" font-family="' + MONO + '" font-size="11" fill="' + (heat ? th.muted : th.fg) + '"') + "</g>";
    });
    h += "<g data-pt-tiles>";
    L.tiles.forEach(function(t) {
      h += tileSvg(t, s, v, th, ro);
    });
    h += "</g>";
    if (L.tiles.length) h += ringsSvg(L, shown, pinned, th);
    if (L.card) h += '<g data-pt-card transform="translate(' + L.card.x + " " + L.card.y + ')">' + cardSvg(shown, s, v, th, ro, L.card, L.card) + "</g>";
    if (L.legend) h += "<g data-pt-legend>" + legendSvg(L, s, v, th, ro, shown) + "</g>";
    var vb = L.vb, size = o.standalone ? ' width="' + n18(vb.w) + '" height="' + n18(vb.h) + '"' : "";
    return '<svg xmlns="' + NS + '" viewBox="' + n18(vb.x) + " " + n18(vb.y) + " " + n18(vb.w) + " " + n18(vb.h) + '" preserveAspectRatio="xMidYMid meet"' + size + ' role="group" aria-label="Periodic table" font-family="' + esc8(SANS) + '" style="width:100%;height:100%;display:block;overflow:visible">' + h + "</svg>";
  }
  var live = [], escOn = false;
  function attach(root, el, opts) {
    opts = opts || {};
    var s = normalize(el), L = layout(s), th = THEMES[s.theme], mode = opts.mode === "canvas" ? "canvas" : "deck";
    var st = { view: viewAt(s, 0), hover: null, pin: null, sub: null, key: null };
    var raf = 0, canvas = null, gone = false;
    var win = root.ownerDocument.defaultView || window;
    var reduce = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
    function shown() {
      return st.pin != null ? st.pin : st.hover != null ? st.hover : s.restingElement;
    }
    function ro() {
      return { mode, key: st.key, sub: st.sub, pinned: st.pin, animate: opts.animate && !reduce, tab: shown() || L.tiles[0] && L.tiles[0].z };
    }
    function visible() {
      var sec = root.closest("section");
      return !sec || sec.classList.contains("present");
    }
    function draw() {
      var a = root.ownerDocument.activeElement, f = a && root.contains(a) && a.getAttribute ? a.getAttribute("data-pt-z") : null;
      root.innerHTML = render(s, { view: st.view, shown: shown(), pinned: st.pin, sub: st.sub, key: st.key, mode, animate: opts.animate && !reduce });
      if (f) {
        var t = root.querySelector('[data-pt-z="' + f + '"]');
        if (t && t.focus) t.focus();
      }
      startClouds();
    }
    function refresh() {
      var z = shown(), o = ro(), tiles = root.querySelectorAll("[data-pt-z]");
      for (var i = 0; i < tiles.length; i++) {
        var g = tiles[i], tz = +g.getAttribute("data-pt-z");
        if (dimmed(tz, st.view, s, st.key)) g.setAttribute("opacity", "0.22");
        else g.removeAttribute("opacity");
        if (mode === "deck") g.setAttribute("tabindex", tz === o.tab ? "0" : "-1");
      }
      L.ph.forEach(function(p) {
        var g2 = root.querySelector('[data-pt-ph="' + p.from + '"]');
        if (g2 && phDimmed(p, st.view, s, st.key)) g2.setAttribute("opacity", "0.22");
        else if (g2) g2.removeAttribute("opacity");
      });
      var rings = root.querySelector("[data-pt-rings]");
      if (rings) rings.outerHTML = ringsSvg(L, z, st.pin, th);
      var card = root.querySelector("[data-pt-card]");
      if (card) card.innerHTML = cardSvg(z, s, st.view, th, o, L.card, L.card);
      var lg = root.querySelector("[data-pt-legend]");
      if (lg) lg.innerHTML = legendSvg(L, s, st.view, th, o, z);
      startClouds();
    }
    function stopClouds() {
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      if (canvas) {
        canvas.parentNode && canvas.parentNode.removeChild(canvas);
        canvas = null;
      }
    }
    function startClouds() {
      stopClouds();
      var mark = mode === "deck" && opts.animate && root.querySelector("[data-pt-cloud]");
      if (!mark || !win.requestAnimationFrame) return;
      var sub2 = { n: +mark.getAttribute("data-n"), l: +mark.getAttribute("data-l"), e: +mark.getAttribute("data-e") };
      var A = { x: +mark.getAttribute("data-x"), y: +mark.getAttribute("data-y"), w: +mark.getAttribute("data-w"), h: +mark.getAttribute("data-h") };
      var cells = cloudCells(sub2, A.w, A.h), k = 2 * sub2.l + 1, sz = k >= 5 ? 1.1 : 1.3;
      var cv = root.ownerDocument.createElement("canvas");
      cv.setAttribute("aria-hidden", "true");
      cv.style.cssText = "position:absolute;pointer-events:none;";
      if (win.getComputedStyle(root).position === "static") root.style.position = "relative";
      root.appendChild(cv);
      canvas = cv;
      var ctx = cv.getContext && cv.getContext("2d");
      if (!ctx) return stopClouds();
      var still = root.querySelector("[data-pt-cloud-static]");
      if (still) still.setAttribute("visibility", "hidden");
      var t0 = win.performance ? win.performance.now() : Date.now();
      function frame(now) {
        if (!reduce) raf = win.requestAnimationFrame(frame);
        if (!visible() || !root.clientWidth) return;
        var vb = L.vb, cw = root.clientWidth, chh = root.clientHeight, kk = Math.min(cw / vb.w, chh / vb.h);
        var ox = (cw - vb.w * kk) / 2, oy = (chh - vb.h * kk) / 2;
        var zoom = root.getBoundingClientRect().width / cw, dpr = (win.devicePixelRatio || 1) * (zoom || 1);
        var W = Math.round(A.w * kk * dpr), H = Math.round(A.h * kk * dpr);
        cv.style.left = ox + (A.x - vb.x) * kk + "px";
        cv.style.top = oy + (A.y - vb.y) * kk + "px";
        cv.style.width = A.w * kk + "px";
        cv.style.height = A.h * kk + "px";
        if (cv.width !== W) cv.width = W;
        if (cv.height !== H) cv.height = H;
        ctx.setTransform(W / A.w, 0, 0, H / A.h, 0, 0);
        ctx.clearRect(0, 0, A.w, A.h);
        var a = 0.6 + (reduce ? 0 : ((now || t0) - t0) / 1e3 * 0.35);
        cells.forEach(function(c) {
          var base = c.occ ? 1 : 0.16;
          projectCell(sub2, c, a, 0, function(px, py, depth, sign) {
            ctx.globalAlpha = base * (0.42 - 0.22 * depth);
            ctx.fillStyle = sign > 0 ? th.pos : th.neg;
            ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
          });
        });
        ctx.globalAlpha = 1;
      }
      raf = win.requestAnimationFrame(frame);
    }
    function tileOf(t) {
      var g = t && t.closest ? t.closest("[data-pt-z]") : null;
      return g && root.contains(g) ? g : null;
    }
    function onOver(ev) {
      var g = tileOf(ev.target);
      if (!g || st.pin != null) return;
      var z = +g.getAttribute("data-pt-z");
      if (st.hover !== z) {
        st.hover = z;
        st.sub = null;
        refresh();
      }
    }
    function onLeave() {
      if (st.hover != null && st.pin == null) {
        st.hover = null;
        st.sub = null;
        refresh();
      }
    }
    function onClick(ev) {
      var t = ev.target, chip = t && t.closest && t.closest("[data-pt-sub]");
      if (chip) {
        st.sub = chip.getAttribute("data-pt-sub");
        refresh();
        return;
      }
      if (mode !== "deck") return;
      var key = t && t.closest && t.closest("[data-pt-key]");
      if (key) {
        var kk = key.getAttribute("data-pt-key");
        st.key = st.key === kk ? null : kk;
        refresh();
        return;
      }
      var g = tileOf(t);
      if (!g) return;
      var z = +g.getAttribute("data-pt-z");
      st.pin = st.pin === z ? null : z;
      st.hover = st.pin == null ? z : null;
      st.sub = null;
      refresh();
    }
    function onDbl(ev) {
      var g = tileOf(ev.target);
      if (g && opts.onPick) opts.onPick(+g.getAttribute("data-pt-z"));
    }
    function onDown(ev) {
      if (tileOf(ev.target) || ev.target.closest && ev.target.closest("[data-pt-sub],[data-pt-key]")) ev.preventDefault();
    }
    function onFocus(ev) {
      var g = tileOf(ev.target);
      if (!g || st.pin != null) return;
      var z = +g.getAttribute("data-pt-z");
      if (st.hover !== z) {
        st.hover = z;
        st.sub = null;
        refresh();
      }
    }
    function onKey(ev) {
      var g = tileOf(ev.target);
      if (!g) return;
      var z = +g.getAttribute("data-pt-z");
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
        g.blur();
        onLeave();
        return;
      }
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        ev.stopPropagation();
        st.pin = st.pin === z ? null : z;
        st.hover = z;
        st.sub = null;
        refresh();
        return;
      }
      var d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[ev.key];
      if (!d) return;
      ev.preventDefault();
      ev.stopPropagation();
      var cur = tileAt(L, z), best = null, bestScore = Infinity;
      L.tiles.forEach(function(t) {
        var dr = (t.y - cur.y) / 64, dc = (t.x - cur.x) / 64;
        var along = d[0] ? dr * d[0] : dc * d[1], across = d[0] ? Math.abs(dc) : Math.abs(dr);
        if (along <= 0.01) return;
        var score = along + across * 3;
        if (score < bestScore) {
          bestScore = score;
          best = t.z;
        }
      });
      if (best) {
        var n = root.querySelector('[data-pt-z="' + best + '"]');
        if (n && n.focus) n.focus();
      }
    }
    function onOut(ev) {
      if (!ev.relatedTarget || !root.contains(ev.relatedTarget)) onLeave();
    }
    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("click", onClick);
    if (mode === "canvas") root.addEventListener("dblclick", onDbl);
    if (mode === "deck") {
      root.addEventListener("focusin", onFocus);
      root.addEventListener("focusout", onOut);
      root.addEventListener("keydown", onKey);
      root.addEventListener("mousedown", onDown);
      if (!escOn && win.addEventListener) {
        escOn = true;
        win.addEventListener("keydown", function(ev) {
          if (ev.key !== "Escape") return;
          for (var i = 0; i < live.length; i++) {
            if (live[i].pinned() && live[i].visible()) {
              ev.stopPropagation();
              ev.preventDefault();
              live[i].release();
              return;
            }
          }
        }, true);
      }
    }
    var api = {
      // Show diagram step n (0 is as it rests), dropping a pin from before
      setStep: function(n) {
        st.view = viewAt(s, n);
        st.pin = st.view.pin;
        st.hover = null;
        st.sub = null;
        st.key = null;
        draw();
      },
      pinned: function() {
        return st.pin != null;
      },
      // Changed by someone since its step was shown
      touched: function() {
        return st.pin !== st.view.pin || st.hover != null || st.sub != null || st.key != null;
      },
      visible,
      release: function() {
        st.pin = null;
        refresh();
      },
      destroy: function() {
        gone = true;
        stopClouds();
        root.removeEventListener("mouseover", onOver);
        root.removeEventListener("mouseleave", onLeave);
        root.removeEventListener("click", onClick);
        root.removeEventListener("dblclick", onDbl);
        root.removeEventListener("focusin", onFocus);
        root.removeEventListener("focusout", onOut);
        root.removeEventListener("keydown", onKey);
        root.removeEventListener("mousedown", onDown);
        var i = live.indexOf(api);
        if (i >= 0) live.splice(i, 1);
      },
      state: function() {
        return { shown: shown(), pinned: st.pin, hover: st.hover, view: st.view, gone };
      }
    };
    if (mode === "deck") live.push(api);
    return api;
  }
  return {
    EL,
    CATEGORIES,
    STATES,
    PROPS,
    TRENDS,
    COLOR_BY,
    VIEWS,
    SHOWS,
    TILE_LABELS,
    zOf,
    parse: parse2,
    fullSubs,
    shellCounts,
    unpaired,
    pos,
    blockOf,
    groupOf,
    periodOf,
    parseHighlight,
    cleanHighlight,
    highlighted,
    normalize,
    viewAt,
    layout,
    samples,
    cloudCells,
    render,
    attach
  };
}
var PT = periodicRuntime(PERIODIC_ROWS);
function periodicSteps(el) {
  if (el?.type !== "periodic") return [];
  const s = PT.normalize(el);
  return s.steps.map((_, i) => [s.stepStart + i, i + 1]).filter(([n]) => n <= 1e3);
}
function periodicStepMarkers(slide) {
  let html = "";
  for (const el of slide?.elements || []) {
    const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
    for (const [n, s] of periodicSteps(el)) html += `<span class="fragment" data-fragment-index="${n}" data-pt-step="${id}" data-pt-step-at="${s}" aria-hidden="true" style="position:absolute;"></span>`;
  }
  return html;
}
function hasPeriodic(presentation) {
  return (presentation?.slides || []).some((s) => (s.elements || []).some((el) => el.type === "periodic"));
}
var escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function periodicDeckHtml(el) {
  const s = PT.normalize(el);
  const id = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
  return { id, attrs: ` data-pt="${id}" data-pt-config="${escAttr(JSON.stringify(s))}"`, svg: PT.render(s, { mode: "deck" }) };
}
var deckScript2 = null;
function periodicDeckScript() {
  if (!deckScript2) deckScript2 = `
    (function() {
      var PT = (${periodicRuntime.toString()})(${JSON.stringify(PERIODIC_ROWS)});
      var items = [];
      document.querySelectorAll('[data-pt]').forEach(function(el) {
        // Not the overview's pictures of slides
        if (el.closest('[inert]')) return;
        var cfg;
        try { cfg = JSON.parse(el.getAttribute('data-pt-config')); } catch (e) { return; }
        items.push({ el: el, id: el.getAttribute('data-pt'), at: -1, api: PT.attach(el, cfg, { mode: 'deck', animate: true }) });
      });
      function stepOf(item) {
        var slide = item.el.closest('section'), n = 0;
        if (!slide) return 0;
        slide.querySelectorAll('.fragment[data-pt-step]').forEach(function(m) {
          if (m.getAttribute('data-pt-step') === item.id && m.classList.contains('visible')) n = Math.max(n, +m.getAttribute('data-pt-step-at') || 0);
        });
        return n;
      }
      function sync() {
        items.forEach(function(item) {
          var n = stepOf(item);
          if (n !== item.at) { item.api.setStep(n); item.at = n; }
        });
      }
      ['ready', 'fragmentshown', 'fragmenthidden'].forEach(function(name) { Reveal.on(name, sync); });
      // On another slide, what was pinned or pointed at is let go
      Reveal.on('slidechanged', function() {
        items.forEach(function(item) { if (item.api.touched()) item.at = -1; });
        sync();
      });
      sync();
    })();
`;
  return deckScript2;
}

// client/src/utils/text3d.js
var TEXT3D_DEFAULTS = {
  content: "3D Text",
  fontSize: 96,
  fontWeight: "800",
  fontStyle: "normal",
  letterSpacing: 0,
  lineHeight: 1.1,
  textAlign: "center",
  color: "#ffffff",
  sideColor: "#6366f1",
  sideShade: 0.6,
  depth: 0,
  rotateX: 16,
  rotateY: -26,
  perspective: 800
};
var TEXT3D_LIMITS = {
  depth: [0, 150],
  rotateX: [-80, 80],
  rotateY: [-80, 80],
  perspective: [150, 3e3],
  fontSize: [8, 400],
  letterSpacing: [-50, 200],
  lineHeight: [0.5, 4],
  sideShade: [0, 1]
};
var MAX_LAYERS = 60;
var WEIGHTS = /^(normal|bold|[1-9]00)$/;
var STYLES = ["normal", "italic", "oblique"];
var ALIGNS = { left: "flex-start", center: "center", right: "flex-end" };
var HEX3 = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function text3dSettings(el, fallbackFont) {
  const num8 = (key) => {
    const n = Number(el[key]);
    const [lo, hi] = TEXT3D_LIMITS[key];
    return Number.isFinite(n) && el[key] !== null && el[key] !== "" ? Math.min(hi, Math.max(lo, n)) : TEXT3D_DEFAULTS[key];
  };
  const color2 = (key) => HEX3.test(el[key] || "") ? el[key] : TEXT3D_DEFAULTS[key];
  const weight = String(el.fontWeight ?? "");
  return {
    depth: num8("depth"),
    rotateX: num8("rotateX"),
    rotateY: num8("rotateY"),
    perspective: num8("perspective"),
    fontSize: num8("fontSize"),
    letterSpacing: num8("letterSpacing"),
    lineHeight: num8("lineHeight"),
    sideShade: num8("sideShade"),
    color: color2("color"),
    sideColor: color2("sideColor"),
    fontWeight: WEIGHTS.test(weight) ? weight : TEXT3D_DEFAULTS.fontWeight,
    fontStyle: STYLES.includes(el.fontStyle) ? el.fontStyle : "normal",
    textAlign: ALIGNS[el.textAlign] ? el.textAlign : "center",
    fontFamily: String(el.fontFamily || fallbackFont || "sans-serif").replace(/[<>"`;{}\\\r\n]/g, "")
  };
}
var escapeText2 = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function darken(hex, amount) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const k = 1 - Math.min(1, Math.max(0, amount));
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
}
var round2 = (v) => Math.round(v * 100) / 100 || 0;
function text3dLayers(el) {
  const s = text3dSettings(el);
  const n = Math.min(MAX_LAYERS, Math.ceil(s.depth));
  const layers = [];
  for (let i = n; i >= 1; i--) {
    const t = n === 1 ? 0 : (i - 1) / (n - 1);
    layers.push({ z: round2(-(i * s.depth) / n), color: darken(s.sideColor, s.sideShade * t) });
  }
  return layers;
}
function text3dResolution(el) {
  return text3dSettings(el).depth > 0 ? 2 : 4;
}
function text3dHtml(el, { fontFamily, resolution } = {}) {
  const s = text3dSettings(el, fontFamily);
  const k = Math.max(1, Math.round(Number(resolution) || text3dResolution(el)));
  const text = escapeText2(el.content);
  const type = `font-family:${s.fontFamily};font-size:${round2(s.fontSize * k)}px;font-weight:${s.fontWeight};font-style:${s.fontStyle};letter-spacing:${round2(s.letterSpacing * k)}px;line-height:${s.lineHeight};text-align:${s.textAlign};white-space:pre-wrap;`;
  const layers = text3dLayers(el).map((l) => `<div aria-hidden="true" style="position:absolute;inset:0;color:${l.color};transform:translateZ(${round2(l.z * k)}px)">${text}</div>`).join("");
  const down = Math.round(1e6 / k) / 1e6;
  return `<div class="text3d" style="position:relative;width:100%;height:100%;perspective:${s.perspective}px"><div style="position:absolute;left:0;top:0;width:${100 * k}%;height:${100 * k}%;transform-origin:0 0;transform:scale3d(${down},${down},${down});transform-style:preserve-3d;display:flex;align-items:center;justify-content:${ALIGNS[s.textAlign]};${type}"><div style="position:relative;transform-style:preserve-3d;transform:rotateX(${s.rotateX}deg) rotateY(${s.rotateY}deg)">${layers}<div style="position:relative;color:${s.color}">${text}</div></div></div></div>`;
}
function text3dShadowFilter(el) {
  if (!(el.shadowBlur || el.shadowX || el.shadowY)) return "";
  const px = (v) => Number(v) || 0;
  const color2 = String(el.shadowColor || "rgba(0,0,0,0.5)").replace(/[<>"`;{}\\\r\n]/g, "");
  return `drop-shadow(${px(el.shadowX)}px ${px(el.shadowY)}px ${Math.max(0, px(el.shadowBlur))}px ${color2})`;
}

// client/src/utils/annotationOverlay.js
function installAnnotations(config) {
  const NS = "http://www.w3.org/2000/svg";
  const W = config.slideW, H = config.slideH;
  const set = config.set;
  set.slides = set.slides || {};
  set.boards = set.boards || [];
  const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ffffff", "#111827"];
  const SIZES = [3, 6, 12];
  const ERASE_RADIUS = 10;
  let tool = null;
  let color2 = COLORS[0];
  let size = SIZES[0];
  let penSeen = false;
  let active = null;
  let sent = false;
  const undoStacks = {};
  const keyOf = (section) => section && (section.getAttribute("data-slide-id") || section.getAttribute("data-board-id"));
  const boardOf = (section) => section && set.boards.find((b) => b.id === section.getAttribute("data-board-id"));
  function pathsOf(section) {
    const board = boardOf(section);
    if (board) return board.paths;
    const key = keyOf(section);
    if (!set.slides[key]) set.slides[key] = { paths: [] };
    return set.slides[key].paths;
  }
  const currentPage = () => {
    const s = window.Reveal && Reveal.getCurrentSlide();
    return keyOf(s) ? s : null;
  };
  const scrollerOf = (section) => section && section.querySelector(":scope > .slide-scroller");
  const surfaceOf = (section) => scrollerOf(section)?.querySelector(":scope > .slide-scroll-inner") || section;
  const widthOf = (section) => Number(section.getAttribute("data-scroll-width")) || W;
  const heightOf = (section) => Number(section.getAttribute("data-scroll-height")) || H;
  const sideways = (scroller) => scroller.getAttribute("data-scroll") === "x";
  function layerOf(section) {
    const surface = surfaceOf(section);
    let svg = surface.querySelector(":scope > svg.pp-ink");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "pp-ink");
      svg.setAttribute("viewBox", `0 0 ${widthOf(section)} ${heightOf(section)}`);
      surface.appendChild(svg);
    }
    return svg;
  }
  function pathD(points) {
    if (points.length === 1) return `M${points[0][0]} ${points[0][1]}l0.01 0`;
    let d = `M${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i], [nx, ny] = points[i + 1];
      d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
    }
    const last = points[points.length - 1];
    return d + `L${last[0]} ${last[1]}`;
  }
  function pathElement(p) {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", pathD(p.points));
    el.setAttribute("stroke", p.color);
    el.setAttribute("stroke-width", p.strokeWidth);
    el.setAttribute("stroke-opacity", p.opacity ?? 1);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    return el;
  }
  function render(section) {
    const layer = layerOf(section);
    layer.querySelectorAll("path:not(.pp-laser)").forEach((el) => el.remove());
    for (const p of pathsOf(section)) layer.appendChild(pathElement(p));
  }
  function toSlide(e, section) {
    const r = surfaceOf(section).getBoundingClientRect();
    const round3 = (v) => Math.round(v * 10) / 10;
    return [round3((e.clientX - r.left) * widthOf(section) / r.width), round3((e.clientY - r.top) * heightOf(section) / r.height)];
  }
  function simplify(points, tolerance) {
    if (points.length < 3) return points;
    const [ax, ay] = points[0], [bx, by] = points[points.length - 1];
    let far = 0, index = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i];
      const len2 = Math.hypot(bx - ax, by - ay) || 1;
      const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len2;
      if (d > far) {
        far = d;
        index = i;
      }
    }
    if (far <= tolerance) return [points[0], points[points.length - 1]];
    return simplify(points.slice(0, index + 1), tolerance).slice(0, -1).concat(simplify(points.slice(index), tolerance));
  }
  function segmentDistance([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function eraseAt(section, pt) {
    const paths = pathsOf(section);
    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i], reach = ERASE_RADIUS + p.strokeWidth / 2;
      const pts = p.points;
      const hit = pts.length === 1 ? Math.hypot(pt[0] - pts[0][0], pt[1] - pts[0][1]) <= reach : pts.some((q, j) => j > 0 && segmentDistance(pt, pts[j - 1], q) <= reach);
      if (hit) {
        paths.splice(i, 1);
        pushUndo(section, { type: "remove", path: p, index: i });
        render(section);
        scheduleSave();
      }
    }
  }
  function pushUndo(section, action) {
    const key = keyOf(section);
    (undoStacks[key] = undoStacks[key] || []).push(action);
  }
  function undo() {
    const section = currentPage();
    const stack = section && undoStacks[keyOf(section)];
    const action = stack && stack.pop();
    if (!action) return;
    const paths = pathsOf(section);
    if (action.type === "add") {
      const i = paths.lastIndexOf(action.path);
      if (i !== -1) paths.splice(i, 1);
    }
    if (action.type === "remove") paths.splice(action.index, 0, action.path);
    if (action.type === "clear") paths.push(...action.paths);
    render(section);
    scheduleSave();
  }
  function clearPage() {
    const section = currentPage();
    const paths = section && pathsOf(section);
    if (!paths || !paths.length || !confirm("Clear the ink on this slide?")) return;
    pushUndo(section, { type: "clear", paths: paths.splice(0) });
    render(section);
    scheduleSave();
  }
  function boardSection(board) {
    const s = document.createElement("section");
    s.setAttribute("data-board-id", board.id);
    s.className = "pp-board";
    s.style.cssText = `padding:0;width:${W}px;height:${H}px`;
    return s;
  }
  function findPage(key) {
    return [...document.querySelectorAll(".reveal .slides section")].find((s) => keyOf(s) === key) || null;
  }
  function addBoard() {
    const anchor = currentPage();
    if (!anchor) return;
    const id = "board-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    const board = { id, afterId: keyOf(anchor), paths: [] };
    set.boards.push(board);
    const section = boardSection(board);
    anchor.after(section);
    Reveal.sync();
    const { h, v } = Reveal.getIndices(section);
    Reveal.slide(h, v);
    scheduleSave();
  }
  function deleteBoard() {
    const section = currentPage();
    const board = boardOf(section);
    if (!board || board.paths.length && !confirm("Delete this board and its ink?")) return;
    set.boards = set.boards.filter((b) => b !== board);
    for (const b of set.boards) if (b.afterId === board.id) b.afterId = board.afterId;
    Reveal.prev();
    section.remove();
    Reveal.sync();
    scheduleSave();
  }
  function restoreBoards() {
    for (const board of set.boards) {
      const anchor = findPage(board.afterId);
      const section = boardSection(board);
      if (anchor) anchor.after(section);
      else document.querySelector(".reveal .slides").appendChild(section);
    }
    if (set.boards.length) Reveal.sync();
  }
  const hasInk = () => Object.values(set.slides).some((s) => s.paths.length) || set.boards.length > 0;
  function scheduleSave() {
    status("Saving…");
    flush();
  }
  function flush() {
    if (!hasInk() && !sent) return status("");
    set.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const slides = Object.fromEntries(Object.entries(set.slides).filter(([, s]) => s.paths.length));
    window.parent.postMessage({ type: config.message, set: { ...set, slides } }, config.origin);
    sent = true;
  }
  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || e.data?.type !== `${config.message}:status`) return;
    status(e.data.saved ? "Saved" : "Kept on this device. It saves when you next open the presentation.");
  });
  const shield = document.createElement("div");
  shield.className = "pp-shield";
  document.querySelector(".reveal").appendChild(shield);
  const draws = (e) => e.pointerType !== "touch" || !penSeen;
  shield.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    const section = currentPage();
    if (!tool || !section || !draws(e) || e.button > 0 || Reveal.isOverview()) return;
    e.preventDefault();
    try {
      shield.setPointerCapture(e.pointerId);
    } catch {
    }
    const pt = toSlide(e, section);
    if (tool === "eraser") {
      active = { id: e.pointerId, section, erase: true };
      return eraseAt(section, pt);
    }
    const highlighter = tool === "highlighter", laser = tool === "laser";
    const path = {
      points: [pt],
      color: laser ? "#ff3b3b" : color2,
      strokeWidth: laser ? 4 : highlighter ? size * 4 : size,
      opacity: highlighter ? 0.35 : 1
    };
    const el = pathElement(path);
    if (laser) el.setAttribute("class", "pp-laser");
    layerOf(section).appendChild(el);
    active = { id: e.pointerId, section, path, el, laser };
  });
  shield.addEventListener("pointermove", (e) => {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const pt = toSlide(ev, active.section);
      if (active.erase) {
        eraseAt(active.section, pt);
        continue;
      }
      const last = active.path.points[active.path.points.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 0.8) active.path.points.push(pt);
    }
    if (!active.erase) active.el.setAttribute("d", pathD(active.path.points));
  });
  function endStroke(e) {
    if (!active || e.pointerId !== active.id) return;
    const { section, path, el, laser, erase } = active;
    active = null;
    if (erase) return;
    if (laser) {
      el.style.transition = "opacity 0.8s";
      setTimeout(() => {
        el.style.opacity = "0";
      }, 400);
      setTimeout(() => el.remove(), 1300);
      return;
    }
    path.points = simplify(path.points, 0.6);
    pathsOf(section).push(path);
    pushUndo(section, { type: "add", path });
    el.setAttribute("d", pathD(path.points));
    scheduleSave();
  }
  shield.addEventListener("pointerup", endStroke);
  shield.addEventListener("pointercancel", endStroke);
  for (const type of ["touchstart", "touchmove"]) {
    shield.addEventListener(type, (e) => {
      const stylus = [...e.changedTouches].some((t) => t.touchType === "stylus");
      if (tool && (stylus || !penSeen)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });
  }
  shield.addEventListener("wheel", (e) => {
    const scroller = scrollerOf(currentPage());
    if (!scroller) return;
    e.preventDefault();
    if (sideways(scroller)) scroller.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    else scroller.scrollTop += e.deltaY;
  }, { passive: false });
  let drag = null;
  shield.addEventListener("touchstart", (e) => {
    const scroller = scrollerOf(currentPage());
    const t = e.touches[0];
    drag = tool && penSeen && scroller && e.touches.length === 1 && t.touchType !== "stylus" ? { scroller, x: t.clientX, y: t.clientY, along: null } : null;
  }, { passive: true });
  shield.addEventListener("touchmove", (e) => {
    if (!drag) return;
    const t = e.touches[0], x = sideways(drag.scroller);
    if (drag.along === null) {
      const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
      if (Math.hypot(dx, dy) < 8) return;
      drag.along = x ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx);
    }
    if (!drag.along) return;
    e.stopPropagation();
    const rect = drag.scroller.getBoundingClientRect();
    if (x) drag.scroller.scrollLeft -= (t.clientX - drag.x) * drag.scroller.clientWidth / (rect.width || 1);
    else drag.scroller.scrollTop -= (t.clientY - drag.y) * drag.scroller.clientHeight / (rect.height || 1);
    drag.x = t.clientX;
    drag.y = t.clientY;
  }, { passive: true });
  shield.addEventListener("touchend", () => {
    drag = null;
  });
  const style = document.createElement("style");
  style.textContent = `
    svg.pp-ink { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; overflow:visible; z-index:2000; }
    svg.pp-ink .pp-laser { filter: drop-shadow(0 0 3px #ff3b3b); }
    .pp-shield { position:absolute; inset:0; z-index:2500; display:none; touch-action:none; }
    .pp-on .pp-shield { display:block; cursor:crosshair; }
    .pp-bar { position:fixed; left:12px; bottom:12px; z-index:3000; display:flex; align-items:center; gap:4px; flex-wrap:wrap; max-width:calc(100vw - 24px);
      padding:5px; border-radius:22px; background:rgba(20,20,30,0.82); color:#fff; font:13px/1 -apple-system,system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,0.35); }
    .pp-bar button { all:unset; box-sizing:border-box; min-width:34px; height:34px; padding:0 8px; border-radius:17px; display:inline-flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; }
    .pp-bar button:hover { background:rgba(255,255,255,0.14); }
    .pp-bar button[aria-pressed="true"] { background:rgba(255,255,255,0.26); }
    .pp-bar button:focus-visible { outline:2px solid #818cf8; }
    .pp-bar .pp-sep { width:1px; height:22px; background:rgba(255,255,255,0.2); margin:0 2px; }
    .pp-bar .pp-swatch { width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,255,255,0.5); }
    .pp-bar .pp-dot { border-radius:50%; background:#fff; }
    .pp-bar .pp-status { font-size:11px; opacity:0.75; padding:0 6px; max-width:240px; }
    .pp-bar:not(.pp-open) > :not(.pp-toggle) { display:none; }
    .pp-bar:not(.pp-open) { opacity:0.55; }
    .pp-bar:not(.pp-open):hover { opacity:1; }
    .pp-bar .pp-board-only { display:none; }
    .pp-on-board .pp-bar.pp-open .pp-board-only { display:inline-flex; }
  `;
  document.head.appendChild(style);
  const bar = document.createElement("div");
  bar.className = "pp-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Annotate");
  const button = (label, content, onClick, extra = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    if (extra) b.className = extra;
    b.innerHTML = content;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(b);
    });
    return b;
  };
  const sep = () => Object.assign(document.createElement("span"), { className: "pp-sep" });
  const toolButtons = {};
  const swatchButtons = [], sizeButtons = [];
  const toggle = button("Annotate (D)", "&#9998;", () => setTool(tool ? null : "pen"), "pp-toggle");
  bar.append(toggle);
  for (const [name, label, icon] of [["pen", "Pen", "&#9998;"], ["highlighter", "Highlighter", "&#9646;"], ["eraser", "Eraser (E)", "&#9003;"], ["laser", "Laser pointer", "&#9673;"]]) {
    toolButtons[name] = button(label, icon, () => setTool(name));
    bar.append(toolButtons[name]);
  }
  bar.append(sep());
  for (const c of COLORS) {
    const b = button(`Color ${c}`, `<span class="pp-swatch" style="background:${c}"></span>`, () => {
      color2 = c;
      if (tool !== "highlighter") setTool("pen");
      refresh();
    });
    b.dataset.color = c;
    swatchButtons.push(b);
    bar.append(b);
  }
  bar.append(sep());
  for (const s of SIZES) {
    const b = button(`Width ${s}`, `<span class="pp-dot" style="width:${s + 3}px;height:${s + 3}px"></span>`, () => {
      size = s;
      refresh();
    });
    b.dataset.size = s;
    sizeButtons.push(b);
    bar.append(b);
  }
  bar.append(sep());
  bar.append(button("Undo (Ctrl+Z)", "&#8630;", undo));
  bar.append(button("Clear slide", "&#128465;", clearPage));
  bar.append(sep());
  bar.append(button("New board after this slide", "&#65291; Board", addBoard));
  bar.append(button("Delete this board", "&#10005; Board", deleteBoard, "pp-board-only"));
  const statusEl = Object.assign(document.createElement("span"), { className: "pp-status" });
  statusEl.setAttribute("aria-live", "polite");
  bar.append(statusEl);
  bar.append(button("Stop annotating (Esc)", "Done", () => setTool(null)));
  for (const type of ["pointerdown", "touchstart", "mousedown"]) bar.addEventListener(type, (e) => e.stopPropagation());
  document.body.appendChild(bar);
  function status(text) {
    statusEl.textContent = text;
  }
  function refresh() {
    document.documentElement.classList.toggle("pp-on", !!tool);
    document.documentElement.classList.toggle("pp-on-board", !!boardOf(currentPage()));
    bar.classList.toggle("pp-open", !!tool);
    for (const [name, b] of Object.entries(toolButtons)) b.setAttribute("aria-pressed", String(tool === name));
    for (const b of swatchButtons) b.setAttribute("aria-pressed", String(b.dataset.color === color2));
    for (const b of sizeButtons) b.setAttribute("aria-pressed", String(Number(b.dataset.size) === size));
    shield.style.cursor = tool === "eraser" ? "cell" : "crosshair";
  }
  function setTool(name) {
    tool = name;
    refresh();
  }
  Reveal.on("slidechanged", refresh);
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    const key = e.key.toLowerCase();
    let handled = true;
    if (key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) setTool(tool ? null : "pen");
    else if (tool && key === "e" && !e.ctrlKey && !e.metaKey) setTool("eraser");
    else if (tool && key === "escape") setTool(null);
    else if (key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) undo();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  restoreBoards();
  document.querySelectorAll(".reveal .slides section[data-slide-id], .reveal .slides section[data-board-id]").forEach((s) => {
    const board = boardOf(s);
    if ((board ? board.paths : set.slides[keyOf(s)]?.paths || []).length) render(s);
  });
  refresh();
  return { flush, setTool, get set() {
    return set;
  } };
}

// client/src/utils/scrollingSlides.js
var MAX_SCREENS = 8;
function getCanvasHeight(slide, slideH) {
  const h = Math.round(Number(slide?.scrollHeight) || 0);
  return h > slideH ? Math.min(h, slideH * MAX_SCREENS) : slideH;
}
function getCanvasWidth(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return slideW;
  const w = Math.round(Number(slide?.scrollWidth) || 0);
  return w > slideW ? Math.min(w, slideW * MAX_SCREENS) : slideW;
}
function scrollAxis(slide, slideW, slideH) {
  if (getCanvasHeight(slide, slideH) > slideH) return "y";
  if (getCanvasWidth(slide, slideW, slideH) > slideW) return "x";
  return null;
}
var isScrolling = (slide, slideW, slideH) => scrollAxis(slide, slideW, slideH) !== null;
var isPinned = (el) => el?.scrollBehavior === "pin";
function hasScrollingSlides(presentation) {
  const slideW = Number(presentation?.slideWidth) || 960;
  const slideH = Number(presentation?.slideHeight) || 540;
  return (presentation?.slides || []).some((slide) => isScrolling(slide, slideW, slideH));
}
function canvasBackgroundStyle(bg, url = (src) => src) {
  const value = (v) => String(v).replace(/[\\;{}<>"'`\r\n]/g, "").replace(/&/g, "&amp;");
  if (bg?.type === "gradient" && bg.gradient) return `background:${value(bg.gradient)};`;
  if (bg?.type === "image" && bg.image && !/^\s*(javascript|data|vbscript):/i.test(bg.image)) {
    return `background-image:url('${value(url(bg.image))}');background-size:${value(bg.size || "cover")};background-position:${value(bg.position || "center")};`;
  }
  return "";
}
function scrollingSlideBody({ slideW, slideH, canvasW = slideW, canvasH = slideH, axis = "y", elementsHtml, pinnedHtml, background = "" }) {
  const x = axis === "x";
  const mark = x ? ' data-scroll="x"' : "";
  return `      <div class="slide-scroller"${mark} data-prevent-swipe style="position:absolute;left:0;top:0;width:${slideW}px;height:${slideH}px;${x ? "overflow-x:auto;overflow-y:hidden;" : "overflow-x:hidden;overflow-y:auto;"}">
        <div class="slide-scroll-inner" style="position:relative;width:${canvasW}px;height:${canvasH}px;${background}">
${elementsHtml}
        </div>
      </div>
      <div class="slide-scroll-track"${mark} aria-hidden="true"><div class="slide-scroll-thumb"></div></div>${pinnedHtml ? `
${pinnedHtml}` : ""}`;
}
var SCROLLING_CSS = `
    .reveal .slides section > .slide-scroller { overflow-x:hidden !important; overflow-y:auto !important; overscroll-behavior:contain; touch-action:pan-y pinch-zoom; scrollbar-width:none; }
    .reveal .slides section > .slide-scroller[data-scroll="x"] { overflow-x:auto !important; overflow-y:hidden !important; touch-action:pan-x pinch-zoom; }
    .reveal .slides section > .slide-scroller::-webkit-scrollbar { display:none; }
    .reveal .slides section .slide-scroll-inner { overflow:visible; }
    .reveal .slides section > .slide-scroll-track { position:absolute; top:0; right:0; width:4px; height:100%; z-index:940; background:rgba(127,127,127,0.12); pointer-events:none; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] { top:auto; bottom:0; left:0; right:auto; width:100%; height:4px; }
    .reveal .slides section .slide-scroll-thumb { position:absolute; left:0; top:0; width:100%; height:0; background:rgba(160,160,160,0.55); border-radius:2px; }
    .reveal .slides section > .slide-scroll-track[data-scroll="x"] > .slide-scroll-thumb { width:0; height:100%; }`;
var SCROLL_STEP_SOURCE = `
      var SCROLL_STEP = 0.85;
      function scrollStep(dir, view, step) {
        var end = view.start + view.size;
        if (dir > 0) {
          if (step && (step.pinned || step.start < end)) return 'reveal';
          if (view.start < view.max - 1) return Math.min(view.max, view.start + view.size * SCROLL_STEP);
          return 'reveal';
        }
        if (step && (step.pinned || (step.start < end && step.end > view.start))) return 'reveal';
        if (view.start > 1) return Math.max(0, view.start - view.size * SCROLL_STEP);
        return step ? 'skip' : 'reveal';
      }`;
var SCROLLING_SCRIPT = `
    // ── Scrolling slides ─────────────────────────────────────────────────
    (function() {${SCROLL_STEP_SOURCE}
      var reduceMotion = false;
      try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

      function scrollerOf(slide) { return slide ? slide.querySelector(':scope > .slide-scroller') : null; }
      function sideways(sc) { return sc.getAttribute('data-scroll') === 'x'; }
      // How far along the scroller is, how much it shows, and how far it can go
      function posOf(sc) { return sideways(sc) ? sc.scrollLeft : sc.scrollTop; }
      function sizeOf(sc) { return sideways(sc) ? sc.clientWidth : sc.clientHeight; }
      function maxOf(sc) { return sideways(sc) ? sc.scrollWidth - sc.clientWidth : sc.scrollHeight - sc.clientHeight; }
      function canScroll(sc) { return !!sc && maxOf(sc) > 1; }

      // Where the canvas is, or is on its way to while a step's smooth scroll runs
      function viewOf(sc) {
        var start = sc._to != null && Date.now() - sc._toAt < 800 ? sc._to : posOf(sc);
        return { start: start, size: sizeOf(sc), max: maxOf(sc) };
      }
      function scrollToPos(sc, pos) {
        pos = Math.max(0, Math.min(maxOf(sc), pos));
        sc._to = pos;
        sc._toAt = Date.now();
        var to = { behavior: reduceMotion ? 'auto' : 'smooth' };
        to[sideways(sc) ? 'left' : 'top'] = pos;
        sc.scrollTo(to);
      }

      // The fragment step a key would show (the lowest index still hidden) or
      // hide (the highest shown)
      function fragmentStep(slide, shown) {
        var frags = slide.querySelectorAll('.fragment'), best = null, els = [];
        for (var i = 0; i < frags.length; i++) {
          if (frags[i].classList.contains('visible') !== shown) continue;
          var index = parseInt(frags[i].getAttribute('data-fragment-index'), 10) || 0;
          if (best === null || (shown ? index > best : index < best)) { best = index; els = [frags[i]]; }
          else if (index === best) els.push(frags[i]);
        }
        return els;
      }
      // Where elements are along the canvas, or pinned: true if any is on the screen
      function extentOf(els, sc) {
        var inner = sc.firstElementChild, x = sideways(sc), start = Infinity, end = -Infinity;
        for (var i = 0; i < els.length; i++) {
          var at = 0, node = els[i];
          while (node && node !== inner) { at += x ? node.offsetLeft : node.offsetTop; node = node.offsetParent; }
          if (node !== inner) return { pinned: true };
          start = Math.min(start, at);
          end = Math.max(end, at + (x ? els[i].offsetWidth : els[i].offsetHeight));
        }
        return els.length ? { start: start, end: end } : null;
      }

      // Forwards (1), back (-1), or neither (0) for a slide that scrolls
      // sideways (x) or down
      function keyDirection(e, x) {
        if (e.altKey || e.ctrlKey || e.metaKey) return 0;
        if (e.keyCode === 32) return e.shiftKey ? -1 : 1;
        if (e.shiftKey) return 0;
        if ([x ? 39 : 40, x ? 76 : 74, 34, 78].indexOf(e.keyCode) !== -1) return 1;
        if ([x ? 37 : 38, x ? 72 : 75, 33, 80].indexOf(e.keyCode) !== -1) return -1;
        return 0;
      }
      // Before reveal.js's own handler, which listens on the document too
      document.addEventListener('keydown', function(e) {
        var slide = Reveal.getCurrentSlide(), sc = scrollerOf(slide);
        if (!canScroll(sc)) return;
        var dir = keyDirection(e, sideways(sc));
        if (!dir) return;
        var active = document.activeElement;
        if (active && (active.isContentEditable || /^(input|textarea|select)$/i.test(active.tagName))) return;
        if (Reveal.getConfig().keyboard === false || Reveal.isOverview() || Reveal.isPaused()) return;
        var to = scrollStep(dir, viewOf(sc), extentOf(fragmentStep(slide, dir < 0), sc));
        if (to === 'reveal') return;
        e.preventDefault();
        e.stopPropagation();
        if (to === 'skip') Reveal.prev({ skipFragments: true });
        else scrollToPos(sc, to);
      }, true);

      // A fragment that appears off screen is scrolled into view
      Reveal.on('fragmentshown', function(e) {
        var sc = scrollerOf(Reveal.getCurrentSlide());
        if (!canScroll(sc)) return;
        var extent = extentOf(e.fragments || [e.fragment], sc);
        if (!extent || extent.pinned) return;
        var view = viewOf(sc), margin = 24;
        if (extent.start < view.start) scrollToPos(sc, extent.start - margin);
        else if (extent.end > view.start + view.size) scrollToPos(sc, Math.min(extent.start - margin, extent.end + margin - view.size));
      });

      function syncTrack(sc) {
        var thumb = sc.parentNode.querySelector(':scope > .slide-scroll-track > .slide-scroll-thumb');
        if (!thumb) return;
        var x = sideways(sc), size = sizeOf(sc), max = maxOf(sc), length = Math.max(24, size * size / (size + max));
        thumb.style[x ? 'width' : 'height'] = length + 'px';
        thumb.style[x ? 'left' : 'top'] = (max > 0 ? posOf(sc) / max * (size - length) : 0) + 'px';
      }
      var scrollers = document.querySelectorAll('.reveal .slides section > .slide-scroller');
      for (var i = 0; i < scrollers.length; i++) (function(sc) {
        sc.addEventListener('scroll', function() { syncTrack(sc); }, { passive: true });
        // Scrolled by hand, the canvas is no longer on its way to a step's position
        var byHand = function() { sc._to = null; };
        sc.addEventListener('wheel', byHand, { passive: true });
        sc.addEventListener('touchstart', byHand, { passive: true });
        // An up-and-down wheel turns a sideways canvas, until it reaches an end
        if (sideways(sc)) sc.addEventListener('wheel', function(e) {
          if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          var by = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? sc.clientWidth : 1);
          if (by > 0 ? sc.scrollLeft >= maxOf(sc) - 1 : sc.scrollLeft <= 0) return;
          e.preventDefault();
          sc.scrollLeft += by;
        }, { passive: false });
      })(scrollers[i]);

      var lastIndex = -1;
      function land(e) {
        var index = Reveal.getSlides().indexOf(e.currentSlide), sc = scrollerOf(e.currentSlide);
        if (sc) {
          sc._to = null;
          var atEnd = index === lastIndex - 1;
          if (sideways(sc)) sc.scrollLeft = atEnd ? sc.scrollWidth : 0;
          else sc.scrollTop = atEnd ? sc.scrollHeight : 0;
          syncTrack(sc);
        }
        lastIndex = index;
      }
      Reveal.on('ready', land);
      Reveal.on('slidechanged', land);

      // The scroller keeps touches from reveal.js, so a sideways swipe on it
      // changes slides here, the way reveal.js's own swipes do. On a slide that
      // scrolls sideways the swipe scrolls the canvas, so it changes slides only
      // when it starts at the end it moves towards.
      var swipe = null;
      document.addEventListener('touchstart', function(e) {
        var sc = e.touches.length === 1 && e.target.closest && e.target.closest('.slide-scroller');
        swipe = sc ? { x: e.touches[0].clientX, y: e.touches[0].clientY, sc: sc, pos: sc.scrollLeft } : null;
      }, { passive: true });
      document.addEventListener('touchend', function(e) {
        if (!swipe) return;
        var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y, sc = swipe.sc, pos = swipe.pos;
        swipe = null;
        var config = Reveal.getConfig();
        if (config.touch === false || Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 2) return;
        if (sideways(sc) && (dx < 0 ? pos < maxOf(sc) - 1 : pos > 1)) return;
        if (config.navigationMode === 'linear') { if ((dx > 0) !== !!config.rtl) Reveal.prev(); else Reveal.next(); }
        else if (dx > 0) Reveal.left();
        else Reveal.right();
      }, { passive: true });
    })();`;

// client/src/utils/annotations.js
var ANNOTATION_MESSAGE = "parallax-annotations";

// client/src/utils/clickActions.js
var HOVER_EFFECTS = ["brighten", "lift", "grow", "none"];
var VISIBILITY_KEYS = ["show", "hide", "toggle"];
var HOVER_KEYS = ["show", "hide"];
var MAX_STATES = 8;
var STATE_EASINGS = {
  ease: "ease",
  "ease-in-out": "ease-in-out",
  "ease-out": "ease-out",
  "ease-in": "ease-in",
  linear: "linear",
  spring: "cubic-bezier(0.34,1.56,0.64,1)"
};
var DEFAULT_STATE_DURATION = 400;
var SET_MODES = ["set", "toggle", "cycle"];
var SAFE_ID = /^[A-Za-z0-9_-]+$/;
var COLOR5 = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-z]{3,20})$/i;
var clamp3 = (v, min, max) => typeof v === "number" && Number.isFinite(v) ? +Math.min(max, Math.max(min, v)).toFixed(2) : null;
var color = (v) => typeof v === "string" && COLOR5.test(v.trim()) ? v.trim() : null;
var flip = (v) => v === true || v === 180 ? 180 : v === -180 ? -180 : 0;
function elementStates(el) {
  if (typeof el?.id !== "string" || !SAFE_ID.test(el.id) || !Array.isArray(el.states)) return [];
  return el.states.filter((st) => typeof st?.id === "string" && SAFE_ID.test(st.id)).slice(0, MAX_STATES);
}
function stateValues(st) {
  return {
    x: clamp3(st.x, -1e4, 1e4),
    y: clamp3(st.y, -1e4, 1e4),
    width: clamp3(st.width, 1, 1e4),
    height: clamp3(st.height, 1, 1e4),
    rotation: clamp3(st.rotation, -3600, 3600),
    scale: clamp3(st.scale, 0.05, 20),
    flipX: flip(st.flipX),
    flipY: flip(st.flipY),
    opacity: clamp3(st.opacity, 0, 1),
    zIndex: st.zIndex == null ? null : Math.round(clamp3(st.zIndex, -1e3, 1e5) ?? 0),
    fill: color(st.fill),
    stroke: color(st.stroke),
    textColor: color(st.textColor),
    filterBrightness: clamp3(st.filterBrightness, 0, 400),
    filterContrast: clamp3(st.filterContrast, 0, 400),
    filterGrayscale: clamp3(st.filterGrayscale, 0, 100),
    shape: CLOSED_SHAPES.includes(st.shape) ? st.shape : null,
    borderRadius: clamp3(st.borderRadius, 0, 1e4),
    duration: Math.round(clamp3(st.duration, 0, 1e4) ?? DEFAULT_STATE_DURATION),
    easing: STATE_EASINGS[st.easing] || "ease"
  };
}
function setList(action, modes = SET_MODES) {
  return (Array.isArray(action?.set) ? action.set : []).filter((s) => typeof s?.id === "string" && SAFE_ID.test(s.id) && (!s.state || typeof s.state === "string" && SAFE_ID.test(s.state)) && modes.includes(s.mode || "set"));
}
var NO_CLICK_ACTION = /* @__PURE__ */ new Set(["html", "p5", "model", "molecule", "periodic", "graph", "video", "audio", "drawing"]);
function supportsClickAction(el) {
  return !!el?.type && !NO_CLICK_ACTION.has(el.type) && !el.type.startsWith("plugin:");
}
var slideAnchor = (id) => `s-${id}`;
function safeActionUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  return /^(https?:\/\/[^\s]|mailto:[^\s])/i.test(trimmed) ? trimmed : "";
}
var escapeAttr2 = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var idList = (list) => (Array.isArray(list) ? list : []).filter((id) => typeof id === "string" && id && !/\s/.test(id));
function visibilityTargets(slide) {
  const targets = /* @__PURE__ */ new Set();
  for (const el of slide?.elements || []) {
    if (el.clickAction?.type === "visibility") {
      for (const key of VISIBILITY_KEYS) idList(el.clickAction[key]).forEach((id) => targets.add(id));
      setList(el.clickAction).forEach((s) => targets.add(s.id));
    }
    if (el.hoverAction?.type === "visibility") {
      for (const key of HOVER_KEYS) idList(el.hoverAction[key]).forEach((id) => targets.add(id));
      setList(el.hoverAction, ["set"]).forEach((s) => targets.add(s.id));
    }
  }
  return targets;
}
function clickActionAttrs(el, targets = /* @__PURE__ */ new Set()) {
  const click = actionAttrs(el);
  return click + hoverAttrs(el, !click) + visibilityAttrs(el, targets);
}
function actionAttrs(el) {
  const action = el?.clickAction;
  if (!action || !supportsClickAction(el)) return "";
  let target = "";
  if (action.type === "slide") {
    if (!action.slideId) return "";
    target = ` data-action-slide="${escapeAttr2(slideAnchor(action.slideId))}"`;
  } else if (action.type === "url") {
    const url = safeActionUrl(action.url);
    if (!url) return "";
    target = ` data-action-url="${escapeAttr2(url)}"${action.newTab === false ? "" : " data-action-new-tab"}`;
  } else if (action.type === "visibility") {
    const set = setList(action);
    target = VISIBILITY_KEYS.map((key) => [key, idList(action[key])]).filter(([, ids]) => ids.length).map(([key, ids]) => ` data-action-${key}="${escapeAttr2(ids.join(" "))}"`).join("") + (set.length ? ` data-action-set="${set.map((s) => `${s.id}:${s.state || ""}:${s.mode || "set"}`).join(" ")}"` : "");
    if (!target) return "";
  } else if (action.type !== "next" && action.type !== "prev") {
    return "";
  }
  const hover = HOVER_EFFECTS.includes(el.hoverEffect) && el.hoverEffect !== "brighten" ? ` data-hover="${el.hoverEffect}"` : "";
  return ` data-action="${action.type}"${target}${hover} role="${action.type === "url" ? "link" : "button"}" tabindex="0"`;
}
function hoverAttrs(el, focusable) {
  const action = el?.hoverAction;
  if (action?.type !== "visibility" || !supportsClickAction(el)) return "";
  const set = setList(action, ["set"]);
  const attrs = HOVER_KEYS.map((key) => [key, idList(action[key])]).filter(([, ids]) => ids.length).map(([key, ids]) => ` data-hover-${key}="${escapeAttr2(ids.join(" "))}"`).join("") + (set.length ? ` data-hover-set="${set.map((s) => `${s.id}:${s.state || ""}`).join(" ")}"` : "");
  return attrs && focusable ? `${attrs} tabindex="0"` : attrs;
}
function visibilityAttrs(el, targets) {
  const states = elementStates(el);
  if (!el?.id || !(targets.has(el.id) || el.startHidden || states.length)) return "";
  const start = states.some((st2) => st2.id === el.initialState) ? el.initialState : "";
  const st = states.length ? ` data-st-list="${states.map((s) => s.id).join(" ")}" data-st="${start}" data-st-start="${start}"` : "";
  return ` data-el="${escapeAttr2(el.id)}"${el.startHidden ? " data-start-hidden data-hidden" : ""}${st}`;
}
function stateOutlines(el) {
  const shape = el?.shape || "rect";
  if (el?.type !== "shape" || !CLOSED_SHAPES.includes(shape)) return null;
  const states = elementStates(el);
  const values = states.map(stateValues);
  if (!values.some((v) => v.shape && v.shape !== shape || v.width != null || v.height != null || v.borderRadius != null)) return null;
  const outlines = [["", shapeOutline(el)]];
  states.forEach((st, i) => {
    const v = values[i];
    const w = v.width ?? el.width, h = v.height ?? el.height;
    const sx = w / (el.width || 1), sy = h / (el.height || 1);
    const star = ["starCx", "starCy", "starOuterR", "starInnerR"].filter((k) => el[k] != null).reduce((o, k) => ({ ...o, [k]: el[k] * (k === "starCx" ? sx : k === "starCy" ? sy : Math.min(sx, sy)) }), {});
    outlines.push([st.id, shapeOutline({ ...el, ...star, shape: v.shape || shape, width: w, height: h, borderRadius: v.borderRadius ?? el.borderRadius })]);
  });
  return outlines;
}
function shapeSvg(el) {
  const outlines = stateOutlines(el);
  if (!outlines) return shapeSvgString(el);
  const start = elementStates(el).some((st) => st.id === el.initialState) ? el.initialState : "";
  return shapeSvgString(el, {
    d: outlinePath(outlines.find(([id]) => id === start)[1]),
    outlines: outlines.map(([id, points]) => `${id}:${points.map((p) => p.join(",")).join(" ")}`).join("|")
  });
}
function stateSteps(slide) {
  const steps = /* @__PURE__ */ new Map();
  for (const el of slide?.elements || []) {
    const ids = elementStates(el).map((st) => st.id);
    if (!ids.length || !el.stateSteps || typeof el.stateSteps !== "object") continue;
    for (const [key, state] of Object.entries(el.stateSteps)) {
      const step = Number(key);
      if (!Number.isInteger(step) || step < 1 || step > 1e3 || state && !ids.includes(state)) continue;
      if (!steps.has(step)) steps.set(step, []);
      steps.get(step).push([el.id, state || ""]);
    }
  }
  return [...steps.entries()].sort((a, b) => a[0] - b[0]);
}
function stepMarkers(slide) {
  return stateSteps(slide).map(([step, changes]) => `<span class="fragment" data-fragment-index="${step}" data-st-steps="${changes.map(([id, st]) => `${id}:${st}`).join(" ")}" aria-hidden="true" style="position:absolute;"></span>`).join("");
}
function statesCss(slides) {
  const rules = [];
  for (const slide of slides || []) {
    for (const el of slide?.elements || []) {
      const states = elementStates(el);
      if (!states.length) continue;
      const values = states.map(stateValues);
      const base = `[data-el="${el.id}"]`;
      const where = (sel) => `.reveal .slides :where(${sel})`;
      const turns = values.some((v) => v.flipX || v.flipY || v.scale != null);
      const transform = (v) => `perspective(1000px) rotateX(${v.flipY || 0}deg) rotateY(${v.flipX || 0}deg) scale(${v.scale ?? 1})`;
      const own = [turns && `transform:${transform({})}`, el.backfaceHidden === true && "backface-visibility:hidden"].filter(Boolean);
      if (own.length) rules.push(`${where(base)} { ${own.join("; ")}; }`);
      const line = el.shape === "line" || el.shape === "line-arrow";
      states.forEach((st, i) => {
        const v = values[i];
        const on = [`${base}[data-st="${st.id}"]:not([data-hover-st])`, `${base}[data-hover-st="${st.id}"]`];
        const decl = [`--st-dur:${v.duration}ms`, `--st-ease:${v.easing}`];
        for (const [key, prop] of [["x", "left"], ["y", "top"], ["width", "width"], ["height", "height"]]) {
          if (v[key] != null) decl.push(`${prop}:${v[key]}px !important`);
        }
        if (v.rotation != null) decl.push(`rotate:${v.rotation}deg !important`);
        if (v.zIndex != null) decl.push(`z-index:${v.zIndex} !important`);
        if (turns) decl.push(`transform:${transform(v)}`);
        rules.push(`${where(on.join(", "))} { ${decl.join("; ")}; }`);
        if (v.opacity != null) rules.push(`${where(on.map((s) => `${s}:not(.fragment:not(.visible))`).join(", "))} { opacity:${v.opacity} !important; }`);
        const lineColor = v.stroke || (el.stroke && el.stroke !== "none" ? null : v.fill);
        const paint = (line ? [lineColor && `stroke:${lineColor}`] : [v.fill && `fill:${v.fill}`, v.stroke && `stroke:${v.stroke}`]).filter(Boolean);
        if (paint.length) rules.push(`${where(on.join(", "))} > svg > ${line ? ":is(line, polyline)" : "g"} { ${paint.join("; ")}; }`);
        if (v.textColor) rules.push(`${where(on.join(", "))} > svg > text { fill:${v.textColor}; }`);
        if (v.filterBrightness != null || v.filterContrast != null || v.filterGrayscale != null) {
          const b = v.filterBrightness ?? clamp3(el.filterBrightness, 0, 400) ?? 100;
          const c = v.filterContrast ?? clamp3(el.filterContrast, 0, 400) ?? 100;
          const g = v.filterGrayscale ?? clamp3(el.filterGrayscale, 0, 100) ?? 0;
          rules.push(`${where(on.join(", "))} img { filter:brightness(${b}%) contrast(${c}%) grayscale(${g}%) !important; }`);
        }
      });
    }
  }
  return rules.map((r) => `
    ${r}`).join("");
}
function slideIdAttr(slide) {
  return slide?.id ? ` id="${escapeAttr2(slideAnchor(slide.id))}"` : "";
}
var CLICK_ACTION_CSS = `
    .reveal .slides [data-action] { cursor:pointer; }
    .reveal .slides [data-action]:not(.fragment), .reveal .slides [data-el]:not(.fragment) { transition:filter 0.15s, translate 0.15s, scale 0.15s, box-shadow 0.15s, opacity 0.25s, visibility 0.25s; }
    .reveal .slides [data-action]:hover { filter:brightness(1.15); }
    .reveal .slides [data-action][data-hover]:hover { filter:none; }
    .reveal .slides [data-action][data-hover="lift"]:hover { translate:0 -4px; box-shadow:0 10px 24px rgba(0,0,0,0.35); }
    .reveal .slides [data-action][data-hover="grow"]:hover { scale:1.04; }
    .reveal .slides [data-action]:focus-visible, .reveal .slides :is([data-hover-show], [data-hover-hide], [data-hover-set]):focus-visible { outline:2px solid #818cf8; outline-offset:2px; }
    .reveal .slides [data-action] iframe { pointer-events:none; }
    .reveal .slides [data-el][data-hidden]:not([data-hover-shown]), .reveal .slides [data-el][data-hover-hidden] { opacity:0 !important; visibility:hidden !important; pointer-events:none; }
    .reveal .slides [data-el][data-st-list]:not(.fragment) { transition-property:left, top, width, height, rotate, transform, opacity, visibility, filter, translate, scale, box-shadow; transition-duration:var(--st-dur, 0.4s); transition-timing-function:var(--st-ease, ease); }
    .reveal .slides [data-st-list] > svg > *, .reveal .slides [data-st-list] img { transition:fill var(--st-dur, 0.4s) var(--st-ease, ease), stroke var(--st-dur, 0.4s) var(--st-ease, ease), filter var(--st-dur, 0.4s) var(--st-ease, ease); }
    @media (prefers-reduced-motion: reduce) { .reveal .slides [data-st-list], .reveal .slides [data-st-list] * { transition-duration:0s !important; } }`;
var CLICK_ACTION_SCRIPT = `
    (function() {
      var HOVER = '.reveal .slides [data-hover-show], .reveal .slides [data-hover-hide], .reveal .slides [data-hover-set]';
      var hovered = [], focused = null, tapped = null, pointerType = 'mouse', keyboard = false, ending = null;
      function ids(el, key) { return (el.getAttribute(key) || '').split(' '); }
      function shownBy(source, node) {
        var shown = ids(source, 'data-hover-show');
        var slide = source.closest('section');
        for (var t = node; t && t !== slide && t.getAttribute; t = t.parentElement) {
          if (shown.indexOf(t.getAttribute('data-el')) !== -1) return true;
        }
        return false;
      }
      function sameHover(a, b) {
        return a === b || !!(a && b && a.closest('section') === b.closest('section')
          && a.getAttribute('data-hover-show') === b.getAttribute('data-hover-show')
          && a.getAttribute('data-hover-hide') === b.getAttribute('data-hover-hide')
          && a.getAttribute('data-hover-set') === b.getAttribute('data-hover-set'));
      }
      function stateOf(el) { return el.hasAttribute('data-hover-st') ? el.getAttribute('data-hover-st') : el.getAttribute('data-st') || ''; }
      // Morphing: a shape whose states change its outline moves its path's
      // points to the new state's, over the time the state moves in
      var CURVES = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], linear: [0, 0, 1, 1] };
      function curve(css) {
        var m = /cubic-bezier[(]([^)]+)[)]/.exec(css || ''), c = m ? m[1].split(',').map(Number) : CURVES[(css || '').trim()] || CURVES.ease;
        var at = function(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; };
        return function(x) {
          var lo = 0, hi = 1, t = x;
          for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (at(t, c[0], c[2]) < x) lo = t; else hi = t; }
          return at(t, c[1], c[3]);
        };
      }
      function outlines(path) {
        if (!path._outlines) {
          path._outlines = {};
          (path.getAttribute('data-morph') || '').split('|').forEach(function(entry) {
            var at = entry.indexOf(':');
            path._outlines[entry.slice(0, at)] = entry.slice(at + 1).split(' ').map(function(p) { return p.split(',').map(Number); });
          });
        }
        return path._outlines;
      }
      function draw(path, points) {
        path._points = points;
        path.setAttribute('d', 'M' + points.map(function(p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z');
      }
      function morph(el) {
        var path = el.querySelector('path[data-morph]');
        if (!path) return;
        var all = outlines(path), to = all[stateOf(el)] || all[''];
        var from = path._points || all[el.getAttribute('data-st-start') || ''] || to;
        if (!to || from.length !== to.length) return;
        window.cancelAnimationFrame(path._frame);
        var cs = window.getComputedStyle(el), time = (cs.getPropertyValue('--st-dur') || '').trim();
        var ms = !time ? 400 : /ms$/.test(time) ? parseFloat(time) : parseFloat(time) * 1000;
        var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!(ms > 0) || still) return draw(path, to);
        var ease = curve(cs.getPropertyValue('--st-ease')), began = null;
        var step = function(now) {
          if (began === null) began = now;
          var k = ease(Math.min(1, (now - began) / ms));
          draw(path, from.map(function(p, i) { return [p[0] + (to[i][0] - p[0]) * k, p[1] + (to[i][1] - p[1]) * k]; }));
          if (now - began < ms) path._frame = window.requestAnimationFrame(step);
        };
        path._frame = window.requestAnimationFrame(step);
      }
      function changeState(el, attr, value) {
        var before = stateOf(el), dur = '', ease = '';
        if (before) { var cs = window.getComputedStyle(el); dur = cs.getPropertyValue('--st-dur'); ease = cs.getPropertyValue('--st-ease'); }
        if (value === null) el.removeAttribute(attr); else el.setAttribute(attr, value);
        var after = stateOf(el);
        if (after === before) return;
        if (after || !dur) { el.style.removeProperty('--st-dur'); el.style.removeProperty('--st-ease'); }
        else { el.style.setProperty('--st-dur', dur); el.style.setProperty('--st-ease', ease); }
        morph(el);
      }
      function stateTarget(slide, id) {
        var els = slide.querySelectorAll('[data-st-list]');
        for (var i = 0; i < els.length; i++) if (els[i].getAttribute('data-el') === id) return els[i];
        return null;
      }
      function hasState(el, state) { return !state || ids(el, 'data-st-list').indexOf(state) !== -1; }
      function changeStates(el) {
        var slide = el.closest('section');
        var sets = ids(el, 'data-action-set');
        for (var i = 0; slide && i < sets.length; i++) {
          var parts = sets[i].split(':'), target = stateTarget(slide, parts[0]);
          if (!target) continue;
          var state = parts[1] || '', mode = parts[2], now = target.getAttribute('data-st') || '';
          var cycle = [''].concat(ids(target, 'data-st-list'));
          var next = mode === 'toggle' ? (now === state ? '' : state) : mode === 'cycle' ? cycle[(cycle.indexOf(now) + 1) % cycle.length] : state;
          if (hasState(target, next)) changeState(target, 'data-st', next);
        }
      }
      function stepped(slide) {
        var markers = Array.prototype.slice.call(slide ? slide.querySelectorAll('.fragment[data-st-steps]') : []);
        markers.sort(function(a, b) { return (+a.getAttribute('data-fragment-index') || 0) - (+b.getAttribute('data-fragment-index') || 0); });
        var states = {};
        for (var i = 0; i < markers.length; i++) {
          var shown = markers[i].classList.contains('visible'), changes = ids(markers[i], 'data-st-steps');
          for (var j = 0; j < changes.length; j++) {
            var parts = changes[j].split(':');
            if (shown) states[parts[0]] = parts[1] || '';
            else if (!(parts[0] in states)) states[parts[0]] = null; // not reached yet: its first state
          }
        }
        return states;
      }
      function stepStates(slide, now) {
        var states = stepped(slide);
        for (var id in states) {
          var el = stateTarget(slide, id);
          if (!el) continue;
          var next = states[id] === null ? el.getAttribute('data-st-start') || '' : states[id];
          if (!hasState(el, next) || (el.getAttribute('data-st') || '') === next) continue;
          if (now) el.setAttribute('data-st', next); else changeState(el, 'data-st', next);
        }
      }
      function resetStates(slide) {
        var els = slide ? slide.querySelectorAll('[data-st-list]') : [];
        for (var i = 0; i < els.length; i++) {
          els[i].style.setProperty('--st-dur', '0s');
          els[i].removeAttribute('data-hover-st');
          els[i].setAttribute('data-st', els[i].getAttribute('data-st-start') || '');
        }
        stepStates(slide, true);
        if (els.length) els[0].offsetWidth;
        for (var j = 0; j < els.length; j++) { morph(els[j]); els[j].style.removeProperty('--st-dur'); els[j].style.removeProperty('--st-ease'); }
      }
      function layer() {
        var old = document.querySelectorAll('.reveal .slides [data-hover-shown], .reveal .slides [data-hover-hidden]');
        for (var i = 0; i < old.length; i++) { old[i].removeAttribute('data-hover-shown'); old[i].removeAttribute('data-hover-hidden'); }
        var sources = [focused, tapped].concat(hovered), stated = [], states = [];
        for (var s = 0; s < sources.length; s++) {
          var source = sources[s], slide = source && source.closest('section');
          if (!slide) continue;
          var hide = ids(source, 'data-hover-hide'), show = ids(source, 'data-hover-show');
          var els = slide.querySelectorAll('[data-el]');
          for (var j = 0; j < els.length; j++) {
            var id = els[j].getAttribute('data-el');
            if (show.indexOf(id) !== -1) { els[j].setAttribute('data-hover-shown', ''); els[j].removeAttribute('data-hover-hidden'); }
            else if (hide.indexOf(id) !== -1) { els[j].setAttribute('data-hover-hidden', ''); els[j].removeAttribute('data-hover-shown'); }
          }
          var sets = ids(source, 'data-hover-set');
          for (var k = 0; k < sets.length; k++) {
            var parts = sets[k].split(':'), target = stateTarget(slide, parts[0]);
            if (!target || !hasState(target, parts[1] || '')) continue;
            var at = stated.indexOf(target);
            if (at === -1) { stated.push(target); states.push(parts[1] || ''); } else states[at] = parts[1] || '';
          }
        }
        // States change only where they differ, so they move rather than restart
        var was = document.querySelectorAll('.reveal .slides [data-hover-st]');
        for (var w = 0; w < was.length; w++) if (stated.indexOf(was[w]) === -1) changeState(was[w], 'data-hover-st', null);
        for (var t = 0; t < stated.length; t++) if (stated[t].getAttribute('data-hover-st') !== states[t]) changeState(stated[t], 'data-hover-st', states[t]);
      }
      function unhover() { clearTimeout(ending); ending = null; hovered = []; focused = null; tapped = null; layer(); }
      function hover(next) {
        clearTimeout(ending);
        ending = null;
        if (next.length === hovered.length && next.every(function(el, i) { return el === hovered[i]; })) return;
        if (next.every(function(el) { return hovered.indexOf(el) !== -1; })) {
          ending = setTimeout(function() { ending = null; hovered = next; layer(); }, 200);
          return;
        }
        hovered = next;
        layer();
      }
      document.addEventListener('pointerover', function(e) {
        pointerType = e.pointerType || 'mouse';
        if (pointerType === 'touch' || !e.target.closest) return;
        var next = hovered.filter(function(source) { return shownBy(source, e.target); });
        var source = e.target.closest(HOVER);
        if (source && next.indexOf(source) === -1) next.push(source);
        hover(next);
      });
      document.addEventListener('pointerout', function(e) {
        if (!e.relatedTarget && e.pointerType !== 'touch') hover([]);
      });
      document.addEventListener('pointerdown', function(e) { pointerType = e.pointerType || 'mouse'; keyboard = false; }, true);
      window.addEventListener('keydown', function() { keyboard = true; }, true);
      document.addEventListener('focusin', function(e) {
        var source = keyboard && e.target.closest ? e.target.closest(HOVER) : null;
        if (source === focused) return;
        focused = source;
        layer();
      });
      document.addEventListener('focusout', function() {
        if (!focused) return;
        focused = null;
        layer();
      });
      function tap(target) {
        var source = target.closest(HOVER);
        var next = source && !source.hasAttribute('data-action') ? (sameHover(source, tapped) ? null : source)
          : tapped && shownBy(tapped, target) ? tapped : null;
        if (next === tapped) return;
        tapped = next;
        layer();
      }
      function hide(el, hidden) {
        if (hidden) el.setAttribute('data-hidden', ''); else el.removeAttribute('data-hidden');
      }
      function reset(slide) {
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        for (var i = 0; i < els.length; i++) hide(els[i], els[i].hasAttribute('data-start-hidden'));
      }
      function showHide(el) {
        var slide = el.closest('section');
        var els = slide ? slide.querySelectorAll('[data-el]') : [];
        var change = function(key, fn) {
          var ids = (el.getAttribute('data-action-' + key) || '').split(' ');
          for (var i = 0; i < els.length; i++) if (ids.indexOf(els[i].getAttribute('data-el')) !== -1) fn(els[i]);
        };
        change('hide', function(t) { hide(t, true); });
        change('show', function(t) { hide(t, false); });
        change('toggle', function(t) { hide(t, !t.hasAttribute('data-hidden')); });
      }
      function run(el) {
        var type = el.getAttribute('data-action');
        if (type === 'visibility') { showHide(el); changeStates(el); return; }
        if (type === 'next') return Reveal.next();
        if (type === 'prev') return Reveal.prev();
        if (type === 'slide') {
          var target = document.getElementById(el.getAttribute('data-action-slide'));
          if (!target) return;
          var at = Reveal.getIndices(target);
          return Reveal.slide(at.h, at.v);
        }
        if (type === 'url') {
          var url = el.getAttribute('data-action-url');
          if (!/^(https?:|mailto:)/i.test(url)) return;
          if (el.hasAttribute('data-action-new-tab')) window.open(url, '_blank', 'noopener');
          else window.location.href = url;
        }
      }
      document.addEventListener('click', function(e) {
        if (!e.target.closest) return;
        if (pointerType === 'touch') tap(e.target);
        var link = e.target.closest('.reveal .slides a[href^="#/"]');
        if (link) { e.preventDefault(); window.location.hash = link.getAttribute('href'); return; }
        if (e.target.closest('a[href]')) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        run(el);
      });
      window.addEventListener('keydown', function(e) {
        if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.closest) return;
        var el = e.target.closest('.reveal .slides [data-action]');
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        run(el);
      }, true);
      Reveal.on('slidechanged', function(e) { unhover(); reset(e.currentSlide); resetStates(e.currentSlide); });
      Reveal.on('fragmentshown', function() { stepStates(Reveal.getCurrentSlide()); });
      Reveal.on('fragmenthidden', function() { stepStates(Reveal.getCurrentSlide()); });
    })();`;

// client/src/utils/generateHTML.js
var EMBED_RESIZE_LISTENER = "window.addEventListener('message',function(e){if(e.source===window.parent&&e.data==='parallax-resize')window.dispatchEvent(new Event('resize'))});";
var EMBED_SCALE_SCRIPT = `
    (function() {
      function send(frame) {
        var s = Reveal.getScale && Reveal.getScale();
        if (!(s > 0)) return;
        try { frame.contentWindow.postMessage({ source: 'parallax-deck', type: 'scale', scale: s }, '*'); } catch (e) {}
      }
      function sendAll() { document.querySelectorAll('iframe[data-deck-scale]').forEach(send); }
      document.querySelectorAll('iframe[data-deck-scale]').forEach(function(frame) {
        frame.addEventListener('load', function() { send(frame); });
      });
      Reveal.on('ready', sendAll);
      Reveal.on('resize', sendAll);
    })();
`;
function buildHtmlEmbed(userHtml, embedW, embedH) {
  const initScript = `<script>const EMBED_WIDTH=${embedW},EMBED_HEIGHT=${embedH};(function(){function fit(){document.querySelectorAll('svg').forEach(function(s){if(s._vb)return;var w=parseFloat(s.getAttribute('width')),h=parseFloat(s.getAttribute('height'));if(!s.getAttribute('viewBox')){if(!(w>0&&h>0))return;s.setAttribute('viewBox','0 0 '+w+' '+h);}s.setAttribute('width','100%');s.setAttribute('height','100%');s._vb=1;});}window.addEventListener('load',fit);setTimeout(fit,100);setTimeout(fit,400);new MutationObserver(fit).observe(document.documentElement,{childList:true,subtree:true});})();${EMBED_RESIZE_LISTENER}</script>`;
  const resetStyle = `<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;box-sizing:border-box;}canvas{display:block;}svg{display:block;}</style>`;
  const injection = initScript + resetStyle;
  if (/<head[^>]*>/i.test(userHtml))
    return userHtml.replace(/<head[^>]*>/i, (m) => m + injection);
  if (/<html[^>]*>/i.test(userHtml))
    return userHtml.replace(/<html[^>]*>/i, (m) => m + injection);
  if (/<!doctype[^>]*>/i.test(userHtml))
    return userHtml.replace(/(<!doctype[^>]*>)/i, "$1" + injection);
  return injection + userHtml;
}
function absoluteSrc(src) {
  if (!src) return src;
  const origin = typeof window === "undefined" ? "" : window.location?.origin;
  if (!origin || /^(https?:|data:|blob:)/.test(src)) return src;
  return `${origin}${src.startsWith("/") ? "" : "/"}${src}`;
}
function sanitizeAttr(val) {
  if (val == null) return "";
  return String(val).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return "";
  if (/^data:/i.test(trimmed) && !/^data:(image|video|audio)\//i.test(trimmed)) return "";
  return sanitizeAttr(trimmed);
}
var CITABLE_TYPES = ["image", "molecule"];
function citationParts(el, sideCitations) {
  const hasCite = el.citationText || el.citationLink;
  const citeCaption = !!hasCite && (el.citationMode || "caption") === "caption";
  let capHtml = "";
  if (citeCaption) {
    const align = cssValue(el.citationAlign) || "left";
    const ct = (el.citationText || el.citationLink || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const cc = el.citationColor ? `color:${cssValue(el.citationColor)};` : "";
    capHtml = el.citationLink ? `<div class="image-caption" style="text-align:${align};${cc}"><a href="${sanitizeUrl(el.citationLink)}" target="_blank" rel="noopener" style="${cc}">${ct}</a></div>` : `<div class="image-caption" style="text-align:${align};${cc}">${ct}</div>`;
  }
  const sIdx = hasCite && el.citationMode === "side" ? sideCitations.findIndex((c) => c.id === el.id) : -1;
  const sup = sIdx >= 0 ? `<span class="cite-sup">${sIdx + 1}</span>` : "";
  return { citeCaption, capHtml, sup };
}
function cssValue(val) {
  if (val == null) return "";
  return String(val).replace(/[<>"`;{}\\\r\n]/g, "");
}
function sanitizeCustomCSS(css) {
  if (!css || typeof css !== "string") return "";
  return css.replace(/<\/style/gi, "&lt;/style").replace(/<script/gi, "&lt;script").replace(/expression\s*\(/gi, "/* expression blocked */ (").replace(/url\s*\(\s*['"]?\s*javascript:/gi, "url(/* blocked */");
}
function customFontLinks(fonts) {
  return fonts.filter((f) => f.source === "google" && f.url).map((f) => `
  <link rel="stylesheet" href="${sanitizeUrl(f.url)}">`).join("");
}
function customFontFaces(fonts) {
  const quoted = (s) => String(s || "").replace(/['"\\<>{};\r\n]/g, "");
  return fonts.filter((f) => f.source === "upload" && f.url && !/^\s*(javascript|vbscript|data):/i.test(f.url)).map((f) => `
    @font-face { font-family: '${quoted(f.familyName)}'; src: url('${quoted(absoluteSrc(f.url)).replace(/[()]/g, "")}'); }`).join("");
}
function getSlideColumns(slides, presentation = {}) {
  const is2D = slides.some((s) => s.column !== void 0);
  if (is2D) {
    const colMap = {};
    slides.forEach((s) => {
      const c = s.column ?? 0;
      if (!colMap[c]) colMap[c] = [];
      colMap[c].push(s);
    });
    const sortedKeys = Object.keys(colMap).map(Number).sort((a, b) => a - b);
    return sortedKeys.map((k) => colMap[k]);
  }
  if (presentation.sectionNav) {
    const groups = [];
    const keyOrder = [];
    const keyToGroup = {};
    slides.forEach((s) => {
      const key = s.activeSection !== void 0 ? String(s.activeSection) : s.section || "";
      if (!key) {
        groups.push([s]);
        keyOrder.push(null);
      } else if (keyToGroup[key]) {
        keyToGroup[key].push(s);
      } else {
        const group = [s];
        keyToGroup[key] = group;
        groups.push(group);
        keyOrder.push(key);
      }
    });
    return groups;
  }
  return slides.map((s) => [s]);
}
var CUSTOM_TRANSITIONS = ["differential-rotation"];
function referencesHtml(citations, markerColor) {
  const items = citations.entries.map((entry) => {
    const year = entry.year || "";
    const journal = entry.journal || entry.booktitle || "";
    const vol = entry.volume || "";
    const pages = entry.pages || "";
    const doi = entry.doi || "";
    let line = `<span style="color:${markerColor};font-weight:700;margin-right:6px">[${citations.numberByKey[entry.key]}]</span>`;
    line += `${escapeHtml(String(entry.author || "").replace(/[{}]/g, ""))}`;
    if (year) line += ` (${escapeHtml(year)})`;
    line += `. ${escapeHtml(entry.title || "")}.`;
    if (journal) line += ` <em>${escapeHtml(journal)}</em>`;
    if (vol) line += `, ${escapeHtml(vol)}`;
    if (pages) line += `, ${escapeHtml(pages)}`;
    if (journal || vol || pages) line += ".";
    if (doi) line += ` <a href="https://doi.org/${escapeHtml(doi)}" target="_blank" rel="noopener" style="color:rgba(99,102,241,0.8);font-size:0.85em">DOI</a>`;
    else if (webLink(entry.url)) line += ` <a href="${sanitizeUrl(webLink(entry.url).href)}" target="_blank" rel="noopener" style="color:rgba(99,102,241,0.8);font-size:0.85em">${escapeHtml(webLink(entry.url).site)}</a>`;
    return `<div style="margin-bottom:8px;line-height:1.5;font-size:14px;color:rgba(255,255,255,0.85)">${line}</div>`;
  }).join("\n          ");
  return `<h2 style="font-size:28px;margin:0 0 20px;color:rgba(255,255,255,0.95)">References</h2>
        <div style="columns:${citations.entries.length > 8 ? 2 : 1};column-gap:30px">
          ${items}
        </div>`;
}
var hasCitationMarkers = (presentation) => (presentation.slides || []).some((slide) => (slide.elements || []).some((el) => typeof el.content === "string" && el.content.includes("data-cite")));
function generateRevealHTML(presentation, opts = {}) {
  const slideW = Number(presentation.slideWidth) || 960;
  const slideH = Number(presentation.slideHeight) || 540;
  const globalFont = cssValue(presentation.globalFont);
  const showFooter = presentation.showFooter || false;
  const showPageNumbers = presentation.showPageNumbers || false;
  const footerTimeMode = presentation.footerTimeMode || "none";
  const timerDuration = Number(presentation.timerDuration ?? 20) || 0;
  const showTimeWidget = footerTimeMode !== "none";
  const laserPointer = presentation.laserPointer || "off";
  const bibliography = presentation.bibliography || [];
  const citations = buildCitationIndex(presentation);
  const pageNumberFormat = presentation.pageNumberFormat || "c/t";
  const theme = /^[\w-]+$/.test(presentation.theme || "") ? presentation.theme : "black";
  const codeTheme = /^[\w-]+$/.test(presentation.codeTheme || "") ? presentation.codeTheme : "monokai";
  const footerFontSize = Number(presentation.footerFontSize) || 14;
  const footerFontFamily = cssValue(presentation.footerFontFamily) || "-apple-system,sans-serif";
  const footerColor = cssValue(presentation.footerColor) || "rgba(255,255,255,0.65)";
  const showPresentGrid = presentation.showPresentGrid || false;
  const presentGridSize = Number(presentation.gridSize) || 40;
  const footerMode = presentation.footerMode || "basic";
  const sequenceSections = presentation.sequenceSections || [];
  const footerInactiveColor = cssValue(presentation.footerInactiveColor) || "rgba(255,255,255,0.25)";
  const customFonts = (opts.customFonts || []).filter(Boolean);
  const pluginSandbox = opts.pluginSandbox || ((el) => plugin_registry_default.getSandboxHtml(el.type));
  const seenGroups = /* @__PURE__ */ new Set();
  const totalNumberedSlides = (presentation.slides || []).filter((s) => {
    if (s.showPageNumber === false) return false;
    if (s.slideGroup) {
      if (seenGroups.has(s.slideGroup)) return false;
      seenGroups.add(s.slideGroup);
    }
    return true;
  }).length;
  let pageCounter = 0;
  const pageGroupSeen = /* @__PURE__ */ new Set();
  const slideSectionHtmlByIndex = /* @__PURE__ */ new Map();
  presentation.slides.forEach((slide, slideIndex) => {
    const bgAttrs = getBackgroundAttrs(slide.background);
    const notes = slide.notes && opts.notes !== false ? `<aside class="notes">${slide.notes}</aside>` : "";
    const sideCitations = (slide.elements || []).filter((el) => CITABLE_TYPES.includes(el.type) && (el.citationText || el.citationLink) && el.citationMode === "side").map((el) => ({ id: el.id, text: el.citationText, link: el.citationLink }));
    const clickTargets = visibilityTargets(slide);
    const canvasH = getCanvasHeight(slide, slideH);
    const canvasW = getCanvasWidth(slide, slideW, slideH);
    const axis = scrollAxis(slide, slideW, slideH);
    const scrolling = axis !== null;
    const sortedElements = (slide.elements || []).slice().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    const renderedElements = sortedElements.map((el) => {
      const shadowStyle = el.shadowBlur || el.shadowX || el.shadowY ? `box-shadow:${el.shadowX || 0}px ${el.shadowY || 0}px ${el.shadowBlur || 0}px ${cssValue(el.shadowColor) || "rgba(0,0,0,0.5)"};` : "";
      const borderRadiusStyle = (el.type === "image" || el.type === "code") && el.borderRadius ? `border-radius:${el.borderRadius}px;` : "";
      const rotationStyle = el.rotation ? `rotate:${el.rotation}deg;` : "";
      const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}`;
      const dataId2 = slide.autoAnimate ? ` data-id="${el.id}"` : "";
      const fragClass2 = el.fragment ? ` class="fragment ${sanitizeAttr(el.fragmentAnimation || "fade-in")}"` : "";
      const fragIdx2 = el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${sanitizeAttr(el.fragmentIndex)}"` : "";
      const gsapAttrs2 = el.animationEnter && el.animationEnter !== "none" ? ` data-gsap-enter="${sanitizeAttr(el.animationEnter)}" data-gsap-delay="${Number(el.animationDelay) || 0}" data-gsap-duration="${Number(el.animationDuration) || 600}"` : "";
      const actionAttrs2 = clickActionAttrs(el, clickTargets);
      if (el.type === "text") {
        const spacingStyle = `${globalFont ? `font-family:${globalFont};` : ""}line-height:${cssValue(el.lineHeight ?? 1.5)};${el.letterSpacing ? `letter-spacing:${cssValue(el.letterSpacing)}px;` : ""}${el.wordSpacing ? `word-spacing:${cssValue(el.wordSpacing)}px;` : ""}`;
        const textStyle = el.sizeMode === "auto" ? `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:auto;z-index:${el.zIndex || 1};overflow:visible;box-sizing:border-box;${shadowStyle}${rotationStyle}` : style;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${textStyle} padding:8px 12px; color:white;${spacingStyle}">${resolveCitationsInHtml(el.content || "", citations.labelByKey)}</div>`;
      }
      if (el.type === "image") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const imgFilterParts = [
          el.filterBrightness != null && el.filterBrightness !== 100 ? `brightness(${el.filterBrightness}%)` : "",
          el.filterContrast != null && el.filterContrast !== 100 ? `contrast(${el.filterContrast}%)` : "",
          el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : ""
        ].filter(Boolean).join(" ");
        const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : "";
        const expandAttr = el.clickToExpand ? ' data-expand="true"' : "";
        const popupAttr = el.popupText ? ` data-popup="${el.popupText.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" data-popup-pos="${el.popupPosition || "below"}" data-popup-fs="${el.popupFontSize || 15}"` : "";
        const interactiveCursor = el.clickToExpand || el.popupText ? "cursor:pointer;" : "";
        const { citeCaption, capHtml, sup } = citationParts(el, sideCitations);
        const cStyle = citeCaption ? style.replace("overflow:hidden;", "overflow:visible;") : style;
        const clipOpen = citeCaption ? `<div style="width:100%;height:100%;overflow:hidden;position:relative;${borderRadiusStyle}">` : "";
        const clipClose = citeCaption ? "</div>" : "";
        if (el.imageW != null) {
          const offX = el.imageOffsetX ?? 0;
          const offY = el.imageOffsetY ?? 0;
          const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${cssValue(el.objectFit) || "contain"};${filterStyle}`;
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${sanitizeAttr(el.alt || "")}" style="${imgStyle}" />${clipClose}${capHtml}${sup}</div>`;
        }
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2}${expandAttr}${popupAttr} style="${cStyle}${interactiveCursor}">${clipOpen}<img src="${src}" alt="${sanitizeAttr(el.alt || "")}" style="display:block;width:100%;height:100%;object-fit:${cssValue(el.objectFit) || "contain"};${filterStyle}" />${clipClose}${capHtml}${sup}</div>`;
      }
      if (el.type === "shape") {
        const opacityStyle = el.opacity !== void 0 && el.opacity !== 1 ? `opacity:${el.opacity};` : "";
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}${opacityStyle}">${shapeSvg(el)}</div>`;
      }
      if (el.type === "tikz") {
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}">${tikzDiagramSvg(el)}</div>`;
      }
      if (el.type === "feynman") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast === false ? 0 : 1}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${feynmanSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "circuit") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast ? 1 : 0}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${circuitSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "logic") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="0" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${logicSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "freebody") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast ? 1 : 0}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${freebodySvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "venn") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="${el.dimPast ? 1 : 0}" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${vennSvg(el, { deck: fxId, labels: "deck" })}</div>`;
      }
      if (el.type === "timing") {
        const fxId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-fx="${fxId}" data-fx-dim="0" style="${style.replace("overflow:hidden;", "overflow:visible;")}">${timingSvg(el, { deck: fxId })}</div>`;
      }
      if (el.type === "periodic") {
        const pt = periodicDeckHtml(el);
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2}${pt.attrs} style="${style.replace("overflow:hidden;", "overflow:visible;")}">${pt.svg}</div>`;
      }
      if (el.type === "html") {
        const embedHtml = buildHtmlEmbed(el.content || "", el.width, el.height);
        const srcdoc = embedHtml.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "graph") {
        const srcdoc = graphPageHtml(el).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const graphId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" data-graph-id="${graphId}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="Graph"></iframe></div>`;
      }
      if (el.type === "model") {
        const srcdoc = modelViewerHtml(el, { src: absoluteSrc(el.src) }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="3D model"></iframe></div>`;
      }
      if (el.type === "molecule") {
        const srcdoc = moleculeViewerHtml(el, { src: absoluteSrc(el.src) }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const { citeCaption, capHtml, sup } = citationParts(el, sideCitations);
        const mStyle = citeCaption ? style.replace("overflow:hidden;", "overflow:visible;") : style;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${mStyle}"><iframe srcdoc="${srcdoc}" data-deck-scale style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no" title="${escapeHtml(el.name || "Molecule")}"></iframe>${capHtml}${sup}</div>`;
      }
      if (el.type === "p5") {
        const p5Doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:transparent;overflow:hidden;}canvas{display:block;}</style><script src="${(0, import_libraries3.libUrl)("p5", "lib/p5.min.js")}"></script><script>${EMBED_RESIZE_LISTENER}</script></head><body><script>${el.content || ""}</script></body></html>`;
        const srcdoc = p5Doc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "code") {
        const lang = el.language || "plaintext";
        const codeContent = escapeHtml(el.content || "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><pre style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:${el.fontSize || 14}px;line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`;
      }
      if (el.type === "markdown") {
        const md = (el.content || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries3.libUrl)("marked", "lib/marked.umd.js")}"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:18px;line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>document.getElementById('out').innerHTML=marked.parse(${JSON.stringify(el.content || "")});<\\/script></body></html>`;
        const escaped = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      if (el.type === "timeline") {
        const w = el.width, h = el.height, pad = 30, lineY = h * 0.5;
        const lc = el.lineColor || "#6366f1", dc = el.dotColor || lc, tc = el.textColor || "#fff", fs = el.fontSize || 11;
        const spacing = el.tickSpacing || "auto";
        const yearMode = ["year", "10year", "100year", "1000year"].includes(spacing) || spacing === "auto" && String(el.startDate).match(/^-?\d+$/);
        const ticks = [];
        let datePos, itemDateLabel;
        if (yearMode) {
          const y0 = parseInt(el.startDate) || 0, y1 = parseInt(el.endDate) || 0, yr = y1 - y0 || 1;
          datePos = (d) => pad + (parseInt(d) - y0) / yr * (w - pad * 2);
          itemDateLabel = (d) => String(parseInt(d) || d);
          const step = spacing === "1000year" ? 1e3 : spacing === "100year" ? 100 : spacing === "10year" ? 10 : Math.abs(yr) > 8 ? 2 : 1;
          const sY = Math.ceil(y0 / step) * step;
          for (let y = sY; y <= y1; y += step) ticks.push({ date: String(y), label: String(y) });
        } else {
          const t0 = new Date(el.startDate).getTime(), t1 = new Date(el.endDate).getTime(), range = t1 - t0 || 1;
          datePos = (d) => pad + (new Date(d).getTime() - t0) / range * (w - pad * 2);
          itemDateLabel = (d) => d;
          const d0 = new Date(el.startDate), d1 = new Date(el.endDate);
          if (spacing === "day") {
            const step = 864e5;
            for (let t = d0.getTime(); t <= d1.getTime(); t += step) {
              const d = new Date(t);
              ticks.push({ date: d.toISOString().split("T")[0], label: `${d.getMonth() + 1}/${d.getDate()}` });
            }
          } else if (spacing === "month") {
            for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) ticks.push({ date: d.toISOString().split("T")[0], label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
          } else {
            const yearSpan = (t1 - t0) / (365.25 * 24 * 36e5);
            const step = yearSpan > 8 ? 2 : 1;
            for (let y = d0.getFullYear(); y <= d1.getFullYear(); y += step) ticks.push({ date: `${y}-01-01`, label: String(y) });
          }
        }
        const esc8 = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
        svg += `<line x1="${pad}" y1="${lineY}" x2="${w - pad}" y2="${lineY}" stroke="${lc}" stroke-width="2"/>`;
        for (const t of ticks) {
          const x = datePos(t.date);
          svg += `<line x1="${x}" y1="${lineY - 4}" x2="${x}" y2="${lineY + 4}" stroke="${lc}" stroke-width="1.5"/><text x="${x}" y="${lineY + 14}" text-anchor="end" fill="${tc}" font-size="${fs - 1}" opacity="0.5" transform="rotate(-45,${x},${lineY + 14})">${t.label}</text>`;
        }
        for (const item of el.items || []) {
          const x = datePos(item.date), isTop = item.side !== "bottom", cl = item.connectorLength ?? 0;
          const cardY = isTop ? 8 - cl : lineY + 28 + cl, cardH = isTop ? lineY - 36 : h - lineY - 36;
          const connY1 = isTop ? cardY + cardH : lineY, connY2 = isTop ? lineY : cardY;
          const imgH = item.image ? Math.min(cardH * 0.55, 60) : 0;
          const hasExpand = item.image || item.detailedDescription;
          svg += `<g${hasExpand ? ` class="tl-event" data-tl-id="${item.id}" style="cursor:pointer"` : ""}>`;
          svg += `<line x1="${x}" y1="${connY1}" x2="${x}" y2="${connY2}" stroke="${lc}" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>`;
          svg += `<circle cx="${x}" cy="${lineY}" r="4" fill="${dc}"/>`;
          if (isTop) {
            let ty = cardY + fs;
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc8(item.label)}</text>`;
            ty += fs + 2;
            if (item.description) {
              svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc8(item.description)}</text>`;
              ty += fs;
            }
            svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${tc}" font-size="${fs - 2}" opacity="0.35">${itemDateLabel(item.date)}</text>`;
            ty += 4;
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${ty}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
          } else {
            if (item.image) svg += `<image href="${absoluteSrc(sanitizeUrl(item.image))}" x="${x - 40}" y="${cardY}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`;
            svg += `<text x="${x}" y="${cardY + imgH + fs + 2}" text-anchor="middle" fill="${tc}" font-size="${fs}" font-weight="600">${esc8(item.label)}</text>`;
            if (item.description) svg += `<text x="${x}" y="${cardY + imgH + fs * 2 + 4}" text-anchor="middle" fill="${tc}" font-size="${fs - 1}" opacity="0.6">${esc8(item.description)}</text>`;
            svg += `<text x="${x}" y="${cardY + imgH + fs * (item.description ? 3 : 2) + 6}" text-anchor="middle" fill="${tc}" font-size="${fs - 2}" opacity="0.35">${itemDateLabel(item.date)}</text>`;
          }
          svg += "</g>";
        }
        svg += "</svg>";
        const expandItems = (el.items || []).filter((i) => i.image || i.detailedDescription);
        let expandData = "";
        if (expandItems.length) {
          const itemsJson = JSON.stringify(expandItems.map((i) => ({ id: i.id, label: i.label, date: itemDateLabel(i.date), description: i.description, detailedDescription: i.detailedDescription, image: i.image ? absoluteSrc(sanitizeUrl(i.image)) : "" }))).replace(/</g, "\\u003c");
          expandData = `<div class="tl-overlay" style="display:none;position:absolute;inset:0;background:rgba(0,0,0,0.75);border-radius:6px;z-index:10;cursor:pointer;padding:16px;align-items:center;justify-content:center;gap:16px"></div><script>(function(){var el=document.currentScript.parentElement;var overlay=el.querySelector('.tl-overlay');var items=${itemsJson};el.querySelectorAll('.tl-event').forEach(function(g){g.addEventListener('click',function(e){e.stopPropagation();var id=g.getAttribute('data-tl-id');var item=items.find(function(i){return i.id===id});if(!item)return;var h='';if(item.image)h+='<img src="'+item.image+'" style="max-width:'+(item.detailedDescription?'45%':'80%')+';max-height:85%;object-fit:contain;border-radius:6px;flex-shrink:0">';h+='<div style="flex:'+(item.image?1:'none')+';max-width:'+(item.image?'45%':'80%')+';overflow:auto;max-height:85%">';h+='<div style="color:${tc};font-weight:700;font-size:${fs + 4}px;margin-bottom:4px">'+item.label+'<\\/div>';h+='<div style="color:${tc};opacity:0.5;font-size:${fs - 1}px;margin-bottom:8px">'+item.date+'<\\/div>';if(item.description)h+='<div style="color:${tc};opacity:0.7;font-size:${fs}px;margin-bottom:8px">'+item.description+'<\\/div>';if(item.detailedDescription)h+='<div style="color:${tc};opacity:0.85;font-size:${fs + 1}px;line-height:1.5;white-space:pre-wrap">'+item.detailedDescription+'<\\/div>';h+='<\\/div>';overlay.innerHTML=h;overlay.style.display='flex';})});overlay.addEventListener('click',function(){overlay.style.display='none'});}());<\\/script>`;
        }
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><div style="position:relative;width:100%;height:100%;">${svg}${expandData}</div></div>`;
      }
      if (el.type === "callout") {
        const bg = cssValue(el.calloutColor) || "#ef4444";
        const tc = cssValue(el.calloutTextColor) || "#ffffff";
        const fs = el.fontSize || 16;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:${fs}px;font-weight:700;font-family:-apple-system,sans-serif;line-height:1;">${el.calloutNumber || 1}</div>`;
      }
      if (el.type === "icon") {
        const color2 = sanitizeAttr(el.iconColor) || "#ffffff";
        const sw = Number(el.iconStrokeWidth) || 2;
        const iconPaths = { Star: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>', Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>', Check: '<polyline points="20,6 9,17 4,12"/>', X: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', Zap: '<polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>', Target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' };
        const path = iconPaths[el.iconName] || iconPaths["Star"];
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color2}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`;
      }
      if (el.type === "latex") {
        const content = el.content || "";
        const lc = el.textColor || "white";
        const sc = el.fontSize ? el.fontSize / 20 : 1;
        const hasTikz = /\\begin\{tikzpicture\}|\\tikz\s*[{[]/.test(content);
        const hasTable = /\\begin\{(tabular\*?|table\*?|longtable|tabularx|tabulary)\}/.test(content);
        if (hasTikz) {
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\\/script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:auto;color:${lc}}body{transform:scale(${sc});transform-origin:center center}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz">${content}<\\/script></body></html>`;
          const escaped2 = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped2}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
        }
        if (hasTable) {
          const wrapped = content.includes("\\begin{document}") ? content : `\\documentclass{article}
\\usepackage{booktabs}
\\usepackage{array}
\\begin{document}
${content}
\\end{document}`;
          const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${(0, import_libraries3.libUrl)("latex.js", "dist/latex.js")}"><\\/script><link rel="stylesheet" href="${(0, import_libraries3.libUrl)("latex.js", "dist/css/base.css")}"><style>*{box-sizing:border-box}html,body{margin:0;padding:8px;background:transparent;color:${lc}!important;width:100%;height:100%;overflow:auto;font-family:'Computer Modern',Georgia,serif;transform:scale(${sc});transform-origin:top left}table{border-collapse:collapse;color:${lc}}td,th{padding:3px 10px;color:${lc}!important}p,span,div{color:${lc}!important}</style></head><body><div id="out"></div><script>try{var generator=new HtmlGenerator({hyphenate:false});var doc=parse(${JSON.stringify(wrapped)},{generator:generator});document.getElementById('out').appendChild(doc.domFragment())}catch(e){document.getElementById('out').innerHTML='<span style="color:#f87171">Error: '+e.message+'<\\/span>'}<\\/script></body></html>`;
          const escaped2 = srcdoc.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${escaped2}" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
        }
        const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-latex-block="${escaped}" style="${style}display:flex;align-items:center;justify-content:center;overflow:hidden;"><span class="katex-block" style="font-size:${Math.round(sc * 22)}px;color:${lc};"></span></div>`;
      }
      if (el.type === "equation") {
        const eqId = String(el.id || "").replace(/[^A-Za-z0-9_-]/g, "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} data-eq="${eqId}" data-eq-config="${equationConfigAttr(el)}" style="${style}overflow:visible;"></div>`;
      }
      if (el.type === "video") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const attrs = [];
        if (el.controls !== false) attrs.push("controls");
        if (el.autoplay) attrs.push("autoplay");
        if (el.loop) attrs.push("loop");
        if (el.muted) attrs.push("muted");
        const posterAttr = el.poster ? ` poster="${absoluteSrc(sanitizeUrl(el.poster))}"` : "";
        const hasClip = el.startTime != null && el.startTime > 0 || el.endTime != null;
        const rate = el.playbackRate && el.playbackRate !== 1 ? el.playbackRate : null;
        let vidScript = "";
        if (rate || hasClip) {
          const parts = [];
          parts.push("var v=document.currentScript.previousElementSibling");
          if (rate) parts.push(`v.playbackRate=${rate}`);
          if (hasClip) {
            const s = el.startTime || 0;
            const looping = el.loop;
            if (s > 0) parts.push(`v.addEventListener('loadedmetadata',function(){v.currentTime=${s}})`);
            if (el.endTime != null) parts.push(`v.addEventListener('timeupdate',function(){if(v.currentTime>=${el.endTime}){${looping ? `v.currentTime=${s};v.play()` : "v.pause()"}}})`);
            if (s > 0) parts.push(`v.addEventListener('play',function(){if(v.currentTime<${s})v.currentTime=${s}})`);
          }
          vidScript = `<script>${parts.join(";")}</script>`;
        }
        if (hasClip && el.loop) attrs.splice(attrs.indexOf("loop"), attrs.indexOf("loop") >= 0 ? 1 : 0);
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><video src="${src}" ${attrs.join(" ")}${posterAttr} style="width:100%;height:100%;object-fit:${cssValue(el.objectFit) || "contain"};display:block;background:#000;"></video>${vidScript}</div>`;
      }
      if (el.type === "audio") {
        const src = absoluteSrc(sanitizeUrl(el.src));
        const attrs = ["controls"];
        if (el.autoplay) attrs.push("autoplay");
        if (el.loop) attrs.push("loop");
        if (el.muted) attrs.push("muted");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${src}" ${attrs.join(" ")} style="width:90%;"></audio></div>`;
      }
      if (el.type === "table") {
        const data = el.data || [[""]];
        const headerBg = cssValue(el.headerBgColor) || "rgba(99,102,241,0.3)";
        const cellBg = cssValue(el.cellBgColor) || "transparent";
        const borderColor = cssValue(el.borderColor) || "rgba(255,255,255,0.2)";
        const borderWidth = Number(el.borderWidth ?? 1) || 0;
        const textColor = cssValue(el.textColor) || "#ffffff";
        const fontSize = Number(el.fontSize) || 14;
        const cellPadding = Number(el.cellPadding) || 8;
        const rows = data.map((row, ri) => {
          const cells = (row || []).map((cell, ci) => {
            const bg = el.headerRow && ri === 0 ? headerBg : cellBg;
            return `<td style="padding:${cellPadding}px;border:${borderWidth}px solid ${borderColor};background:${bg};color:${textColor};font-size:${fontSize}px;">${escapeHtml(cell || "")}</td>`;
          }).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`;
      }
      if (el.type === "text3d") {
        const shadow = text3dShadowFilter(el);
        const t3Style = style.replace("overflow:hidden;", "overflow:visible;").replace(shadowStyle, "") + (shadow ? `filter:${shadow};` : "");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${t3Style}">${text3dHtml(el, { fontFamily: globalFont })}</div>`;
      }
      if (el.type === "textpath") {
        const fontSize = el.fontSize || 64;
        const w = el.width;
        const pathSide = el.pathSide || "bottom";
        const ff = (el.fontFamily || globalFont || "sans-serif").replace(/"/g, "'");
        const baseTextAttrs = `font-size="${fontSize}" font-family="${ff}" fill="${el.color || "#ffffff"}" font-weight="${el.fontWeight || "normal"}" font-style="${el.fontStyle || "normal"}" letter-spacing="${el.letterSpacing || 0}"${el.wordSpacing ? ` word-spacing="${el.wordSpacing}"` : ""}`;
        let svg, svgH;
        if (pathSide === "leftedge" || pathSide === "rightedge") {
          const pad = Math.ceil(fontSize * 0.6);
          const pathX0 = pathSide === "leftedge" ? pad : w - pad;
          svgH = el.height || 300;
          const lineH = fontSize * (el.lineHeight ?? 1.35);
          const tanA = Math.tan((el.angle || 0) * Math.PI / 180);
          const lines = (el.content || "").split("\n");
          const lineXAt = (i) => pathX0 + (fontSize + i * lineH) * tanA;
          const guideX2 = pathX0 + svgH * tanA;
          const tspans = lines.map(
            (line, i) => `<tspan x="${lineXAt(i)}" dy="${i === 0 ? fontSize : lineH}">${escapeHtml(line || " ")}</tspan>`
          ).join("");
          const guideLine = el.showPath !== false ? `<line x1="${pathX0}" y1="0" x2="${guideX2}" y2="${svgH}" stroke="rgba(34,211,238,0.4)" stroke-width="1"/>` : "";
          const anchor = pathSide === "leftedge" ? "start" : "end";
          svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible">${guideLine}<text ${baseTextAttrs} text-anchor="${anchor}">${tspans}</text></svg>`;
        } else {
          const angle = el.angle || 0;
          const angleRad = angle * Math.PI / 180;
          const dy = w * Math.tan(angleRad);
          const pad = Math.ceil(fontSize * 1.2);
          const minY = Math.min(0, dy);
          svgH = Math.ceil(Math.abs(dy) + pad * 2);
          const baselineY = pad - minY;
          const pathD = `M 0,${baselineY} L ${w},${baselineY + dy}`;
          const pathId = `tp-${el.id}`;
          const capHeight = Math.round(fontSize * 0.72);
          const textDy = pathSide === "left" || pathSide === "right" ? capHeight : 0;
          const tpSide = pathSide === "top" || pathSide === "right" ? "right" : "left";
          const dyAttr = textDy ? ` dy="${textDy}"` : "";
          svg = `<svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg" overflow="visible"><defs><path id="${pathId}" d="${pathD}"/></defs><text ${baseTextAttrs}${dyAttr}><textPath href="#${pathId}" startOffset="${el.startOffset || 0}%" textAnchor="${el.textAnchor || "start"}" side="${tpSide}">${escapeHtml(el.content || "")}</textPath></text></svg>`;
        }
        const elStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${w}px;height:${svgH}px;z-index:${el.zIndex || 1};overflow:visible;${el.rotation ? `rotate:${el.rotation}deg;` : ""}`;
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${elStyle}">${svg}</div>`;
      }
      if (el.type === "drawing") {
        const svgPaths = (el.paths || []).map((path) => {
          const d = pointsToPath(path.points, el.smooth !== false);
          return `<path d="${d}" stroke="${path.color || "#ffffff"}" stroke-width="${path.strokeWidth || 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${path.opacity ?? 1}"/>`;
        }).join("");
        return `<svg${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="position:absolute;left:0;top:0;width:${canvasW}px;height:${canvasH}px;overflow:visible;pointer-events:none;z-index:${el.zIndex || 1};">${svgPaths}</svg>`;
      }
      if (el.type && el.type.startsWith("plugin:")) {
        const sandboxHtml = pluginSandbox(el);
        if (!sandboxHtml) {
          return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:14px;">Plugin: ${escapeHtml(el.type.replace("plugin:", ""))}</div>`;
        }
        const srcdoc = buildStaticPluginSrcdoc(sandboxHtml, { data: el.pluginData, width: el.width, height: el.height }).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<div${dataId2}${fragClass2}${fragIdx2}${gsapAttrs2}${actionAttrs2} style="${style}"><iframe srcdoc="${srcdoc}" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:transparent;display:block;" scrolling="no"></iframe></div>`;
      }
      return "";
    });
    const pinned = (i) => scrolling && isPinned(sortedElements[i]);
    const elementsHtml = renderedElements.filter((_, i) => !pinned(i)).join("\n");
    const pinnedHtml = renderedElements.filter((_, i) => pinned(i)).join("\n");
    let sideCitationsHtml = "";
    if (sideCitations.length > 0) {
      const items = sideCitations.map((c, i) => {
        const t = (c.text || c.link || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const content = c.link ? `<a href="${sanitizeUrl(c.link)}" target="_blank" rel="noopener">${t}</a>` : t;
        return `${i + 1}. ${content}`;
      }).join("&ensp;&middot;&ensp;");
      sideCitationsHtml = `      <div class="slide-citations"><div class="slide-citations-text">${items}</div></div>`;
    }
    const slideHasPageNum = slide.showPageNumber !== false;
    if (slideHasPageNum) {
      if (slide.slideGroup && pageGroupSeen.has(slide.slideGroup)) {
      } else {
        pageCounter++;
        if (slide.slideGroup) pageGroupSeen.add(slide.slideGroup);
      }
    }
    const pageLabel = showPageNumbers && slideHasPageNum ? pageNumberFormat === "c/t" ? `${pageCounter} / ${totalNumberedSlides}` : `${pageCounter}` : "";
    let footerHtml = "";
    if (slide.showSlideFooter !== false && !slide.hideFooter) {
      const timeSpan = showTimeWidget ? `<span class="reveal-time-widget" style="flex-shrink:0;"></span>` : "";
      if (footerMode === "sequence" && sequenceSections.length > 0 && (showFooter || showTimeWidget)) {
        const activeIdx = slide.activeSection;
        const seqSpans = sequenceSections.map((sec, i) => {
          const isActive = activeIdx === i;
          const secLabel = typeof sec === "string" ? sec : sec?.label || "";
          const secActiveColor = typeof sec === "object" && sec?.color ? cssValue(sec.color) : footerColor || "rgba(255,255,255,0.9)";
          const color2 = isActive ? secActiveColor : footerInactiveColor;
          const weight = isActive ? "font-weight:700;" : "font-weight:400;";
          return `<span style="color:${color2};${weight}">${escapeHtml(secLabel || `Section ${i + 1}`)}</span>`;
        }).join("");
        const pageSpan = pageLabel ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>` : "";
        const timePart = timeSpan ? `${timeSpan}` : "";
        footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;">${timePart}<div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`;
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : "";
        const leftContent = [timeSpan, sectionLabel].filter(Boolean).join(" — ");
        footerHtml = leftContent || pageLabel ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${leftContent}</span><span>${pageLabel}</span></div>` : "";
      }
    }
    const slideShowGrid = slide.showPresentGrid != null ? slide.showPresentGrid : showPresentGrid;
    const gridHtml = slideShowGrid ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>` : "";
    const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate data-auto-animate-unmatched="fade"' : "";
    const autoAnimateDurAttr = slide.autoAnimate && slide.autoAnimateDuration ? ` data-auto-animate-duration="${sanitizeAttr(slide.autoAnimateDuration)}"` : "";
    const autoAnimateEasingAttr = slide.autoAnimate && slide.autoAnimateEasing ? ` data-auto-animate-easing="${sanitizeAttr(slide.autoAnimateEasing)}"` : "";
    const isCustomTrans = CUSTOM_TRANSITIONS.includes(slide.transition);
    const perSlideTransition = slide.transition ? ` data-transition="${isCustomTrans ? "none" : sanitizeAttr(slide.transition)}"` : "";
    const customTransAttr = isCustomTrans ? ` data-custom-transition="${slide.transition}"` : "";
    const perSlideSpeed = slide.transitionSpeed ? ` data-transition-speed="${sanitizeAttr(slide.transitionSpeed)}"` : "";
    const scrollAttr = axis === "x" ? ` data-scroll-width="${canvasW}"` : axis === "y" ? ` data-scroll-height="${canvasH}"` : "";
    const canvasBg = scrolling ? canvasBackgroundStyle(slide.background, absoluteSrc) : "";
    const bodyHtml = (scrolling ? scrollingSlideBody({ slideW, slideH, canvasW, canvasH, axis, elementsHtml, pinnedHtml, background: canvasBg }) : elementsHtml) + stepMarkers(slide) + graphStepMarkers(slide) + equationStepMarkers(slide) + feynmanStepMarkers(slide) + circuitStepMarkers(slide) + logicStepMarkers(slide) + freebodyStepMarkers(slide) + vennStepMarkers(slide) + timingStepMarkers(slide) + periodicStepMarkers(slide);
    slideSectionHtmlByIndex.set(slideIndex, `    <section data-slide-id="${escapeHtml(String(slide.id || slideIndex))}"${slideIdAttr(slide)}${canvasBg ? "" : bgAttrs}${autoAnimateAttr}${autoAnimateDurAttr}${autoAnimateEasingAttr}${perSlideTransition}${customTransAttr}${perSlideSpeed}${scrollAttr} style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">
${bodyHtml}
${footerHtml}
${gridHtml}
${sideCitationsHtml}
      ${notes}
    </section>`);
  });
  const scrollingDeck = hasScrollingSlides(presentation);
  const columns = getSlideColumns(presentation.slides, presentation);
  let slidesHtml = columns.map((colSlides) => {
    const sections = colSlides.map((slide) => {
      const idx = presentation.slides.indexOf(slide);
      return slideSectionHtmlByIndex.get(idx) || "";
    }).join("\n");
    if (colSlides.length === 1) return sections;
    return `    <section>
${sections}
    </section>`;
  }).join("\n");
  if (citations.entries.length > 0) {
    slidesHtml += `
    <section data-slide-id="references" style="padding:0;width:${slideW}px;height:${slideH}px;overflow:hidden;font-size:42px;">
      <div style="position:absolute;left:40px;top:30px;width:${slideW - 80}px;height:${slideH - 60}px;overflow:auto;z-index:1">
        ${referencesHtml(citations, footerColor)}
      </div>
    </section>`;
  }
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || "Presentation")}</title>
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", "dist/reset.css")}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", "dist/reveal.css")}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("reveal.js", `dist/theme/${theme}.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("@highlightjs/cdn-assets", `styles/${codeTheme}.min.css`)}">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("katex", "dist/katex.min.css")}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Open+Sans:wght@300;400;500;600;700;800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@300;400;500;600;700&family=Questrial&family=Didact+Gothic&family=Nunito:wght@300;400;500;600;700;800;900&family=Nunito+Sans:wght@300;400;500;600;700;800;900&family=Quicksand:wght@300;400;500;600;700&family=Dosis:wght@300;400;500;600;700;800&family=M+PLUS+Rounded+1c:wght@300;400;500;700;900&family=Jura:wght@300;400;500;600;700&family=Codystar:wght@300;400&family=Barlow:wght@300;400;500;600;700;800;900&family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Asap+Condensed:wght@400;500;600;700;900&family=Istok+Web:wght@400;700&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;600;700;800;900&family=Source+Sans+3:wght@300;400;500;600;700;800;900&family=Fira+Sans:wght@300;400;500;600;700;800;900&family=Roboto+Condensed:wght@300;400;500;700&family=Roboto+Mono:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700;800;900&family=Ubuntu:wght@300;400;500;700&family=Manrope:wght@300;400;500;600;700;800&family=Bebas+Neue&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Roboto+Flex:wght@300;400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&family=Geist:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Figtree:wght@300;400;500;600;700;800;900&display=swap">
  <link rel="stylesheet" href="${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/cmu.css")}">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/futura-pt">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/bauhaus-93">
  <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/national-park">${customFontLinks(customFonts)}
  <style>${customFontFaces(customFonts)}
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 400; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunrm.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: normal; font-weight: 700; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunbx.woff")}') format('woff'); }
    @font-face { font-family: 'Latin Modern Roman'; font-style: italic; font-weight: 400; src: url('${(0, import_libraries3.libUrl)("latex.js", "dist/fonts/Serif/cmunti.woff")}') format('woff'); }
  </style>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #000; }
    /* Override reveal.js theme CSS variables to match editor */
    :root { --r-main-font-size: 42px; --r-block-margin: 0px; --r-heading-margin: 0 0 0.4em 0; --r-heading-text-transform: none; --r-heading-letter-spacing: normal; }
    /* Reset reveal.js section padding/alignment so absolute positions match the editor canvas exactly */
    .reveal .slides section { padding: 0 !important; text-align: left !important; overflow: hidden !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.4 !important; text-transform: none; letter-spacing: normal; }
    .reveal .slides section > * { overflow: hidden; }
    /* Override ALL theme element styles to match TipTap editor exactly */
    .reveal p { margin: 0 0 0.4em !important; }
    .reveal h1, .reveal h2, .reveal h3, .reveal h4, .reveal h5, .reveal h6 { margin: 0 0 0.4em !important; text-transform: none !important; letter-spacing: normal !important; text-shadow: none !important; }
    .reveal h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; }
    .reveal h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; }
    .reveal h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; }
    .reveal h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; }
    .reveal ul, .reveal ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .reveal li { margin-bottom: 0.2em; line-height: inherit; }
    .reveal span { line-height: inherit; }
    .reveal a { text-decoration: underline; }
    .reveal img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    .reveal code { background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 3px; font-family: monospace; }
    .reveal pre { background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 6px; margin: 0 0 0.4em !important; overflow: auto; width: auto !important; box-shadow: none !important; }
    .reveal pre code { background: none; padding: 0; }
    .reveal blockquote { border-left: 3px solid rgba(255,255,255,0.3); padding-left: 16px; opacity: 0.8; margin: 0 0 0.4em !important; width: auto !important; box-shadow: none !important; font-style: normal; }
    /* Footer — explicit CSS rule with high specificity so reveal.js theme cannot override */
    /* color only on the container so per-span inline colors (inactive sections) are not overridden */
    .reveal .slides section .reveal-footer { color: ${footerColor} !important; }
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; }
    #fs-btn {
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      background: rgba(0,0,0,0.5); color: white; border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 13px;
      backdrop-filter: blur(4px); transition: background 0.15s;
    }
    #fs-btn:hover { background: rgba(0,0,0,0.75); }
    :fullscreen #fs-btn, :-webkit-full-screen #fs-btn { display: none; }
    [data-expand] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-expand]:hover { outline-color:rgba(99,102,241,0.6); box-shadow:0 0 16px rgba(99,102,241,0.25); }
    .expand-overlay { position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s; }
    .expand-overlay.active { opacity:1; }
    .expand-overlay img { max-width:90vw;max-height:90vh;object-fit:contain;cursor:default;border-radius:4px; }
    .image-popup { position:fixed;z-index:10001;background:rgba(20,20,30,0.95);color:#fff;padding:12px 18px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.5;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);opacity:0;transition:opacity 0.2s;white-space:pre-wrap;pointer-events:auto; }
    .image-popup.active { opacity:1; }
    [data-popup] { transition:box-shadow 0.2s, outline 0.2s; outline:2px solid transparent; outline-offset:2px; }
    [data-popup]:hover { outline-color:rgba(251,191,36,0.5); box-shadow:0 0 12px rgba(251,191,36,0.2); }${CLICK_ACTION_CSS}${statesCss(presentation.slides)}${scrollingDeck ? SCROLLING_CSS : ""}${hasCitationMarkers(presentation) ? CITATION_CSS : ""}
    .image-caption { position:absolute;left:0;right:0;top:100%;font-size:${Number(presentation.citationFontSize) || 10}px;color:rgba(255,255,255,0.5);font-family:${cssValue(presentation.citationFontFamily) || "-apple-system,sans-serif"};line-height:1.3;padding:3px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .image-caption a { color:rgba(255,255,255,0.5);text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25); }
    .cite-sup { position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);color:rgba(255,255,255,0.85);font-size:10px;font-weight:700;font-family:-apple-system,sans-serif;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none;line-height:1; }
    .slide-citations { position:absolute;right:2px;top:0;bottom:0;z-index:890;display:flex;align-items:center;pointer-events:none; }
    .slide-citations-text { writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;line-height:1.3;white-space:nowrap; }
    .slide-citations-text a { color:rgba(255,255,255,0.45);text-decoration:underline; }
    /* Ensure fragments stay hidden until triggered */
    .reveal .slides section .fragment:not(.visible):not(.current-fragment) { opacity: 0 !important; visibility: hidden !important; }
    /* Custom fragment animations */
    .fragment.slide-up { transform:translateY(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-down { transform:translateY(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-left { transform:translateX(40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-right { transform:translateX(-40px); transition:transform 0.5s ease, opacity 0.5s ease; }
    .fragment.slide-up,.fragment.slide-down,.fragment.slide-left,.fragment.slide-right { opacity:0; }
    .fragment.slide-up.visible,.fragment.slide-down.visible,.fragment.slide-left.visible,.fragment.slide-right.visible { transform:none; opacity:1; }
    .fragment.flip-up { transform:perspective(600px) rotateX(90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-down { transform:perspective(600px) rotateX(-90deg); opacity:0; transition:transform 0.6s ease, opacity 0.3s ease; }
    .fragment.flip-up.visible,.fragment.flip-down.visible { transform:none; opacity:1; }
    /* Laser pointer / spotlight */
    #laser-dot { position:fixed;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle,#ff0000 0%,#ff0000 60%,rgba(255,0,0,0.4) 100%);box-shadow:0 0 8px 2px rgba(255,0,0,0.6);pointer-events:none;z-index:99999;display:none;transform:translate(-50%,-50%); }
    #spotlight-overlay { position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:99998;display:none; }
    /* Slide overview panel */
    #overview-toggle { position:fixed;top:16px;left:16px;z-index:9999;background:rgba(0,0,0,0.5);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px;backdrop-filter:blur(4px);transition:background 0.15s; }
    #overview-toggle:hover { background:rgba(0,0,0,0.75); }
    :fullscreen #overview-toggle, :-webkit-full-screen #overview-toggle { display:none; }
    #overview-panel { position:fixed;top:0;left:0;bottom:0;z-index:9998;background:rgba(15,15,25,0.95);backdrop-filter:blur(8px);border-right:1px solid rgba(255,255,255,0.1);transform:translateX(-100%);transition:transform 0.25s ease;overflow:hidden;display:flex;flex-direction:column; }
    #overview-panel.open { transform:translateX(0); }
    #overview-panel .ov-header { padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.5);font-family:-apple-system,sans-serif;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between; }
    #overview-panel .ov-body { flex:1;overflow:auto;padding:10px; }
    #overview-panel .ov-body.linear { display:flex;flex-direction:column;gap:8px;width:180px; }
    #overview-panel .ov-body.sections { display:flex;flex-direction:row;gap:16px;min-width:min-content;padding:10px 14px; }
    #overview-panel .ov-section-col { display:flex;flex-direction:column;gap:8px;min-width:140px; }
    #overview-panel .ov-section-label { font-size:10px;color:rgba(255,255,255,0.45);font-family:-apple-system,sans-serif;text-transform:uppercase;letter-spacing:0.04em;padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px;white-space:nowrap; }
    #overview-panel .ov-thumb { position:relative;border-radius:4px;overflow:hidden;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s,box-shadow 0.15s;flex-shrink:0; }
    #overview-panel .ov-thumb:hover { border-color:rgba(99,102,241,0.5);box-shadow:0 0 8px rgba(99,102,241,0.2); }
    #overview-panel .ov-thumb.active { border-color:rgba(99,102,241,0.9);box-shadow:0 0 12px rgba(99,102,241,0.35); }
    #overview-panel .ov-thumb-num { position:absolute;top:3px;left:3px;font-size:9px;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.6);padding:1px 4px;border-radius:3px;font-family:-apple-system,sans-serif;z-index:2; }
  </style>${presentation.customCSS ? `
  <style>
${sanitizeCustomCSS(presentation.customCSS)}
  </style>` : ""}
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  <button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6; Fullscreen</button>
  <button id="overview-toggle" title="Slide overview (G)">&#x25A6; Overview</button>
  <div id="overview-panel"><div class="ov-header"><span>Slides</span><span id="ov-count"></span></div><div class="ov-body ${sanitizeAttr(presentation.overviewLayout || "linear")}" id="ov-body"></div></div>
  <div id="laser-dot"></div>
  <canvas id="spotlight-overlay"></canvas>
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "dist/reveal.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "plugin/notes/notes.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("reveal.js", "plugin/highlight/highlight.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("katex", "dist/katex.min.js")}"></script>
  <script src="${(0, import_libraries3.libUrl)("katex", "dist/contrib/mhchem.min.js")}"></script>
  <script>
    var _customTransitions = ['differential-rotation'];
    var _globalTransition = ${scriptValue(presentation.transition || "slide")};
    var _isGlobalCustom = _customTransitions.indexOf(_globalTransition) !== -1;
    Reveal.initialize({
      hash: true,
      width: ${slideW},
      height: ${slideH},
      margin: 0,
      minScale: 0,
      maxScale: 10,
      center: false,
      transition: _isGlobalCustom ? 'none' : _globalTransition,
      autoAnimateStyles: ['opacity', 'color', 'background-color', 'padding', 'font-size', 'line-height', 'letter-spacing', 'border-width', 'border-color', 'border-radius', 'outline', 'outline-offset', 'rotate'],
      plugins: [ RevealNotes, RevealHighlight ]
    });
    Reveal.on('ready', function() {
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try {
          katex.render(el.getAttribute('data-math-latex'), el, {
            displayMode: el.getAttribute('data-math-display') === 'true',
            throwOnError: false
          });
        } catch(e) {}
      });
      document.querySelectorAll('[data-latex-block]').forEach(function(el) {
        try {
          var target = el.querySelector('.katex-block') || el;
          katex.render(el.getAttribute('data-latex-block'), target, {
            displayMode: true,
            throwOnError: false
          });
        } catch(e) {
          var target = el.querySelector('.katex-block') || el;
          target.textContent = e.message;
          target.style.color = '#f87171';
        }
      });
    });

    // ── Element entry animations ──────────────────────────────────────────────
    // Web Animations on translate, scale and opacity, from each preset's start
    // to the element's own style: its rotation, and anything else set on it,
    // stays as it is, and nothing is left on the element afterwards.
    var OUT2 = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', OUT3 = 'cubic-bezier(0.215, 0.61, 0.355, 1)', BACK = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    var ENTRY_PRESETS = {
      fadeIn:     [OUT2, { opacity: 0 }],
      fadeUp:     [OUT3, { opacity: 0, translate: '0 48px' }],
      fadeDown:   [OUT3, { opacity: 0, translate: '0 -48px' }],
      fadeLeft:   [OUT3, { opacity: 0, translate: '48px 0' }],
      fadeRight:  [OUT3, { opacity: 0, translate: '-48px 0' }],
      zoomIn:     [BACK, { opacity: 0, scale: '0.7' }],
      zoomOut:    [OUT2, { opacity: 0, scale: '1.3' }],
      slideUp:    [OUT3, { translate: '0 560px' }],
      slideDown:  [OUT3, { translate: '0 -560px' }],
      slideLeft:  [OUT3, { translate: '980px 0' }],
      slideRight: [OUT3, { translate: '-980px 0' }],
      flipX:      [OUT2, { opacity: 0, transform: 'perspective(600px) rotateX(90deg)' }, { transform: 'perspective(600px) rotateX(0deg)' }],
      flipY:      [OUT2, { opacity: 0, transform: 'perspective(600px) rotateY(90deg)' }, { transform: 'perspective(600px) rotateY(0deg)' }],
    };
    function runSlideAnimations(slide) {
      if (!slide) return;
      slide.querySelectorAll('[data-gsap-enter]').forEach(function(el) {
        var preset = ENTRY_PRESETS[el.getAttribute('data-gsap-enter')];
        if (!preset || !el.animate) return;
        var from = Object.assign({ offset: 0 }, preset[1]);
        if (el._entry) el._entry.cancel();
        el._entry = el.animate(preset[2] ? [from, preset[2]] : [from], {
          duration: parseFloat(el.getAttribute('data-gsap-duration') || 600),
          delay: parseFloat(el.getAttribute('data-gsap-delay') || 0),
          easing: preset[0],
          fill: 'backwards',
        });
      });
    }
    Reveal.on('ready',        function(e) { runSlideAnimations(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { runSlideAnimations(e.currentSlide); });

    // Dispatch resize into HTML/p5 iframes when their slide becomes active,
    // so D3 figures that use window.addEventListener('resize', ...) re-render.
    function notifyIframes(slide) {
      if (!slide) return;
      slide.querySelectorAll('iframe').forEach(function(fr) {
        try { fr.contentWindow.dispatchEvent(new Event('resize')); }
        catch(ex) { try { fr.contentWindow.postMessage('parallax-resize', '*'); } catch(ex2) {} }
      });
    }
    Reveal.on('ready',        function(e) { notifyIframes(e.currentSlide); });
    Reveal.on('slidechanged', function(e) { notifyIframes(e.currentSlide); });

    // ── Custom transitions (differential rotation) ───────────────────────
    (function() {
      var prevH = 0, prevV = 0;
      Reveal.on('ready', function(e) { prevH = e.indexh || 0; prevV = e.indexv || 0; });
      Reveal.on('slidechanged', function(e) {
        var prev = e.previousSlide;
        var transName = null;
        if (prev && prev.getAttribute('data-custom-transition'))
          transName = prev.getAttribute('data-custom-transition');
        else if (_isGlobalCustom)
          transName = _globalTransition;
        var dir = 1;
        if ((e.indexh || 0) < prevH || ((e.indexh || 0) === prevH && (e.indexv || 0) < prevV)) dir = -1;
        prevH = e.indexh || 0;
        prevV = e.indexv || 0;
        if (transName === 'differential-rotation') drTransition(dir);
      });
      function drTransition(dir) {
        var N = 16;
        var vw = window.innerWidth, vh = window.innerHeight;
        var bh = vh / N;
        var BAUHAUS = ['#CC0000', '#003399', '#FFCC00'];
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9998;pointer-events:none;overflow:hidden;';
        var pending = N;
        for (var i = 0; i < N; i++) {
          var band = document.createElement('div');
          band.style.cssText = 'position:absolute;left:0;width:100%;background:#000;box-sizing:border-box;';
          band.style.top = (i * bh) + 'px';
          band.style.height = (bh + 0.5) + 'px';
          if (i < N - 1) {
            band.style.borderBottom = '1.5px solid ' + BAUHAUS[i % 3];
          }
          overlay.appendChild(band);
          var lat = Math.PI * ((i + 0.5) / N - 0.5);
          var cos2 = Math.cos(lat); cos2 = cos2 * cos2;
          var dur = 0.4 + 1.0 * (1 - cos2);
          band.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (dir * (vw + 20)) + 'px)' }], {
            duration: dur * 1000, easing: 'linear', fill: 'forwards'
          }).onfinish = function() { pending--; if (pending <= 0) overlay.remove(); };
        }
        document.body.appendChild(overlay);
      }
    })();

    // ── Image click interactions (popup + expand) ─────────────────────
    (function() {
      function dismissAll() {
        var p = document.querySelector('.image-popup');
        if (p) { p.classList.remove('active'); setTimeout(function() { p.remove(); }, 200); }
        var ov = document.querySelector('.expand-overlay');
        if (ov) { ov.classList.remove('active'); setTimeout(function() { ov.remove(); }, 200); }
      }
      function showPopup(el, anchor) {
        var old = document.querySelector('.image-popup');
        if (old) old.remove();
        var text = el.getAttribute('data-popup');
        var pos = el.getAttribute('data-popup-pos') || 'below';
        var fs = el.getAttribute('data-popup-fs') || '15';
        var rect = anchor.getBoundingClientRect();
        var p = document.createElement('div');
        p.className = 'image-popup';
        p.textContent = text;
        p.style.fontSize = fs + 'px';
        if (pos === 'center') {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.top + rect.height/2) + 'px';
          p.style.transform = 'translate(-50%,-50%)';
        } else if (pos === 'side') {
          p.style.top = (rect.top + rect.height/2) + 'px';
          if (rect.right + 320 < window.innerWidth) {
            p.style.left = (rect.right + 12) + 'px';
            p.style.transform = 'translateY(-50%)';
          } else {
            p.style.left = (rect.left - 12) + 'px';
            p.style.transform = 'translate(-100%,-50%)';
          }
        } else {
          p.style.left = (rect.left + rect.width/2) + 'px';
          p.style.top = (rect.bottom + 12) + 'px';
          p.style.transform = 'translateX(-50%)';
        }
        document.body.appendChild(p);
        requestAnimationFrame(function() { p.classList.add('active'); });
      }
      document.addEventListener('click', function(e) {
        if (e.target.closest('.image-popup')) return;
        var ov = e.target.closest('.expand-overlay');
        if (ov) {
          if (e.target.tagName === 'IMG') return;
          dismissAll(); return;
        }
        var el = e.target.closest('[data-popup],[data-expand]');
        if (!el) { dismissAll(); return; }
        e.stopPropagation();
        dismissAll();
        var hasPopup = el.hasAttribute('data-popup');
        var hasExpand = el.hasAttribute('data-expand');
        var img = el.querySelector('img');
        if (hasExpand && img) {
          var overlay = document.createElement('div');
          overlay.className = 'expand-overlay';
          var big = document.createElement('img');
          big.src = img.src;
          big.onclick = function(ev) { ev.stopPropagation(); };
          overlay.appendChild(big);
          document.body.appendChild(overlay);
          requestAnimationFrame(function() {
            overlay.classList.add('active');
            if (hasPopup) showPopup(el, big);
          });
        } else if (hasPopup) {
          showPopup(el, el);
        }
      });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape') dismissAll(); });
    })();
${CLICK_ACTION_SCRIPT}${scrollingDeck ? SCROLLING_SCRIPT : ""}${hasGraphs(presentation) ? GRAPH_DECK_SCRIPT : ""}${hasEquations(presentation) ? equationDeckScript() : ""}${hasFeynman(presentation) || hasCircuits(presentation) || hasLogic(presentation) || hasFreebody(presentation) || hasVenn(presentation) || hasTiming(presentation) ? diagramDeckScript() : ""}${hasPeriodic(presentation) ? periodicDeckScript() : ""}${(presentation.slides || []).some((s) => (s.elements || []).some((el) => el.type === "graph" || el.type === "model" || el.type === "molecule")) ? EMBED_SCALE_SCRIPT : ""}

${(() => {
    const overviewLayout = presentation.overviewLayout || "linear";
    const colsData = columns.map((colSlides, h) => colSlides.map((slide, v) => {
      const flatIdx = presentation.slides.indexOf(slide);
      return { h, v, flatIdx, section: slide.section || "" };
    }));
    const flatSlides = colsData.flat();
    return `
    // ── Slide overview panel ──────────────────────────────────────────
    (function() {
      var LAYOUT = ${scriptValue(overviewLayout)};
      var SLIDES = ${scriptValue(flatSlides)};
      var panel = document.getElementById('overview-panel');
      var body = document.getElementById('ov-body');
      var toggle = document.getElementById('overview-toggle');
      var countEl = document.getElementById('ov-count');
      var thumbs = [];
      var THUMB_W = LAYOUT === 'sections' ? 130 : 150;
      var slideW = ${slideW}, slideH = ${slideH};
      var thumbH = Math.round(THUMB_W * slideH / slideW);
      var isOpen = false;

      countEl.textContent = SLIDES.length;

      function buildThumbnails() {
        var allSections = document.querySelectorAll('.reveal .slides > section');
        var slideEls = [];
        allSections.forEach(function(sec) {
          var nested = sec.querySelectorAll(':scope > section');
          if (nested.length > 0) {
            nested.forEach(function(s) { slideEls.push(s); });
          } else {
            slideEls.push(sec);
          }
        });

        if (LAYOUT === 'sections') {
          var groups = {};
          var order = [];
          SLIDES.forEach(function(s, i) {
            var key = s.section || '(No Section)';
            if (!groups[key]) { groups[key] = []; order.push(key); }
            groups[key].push({ meta: s, idx: i, el: slideEls[i] });
          });
          order.forEach(function(key) {
            var col = document.createElement('div');
            col.className = 'ov-section-col';
            var label = document.createElement('div');
            label.className = 'ov-section-label';
            label.textContent = key;
            col.appendChild(label);
            groups[key].forEach(function(item) {
              col.appendChild(makeThumb(item.meta, item.idx, item.el));
            });
            body.appendChild(col);
          });
        } else {
          SLIDES.forEach(function(s, i) {
            body.appendChild(makeThumb(s, i, slideEls[i]));
          });
        }
      }

      function makeThumb(meta, idx, srcEl) {
        var wrap = document.createElement('div');
        wrap.className = 'ov-thumb';
        wrap.style.width = THUMB_W + 'px';
        wrap.style.height = thumbH + 'px';
        var num = document.createElement('div');
        num.className = 'ov-thumb-num';
        num.textContent = idx + 1;
        wrap.appendChild(num);
        if (srcEl) {
          var clone = srcEl.cloneNode(true);
          // A picture only: its clickable and hoverable copies can't be tabbed to
          clone.setAttribute('inert', '');
          clone.setAttribute('aria-hidden', 'true');
          clone.style.cssText = 'position:absolute;top:0;left:0;width:' + slideW + 'px;height:' + slideH + 'px;transform:scale(' + (THUMB_W/slideW) + ');transform-origin:top left;pointer-events:none;overflow:hidden;';
          clone.querySelectorAll('.reveal-footer').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('iframe').forEach(function(f) { f.remove(); });
          clone.querySelectorAll('video').forEach(function(v) { v.pause(); v.removeAttribute('autoplay'); });
          wrap.appendChild(clone);
        } else {
          wrap.style.background = 'rgba(30,30,46,0.8)';
        }
        wrap.onclick = function() { Reveal.slide(meta.h, meta.v); updateActive(); };
        thumbs.push({ el: wrap, h: meta.h, v: meta.v });
        return wrap;
      }

      function updateActive() {
        var state = Reveal.getIndices();
        thumbs.forEach(function(t) {
          if (t.h === state.h && t.v === state.v) t.el.classList.add('active');
          else t.el.classList.remove('active');
        });
        var active = body.querySelector('.ov-thumb.active');
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }

      function togglePanel() {
        isOpen = !isOpen;
        if (isOpen) panel.classList.add('open');
        else panel.classList.remove('open');
      }

      toggle.onclick = togglePanel;
      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); togglePanel(); }
      });

      Reveal.on('ready', function() { buildThumbnails(); updateActive(); });
      Reveal.on('slidechanged', function() { updateActive(); });
    })();
`;
  })()}
${laserPointer !== "off" ? `
    // ── Laser pointer / spotlight ────────────────────────────────────
    (function() {
      var mode = ${scriptValue(laserPointer)};
      var active = false;
      var dot = document.getElementById('laser-dot');
      var canvas = document.getElementById('spotlight-overlay');
      var ctx = canvas.getContext('2d');
      var mx = 0, my = 0;

      function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; if (active && mode === 'spotlight') drawSpotlight(); }
      window.addEventListener('resize', resize);
      resize();

      function drawSpotlight() {
        var w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        var grad = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.9)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      document.addEventListener('mousemove', function(e) {
        mx = e.clientX; my = e.clientY;
        if (!active) return;
        if (mode === 'dot') { dot.style.left = mx + 'px'; dot.style.top = my + 'px'; }
        else { drawSpotlight(); }
      });

      document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          active = !active;
          if (mode === 'dot') { dot.style.display = active ? 'block' : 'none'; }
          else { canvas.style.display = active ? 'block' : 'none'; if (active) drawSpotlight(); }
        }
      });
    })();
` : ""}
${showTimeWidget ? `
    // Time widget (clock or timer)
    (function() {
      var mode = ${scriptValue(footerTimeMode)};
      var timerDur = ${timerDuration} * 60;
      var timerStart = Date.now();
      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      function fmt() {
        if (mode === 'clock12') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        if (mode === 'clock24') return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        var elapsed = Math.floor((Date.now() - timerStart) / 1000);
        var secs = mode === 'timer-down' ? Math.max(0, timerDur - elapsed) : elapsed;
        var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
      }
      function update() { document.querySelectorAll('.reveal-time-widget').forEach(function(el) { el.textContent = fmt(); }); }
      update();
      setInterval(update, 1000);
    })();
` : ""}
  </script>
${opts.annotate ? annotationScript(presentation, opts.annotate.set) : ""}
${opts.bridge ? DECK_BRIDGE_SCRIPT : ""}
</body>
</html>`;
}
function annotationScript(presentation, set) {
  const config = {
    set,
    message: ANNOTATION_MESSAGE,
    origin: globalThis.location?.origin || "*",
    slideW: presentation.slideWidth || 960,
    slideH: presentation.slideHeight || 540
  };
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `  <script>
  (function () {
    var start = function () { (${installAnnotations.toString()})(${json}) }
    if (Reveal.isReady()) start(); else Reveal.on('ready', start)
  })()
  </script>`;
}
function getBackgroundAttrs(bg) {
  if (!bg) return "";
  if (bg.type === "color" && bg.color) return ` data-background-color="${sanitizeAttr(bg.color)}"`;
  if (bg.type === "image" && bg.image) return ` data-background-image="${absoluteSrc(sanitizeUrl(bg.image))}" data-background-size="${sanitizeAttr(bg.size || "cover")}" data-background-position="${sanitizeAttr(bg.position || "center")}"`;
  if (bg.type === "gradient" && bg.gradient) return ` data-background-gradient="${sanitizeAttr(bg.gradient)}"`;
  return "";
}
function escapeHtml(str7) {
  return String(str7).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
var scriptValue = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
var DECK_BRIDGE_SCRIPT = `  <script>
  (function () {
    function send() {
      window.parent.postMessage({ type: 'parallax-deck', slide: Reveal.getSlides().indexOf(Reveal.getCurrentSlide()), total: Reveal.getTotalSlides() }, '*');
    }
    window.addEventListener('message', function (e) {
      if (e.source !== window.parent || !e.data || e.data.type !== 'parallax-deck-go') return;
      var s = Reveal.getSlides()[e.data.slide];
      if (s) { var i = Reveal.getIndices(s); Reveal.slide(i.h, i.v); }
    });
    if (Reveal.isReady()) send(); else Reveal.on('ready', send);
    Reveal.on('slidechanged', send);
  })()
  </script>`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  generateRevealHTML
});
