import {
    PositionCalculator,
    type CalculationResult,
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
