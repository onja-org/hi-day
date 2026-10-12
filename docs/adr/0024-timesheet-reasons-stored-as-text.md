---
status: accepted
---

# A picked Timesheet reason is recorded as text, not as a reference

An Organisation now keeps a list of **Timesheet reasons** — selectable labels like "Forgot to start timer" — that someone picks from when they add, edit or delete time. Before this, the reason was free text typed into a box, stored on the AuditLog row for that action (`metadata.reason`) and surfaced as the Manual time edits report's `reason` column.

Introducing a list raises a question the free-text version never had: when someone picks "Client meeting", does the audit row store the Reason's id or its wording?

Storing the id is the normalised answer and it is the wrong one here. These rows are an audit trail. If an admin renames "Client meeting" to "Internal sync" a year from now, id-storage silently rewrites what every past entry claims the person said — the one property an audit trail exists to guarantee. Deleting a Reason is worse: every historical row that referenced it reads as blank or "deleted reason", so tidying the picker quietly destroys recorded history.

## Decisions

- **The chosen wording is copied onto the audit row.** `metadata.reason` stays what it has always been: a plain string. A Timesheet reason is a convenience for the person filling the form, not the identity of what they said.
- **Nothing references `timesheet_reasons`.** No foreign key points at the table, so a Reason can be hard-deleted rather than soft-deleted, and no "this reason no longer exists" state has to be designed, rendered or migrated.
- **Renaming is honest about what it does.** `timesheet_reason.renamed` records both the old and the new wording, because past entries keep the old one and a reader comparing them needs the link.
- **"Other…" stays.** The picker always offers free text alongside the list, and an Organisation with no Reasons configured gets exactly the box it had before. A list that cannot express what happened would push people into picking something inaccurate, which is worse than an unconstrained string.
- **Consequence accepted: reporting on reasons is string-grouped.** Counting "how often was Client meeting given" means grouping by text, and typos or renames fragment that grouping. That is the cost of an immutable trail, and it is the same trade-off the **Client** field on Project already makes. If reason analytics ever justifies it, the fix is a *second*, denormalised id column alongside the text — not replacing the text.
- **Labels are unique per Organisation, case-insensitively.** Enforced by a `LOWER("label")` unique index, since "Client meeting" and "client meeting" would read as duplicates in a picker. The service checks the same way so a clash returns a message rather than a 500.

## Status of the sibling settings

This ADR covers Reasons and Require reason, which are live. The other three Timesheets settings shipped alongside them — Modify time, Require approval, and managers-approve-own — are stored and surfaced but consulted by nothing; see CONTEXT.md's **Timesheets settings** entry.
