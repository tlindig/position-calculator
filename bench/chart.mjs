// Builds results/chart.svg from results/results.json: ms per round against number of elements, log axes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "results");
const data = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
const colors = {
    pc: "#1f77b4",
    "pc-interleaved": "#1f77b4",
    fui: "#d62728",
    "fui-interleaved": "#d62728",
    popper: "#2ca02c",
    tether: "#9467bd",
    baseline: "#888888",
};
const labels = {
    pc: "this library",
    "pc-interleaved": "this library, read+write per item",
    fui: "Floating UI",
    "fui-interleaved": "Floating UI, read+write per item",
    popper: "Popper",
    tether: "Tether",
    baseline: "baseline (move targets, layout read)",
};
const dashed = new Set(["pc-interleaved", "fui-interleaved", "baseline"]);

const W = 560,
    H = 380,
    L = 62,
    R = 14,
    T = 42,
    B = 48;
const Ns = [1, 10, 100, 500];
const xs = (n) => L + ((Math.log10(n) - 0) / Math.log10(500)) * (W - L - R);
const yMin = Math.log10(0.003),
    yMax = Math.log10(200);
const ys = (v) => T + (1 - (Math.log10(v) - yMin) / (yMax - yMin)) * (H - T - B);

const panel = (variant, title, ox) => {
    const rows = data.rows.filter((r) => r.variant === variant);
    const libs = [...new Set(rows.map((r) => r.lib))];
    let s = `<g transform="translate(${ox},0)"><text x="${L}" y="22" font-size="14" font-weight="bold">${title}</text>`;
    for (const t of [0.01, 0.1, 1, 10, 100]) {
        s += `<line x1="${L}" x2="${W - R}" y1="${ys(t)}" y2="${ys(t)}" stroke="#ddd"/><text x="${L - 6}" y="${ys(t) + 4}" font-size="11" text-anchor="end">${t} ms</text>`;
    }
    for (const n of Ns) {
        s += `<line x1="${xs(n)}" x2="${xs(n)}" y1="${T}" y2="${H - B}" stroke="#eee"/><text x="${xs(n)}" y="${H - B + 16}" font-size="11" text-anchor="middle">${n}</text>`;
    }
    s += `<text x="${(L + W - R) / 2}" y="${H - B + 34}" font-size="12" text-anchor="middle">elements per round</text>`;
    s += `<line x1="${L}" x2="${W - R}" y1="${ys(16.7)}" y2="${ys(16.7)}" stroke="#f90" stroke-dasharray="2 3"/><text x="${W - R - 4}" y="${ys(16.7) - 4}" font-size="10" fill="#f90" text-anchor="end">16.7 ms (one frame at 60 fps)</text>`;
    for (const lib of libs) {
        const pts = Ns.map((n) => rows.find((r) => r.lib === lib && r.N === n)).filter(Boolean);
        const d = pts.map((r, i) => `${i ? "L" : "M"}${xs(r.N).toFixed(1)},${ys(r.median).toFixed(1)}`).join(" ");
        s += `<path d="${d}" fill="none" stroke="${colors[lib]}" stroke-width="2"${dashed.has(lib) ? ' stroke-dasharray="5 3"' : ""}/>`;
        for (const r of pts) {
            s += `<line x1="${xs(r.N)}" x2="${xs(r.N)}" y1="${ys(r.p10)}" y2="${ys(r.p90)}" stroke="${colors[lib]}"/><circle cx="${xs(r.N)}" cy="${ys(r.median)}" r="3" fill="${colors[lib]}"/>`;
        }
    }
    libs.forEach((lib, i) => {
        s += `<line x1="${L + 8}" x2="${L + 26}" y1="${T + 10 + i * 15}" y2="${T + 10 + i * 15}" stroke="${colors[lib]}" stroke-width="2"${dashed.has(lib) ? ' stroke-dasharray="5 3"' : ""}/><text x="${L + 31}" y="${T + 14 + i * 15}" font-size="11">${labels[lib]}</text>`;
    });
    return s + "</g>";
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H + 22}" font-family="sans-serif">
<rect width="100%" height="100%" fill="white"/>
${panel("A", "A: calculate only, no DOM writes", 0)}
${panel("B", "B: targets move, calculate, write, layout read", W)}
<text x="${W}" y="${H + 14}" font-size="10" text-anchor="middle">Chrome ${data.chrome} headless, median with p10 to p90, ${data.rows[0].n} samples per point, ${data.date.slice(0, 10)}. Log scales.</text>
</svg>`;
writeFileSync(join(dir, "chart.svg"), svg);
console.log("written:", join(dir, "chart.svg"), svg.length, "bytes");
