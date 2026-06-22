# CST Step: Edit Client Contact Fields

Implemented on the client profile Edit Client modal.

## Added fields

- Mobile number
- Business address

## Updated behavior

- Business name, customer name, email, phone, mobile, and business address can be edited from the client profile modal.
- Phone is now required in the edit form.
- Mobile and business address are saved into the client state.
- Client profile Overview now displays mobile and business address.
- Existing layout and theme were kept unchanged.

## Validation

- `npm run lint` passed in frontend.
- `npx tsc --noEmit` passed in frontend.
