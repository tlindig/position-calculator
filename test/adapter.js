/*
 * The only file that knows how the tested implementation is exposed.
 * Tests pass plain DOM nodes, selector strings, window, document or native events as elements.
 */
(function(root) {
    "use strict";

    function implementation() {
        var ctor = root.PositionCalculator || (root.jQuery && root.jQuery.PositionCalculator);
        if (!ctor) {
            throw new Error("No PositionCalculator found. Check the impl parameter.");
        }
        return ctor;
    }

    root.Adapter = {
        // implementation under test
        create: function(options) {
            var Ctor = implementation();
            return new Ctor(options);
        },
        // frozen legacy build in test/reference, used as oracle by the validation set
        createReference: function(options) {
            return new root.ReferenceCalculator(options);
        },
        // raw constructor, for tests of the constructor itself
        ctor: implementation
    };
}(window));
