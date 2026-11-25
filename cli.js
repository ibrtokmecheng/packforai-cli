#!/usr/bin/env node
/**
 * PackForAI CLI — convert a document to clean, AI-ready Markdown from the terminal.
 *
 * Usage:
 *   export PACKFORAI_API_KEY="your_key"          # from https://packforai.com/account (every plan)
 *   packforai <file-or-url> [--ocr] [--full] [-o out.md]
 *
 * Examples:
 *   packforai report.pdf
 *   packforai https://example.com/spec.docx -o spec.md
 *   packforai scan.pdf --ocr
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { formatTokenSummary } from "./token-summary.js";

const API_BASE = process.env.PACKFORAI_BASE_URL ?? "https://packforai.com/api/v1";
const API_KEY = process.env.PACKFORAI_API_KEY;

const HELP = `packforai — convert documents to clean, AI-ready Markdown

Usage:
  packforai <file-or-url> [options]

Options:
  --ocr           Force OCR for scanned / image-only PDFs (Pro).
  --full          Return the full document.md instead of the compact version.
  -o, --out FILE  Write the Markdown to FILE instead of stdout.
  -h, --help      Show this help.

Environment:
  PACKFORAI_API_KEY   Your PackForAI API key (required). Get one at
                      https://packforai.com/account (every plan, the free
                      plan included: 3 conversions a day).
`;

function parseArgs(argv) {
  const opts = { input: null, ocr: false, full: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") return { help: true };
    else if (a === "--ocr") opts.ocr = true;
    else if (a === "--full") opts.full = true;
    else if (a === "-o" || a === "--out") opts.out = argv[++i] ?? null;
    else if (!a.startsWith("-") && !opts.input) opts.input = a;
    else return { error: `Unexpected argument: ${a}` };
  }
  return opts;
}

function fail(msg) {
  process.stderr.write(`packforai: ${msg}\n`);
  process.exit(1);
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

async function loadInput(input) {
  if (isUrl(input)) {
    const res = await fetch(input);
    if (!res.ok) fail(`could not fetch URL: ${res.status} ${res.statusText}`);
    const name = decodeURIComponent(new URL(input).pathname.split("/").filter(Boolean).at(-1) ?? "document");
    return { bytes: new Uint8Array(await res.arrayBuffer()), filename: name };
  }
  try {
    return { bytes: new Uint8Array(await readFile(input)), filename: basename(input) };
  } catch (error) {
    fail(`could not read file "${input}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (opts.error) fail(opts.error);
  if (!opts.input) fail("provide a file path or URL. Try --help.");
  if (!API_KEY) fail("PACKFORAI_API_KEY is not set. Get a key at https://packforai.com/account");

  const { bytes, filename } = await loadInput(opts.input);

  const form = new FormData();
  form.append("file", new Blob([bytes]), filename);
  form.append("ocr", opts.ocr ? "true" : "false");

  process.stderr.write(`Converting "${filename}"...\n`);
  const submit = await fetch(`${API_BASE}/convert`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form
  });
  if (!submit.ok) fail(`convert failed (${submit.status}): ${await safeError(submit)}`);
  const { id } = await submit.json();
  if (!id) fail("no job id returned.");

  const started = Date.now();
  const query = opts.full ? "?format=full" : "";
  let job;
  while (Date.now() - started < 5 * 60 * 1000) {
    await sleep(2000);
    const poll = await fetch(`${API_BASE}/jobs/${id}${query}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!poll.ok) fail(`polling failed (${poll.status}): ${await safeError(poll)}`);
    job = await poll.json();
    if (job.status === "completed" || job.status === "failed") break;
  }
  if (!job || (job.status !== "completed" && job.status !== "failed")) fail("timed out after 5 minutes.");
  if (job.status === "failed") fail(`conversion failed: ${job.error ?? "unknown error"}`);

  const markdown = job.markdown ?? "";
  const tokenSummary = formatTokenSummary(job.tokens);
  if (tokenSummary) process.stderr.write(`Done: ${tokenSummary}.\n`);

  if (opts.out) {
    await writeFile(opts.out, markdown, "utf8");
    process.stderr.write(`Wrote ${opts.out}\n`);
  } else {
    process.stdout.write(markdown + "\n");
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function safeError(res) {
  try {
    const j = await res.json();
    return j?.error ?? JSON.stringify(j);
  } catch {
    return res.statusText;
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
