/*
 * Validation set: generated scenes, no static expectations.
 *
 * Every scene (geometry, element kinds, options) is drawn from a seeded random generator. The seed is
 * printed by test/run.js. Reproduce a run with --seed=N, or open validation.html?seed=N&n=COUNT.
 *
 * Per scene, the implementation under test is checked against
 *  1. the frozen legacy build (test/reference) fed with the same DOM and options, and
 *  2. properties that must hold for any correct result, measured in the real DOM
 *     (applying moveBy puts the item on the target, distance matches the rects, flip and stick rules).
 *
 * Scenes in which the reference build itself throws (see the "[target]" modules in the dev set) are skipped.
 */
/*global Adapter, Scene, Report, TestParams, module, test, ok, deepEqual */
(function () {
    "use strict";

    var seed = TestParams.seed ? Number(TestParams.seed) >>> 0 : Math.floor(Math.random() * 4294967296);
    var count = Number(TestParams.n) || 300;

    var Y = ["top", "middle", "bottom"];
    var X = ["left", "center", "right"];
    var MIRROR = { left: "right", center: "center", right: "left", top: "bottom", middle: "middle", bottom: "top" };
    var EDGES = ["top", "left", "bottom", "right"];
    var TOLERANCE = 0.02; // DOM rects are snapped to 1/64 px

    // ////////////////////////////////////////////////////////////////
    // random generator

    function mulberry32(a) {
        return function () {
            a = (a + 0x6d2b79f5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    var rnd = mulberry32(seed);

    function int(min, max) {
        return min + Math.floor(rnd() * (max - min + 1));
    }

    function pick(list) {
        return list[int(0, list.length - 1)];
    }

    function chance(p) {
        return rnd() < p;
    }

    function weighted(table) {
        var total = 0;
        Object.keys(table).forEach(function (k) {
            total += table[k];
        });
        var r = rnd() * total;
        var keys = Object.keys(table);
        for (var i = 0; i < keys.length; i++) {
            r -= table[keys[i]];
            if (r < 0) {
                return keys[i];
            }
        }
        return keys[keys.length - 1];
    }

    function randomAt() {
        return { y: pick(Y), x: pick(X) };
    }

    function randomOffset() {
        if (chance(0.4)) {
            return undefined;
        }
        function value() {
            return pick([
                0,
                int(-40, 40),
                int(-40, 40),
                int(-40, 40),
                String(int(-20, 20)),
                pick(["10%", "-25%", "50%", "100%", "-50%", "0%"]),
            ]);
        }
        return { y: value(), x: value(), mirror: chance(0.5) };
    }

    function randomStick() {
        var kind = weighted({ none: 2, all: 3, edges: 3, bool: 1, omitted: 1 });
        if (kind === "omitted") {
            return undefined;
        }
        if (kind === "none") {
            return pick(["none", false]);
        }
        if (kind === "all") {
            return pick(["all", true]);
        }
        if (kind === "bool") {
            return pick([true, false]);
        }
        var edges = EDGES.filter(function () {
            return chance(0.5);
        });
        return edges.length ? edges.join(" ") : "top";
    }

    function randomScene() {
        var spec = {
            item: {
                left: int(0, 400),
                top: int(0, 400),
                width: int(10, chance(0.1) ? 700 : 250),
                height: int(10, 200),
                border: chance(0.3) ? int(1, 8) : 0,
                padding: chance(0.3) ? int(1, 10) : 0,
            },
            itemById: chance(0.3),
            targetById: chance(0.3),
            boundaryById: chance(0.3),
            scroll: chance(0.3) ? { x: int(0, 300), y: int(0, 400) } : { x: 0, y: 0 },
            itemAt: randomAt(),
            targetAt: randomAt(),
            itemOffset: randomOffset(),
            targetOffset: randomOffset(),
            flip: pick([undefined, "none", "item", "target", "both", "both", true, false]),
            stick: randomStick(),
            variant: { item: randomAt(), target: randomAt() },
            resized: chance(0.5),
        };

        spec.target = { kind: weighted({ element: 70, event: 8, none: 7, missing: 3, document: 7, window: 5 }) };
        spec.target.box = {
            left: int(0, 700),
            top: int(0, 600),
            width: int(10, 200),
            height: int(10, 150),
            border: chance(0.3) ? int(1, 8) : 0,
            padding: chance(0.3) ? int(1, 10) : 0,
        };
        spec.target.page = { x: int(0, 700), y: int(0, 600) };
        spec.target.asString = chance(0.5);

        spec.boundary = { kind: weighted({ element: 70, window: 12, none: 6, missing: 4, document: 3 }) };
        spec.boundary.box = {
            left: int(0, 300),
            top: int(0, 300),
            width: int(100, 600),
            height: int(100, 500),
            border: chance(0.5) ? int(1, 10) : 0,
            padding: chance(0.4) ? int(1, 15) : 0,
            overflow: pick([undefined, undefined, "auto", "scroll", "hidden"]),
        };
        spec.boundary.scroll = { x: int(0, 200), y: int(0, 200) };
        spec.boundary.form = pick(["omitted", "object", "string"]);
        spec.boundary.asString = chance(0.5);

        spec.newSize = {
            item: { width: int(10, 250), height: int(10, 200) },
            target: { width: int(10, 200), height: int(10, 150) },
            boundary: { width: int(100, 600), height: int(100, 500) },
        };
        return spec;
    }

    function describe(spec) {
        return "b:" + spec.boundary.kind + " t:" + spec.target.kind + " flip:" + spec.flip + " stick:" + spec.stick;
    }

    // ////////////////////////////////////////////////////////////////
    // DOM and options for a scene

    function build(spec) {
        var scene = new Scene();
        var ctx = { scene: scene };

        ctx.itemEl = scene.box(spec.item);
        if (spec.target.kind === "element") {
            ctx.targetEl = scene.box(spec.target.box);
        }
        if (spec.boundary.kind === "element") {
            var b = (ctx.boundaryEl = scene.box(spec.boundary.box));
            if (spec.boundary.box.overflow) {
                var filler = document.createElement("div");
                filler.style.cssText = "position:absolute;left:0;top:0;width:900px;height:900px;";
                b.appendChild(filler);
                b.scrollTop = spec.boundary.scroll.y;
                b.scrollLeft = spec.boundary.scroll.x;
            }
        }
        window.scrollTo(spec.scroll.x, spec.scroll.y);

        function ref(el, byId) {
            return byId ? "#" + el.id : el;
        }

        var o = (ctx.options = { item: ref(ctx.itemEl, spec.itemById) });
        switch (spec.target.kind) {
            case "element":
                o.target = ref(ctx.targetEl, spec.targetById);
                break;
            case "event":
                // a constructed event has no scroll in pageX/pageY, so they are set explicitly
                o.target = new MouseEvent("mousemove");
                Object.defineProperty(o.target, "pageX", { value: spec.target.page.x });
                Object.defineProperty(o.target, "pageY", { value: spec.target.page.y });
                break;
            case "none":
                o.target = null;
                break;
            case "missing":
                o.target = "#missing-target";
                break;
            case "document":
                o.target = spec.target.asString ? "document" : document;
                break;
            case "window":
                o.target = spec.target.asString ? "window" : window;
                break;
        }
        switch (spec.boundary.kind) {
            case "element":
                o.boundary = ref(ctx.boundaryEl, spec.boundaryById);
                break;
            case "window":
                if (spec.boundary.form === "object") {
                    o.boundary = window;
                } else if (spec.boundary.form === "string") {
                    o.boundary = "window";
                }
                break;
            case "none":
                o.boundary = null;
                break;
            case "missing":
                o.boundary = "#missing-boundary";
                break;
            case "document":
                o.boundary = spec.boundary.asString ? "document" : document;
                break;
        }
        o.itemAt = spec.itemAt.y + " " + spec.itemAt.x;
        o.targetAt = spec.targetAt.y + " " + spec.targetAt.x;
        ["itemOffset", "targetOffset", "flip", "stick"].forEach(function (key) {
            if (spec[key] !== undefined) {
                o[key] = spec[key];
            }
        });
        return ctx;
    }

    function resizeElements(spec, ctx) {
        function size(el, s) {
            el.style.width = s.width + "px";
            el.style.height = s.height + "px";
        }
        size(ctx.itemEl, spec.newSize.item);
        ctx.targetEl && size(ctx.targetEl, spec.newSize.target);
        ctx.boundaryEl && size(ctx.boundaryEl, spec.newSize.boundary);
    }

    // ////////////////////////////////////////////////////////////////
    // comparison with the reference

    function attempt(fn) {
        try {
            return { value: fn() };
        } catch (e) {
            return { error: String(e) };
        }
    }

    // rounds numbers and derives overflow from the rounded distances, so float noise cannot decide
    function canonical(result) {
        var r = Scene.normalize(result);
        if (r && r.distance) {
            var dst = r.distance;
            var overflow = EDGES.filter(function (edge) {
                return edge === "top" || edge === "left" ? dst[edge] > 0 : dst[edge] < 0;
            });
            dst.overflow = overflow.length ? overflow : null;
        }
        return r;
    }

    function near(a, b) {
        return Math.abs(a - b) <= TOLERANCE;
    }

    function overflowOf(distance) {
        var list = EDGES.filter(function (edge) {
            return edge === "top" || edge === "left" ? distance[edge] > 0 : distance[edge] < 0;
        });
        return list.length ? list : null;
    }

    // ////////////////////////////////////////////////////////////////
    // properties of a correct result

    function isZero(offset) {
        return !offset || (parseFloat(offset.y) === 0 && parseFloat(offset.x) === 0);
    }

    function stickEdges(stick) {
        if (stick === true || stick === "all") {
            return EDGES;
        }
        if (!stick || stick === "none") {
            return [];
        }
        return EDGES.filter(function (edge) {
            return stick.indexOf(edge) !== -1;
        });
    }

    // returns a list of violations. The item is moved with a transform and measured, then restored.
    function violations(spec, ctx, result) {
        var v = [];
        var el = ctx.itemEl;
        var hasTarget =
            spec.target.kind === "element" || spec.target.kind === "event" || spec.target.kind === "document";

        if (!hasTarget) {
            // without target only stick may move the item
            var moved = result.moveBy.x !== 0 || result.moveBy.y !== 0;
            if ((moved && !stickEdges(spec.stick).length) || result.itemAt !== null || result.targetAt !== null) {
                v.push("without target: moveBy must be 0/0 (unless stick) and itemAt/targetAt null");
            }
        } else if (
            !/^(top|middle|bottom) (left|center|right)$/.test(result.itemAt) ||
            !/^(top|middle|bottom) (left|center|right)$/.test(result.targetAt)
        ) {
            v.push("itemAt/targetAt is not a valid placement: " + result.itemAt + " / " + result.targetAt);
        }

        el.style.transform = "translate(" + result.moveBy.x + "px," + result.moveBy.y + "px)";
        var after = Scene.docRect(el);
        el.style.transform = "";

        // boundary distance
        var bnd = null;
        if (spec.boundary.kind === "element") {
            bnd = Scene.innerRect(ctx.boundaryEl);
        } else if (spec.boundary.kind === "window") {
            bnd = Scene.viewport();
        } else if (spec.boundary.kind === "none" || spec.boundary.kind === "missing") {
            if (result.distance !== null) {
                v.push("no boundary: distance must be null");
            }
        }
        if (bnd) {
            var d = result.distance;
            if (!d) {
                v.push("boundary given: distance is missing");
            } else {
                var expected = {
                    top: bnd.top - after.top,
                    left: bnd.left - after.left,
                    bottom: bnd.top + bnd.height - (after.top + after.height),
                    right: bnd.left + bnd.width - (after.left + after.width),
                };
                EDGES.forEach(function (edge) {
                    if (!near(d[edge], expected[edge])) {
                        v.push("distance." + edge + " is " + d[edge] + ", the moved item has " + expected[edge]);
                    }
                });
                var overflow = overflowOf(d);
                if (JSON.stringify(d.overflow) !== JSON.stringify(overflow)) {
                    v.push(
                        "overflow " +
                            JSON.stringify(d.overflow) +
                            " does not match distance " +
                            JSON.stringify(overflow),
                    );
                }

                // stick: an edge that is controlled and that can be satisfied does not overflow
                var fitsY = after.height <= bnd.height + TOLERANCE;
                var fitsX = after.width <= bnd.width + TOLERANCE;
                stickEdges(spec.stick).forEach(function (edge) {
                    var fits = edge === "top" || edge === "bottom" ? fitsY : fitsX;
                    var bad = edge === "top" || edge === "left" ? d[edge] > TOLERANCE : d[edge] < -TOLERANCE;
                    if (fits && bad) {
                        v.push("stick '" + spec.stick + "': edge " + edge + " still overflows by " + d[edge]);
                    }
                });
            }
        }

        if (hasTarget && /^\w+ \w+$/.test(result.itemAt + "") && /^\w+ \w+$/.test(result.targetAt + "")) {
            // flip rules
            var inItem = spec.itemAt;
            var inTarget = spec.targetAt;
            var outItem = result.itemAt.split(" ");
            var outTarget = result.targetAt.split(" ");
            var flip = spec.flip === true ? "both" : spec.flip || "none";
            ["y", "x"].forEach(function (axis, i) {
                var item = outItem[i];
                var target = outTarget[i];
                var itemKept = item === inItem[axis];
                var itemMirrored = item === MIRROR[inItem[axis]];
                var targetKept = target === inTarget[axis];
                var targetMirrored = target === MIRROR[inTarget[axis]];
                var allowed;
                if (flip === "none") {
                    allowed = itemKept && targetKept;
                } else if (flip === "item") {
                    allowed = targetKept && (itemKept || itemMirrored);
                } else if (flip === "target") {
                    allowed = itemKept && (targetKept || targetMirrored);
                } else {
                    // both: item and target flip together
                    allowed = (itemKept && targetKept) || (itemMirrored && targetMirrored);
                }
                if (!allowed) {
                    v.push(
                        "flip '" +
                            flip +
                            "' (" +
                            axis +
                            "): " +
                            inItem[axis] +
                            "/" +
                            inTarget[axis] +
                            " became " +
                            item +
                            "/" +
                            target,
                    );
                }
            });

            // alignment of the reference points, only exact without offsets and stick
            var targetRect = null;
            if (spec.target.kind === "element") {
                targetRect = Scene.docRect(ctx.targetEl);
            } else if (spec.target.kind === "event") {
                targetRect = { left: spec.target.page.x, top: spec.target.page.y, width: 0, height: 0 };
            }
            if (targetRect && isZero(spec.itemOffset) && isZero(spec.targetOffset) && !stickEdges(spec.stick).length) {
                var ip = Scene.point(after, result.itemAt);
                var tp = Scene.point(targetRect, result.targetAt);
                if (!near(ip.x, tp.x) || !near(ip.y, tp.y)) {
                    v.push(
                        "reference point of item (" +
                            ip.x +
                            "," +
                            ip.y +
                            ") is not on the one of the target (" +
                            tp.x +
                            "," +
                            tp.y +
                            ")",
                    );
                }
            }
        }
        return v;
    }

    // ////////////////////////////////////////////////////////////////
    // tests

    var stats = {
        scenes: 0,
        skipped: 0,
        withTarget: 0,
        withDistance: 0,
        overflowLeft: 0,
        flipped: 0,
        stuck: 0,
        referenceViolations: [],
    };

    function atString(at) {
        return at.y + " " + at.x;
    }

    module("validation");

    var specs = [];
    for (var n = 0; n < count; n++) {
        specs.push(randomScene());
    }

    specs.forEach(function (spec, index) {
        test("scene " + index + " " + describe(spec), function () {
            var ctx = build(spec);
            var context = " | scene " + index + ", seed " + seed + ": " + JSON.stringify(spec);

            function compare(label, impl, reference) {
                if (reference.error) {
                    stats.skipped++;
                    ok(true, label + ": skipped, the reference throws (" + reference.error + ")");
                    return false;
                }
                if (impl.error) {
                    ok(false, label + ": the implementation throws: " + impl.error + context);
                    return false;
                }
                var a = canonical(impl.value);
                var b = canonical(reference.value);
                return deepEqual(a, b, label + context);
            }

            try {
                stats.scenes++;
                var v = spec.variant;
                // calcVariant() right after construction uses what the constructor measured
                var freshImpl = Adapter.create(ctx.options);
                var freshRef = Adapter.createReference(ctx.options);
                compare(
                    "calcVariant() on a new instance",
                    attempt(function () {
                        return freshImpl.calcVariant(v.item, v.target);
                    }),
                    attempt(function () {
                        return freshRef.calcVariant(v.item, v.target);
                    }),
                );

                // the reference throws in calculate() for a window target and is left half-refreshed
                if (spec.target.kind === "window") {
                    return;
                }

                var impl = Adapter.create(ctx.options);
                var reference = Adapter.createReference(ctx.options);

                var implResult = attempt(function () {
                    return impl.calculate();
                });
                var refResult = attempt(function () {
                    return reference.calculate();
                });
                var comparable = compare("calculate()", implResult, refResult);

                if (comparable && implResult.value) {
                    violations(spec, ctx, implResult.value).forEach(function (message) {
                        ok(false, "property: " + message + context);
                    });
                    ok(true, "properties checked");
                    stats.withTarget += implResult.value.itemAt ? 1 : 0;
                    stats.withDistance += implResult.value.distance ? 1 : 0;
                    stats.overflowLeft += implResult.value.distance && implResult.value.distance.overflow ? 1 : 0;
                    stats.flipped +=
                        implResult.value.itemAt &&
                        (implResult.value.itemAt !== atString(spec.itemAt) ||
                            implResult.value.targetAt !== atString(spec.targetAt))
                            ? 1
                            : 0;
                    var selfCheck = violations(spec, ctx, refResult.value);
                    if (selfCheck.length) {
                        stats.referenceViolations.push("scene " + index + ": " + selfCheck[0]);
                    }
                    if (stickEdges(spec.stick).length) {
                        var noStick = {};
                        Object.keys(ctx.options).forEach(function (k) {
                            noStick[k] = ctx.options[k];
                        });
                        noStick.stick = "none";
                        var plain = attempt(function () {
                            return Adapter.createReference(noStick).calculate();
                        });
                        stats.stuck +=
                            plain.value && JSON.stringify(plain.value.moveBy) !== JSON.stringify(refResult.value.moveBy)
                                ? 1
                                : 0;
                    }
                }

                compare(
                    "calcVariant()",
                    attempt(function () {
                        return impl.calcVariant(v.item, v.target);
                    }),
                    attempt(function () {
                        return reference.calcVariant(v.item, v.target);
                    }),
                );

                if (spec.resized) {
                    resizeElements(spec, ctx);
                    impl.resize();
                    reference.resize();
                    compare(
                        "calculate() after resize()",
                        attempt(function () {
                            return impl.calculate();
                        }),
                        attempt(function () {
                            return reference.calculate();
                        }),
                    );
                }
            } finally {
                ctx.scene.destroy();
            }
        });
    });

    // keeps the generator honest: the scenes must really exercise overflow, flip and stick
    module("validation generator");

    test("generated scenes cover the interesting cases", function () {
        Report.info(
            "seed " +
                seed +
                ", " +
                stats.scenes +
                " scenes, " +
                stats.skipped +
                " comparisons skipped because the reference throws",
        );
        Report.info(
            "scenes with target " +
                stats.withTarget +
                ", with boundary distance " +
                stats.withDistance +
                ", with overflow left " +
                stats.overflowLeft +
                ", flipped " +
                stats.flipped +
                ", stuck " +
                stats.stuck,
        );
        stats.referenceViolations.slice(0, 5).forEach(function (message) {
            Report.info("reference build violates a property (check the property or the reference): " + message);
        });
        ok(
            stats.referenceViolations.length === 0,
            "the reference build satisfies the properties (" + stats.referenceViolations.length + " violations)",
        );
        if (count >= 100) {
            var min = Math.floor(count * 0.04);
            ok(stats.flipped >= min, "flipped scenes: " + stats.flipped + " >= " + min);
            ok(stats.stuck >= min, "stuck scenes: " + stats.stuck + " >= " + min);
            ok(stats.overflowLeft >= min, "scenes with remaining overflow: " + stats.overflowLeft + " >= " + min);
            ok(stats.withTarget >= count * 0.5, "scenes with target: " + stats.withTarget);
            ok(stats.skipped <= count * 0.5, "skipped comparisons: " + stats.skipped);
        } else {
            ok(true, "fewer than 100 scenes, no coverage thresholds");
        }
    });
})();
