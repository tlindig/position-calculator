import { PositionCalculator } from "../lib/position-calculator.js";
import { buildValues, showValues } from "./values.js";

const AT_VALUES = [
    "top left",
    "top center",
    "top right",
    "middle left",
    "middle center",
    "middle right",
    "bottom left",
    "bottom center",
    "bottom right",
];
const EDGES = ["top", "right", "bottom", "left"];
const ROWS = ["item", "target", "boundary", "itemAt", "itemOffset", "targetAt", "targetOffset", "flip", "stick"];
const FIXED = { item: '"#item"', target: '"#target"' };
const MARKER_POSITION = { top: 0, middle: 50, bottom: 100, left: 0, center: 50, right: 100 };
const STEP = 10;
const MARKER_INSET = 5; // half the dot size in docs.css
// Which element or point the name of a property stands for, see .cfg-swatch in docs.css
const SWATCH = {
    item: "item",
    target: "target",
    boundary: "boundary",
    itemAt: "itemAt",
    itemOffset: "itemAt",
    targetAt: "targetAt",
    targetOffset: "targetAt",
};

const OPTIONS = {
    boundary: "The box the item has to stay in. Without a boundary the item may go anywhere.",
    itemAt: "The point of the item that is placed on the target point (red dot).",
    targetAt: "The point of the target the item is aligned to (white dot).",
    itemOffset:
        "Moves the item point. Pixels or a percentage like 10%. With mirror the offset is turned around when the placement flips.",
    targetOffset:
        "Moves the target point. Pixels or a percentage like 10%. With mirror the offset is turned around when the placement flips.",
    flip: "When the item would leave the boundary, try the opposite placement. It acts only on a collision, so drag the target to an edge.",
    stick: "Pull the item back inside the boundary at the chosen edges when it still overflows. It acts only on a collision, too.",
};

const state = {
    boundary: "stage",
    itemAt: "bottom center",
    itemOffset: { x: "0", y: "0", mirror: false },
    targetAt: "top center",
    targetOffset: { x: "0", y: "0", mirror: false },
    flip: "none",
    stick: "none",
};

const root = document.querySelector(".configurator");
const canvas = root.querySelector(".cfg-canvas");
const stage = root.querySelector(".cfg-stage");
const item = root.querySelector(".cfg-item");
const target = root.querySelector(".cfg-target");
const code = root.querySelector(".cfg-code");
const values = root.querySelector(".values");
const dialog = root.querySelector(".cfg-dialog");
const dialogTitle = dialog.querySelector("#cfg-dialog-title");
const dialogText = dialog.querySelector(".cfg-dialog-text");
const dialogBody = dialog.querySelector(".cfg-dialog-body");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const buttons = {};
buildValues(values);

const asNumber = (text) => (text.endsWith("%") ? text : Number(text));
const offsetOption = (offset) => ({ x: asNumber(offset.x), y: asNumber(offset.y), mirror: offset.mirror });
const isZero = (offset) => parseFloat(offset.x) === 0 && parseFloat(offset.y) === 0 && !offset.mirror;
const literal = (text) => (text.endsWith("%") ? `"${text}"` : text);
const offsetText = (offset) =>
    `{ x: ${literal(offset.x)}, y: ${literal(offset.y)}${offset.mirror ? ", mirror: true" : ""} }`;

// The options that are not set stay visible, but muted
const DISPLAY = {
    boundary: () => [state.boundary === "stage" ? '"#stage"' : "null", false],
    itemAt: () => [`"${state.itemAt}"`, false],
    targetAt: () => [`"${state.targetAt}"`, false],
    itemOffset: () => [offsetText(state.itemOffset), isZero(state.itemOffset)],
    targetOffset: () => [offsetText(state.targetOffset), isZero(state.targetOffset)],
    flip: () => [`"${state.flip}"`, state.flip === "none"],
    stick: () => [`"${state.stick}"`, state.stick === "none"],
};

function buildCode() {
    code.append("const calculator = new PositionCalculator({\n");
    for (const name of ROWS) {
        // the swatch is a space, so the copied code keeps its indentation
        const swatch = Object.assign(document.createElement("span"), {
            className: `cfg-swatch${SWATCH[name] ? ` cfg-swatch-${SWATCH[name]}` : ""}`,
            textContent: " ",
        });
        code.append("  ", swatch, ` ${name}: `);
        if (name in FIXED) {
            code.append(FIXED[name]);
        } else {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cfg-value";
            button.dataset.option = name;
            button.title = `Change ${name}`;
            button.setAttribute("aria-haspopup", "dialog");
            button.setAttribute("aria-expanded", "false");
            buttons[name] = button;
            code.append(button);
        }
        code.append(",\n");
    }
    code.append("});\nconst { moveBy } = calculator.calculate();");
}

function renderCode() {
    for (const [name, button] of Object.entries(buttons)) {
        const [text, muted] = DISPLAY[name]();
        button.textContent = text;
        button.classList.toggle("cfg-default", muted);
    }
}

function placeMarker(element, at) {
    const [vertical, horizontal] = at.split(" ");
    const marker = element.querySelector(".cfg-marker");
    // the dot is moved inwards from the edges, so its edge lies on the edge of the box
    const inside = (name) =>
        `calc(${MARKER_POSITION[name]}% + ${((50 - MARKER_POSITION[name]) / 50) * MARKER_INSET}px)`;
    marker.style.top = inside(vertical);
    marker.style.left = inside(horizontal);
}

function update(animate, changed) {
    const options = {
        item,
        target,
        boundary: state.boundary === "stage" ? stage : null,
        itemAt: state.itemAt,
        itemOffset: offsetOption(state.itemOffset),
        targetAt: state.targetAt,
        targetOffset: offsetOption(state.targetOffset),
        flip: state.flip,
        stick: state.stick,
    };

    for (const running of item.getAnimations()) {
        running.cancel();
    }
    const from = { left: getComputedStyle(item).left, top: getComputedStyle(item).top };
    item.style.left = "0px";
    item.style.top = "0px";
    const result = new PositionCalculator(options).calculate();
    item.style.left = result.moveBy.x + "px";
    item.style.top = result.moveBy.y + "px";
    // The item glides to its new place, so you see what the change did
    if (animate && !reducedMotion.matches) {
        item.animate([from, { left: item.style.left, top: item.style.top }], { duration: 300, easing: "ease-out" });
    }

    placeMarker(item, state.itemAt);
    placeMarker(target, state.targetAt);
    stage.classList.toggle("cfg-overflow", Boolean(result.distance?.overflow));
    renderCode();
    showValues(values, result);
    if (animate) {
        // restart the highlight, so every change is noticed
        for (const output of [values, buttons[changed]]) {
            output?.classList.remove("cfg-updated");
            void output?.offsetWidth;
            output?.classList.add("cfg-updated");
        }
    }
    root.dataset.state = "ready";
}

function radio(name, value, label) {
    const wrapper = document.createElement("label");
    const input = Object.assign(document.createElement("input"), {
        type: "radio",
        name,
        value,
        checked: state[name] === value,
    });
    wrapper.append(input, label);
    return wrapper;
}

function numberField(name, field) {
    const row = document.createElement("div");
    row.className = "cfg-field";
    row.dataset.field = field;
    const text = state[name][field];
    const label = document.createElement("label");
    const input = Object.assign(document.createElement("input"), {
        type: "number",
        value: parseFloat(text),
        step: "any",
    });
    label.append(field, input);
    const unit = document.createElement("select");
    unit.setAttribute("aria-label", `unit of ${field}`);
    unit.append(new Option("px", "px"), new Option("%", "%"));
    unit.value = text.endsWith("%") ? "%" : "px";
    row.append(label, unit);
    return row;
}

function atGrid(name) {
    const grid = document.createElement("div");
    grid.className = "cfg-grid";
    for (const value of AT_VALUES) {
        const hidden = Object.assign(document.createElement("span"), {
            className: "visually-hidden",
            textContent: value,
        });
        const label = radio(name, value, hidden);
        label.title = value;
        grid.append(label);
    }
    return grid;
}

function offsetFields(body, name) {
    const mirror = document.createElement("label");
    const input = Object.assign(document.createElement("input"), { type: "checkbox", checked: state[name].mirror });
    input.dataset.field = "mirror";
    mirror.append(input, "mirror");
    body.append(numberField(name, "x"), numberField(name, "y"), mirror);
}

const BODIES = {
    boundary: (body) => body.append(radio("boundary", "stage", "the dashed box"), radio("boundary", "none", "none")),
    itemAt: (body) => body.append(atGrid("itemAt")),
    targetAt: (body) => body.append(atGrid("targetAt")),
    itemOffset: (body) => offsetFields(body, "itemOffset"),
    targetOffset: (body) => offsetFields(body, "targetOffset"),
    flip: (body) => body.append(...["none", "item", "target", "both"].map((value) => radio("flip", value, value))),
    stick(body) {
        const current = state.stick === "all" ? EDGES : state.stick.split(" ");
        for (const edge of EDGES) {
            const wrapper = document.createElement("label");
            const input = Object.assign(document.createElement("input"), {
                type: "checkbox",
                value: edge,
                checked: current.includes(edge),
            });
            wrapper.append(input, edge);
            body.append(wrapper);
        }
    },
};

function stickValue(edges) {
    return edges.length === 0 ? "none" : edges.length === EDGES.length ? "all" : edges.join(" ");
}

function placeDialog() {
    // The dialog is placed by the library itself: right of the code block, level with the clicked value
    const block = code.closest("pre");
    const button = buttons[dialog.dataset.option];
    dialog.style.left = "0px";
    dialog.style.top = "0px";
    const { moveBy } = new PositionCalculator({
        item: dialog,
        target: block,
        boundary: "window",
        itemAt: "top left",
        targetAt: "top right",
        targetOffset: { x: 12, y: button.getBoundingClientRect().top - block.getBoundingClientRect().top },
        stick: "all",
    }).calculate();
    dialog.style.left = moveBy.x + "px";
    dialog.style.top = moveBy.y + "px";
}

function openDialog(option) {
    dialog.dataset.option = option;
    dialogTitle.textContent = option;
    dialogText.textContent = OPTIONS[option];
    dialogBody.className = `cfg-dialog-body cfg-body-${option}`;
    dialogBody.replaceChildren();
    BODIES[option](dialogBody);
    dialog.hidden = false;
    for (const [name, button] of Object.entries(buttons)) {
        button.setAttribute("aria-expanded", String(name === option));
    }
    placeDialog();
    (dialogBody.querySelector("input:checked") ?? dialogBody.querySelector("input")).focus();
}

function closeDialog(returnFocus) {
    const option = dialog.dataset.option;
    dialog.hidden = true;
    for (const button of Object.values(buttons)) {
        button.setAttribute("aria-expanded", "false");
    }
    if (returnFocus) {
        buttons[option].focus();
    }
}

dialog.addEventListener("input", (event) => {
    const input = event.target;
    const option = dialog.dataset.option;
    if (option === "itemOffset" || option === "targetOffset") {
        if (input.dataset.field === "mirror") {
            state[option].mirror = input.checked;
        } else {
            const row = input.closest("[data-field]");
            const number = row.querySelector("input");
            // an empty number field means the text is not a number
            const valid = number.value !== "";
            number.setAttribute("aria-invalid", String(!valid));
            if (!valid) {
                return;
            }
            state[option][row.dataset.field] = number.value + (row.querySelector("select").value === "%" ? "%" : "");
        }
    } else if (option === "stick") {
        state.stick = stickValue(EDGES.filter((edge) => dialogBody.querySelector(`[value="${edge}"]`).checked));
    } else {
        state[option] = input.value;
    }
    update(true, option);
});
dialog.querySelector(".cfg-dialog-close").addEventListener("click", () => closeDialog(true));

root.addEventListener("click", (event) => {
    const button = event.target.closest(".cfg-value");
    if (!button) {
        return;
    }
    if (!dialog.hidden && dialog.dataset.option === button.dataset.option) {
        closeDialog(false);
    } else {
        openDialog(button.dataset.option);
    }
});
document.addEventListener("pointerdown", (event) => {
    if (!dialog.hidden && !event.target.closest(".cfg-dialog, .cfg-value")) {
        closeDialog(false);
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) {
        closeDialog(true);
    }
});
addEventListener("resize", () => {
    if (!dialog.hidden) {
        placeDialog();
    }
});

// The target can be moved anywhere in the canvas, the item follows
function moveTarget(left, top) {
    const maxLeft = canvas.clientWidth - stage.offsetLeft - target.offsetWidth;
    const maxTop = canvas.clientHeight - stage.offsetTop - target.offsetHeight;
    target.style.left = Math.min(Math.max(left, -stage.offsetLeft), maxLeft) + "px";
    target.style.top = Math.min(Math.max(top, -stage.offsetTop), maxTop) + "px";
    update(false);
}

let grab = null;
const release = () => {
    grab = null;
    target.classList.remove("cfg-dragging");
};
target.addEventListener("pointerdown", (event) => {
    target.setPointerCapture(event.pointerId);
    grab = { x: event.clientX - target.offsetLeft, y: event.clientY - target.offsetTop };
    target.classList.add("cfg-dragging");
});
target.addEventListener("pointermove", (event) => {
    if (grab) {
        moveTarget(event.clientX - grab.x, event.clientY - grab.y);
    }
});
target.addEventListener("pointerup", release);
target.addEventListener("pointercancel", release);
target.addEventListener("keydown", (event) => {
    const delta = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[
        event.key
    ];
    if (delta) {
        event.preventDefault();
        moveTarget(target.offsetLeft + delta[0], target.offsetTop + delta[1]);
    }
});

buildCode();
update(false);
