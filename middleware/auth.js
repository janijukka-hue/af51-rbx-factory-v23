// middleware/auth.js \u2014 v14
// Auth-tarkistus: pakollinen jos ALX_API_TOKEN on ENVissä.
// Prodissa ASETA ALX_API_TOKEN .env-tiedostoon.
//
// Hyv\u00e4ksytyt header-muodot:
//   X-ALX-Token: <token>
//   Authorization: Bearer <token>
//   Authorization: <token>
//
// Strict-mode (palvelin kielt\u00e4ytyy k\u00e4ynnistym\u00e4st\u00e4 ilman tokenia):
//   NODE_ENV=production           \u2014 tuotantokoosta automaattisesti tiukka
//   ALX_REQUIRE_AUTH=1            \u2014 opt-in muille ymp\u00e4rist\u00f6ille (staging, CI)

var _warned = false;

// Onko strict-mode p\u00e4\u00e4ll\u00e4 \u2014 token PAKOLLINEN, palvelin ei k\u00e4ynnisty ilman.
export function isStrictAuth() {
  return process.env.NODE_ENV === "production"
      || process.env.ALX_REQUIRE_AUTH === "1";
}

// Bootissa kutsuttu pre-flight: jos strict-mode on p\u00e4\u00e4ll\u00e4 ja token puuttuu,
// heitt\u00e4\u00e4 virheen niin server.listen() ei koskaan ehdi auki. Palauttaa
// pienen status-objektin kaikille muille ymp\u00e4rist\u00f6ille (lokitukseen).
export function assertAuthConfigured() {
  var token = process.env.ALX_API_TOKEN;
  var strict = isStrictAuth();
  if (strict && !token) {
    var src = process.env.NODE_ENV === "production" ? "NODE_ENV=production" : "ALX_REQUIRE_AUTH=1";
    var msg =
      "[auth] FATAL: " + src + " mutta ALX_API_TOKEN puuttuu \u2014 palvelin ei k\u00e4ynnisty.\n" +
      "       Aseta .env:ss\u00e4: ALX_API_TOKEN=<vahva-satunnainen-token>\n" +
      "       Generoi esim.:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"";
    throw new Error(msg);
  }
  return { strict: strict, configured: !!token, mode: strict ? "strict" : (token ? "enforced" : "open") };
}

export function checkAuth(req) {
  var token = process.env.ALX_API_TOKEN;

  // Prod-varoitus: jos token puuttuu ja ei ole dev-ymp\u00e4rist\u00f6
  if (!token && !_warned && process.env.NODE_ENV !== "development") {
    console.warn("[auth] \u26a0  ALX_API_TOKEN ei asetettu \u2014 kaikki reitit avoinna. Aseta token .env:\u00e4\u00e4n prodissa.");
    _warned = true;
  }

  if (!token) return true; // auth ei pakollinen ilman ENV:i\u00e4 (local dev)

  var h = req.headers["x-alx-token"]
       || req.headers["authorization"]
       || "";

  return h === token || h === "Bearer " + token;
}