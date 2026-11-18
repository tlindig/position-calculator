// Runs inside the page. Bundled with esbuild together with the libraries.
import { PositionCalculator } from "../dist/position-calculator.js";
import { computePosition, flip, shift } from "@floating-ui/dom";
import { createPopper } from "@popperjs/core";
import Tether from "tether";

const COLS = 20;
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const layout = () => document.body.offsetHeight;

const VIEW = 2300;

// overflow scene: even targets sit at the right edge, odd targets at the bottom edge, so an item below and right of its target overflows
function build(N, overflow) {
    document.body.innerHTML = "";
    document.body.style.cssText = overflow
        ? `margin:0;position:relative;width:${VIEW}px;height:${VIEW}px`
        : "margin:0;position:relative;width:2200px;height:2200px";
    const targets = [];
    const items = [];
    for (let i = 0; i < N; i++) {
        const t = document.createElement("div");
        let left = (i % COLS) * 100 + 10;
        let top = Math.floor(i / COLS) * 80 + 10;
        if (overflow) {
            const k = i >> 1;
            if (i % 2 === 0) {
                left = VIEW - 70;
                top = 10 + (k % 25) * 80;
            } else {
                left = 10 + (k % 20) * 100;
                top = VIEW - 34;
            }
        }
        t.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:60px;height:24px`;
        const it = document.createElement("div");
        it.style.cssText = "position:absolute;left:0;top:0;width:80px;height:30px";
        document.body.append(t, it);
        targets.push(t);
        items.push(it);
    }
    return { targets, items };
}

const fuiOpts = { placement: "bottom-start", strategy: "absolute", middleware: [flip(), shift()] };

// Each factory returns { compute, apply, destroy }.
// compute: calculate all positions, no DOM writes (only where the library can do that).
// apply: calculate and write all positions, reads first and writes after.
const factories = {
    pc(items, targets) {
        const pcs = items.map(
            (item, i) =>
                new PositionCalculator({
                    item,
                    target: targets[i],
                    itemAt: "top left",
                    targetAt: "bottom left",
                    flip: "both",
                    stick: "all",
                    ...(globalThis.__pcOverride || {}),
                }),
        );
        const tx = new Float64Array(items.length);
        const ty = new Float64Array(items.length);
        const write = (i, r) => {
            tx[i] += r.moveBy.x;
            ty[i] += r.moveBy.y;
            items[i].style.transform = `translate(${tx[i]}px,${ty[i]}px)`;
        };
        return {
            compute: async () => pcs.map((c) => c.calculate()),
            apply: async () => {
                const res = pcs.map((c) => c.calculate());
                res.forEach((r, i) => write(i, r));
            },
            applyInterleaved: async () => {
                pcs.forEach((c, i) => write(i, c.calculate()));
            },
            destroy() {},
        };
    },
    fui(items, targets) {
        const write = (it, r) => {
            it.style.transform = `translate(${r.x}px,${r.y}px)`;
        };
        return {
            compute: async () => {
                const res = [];
                for (let i = 0; i < items.length; i++) {
                    res.push(await computePosition(targets[i], items[i], fuiOpts));
                }
                return res;
            },
            apply: async () => {
                const res = [];
                for (let i = 0; i < items.length; i++) {
                    res.push(await computePosition(targets[i], items[i], fuiOpts));
                }
                res.forEach((r, i) => write(items[i], r));
            },
            applyInterleaved: async () => {
                for (let i = 0; i < items.length; i++) {
                    write(items[i], await computePosition(targets[i], items[i], fuiOpts));
                }
            },
            destroy() {},
        };
    },
    popper(items, targets) {
        const ps = items.map((it, i) =>
            createPopper(targets[i], it, { placement: "bottom-start", strategy: "absolute" }),
        );
        return {
            apply: async () => ps.forEach((p) => p.forceUpdate()),
            destroy: () => ps.forEach((p) => p.destroy()),
        };
    },
    tether(items, targets) {
        const ts = items.map(
            (element, i) =>
                new Tether({
                    element,
                    target: targets[i],
                    attachment: "top left",
                    targetAttachment: "bottom left",
                    constraints: [{ to: "window", attachment: "together", pin: true }],
                }),
        );
        return {
            apply: async () => Tether.position(),
            destroy: () => ts.forEach((t) => t.destroy()),
        };
    },
    // targets move and a layout read happens, nothing else
    baseline() {
        return { apply: async () => {}, compute: async () => {}, destroy() {} };
    },
};

// Floating UI variants for the counter check: without middleware, and with Promise.all instead of awaiting one by one.
const fuiVariant = (opts, parallel) => (items, targets) => {
    const seq = async () => {
        const res = [];
        for (let i = 0; i < items.length; i++) {
            res.push(await computePosition(targets[i], items[i], opts));
        }
        return res;
    };
    const all = () => (parallel ? Promise.all(items.map((it, i) => computePosition(targets[i], it, opts))) : seq());
    return {
        compute: all,
        apply: async () => {
            const res = await all();
            res.forEach((r, i) => {
                items[i].style.transform = `translate(${r.x}px,${r.y}px)`;
            });
        },
        destroy() {},
    };
};
factories["fui-bare"] = fuiVariant({ placement: "bottom-start", strategy: "absolute" }, false);
factories["fui-par"] = fuiVariant(fuiOpts, true);

// overflow scene: how far an item sticks out of the window after the last round
const maxOutside = (items) => {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    let m = 0;
    for (const it of items) {
        const r = it.getBoundingClientRect();
        m = Math.max(m, -r.left, r.right - w, -r.top, r.bottom - h);
    }
    return m;
};

const maxDeviation = (items, targets) => {
    let m = 0;
    for (let i = 0; i < items.length; i++) {
        const a = items[i].getBoundingClientRect();
        const b = targets[i].getBoundingClientRect();
        m = Math.max(m, Math.abs(a.top - b.bottom), Math.abs(a.left - b.left));
    }
    return m;
};

// variant "A": compute only. variant "B": targets move, calculate and write, layout read at the end.
window.H = {
    async run({ lib, N, variant, mode, samples, reps, scene }) {
        const overflow = scene === "overflow";
        const { targets, items } = build(N, overflow);
        globalThis.__pcOverride = lib === "pc-noflip" ? { flip: "none", stick: "none" } : null;
        const inst = factories[lib === "pc-noflip" ? "pc" : lib](items, targets);
        await tick(60); // Popper and Tether position once asynchronously
        let r = 0;
        const move = () => {
            const x = r % 7;
            const y = r % 5;
            r++;
            for (let i = 0; i < targets.length; i++) {
                targets[i].style.transform = `translate(${x}px,${y}px)`;
            }
        };
        const fn = variant === "A" ? inst.compute : mode === "interleaved" ? inst.applyInterleaved : inst.apply;
        const one = async () => {
            if (variant === "B") {
                move();
            }
            await fn();
            if (variant === "B") {
                layout();
            }
        };
        for (let i = 0; i < 3; i++) {
            await one();
        }
        const out = [];
        for (let s = 0; s < samples; s++) {
            const t0 = performance.now();
            for (let k = 0; k < reps; k++) {
                await one();
            }
            out.push((performance.now() - t0) / reps);
        }
        const dev =
            variant === "B" && lib !== "baseline"
                ? overflow
                    ? maxOutside(items)
                    : maxDeviation(items, targets)
                : null;
        inst.destroy();
        return { samples: out, dev };
    },
};
