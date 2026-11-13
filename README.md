# AWS Meal Tracker

A Node.js/Express API for tracking daily macros. Users log the foods they eat under a meal type (breakfast, lunch, dinner, snack), set daily macro goals, and see whether they hit them at the end of the day.

Built as an AWS practice project: authentication runs on Amazon Cognito, data lives in Amazon RDS (PostgreSQL), food images live in Amazon S3, and the app is containerized with Docker for Elastic Beanstalk.

## Tech stack

- Node.js 22, Express 5 (ES modules)
- PostgreSQL on AWS RDS, accessed with `pg`; schema managed with `node-pg-migrate`
- Amazon Cognito (User Pool) for authentication, via `@aws-sdk/client-cognito-identity-provider`
- Amazon S3 with presigned URLs for food images
- Docker (`node:22-alpine`) for deployment
- Jest + Supertest for tests, ESLint for linting

## Project structure

```
aws-meal-tracker/
├── config/
│   ├── cognito.js        # Cognito client
│   ├── database.js       # pg pool (verified TLS to RDS) + type parsers
│   └── s3.js             # S3 client + public catalog image URL builder
├── controller/           # Request handlers (auth, foods, my foods, users, health)
├── middleware/           # authenticate, authenticateAdmin, errorMiddleware
├── migrations/           # Versioned schema changes (node-pg-migrate)
├── routes/               # Express routers
├── scripts/migrate.js    # Applies pending migrations
├── services/             # provisionUser (idempotent Cognito → users row)
├── utils/
│   ├── httpError.js      # Error with an HTTP status, handled by errorMiddleware
│   ├── images.js         # S3 key rules and presigning
│   ├── validation.js     # parseId, parsePage, parseDate, validateFoodPayload
│   └── secretHash.js     # Computes Cognito SECRET_HASH
├── test/                 # Jest tests + helpers (DB reset, dummy AWS env)
├── server.js             # App entry point
└── Dockerfile
```

## Environment variables

Create a `.env` file in the project root:

| Variable | Description |
| --- | --- |
| `PORT` | Port the server listens on (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string for the RDS instance |
| `TEST_DB_URL` | PostgreSQL connection string for the local test database |
| `USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret (confidential client) |
| `AWS_REGION` | AWS region, e.g. `us-east-2` |
| `S3_BUCKET_NAME` | Bucket for food images |
| `RDS_CA_PATH` | Optional. Path to the RDS CA bundle; defaults to `certs/rds-global-bundle.pem` |

Never commit `.env`.

The AWS SDK also needs AWS credentials to sign requests. Locally, run `aws login` (or configure a profile). On Elastic Beanstalk, the instance's IAM role provides them. The `AdminGetUser` call used to provision users requires the `cognito-idp:AdminGetUser` permission. Tests never use real credentials: `test/helpers/env.js` forces dummy ones.

The database connection verifies the RDS certificate. For local development against RDS, download the bundle once (the `certs/` folder is git-ignored; the Docker image downloads its own copy):

```bash
mkdir -p certs
curl -o certs/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

## Getting started

```bash
npm install
npm run migrate  # apply pending migrations to DATABASE_URL
npm run dev      # runs the server with nodemon
```

The server checks the database on startup and exits if it is unreachable. It no longer creates tables: the schema comes from the migrations in `migrations/`, applied by `scripts/migrate.js` (the Docker image runs it before starting the server).

Other scripts:

```bash
npm start        # node server.js (what the container runs)
npm test         # applies migrations to TEST_DB_URL, then runs Jest in band
npm run lint     # ESLint
```

To change the schema, add a new file to `migrations/` (`npx node-pg-migrate create <name>`); never edit one that has already run.

### Docker

```bash
docker build -t meal-tracker .
docker run -p 5000:5000 --env-file .env meal-tracker
```

## Authentication flow

Authentication is handled by Cognito, and the Express API calls Cognito directly. The app client is a confidential client, so every Cognito call includes a `SECRET_HASH` (HMAC-SHA256 of `username + clientId`, keyed with the client secret, base64-encoded), built by `utils/secretHash.js`.

1. **Sign up**: the API creates the user in Cognito and Cognito emails a confirmation code.
2. **Confirm**: the API confirms the code with Cognito, then upserts the `users` row with `provisionUser`.
3. **Login**: `InitiateAuth` with `USER_PASSWORD_AUTH` returns the Cognito tokens.
4. **Refresh**: `REFRESH_TOKEN_AUTH` returns new access/ID tokens from the refresh token.

If the `users` insert fails after Cognito confirmed the account, `authenticate` creates the row on the user's first authenticated request, so nobody gets locked out. Invalid or expired tokens return 401.

The Cognito `sub` is stored as `users.cognito_id`. It never changes, even if the user changes their email, and it links a Cognito identity to the internal `users.id` used by every other table.

`/api/auth/*` is rate limited to 20 requests per IP per 15 minutes.

## API endpoints

Base path: `/api`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health/status` | none | Health check (also checks the database; 503 if unreachable) |
| `POST` | `/auth/signup` | none | `email`, `password`, `first_name`, `last_name` |
| `POST` | `/auth/confirm` | none | `email`, `code` |
| `POST` | `/auth/login` | none | `email`, `password` |
| `POST` | `/auth/refresh` | none | `refreshToken`, `sub` |
| `GET` | `/users/me` | user | Current user's profile |
| `POST` | `/foods/upload-url` | admin | Presigned upload URL under `foods/` |
| `POST` | `/foods/add` | admin | Add a catalog food |
| `GET` | `/foods/all?currentPage=N` | none | Catalog, 12 per page |
| `GET` | `/foods/:foodId` | none | One catalog food |
| `PATCH` | `/foods/update/:foodId` | admin | Partial update |
| `DELETE` | `/foods/delete/:foodId` | admin | Soft delete |
| `POST` | `/myfoods/upload-url` | user | Presigned upload URL under `myfood/<userId>/` |
| `POST` | `/myfoods/add` | user | Add a personal food |
| `GET` | `/myfoods/all?currentPage=N` | user | The user's foods, 12 per page, presigned image URLs |
| `GET` | `/myfoods/:foodId` | user | One of the user's foods |
| `PATCH` | `/myfoods/update/:foodId` | user | Partial update of one of the user's foods |

Planned: delete for my foods, goals, meal logging and daily progress endpoints.

## Database schema

| Table | Purpose |
| --- | --- |
| `users` | App users: `cognito_id` (unique), first/last name, email, `created_at` |
| `goals` | One row per user with daily targets: calories, protein, carbs, fiber, fat |
| `meal_types` | Lookup table: breakfast, lunch, dinner, snack (with `sort_order`) |
| `meals` | A meal a user logged: user, meal type, `logged_date` (sent by the client) |
| `foods` | Shared food library with macros per 100g; soft-deleted with `deleted_at` |
| `my_foods` | User-created foods, same shape as `foods` plus `user_id` |
| `meal_foods` | Foods in a meal with `quantity_g` and a snapshot of the computed macros; each row references either `food_id` or `my_food_id` (enforced by a `CHECK`) |
| `daily_totals` (view) | Per user per day sums of the `meal_foods` snapshots |

Design notes:

- Macros are stored per 100g. The app converts other units (cups, eggs, etc.) to grams before saving.
- When a food is logged, its macros for that quantity are copied onto the `meal_foods` row, so editing or deleting a food never changes past meals.
- Daily totals are computed by the `daily_totals` view, so there are no running totals to keep in sync. "Goal met" is computed in the API by comparing the day's totals with the goals row.
- `meals.logged_date` has no default: the client sends the date it means, because the server's date is UTC.
- Catalog image URLs are public (`foods/` prefix); personal food images are private and served through short-lived presigned URLs. The key for a personal image includes the user's id, and the API rejects keys outside the requester's prefix.

## Deployment

The app is designed to run on AWS Elastic Beanstalk (Docker platform) with an RDS PostgreSQL database and a Cognito User Pool. The container runs as the `node` user, applies migrations on start, and shuts down cleanly on `SIGTERM`. Remember to delete the Elastic Beanstalk environment and RDS instance when you finish practicing to avoid ongoing charges.
