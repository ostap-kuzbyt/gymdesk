# Gymdesk

Back-office system for a fitness club: members and their subscriptions, check-ins, coaches, workout scheduling with reservations, expiry reminders and reports. Reception, coaches and the club admin work in one web app with role-based access.

|        |                                                                  |
| ------ | ---------------------------------------------------------------- |
| API    | Fastify 5, Zod, Drizzle ORM, PostgreSQL 17, pg-boss, Auth0 JWT   |
| Web    | React 19, Vite, Tailwind 4, shadcn/ui, TanStack Router and Query |
| Shared | `packages/shared`: Zod schemas and types used by both sides      |
| Tests  | Vitest, Testcontainers (real PostgreSQL), Testing Library, MSW   |
| Ops    | Docker, docker compose, GitHub Actions                           |

What the club needs is described in [docs/requirements.md](docs/requirements.md), how the code is organised in [docs/architecture.md](docs/architecture.md).

## Run everything with Docker

You need Docker and an Auth0 tenant (see [Auth0 setup](#auth0-setup)).

```sh
cp .env.example .env
```

Fill in `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` and `VITE_AUTH0_AUDIENCE`, then:

```sh
docker compose up --build
docker compose run --rm seed
```

- Web: http://localhost:8080
- API reference (Scalar): http://localhost:3000/docs
- Health check: http://localhost:3000/health

The web container serves the bundle and proxies `/api` to the API, so the browser only talks to one origin. The API applies migrations on start. `VITE_*` values are baked into the bundle at build time: after changing them run `docker compose up --build web`.

`seed` fills an empty database with demo data and can be re-run any time, it starts by clearing the previous demo data.

## Run for development

Requires Node 24 (`nvm use`) and Docker for the database.

```sh
npm install
cp .env.example .env
docker compose up -d db
npm run db:seed -w @gymdesk/api
npm run dev -w @gymdesk/api
npm run dev -w @gymdesk/web
```

The web dev server runs on http://localhost:5173 and proxies `/api` to the API on port 3000. In `.env` leave `VITE_API_URL` empty for that.

| Command                                      | What it does                                                  |
| -------------------------------------------- | ------------------------------------------------------------- |
| `npm test`                                   | API and web tests, then the module boundary check             |
| `npm run lint` / `npm run typecheck`         | ESLint and TypeScript across every workspace                  |
| `npm run format` / `npm run format:check`    | Prettier                                                      |
| `npm run build`                              | Production builds of the API and the web app                  |
| `npm run db:generate -w @gymdesk/api`        | New SQL migration from schema changes                         |
| `npm run db:seed -w @gymdesk/api -- --reset` | Replace the demo data. Flags: `--days`, `--members`, `--seed` |

API tests start PostgreSQL through Testcontainers, so Docker has to be running.

## Configuration

API (`.env` at the repo root, read by `npm run dev` and `npm start`):

| Variable                         | Default       | Notes                                                     |
| -------------------------------- | ------------- | --------------------------------------------------------- |
| `DATABASE_URL`                   |               | PostgreSQL connection string                              |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` |               | Tokens are verified against the tenant's JWKS             |
| `AUTH0_ROLES_CLAIM`              |               | Name of the claim that carries the user's roles           |
| `CLUB_TIMEZONE`                  | `Europe/Kyiv` | All "today" calculations and schedules use this zone      |
| `CLUB_NAME`                      | `Gymdesk`     | Shown in reminder emails                                  |
| `REMINDER_DAYS_BEFORE`           | `7`           | How early the expiry reminder is sent                     |
| `PROMO_DISCOUNT_PERCENT`         | `10`          | Discount in the promotion email                           |
| `RUN_JOBS`                       | `true`        | Set to `false` to disable the daily scan on this instance |
| `EXPIRY_SCAN_CRON`               | `0 8 * * *`   | When the scan runs, in the club time zone                 |
| `MIGRATE_ON_START`               | `false`       | Always `true` in compose                                  |
| `SENDGRID_API_KEY`, `MAIL_FROM`  |               | Without a key emails are only written to the log          |

Web (`VITE_*`, build time):

| Variable                                        | Notes                                                           |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `VITE_API_URL`                                  | Empty means same origin. Set it when the API is on another host |
| `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`     | From the Auth0 single page application                          |
| `VITE_AUTH0_AUDIENCE`, `VITE_AUTH0_ROLES_CLAIM` | Must equal the API's `AUTH0_AUDIENCE` and `AUTH0_ROLES_CLAIM`   |
| `VITE_CURRENCY`                                 | Three-letter ISO code used to format prices. Default `UAH`      |

If a required `VITE_*` value is missing, the app shows which one instead of a blank page.

## Auth0 setup

Sign-in and roles come from Auth0. Nothing about users is stored in the Gymdesk database.

1. **API**. Create an API with the identifier from `AUTH0_AUDIENCE` (for example `https://api.gymdesk`), signing algorithm RS256. Under _Settings_ turn on _Allow Offline Access_.
2. **Application**. Create a _Single Page Application_. Its client ID goes to `VITE_AUTH0_CLIENT_ID`. Add your web origin (`http://localhost:8080` for compose, `http://localhost:5173` for the dev server) to _Allowed Callback URLs_, _Allowed Logout URLs_ and _Allowed Web Origins_.
3. **Refresh tokens**. In the application's _Refresh Token Rotation_ section enable rotation. The app signs in with `offline_access` and keeps sessions alive with rotating refresh tokens, so users are not thrown out when the access token expires.
4. **Roles**. Under _User Management → Roles_ create `admin`, `reception` and `coach` and assign them to users. Any other role name is ignored.
5. **Roles claim**. Add a _Post Login_ Action and attach it to the login flow. The web app reads the claim from the ID token and the API from the access token, so it has to be set on both:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const claim = "https://gymdesk/roles";
     const roles = event.authorization?.roles ?? [];
     api.idToken.setCustomClaim(claim, roles);
     api.accessToken.setCustomClaim(claim, roles);
   };
   ```

   Use the same claim name in `AUTH0_ROLES_CLAIM` and `VITE_AUTH0_ROLES_CLAIM`.

## Demo data and demo users

`db:seed` creates tariffs, four studios, five coaches, forty members with subscriptions, 120 days of check-ins, workouts with reservations and a history of reminders. Dates are relative to today, so reports and the dashboard are never empty. The data is deterministic: the same `--seed` produces the same club.

Create three users in Auth0 to see every role (the addresses are only examples):

| User                 | Role        | What they see                                                                       |
| -------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `admin@gymdesk.test` | `admin`     | Everything: tariffs, studios, coaches, revenue report                               |
| `desk@gymdesk.test`  | `reception` | Members, subscriptions, check-ins, schedule, reminders, reports                     |
| `coach@gymdesk.test` | `coach`     | Dashboard, members, schedule and club pages, no check-in desk, reminders or reports |

## Repository layout

```
apps/api         Fastify service, domain modules, migrations, seed
apps/web         React single page app and its nginx config
packages/shared  Schemas and types shared by both apps
docs             Requirements and architecture
```
