# Odos

A minimal travel tracker — log in with Google, mark the countries and territories you've visited, and watch an interactive world map fill in.

**Live at:** https://odos-rbji.onrender.com

## Features

- Sign in with Google (via Passport.js)
- Search and add visited countries/territories
- Interactive SVG world map that highlights visited countries
- Passport page with stats and progress toward all 247 countries/territories
- Persistent sessions backed by Postgres

## Tech stack

| Layer | Choice |
|---|---|
| Server | Node.js + Express |
| Templating | EJS |
| Auth | Passport.js (Google OAuth 2.0) |
| Database | PostgreSQL ([Neon](https://neon.tech)) |
| Session store | [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) |
| Hosting | [Render](https://render.com) |

## Running locally

### Prerequisites

- Node.js 18+
- A PostgreSQL database (local or a free [Neon](https://neon.tech) project)
- A Google Cloud OAuth 2.0 Client ID (Web application type)

### Setup

```bash
git clone https://github.com/anthonyjennis/odos.git
cd odos
npm install
```

Create a `.env` file in the project root:

```env
SESSION_SECRET=some_random_string

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/dashboard
GOOGLE_USERINFO_URL=https://www.googleapis.com/oauth2/v3/userinfo

PG_USER=your_pg_user
PG_HOST=your_pg_host
PG_DATABASE=your_pg_database
PG_PASSWORD=your_pg_password
PG_PORT=5432

NODE_ENV=development
```

In Google Cloud Console, add these to your OAuth client:
- **Authorised JavaScript origin:** `http://localhost:3000`
- **Authorised redirect URI:** `http://localhost:3000/auth/google/dashboard`

Create the required tables in your database — `users`, `visits`, and a `countries` reference table populated from [public/data/countries.csv].

Start the app:

```bash
npm start
```

Visit `http://localhost:3000`.

## Deployment notes

This project is deployed on Render (free Web Service tier) with a Neon Postgres database. A few things that matter specifically for this setup:

- **SSL**: The database pool enables SSL automatically for any non-`localhost` `PG_HOST`, since Neon requires encrypted connections.
- **Sessions**: `connect-pg-simple` stores sessions in Postgres rather than in memory, so logins survive redeploys and don't leak memory over time. It auto-creates its `session` table on first run.
- **Trust proxy**: `app.set("trust proxy", 1)` is enabled when `NODE_ENV=production`, since Render terminates HTTPS at a proxy in front of the app — required for secure cookies to work correctly.
- **Cold starts**: The free Render tier spins down after ~15 minutes of inactivity; the first request after idle can take 30–50s.

If you fork this and deploy your own copy, remember to add your live URL's redirect URI (`https://your-app.onrender.com/auth/google/dashboard`) to your Google OAuth client, alongside the localhost one.

## License

MIT
