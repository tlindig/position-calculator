/*
 * Cross-browser spike: opens the test pages of test/run.js in Firefox and WebKit with Playwright and
 * reads the same window.TestResult. Needs `npm run build` (IIFE pages) and the installed browsers
 * (`npx playwright install firefox webkit`).
 *
 *   node test/cross-browser.js [--browsers=firefox,webkit]
 *
 * Exit code 0: no failure outside "[target]" modules, no page error. Otherwise 1.
 */
import path from "node:path";
import { firefox, webkit } from "playwright";
import { startServer } from "./support/server.js";

const root = path.join(import.meta.dirname, "..");
const TIMEOUT_MS = 300 * 1000;
const IIFE = "impl=/dist/position-calculator.iife.min.js&format=iife";
const PAGES = [
    ["dev, source (ESM)", "/test/position-calculator.html?jquery=0"],
    ["validation, source (ESM)", "/test/validation.html?jquery=0&seed=1&n=2000"],
    ["dev, IIFE build", `/test/position-calculator.html?jquery=0&${IIFE}`],
    ["validation, IIFE build", `/test/validation.html?jquery=0&seed=1&n=2000&${IIFE}`],
];
const ENGINES = { firefox, webkit };

const requested = /--browsers=(\S+)/.exec(process.argv.join(" "));
const names = requested ? requested[1].split(",") : Object.keys(ENGINES);

async function runPage(browser, url) {
    // inner size of the Chrome that test/run.js starts with --window-size=1200,900
    const page = await browser.newPage({ viewport: { width: 1200, height: 813 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    try {
        await page.goto(url);
        await page.waitForFunction("window.TestDone", null, { timeout: TIMEOUT_MS });
        return { result: await page.evaluate("window.TestResult"), pageErrors };
    } finally {
        await page.close();
    }
}

const server = await startServer(root);
let failed = false;
for (const name of names) {
    let browser;
    try {
        browser = await ENGINES[name].launch();
    } catch (error) {
        console.log(`${name}: launch failed: ${String(error.message).split("\n")[0]}`);
        failed = true;
        continue;
    }
    console.log(`${name} ${browser.version()}`);
    for (const [label, url] of PAGES) {
        try {
            const { result, pageErrors } = await runPage(browser, server.baseUrl + url);
            const isTarget = (entry) => entry.module.startsWith("[target]");
            const failing = result.tests.filter((entry) => entry.failed && !isTarget(entry));
            const todo = result.tests.filter((entry) => entry.failed && isTarget(entry));
            console.log(
                `  ${label}: ${result.tests.length} tests, ${failing.length} failed, ${todo.length} todo, ` +
                    `${pageErrors.length} page errors`,
            );
            result.info.forEach((text) => console.log("    " + text));
            failing.slice(0, 5).forEach((entry) => console.log(`    FAIL ${entry.module} :: ${entry.name}`));
            pageErrors.forEach((text) => console.log("    page error: " + text));
            failed ||= failing.length > 0 || pageErrors.length > 0;
        } catch (error) {
            console.log(`  ${label}: ${String(error.message).split("\n")[0]}`);
            failed = true;
        }
    }
    await browser.close();
}
await server.close();
process.exitCode = failed ? 1 : 0;
