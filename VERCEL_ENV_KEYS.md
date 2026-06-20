# CST CRM - Vercel Environment Variables

CST frontend project:

```env
NEXT_PUBLIC_API_URL=https://cst-crm-api.vercel.app/api
```

CST backend/API project:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=<your-cst-mongodb-uri>
JWT_SECRET=<at-least-32-character-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://cst-crm.vercel.app
APP_TIMEZONE=Asia/Karachi
CRON_ENABLED=true
CRON_SECRET=<at-least-32-character-random-secret>
SALES_CRM_INTEGRATION_SECRET=development-sales-integration-key
CST_INTEGRATION_SECRET=development-sales-integration-key
AUTO_SEED_DIRECTOR=true
DIRECTOR_NAME=Director Admin
DIRECTOR_EMAIL=director@cstcrm.com
DIRECTOR_PASSWORD=Director@12345
```

Important:
- `SALES_CRM_INTEGRATION_SECRET` must exactly match Sales CRM `CST_CRM_INTEGRATION_SECRET`.
- `CORS_ORIGIN` should be the CST frontend production URL.
