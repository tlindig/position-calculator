#!/usr/bin/env node
/*
 * Builds dist/ from src/:
 *   position-calculator.js            ESM, a copy of the source with banner
 *   position-calculator.iife.min.js   IIFE bundle of src/iife.js (global and jQuery alias), minified,
 *                                     no source map (it was 44 KB for a 7.8 KB bundle)
 *
 *   node scripts/build.js [OUT_DIR]     default: dist
 */
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

const root = path.join(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const entry = path.join(root, "src", "position-calculator.js");
const iifeEntry = path.join(root, "src", "iife.js");
const outDir = path.resolve(process.argv[2] || path.join(root, "dist"));

const banner = [
    "/*!",
    " * PositionCalculator",
    ` * ${pkg.homepage}`,
    " *",
    ` * v${pkg.version}`,
    " *",
    ` * License: ${pkg.license}`,
    ` * Author: ${pkg.author}`,
    " */",
].join("\n");

fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(entry, "utf8").replace(/\r\n/g, "\n");
fs.writeFileSync(path.join(outDir, "position-calculator.js"), banner + "\n" + source);

esbuild.buildSync({
    entryPoints: [iifeEntry],
    outfile: path.join(outDir, "position-calculator.iife.min.js"),
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2020",
    legalComments: "none",
    banner: { js: banner },
});

console.log("built into " + outDir);
