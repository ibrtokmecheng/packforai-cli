# packforai-cli

Convert **PDF, DOCX, PPTX, XLSX, CSV and JSON** into clean, compact, AI-ready Markdown from your terminal. Powered by [PackForAI](https://packforai.com).

## Install

Run without installing:

```bash
export PACKFORAI_API_KEY="your_key"   # from https://packforai.com/account (Pro)
npx packforai-cli report.pdf
```

Or install globally:

```bash
npm install -g packforai-cli
packforai report.pdf
```

## Usage

```
packforai <file-or-url> [options]

Options:
  --ocr           Force OCR for scanned / image-only PDFs (Pro).
  --full          Return the full document.md instead of the compact version.
  -o, --out FILE  Write the Markdown to FILE instead of stdout.
  -h, --help      Show help.
```

### Examples

```bash
packforai report.pdf                          # print clean Markdown
packforai https://example.com/spec.docx -o spec.md
packforai scan.pdf --ocr                      # OCR a scanned PDF
packforai data.xlsx --full > data.md          # full spreadsheet tables
```

Markdown goes to stdout (so you can pipe it), progress and token savings go to stderr.

## Config

- `PACKFORAI_API_KEY` (required) — your PackForAI API key. Create one at [packforai.com/account](https://packforai.com/account) (Pro plan).
- `PACKFORAI_BASE_URL` (optional) — override the API base.

## Links

- Website: [packforai.com](https://packforai.com) · Docs: [packforai.com/docs](https://packforai.com/docs)

## License

MIT
