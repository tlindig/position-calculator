// The "Calculated values" panel of the try-it areas and the configurator.
const NOTHING_YET = "Nothing calculated yet. Interact with the example.";
const VALUE_NAMES = [
    "moveBy.x",
    "moveBy.y",
    "itemAt",
    "targetAt",
    "overflow",
    "distance.top",
    "distance.right",
    "distance.bottom",
    "distance.left",
];

// The names are always there and only the values change, so the panel keeps its height.
export function buildValues(panel) {
    const list = panel.querySelector(".values-list");
    for (const name of VALUE_NAMES) {
        const term = document.createElement("dt");
        term.textContent = name;
        list.append(term, document.createElement("dd"));
    }
}

// undefined: nothing calculated yet, null: the item was not found
export function showValues(panel, result) {
    const round = (value) => (typeof value === "number" ? String(Math.round(value * 100) / 100) : undefined);
    const distance = result?.distance;
    const values = {
        "moveBy.x": round(result?.moveBy.x),
        "moveBy.y": round(result?.moveBy.y),
        itemAt: result?.itemAt,
        targetAt: result?.targetAt,
        overflow: distance && (distance.overflow?.join(", ") ?? "none"),
        "distance.top": round(distance?.top),
        "distance.right": round(distance?.right),
        "distance.bottom": round(distance?.bottom),
        "distance.left": round(distance?.left),
    };
    for (const description of panel.querySelectorAll("dd")) {
        description.textContent = values[description.previousElementSibling.textContent] ?? "-";
    }
    panel.querySelector(".values-note").textContent =
        result === null
            ? "calculate() returned null: the item was not found."
            : result === undefined
              ? NOTHING_YET
              : "";
}
