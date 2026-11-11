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

function frameDocument(source, run) {
    const imports = { "@tlindig/position-calculator": new URL("lib/position-calculator.js", root).href };
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${new URL("assets/docs.css", root).href}">
<script type="importmap">${JSON.stringify({ imports })}</script>
<script>(${harness})(${run})</script>
</head>
<body class="example-frame">
${source}
</body>
</html>`;
}

let runCounter = 0;

function initTryIt(widget) {
    const bar = widget.querySelector(".tryit-bar");
    const code = widget.querySelector(".tryit-code");
    const frame = widget.querySelector(".tryit-frame");
    const status = widget.querySelector(".tryit-state");
    const picker = widget.querySelector("[data-picker]");
    const sources = picker ? JSON.parse(widget.querySelector(".tryit-sources").textContent) : null;
    let original = code.defaultValue;
    let run = 0;
    let timer;

    const setState = (state, message = "") => {
        widget.dataset.state = state;
        status.textContent = { running: "Running", ok: "Done", error: `Error: ${message}` }[state];
    };

    const execute = () => {
        clearTimeout(timer);
        run = ++runCounter;
        setState("running");
        frame.srcdoc = frameDocument(code.value, run);
    };

    addEventListener("message", (event) => {
        const data = event.data;
        if (event.source !== frame.contentWindow || data?.tryit !== run) {
            return;
        }
        if (data.state === "error" || widget.dataset.state === "running") {
            setState(data.state, data.message);
        }
    });

    code.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(execute, RUN_DELAY);
    });
    widget.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "run") {
            execute();
        } else if (action === "reset") {
            code.value = original;
            execute();
        } else if (action === "copy") {
            copyText(event.target, code.value);
        }
    });
    picker?.addEventListener("change", () => {
        const choice = sources[picker.value];
        original = choice.source;
        code.value = original;
        code.rows = Math.min(18, original.split("\n").length + 1);
        frame.height = choice.height;
        execute();
    });

    bar.hidden = false;
    frame.hidden = false;
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
