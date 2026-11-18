// Counts layout-relevant DOM reads and inline style writes of PositionCalculator. No timing.
// Usage: node count.mjs. Result goes to bench/results/count.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { findChrome } from "./chrome.mjs";

const dist = join(import.meta.dirname, "..", "dist", "position-calculator.js");
const resultsDir = join(import.meta.dirname, "results");
const lib = await build({
    stdin: {
        contents: `import { PositionCalculator } from ${JSON.stringify(dist)}; window.PC = PositionCalculator;`,
        resolveDir: import.meta.dirname,
    },
    bundle: true,
    format: "iife",
    write: false,
    logLevel: "silent",
});

const instrument = () => {
    const C = {};
    const hit = (k) => (C[k] = (C[k] || 0) + 1);
    window.__C = C;
    window.__snap = () => {
        const s = { ...C };
        for (const k in C) {
            delete C[k];
        }
        return s;
    };
    const wrapGetter = (proto, name) => {
        const d = Object.getOwnPropertyDescriptor(proto, name);
        Object.defineProperty(proto, name, {
            ...d,
            get() {
                hit(name);
                return d.get.call(this);
            },
        });
    };
    for (const n of [
        "clientTop",
        "clientLeft",
        "clientWidth",
        "clientHeight",
        "scrollTop",
        "scrollLeft",
        "scrollWidth",
        "scrollHeight",
    ]) {
        wrapGetter(Element.prototype, n);
    }
    for (const n of ["offsetWidth", "offsetHeight", "offsetTop", "offsetLeft"]) {
        wrapGetter(HTMLElement.prototype, n);
    }
    for (const n of ["pageXOffset", "pageYOffset"]) {
        wrapGetter(window, n);
    }
    const gbcr = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
        hit("getBoundingClientRect");
        return gbcr.call(this);
    };
    const gcs = window.getComputedStyle;
    window.getComputedStyle = function (...a) {
        hit("getComputedStyle");
        return gcs.apply(this, a);
    };
    // Chrome defines the style properties per style object, so count writes through a Proxy on the style getter
    let owner = HTMLElement.prototype;
    while (owner && !Object.getOwnPropertyDescriptor(owner, "style")) {
        owner = Object.getPrototypeOf(owner);
    }
    const sd = Object.getOwnPropertyDescriptor(owner, "style");
    const counted = new Set(["position", "visibility", "display"]);
    Object.defineProperty(owner, "style", {
        ...sd,
        get() {
            const target = sd.get.call(this);
            return new Proxy(target, {
                get(t, p) {
                    const v = t[p];
                    return typeof v === "function" ? v.bind(t) : v;
                },
                set(t, p, v) {
                    if (counted.has(p)) {
                        hit("styleWrite");
                    }
                    t[p] = v;
                    return true;
                },
            });
        },
    });
};

const scenes = () => {
    const box = (css, parent = document.body) => {
        const el = document.createElement("div");
        el.style.cssText = css;
        parent.appendChild(el);
        return el;
    };
    const total = (s) => Object.values(s).reduce((a, b) => a + b, 0);
    const pack = (s) => {
        const layout = total(s) - (s.styleWrite || 0);
        return { ...s, layoutReads: layout, styleWrites: s.styleWrite || 0 };
    };
    const run = (name, make, calcs = 1) => {
        document.body.innerHTML = "";
        document.body.style.cssText = "margin:0;height:3000px;width:2000px";
        const o = make();
        window.__snap();
        const c = new window.PC(o);
        const ctor = pack(window.__snap());
        c.resize();
        const resize = pack(window.__snap());
        let r;
        for (let i = 0; i < calcs; i++) {
            r = c.calculate();
        }
        const calc = pack(window.__snap());
        return {
            name,
            ctor,
            resize,
            calc,
            result: r && { moveBy: r.moveBy, overflow: r.distance && r.distance.overflow },
        };
    };
    const out = [];
    out.push(
        run("S1 visible item+target, window boundary", () => ({
            item: box("position:absolute;width:100px;height:40px"),
            target: box("position:absolute;left:300px;top:200px;width:80px;height:30px"),
        })),
    );
    out.push(
        run("S2 as S1, element boundary", () => {
            const b = box("position:absolute;left:50px;top:50px;width:600px;height:400px;overflow:auto");
            return {
                item: box("position:absolute;width:100px;height:40px", b),
                target: box("position:absolute;left:300px;top:200px;width:80px;height:30px", b),
                boundary: b,
            };
        }),
    );
    out.push(
        run("S3 hidden item (display:none), window boundary", () => ({
            item: box("display:none;width:100px;height:40px"),
            target: box("position:absolute;left:300px;top:200px;width:80px;height:30px"),
        })),
    );
    out.push(
        run("S4 target = mouse-like event, window boundary", () => ({
            item: box("position:absolute;width:100px;height:40px"),
            target: { preventDefault() {}, pageX: 100, pageY: 100 },
        })),
    );
    out.push(
        run("S5 target = 'document', boundary null", () => ({
            item: box("position:absolute;width:100px;height:40px"),
            target: "document",
            boundary: null,
        })),
    );
    out.push(
        run("S6 no target, no boundary", () => ({
            item: box("position:absolute;width:100px;height:40px"),
            boundary: null,
        })),
    );
    out.push(
        run("S7 overflow with flip both + stick all", () => ({
            item: box("position:absolute;width:300px;height:200px"),
            target: box(
                "position:absolute;left:" +
                    (innerWidth - 20) +
                    "px;top:" +
                    (innerHeight - 20) +
                    "px;width:80px;height:30px",
            ),
            flip: "both",
            stick: "all",
            itemAt: "top left",
            targetAt: "bottom right",
        })),
    );
    out.push(
        run("S8 target = 'window', window boundary", () => ({
            item: box("position:absolute;width:100px;height:40px"),
            target: "window",
        })),
    );
    // 100 items, one shared target, one calculate() each (a frame of a game loop)
    document.body.innerHTML = "";
    const target = box("position:absolute;left:300px;top:200px;width:80px;height:30px");
    const calcs = [];
    window.__snap();
    for (let i = 0; i < 100; i++) {
        calcs.push(new window.PC({ item: box("position:absolute;width:20px;height:20px"), target }));
    }
    const ctor100 = pack(window.__snap());
    calcs.forEach((c) => c.calculate());
    const calc100 = pack(window.__snap());
    calcs.forEach((c) => c.resize());
    const resize100 = pack(window.__snap());
    out.push({
        name: "S9 100 items, 1 shared element target, window boundary",
        ctor: ctor100,
        resize: resize100,
        calc: calc100,
    });
    return out;
};

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const version = browser.version();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setContent("<!doctype html><html><body></body></html>");
await page.evaluate(instrument);
await page.addScriptTag({ content: lib.outputFiles[0].text });
const res = await page.evaluate(scenes);
await browser.close();

mkdirSync(resultsDir, { recursive: true });
writeFileSync(
    join(resultsDir, "count.json"),
    JSON.stringify({ chrome: version, date: new Date().toISOString(), errors, scenes: res }, null, 2),
);
console.table(
    res.map((s) => ({
        scene: s.name,
        "ctor reads": s.ctor.layoutReads,
        "resize() reads": s.resize.layoutReads,
        "calculate() reads": s.calc.layoutReads,
        "ctor writes": s.ctor.styleWrites,
        "resize() writes": s.resize.styleWrites,
    })),
);
console.log("written:", join(resultsDir, "count.json"));
console.log("pageerrors:", errors.length, errors.join("|"));
