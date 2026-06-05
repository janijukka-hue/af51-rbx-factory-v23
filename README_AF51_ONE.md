## Windows Quick Start

Nopein tapa käynnistää kaikki kerralla:

```
start-af51.bat
```

Tuplaklikki Explorer:issa tai aja komentokehotteessa. Script:

1. Luo `.env` automaattisesti jos puuttuu
2. Generoi `GUARDIAN_HMAC_SECRET` automaattisesti
3. Käynnistää Ollaman omassa ikkunassaan
4. Käynnistää AF51 serverin omassa ikkunassaan  
5. Käynnistää Expo webin omassa ikkunassaan

Kun kaikki on käynnissä:
- ALX Factory → http://localhost:3000
- Expo UI → http://localhost:8081 (paina **w** avataaksesi selaimen)
- Ollama → http://localhost:11434

Sammutus: `stop-af51.bat` tai sulje ikkunat manuaalisesti.

Author / Owner: Jani Segerman
Architecture: AF51 / Area51 Factory
Year: 2026

---

# AF51 ONE

AF51 ONE on tuotantovalmis Node.js-palvelin jossa ALX Factory, Ollama-integraatio,
Ghost Vault, WorkspaceAdapterNode ja koko julkaisuputki toimivat yhtenä kokonaisuutena.

---

## Arkkitehtuuri

```
k1 → m2 → t3 → s4 — kerrosjärjestys, ei poikkeuksia
s4 ei importoi k1:tä suoraan
k1 ei importoi m2/t3/s4:tä
```

### Kerrokset

| Kerros | Nimi       | Vastuu                                              |
|--------|------------|-----------------------------------------------------|
| k1     | Kernel     | ALX-core, skillit, muisti, invariantit, eventbus    |
| m2     | Ohjaus     | Orchestrator, OllamaAgent, governance, AL-oliot     |
| t3     | Factory    | BuildPipeline 16 vaihetta (sis. RBXLX_EMIT), vault, templatet |
| s4     | Studio     | React Native UI, navigaatio, screenit, hooks        |

---

## 🔒 KRIITTINEN ARKKITEHTUURISÄÄNTÖ — Ollama ≠ ALX

```
Ollama EI aja mitään ALX:ään.
Ollama EI julkaise.
Ollama EI rakenna.
Ollama EI muuta workspacea suoraan.

Ollama vain ehdottaa / selittää / analysoi.
Ihminen siirtää hyväksytyn sisällön ALX-putkeen.
```

### Oikea malli

```
Ollama Chat
  → ehdotus / koodi / analyysi / selitys
  → "COPY FOR ALX" — ihminen kopioi manuaalisesti
  → ALX saa työn vasta ihmisen toimesta
  → ALX pipeline rakentaa (16 vaihetta, sis. RBXLX_EMIT → AF51.rbxlx ZIPiin)
  → ihminen hyväksyy
  → julkaisu
```

### Väärä malli — EI KOSKAAN

```
❌ Ollama → /execute    (kielletty)
❌ Ollama → /build      (kielletty)
❌ Ollama → /publish    (kielletty)
❌ Ollama → workspace   (kielletty suoraan)
```

### Tekninen toteutus

```js
// server.js — /ollama/chat käyttää VAIN OllamaAgentia
// orchestrator.execute() EI kuulu Ollama-reitille

// this._alx.setLLMAgent(this._ollamaAgent); // POISTETTU TARKOITUKSELLA
// ALX on FAST-only — ei LLM-injektiota
// Ollama käytettävissä VAIN /ollama/chat -reitin kautta
```

Tämä on tarkistettu `test-af51.mjs`:ssä (arkkitehtuuritestit).

---

## Käynnistys

```bash
cp .env.example .env
# Aseta OLLAMA_ENDPOINT=http://localhost:11434 jos Ollama käytössä
node server.js
```

## Testaus

```bash
npm run test:all              # lua-factory + future-machine + rbxlx-emit
npm run test:lua-factory      # 88 tarkistusta — k1/m2/t3 ydin
npm run test:future-machine   # 18 tarkistusta — pipeline forward-compat
npm run test:rbxlx-emit       # 86 tarkistusta — RBXLX emitter, 5 targetia, byte-identical
npm run rbx:verify            # 55 tarkistusta — 5 targetia × (build + sisältö + determinismi)
```

## RBX Studio Quick Start

Tehtaan tärkein lopputuote on **`AF51.rbxlx`** jonka voi avata suoraan Roblox
Studiossa ilman Rojoa tai Open Cloudia.

```bash
npm install
npm run rbx:build:rpg              # tai obby / tycoon / simulator / fps
# → exports-rbx/AF51-RBX-AF51-RPG-<buildId>.zip
```

Pura ZIP ja **tuplaklikkaa `AF51.rbxlx`** — Roblox Studio aukeaa scenen kanssa.
ZIPissä on lisäksi `default.project.json` (Rojo), `ghost/`-lineage,
`production-quality-report.json` ja koko `src/`-Lua-puu jos haluat ajaa Rojo-syncin.

Halutessasi koko 5-target-paketti kerralla:

```bash
npm run rbx:build:all              # ~10 s, kaikki 5 ZIPiä exports-rbx/:ään
```

Determinismi on oletuksena päällä — sama input tuottaa byte-identtisen ZIPin.
Ohitus debuggia varten: `RBX_DETERMINISTIC_BUILD=0 node rbx.mjs build rpg`.

## Reitit

```
GET  /health                    → terveyskysely (ei autia)
GET  /status                    → factory + orchestrator tila
GET  /memory                    → CoreMemory stats
POST /execute                   → { input } → ALX
POST /build                     → { name, target, features } → build
GET  /vault/builds              → listaa buildit
POST /vault/save                → tallenna artifact
POST /publish                   → validate → zip → audit
GET  /published/:id/download    → turvallinen lataus
POST /ollama/chat               → sessiomuistillinen chat (VAIN ehdotukset)
GET  /ollama/status             → Ollama tila
GET  /workspace/:id             → workspace haku
POST /workspace/save            → workspace tallennus
POST /workspace/:id/snapshot    → snapshot
```

## Ghost Vault aktivointi

Ghost Vault on **fail-closed** — se ei toimi ilman `GUARDIAN_HMAC_SECRET`.

```bash
# Generoi vahva salaisuus
node -e ".randomBytes(32).toString('hex'))"

# Lisää .env:ään
GUARDIAN_HMAC_SECRET=<generated-secret>
```

Ilman tätä:
- `/ghost/health` palauttaa `VAULT_UNAVAILABLE`
- `/ghost/cube/start` palauttaa 503
- Muut ALX-toiminnot toimivat normaalisti

## Turvallisuus

- Rate limit: 20 req/min kriittiset reitit, 60 muut
- Auth: `ALX_API_TOKEN` ENV:ssä → pakollinen kaikille reiteille (pl. /health, OPTIONS)
- Body size: max 512 KB (ENV: `ALX_MAX_BODY_BYTES`)
- Error sanitointi: stack trace ei näy prodissa
- Security audit log: kriittiset reitit structured JSON-lokiin
- Path traversal esto: publish vain `.af51-workspaces/`-kansiosta

## ENV-muuttujat

Katso `.env.example` — kaikki muuttujat selityksineen.
