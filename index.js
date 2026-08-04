import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,

    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
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

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visits");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.iso_a2);
  });
  return countries;
}

app.get("/", async(req, res) => {
  if (req.isAuthenticated()) {
    const countries = await checkVisisted();
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
    res.render("passport.ejs");
    console.log(req.user);
  } else {
    res.redirect("/login");
  }
});

app.get("/dashboard", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("index.ejs");
  } else {
    res.redirect("/login");
  }
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
              profile.emails[0].value,
              profile.displayName,
              profile.photos[0].value,
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
