/** Something that resolves to one element: an element, a selector, or an array-like (jQuery object, NodeList). */
export type ElementInput = string | Element | ArrayLike<Element>;

/**
 * Like {@link ElementInput}, plus window, document, a mouse or pointer event, and the strings "window" and "document".
 * Only events with pageX and pageY work, other events (keyboard, focus, touch) give NaN.
 */
export type TargetInput = ElementInput | Window | Document | MouseEvent | "window" | "document";

/** Like {@link ElementInput}, plus window, document, and the strings "window" and "document". */
export type BoundaryInput = ElementInput | Window | Document | "window" | "document";

export type Vertical = "top" | "middle" | "bottom";
export type Horizontal = "left" | "center" | "right";
export type Edge = "top" | "left" | "bottom" | "right";

/** "<vertical>" or "<vertical> <horizontal>", for example "bottom left". A missing or invalid half falls back to "top" or "left". */
export type At = Vertical | `${Vertical} ${Horizontal}`;

export interface Offset {
    /** pixels, or a percentage of the height as string, for example "10%" */
    y: number | string;
    /** pixels, or a percentage of the width as string, for example "10%" */
    x: number | string;
    /**
     * mirror the offset when the placement is flipped.
     * Absent means false. It does not take the `true` of the default offsets.
     */
    mirror?: boolean;
}

export type Flip = "none" | "item" | "target" | "both" | boolean;

/** "none", "all", true, false, or one to four edges separated by a space, for example "top left". */
export type Stick =
    "none" | "all" | boolean | Edge | `${Edge} ${Edge}` | `${Edge} ${Edge} ${Edge}` | `${Edge} ${Edge} ${Edge} ${Edge}`;

export interface PositionCalculatorOptions {
    /** the element being positioned (required) */
    item?: ElementInput | null;
    /** the element the item is aligned against */
    target?: TargetInput | null;
    /** the box that constrains the item. Default: the window. null: no boundary. */
    boundary?: BoundaryInput | null;
    /** reference point on the item. Default: "top left" */
    itemAt?: At;
    /** reference point on the target. Default: "top left" */
    targetAt?: At;
    itemOffset?: Offset;
    targetOffset?: Offset;
    /** Default: "none" */
    flip?: Flip;
    /** Default: "none" */
    stick?: Stick;
}

export interface Distance {
    top: number;
    left: number;
    bottom: number;
    right: number;
    /** edges of the boundary that the item overflows, null if none */
    overflow: Edge[] | null;
}

export interface CalculationResult {
    /** how far to move the item, in pixels */
    moveBy: { y: number; x: number };
    /** distance between item and boundary, null without boundary */
    distance: Distance | null;
    /** used reference point on the item, null without target */
    itemAt: string | null;
    /** used reference point on the target, null without target */
    targetAt: string | null;
}

export interface PositionCalculator {
    /** options of this instance, merged with the defaults */
    options: Required<PositionCalculatorOptions>;
    /** Read sizes again. Call it when the size of item, target or boundary changed. */
    resize(): this;
    /** Calculate for the current position in the DOM. null if the item was not found. */
    calculate(): CalculationResult | null;
    /** Calculate one placement without flip and stick. */
    calcVariant(
        itemAt: { x: Horizontal; y: Vertical } | null,
        targetAt: { x: Horizontal; y: Vertical } | null,
    ): CalculationResult;
}

export interface PositionCalculatorConstructor {
    new (options?: PositionCalculatorOptions): PositionCalculator;
    /** works without new, too */
    (options?: PositionCalculatorOptions): PositionCalculator;
    /** default options of new instances. `boundary` is the window in a browser, undefined without a DOM. */
    defaults: Required<PositionCalculatorOptions>;
}

export declare const PositionCalculator: PositionCalculatorConstructor;
