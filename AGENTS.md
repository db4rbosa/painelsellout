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
