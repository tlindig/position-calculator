(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/position-calculator.js
  var require_position_calculator = __commonJS({
    "src/position-calculator.js"(exports, module) {
      (function(factory) {
        if (typeof define === "function" && define.amd) {
          define("position-calculator", ["jquery"], factory);
        } else if (typeof module === "object" && module.exports) {
          module.exports = factory;
        } else {
          jQuery.PositionCalculator = factory(jQuery);
        }
      })(function($) {
        "use strict";
        var __window = window;
        var __document = document;
        var __docElement = __document.documentElement;
        var __rgx_vertical = /top|middle|bottom/;
        var __rgx_horizontal = /left|center|right/;
        var __rgx_percent = /%$/;
        var __mirror = {
          left: "right",
          center: "center",
          right: "left",
          top: "bottom",
          middle: "middle",
          bottom: "top"
        };
        function __normalizeSlector(selector) {
          if (typeof selector === "string") {
            if (selector === "window") {
              selector = __window;
            } else if (selector === "document") {
              selector = __document;
            }
          }
          return selector;
        }
        function __normalizeAt(ref) {
          var values = ref.split(" ");
          return {
            y: __rgx_vertical.test(values[0]) ? values[0] : "top",
            x: __rgx_horizontal.test(values[1]) ? values[1] : "left"
          };
        }
        function __isEqualNormPos(normPos1, normPos2) {
          if (normPos1 === normPos2) {
            return true;
          }
          if (!normPos1 || !normPos2) {
            return false;
          }
          return normPos1.top === normPos2.top && normPos1.left === normPos2.left && normPos1.height === normPos2.height && normPos1.width === normPos2.width;
        }
        function __nomrmalizePosition($el) {
          var raw = $el[0];
          if (raw.nodeType === 9) {
            return {
              width: $el.outerWidth(),
              height: $el.outerHeight(),
              top: 0,
              left: 0
            };
          }
          if ($.isWindow(raw)) {
            return {
              width: $el.outerWidth(),
              height: $el.outerHeight(),
              top: $el.scrollTop(),
              left: $el.scrollLeft()
            };
          }
          if (raw.preventDefault) {
            return {
              width: 0,
              height: 0,
              top: raw.pageY,
              left: raw.pageX
            };
          }
          var offset = $el.offset();
          return {
            width: $el.outerWidth(),
            height: $el.outerHeight(),
            top: offset.top,
            left: offset.left
          };
        }
        function __refreshPosition($el, normPos) {
          var raw = $el[0];
          if (raw.nodeType === 9) {
            return;
          }
          if ($.isWindow(raw)) {
            normPos.top = $el.scrollTop();
            normPos.left = $el.scrollLeft();
          }
          if (raw.preventDefault) {
            normPos.top = raw.pageY;
            normPos.left = raw.pageX;
            return;
          }
          var offset = $el.offset();
          normPos.top = offset.top;
          normPos.left = offset.left;
          return;
        }
        function __normalizeBounding($el) {
          var domElm = $el[0];
          var offset;
          if (domElm.nodeType === 9) {
            domElm = __docElement;
            offset = {
              top: 0,
              left: 0
            };
          } else if ($.isWindow(domElm)) {
            domElm = __docElement;
            offset = {
              top: $el.scrollTop(),
              left: $el.scrollLeft()
            };
          } else {
            offset = $el.offset();
          }
          return {
            width: domElm.clientWidth,
            height: domElm.clientHeight,
            top: offset.top + domElm.clientTop,
            left: offset.left + domElm.clientLeft
          };
        }
        function __refreshBounding($el, normPos) {
          var domElm = $el[0];
          var offset;
          if (domElm.nodeType === 9) {
            domElm = __docElement;
            offset = {
              top: 0,
              left: 0
            };
          } else if ($.isWindow(domElm)) {
            domElm = __docElement;
            offset = {
              top: $el.scrollTop(),
              left: $el.scrollLeft()
            };
          } else {
            offset = $el.offset();
          }
          normPos.top = offset.top + domElm.clientTop;
          normPos.left = offset.left + domElm.clientLeft;
          return;
        }
        function __normalizeExtraOffset(offset, size) {
          return {
            y: parseFloat(offset.y) * (__rgx_percent.test(offset.y) ? size.height / 100 : 1),
            x: parseFloat(offset.x) * (__rgx_percent.test(offset.x) ? size.width / 100 : 1),
            mirror: offset.mirror
          };
        }
        function __calculateRefpointOffsets(pos, extraOffsets, initialRefpoint) {
          var result = {
            top: 0,
            left: 0,
            middle: pos.height * 0.5,
            center: pos.width * 0.5,
            bottom: pos.height,
            right: pos.width
          };
          if (extraOffsets.y !== 0) {
            result.middle += extraOffsets.y;
            if (extraOffsets.mirror) {
              result.top += "top" !== initialRefpoint.y ? extraOffsets.y * -1 : extraOffsets.y;
              result.bottom += "bottom" !== initialRefpoint.y ? extraOffsets.y * -1 : extraOffsets.y;
            } else {
              result.top += extraOffsets.y;
              result.bottom += extraOffsets.y;
            }
          }
          if (extraOffsets.x !== 0) {
            result.center += extraOffsets.x;
            if (extraOffsets.mirror) {
              result.left += "left" !== initialRefpoint.x ? extraOffsets.x * -1 : extraOffsets.x;
              result.right += "right" !== initialRefpoint.x ? extraOffsets.x * -1 : extraOffsets.x;
            } else {
              result.left += extraOffsets.x;
              result.right += extraOffsets.x;
            }
          }
          return result;
        }
        function __updateOverflow(distance) {
          var overflow = [];
          distance.top > 0 && overflow.push("top");
          distance.left > 0 && overflow.push("left");
          distance.bottom < 0 && overflow.push("bottom");
          distance.right < 0 && overflow.push("right");
          if (overflow.length) {
            distance.overflow = overflow;
          } else {
            distance.overflow = null;
          }
          return distance;
        }
        function __calulateDistance(bou_Pos, item_Pos) {
          var result = {
            top: bou_Pos.top - item_Pos.top,
            left: bou_Pos.left - item_Pos.left,
            bottom: bou_Pos.top + bou_Pos.height - (item_Pos.top + item_Pos.height),
            right: bou_Pos.left + bou_Pos.width - (item_Pos.left + item_Pos.width),
            overflow: []
          };
          return __updateOverflow(result);
        }
        function __flipPlacement(flip, itemAt, tarAt, distance) {
          var y_overflowEdge, x_overflowEdge, flipBits;
          var item_flipedAt = {
            y: itemAt.y,
            x: itemAt.x
          };
          var tar_flipedAt = {
            y: tarAt.y,
            x: tarAt.x
          };
          if (distance.overflow.indexOf("top") !== -1) {
            y_overflowEdge = "top";
          }
          if (distance.overflow.indexOf("bottom") !== -1) {
            if (y_overflowEdge) {
              y_overflowEdge = null;
            } else {
              y_overflowEdge = "bottom";
            }
          }
          if (distance.overflow.indexOf("left") !== -1) {
            x_overflowEdge = "left";
          }
          if (distance.overflow.indexOf("right") !== -1) {
            if (x_overflowEdge) {
              x_overflowEdge = null;
            } else {
              x_overflowEdge = "right";
            }
          }
          if (!y_overflowEdge && !x_overflowEdge) {
            return null;
          }
          flip = flip === true ? "both" : flip;
          flipBits = 0;
          switch (flip) {
            case "item":
              flipBits = 1;
              break;
            case "target":
              flipBits = 2;
              break;
            case "both":
              flipBits = 3;
              break;
          }
          if (flipBits & 1) {
            y_overflowEdge && (item_flipedAt.y = __mirror[item_flipedAt.y]);
            x_overflowEdge && (item_flipedAt.x = __mirror[item_flipedAt.x]);
          }
          if (flipBits & 2) {
            y_overflowEdge && (tar_flipedAt.y = __mirror[tar_flipedAt.y]);
            x_overflowEdge && (tar_flipedAt.x = __mirror[tar_flipedAt.x]);
          }
          return {
            item_at: item_flipedAt,
            tar_at: tar_flipedAt
          };
        }
        function __overflowLT(distanceA, distanceB, isY) {
          var a1, a2, b1, b2, edges;
          if (isY) {
            edges = ["top", "bottom"];
          } else {
            edges = ["left", "right"];
          }
          a1 = distanceA[edges[0]];
          b1 = distanceB[edges[0]];
          a2 = distanceA[edges[1]] * -1;
          b2 = distanceB[edges[1]] * -1;
          a1 < 0 && (a1 = 0);
          a2 < 0 && (a2 = 0);
          b1 < 0 && (b1 = 0);
          b2 < 0 && (b2 = 0);
          if (a1 < 0 && a2 < 0) {
            return true;
          }
          if (b1 < 0 && b2 < 0) {
            return false;
          }
          return a1 + a2 < b1 + b2;
        }
        function __adaptSticking(data, edges) {
          if (edges === "all") {
            edges = true;
          }
          var overflow = data.distance.overflow;
          if (!overflow.length) {
            return data;
          }
          var skipX = false;
          var skipY = false;
          var edge, diff;
          for (var i = overflow.length - 1; i >= 0; i--) {
            edge = overflow[i];
            switch (edge) {
              case "top":
              case "bottom":
                if (!skipY && edges === true || edges.indexOf(edge) !== -1) {
                  diff = data.distance[edge];
                  data.moveBy.y += diff;
                  data.distance.top -= diff;
                  data.distance.bottom -= diff;
                  skipY = true;
                }
                break;
              case "left":
              case "right":
                if (!skipX && edges === true || edges.indexOf(edge) !== -1) {
                  diff = data.distance[edge];
                  data.moveBy.x += diff;
                  data.distance.left -= diff;
                  data.distance.right -= diff;
                  skipX = true;
                }
                break;
            }
          }
          __updateOverflow(data.distance);
          return data;
        }
        function PositionCalculator(options) {
          if (!(this instanceof PositionCalculator)) {
            return new PositionCalculator(options);
          }
          this.options = this.$itm = this.$trg = this.$bnd = this.itmAt = this.trgAt = this.itmPos = this.trgPos = this.bndPos = this.itmOffset = this.trgOffset = null;
          this._init(options);
        }
        PositionCalculator.prototype._init = function(options) {
          var o = this.options = $.extend({}, PositionCalculator.defaults, options);
          if (!o.item) {
            return null;
          }
          this.$itm = o.item.jquery ? o.item : $(o.item);
          if (this.$itm.length === 0) {
            return null;
          }
          this.$trg = o.target && o.target.jquery ? o.target : $(__normalizeSlector(o.target));
          this.$bnd = o.boundary && o.boundary.jquery ? o.boundary : $(__normalizeSlector(o.boundary));
          this.itmAt = __normalizeAt(o.itemAt);
          this.trgAt = __normalizeAt(o.targetAt);
          this.resize();
          return this;
        };
        PositionCalculator.prototype.resize = function() {
          var o = this.options;
          var item_pos = __nomrmalizePosition(this.$itm);
          var targ_pos = this.$trg.length ? __nomrmalizePosition(this.$trg) : null;
          this.bndPos = this.$bnd.length ? __normalizeBounding(this.$bnd) : null;
          if (!this.itmPos || !__isEqualNormPos(item_pos, this.itmPos)) {
            this.itmPos = item_pos;
            var item_extraOffset = __normalizeExtraOffset(o.itemOffset, item_pos);
            item_extraOffset.x = item_extraOffset.x * -1;
            item_extraOffset.y = item_extraOffset.y * -1;
            this.itmOffset = __calculateRefpointOffsets(
              item_pos,
              item_extraOffset,
              this.itmAt
            );
          }
          if (!this.trgPos || !__isEqualNormPos(targ_pos, this.trgPos)) {
            this.trgPos = targ_pos;
            if (targ_pos) {
              this.trgOffset = __calculateRefpointOffsets(
                targ_pos,
                __normalizeExtraOffset(o.targetOffset, targ_pos),
                this.trgAt
              );
            }
          }
          return this;
        };
        PositionCalculator.prototype.calcVariant = function(item_at, tar_at) {
          var result = {
            moveBy: null,
            distance: null,
            itemAt: null,
            targetAt: null
          };
          if (this.trgPos && item_at && tar_at) {
            var tar_refpoint = {
              top: this.trgPos.top + this.trgOffset[tar_at.y],
              left: this.trgPos.left + this.trgOffset[tar_at.x]
            };
            var item_newPos = {
              top: tar_refpoint.top - this.itmOffset[item_at.y],
              left: tar_refpoint.left - this.itmOffset[item_at.x],
              height: this.itmPos.height,
              width: this.itmPos.width
            };
            result.moveBy = {
              y: item_newPos.top - this.itmPos.top,
              x: item_newPos.left - this.itmPos.left
            };
            result.distance = this.bndPos ? __calulateDistance(this.bndPos, item_newPos) : null;
            result.itemAt = item_at.y + " " + item_at.x;
            result.targetAt = tar_at.y + " " + tar_at.x;
          } else {
            result.moveBy = { y: 0, x: 0 };
            result.distance = this.bndPos ? __calulateDistance(this.bndPos, this.itmPos) : null;
          }
          return result;
        };
        PositionCalculator.prototype.calculate = function() {
          if (this.itmPos === null) {
            return null;
          }
          var o = this.options;
          __refreshPosition(this.$itm, this.itmPos);
          this.trgPos && __refreshPosition(this.$trg, this.trgPos);
          this.bndPos && __refreshBounding(this.$bnd, this.bndPos);
          var result = this.calcVariant(this.itmAt, this.trgAt);
          if (!result.distance || !result.distance.overflow) {
            return result;
          }
          if (o.flip && o.flip !== "none" && this.trgPos) {
            var newResult;
            var flipedPlacement = __flipPlacement(
              o.flip,
              this.itmAt,
              this.trgAt,
              result.distance
            );
            if (flipedPlacement) {
              newResult = this.calcVariant(flipedPlacement.item_at, flipedPlacement.tar_at);
              if (!newResult.distance.overflow) {
                return newResult;
              }
              var useNew = {
                y: false,
                x: false
              };
              useNew.y = __overflowLT(newResult.distance, result.distance, true);
              useNew.x = __overflowLT(newResult.distance, result.distance, false);
              if (useNew.y !== useNew.x) {
                result = this.calcVariant({
                  y: useNew.y ? flipedPlacement.item_at.y : this.itmAt.y,
                  x: useNew.x ? flipedPlacement.item_at.x : this.itmAt.x
                }, {
                  y: useNew.y ? flipedPlacement.tar_at.y : this.trgAt.y,
                  x: useNew.x ? flipedPlacement.tar_at.x : this.trgAt.x
                });
                if (!result.distance.overflow) {
                  return result;
                }
              } else if (useNew.y && useNew.x) {
                result = newResult;
              }
            }
          }
          if (o.stick && o.stick !== "none") {
            return __adaptSticking(result, o.stick);
          } else {
            return result;
          }
        };
        PositionCalculator.defaults = {
          item: null,
          target: null,
          boundary: window,
          itemAt: "top left",
          targetAt: "top left",
          itemOffset: {
            y: 0,
            x: 0,
            mirror: true
          },
          targetOffset: {
            y: 0,
            x: 0,
            mirror: true
          },
          flip: "none",
          stick: "none"
        };
        return PositionCalculator;
      });
    }
  });
  require_position_calculator();
})();
/*!
 * class PositionCalculator
 * https://github.com/tlindig/position-calculator
 *
 * Copyright (c) 2014 Tobias Lindig
 * Licensed under the MIT license.
 */
//# sourceMappingURL=position-calculator.js.map
