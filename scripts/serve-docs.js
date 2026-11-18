#!/usr/bin/env node
/*
 * Serves the built documentation (_site/) on http://127.0.0.1:<PORT>, default 8099. Run `npm run docs:serve`,
 * which builds first. After a change, stop the server and run it again.
 */
import path from "node:path";
import { startServer } from "../test/support/server.js";

const site = path.join(import.meta.dirname, "..", "_site");
const { baseUrl } = await startServer(site, Number(process.env.PORT) || 8099);
console.log(`Documentation at ${baseUrl}/ (stop with Ctrl+C)`);
