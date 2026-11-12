import fs from "node:fs";
import path from "node:path";

export const site = path.join(import.meta.dirname, "..", "..", "_site");

// the value of --name=value on the command line
export const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

// the pages of the build, or the ones named with --pages=a.html,b.html
export const pages = () =>
    option("pages")?.split(",") ?? JSON.parse(fs.readFileSync(path.join(site, "manifest.json"), "utf8")).pages;

// a widget leaves the state "running" when its example has loaded or failed
export const READY = `[...document.querySelectorAll(".tryit")].every((widget) => widget.dataset.state !== "running")`;
export const FAILED = `document.querySelectorAll('.tryit[data-state="error"]').length`;
