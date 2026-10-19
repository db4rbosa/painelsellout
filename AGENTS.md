<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Model Line of Business groupings as 1–4 persisted buckets; a LOB may belong to multiple buckets and contributes fully to each, while all targets, reports, and AI context derive from this configuration.
- Drive sales-detail dialogs from a generic dimension/value selection; only End User also carries Account context to prevent mixing namesakes.
- Persist compensation settings in existing user preferences and keep the payout curve in one pure calculation module; derive annual payouts from all four quarters independently of the visible quarter selection to avoid projecting partial results as a full year.
- Compose compensation comparisons and per-bucket payouts inside TargetPanel alongside attainment; chart calculated amounts as projections rather than confirmed receipts because no actual payment records are collected.
- Resolve any presented bearer before considering the legacy master cookie; derive preference ownership exclusively from the verified identity and never from caller input.
- Serialize dashboard preference writes and reuse that queue for explicit section saves to prevent older autosaves overwriting acknowledged changes.
- Organize target detail into monthly, quarter, and full-year views with a shared selected-period summary; preserve full-year calculation independent of visible quarters.
- Edit quarter accounts and bucket targets only in the settings sheet through QuarterTargetSettings; share dashboard state and its save queue to keep analysis views read-only without divergent preferences.
- Run settings ownership unit tests with vitest.settings.config.ts so server-function handlers are tested without the production RPC compiler transform.
- Use the same validated workbook parser in the browser and AI context; follow workbook relationship order and scan all rows so blank formatting cannot silently truncate sales.
- Index normalized Line of Business memberships before attainment aggregation to avoid repeated bucket scans while preserving full contribution to overlapping buckets.
- Parse browser imports in a dedicated disposable module worker with a transferable buffer; retain the same pure buffer parser on the server to keep the interface responsive without divergent validation.

- Return structured row diagnostics from the shared workbook parser, preserve original Excel row numbers, and exclude invalid transactions without discarding valid ones; retain array-returning wrappers for existing calculation callers.
- Attach gateway correlation headers only to gateway-backed streams; direct providers bypass run-ID waiting to prevent unresolved responses.
- Calculate monthly customer maxima from scoped transactions grouped by customer, Account and fiscal month, with sales and services separate, so annual rankings cannot stand in for monthly comparisons.
