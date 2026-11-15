import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

// Same candidates as test/run.js: the environment variable CHROME first, then the usual command names.
// Playwright needs the full path, so a bare command name is looked up in PATH.
export function findChrome() {
    for (const candidate of [process.env.CHROME, "google-chrome", "chromium", "chromium-browser"]) {
        if (!candidate || spawnSync(candidate, ["--version"]).status !== 0) {
            continue;
        }
        if (candidate.includes("/")) {
            return candidate;
        }
        for (const dir of (process.env.PATH || "").split(delimiter)) {
            if (existsSync(join(dir, candidate))) {
                return join(dir, candidate);
            }
        }
    }
    throw new Error("Chrome not found. Set CHROME to the path of the executable.");
}
