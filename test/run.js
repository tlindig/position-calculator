#!/usr/bin/env node
/*
 * Runs the browser test pages in headless Chrome (DevTools protocol, no dependencies besides Node >= 22
 * and Chrome) and reports every browser test as a subtest of node:test.
 *
 *   node test/run.js [dev|validation|docs|all] [--seed=N] [--n=COUNT] [--impl=FILE] [--format=esm|iife]
 *                    [--jquery=0|1] [--chrome=PATH] [--no-sandbox] [--timeout=SECONDS]
 *
 * The pages are served from the project root by a local HTTP server, because browsers do not load
 * ES modules from file: URLs. --impl is a file inside the project. --format tells how the browser
 * loads it: an ES module (default) or a classic script (the IIFE build).
 *
 * "docs" builds the documentation site with --impl as its library (default src/position-calculator.js) into
 * a temporary directory, opens every try-it area and runs the scenarios of the examples. It needs an ES
 * module, so "all" leaves it out for --format=iife.
 *
 * Exit code 0: no failure outside "[target]" modules (reported as todo). Otherwise 1.
 * Validation scenes are random. The seed is printed, pass --seed=N to reproduce a run.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, before, after } from "node:test";
import { startServer } from "./support/server.js";

const root = path.join(import.meta.dirname, "..");
const PAGES = { dev: "position-calculator.html", validation: "validation.html" };
const TARGETS = [...Object.keys(PAGES), "docs"];
const DOCS_WAIT_MS = 15000;
const DOCS_TOLERANCE_PX = 1;
const MAX_FAILURES_PER_TEST = 3;

const options = {};
let targets = [];
for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) {
        options[match[1]] = match[2] === undefined ? "1" : match[2];
    } else {
        targets.push(arg);
    }
}
if (!targets.length || targets.includes("all")) {
    targets = options.format === "iife" ? Object.keys(PAGES) : TARGETS;
}
options.seed = options.seed || String(crypto.randomBytes(4).readUInt32BE(0));
const timeoutMs = (Number(options.timeout) || 300) * 1000;

function findChrome() {
    const candidates = [options.chrome, process.env.CHROME, "google-chrome", "chromium", "chromium-browser"];
    for (const candidate of candidates) {
        if (candidate && spawnSync(candidate, ["--version"]).status === 0) {
            return candidate;
        }
    }
    throw new Error("Chrome not found. Use --chrome=PATH or set CHROME.");
}

function pageUrl(baseUrl, name) {
    const params = new URLSearchParams();
    if (options.impl) {
        const relative = path.relative(root, path.resolve(options.impl));
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error("--impl must be a file inside the project: " + options.impl);
        }
        params.set("impl", "/" + relative.split(path.sep).join("/"));
    }
    if (options.format) {
        params.set("format", options.format);
    }
    if (options.jquery) {
        params.set("jquery", options.jquery);
    }
    if (name === "validation") {
        params.set("seed", options.seed);
        if (options.n) {
            params.set("n", options.n);
        }
    }
    const query = params.toString();
    return baseUrl + "/test/" + PAGES[name] + (query ? "?" + query : "");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, what) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s: ${what}`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

async function launchChrome(chrome) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pc-test-"));
    const args = [
        "--headless",
        "--disable-gpu",
        "--remote-debugging-port=0",
        "--user-data-dir=" + profile,
        "--window-size=1200,900",
        "--no-first-run",
        "--no-default-browser-check",
    ];
    if (options["no-sandbox"]) {
        args.push("--no-sandbox");
    }
    args.push("about:blank");
    const child = spawn(chrome, args, { stdio: "ignore" });
    const exited = new Promise((resolve) => child.once("exit", resolve));

    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; i < 300 && !fs.existsSync(portFile); i++) {
        if (child.exitCode !== null) {
            throw new Error("Chrome exited during start-up (code " + child.exitCode + ").");
        }
        await sleep(50);
    }
    if (!fs.existsSync(portFile)) {
        child.kill();
        throw new Error("Chrome did not publish its DevTools port.");
    }
    const port = fs.readFileSync(portFile, "utf8").split("\n")[0];

    return {
        port,
        async close() {
            child.kill();
            await exited;
            fs.rmSync(profile, { recursive: true, force: true });
        },
    };
}

function connect(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const pending = new Map();
        const listeners = [];
        let nextId = 0;
        ws.onerror = () => reject(new Error("DevTools connection failed: " + wsUrl));
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const call = pending.get(message.id);
                pending.delete(message.id);
                if (message.error) {
                    call.reject(new Error(message.error.message));
                } else {
                    call.resolve(message.result);
                }
            } else {
                listeners.forEach((listener) => listener(message));
            }
        };
        ws.onopen = () =>
            resolve({
                send(method, params = {}) {
                    return new Promise((res, rej) => {
                        const id = ++nextId;
                        pending.set(id, { resolve: res, reject: rej });
                        ws.send(JSON.stringify({ id, method, params }));
                    });
                },
                on(listener) {
                    listeners.push(listener);
                },
                close() {
                    ws.close();
                },
            });
    });
}

async function runPage(browser, name) {
    const targetsResponse = await fetch(`http://127.0.0.1:${browser.port}/json/list`);
    const page = (await targetsResponse.json()).find((target) => target.type === "page");
    const cdp = await connect(page.webSocketDebuggerUrl);
    const pageErrors = [];
    try {
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        const loaded = new Promise((resolve) =>
            cdp.on((message) => {
                if (message.method === "Page.loadEventFired") {
                    resolve();
                }
            }),
        );
        cdp.on((message) => {
            if (message.method === "Runtime.exceptionThrown") {
                const details = message.params.exceptionDetails;
                pageErrors.push((details.exception && details.exception.description) || details.text);
            }
        });
        // eslint-disable-next-line no-use-before-define -- runPage runs after before() has set server
        await cdp.send("Page.navigate", { url: pageUrl(server.baseUrl, name) });
        await withTimeout(loaded, timeoutMs, "page " + name + " did not load");

        const evaluation = cdp.send("Runtime.evaluate", {
            awaitPromise: true,
            returnByValue: true,
            expression: `new Promise(function(resolve) {
                if (window.TestDone) { resolve(window.TestResult); }
                else { window.addEventListener("testdone", function() { resolve(window.TestResult); }); }
            })`,
        });
        const { result } = await withTimeout(
            evaluation,
            timeoutMs,
            "page " + name + " published no result. Page errors: " + (pageErrors.join(" | ") || "none"),
        );
        return { result: result.value, pageErrors };
    } finally {
        cdp.close();
    }
}

function describeFailures(failures) {
    const shown = failures
        .slice(0, MAX_FAILURES_PER_TEST)
        .map(
            (failure) =>
                `${failure.message}\n  expected: ${JSON.stringify(failure.expected)}\n  actual:   ${JSON.stringify(failure.actual)}`,
        );
    if (failures.length > shown.length) {
        shown.push(`(${failures.length - shown.length} more)`);
    }
    return shown.join("\n");
}

function buildDocs(outDir) {
    const library = path.resolve(options.impl || path.join(root, "src/position-calculator.js"));
    const build = spawnSync(
        process.execPath,
        [path.join(root, "scripts/build-docs.js"), "--out=" + outDir, "--library=" + library],
        { encoding: "utf8" },
    );
    if (build.status !== 0) {
        throw new Error("The docs build failed:\n" + build.stdout + build.stderr);
    }
}

async function openSession(browser) {
    const response = await fetch(`http://127.0.0.1:${browser.port}/json/list`);
    const page = (await response.json()).find((target) => target.type === "page");
    const cdp = await connect(page.webSocketDebuggerUrl);
    const pageErrors = [];
    cdp.on((message) => {
        if (message.method === "Runtime.exceptionThrown") {
            const details = message.params.exceptionDetails;
            pageErrors.push((details.exception && details.exception.description) || details.text);
        }
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    return {
        pageErrors,
        async goto(url) {
            pageErrors.length = 0;
            const loaded = new Promise((resolve) =>
                cdp.on((message) => {
                    if (message.method === "Page.loadEventFired") {
                        resolve();
                    }
                }),
            );
            await cdp.send("Page.navigate", { url });
            await withTimeout(loaded, DOCS_WAIT_MS, "page did not load: " + url);
        },
        async evaluate(expression) {
            const evaluation = cdp.send("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression });
            const { result, exceptionDetails } = await withTimeout(evaluation, DOCS_WAIT_MS, "the page did not answer");
            if (exceptionDetails) {
                throw new Error(
                    (exceptionDetails.exception && exceptionDetails.exception.description) || exceptionDetails.text,
                );
            }
            return result.value;
        },
        close: () => cdp.close(),
    };
}

const tryItWidget = (id) => `document.querySelector('.tryit[data-example="${id}"]')`;

// Resolves with the state of the widget as soon as the example in its frame has finished or failed.
const waitForOutcome = (session, id) =>
    session.evaluate(
        `new Promise((resolve) => {
                const widget = ${tryItWidget(id)};
                const poll = () => {
                    const state = widget.dataset.state;
                    if (state === "ok" || state === "error") {
                        resolve({ state, text: widget.querySelector(".tryit-state").textContent });
                    } else {
                        setTimeout(poll, 50);
                    }
                };
                poll();
            })`,
    );

const waitForExample = async (session, id) => {
    const outcome = await waitForOutcome(session, id);
    assert.equal(outcome.state, "ok", `example "${id}": ${outcome.text}`);
};

function selectExample(session, widgetId, exampleId) {
    return session.evaluate(`(() => {
        const select = ${tryItWidget(widgetId)}.querySelector("[data-picker]");
        select.value = ${JSON.stringify(exampleId)};
        select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
}

// Replays the steps in the frame of the widget and measures the checked elements.
function measureScenario(session, widgetId, scenario) {
    return session.evaluate(`(() => {
        const frame = ${tryItWidget(widgetId)}.querySelector(".tryit-frame").contentDocument;
        const scenario = ${JSON.stringify(scenario)};
        for (const step of scenario.steps ?? []) {
            const element = frame.querySelector(step.on);
            const view = frame.defaultView;
            if (step.x === undefined) {
                element.dispatchEvent(new view.Event(step.dispatch));
            } else {
                // x and y are relative to the top left corner of the element
                const box = element.getBoundingClientRect();
                const pointer = { bubbles: true, clientX: box.left + step.x, clientY: box.top + step.y };
                element.dispatchEvent(new view.MouseEvent(step.dispatch, pointer));
            }
        }
        return (scenario.checks ?? []).map((check) => {
            const box = frame.querySelector(check.element).getBoundingClientRect();
            const origin = check.relativeTo ? frame.querySelector(check.relativeTo).getBoundingClientRect() : { left: 0, top: 0 };
            return { check, left: box.left - origin.left, top: box.top - origin.top };
        });
    })()`);
}

async function runDocs(t, chrome) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "pc-docs-"));
    const docsServer = await startServer(outDir);
    const session = await openSession(chrome);
    try {
        buildDocs(outDir);
        const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
        const url = (page) => `${docsServer.baseUrl}/${page}`;

        for (const page of manifest.pages) {
            await t.test(`page ${page} loads without errors`, async () => {
                await session.goto(url(page));
                assert.deepEqual(session.pageErrors, []);
            });
        }
        for (const widget of manifest.widgets) {
            await t.test(`try-it ${widget.page} :: ${widget.example}`, async () => {
                await session.goto(url(widget.page));
                await waitForExample(session, widget.example);
                for (const example of widget.picker ? manifest.examples : []) {
                    await selectExample(session, widget.example, example.id);
                    await waitForExample(session, widget.example);
                }
                assert.deepEqual(session.pageErrors, []);
            });
        }
        for (const example of manifest.examples) {
            // A picker shows every example, so the first widget that has the example is enough.
            const widget = manifest.widgets.find((entry) => entry.example === example.id || entry.picker);
            for (const scenario of example.scenarios) {
                await t.test(`example ${example.id} :: ${scenario.name}`, async () => {
                    assert.ok(widget, `no try-it area shows the example "${example.id}"`);
                    await session.goto(url(widget.page));
                    await waitForExample(session, widget.example);
                    if (widget.example !== example.id) {
                        await selectExample(session, widget.example, example.id);
                        await waitForExample(session, widget.example);
                    }
                    for (const measured of await measureScenario(session, widget.example, scenario)) {
                        const { check } = measured;
                        const place = `${check.element}${check.relativeTo ? " relative to " + check.relativeTo : ""}`;
                        assert.ok(
                            Math.abs(measured.left - check.left) <= DOCS_TOLERANCE_PX &&
                                Math.abs(measured.top - check.top) <= DOCS_TOLERANCE_PX,
                            `${place}: expected left ${check.left}, top ${check.top}, got left ${measured.left}, top ${measured.top}`,
                        );
                    }
                });
            }
        }

        const editor = manifest.widgets.find((entry) => entry.mode === "editor");

        await t.test("try-it reports an error of the code and Reset restores the example", async () => {
            const widget = editor;
            await session.goto(url(widget.page));
            await waitForExample(session, widget.example);
            await session.evaluate(`(() => {
                const widget = ${tryItWidget(widget.example)};
                widget.querySelector('.tryit-code[data-part="js"]').value += "\\nthrow new Error('boom');";
                widget.querySelector('[data-action="run"]').click();
            })()`);
            const failed = await waitForOutcome(session, widget.example);
            assert.equal(failed.state, "error");
            assert.match(failed.text, /boom/);
            await session.evaluate(`${tryItWidget(widget.example)}.querySelector('[data-action="reset"]').click()`);
            await waitForExample(session, widget.example);
        });

        await t.test("try-it tabs show one part at a time and all parts run together", async () => {
            const widget = editor;
            await session.goto(url(widget.page));
            await waitForExample(session, widget.example);
            const visible = () =>
                session.evaluate(
                    `[...${tryItWidget(widget.example)}.querySelectorAll(".tryit-pane")].filter((pane) => !pane.hidden).map((pane) => pane.querySelector("textarea").dataset.part)`,
                );
            assert.deepEqual(await visible(), ["html"]);
            await session.evaluate(
                `${tryItWidget(widget.example)}.querySelector('[role="tab"][data-part="css"]').click()`,
            );
            assert.deepEqual(await visible(), ["css"]);
            await session.evaluate(`(() => {
                const widget = ${tryItWidget(widget.example)};
                widget.querySelector('.tryit-code[data-part="css"]').value += "\\n#stage { background: rgb(1, 2, 3); }";
                widget.querySelector('[data-action="run"]').click();
            })()`);
            await waitForExample(session, widget.example);
            const background = await session.evaluate(
                `getComputedStyle(${tryItWidget(widget.example)}.querySelector(".tryit-frame").contentDocument.querySelector("#stage")).backgroundColor`,
            );
            assert.equal(background, "rgb(1, 2, 3)");
        });

        await t.test("a demo has no code and its link opens the example in the playground", async () => {
            const demo = manifest.widgets.find((entry) => entry.mode === "demo");
            assert.ok(demo, "no page has a demo");
            await session.goto(url(demo.page));
            await waitForExample(session, demo.example);
            const widget = tryItWidget(demo.example);
            assert.equal(await session.evaluate(`${widget}.querySelectorAll("textarea").length`), 0);
            const link = await session.evaluate(`${widget}.querySelector(".tryit-foot a").href`);
            assert.ok(link.endsWith(`playground.html?example=${demo.example}`), link);

            await session.goto(link);
            await waitForExample(session, editor.example);
            const opened = await session.evaluate(`({
                picked: document.querySelector("[data-picker]").value,
                html: document.querySelector('.tryit-code[data-part="html"]').value,
                hint: document.querySelector(".tryit-hint").textContent,
            })`);
            assert.equal(opened.picked, demo.example);
            assert.match(opened.html, new RegExp(`id="${demo.example === "tooltip" ? "tip" : "stage"}"`));
            assert.match(opened.hint, /JavaScript tab/);
            assert.deepEqual(session.pageErrors, []);
        });

        await t.test("try-it shows the calculated values of the example", async () => {
            const widget = manifest.widgets.find((entry) => entry.example === "tooltip");
            assert.ok(widget, "no try-it area shows the example tooltip");
            await session.goto(url(widget.page));
            await waitForExample(session, "tooltip");
            const panel = `${tryItWidget("tooltip")}.querySelector(".values")`;
            const readValues = `Object.fromEntries([...${panel}.querySelectorAll("dt")].map((term) => [term.textContent, term.nextElementSibling.textContent]))`;
            assert.match(
                await session.evaluate(`${panel}.querySelector(".values-note").textContent`),
                /Nothing calculated yet/,
            );
            const emptyHeight = await session.evaluate(`${panel}.offsetHeight`);
            assert.equal((await session.evaluate(readValues)).itemAt, "-");
            await measureScenario(session, "tooltip", { steps: [{ dispatch: "mouseenter", on: "#info-name" }] });
            const values = await session.evaluate(`new Promise((resolve) => {
                const poll = () => {
                    const values = ${readValues};
                    if (values.itemAt === "-") {
                        setTimeout(poll, 50);
                        return;
                    }
                    resolve(values);
                };
                poll();
            })`);
            assert.equal(await session.evaluate(`${panel}.offsetHeight`), emptyHeight, "the panel changed its height");
            const frameHeight = await session.evaluate(
                `${tryItWidget("tooltip")}.querySelector(".tryit-frame").offsetHeight`,
            );
            assert.ok(
                Math.abs(frameHeight - emptyHeight) <= 1,
                `the frame is ${frameHeight}px high, the panel ${emptyHeight}px`,
            );
            // the top edge is in the way, so the tooltip uses the flipped placement
            assert.equal(values.itemAt, "top right");
            assert.equal(values.targetAt, "bottom right");
            assert.equal(values.overflow, "none");
            assert.match(values["moveBy.x"], /^-?\d/);
        });

        await t.test("configurator", async () => {
            await session.goto(url("configurator.html"));
            const outcome = await session.evaluate(`new Promise((resolve) => {
                const configurator = document.querySelector(".configurator");
                const dialog = configurator.querySelector(".cfg-dialog");
                const choose = (option, value) => {
                    configurator.querySelector('.cfg-value[data-option="' + option + '"]').click();
                    dialog.querySelector('input[name="' + option + '"][value="' + value + '"]').click();
                    dialog.querySelector(".cfg-dialog-close").click();
                };
                const read = () =>
                    Object.fromEntries([...configurator.querySelectorAll(".values dt")].map((term) => [term.textContent, term.nextElementSibling.textContent]));
                const poll = () => {
                    if (configurator.dataset.state !== "ready") {
                        setTimeout(poll, 50);
                        return;
                    }
                    choose("itemAt", "top left");
                    choose("targetAt", "top right");
                    const overflowing = read();
                    choose("flip", "both");
                    resolve({ overflowing, flipped: read(), code: configurator.querySelector(".cfg-code").textContent });
                };
                poll();
            })`);
            // the item is placed from the top left corner of the stage, the target sits at 110/70 and is 80 wide,
            // the item is 100 wide: at the right of the target it leaves the 280 wide stage, at the left it fits
            assert.equal(outcome.overflowing["moveBy.x"], "190");
            assert.equal(outcome.overflowing["moveBy.y"], "70");
            assert.equal(outcome.overflowing.overflow, "right");
            assert.equal(outcome.flipped["moveBy.x"], "10");
            assert.equal(outcome.flipped["moveBy.y"], "70");
            assert.equal(outcome.flipped.itemAt, "top right");
            assert.equal(outcome.flipped.targetAt, "top left");
            assert.match(outcome.code, /targetAt: "top right",[^]*flip: "both",/);
            assert.deepEqual(session.pageErrors, []);
        });

        await t.test("configurator dialog edits the value, the arrow keys move the target", async () => {
            await session.goto(url("configurator.html"));
            const outcome = await session.evaluate(`new Promise((resolve) => {
                const configurator = document.querySelector(".configurator");
                const dialog = configurator.querySelector(".cfg-dialog");
                const value = (option) => configurator.querySelector('.cfg-value[data-option="' + option + '"]');
                const read = () =>
                    Object.fromEntries([...configurator.querySelectorAll(".values dt")].map((term) => [term.textContent, term.nextElementSibling.textContent]));
                const poll = () => {
                    if (configurator.dataset.state !== "ready") {
                        setTimeout(poll, 50);
                        return;
                    }
                    const closed = dialog.hidden;
                    value("targetOffset").click();
                    const title = dialog.querySelector("#cfg-dialog-title").textContent;
                    const input = dialog.querySelector('[data-field="y"] input');
                    input.value = "-8";
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.value = "oops";
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    const rejected = input.getAttribute("aria-invalid");
                    const offset = value("targetOffset").textContent;
                    const before = read();
                    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                    const closedAgain = dialog.hidden;
                    const target = configurator.querySelector(".cfg-target");
                    target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
                    const after = read();
                    value("targetOffset").click();
                    dialog.querySelector('[data-field="y"] input').value = "-50";
                    const unit = dialog.querySelector('[data-field="y"] select');
                    unit.value = "%";
                    unit.dispatchEvent(new Event("input", { bubbles: true }));
                    resolve({ closed, title, rejected, offset, before, closedAgain, after, percent: read() });
                };
                poll();
            })`);
            assert.equal(outcome.closed, true);
            assert.equal(outcome.title, "targetOffset");
            assert.equal(outcome.rejected, "true");
            assert.equal(outcome.offset, "{ x: 0, y: -8 }");
            assert.equal(outcome.before["moveBy.y"], "12");
            assert.equal(outcome.closedAgain, true);
            assert.equal(Number(outcome.after["moveBy.x"]), Number(outcome.before["moveBy.x"]) + 10);
            // -50% of the target height (40) lifts the item by 20 instead of 8
            assert.equal(outcome.percent["moveBy.y"], "0");
            assert.deepEqual(session.pageErrors, []);
        });
    } finally {
        session.close();
        await docsServer.close();
        fs.rmSync(outDir, { recursive: true, force: true });
    }
}

let browser;
let server;
before(async () => {
    server = await startServer(root);
    browser = await launchChrome(findChrome());
});
after(async () => {
    if (browser) {
        await browser.close();
    }
    if (server) {
        await server.close();
    }
});

for (const name of targets) {
    if (!TARGETS.includes(name)) {
        throw new Error("Unknown target: " + name);
    }
    if (name === "docs") {
        if (options.format === "iife") {
            throw new Error("The docs examples import an ES module, so --format=iife does not work with docs.");
        }
        test("docs", (t) => runDocs(t, browser));
        continue;
    }
    test(name, async (t) => {
        const { result, pageErrors } = await runPage(browser, name);
        pageErrors.forEach((text) => t.diagnostic("page error: " + text));
        result.info.forEach((text) => t.diagnostic(text));
        if (name === "validation") {
            t.diagnostic("validation seed: " + options.seed);
        }
        for (const entry of result.tests) {
            const target = entry.module.startsWith("[target]");
            await t.test(
                `${entry.module} :: ${entry.name}`,
                target ? { todo: "target behavior, not implemented yet" } : {},
                () => {
                    if (entry.failed) {
                        throw new Error(describeFailures(entry.failures));
                    }
                },
            );
        }
        // A page that failed to load or ran no tests must not count as a pass.
        assert.equal(pageErrors.length, 0, `page ${name} had ${pageErrors.length} page error(s)`);
        assert.notEqual(result.tests.length, 0, `page ${name} reported no tests`);
    });
}
