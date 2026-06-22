# CST Step: Reports Filters Cleanup

Implemented on Reports screen:

- Removed the Reset button from the Reports toolbar.
- Added CST person / owner filter.
- Added Client filter.
- Added Service filter for Reports.
- Kept Status and date range filters.
- Report search now also checks client services.
- Reports table updates according to selected filters.
- Export CSV exports only the filtered report rows.

Validation:

- ESLint passed using the installed ESLint binary.
- Frontend production build passed using Next.js build.
