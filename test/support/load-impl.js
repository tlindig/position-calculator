/*
 * Loads the implementation under test. Query parameters:
 *   impl=<url>      implementation file (default: ../src/position-calculator.js)
 *   jquery=0|1      load jQuery first (default: no). Only to test the jQuery.PositionCalculator alias.
 * Must be included with a plain <script> tag, because it uses document.write to keep the load order.
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

    var impl = params.impl || "../src/position-calculator.js";
    var needsJquery = params.jquery === "1";
    var sources = needsJquery ? ["reference/jquery.js", impl] : [impl];

    sources.forEach(function(src) {
        document.write('<script src="' + encodeURI(src) + '"><\/script>');
    });
}());
