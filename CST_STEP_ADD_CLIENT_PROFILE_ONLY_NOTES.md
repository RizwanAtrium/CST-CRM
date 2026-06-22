# CST Step: Add Client Profile-Only Create Flow

Implemented on the Clients screen Add Client modal:

- Removed required Work Start Date entry from client creation.
- Work start date now stays as `Pending production go-ahead` until production approves/go-ahead is received.
- Added profile-first fields:
  - Business name
  - Customer name
  - Email
  - Phone number
  - Mobile
  - Business address
  - CST handler
  - Client notes/details
- Added services agreed and paid section:
  - Multiple service rows
  - Price paid per service
  - Auto total paid calculation
- New client records now create a customer profile based on the provided details instead of assuming onboarding has started.

Notes:
- Existing UI style and layout were kept.
- Client-specific work start should be updated later from production/onboarding flow after go-ahead.
