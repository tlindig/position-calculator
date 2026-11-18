import {
    PositionCalculator,
    type CalculationResult,
    type Flip,
    type PositionCalculatorOptions,
} from "@tlindig/position-calculator";

const options: PositionCalculatorOptions = {
    item: "#popup",
    target: document.body,
    boundary: window,
    itemAt: "top left",
    targetAt: "bottom left",
    itemOffset: { y: 0, x: "10%", mirror: true },
    flip: "both",
    stick: "top left",
};

const calculator = new PositionCalculator(options);
const withoutNew = PositionCalculator({ item: document.body, target: null, boundary: null });
const result: CalculationResult | null = calculator.calculate();
if (result) {
    const y: number = result.moveBy.y;
    const overflow: string[] | null = result.distance ? result.distance.overflow : null;
    console.log(y, overflow, result.itemAt);
}
calculator.resize().calculate();
withoutNew.calcVariant({ y: "top", x: "left" }, { y: "bottom", x: "right" });
PositionCalculator.defaults.itemAt = "bottom right";

// @ts-expect-error an offset value must be a number or a string
new PositionCalculator({ itemOffset: { y: true, x: 0 } });
// @ts-expect-error calculate() is an instance method
PositionCalculator.calculate();

// only events with pageX and pageY work as target: mouse and pointer events
// @ts-expect-error a keyboard event has no pageX and pageY, the result would be NaN
new PositionCalculator({ item: "#popup", target: new KeyboardEvent("keydown") });
new PositionCalculator({ item: "#popup", target: new MouseEvent("click") });
new PositionCalculator({ item: "#popup", target: new PointerEvent("pointerdown") });

// at: one vertical word, or vertical and horizontal in this order
new PositionCalculator({ item: "#popup", itemAt: "bottom", targetAt: "bottom left" });
// @ts-expect-error the halves are not separated, the result would be NaN
new PositionCalculator({ item: "#popup", itemAt: "bottomleft" });
// @ts-expect-error horizontal before vertical is not valid
new PositionCalculator({ item: "#popup", targetAt: "left top" });
// @ts-expect-error not a placement
new PositionCalculator({ item: "#popup", itemAt: "foo" });

// stick: "none", "all", a boolean, or one to four edges
new PositionCalculator({ item: "#popup", stick: "none" });
new PositionCalculator({ item: "#popup", stick: "all" });
new PositionCalculator({ item: "#popup", stick: true });
new PositionCalculator({ item: "#popup", stick: "top" });
new PositionCalculator({ item: "#popup", stick: "top left" });
new PositionCalculator({ item: "#popup", stick: "top right bottom" });
// @ts-expect-error not an edge
new PositionCalculator({ item: "#popup", stick: "foo" });
// @ts-expect-error one edge is unknown
new PositionCalculator({ item: "#popup", stick: "top foo" });
// @ts-expect-error no edge at all
new PositionCalculator({ item: "#popup", stick: "foo bar" });

// defaults are always set, so no `!` is needed
const defaultOffsetY: number | string = PositionCalculator.defaults.itemOffset.y;
const defaultFlip: Flip = PositionCalculator.defaults.flip;
// @ts-expect-error a default is never undefined
PositionCalculator.defaults.itemAt = undefined;

// the options of an instance are merged with the defaults, so they are always set
const flip: Flip = calculator.options.flip;
// @ts-expect-error an option of an instance is never undefined
calculator.options.flip = undefined;
console.log(defaultOffsetY, defaultFlip, flip);
