import { PositionCalculator } from "../lib/position-calculator.js";

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
const root = document.querySelector(".configurator");
const stage = root.querySelector(".cfg-stage");
const item = root.querySelector(".cfg-item");
const target = root.querySelector(".cfg-target");
const codeOutput = root.querySelector(".cfg-code");
const resultOutput = root.querySelector(".cfg-result");

for (const grid of root.querySelectorAll("[data-grid]")) {
    const name = grid.dataset.grid;
    for (const value of AT_VALUES) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = name;
        input.value = value;
        input.checked = value === grid.dataset.initial;
        label.title = value;
        label.append(
            input,
            Object.assign(document.createElement("span"), { className: "visually-hidden", textContent: value }),
        );
        grid.append(label);
    }
}

const read = (name) =>
    root.querySelector(`[name="${name}"]:checked`)?.value ?? root.querySelector(`[name="${name}"]`).value;

function update() {
    const withBoundary = root.querySelector('[name="boundary"]').checked;
    const flip = read("flip");
    const stick = read("stick");
    const options = {
        item,
        target,
        boundary: withBoundary ? stage : null,
        itemAt: read("itemAt"),
        targetAt: read("targetAt"),
    };
    if (flip !== "none") {
        options.flip = flip;
    }
    if (stick !== "none") {
        options.stick = stick;
    }

    item.style.left = "0px";
    item.style.top = "0px";
    const result = new PositionCalculator(options).calculate();
    item.style.left = result.moveBy.x + "px";
    item.style.top = result.moveBy.y + "px";

    const lines = [`item: "#item"`, `target: "#target"`, `boundary: ${withBoundary ? '"#stage"' : "null"}`];
    lines.push(`itemAt: "${options.itemAt}"`, `targetAt: "${options.targetAt}"`);
    for (const name of ["flip", "stick"]) {
        if (options[name]) {
            lines.push(`${name}: "${options[name]}"`);
        }
    }
    codeOutput.textContent =
        `const calculator = new PositionCalculator({\n${lines.map((line) => `    ${line},`).join("\n")}\n});\n` +
        "const { moveBy } = calculator.calculate();";
    resultOutput.textContent = JSON.stringify(result, null, 2);
    root.dataset.state = "ready";
}

root.addEventListener("change", update);
update();
