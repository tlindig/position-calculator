// Timing of N positions per round in headless Chrome.
// Usage: node bench.mjs [maxN] [overflow|extra]. Results go to bench/results/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { findChrome } from "./chrome.mjs";

const maxN = Number(process.argv[2] || 500);
const mode = process.argv[3];
if (mode !== undefined && mode !== "overflow" && mode !== "extra") {
    throw new Error(`Unknown scene "${mode}". Use "overflow" or "extra", or leave it out.`);
}
const extra = mode === "extra";
const scene = mode === "overflow" ? "overflow" : "normal";
const resultsDir = join(import.meta.dirname, "results");

const bundle = await build({
    entryPoints: [join(import.meta.dirname, "harness.js")],
    bundle: true,
    format: "iife",
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
});

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const version = browser.version();
const page = await browser.newPage({ viewport: { width: 2300, height: 2300 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.setContent("<!doctype html><html><body></body></html>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });

const stat = (a) => {
    const s = [...a].sort((x, y) => x - y);
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { median: q(0.5), p10: q(0.1), p90: q(0.9), min: s[0], max: s[s.length - 1] };
};

const plan =
    scene === "overflow"
        ? {
              A: [{ lib: "pc" }, { lib: "fui" }],
              B: [{ lib: "pc" }, { lib: "pc-noflip" }, { lib: "fui" }, { lib: "popper" }, { lib: "tether" }],
          }
        : extra
          ? {
                A: [{ lib: "pc" }, { lib: "fui" }, { lib: "fui-bare" }, { lib: "fui-par" }],
                B: [{ lib: "pc" }, { lib: "fui" }, { lib: "fui-bare" }, { lib: "fui-par" }],
            }
          : {
                A: [{ lib: "pc" }, { lib: "fui" }],
                B: [
                    { lib: "baseline" },
                    { lib: "pc" },
                    { lib: "pc", mode: "interleaved" },
                    { lib: "fui" },
                    { lib: "fui", mode: "interleaved" },
                    { lib: "popper" },
                    { lib: "tether" },
                ],
            };
const Ns = [1, 10, 100, 500].filter((n) => n <= maxN);
const PASSES = 3;
const PER_PASS = 10;
const rows = [];
for (const variant of ["A", "B"]) {
    for (const N of Ns) {
        const reps = Math.max(1, Math.round(300 / N));
        const entries = plan[variant].map((e) => ({
            ...e,
            key: e.mode ? `${e.lib}-${e.mode}` : e.lib,
            all: [],
            dev: 0,
        }));
        for (let p = 0; p < PASSES; p++) {
            // rotate the order per pass
            const order = entries.map((_, i) => entries[(i + p) % entries.length]);
            for (const e of order) {
                const t0 = Date.now();
                const res = await page.evaluate((a) => window.H.run(a), {
                    lib: e.lib,
                    N,
                    variant,
                    mode: e.mode,
                    samples: PER_PASS,
                    reps,
                    scene,
                });
                e.all.push(...res.samples);
                if (res.dev != null) {
                    e.dev = Math.max(e.dev, res.dev);
                }
                console.error(`${variant} N=${N} pass=${p} ${e.key} ${Date.now() - t0} ms wall`);
            }
        }
        for (const e of entries) {
            rows.push({
                variant,
                N,
                lib: e.key,
                reps,
                ...stat(e.all),
                n: e.all.length,
                maxDeviationPx: variant === "B" && e.lib !== "baseline" ? Number(e.dev.toFixed(2)) : null,
            });
        }
    }
}
const file = scene === "overflow" ? "results-overflow.json" : extra ? "results-fui-extra.json" : "results.json";
mkdirSync(resultsDir, { recursive: true });
writeFileSync(
    join(resultsDir, file),
    JSON.stringify({ chrome: version, date: new Date().toISOString(), scene, errors, rows }, null, 2),
);
await browser.close();
console.table(
    rows.map((r) => ({
        v: r.variant,
        N: r.N,
        lib: r.lib,
        med_ms: +r.median.toFixed(3),
        p10: +r.p10.toFixed(3),
        p90: +r.p90.toFixed(3),
        dev: r.maxDeviationPx,
    })),
);
console.log("written:", join(resultsDir, file));
console.log("errors:", errors.length);
