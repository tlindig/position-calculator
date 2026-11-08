#!/usr/bin/env node
/*
 * Runs the browser test pages in headless Chrome (DevTools protocol, no dependencies besides Node >= 22
 * and Chrome) and reports every browser test as a subtest of node:test.
 *
 *   node test/run.js [dev|validation|all] [--seed=N] [--n=COUNT] [--impl=FILE] [--format=esm|iife]
 *                    [--jquery=0|1] [--chrome=PATH] [--no-sandbox] [--timeout=SECONDS]
 *
 * The pages are served from the project root by a local HTTP server, because browsers do not load
 * ES modules from file: URLs. --impl is a file inside the project. --format tells how the browser
 * loads it: an ES module (default) or a classic script (the IIFE build).
 *
 * Exit code 0: no failure outside "[target]" modules (reported as todo). Otherwise 1.
 * Validation scenes are random. The seed is printed, pass --seed=N to reproduce a run.
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, before, after } from "node:test";
import { startServer } from "./support/server.js";

const root = path.join(import.meta.dirname, "..");
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
    });
}
