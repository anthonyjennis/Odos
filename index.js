import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

const isProduction = process.env.NODE_ENV === "production";

const db = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl:
    process.env.PG_HOST === "localhost"
      ? false
      : { rejectUnauthorized: false },
});

if (isProduction) {
  app.set("trust proxy", 1);
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool: db,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      secure: isProduction,
      sameSite: "lax",
    },
  }),
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

async function checkVisited() {
  const result = await db.query("SELECT iso_a2 FROM visits");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.iso_a2);
  });
  return countries;
}

app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const countries = await checkVisited();
    res.render("index.ejs", { countries: countries, total: countries.length });
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/passport", async (req, res) => {
  if (req.isAuthenticated()) {
    const countries = await checkVisited();
    res.render("passport.ejs", { countries: countries, total: countries.length });
    console.log(req.user);
  } else {
    res.redirect("/login");
  }
});

app.get("/dashboard", async (req, res) => {
  if (req.isAuthenticated()) {
    const countries = await checkVisited();
    res.render("index.ejs", { countries: countries, total: countries.length });
  } else {
    res.redirect("/login");
  }
});

app.post("/add", async (req, res) => {
  if (req.isAuthenticated()) {
    const input = req.body["country"];
    try {
      const result = await db.query(
        `SELECT country_code FROM countries
        WHERE LOWER(country_name) LIKE '%' || $1 || '%'
        ORDER BY
          (LOWER(country_name) = $1) DESC,
          (LOWER(country_name) LIKE $1 || '%') DESC,
          length(country_name) ASC
        LIMIT 1`,
        [input.toLowerCase()],
      );

      const data = result.rows[0];
      const iso_a2 = data.country_code;

      console.log("req.user is:", req.user);

      try {
        await db.query("INSERT INTO visits (user_id, iso_a2) VALUES ($1, $2)", [
          req.user.id,
          iso_a2,
        ]);
        res.redirect("/");
      } catch (err) {
        console.log(err);
        const countries = await checkVisited();
        res.render("index.ejs", {
          countries: countries,
          total: countries.length,
          error: "Country has already been added, try again.",
        });
      }
    } catch (err) {
      console.log(err);
      const countries = await checkVisited();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        error: "Country name does not exist, try again.",
      });
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

app.get(
  "/auth/google/dashboard",
  passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
  }),
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      userProfileURL: process.env.GOOGLE_USERINFO_URL,
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        console.log(profile);
        const result = await db.query(
          "SELECT * FROM users WHERE google_id = $1",
          [profile.id],
        );
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (google_id, email, username, profile_pic) VALUES ($1, $2, $3, $4) RETURNING *",
            [
              profile.id,
              profile.emails?.[0]?.value ?? null,
              profile.displayName,
              profile.photos?.[0]?.value ?? null,
            ],
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    },
  ),
);
passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
