/*
 * DOM fixtures and geometry helpers for the tests. Independent of the implementation under test.
 * All boxes are absolutely positioned in document coordinates with content-box sizing.
 */
(function (root) {
    "use strict";

    var counter = 0;

    function Scene() {
        this.root = document.createElement("div");
        this.root.style.cssText = "position:absolute;left:0;top:0;width:2400px;height:2400px;margin:0;padding:0;";
        document.body.appendChild(this.root);
    }

    /**
     * @param {Object} spec  { left, top, width, height, border, padding, overflow, id }
     * @return {HTMLElement}
     */
    Scene.prototype.box = function (spec) {
        var el = document.createElement("div");
        var s = el.style;
        el.id = spec.id || "box" + ++counter;
        s.position = "absolute";
        s.margin = "0";
        s.boxSizing = "content-box";
        s.left = spec.left + "px";
        s.top = spec.top + "px";
        s.width = spec.width + "px";
        s.height = spec.height + "px";
        s.border = (spec.border || 0) + "px solid #888";
        s.padding = (spec.padding || 0) + "px";
        if (spec.overflow) {
            s.overflow = spec.overflow;
        }
        this.root.appendChild(el);
        return el;
    };

    Scene.prototype.destroy = function () {
        document.body.removeChild(this.root);
        window.scrollTo(0, 0);
    };

    // visible area of the window without scrollbars, in document coordinates
    Scene.viewport = function () {
        var d = document.documentElement;
        return {
            left: window.pageXOffset,
            top: window.pageYOffset,
            width: d.clientWidth,
            height: d.clientHeight,
        };
    };

    // border box of an element in document coordinates
    Scene.docRect = function (el) {
        var r = el.getBoundingClientRect();
        return {
            left: r.left + window.pageXOffset,
            top: r.top + window.pageYOffset,
            width: r.width,
            height: r.height,
        };
    };

    // padding box (inside the border, without scrollbars) in document coordinates
    Scene.innerRect = function (el) {
        var r = Scene.docRect(el);
        return {
            left: r.left + el.clientLeft,
            top: r.top + el.clientTop,
            width: el.clientWidth,
            height: el.clientHeight,
        };
    };

    /**
     * Reference point of a rect.
     * @param {{left,top,width,height}} rect
     * @param {string} at  "top left", "middle center", ...
     * @return {{y:number, x:number}}
     */
    Scene.point = function (rect, at) {
        var parts = at.split(" ");
        var y = { top: 0, middle: 0.5, bottom: 1 }[parts[0]];
        var x = { left: 0, center: 0.5, right: 1 }[parts[1]];
        return { y: rect.top + rect.height * y, x: rect.left + rect.width * x };
    };

    // rounds numbers to 1e-6 (and -0 to 0), so results can be compared with deepEqual
    Scene.normalize = function normalize(value) {
        if (typeof value === "number") {
            return Math.round(value * 1e6) / 1e6 + 0;
        }
        if (Array.isArray(value)) {
            return value.map(normalize);
        }
        if (value && typeof value === "object") {
            var copy = {};
            Object.keys(value).forEach(function (key) {
                copy[key] = normalize(value[key]);
            });
            return copy;
        }
        return value;
    };

    root.Scene = Scene;
})(window);
