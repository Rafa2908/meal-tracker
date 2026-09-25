# AWS Meal Tracker

A Node.js/Express API for tracking daily macros. Users log the foods they eat under a meal type (breakfast, lunch, dinner, snack), set daily macro goals, and see whether they hit them at the end of the day.

Built as an AWS practice project: authentication runs on Amazon Cognito, data lives in Amazon RDS (PostgreSQL), and the app is containerized with Docker for Elastic Beanstalk.

## Tech stack

- Node.js 20, Express 5 (ES modules)
- PostgreSQL on AWS RDS, accessed with `pg`
- Amazon Cognito (User Pool) for authentication, via `@aws-sdk/client-cognito-identity-provider`
- Docker (`node:20-alpine`) for deployment
- Jest + Supertest for tests, ESLint for linting

## Project structure

```
aws-meal-tracker/
├── config/
│   ├── cognito.js        # Cognito client
│   └── database.js       # pg connection pool + connection test
├── controller/           # Request handlers (auth, health)
├── modal/                # Table definitions + initializeDatabase()
├── routes/               # Express routers
├── utils/
│   └── secretHash.js     # Computes Cognito SECRET_HASH
├── server.js             # App entry point
└── Dockerfile
```

## Environment variables

Create a `.env` file in the project root:

| Variable | Description |
| --- | --- |
| `PORT` | Port the server listens on (Dockerfile exposes 5000) |
| `DATABASE_URL` | PostgreSQL connection string for the RDS instance |
| `USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret (confidential client) |
| `AWS_REGION` | AWS region of the User Pool, e.g. `us-east-2` |

Never commit `.env`.

The AWS SDK also needs AWS credentials to sign requests. Locally, run `aws login` (or configure a profile). On Elastic Beanstalk, the instance's IAM role provides them. The `AdminGetUser` call in the confirm flow requires the `cognito-idp:AdminGetUser` permission.

## Getting started

```bash
npm install
npm start        # runs the server with nodemon
```

On startup the app tests the database connection and creates any missing tables (`CREATE TABLE IF NOT EXISTS`, in dependency order), and seeds the `meal_types` lookup table.

Other scripts:

```bash
npm test         # Jest (runs in band, NODE_ENV=test)
npm run lint     # ESLint
```

### Docker

```bash
docker build -t aws-meal-tracker .
docker run -p 5000:5000 --env-file .env aws-meal-tracker
```

## Authentication flow

Authentication is handled by Cognito, and the Express API calls Cognito directly. The app client is a confidential client, so every Cognito call includes a `SECRET_HASH` (HMAC-SHA256 of `username + clientId`, keyed with the client secret, base64-encoded), built by `utils/secretHash.js`.

1. **Sign up**: the API creates the user in Cognito and Cognito emails a confirmation code.
2. **Confirm**: the API confirms the code with Cognito, reads the user's `sub`, name and email from Cognito, and inserts the row into the `users` table.
3. **Login**: planned. It will use `InitiateAuth` with `USER_PASSWORD_AUTH` and return the Cognito tokens.

The Cognito `sub` is stored as `users.cognito_id`. It never changes, even if the user changes their email, and it links a Cognito identity to the internal `users.id` used by every other table.

## API endpoints

Base path: `/api`

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `GET` | `/health/status` | none | Health check |
| `POST` | `/auth/signup` | `email`, `password`, `first_name`, `last_name` | Registers the user in Cognito and sends a confirmation email |
| `POST` | `/auth/confirm` | `email`, `code` | Confirms the account and creates the `users` row |

Planned: login, goals, meal logging, food search, and daily progress endpoints.

## Database schema

| Table | Purpose |
| --- | --- |
| `users` | App users: `cognito_id` (unique), first/last name, email, `created_at` |
| `goals` | One row per user with daily targets: calories, protein, carbs, fiber, fat |
| `daily_progress` | One row per user per day (`UNIQUE (user_id, date)`) with running macro totals |
| `meal_types` | Lookup table: breakfast, lunch, dinner, snack (with `sort_order`) |
| `meals` | A meal a user logged: user, meal type, `logged_date` |
| `foods` | Shared food library with macros per 100g |
| `my_foods` | User-created foods, same shape as `foods` plus `user_id` |
| `meal_foods` | Foods in a meal with `quantity_g`; each row references either `food_id` or `my_food_id` (enforced by a `CHECK`) |

Design notes:

- Macros are stored per 100g. The app converts other units (cups, eggs, etc.) to grams before saving, so `meal_foods` only stores `quantity_g`.
- Goals are a single current target per user. Progress is tracked separately in `daily_progress`, and "goal met" is computed by comparing the day's progress with the goals row rather than stored.
- `daily_progress` is incremented when food is logged, and recomputed from `meal_foods` when a food entry is edited or deleted, to avoid drift.

## Deployment

The app is designed to run on AWS Elastic Beanstalk (Docker platform) with an RDS PostgreSQL database and a Cognito User Pool. Remember to delete the Elastic Beanstalk environment and RDS instance when you finish practicing to avoid ongoing charges.
