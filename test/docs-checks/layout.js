/*
 * Layout check of every docs page at several widths: a page must not scroll sideways, and a code block with a
 * long line must scroll inside itself. Run it after a change of CSS, markup or page content.
 * Needs `npm run build && npm run docs:build` and Google Chrome (Playwright channel "chrome").
 *
 *   node test/docs-checks/layout.js [--widths=360,768,1280] [--pages=index.html,playground.html]
 *
 * Exit code 0: no page scrolls sideways and no code block is cut off. Otherwise 1.
 */
import { chromium } from "playwright";
import { startServer } from "../support/server.js";
import { option, pages, READY, site } from "./support.js";

const widths = (option("widths") ?? "360,768,1280").split(",").map(Number);

// runs in the page. Elements inside a scrolling or clipping parent may reach past the window, so they do not count
const MEASURE = `(() => {
    const root = document.documentElement;
    const clipped = (element) => {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (getComputedStyle(parent).overflowX !== "visible") {
                return true;
            }
        }
        return false;
    };
    const describe = (element) => {
        const name = (element.getAttribute("class") ?? "").trim().split(/\\s+/)[0];
        return element.tagName.toLowerCase() + (name ? "." + name : "");
    };
    const offenders = [...document.body.querySelectorAll("*")]
        .filter((element) => element.getBoundingClientRect().right > root.clientWidth + 0.5 && !clipped(element))
        .slice(0, 3)
        .map(describe);
    const blocks = [...document.querySelectorAll("main pre")];
    const scrolling = blocks.filter((block) => block.scrollWidth > block.clientWidth);
    return {
        pageScroll: root.scrollWidth - root.clientWidth,
        offenders,
        blocks: blocks.length,
        scrolling: scrolling.length,
        cut: scrolling.filter((block) => !["auto", "scroll"].includes(getComputedStyle(block).overflowX)).length,
    };
})()`;

const server = await startServer(site);
const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
let failed = 0;
for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const name of pages()) {
        const page = await context.newPage();
        await page.goto(`${server.baseUrl}/${name}`);
        await page.waitForFunction(READY);
        const m = await page.evaluate(MEASURE);
        const passes = m.pageScroll <= 0 && m.cut === 0;
        failed += passes ? 0 : 1;
        const result = passes ? "pass" : `FAIL ${m.offenders.join(", ")}`;
        rows.push(`| ${name} | ${width} | ${m.pageScroll} | ${m.scrolling}/${m.blocks} | ${m.cut} | ${result} |`);
        await page.close();
    }
    await context.close();
}
await browser.close();
await server.close();
console.log("| Page | Width | Sideways scroll (px) | Code blocks scrolling/total | Cut off | Result |");
console.log("| ---- | ----- | -------------------- | --------------------------- | ------- | ------ |");
console.log(rows.join("\n"));
console.log(`\n${rows.length} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
