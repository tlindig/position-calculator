/*
 * Loads the implementation under test. Query parameters:
 *   impl=<url>      implementation file (default: /src/position-calculator.js)
 *   format=esm|iife how the browser loads it (default: esm)
 *                   esm:  as ES module. If it exports PositionCalculator, that becomes window.PositionCalculator.
 *                         A module that sets the global itself (src/iife.js) is loaded as it is.
 *                   iife: as classic script
 *   jquery=0|1      load jQuery first (default: no). Only to test the jQuery.PositionCalculator alias.
 * Must be included with a plain <script> tag, because it uses document.write to keep the load order.
 * Module scripts run deferred, before DOMContentLoaded and so before the "load" event that starts the tests.
 */
(function() {
    "use strict";

    var params = {};
    location.search.slice(1).split("&").forEach(function(pair) {
        var kv = pair.split("=");
        if (kv[0]) {
            params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
        }
    });
    window.TestParams = params;

    var impl = params.impl || "/src/position-calculator.js";

    if (params.jquery === "1") {
        document.write('<script src="/test/reference/jquery.js"><\/script>');
    }
    if (params.format === "iife") {
        document.write('<script src="' + encodeURI(impl) + '"><\/script>');
    } else {
        document.write('<script type="module">' +
            "import * as impl from " + JSON.stringify(impl) + ";" +
            "if (impl.PositionCalculator) { window.PositionCalculator = impl.PositionCalculator; }" +
            "<\/script>");
    }
}());
