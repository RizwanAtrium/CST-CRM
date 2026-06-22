# CST Step: Client Edit History Logging

Implemented history logging for client master record edits.

## What changed

- Edit Client modal changes now create visible History entries in the client profile.
- Logged fields:
  - Business name
  - Customer name
  - Email
  - Phone
  - Mobile
  - Business address
  - CST handler
  - Lifecycle stage
- Each history row includes:
  - Actor
  - Timestamp
  - Changed field
  - Old value
  - New value
  - `Client updated` tag

## Backend audit support

- `PATCH /clients/:id` now stores field-level `changes` inside the audit payload.
- Added `GET /clients/:id/history` endpoint to return audit records for the client.

## Build verification

- Frontend lint passed.
- Frontend production build passed.
- Backend TypeScript build passed.

## Extra deployment-safe fix

- Removed `next/font/google` dependency from the root layout and added local CSS font fallbacks so Vercel/offline builds do not fail when Google Fonts cannot be fetched.
