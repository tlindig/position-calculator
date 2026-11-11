/*
 * Development test set: static, hand-calculated expectations.
 * Use it while implementing. The validation set (validation.test.js) checks the same behavior
 * with generated scenes.
 *
 * Common scene (document coordinates, px):
 *   item      I  left 10,  top 20,  60 x 40     reference offsets x: 0 / 30 / 60,  y: 0 / 20 / 40
 *   target    T  left 200, top 200, 100 x 50    reference points x: 200 / 250 / 300, y: 200 / 225 / 250
 *   boundary  B  left 100, top 100, 400 x 300   inner box x: 100..500, y: 100..400
 *
 * moveBy = (target reference point) - (item reference offset) - (current item position)
 * distance: top = B.top - item.top, left likewise, bottom = B.bottom - item.bottom, right likewise.
 */
/*global Adapter, Scene, module, test, ok, strictEqual, deepEqual*/
(function () {
    "use strict";

    var s, I, T, B;

    var env = {
        setup: function () {
            s = new Scene();
            I = s.box({ id: "item", left: 10, top: 20, width: 60, height: 40 });
            T = s.box({ id: "target", left: 200, top: 200, width: 100, height: 50 });
            B = s.box({ id: "boundary", left: 100, top: 100, width: 400, height: 300 });
        },
        teardown: function () {
            s.destroy();
        },
    };

    function calc(overrides) {
        var options = { item: I, target: T, boundary: B };
        Object.keys(overrides || {}).forEach(function (key) {
            options[key] = overrides[key];
        });
        return Adapter.create(options);
    }

    // distance object; overflow is given explicitly (rule: top/left > 0 or bottom/right < 0 is overflow)
    function d(top, left, bottom, right, overflow) {
        return { top: top, left: left, bottom: bottom, right: right, overflow: overflow || null };
    }

    function res(y, x, itemAt, targetAt, distance) {
        return { moveBy: { y: y, x: x }, distance: distance, itemAt: itemAt, targetAt: targetAt };
    }

    function same(actual, expected, message) {
        deepEqual(Scene.normalize(actual), Scene.normalize(expected), message);
    }

    function translate(el, moveBy) {
        el.style.transform = "translate(" + moveBy.x + "px," + moveBy.y + "px)";
    }

    function size(el, width, height) {
        el.style.width = width + "px";
        el.style.height = height + "px";
    }

    // ////////////////////////////////////////////////////////////////
    module("placement", env);

    test("default placement aligns top left of item with top left of target", function () {
        same(calc().calculate(), res(180, 190, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("item bottom right on target top left", function () {
        same(
            calc({ itemAt: "bottom right" }).calculate(),
            res(140, 130, "bottom right", "top left", d(-60, -40, 200, 300)),
        );
    });

    test("item middle center on target middle center", function () {
        same(
            calc({ itemAt: "middle center", targetAt: "middle center" }).calculate(),
            res(185, 210, "middle center", "middle center", d(-105, -120, 155, 220)),
        );
    });

    test("item top left on target bottom right", function () {
        same(
            calc({ targetAt: "bottom right" }).calculate(),
            res(230, 290, "top left", "bottom right", d(-150, -200, 110, 140)),
        );
    });

    test("size of item and target includes border and padding", function () {
        // content 40 x 20 + 2 * 5 border + 2 * 5 padding = 60 x 40, target 80 x 30 -> 100 x 50
        var item = s.box({ left: 10, top: 20, width: 40, height: 20, border: 5, padding: 5 });
        var target = s.box({ left: 200, top: 200, width: 80, height: 30, border: 5, padding: 5 });
        same(
            calc({ item: item, target: target, itemAt: "bottom right", targetAt: "bottom right" }).calculate(),
            res(190, 230, "bottom right", "bottom right", d(-110, -140, 150, 200)),
        );
    });

    test("all 81 combinations of itemAt and targetAt", function () {
        var ys = ["top", "middle", "bottom"];
        var xs = ["left", "center", "right"];
        var itemPos = Scene.docRect(I);
        var targetRect = Scene.docRect(T);
        var bnd = { top: 100, left: 100, bottom: 400, right: 500 };

        ys.forEach(function (ty) {
            xs.forEach(function (tx) {
                ys.forEach(function (iy) {
                    xs.forEach(function (ix) {
                        var itemAt = iy + " " + ix;
                        var targetAt = ty + " " + tx;
                        var tp = Scene.point(targetRect, targetAt);
                        var ip = Scene.point({ left: 0, top: 0, width: 60, height: 40 }, itemAt);
                        var top = tp.y - ip.y;
                        var left = tp.x - ip.x;
                        var distance = d(
                            bnd.top - top,
                            bnd.left - left,
                            bnd.bottom - (top + 40),
                            bnd.right - (left + 60),
                        );
                        distance.overflow = [];
                        distance.top > 0 && distance.overflow.push("top");
                        distance.left > 0 && distance.overflow.push("left");
                        distance.bottom < 0 && distance.overflow.push("bottom");
                        distance.right < 0 && distance.overflow.push("right");
                        distance.overflow = distance.overflow.length ? distance.overflow : null;

                        same(
                            calc({ itemAt: itemAt, targetAt: targetAt }).calculate(),
                            res(top - itemPos.top, left - itemPos.left, itemAt, targetAt, distance),
                            "itemAt '" + itemAt + "' on targetAt '" + targetAt + "'",
                        );
                    });
                });
            });
        });
    });

    // ////////////////////////////////////////////////////////////////
    module("offsets", env);

    test("target offset in px", function () {
        same(
            calc({ targetOffset: { y: 10, x: -5, mirror: true } }).calculate(),
            res(190, 185, "top left", "top left", d(-110, -95, 150, 245)),
        );
    });

    test("negative target offset in px", function () {
        same(
            calc({ targetOffset: { y: -10, x: -20, mirror: true } }).calculate(),
            res(170, 170, "top left", "top left", d(-90, -80, 170, 260)),
        );
    });

    test("offsets given as numeric strings", function () {
        same(
            calc({ targetOffset: { y: "10", x: "20", mirror: true } }).calculate(),
            res(190, 210, "top left", "top left", d(-110, -120, 150, 220)),
        );
    });

    test("target offset in percent of the target size", function () {
        // 10% of target height 50 = 5, 50% of target width 100 = 50
        same(
            calc({ targetOffset: { y: "10%", x: "50%", mirror: true } }).calculate(),
            res(185, 240, "top left", "top left", d(-105, -150, 155, 190)),
        );
    });

    test("item offset moves the item away from the reference point", function () {
        same(
            calc({ itemOffset: { y: 3, x: 4, mirror: true } }).calculate(),
            res(183, 194, "top left", "top left", d(-103, -104, 157, 236)),
        );
    });

    test("item offset in percent of the item size", function () {
        // 50% of item height 40 = 20, 50% of item width 60 = 30
        same(
            calc({ itemOffset: { y: "50%", x: "50%", mirror: true } }).calculate(),
            res(200, 220, "top left", "top left", d(-120, -130, 140, 210)),
        );
    });

    test("target offset belongs to the chosen reference point", function () {
        same(
            calc({ targetAt: "bottom right", targetOffset: { y: 10, x: 5, mirror: true } }).calculate(),
            res(240, 295, "top left", "bottom right", d(-160, -205, 100, 135)),
        );
    });

    test("item offset belongs to the chosen reference point", function () {
        same(
            calc({ itemAt: "bottom right", itemOffset: { y: 3, x: 4, mirror: true } }).calculate(),
            res(143, 134, "bottom right", "top left", d(-63, -44, 197, 296)),
        );
    });

    // ////////////////////////////////////////////////////////////////
    module("boundary", env);

    test("border of the boundary is not part of the allowed area", function () {
        var b = s.box({ left: 100, top: 100, width: 400, height: 300, border: 10 });
        same(calc({ boundary: b }).calculate(), res(180, 190, "top left", "top left", d(-90, -90, 170, 250)));
    });

    test("padding of the boundary is part of the allowed area", function () {
        var b = s.box({ left: 100, top: 100, width: 400, height: 300, padding: 20 });
        same(calc({ boundary: b }).calculate(), res(180, 190, "top left", "top left", d(-100, -100, 200, 280)));
    });

    test("border and padding of the boundary", function () {
        var b = s.box({ left: 100, top: 100, width: 400, height: 300, border: 10, padding: 20 });
        same(calc({ boundary: b }).calculate(), res(180, 190, "top left", "top left", d(-90, -90, 210, 290)));
    });

    test("scrollbars of the boundary are not part of the allowed area", function () {
        var b = s.box({ left: 100, top: 100, width: 400, height: 300, overflow: "scroll" });
        var right = 100 + b.clientLeft + b.clientWidth - 260; // client size is the visible area without scrollbars
        var bottom = 100 + b.clientTop + b.clientHeight - 240;
        ok(b.clientWidth <= 400 && b.clientHeight <= 300, "precondition: client size excludes scrollbars");
        same(calc({ boundary: b }).calculate().distance, d(-100, -100, bottom, right));
    });

    test("default boundary is the window", function () {
        var vp = Scene.viewport();
        same(
            calc({ target: null, boundary: undefined }).calculate(),
            res(0, 0, null, null, d(-20, -10, vp.height - 60, vp.width - 70)),
        );
    });

    test("window boundary follows the scroll position", function () {
        var calculator = calc({ target: null, boundary: undefined });
        window.scrollTo(0, 200);
        var vp = Scene.viewport();
        strictEqual(vp.top, 200, "precondition: window is scrolled");
        same(calculator.calculate(), res(0, 0, null, null, d(180, -10, 200 + vp.height - 60, vp.width - 70, ["top"])));
    });

    test("border of <html> is subtracted from element positions, like jQuery.offset() of 1.9", function () {
        var root = document.documentElement;
        root.style.border = "10px solid #888";
        try {
            var vp = Scene.viewport();
            // Chrome reports the border of <html> as clientTop / clientLeft (10), Firefox reports 0
            var ct = root.clientTop;
            var cl = root.clientLeft;
            // target is at 200 - ct / 200 - cl for the library, the item is moved there,
            // the window boundary starts behind the border at ct / cl
            same(
                calc({ boundary: undefined }).calculate(),
                res(
                    180,
                    190,
                    "top left",
                    "top left",
                    d(2 * ct - 200, 2 * cl - 200, vp.height - 240 + 2 * ct, vp.width - 260 + 2 * cl),
                ),
            );
        } finally {
            root.style.border = "";
        }
    });

    test("boundary 'window' as string is the window", function () {
        var vp = Scene.viewport();
        same(
            calc({ target: null, boundary: "window" }).calculate().distance,
            d(-20, -10, vp.height - 60, vp.width - 70),
        );
    });

    test("boundary null: no distance is calculated", function () {
        same(calc({ boundary: null }).calculate(), res(180, 190, "top left", "top left", null));
    });

    test("boundary selector without match: no distance is calculated", function () {
        same(calc({ boundary: "#does-not-exist" }).calculate(), res(180, 190, "top left", "top left", null));
    });

    // ////////////////////////////////////////////////////////////////
    module("without target", env);

    test("only the distance to the boundary is calculated", function () {
        same(calc({ target: null }).calculate(), res(0, 0, null, null, d(80, 90, 340, 430, ["top", "left"])));
    });

    test("target selector without match behaves like no target", function () {
        same(
            calc({ target: "#does-not-exist" }).calculate(),
            res(0, 0, null, null, d(80, 90, 340, 430, ["top", "left"])),
        );
    });

    test("flip is ignored", function () {
        same(
            calc({ target: null, flip: "both" }).calculate(),
            res(0, 0, null, null, d(80, 90, 340, 430, ["top", "left"])),
        );
    });

    test("stick still works", function () {
        same(calc({ target: null, stick: "all" }).calculate(), res(80, 90, null, null, d(0, 0, 260, 340)));
    });

    // ////////////////////////////////////////////////////////////////
    // Item 100 x 80, target T2 at 420,300 (60 x 40). With itemAt "top left" and targetAt "bottom right"
    // the item overflows on bottom and right.
    module("flip", {
        setup: function () {
            env.setup();
            size(I, 100, 80);
            this.T2 = s.box({ left: 420, top: 300, width: 60, height: 40 });
        },
        teardown: env.teardown,
    });

    function flipCalc(environment, overrides) {
        var options = { target: environment.T2, targetAt: "bottom right" };
        Object.keys(overrides || {}).forEach(function (key) {
            options[key] = overrides[key];
        });
        return calc(options);
    }

    test("without flip the item overflows", function () {
        var expected = res(320, 470, "top left", "bottom right", d(-240, -380, -20, -80, ["bottom", "right"]));
        same(flipCalc(this).calculate(), expected, "default");
        same(flipCalc(this, { flip: "none" }).calculate(), expected, "none");
        same(flipCalc(this, { flip: false }).calculate(), expected, "false");
    });

    test("flip both", function () {
        var expected = res(200, 310, "bottom right", "top left", d(-120, -220, 100, 80));
        same(flipCalc(this, { flip: "both" }).calculate(), expected, "'both'");
        same(flipCalc(this, { flip: true }).calculate(), expected, "true");
    });

    test("flip item", function () {
        same(
            flipCalc(this, { flip: "item" }).calculate(),
            res(240, 370, "bottom right", "bottom right", d(-160, -280, 60, 20)),
        );
    });

    test("flip target takes the placement with the least overflow", function () {
        same(
            flipCalc(this, { flip: "target" }).calculate(),
            res(280, 410, "top left", "top left", d(-200, -320, 20, -20, ["right"])),
        );
    });

    test("flip is not applied without overflow", function () {
        size(I, 60, 40);
        same(calc({ flip: "both" }).calculate(), res(180, 190, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("flip changes only the axis that overflows", function () {
        size(I, 60, 40);
        var t = s.box({ left: 200, top: 330, width: 60, height: 40 });
        same(
            calc({ target: t, itemAt: "top left", targetAt: "bottom left", flip: "both" }).calculate(),
            res(270, 190, "bottom left", "top left", d(-190, -100, 70, 240)),
        );
    });

    test("no flip when the item is larger than the boundary on that axis", function () {
        size(I, 600, 40);
        same(
            calc({ itemAt: "middle center", targetAt: "middle center", flip: "both" }).calculate(),
            res(185, -60, "middle center", "middle center", d(-105, 150, 155, -50, ["left", "right"])),
        );
    });

    test("target offset is mirrored on flip when mirror is true", function () {
        same(
            flipCalc(this, { flip: "both", targetOffset: { y: 10, x: 0, mirror: true } }).calculate(),
            res(190, 310, "bottom right", "top left", d(-110, -220, 110, 80)),
        );
    });

    test("target offset keeps its direction on flip when mirror is false", function () {
        same(
            flipCalc(this, { flip: "both", targetOffset: { y: 10, x: 0, mirror: false } }).calculate(),
            res(210, 310, "bottom right", "top left", d(-130, -220, 90, 80)),
        );
    });

    test("item offset is mirrored on flip when mirror is true", function () {
        same(
            flipCalc(this, { flip: "both", itemOffset: { y: 10, x: 0, mirror: true } }).calculate(),
            res(190, 310, "bottom right", "top left", d(-110, -220, 110, 80)),
        );
    });

    test("item offset keeps its direction on flip when mirror is false", function () {
        same(
            flipCalc(this, { flip: "both", itemOffset: { y: 10, x: 0, mirror: false } }).calculate(),
            res(210, 310, "bottom right", "top left", d(-130, -220, 90, 80)),
        );
    });

    // ////////////////////////////////////////////////////////////////
    module("stick", {
        setup: function () {
            env.setup();
            size(I, 100, 80);
            this.T2 = s.box({ left: 420, top: 300, width: 60, height: 40 });
        },
        teardown: env.teardown,
    });

    test("stick all and true keep the item inside the boundary", function () {
        var expected = res(300, 390, "top left", "bottom right", d(-220, -300, 0, 0));
        same(flipCalc(this, { stick: "all" }).calculate(), expected, "'all'");
        same(flipCalc(this, { stick: true }).calculate(), expected, "true");
        same(flipCalc(this, { stick: "bottom right" }).calculate(), expected, "'bottom right'");
    });

    test("stick only the given edge", function () {
        same(
            flipCalc(this, { stick: "right" }).calculate(),
            res(320, 390, "top left", "bottom right", d(-240, -300, -20, 0, ["bottom"])),
            "right",
        );
        same(
            flipCalc(this, { stick: "bottom" }).calculate(),
            res(300, 470, "top left", "bottom right", d(-220, -380, 0, -80, ["right"])),
            "bottom",
        );
    });

    test("stick on an edge without overflow changes nothing", function () {
        same(
            flipCalc(this, { stick: "top left" }).calculate(),
            res(320, 470, "top left", "bottom right", d(-240, -380, -20, -80, ["bottom", "right"])),
        );
    });

    test("stick none and false change nothing", function () {
        var expected = res(320, 470, "top left", "bottom right", d(-240, -380, -20, -80, ["bottom", "right"]));
        same(flipCalc(this, { stick: "none" }).calculate(), expected, "'none'");
        same(flipCalc(this, { stick: false }).calculate(), expected, "false");
    });

    test("stick on top and left", function () {
        size(I, 60, 40);
        var t = s.box({ left: 110, top: 110, width: 20, height: 20 });
        var base = { target: t, itemAt: "bottom right", targetAt: "top left" };
        function withStick(stick) {
            var o = { stick: stick };
            Object.keys(base).forEach(function (k) {
                o[k] = base[k];
            });
            return calc(o).calculate();
        }
        same(withStick("none"), res(50, 40, "bottom right", "top left", d(30, 50, 290, 390, ["top", "left"])), "none");
        same(withStick("all"), res(80, 90, "bottom right", "top left", d(0, 0, 260, 340)), "all");
        same(withStick("top"), res(80, 40, "bottom right", "top left", d(0, 50, 260, 390, ["left"])), "top");
        same(withStick("left"), res(50, 90, "bottom right", "top left", d(30, 0, 290, 340, ["top"])), "left");
    });

    test("stick is applied after flip", function () {
        same(
            flipCalc(this, { flip: "target", stick: "all" }).calculate(),
            res(280, 390, "top left", "top left", d(-200, -300, 20, 0)),
        );
    });

    test("stick left with an item wider than the boundary", function () {
        size(I, 600, 40);
        same(
            calc({ itemAt: "middle center", targetAt: "middle center", stick: "left" }).calculate(),
            res(185, 90, "middle center", "middle center", d(-105, 0, 155, -200, ["right"])),
        );
    });

    test("stick on both edges of an axis: the item ends at the left or top edge", function () {
        size(I, 600, 40);
        same(
            stickMiddle("left right"),
            res(185, 90, "middle center", "middle center", d(-105, 0, 155, -200, ["right"])),
            "wider than the boundary",
        );
        size(I, 60, 400);
        same(
            stickMiddle("top bottom"),
            res(80, 210, "middle center", "middle center", d(0, -120, -100, 220, ["bottom"])),
            "higher than the boundary",
        );
    });

    // ////////////////////////////////////////////////////////////////
    module("kinds of elements", env);

    test("selector strings for item, target and boundary", function () {
        same(
            calc({ item: "#item", target: "#target", boundary: "#boundary" }).calculate(),
            res(180, 190, "top left", "top left", d(-100, -100, 160, 240)),
        );
    });

    test("event as target is a point", function () {
        var event = new MouseEvent("mousemove", { clientX: 250, clientY: 210 });
        same(
            calc({ target: event, targetAt: "bottom right" }).calculate(),
            res(190, 240, "top left", "bottom right", d(-110, -150, 150, 190)),
        );
    });

    test("event position uses the page coordinates", function () {
        // a constructed MouseEvent has no scroll in pageX/pageY, so they are set explicitly
        var event = new MouseEvent("mousemove", { clientX: 10, clientY: 10 });
        Object.defineProperty(event, "pageX", { value: 250 });
        Object.defineProperty(event, "pageY", { value: 210 });
        same(calc({ target: event }).calculate(), res(190, 240, "top left", "top left", d(-110, -150, 150, 190)));
    });

    test("document as target starts at the document origin", function () {
        var expected = res(-20, -10, "top left", "top left", d(100, 100, 360, 440, ["top", "left"]));
        same(calc({ target: document }).calculate(), expected, "document");
        same(calc({ target: "document" }).calculate(), expected, "'document'");
    });

    test("array-like inputs use their first element", function () {
        var expected = res(180, 190, "top left", "top left", d(-100, -100, 160, 240));
        same(calc({ item: [I, T], target: [T, I], boundary: [B] }).calculate(), expected, "array");
        same(
            calc({
                item: document.querySelectorAll("#item"),
                target: document.querySelectorAll("#target"),
                boundary: document.querySelectorAll("#boundary"),
            }).calculate(),
            expected,
            "NodeList",
        );
    });

    test("empty array-likes: no item gives null, no target and no boundary are skipped", function () {
        strictEqual(calc({ item: [] }).calculate(), null, "empty item");
        strictEqual(calc({ item: document.querySelectorAll("#none") }).calculate(), null, "empty NodeList");
        same(
            calc({ target: [] }).calculate(),
            res(0, 0, null, null, d(80, 90, 340, 430, ["top", "left"])),
            "empty target",
        );
        same(calc({ boundary: [] }).calculate(), res(180, 190, "top left", "top left", null), "empty boundary");
    });

    test("a form is an element, not a collection of its controls", function () {
        var form = document.createElement("form");
        form.style.cssText = "position:absolute;left:10px;top:20px;width:60px;height:40px;margin:0;";
        form.appendChild(document.createElement("input"));
        s.root.appendChild(form);
        same(calc({ item: form }).calculate(), res(180, 190, "top left", "top left", d(-100, -100, 160, 240)));
    });

    // ////////////////////////////////////////////////////////////////
    module("sizes are measured like jQuery 1.9 did", env);

    // a hidden element has no position: the box is read as 0, 0 plus the scroll offset (0, 0 here)

    test("hidden item is measured as if it is shown", function () {
        var item = s.box({ left: 10, top: 20, width: 60, height: 40, border: 2, padding: 3 });
        item.style.display = "none";
        // 60 x 40 + 2 * 2 border + 2 * 3 padding = 70 x 50
        same(
            calc({ item: item, itemAt: "bottom right" }).calculate(),
            res(150, 130, "bottom right", "top left", d(-50, -30, 200, 300)),
        );
        strictEqual(item.style.display, "none", "style is restored");
        strictEqual(item.style.position, "absolute", "style is restored");
        strictEqual(item.style.visibility, "", "style is restored");
    });

    test("hidden item with box-sizing border-box", function () {
        var item = s.box({ left: 10, top: 20, width: 60, height: 40, border: 2, padding: 3 });
        item.style.boxSizing = "border-box";
        item.style.display = "none";
        same(
            calc({ item: item, itemAt: "bottom right" }).calculate(),
            res(160, 140, "bottom right", "top left", d(-60, -40, 200, 300)),
        );
    });

    test("hidden target is measured as if it is shown", function () {
        var target = s.box({ left: 200, top: 200, width: 100, height: 50 });
        target.style.display = "none";
        same(
            calc({ target: target, targetAt: "bottom right" }).calculate(),
            res(30, 90, "top left", "bottom right", d(50, 0, 310, 340, ["top"])),
        );
    });

    test("fractional sizes are rounded like offsetWidth and offsetHeight", function () {
        var item = s.box({ left: 10, top: 20, width: 60.4, height: 40.6 });
        // 60.4 -> 60, 40.6 -> 41 (top 20 + 40.6 = 60.6 -> 61)
        same(
            calc({ item: item, itemAt: "bottom right" }).calculate(),
            res(139, 130, "bottom right", "top left", d(-59, -40, 200, 300)),
        );
    });

    test("fractional position is not rounded", function () {
        var item = s.box({ left: 10.25, top: 20.5, width: 60, height: 40 });
        same(calc({ item: item }).calculate(), res(179.5, 189.75, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("an element in an open shadow root is positioned like one in the document", function () {
        var shadow = s.root.appendChild(document.createElement("div")).attachShadow({ mode: "open" });
        var item = document.createElement("div");
        item.style.cssText = "position:absolute;left:400px;top:400px;width:60px;height:40px;";
        shadow.appendChild(item);
        var target = document.createElement("div");
        target.style.cssText = "position:absolute;left:200px;top:200px;width:100px;height:50px;";
        shadow.appendChild(target);
        ok(item.isConnected && target.isConnected, "precondition: both are connected");
        ok(!document.documentElement.contains(item), "precondition: contains() does not reach into the shadow root");

        same(
            calc({ item: item, targetAt: "bottom right" }).calculate(),
            res(-150, -100, "top left", "bottom right", d(-150, -200, 110, 140)),
            "item in the shadow root",
        );
        same(
            calc({ target: target }).calculate(),
            res(180, 190, "top left", "top left", d(-100, -100, 160, 240)),
            "target in the shadow root",
        );
    });

    test("a disconnected element is measured from its inline style and sits at 0, 0", function () {
        var item = document.createElement("div");
        item.style.cssText = "width:40px;height:20px;padding:2px;border:1px solid;";
        // 46 x 26
        same(
            calc({ item: item, itemAt: "bottom right" }).calculate(),
            res(174, 154, "bottom right", "top left", d(-74, -54, 200, 300)),
        );
    });

    // ////////////////////////////////////////////////////////////////
    module("positions are read from the DOM", env);

    test("calculate() reads the current position of the target", function () {
        var calculator = calc();
        T.style.left = "250px";
        same(calculator.calculate(), res(180, 240, "top left", "top left", d(-100, -150, 160, 190)));
    });

    test("calculate() reads the current position of the item", function () {
        var calculator = calc();
        I.style.left = "50px";
        same(calculator.calculate(), res(180, 150, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("calculate() reads the current position of the boundary", function () {
        var calculator = calc();
        B.style.left = "150px";
        // boundary is now 150..550 wide, the item is applied at 200..260
        same(calculator.calculate(), res(180, 190, "top left", "top left", d(-100, -50, 160, 290)));
    });

    test("applying moveBy puts the item in place, calculating again gives no further move", function () {
        var calculator = calc();
        var first = calculator.calculate();
        translate(I, first.moveBy);
        var rect = Scene.docRect(I);
        same({ left: rect.left, top: rect.top }, { left: 200, top: 200 }, "item is at the target");
        same(calculator.calculate(), res(0, 0, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("target inside a scrolled container", function () {
        var c = s.box({ left: 100, top: 100, width: 400, height: 300, overflow: "auto" });
        var inner = document.createElement("div");
        inner.style.cssText = "position:absolute;left:0;top:0;width:1000px;height:1000px;";
        c.appendChild(inner);
        var t = document.createElement("div");
        t.style.cssText = "position:absolute;left:150px;top:150px;width:100px;height:50px;";
        c.appendChild(t);
        var calculator = calc({ target: t, boundary: B });
        c.scrollTop = 30;
        c.scrollLeft = 50;
        // target is now at left 200, top 220
        same(calculator.calculate(), res(200, 190, "top left", "top left", d(-120, -100, 140, 240)));
    });

    test("resize() takes over a new item size", function () {
        var calculator = calc({ itemAt: "top right" });
        size(I, 100, 40);
        strictEqual(calculator.resize(), calculator, "returns this");
        same(calculator.calculate(), res(180, 90, "top right", "top left", d(-100, 0, 160, 300)));
    });

    test("resize() takes over a new target size", function () {
        var calculator = calc({ targetAt: "top right" });
        size(T, 160, 50);
        calculator.resize();
        same(calculator.calculate(), res(180, 350, "top left", "top right", d(-100, -260, 160, 80)));
    });

    test("resize() takes over a new boundary size", function () {
        var calculator = calc();
        size(B, 300, 300);
        calculator.resize();
        same(calculator.calculate(), res(180, 190, "top left", "top left", d(-100, -100, 160, 140)));
    });

    // ////////////////////////////////////////////////////////////////
    module("calcVariant", env);

    test("calculates the given placement", function () {
        same(
            calc().calcVariant({ y: "bottom", x: "right" }, { y: "top", x: "left" }),
            res(140, 130, "bottom right", "top left", d(-60, -40, 200, 300)),
        );
    });

    test("does not apply flip and stick", function () {
        size(I, 100, 80);
        var t = s.box({ left: 420, top: 300, width: 60, height: 40 });
        same(
            calc({ target: t, flip: "both", stick: "all" }).calcVariant(
                { y: "top", x: "left" },
                { y: "bottom", x: "right" },
            ),
            res(320, 470, "top left", "bottom right", d(-240, -380, -20, -80, ["bottom", "right"])),
        );
    });

    test("without placement only the distance of the current position is calculated", function () {
        same(calc().calcVariant(), res(0, 0, null, null, d(80, 90, 340, 430, ["top", "left"])));
    });

    // ////////////////////////////////////////////////////////////////
    module("input handling", env);

    test("missing item: calculate() returns null", function () {
        strictEqual(Adapter.create().calculate(), null, "no options");
        strictEqual(Adapter.create({ item: null }).calculate(), null, "item null");
        strictEqual(Adapter.create({ item: "#does-not-exist" }).calculate(), null, "item without match");
        strictEqual(Adapter.create({ item: "" }).calculate(), null, "empty selector");
    });

    test("jQuery.PositionCalculator is an alias only if jQuery was loaded first", function () {
        // run it with --jquery=1 to see the alias
        strictEqual(
            window.jQuery ? window.jQuery.PositionCalculator : undefined,
            window.jQuery ? Adapter.ctor() : undefined,
        );
        strictEqual(window.PositionCalculator, Adapter.ctor(), "global");
    });

    test("invalid itemAt and targetAt fall back to top left", function () {
        same(
            calc({ itemAt: "foo bar", targetAt: "foo bar" }).calculate(),
            res(180, 190, "top left", "top left", d(-100, -100, 160, 240)),
        );
    });

    test("itemAt and targetAt: each half is checked separately", function () {
        var result = calc({ itemAt: "bottom", targetAt: "middle" }).calculate();
        strictEqual(result.itemAt, "bottom left", "missing horizontal part");
        strictEqual(result.targetAt, "middle left", "missing horizontal part");
        result = calc({ itemAt: "left top", targetAt: "left top" }).calculate();
        strictEqual(result.itemAt, "top left", "swapped order");
        strictEqual(result.targetAt, "top left", "swapped order");
    });

    test("a half that only contains a keyword falls back, like any other invalid half", function () {
        // before the regular expressions were anchored this gave NaN
        same(
            calc({ itemAt: "bottomleft", targetAt: "xbottomx right" }).calculate(),
            res(180, 290, "top left", "top right", d(-100, -200, 160, 140)),
        );
        var result = calc({ itemAt: "middlex centery", targetAt: "toppy" }).calculate();
        strictEqual(result.itemAt, "top left", "keyword inside a word");
        strictEqual(result.targetAt, "top left", "keyword at the start of a word");
    });

    test("itemAt and targetAt: spaces only separate the two halves", function () {
        var result = calc({ itemAt: "bottom right", targetAt: "middle  right" }).calculate();
        strictEqual(result.itemAt, "bottom right", "two words");
        strictEqual(result.targetAt, "middle left", "two spaces: the second half is empty");
        result = calc({ itemAt: " bottom right", targetAt: "bottom right " }).calculate();
        strictEqual(result.itemAt, "top left", "leading space: the first half is empty");
        strictEqual(result.targetAt, "bottom right", "trailing space");
    });

    test("flip and stick are off by default: an overflow is reported, not resolved", function () {
        size(I, 100, 80);
        var t = s.box({ left: 420, top: 300, width: 60, height: 40 });
        same(
            calc({ target: t, targetAt: "bottom right" }).calculate(),
            res(320, 470, "top left", "bottom right", d(-240, -380, -20, -80, ["bottom", "right"])),
        );
    });

    test("PositionCalculator.defaults holds the default options", function () {
        deepEqual(Adapter.ctor().defaults, {
            item: null,
            target: null,
            boundary: window,
            itemAt: "top left",
            targetAt: "top left",
            itemOffset: { y: 0, x: 0, mirror: true },
            targetOffset: { y: 0, x: 0, mirror: true },
            flip: "none",
            stick: "none",
        });
    });

    test("changing PositionCalculator.defaults changes new instances", function () {
        var defaults = Adapter.ctor().defaults;
        var original = defaults.itemAt;
        defaults.itemAt = "bottom right";
        try {
            strictEqual(Adapter.create({ item: I, target: T, boundary: B }).calculate().itemAt, "bottom right");
        } finally {
            defaults.itemAt = original;
        }
    });

    test("the constructor can be called without new", function () {
        var Ctor = Adapter.ctor();
        // eslint-disable-next-line new-cap -- the test calls the constructor without new on purpose
        var calculator = Ctor({ item: I, target: T, boundary: B });
        ok(calculator instanceof Ctor, "returns an instance");
        same(calculator.calculate(), res(180, 190, "top left", "top left", d(-100, -100, 160, 240)));
    });

    test("calculate() does not change the DOM or the options", function () {
        var options = {
            item: I,
            target: T,
            boundary: B,
            itemAt: "bottom right",
            flip: "both",
            stick: "all",
            itemOffset: { y: 1, x: 2, mirror: true },
            targetOffset: { y: "3%", x: "4%", mirror: false },
        };
        var html = s.root.innerHTML;
        var copy = JSON.stringify(options, function (key, value) {
            return value && value.nodeType ? undefined : value;
        });
        var calculator = Adapter.create(options);
        calculator.calculate();
        calculator.resize();
        calculator.calcVariant({ y: "top", x: "left" }, { y: "top", x: "left" });
        strictEqual(s.root.innerHTML, html, "DOM");
        strictEqual(
            JSON.stringify(options, function (key, value) {
                return value && value.nodeType ? undefined : value;
            }),
            copy,
            "options",
        );
    });

    // ////////////////////////////////////////////////////////////////
    function stickMiddle(stick) {
        return calc({ itemAt: "middle center", targetAt: "middle center", stick: stick }).calculate();
    }

    module("window as target", env);

    test("window is the visible area, reference points are measured on it", function () {
        var vp = Scene.viewport();
        same(
            calc({ target: window, boundary: null, itemAt: "middle center", targetAt: "middle center" }).calculate(),
            res(vp.top + vp.height / 2 - 40, vp.left + vp.width / 2 - 40, "middle center", "middle center", null),
        );
    });

    test("'window' as string, item in the bottom right corner of the visible area", function () {
        var vp = Scene.viewport();
        same(
            calc({ target: "window", boundary: null, itemAt: "bottom right", targetAt: "bottom right" }).calculate(),
            res(vp.top + vp.height - 60, vp.left + vp.width - 70, "bottom right", "bottom right", null),
        );
    });

    test("window as target follows the scroll position", function () {
        var calculator = calc({ target: window, boundary: null });
        window.scrollTo(50, 200);
        var vp = Scene.viewport();
        same({ top: vp.top, left: vp.left }, { top: 200, left: 50 }, "precondition: window is scrolled");
        same(calculator.calculate(), res(vp.top - 20, vp.left - 10, "top left", "top left", null));
    });

    module("stick all with an oversized item", env);

    test("item wider than the boundary: it ends at the left edge, like listing all edges", function () {
        size(I, 600, 40);
        var expected = res(185, 90, "middle center", "middle center", d(-105, 0, 155, -200, ["right"]));
        same(stickMiddle("all"), expected, "'all'");
        same(stickMiddle(true), expected, "true");
    });

    test("item higher than the boundary: it ends at the top edge, like listing all edges", function () {
        size(I, 60, 400);
        var expected = res(80, 210, "middle center", "middle center", d(0, -120, -100, 220, ["bottom"]));
        same(stickMiddle("all"), expected, "'all'");
        same(stickMiddle(true), expected, "true");
    });
})();
