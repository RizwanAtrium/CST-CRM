# Director Admin Update

CST backend now auto-creates/updates the Director admin user on server start when `AUTO_SEED_DIRECTOR=true`.

## Default login

Email: `director@cstcrm.com`
Password: `Director@12345`
Role: `DIRECTOR`

## Required Vercel env for CST API

```env
AUTO_SEED_DIRECTOR=true
DIRECTOR_NAME=Director Admin
DIRECTOR_EMAIL=director@cstcrm.com
DIRECTOR_PASSWORD=Director@12345
CST_INTEGRATION_SECRET=development-sales-integration-key
SALES_CRM_INTEGRATION_SECRET=development-sales-integration-key
```

`CST_INTEGRATION_SECRET` and Sales CRM `CST_INTEGRATION_SECRET` must match.

Security note: after first successful production login, change `DIRECTOR_PASSWORD` to a stronger private password and redeploy.
