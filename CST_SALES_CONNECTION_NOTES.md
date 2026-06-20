# Sales CRM Integration Notes

Changes made without changing the UI/design:

- Fixed the CST frontend hydration warning protection by adding `suppressHydrationWarning` to the body tag.
- CST backend already has the Sales CRM receiver endpoint:
  - `POST /api/integrations/sales/handoffs`
  - `GET /api/integrations/sales/handlers`
- When Sales CRM sends a paid-in-full handoff, CST CRM creates:
  - Client
  - Client services
  - Onboarding checklist
  - Audit log

Required env value in `backend/.env`:

```env
SALES_CRM_INTEGRATION_SECRET=development-sales-integration-key
```

This must match Sales CRM `CST_CRM_INTEGRATION_SECRET`.
