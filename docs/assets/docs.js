import { buildValues, showValues } from "./values.js";

const wide = matchMedia("(min-width: 60rem)");

// The menu is always open on wide screens and collapsed on narrow ones. Without JavaScript it stays open.
function initNav() {
    const details = document.querySelector(".site-nav details");
    const sync = () => {
        details.open = wide.matches;
    };
    sync();
    wide.addEventListener("change", sync);
}

async function copyText(button, text) {
    const label = button.textContent;
    try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
    } catch {
        button.textContent = "Copy failed";
    }
    setTimeout(() => {
        button.textContent = label;
    }, 1500);
}

// Every code block is <pre><code>. The button sits next to the <pre>, so it is not part of the copied text.
function initCopyButtons() {
    for (const pre of document.querySelectorAll("main pre")) {
        const code = pre.querySelector("code");
        if (!code) {
            continue;
        }
        const wrapper = document.createElement("div");
        wrapper.className = "code-block";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "copy";
        button.textContent = "Copy";
        button.addEventListener("click", () => copyText(button, code.textContent));
        pre.replaceWith(wrapper);
        wrapper.append(pre, button);
    }
}

const root = new URL(document.body.dataset.root, location.href);
const RUN_DELAY = 600;

// Runs inside the example frame and reports to the page. Errors count until the next run starts.
function harness(run) {
    const send = (state, message) => parent.postMessage({ tryit: run, state, message }, "*");
    let failed = false;
    const fail = (message) => {
        failed = true;
        send("error", message);
    };
    addEventListener(
        "error",
        (event) => fail(event.target === window ? event.message : `Could not load ${event.target.src || "a script"}`),
        true,
    );
    addEventListener("unhandledrejection", (event) => fail(String(event.reason)));
    addEventListener("load", () => {
        if (!failed) {
            send("ok");
        }
    });
}

// Runs in a module before the example. It reports every result of calculate() to the page.
function trackResults(PositionCalculator, run) {
    const calculate = PositionCalculator.prototype.calculate;
    PositionCalculator.prototype.calculate = function () {
        const result = calculate.call(this);
        parent.postMessage({ tryit: run, result }, "*");
        return result;
    };
}

// The script goes last, so the markup exists when it runs.
function frameDocument({ html, css, js }, run) {
    const imports = { "@tlindig/position-calculator": new URL("lib/position-calculator.js", root).href };
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${new URL("assets/docs.css", root).href}">
<script type="importmap">${JSON.stringify({ imports })}</script>
<script>(${harness})(${run})</script>
<script type="module">
import { PositionCalculator } from "@tlindig/position-calculator";
(${trackResults})(PositionCalculator, ${run});
</script>
<style>
${css}
</style>
</head>
<body class="example-frame">
${html}
<script type="module">
${js.replaceAll("</script", "<\\/script")}
</script>
</body>
</html>`;
}

const PARTS = ["html", "js", "css"];
let runCounter = 0;

function initTryIt(widget) {
    const editable = widget.dataset.mode === "editor";
    const bar = widget.querySelector(".tryit-bar");
    const tabs = widget.querySelector(".tryit-tabs");
    const view = widget.querySelector(".tryit-view");
    const frame = widget.querySelector(".tryit-frame");
    const values = widget.querySelector(".values");
    const status = widget.querySelector(".tryit-state");
    const picker = widget.querySelector("[data-picker]");
    const sourcesNode = widget.querySelector(".tryit-sources");
    const sources = sourcesNode ? JSON.parse(sourcesNode.textContent) : null;
    const field = (part) => widget.querySelector(`.tryit-code[data-part="${part}"]`);
    // A demo has no editor, its code comes with the page.
    const readParts = () =>
        editable ? Object.fromEntries(PARTS.map((part) => [part, field(part).value])) : sources[widget.dataset.example];
    let original = editable ? Object.fromEntries(PARTS.map((part) => [part, field(part).defaultValue])) : null;
    let active = PARTS[0];
    let run = 0;
    let timer;

    // Only an error is shown: "Running" and "Done" would flicker on every run.
    const setState = (state, message = "") => {
        widget.dataset.state = state;
        status.textContent = state === "error" ? `Error: ${message}` : "";
    };

    const execute = () => {
        clearTimeout(timer);
        run = ++runCounter;
        setState("running");
        showValues(values);
        frame.srcdoc = frameDocument(readParts(), run);
    };

    const show = (part, focus) => {
        active = part;
        for (const tab of tabs.querySelectorAll("[role=tab]")) {
            const selected = tab.dataset.part === part;
            tab.setAttribute("aria-selected", selected);
            tab.tabIndex = selected ? 0 : -1;
            widget.querySelector(`#${tab.getAttribute("aria-controls")}`).hidden = !selected;
            if (selected && focus) {
                tab.focus();
            }
        }
    };

    addEventListener("message", (event) => {
        const data = event.data;
        if (event.source !== frame.contentWindow || data?.tryit !== run) {
            return;
        }
        if ("result" in data) {
            showValues(values, data.result);
            return;
        }
        if (data.state === "error" || widget.dataset.state === "running") {
            setState(data.state, data.message);
        }
    });

    widget.addEventListener("input", (event) => {
        if (event.target.matches(".tryit-code")) {
            clearTimeout(timer);
            timer = setTimeout(execute, RUN_DELAY);
        }
    });
    widget.addEventListener("click", (event) => {
        const tab = event.target.closest("[role=tab]");
        if (tab) {
            show(tab.dataset.part, false);
        }
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "run") {
            execute();
        } else if (action === "reset") {
            for (const part of PARTS) {
                field(part).value = original[part];
            }
            execute();
        } else if (action === "copy") {
            copyText(event.target, field(active).value);
        }
    });
    tabs?.addEventListener("keydown", (event) => {
        const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        const last = PARTS.length - 1;
        const index = { Home: 0, End: last }[event.key] ?? PARTS.indexOf(active) + step;
        if (Number.isInteger(index)) {
            event.preventDefault();
            show(PARTS[(index + PARTS.length) % PARTS.length], true);
        }
    });

    const applyExample = (id) => {
        const choice = sources[id];
        picker.value = id;
        original = Object.fromEntries(PARTS.map((part) => [part, choice[part]]));
        for (const part of PARTS) {
            field(part).value = original[part];
            field(part).rows = Math.min(14, Math.max(...PARTS.map((name) => original[name].split("\n").length)) + 1);
        }
        frame.style.minHeight = choice.height + "px";
        widget.querySelector("[data-hint]").textContent = choice.hint;
    };
    picker?.addEventListener("change", () => {
        applyExample(picker.value);
        execute();
    });

    for (const label of widget.querySelectorAll(".tryit-label")) {
        label.hidden = true;
    }
    view.hidden = false;
    frame.style.minHeight = frame.dataset.minHeight + "px"; // the frame fills the row, which is at least this high
    if (editable) {
        tabs.hidden = false;
        bar.hidden = false;
        show(active, false);
        // The demo pages link here with ?example=<id>
        const wanted = new URLSearchParams(location.search).get("example");
        if (picker && Object.hasOwn(sources, wanted ?? "")) {
            applyExample(wanted);
        }
    }
    buildValues(values);
    execute();
}

initNav();
initCopyButtons();
for (const widget of document.querySelectorAll(".tryit")) {
    initTryIt(widget);
}
if (document.querySelector(".configurator")) {
    import("./configurator.js");
}
