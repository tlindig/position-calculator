#!/usr/bin/env node
/*
 * Consumer check: packs the package, installs the tarball in a temporary project and loads it the way a
 * user does: bundled with esbuild (import, require(), ./iife), in Node, and with tsc (import and require(),
 * module resolution node16, nodenext and bundler). Runs offline and needs the devDependencies of this repo.
 *
 * Every result has an expected value. A result that is wrong but known (see KNOWN) is reported as "known"
 * and does not fail. A result that differs from its expectation fails.
 *
 *   node scripts/check-consumer.js
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import esbuild from "esbuild";

const root = path.join(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pc-consumer-"));
const project = path.join(tmp, "project");
const counts = { ok: 0, known: 0, fail: 0 };

const KNOWN = {
    namespace: "require() in a bundler gives the namespace, Node gives the class (D17)",
    typed: "the types describe the namespace, Node returns the class, so new PC.PositionCalculator() throws",
    node16: "tsc node16 cannot require() an ES module package",
};

function check(name, actual, expected, known) {
    const same = actual === expected;
    const status = same ? (known ? "known" : "ok") : "fail";
    counts[status]++;
    const detail = same
        ? known
            ? ` (${known})`
            : ""
        : `: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
    console.log(`${status.padEnd(5)} ${name}${detail}`);
}

function write(file, contents) {
    fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
    fs.writeFileSync(path.join(project, file), contents);
}

function bundle(contents) {
    const result = esbuild.buildSync({
        stdin: { contents, resolveDir: project },
        bundle: true,
        format: "iife",
        write: false,
        logLevel: "silent",
    });
    return result.outputFiles[0].text;
}

function runBundle(contents, sandbox = {}) {
    vm.runInNewContext(bundle(contents), sandbox);
    return sandbox;
}

function leaves(value) {
    return typeof value === "string" ? [value] : Object.values(value).flatMap(leaves);
}

function tsc(modeArgs, file) {
    const args = [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "--strict"];
    args.push("--target", "es2020", "--lib", "es2020,dom", "--types", "", ...modeArgs, file);
    try {
        execFileSync(process.execPath, args, { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return "";
    } catch (error) {
        const codes = [...new Set(String(error.stdout).match(/(?<=error )TS\d+/g))].sort();
        if (codes.length === 0) {
            throw error;
        }
        return codes.join(",");
    }
}

try {
    const packed = execFileSync("npm", ["pack", "--pack-destination", tmp, "--silent"], {
        cwd: root,
        encoding: "utf8",
    });
    const tarball = path.join(tmp, packed.trim().split("\n").pop());
    write("package.json", JSON.stringify({ name: "consumer-check", version: "0.0.0", private: true }));
    execFileSync("npm", ["install", "--offline", "--no-audit", "--no-fund", tarball], {
        cwd: project,
        stdio: "ignore",
    });

    const installed = path.join(project, "node_modules", pkg.name);
    const manifest = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));

    const named = [manifest.module, manifest.types, ...leaves(manifest.exports), ...manifest.sideEffects];
    const missing = named.filter((file) => file.startsWith("./") && !fs.existsSync(path.join(installed, file)));
    check("package.json: files of module, types, exports and sideEffects exist", missing.join(","), "");

    const esm = runBundle(
        `import { PositionCalculator } from "${pkg.name}"; globalThis.r = typeof PositionCalculator;`,
    );
    check("esbuild, import: named export is a class", esm.r, "function");
    check(
        "esbuild, bare import of the ESM file is dropped (sideEffects)",
        String(bundle(`import "${pkg.name}";`).includes("PositionCalculator")),
        "false",
    );

    const cjs = runBundle(
        `const m = require("${pkg.name}");
         globalThis.r = JSON.stringify({ type: typeof m, named: typeof m.PositionCalculator });`,
    );
    check("esbuild, require(): result", cjs.r, '{"type":"object","named":"function"}', KNOWN.namespace);

    const iife = runBundle(`import "${pkg.name}/iife";`, { window: {} });
    check("esbuild, ./iife: sets window.PositionCalculator", typeof iife.window.PositionCalculator, "function");

    const script = `const m = require("${pkg.name}");
        import("${pkg.name}").then((i) => console.log(JSON.stringify({ type: typeof m, same: m === i.PositionCalculator, named: typeof m.PositionCalculator })));`;
    const node = execFileSync(process.execPath, ["-e", script], {
        cwd: project,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
    });
    const result = JSON.parse(node);
    check("node, require(): returns the class, same as import", `${result.type},${result.same}`, "function,true");
    check("node, require(): property PositionCalculator", result.named, "undefined", KNOWN.typed);

    const importFile = `import { PositionCalculator, type CalculationResult } from "${pkg.name}";
const calculator = new PositionCalculator({ item: "#a", target: "#b", flip: "both" });
export const result: CalculationResult | null = calculator.calculate();
`;
    const requireNamed = `import PC = require("${pkg.name}");
const calculator = new PC.PositionCalculator({ item: "#a", target: "#b", flip: "both" });
export const result = calculator.calculate();
`;
    const requireClass = `import PC = require("${pkg.name}");
const calculator = new PC({ item: "#a", target: "#b", flip: "both" });
export const result = calculator.calculate();
`;
    write("ts/import.mts", importFile);
    write("ts/require-named.cts", requireNamed);
    write("ts/require-class.cts", requireClass);

    // expected tsc error codes per module resolution mode: node16, nodenext, bundler
    const modes = {
        node16: ["--module", "node16", "--moduleResolution", "node16"],
        nodenext: ["--module", "nodenext", "--moduleResolution", "nodenext"],
        bundler: ["--module", "preserve", "--moduleResolution", "bundler"],
    };
    const cases = [
        ["import.mts", { node16: ["", null], nodenext: ["", null], bundler: ["", null] }],
        ["require-named.cts", { node16: ["TS1471", KNOWN.node16], nodenext: ["", null], bundler: ["", null] }],
        [
            "require-class.cts",
            {
                node16: ["TS1471,TS2351", KNOWN.node16],
                nodenext: ["TS2351", KNOWN.typed],
                bundler: ["TS2351", KNOWN.typed],
            },
        ],
    ];
    for (const [file, expectations] of cases) {
        for (const [mode, [expected, known]] of Object.entries(expectations)) {
            check(`tsc ${mode}, ts/${file}: error codes`, tsc(modes[mode], `ts/${file}`), expected, known);
        }
    }
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${counts.ok} ok, ${counts.known} known, ${counts.fail} fail`);
process.exitCode = counts.fail === 0 ? 0 : 1;
