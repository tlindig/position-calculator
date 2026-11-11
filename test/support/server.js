import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".map": "application/json",
    ".json": "application/json",
    ".css": "text/css",
};

// Serves `root` on a random local port. Browsers do not load ES modules from file: URLs.
export function startServer(root) {
    const server = http.createServer((request, response) => {
        const file = path.join(root, decodeURIComponent(new URL(request.url, "http://localhost").pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            response.writeHead(404).end();
            return;
        }
        response.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(response);
    });
    return new Promise((resolve) =>
        server.listen(0, "127.0.0.1", () =>
            resolve({
                baseUrl: "http://127.0.0.1:" + server.address().port,
                close: () =>
                    new Promise((done) => {
                        server.close(done);
                        server.closeAllConnections();
                    }),
            }),
        ),
    );
}
