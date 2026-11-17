/*
 * Contrast of the docs colors after WCAG 2.x, computed from the light tokens in docs/assets/docs.css.
 * Run it when a color token changes. Prints a Markdown table.
 *
 *   node test/docs-checks/contrast.js
 *
 * Exit code 0: every pair reaches its ratio. Otherwise 1.
 */
import fs from "node:fs";
import path from "node:path";

const TEXT = 4.5;
const UI = 3;
// label, foreground token, background token, needed ratio (text: 4.5, interface parts and graphics: 3)
const PAIRS = [
    ["text on page", "--color-text", "--color-bg", TEXT],
    ["text on surface (code, panels)", "--color-text", "--color-surface", TEXT],
    ["muted text on page", "--color-muted", "--color-bg", TEXT],
    ["muted text on surface", "--color-muted", "--color-surface", TEXT],
    ["link on page", "--color-link", "--color-bg", TEXT],
    ["link on surface", "--color-link", "--color-surface", TEXT],
    ["value in the code (accent) on surface", "--color-accent", "--color-surface", TEXT],
    ["active navigation entry", "--color-accent-text", "--color-accent", TEXT],
    ["header text and focus ring on header start", "--color-header-text", "--color-header", TEXT],
    ["header text and focus ring on header end", "--color-header-text", "--color-header-end", TEXT],
    ["draft note", "--color-draft-text", "--color-draft", TEXT],
    ["error text on page", "--color-error", "--color-bg", TEXT],
    ["text on the item", "--color-text", "--color-item", TEXT],
    ["text on the target", "--color-target-text", "--color-target", TEXT],
    ["focus ring on page", "--color-focus", "--color-bg", UI],
    ["focus ring on surface", "--color-focus", "--color-surface", UI],
    ["target on stage", "--color-target", "--color-bg", UI],
    ["item border on stage", "--color-item-border", "--color-bg", UI],
    ["item dot on item", "--color-mark-item", "--color-item", UI],
    ["target dot on target", "--color-mark-target", "--color-target", UI],
    ["chart bars of other tools on page", "--color-chart-other", "--color-bg", UI],
    ["chart bars of Position Calculator on page", "--color-accent", "--color-bg", UI],
];

const css = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "docs", "assets", "docs.css"), "utf8");
const tokensOf = (block) =>
    Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
const light = tokensOf(/:root\s*{([^}]*)}/.exec(css)[1]);

const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
function luminance(color) {
    const digits = color.replace("#", "");
    const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
    if (!/^[0-9a-f]{6}$/i.test(full)) {
        throw new Error(`not a hex color: ${color}`);
    }
    const [r, g, b] = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a, b) {
    const [bright, dim] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (bright + 0.05) / (dim + 0.05);
}

const rows = [];
let failed = 0;
for (const [label, foreground, background, needed] of PAIRS) {
    for (const name of [foreground, background]) {
        if (!light[name]) {
            throw new Error(`token ${name} not found in docs.css`);
        }
    }
    const value = ratio(light[foreground], light[background]);
    const passes = value >= needed;
    failed += passes ? 0 : 1;
    const colors = `${light[foreground]} on ${light[background]}`;
    rows.push(`| ${label} | ${colors} | ${value.toFixed(2)} | ${needed} | ${passes ? "pass" : "FAIL"} |`);
}
console.log("| Pair | Colors | Ratio | Needed | Result |");
console.log("| ---- | ------ | ----- | ------ | ------ |");
console.log(rows.join("\n"));
console.log(`\n${rows.length} pairs, ${failed} below the needed ratio`);
process.exitCode = failed ? 1 : 0;
