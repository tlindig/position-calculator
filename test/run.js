#!/usr/bin/env node
/*
 * Runs the browser test pages in headless Chrome (DevTools protocol, no dependencies besides Node >= 22
 * and Chrome) and reports every browser test as a subtest of node:test.
 *
 *   node test/run.js [dev|validation|all] [--seed=N] [--n=COUNT] [--impl=FILE] [--jquery=0|1]
 *                    [--chrome=PATH] [--no-sandbox] [--timeout=SECONDS]
 *
 * Exit code 0: no failure outside "[info]" modules (reported as todo). Otherwise 1.
 * Validation scenes are random. The seed is printed, pass --seed=N to reproduce a run.
 */
"use strict";

const { spawn, spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const url = require("node:url");
const { test, before, after } = require("node:test");

const PAGES = { dev: "position-calculator.html", validation: "validation.html" };
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
    targets = ["dev", "validation"];
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

function pageUrl(name) {
    const params = new URLSearchParams();
    if (options.impl) {
        params.set("impl", url.pathToFileURL(path.resolve(options.impl)).href);
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
    return url.pathToFileURL(path.join(__dirname, PAGES[name])).href + (query ? "?" + query : "");
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
        "--headless", "--disable-gpu", "--remote-debugging-port=0", "--user-data-dir=" + profile,
        "--window-size=1200,900", "--no-first-run", "--no-default-browser-check"
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
        }
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
        ws.onopen = () => resolve({
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
            }
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
        const loaded = new Promise((resolve) => cdp.on((message) => {
            if (message.method === "Page.loadEventFired") {
                resolve();
            }
        }));
        cdp.on((message) => {
            if (message.method === "Runtime.exceptionThrown") {
                const details = message.params.exceptionDetails;
                pageErrors.push((details.exception && details.exception.description) || details.text);
            }
        });
        await cdp.send("Page.navigate", { url: pageUrl(name) });
        await withTimeout(loaded, timeoutMs, "page " + name + " did not load");

        const evaluation = cdp.send("Runtime.evaluate", {
            awaitPromise: true,
            returnByValue: true,
            expression: `new Promise(function(resolve) {
                if (window.TestDone) { resolve(window.TestResult); }
                else { window.addEventListener("testdone", function() { resolve(window.TestResult); }); }
            })`
        });
        const { result } = await withTimeout(evaluation, timeoutMs,
            "page " + name + " published no result. Page errors: " + (pageErrors.join(" | ") || "none"));
        return { result: result.value, pageErrors };
    } finally {
        cdp.close();
    }
}

function describeFailures(failures) {
    const shown = failures.slice(0, MAX_FAILURES_PER_TEST).map((failure) =>
        `${failure.message}\n  expected: ${JSON.stringify(failure.expected)}\n  actual:   ${JSON.stringify(failure.actual)}`);
    if (failures.length > shown.length) {
        shown.push(`(${failures.length - shown.length} more)`);
    }
    return shown.join("\n");
}

let browser;
before(async () => {
    browser = await launchChrome(findChrome());
});
after(async () => {
    if (browser) {
        await browser.close();
    }
});

for (const name of targets) {
    if (!PAGES[name]) {
        throw new Error("Unknown target: " + name);
    }
    test(name, async (t) => {
        const { result, pageErrors } = await runPage(browser, name);
        pageErrors.forEach((text) => t.diagnostic("page error: " + text));
        result.info.forEach((text) => t.diagnostic(text));
        if (name === "validation") {
            t.diagnostic("validation seed: " + options.seed);
        }
        for (const entry of result.tests) {
            const informational = entry.module.startsWith("[info]");
            await t.test(`${entry.module} :: ${entry.name}`, informational ? { todo: "informational" } : {}, () => {
                if (entry.failed) {
                    throw new Error(describeFailures(entry.failures));
                }
            });
        }
    });
}
