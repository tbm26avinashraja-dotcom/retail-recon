# SBI & RBI Finance Reconciliation — Browser Prototype

Next.js app for Vercel; all CSV/XLSX parsing, joins, calculations, and Excel generation occur in the browser. **No source files are uploaded to a server.**

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. To validate logic: `npm test`; to verify deployment build: `npm run build`.

## Deploy via GitHub + Vercel

1. Create a **private** GitHub repository and push this folder (do not commit real Finance input files).
2. In Vercel, select **Add New → Project → Import Git Repository**.
3. Select the repository; framework should auto-detect **Next.js**.
4. Deploy. No environment variables or server-side secrets are required for this file-upload prototype.
5. Restrict access using your organization's approved Vercel deployment controls before using actual financial data. Do not assume an obscure URL provides access control.

## Workflow

- **SBI:** append uploaded SBI CSV/XLSX files; filter `retail_offline`, selected created-date window, nonzero copay; match shipment IDs to consolidated Retail Sales order IDs; group by shipment ID; sum GMV and copay; export four columns. Cancelled-only SBI matches are **reviewed but retained by default** because Finance has not approved their exclusion.
- **RBI:** append RBI inputs; filter COT / retail_offline / B2bClient / retail_store_fc, RBI customer name and two sample store IDs; match to Retail Sales; exclude unmatched and cancelled-only matches; make `bill_amount` negative for returns; preserve other invoice columns, dropping `Name`, `Code`, `Type`.
- **Retail:** accepts any number of CSV/XLSX input files. Joins use `order_id` and `group_id` when present. If multiple matches exist, an order is eligible if any matching record is not cancelled.
- **Exports:** one Excel workbook per run, containing final output, exceptions and run summary.

## Important caveats

- Historical outputs: SBI 873 records and RBI 286 records for supplied sample period. The sample benchmarks are not guarantees for other periods.
- Nonzero copay, RBI return sign, fixed RBI store selection, reporting date and SBI cancellation handling are **pending Finance approval**.
- `group_id` fallback and "any non-cancelled match" handling are engineering assumptions requiring validation.
- Exact-row deduplication is optional and **enabled by default**. Verify it does not remove legitimate repeated identical transactions in your source system.
- Large input files (e.g. 40 MB retail CSV) may consume significant browser memory, particularly with XLSX exports. Test on a desktop browser.
- This prototype does not authenticate users or persist run history. Restrict deployment access before using sensitive financial files.
- XLSB is not supported; use CSV/XLSX.
- If Databricks is confirmed as the common underlying source, direct Databricks jobs are preferable for production-scale ingestion and scheduling.
