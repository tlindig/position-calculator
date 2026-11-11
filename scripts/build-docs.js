#!/usr/bin/env node
/*
 * Builds the documentation site from docs/ (no dependencies, like scripts/build.js):
 *   docs/nav.json              the pages in order: path, title, summary, section, navTitle
 *   docs/pages/<path>.html     page fragments: the content only, the layout adds heading and navigation
 *   docs/examples/<id>.html    example code shown in a try-it area, docs/examples/<id>.json holds its metadata
 *   docs/layout.html           the layout of every page
 *   docs/assets/               copied as is
 *
 * Tokens in a fragment (an unknown token fails the build):
 *   {{root}}                   relative path to the site root, so the site works under any base path
 *   {{version}}                version of package.json
 *   {{example:<id>}}           try-it area with the example <id>
 *   {{playground:<id>}}        try-it area with a picker for all examples, starting with <id>
 *
 * The build also checks that every page of nav.json has a fragment and the other way round, and that
 * every relative link and in-page anchor of the output resolves. It writes manifest.json, which the
 * test runner uses to find the examples and their checks.
 *
 *   node scripts/build-docs.js [--out=DIR] [--library=FILE]
 *     --out      default _site (emptied before the build; a given DIR is left alone)
 *     --library  the ES module the examples import, default dist/position-calculator.js (needs a build)
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const docsDir = path.join(root, "docs");
const defaultOutDir = path.join(root, "_site");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const errors = [];
function fail(message) {
    errors.push(message);
}
function finish() {
    if (errors.length) {
        console.error(errors.map((message) => "docs: " + message).join("\n"));
        process.exit(1);
    }
}

const options = {};
for (const arg of process.argv.slice(2)) {
    const match = /^--(out|library)=(.+)$/.exec(arg);
    if (match) {
        options[match[1]] = match[2];
    } else {
        fail("unknown argument " + arg);
    }
}
finish();

const outDir = path.resolve(options.out || defaultOutDir);
const library = path.resolve(options.library || path.join(root, "dist", "position-calculator.js"));
if (!fs.existsSync(library)) {
    fail(`library not found: ${library} (run "npm run build" first)`);
}
finish();

const read = (...parts) => fs.readFileSync(path.join(docsDir, ...parts), "utf8");
const escapeHtml = (text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isString = (value) => typeof value === "string" && value !== "";
const listFiles = (dir, extension) =>
    fs.existsSync(dir)
        ? fs
              .readdirSync(dir, { recursive: true })
              .filter((file) => file.endsWith(extension))
              .map((file) => file.split(path.sep).join("/"))
              .sort()
        : [];

// ---- navigation
const pages = JSON.parse(read("nav.json")).pages;
const pagePattern = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const knownPaths = new Set();
for (const page of pages) {
    if (!isString(page.path) || !pagePattern.test(page.path)) {
        fail("nav.json: invalid path " + JSON.stringify(page.path));
        continue;
    }
    if (knownPaths.has(page.path)) {
        fail("nav.json: duplicate path " + page.path);
    }
    knownPaths.add(page.path);
    for (const key of ["title", "summary"]) {
        if (!isString(page[key])) {
            fail(`nav.json: ${page.path} needs "${key}"`);
        }
    }
    if (!fs.existsSync(path.join(docsDir, "pages", page.path + ".html"))) {
        fail(`nav.json: no fragment docs/pages/${page.path}.html`);
    }
}
for (const file of listFiles(path.join(docsDir, "pages"), ".html")) {
    if (!knownPaths.has(file.replace(/\.html$/, ""))) {
        fail(`docs/pages/${file} is not listed in nav.json`);
    }
}

// ---- examples
const examples = new Map();
for (const file of listFiles(path.join(docsDir, "examples"), ".html")) {
    const id = file.replace(/\.html$/, "");
    const metaFile = path.join(docsDir, "examples", id + ".json");
    if (!fs.existsSync(metaFile)) {
        fail(`docs/examples/${id}.json is missing`);
        continue;
    }
    const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
    const example = { id, title: meta.title, height: meta.height ?? 260, scenarios: meta.scenarios ?? [] };
    if (!isString(example.title)) {
        fail(`examples/${id}.json needs "title"`);
    }
    if (!Number.isInteger(example.height) || example.height < 100 || example.height > 800) {
        fail(`examples/${id}.json: "height" must be an integer from 100 to 800`);
    }
    for (const scenario of example.scenarios) {
        const label = `examples/${id}.json scenario ${JSON.stringify(scenario.name)}`;
        if (!isString(scenario.name)) {
            fail(`examples/${id}.json: a scenario needs "name"`);
        }
        for (const step of scenario.steps ?? []) {
            if (!isString(step.dispatch) || !isString(step.on)) {
                fail(`${label}: a step needs "dispatch" and "on"`);
            }
        }
        for (const check of scenario.checks ?? []) {
            const numbers = Number.isFinite(check.left) && Number.isFinite(check.top);
            if (!isString(check.element) || !numbers) {
                fail(`${label}: a check needs "element", "left" and "top"`);
            }
        }
    }
    example.source = fs.readFileSync(path.join(docsDir, "examples", file), "utf8");
    examples.set(id, example);
}
finish();

// ---- rendering
const rowsFor = (source) => Math.min(18, source.split("\n").length + 1);

function tryIt(id, picker, where, widgets) {
    const example = examples.get(id);
    if (!example) {
        fail(`${where}: unknown example "${id}"`);
        return "";
    }
    widgets.push({ example: id, picker });
    let pickerHtml = "";
    let sources = "";
    if (picker) {
        const choices = [...examples.values()].map(
            (entry) =>
                `<option value="${entry.id}"${entry.id === id ? " selected" : ""}>${escapeHtml(entry.title)}</option>`,
        );
        pickerHtml = `<label class="tryit-picker">Example <select data-picker>${choices.join("")}</select></label>`;
        const data = Object.fromEntries(
            [...examples.values()].map((entry) => [entry.id, { height: entry.height, source: entry.source }]),
        );
        sources = `<script type="application/json" class="tryit-sources">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
    }
    return `<div class="tryit" data-example="${id}">
<div class="tryit-bar" hidden>${pickerHtml}<button type="button" data-action="run">Run</button><button type="button" data-action="reset">Reset</button><button type="button" data-action="copy">Copy</button><span class="tryit-state" role="status"></span></div>
<div class="tryit-body"><textarea class="tryit-code" rows="${rowsFor(example.source)}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code of the example">${escapeHtml(example.source)}</textarea><iframe class="tryit-frame" title="Result of the example" height="${example.height}" hidden></iframe></div>${sources}
</div>`;
}

function expand(text, values, where, widgets) {
    return text.replace(/\{\{([a-z-]+)(?::([a-z0-9-]+))?\}\}/g, (token, name, argument) => {
        if (name === "example" || name === "playground") {
            return argument ? tryIt(argument, name === "playground", where, widgets) : "";
        }
        if (argument === undefined && Object.hasOwn(values, name)) {
            return values[name];
        }
        fail(`${where}: unknown token ${token}`);
        return "";
    });
}

const relativeHref = (from, to) => path.posix.relative(path.posix.dirname(from + ".html"), to + ".html");

function renderNav(current) {
    const groups = [];
    for (const page of pages) {
        const section = page.section ?? "";
        let group = groups.find((entry) => entry.section === section);
        if (!group) {
            group = { section, items: [] };
            groups.push(group);
        }
        const label = escapeHtml(page.navTitle ?? page.title);
        const aria = page.path === current ? ' aria-current="page"' : "";
        group.items.push(`<li><a href="${relativeHref(current, page.path)}"${aria}>${label}</a></li>`);
    }
    return (
        "<ul>" +
        groups
            .map((group) =>
                group.section
                    ? `<li class="nav-group"><p class="nav-title">${escapeHtml(group.section)}</p><ul>${group.items.join("")}</ul></li>`
                    : group.items.join(""),
            )
            .join("") +
        "</ul>"
    );
}

if (outDir === defaultOutDir) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
    fs.writeFileSync(path.join(outDir, file), content);
};

const layout = read("layout.html");
const manifest = { version: pkg.version, pages: pages.map((page) => page.path + ".html"), widgets: [], examples: [] };
let drafts = 0;
for (const page of pages) {
    const where = "pages/" + page.path;
    const rootPath = "../".repeat(page.path.split("/").length - 1) || "./";
    const widgets = [];
    const content = expand(
        read("pages", page.path + ".html"),
        { root: rootPath, version: pkg.version },
        where,
        widgets,
    );
    if (content.includes('class="draft"')) {
        drafts++;
    }
    for (const widget of widgets) {
        manifest.widgets.push({ page: page.path + ".html", ...widget });
    }
    const html = expand(
        layout,
        {
            title: escapeHtml(page.title),
            summary: escapeHtml(page.summary),
            nav: renderNav(page.path),
            content,
            root: rootPath,
            version: pkg.version,
        },
        "layout.html",
        [],
    );
    write(page.path + ".html", html);
}
for (const example of examples.values()) {
    manifest.examples.push({ id: example.id, title: example.title, scenarios: example.scenarios });
}
write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
write("lib/position-calculator.js", fs.readFileSync(library));
for (const file of listFiles(path.join(docsDir, "assets"), "")) {
    write("assets/" + file, fs.readFileSync(path.join(docsDir, "assets", file)));
}
finish();

// ---- links: every relative href/src must exist, every in-page anchor must have its id
const idsOf = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
for (const page of pages) {
    const file = page.path + ".html";
    const html = fs.readFileSync(path.join(outDir, file), "utf8");
    for (const [, url] of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
        if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url) || url === "") {
            continue;
        }
        const [target, anchor] = url.split("#");
        const targetFile = target ? path.posix.join(path.posix.dirname(file), target) : file;
        const targetPath = path.join(outDir, targetFile);
        if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
            fail(`${file}: broken link ${url}`);
        } else if (anchor && targetFile.endsWith(".html")) {
            if (!idsOf(fs.readFileSync(targetPath, "utf8")).has(anchor)) {
                fail(`${file}: no anchor #${anchor} in ${targetFile}`);
            }
        }
    }
}
finish();

console.log(
    `built ${pages.length} pages and ${examples.size} examples into ${outDir}` +
        (drafts ? ` (${drafts} draft pages)` : ""),
);
