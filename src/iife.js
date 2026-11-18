/*
 * Entry of the IIFE build: sets the browser global and, like 1.x, the jQuery alias.
 */
import { PositionCalculator } from "./position-calculator.js";

window.PositionCalculator = PositionCalculator;
if (window.jQuery) {
    // alias of version 1.x
    window.jQuery.PositionCalculator = PositionCalculator;
}
