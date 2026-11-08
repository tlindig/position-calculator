/*
 * Node smoke test, no DOM: the source and the package can be imported (SSR-safe), and import and
 * require() of the package reach the same class. The package check reads dist/, so run `npm run build` first.
 *
 *   node test/node-import.js
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import pkg from "../package.json" with { type: "json" };

const require = createRequire(import.meta.url);

assert.equal(typeof window, "undefined", "this test needs an environment without a DOM");

const source = await import("../src/position-calculator.js");
assert.equal(typeof source.PositionCalculator, "function", "src: named export PositionCalculator");
assert.equal(source.PositionCalculator.defaults.boundary, undefined, "src: no window without a DOM");
assert.equal(new source.PositionCalculator({ item: null }).options.item, null, "src: constructor without DOM");

let imported;
let required;
try {
    imported = await import(pkg.name);
    required = require(pkg.name);
} catch (error) {
    throw new Error("Cannot load the package from dist/. Run `npm run build` first.", { cause: error });
}
assert.equal(typeof imported.PositionCalculator, "function", "import: named export PositionCalculator");
assert.equal(typeof required, "function", "require(): returns the class");
assert.equal(required, imported.PositionCalculator, "import and require() reach the same class");
assert.equal(required.name, "PositionCalculator");

console.log("ok: import and require() of " + pkg.name + ", import of src without a DOM");
