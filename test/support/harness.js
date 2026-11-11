/*
 * Minimal test harness for the browser pages. Replaces QUnit and provides the globals the test files use:
 * module(name, {setup, teardown}), test(name, fn), ok, strictEqual, deepEqual, throws.
 * Tests run synchronously in registration order after the window "load" event. Every test gets a fresh
 * `this`, shared by setup, test body and teardown.
 *
 * Results are published as window.TestResult, window.TestDone and a "testdone" event for test/run.js.
 * A test without any assertion fails. Modules whose name starts with "[target]" hold behavior that is
 * decided but not implemented yet. run.js reports them as todo.
 */
(function (root) {
    "use strict";

    var registry = [];
    var moduleName = "";
    var moduleEnv = {};
    var running = null;
    var out = { tests: [], info: [], summary: null };

    function snapshot(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return String(value);
        }
    }

    function record(passed, message, actual, expected) {
        if (passed) {
            running.passed++;
        } else {
            running.failed++;
            running.failures.push({ message: message, actual: snapshot(actual), expected: snapshot(expected) });
        }
        return passed;
    }

    function equiv(a, b) {
        if (a === b || (a !== a && b !== b)) {
            return true;
        }
        if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) {
            return false;
        }
        var keys = Object.keys(a);
        return (
            keys.length === Object.keys(b).length &&
            keys.every(function (key) {
                return Object.prototype.hasOwnProperty.call(b, key) && equiv(a[key], b[key]);
            })
        );
    }

    root.module = function (name, env) {
        moduleName = name;
        moduleEnv = env || {};
    };

    root.test = function (name, fn) {
        registry.push({ module: moduleName, env: moduleEnv, name: name, fn: fn });
    };

    root.ok = function (value, message) {
        return record(!!value, message, value, true);
    };

    root.strictEqual = function (actual, expected, message) {
        return record(actual === expected, message, actual, expected);
    };

    root.deepEqual = function (actual, expected, message) {
        return record(equiv(actual, expected), message, actual, expected);
    };

    root.throws = function (fn, message) {
        var thrown = false;
        try {
            fn();
        } catch (e) {
            thrown = true;
        }
        return record(thrown, message || "expected an exception", "no exception", "an exception");
    };

    root.Report = {
        info: function (text) {
            out.info.push(String(text));
        },
    };

    function guarded(fn, context, label) {
        try {
            fn.call(context);
        } catch (e) {
            record(false, label + ": " + ((e && e.stack) || e));
        }
    }

    function runAll() {
        var totals = { total: 0, passed: 0, failed: 0 };
        registry.forEach(function (entry) {
            var context = {};
            running = { module: entry.module, name: entry.name, passed: 0, failed: 0, failures: [] };
            if (entry.env.setup) {
                guarded(entry.env.setup, context, "setup failed");
            }
            guarded(entry.fn, context, "died");
            if (entry.env.teardown) {
                guarded(entry.env.teardown, context, "teardown failed");
            }
            if (running.passed + running.failed === 0) {
                record(false, "no assertion was run");
            }
            running.total = running.passed + running.failed;
            totals.total += running.total;
            totals.passed += running.passed;
            totals.failed += running.failed;
            out.tests.push(running);
        });
        running = null;
        out.summary = totals;
        root.TestResult = out;
        root.TestDone = true;
        root.dispatchEvent(new Event("testdone"));
    }

    root.addEventListener("load", runAll);
})(window);
