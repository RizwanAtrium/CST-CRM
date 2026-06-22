# CST Step: Complaints Filters Cleanup

## Completed
- Removed the reset-button pattern from the Complaints table toolbar.
- Added complaint filtering by CST person / owner.
- Added complaint filtering by client name.
- Added complaint filtering by client services.
- Added complaint filtering by client revenue / MRR range.
- Complaint table can show client revenue for context.
- CSV export respects the currently selected filters.

## Verification
- TypeScript check passed with `node ../node_modules/typescript/bin/tsc --noEmit`.
- ESLint passed with `node ../node_modules/eslint/bin/eslint.js .`.
