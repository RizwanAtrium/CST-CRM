# CST Step: Upsells filters cleanup

Completed updates:

- Removed Reset workflow from Upsells operational table.
- Upsells filters now use only the required bases:
  - Client
  - CST person / owner
  - Service
  - Revenue range
  - Existing status/date filters remain as operational filters from the page toolbar.
- Upsell top metrics now recalculate from the currently filtered rows instead of all rows.
- CSV export continues to export only filtered rows.
- Existing UI theme and layout were preserved.
