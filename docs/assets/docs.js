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

initNav();
initCopyButtons();
