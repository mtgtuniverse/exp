# Resekassan – Worker (delad lagring)

Den här Workern lagrar resans data så att alla sju ser samma sak på sina egna
telefoner. Det är en enda JSON-blob per resa i Cloudflare KV. Gratisnivån räcker
med god marginal för en liten grupp.

## Vad du behöver

- Ett gratis Cloudflare-konto: https://dash.cloudflare.com/sign-up
- `wrangler` (Cloudflares CLI). Installera vid behov: `npm install -g wrangler`

## Deploy – steg för steg

**1. Logga in**

```bash
cd resekassa/worker
wrangler login
```

**2. Skapa en KV-namespace**

```bash
wrangler kv namespace create TRIPS
```

Kommandot skriver ut ett `id`. Kopiera det och klistra in i `wrangler.toml`
där det står `ERSATT_MED_DITT_KV_NAMESPACE_ID`.

**3. Deploya**

```bash
wrangler deploy
```

Du får tillbaka en URL, t.ex. `https://resekassa.ditt-namn.workers.dev`.

**4. Koppla ihop frontend med Workern**

Öppna `resekassa/app.js` och sätt:

```js
const WORKER_URL = "https://resekassa.ditt-namn.workers.dev";
```

Committa och pusha. Klart – nu delas all data mellan alla telefoner.

## Hur det fungerar

- `GET /trip/resa` – hämtar hela resans state.
- `PUT /trip/resa` – sparar hela resans state, returnerar `{ rev }`.

Frontend sparar automatiskt vid varje ändring och pollar var 5:e sekund +
när appen tas fram i förgrunden, så ändringar syns snabbt hos de andra.

### Flera resor samtidigt?

Byt `TRIP_ID` i `app.js` (t.ex. `"thailand-2027"`) så får ni en separat kassa.
Ingen ändring i Workern behövs.

## Notis om åtkomst

Workern är öppen (ingen inloggning, enligt önskemål). Vem som känner till URL:en
+ trip-id:t kan läsa/ändra. Håll URL:en inom gruppen. Vill ni ha en enkel delad
kod senare är det lätt att lägga till en header-koll i `worker.js`.
