# CST Step — Onboarding Checklist Save Flow

Implemented for the onboarding detail screen:

- Checklist items are now clickable where manual updates are allowed.
- Checklist changes remain in a pending/unsaved state after click.
- A warning panel appears when there are unsaved checklist changes.
- Added `Save changes` button for onboarding checklist updates.
- Added `Discard` button to undo accidental clicks before saving.
- History entries are created only after `Save changes` is pressed.
- History logs include actor, timestamp, completed/reopened status, and milestone name.
- Onboarding progress recalculates from the current pending state before save, then becomes the saved state after save.
- Accidental clicks do not create history logs unless saved.

Validation:

- Frontend lint passed.
- Frontend TypeScript check passed.
