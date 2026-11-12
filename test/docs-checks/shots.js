/*
 * Screenshots of every docs page, in light and dark mode, at several widths, for design reviews.
 * Needs `npm run build && npm run docs:build` and Google Chrome (Playwright channel "chrome").
 *
 *   node test/docs-checks/shots.js --out=DIR [--widths=1280,375] [--pages=index.html,playground.html]
 *
 * Exit code 0: all shots taken, no page error, no widget in state "error". Otherwise 1.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startServer } from "../support/server.js";
import { FAILED, option, pages, READY, site } from "./support.js";

const out = option("out");
if (!out) {
    console.error("Missing --out=DIR");
    process.exit(1);
}
const widths = (option("widths") ?? "1280,375").split(",").map(Number);

fs.mkdirSync(out, { recursive: true });
const server = await startServer(site);
const browser = await chromium.launch({ channel: "chrome" });
const problems = [];
let count = 0;
for (const colorScheme of ["light", "dark"]) {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
        for (const name of pages()) {
            const page = await context.newPage();
            page.on("pageerror", (error) => problems.push(`${name}: ${error}`));
            await page.goto(`${server.baseUrl}/${name}`);
            await page.waitForFunction(READY);
            const failed = await page.evaluate(FAILED);
            if (failed) {
                problems.push(`${name}: ${failed} widget(s) in state error`);
            }
            const file = `${colorScheme}-${width}-${name.replace(/\.html$/, "").replaceAll("/", "_")}.png`;
            await page.screenshot({ path: path.join(out, file), fullPage: true });
            count++;
            await page.close();
        }
        await context.close();
    }
}
await browser.close();
await server.close();
console.log(`${count} screenshots in ${out}`);
problems.forEach((text) => console.log("problem: " + text));
process.exitCode = problems.length ? 1 : 0;
