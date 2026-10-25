#!/usr/bin/env node
/*
 * Builds dist/ from src/: a copy with banner and a minified copy with source map.
 * It does not bundle, so the UMD wrapper of src/position-calculator.js stays the entry point.
 *
 *   node scripts/build.js [OUT_DIR]     default: dist
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const pkg = require("../package.json");

const root = path.join(__dirname, "..");
const entry = path.join(root, "src", "position-calculator.js");
const outDir = path.resolve(process.argv[2] || path.join(root, "dist"));

const banner = [
    "/*!",
    " * jQuery.PositionCalculator",
    ` * ${pkg.homepage}`,
    " *",
    ` * v${pkg.version}`,
    " *",
    ` * License: ${pkg.license}`,
    ` * Author: ${pkg.author}`,
    " */"
].join("\n");

fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(entry, "utf8").replace(/\r\n/g, "\n");
fs.writeFileSync(path.join(outDir, "position-calculator.js"), banner + "\n" + source);

esbuild.buildSync({
    entryPoints: [entry],
    outfile: path.join(outDir, "position-calculator.min.js"),
    minify: true,
    sourcemap: true,
    target: "es5",
    legalComments: "none",
    banner: { js: banner }
});

console.log("built into " + outDir);
