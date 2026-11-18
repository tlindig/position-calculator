// Bundle size of each library through its own entry file in entries/ (esbuild, ESM, es2020, minified).
// Usage: node size.mjs. Result goes to bench/results/size.json.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { build, version } from "esbuild";

const root = join(import.meta.dirname, "..");
const resultsDir = join(import.meta.dirname, "results");

const measure = (name, buf) => ({
    name,
    min: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf).length,
});

const rows = [];
for (const file of readdirSync(join(import.meta.dirname, "entries")).sort()) {
    const res = await build({
        entryPoints: [join(import.meta.dirname, "entries", file)],
        bundle: true,
        minify: true,
        format: "esm",
        target: "es2020",
        write: false,
        define: { "process.env.NODE_ENV": '"production"' },
        legalComments: "none",
        logLevel: "silent",
    });
    rows.push(measure(file.replace(/\.js$/, ""), Buffer.from(res.outputFiles[0].contents)));
}
// second check for this library: the minified file as shipped, no bundling
rows.push(measure("pc-iife-as-shipped", readFileSync(join(root, "dist", "position-calculator.iife.min.js"))));

mkdirSync(resultsDir, { recursive: true });
writeFileSync(
    join(resultsDir, "size.json"),
    JSON.stringify({ esbuild: version, date: new Date().toISOString(), rows }, null, 2),
);
console.table(rows);
console.log("written:", join(resultsDir, "size.json"));
