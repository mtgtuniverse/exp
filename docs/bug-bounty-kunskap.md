# Bug Bounty & Laglig Säkerhetsverksamhet – Kunskapssammanfattning

*Sammanställt: 2026-09-26. Sammanfattar en diskussion om hur man lagligt kan tjäna
pengar på att hitta och rapportera sårbarheter.*

---

## Utgångspunkt & viktig gränsdragning

Målet är att kunna erbjuda säkerhetstjänster (hitta sårbarheter + ge
rekommendationer) och tjäna pengar på det.

**Viktig princip:** Att på egen hand skanna/kartlägga webbplatser som inte bett om
det – och sedan kontakta dem om bristerna – är oombedd sårbarhetsscanning. Även med
god avsikt kan det bryta mot lagen och uppfattas som utpressningsliknande. Man måste
ha **tillstånd** innan man testar. Kliver man utanför tillåtet scope räknas det som
obehörigt intrång, vilket är brottsligt i princip överallt.

Det som gör skillnad mellan lagligt och olagligt är **explicit tillstånd** – antingen
via en publicerad policy, ett bug bounty-program med definierat scope, eller ett
skriftligt konsultavtal.

---

## De tre spåren (skillnad)

| | Responsible Disclosure / VDP | Bug Bounty | Kontrakterat pentest |
|---|---|---|---|
| **Tillstånd** | Ja – publik policy | Ja – program med scope | Ja – skriftligt avtal |
| **Betalt?** | Nästan aldrig (tack/Hall of Fame) | Ja, per giltigt fynd | Ja, fakturering |
| **Vem hittar vem?** | Du hittar dem | Plattform listar program | Du säljer in dig / anlitas |
| **Bäst för** | Bygga rykte, öva lagligt | Löpande inkomst | Bäst timpeng som konsult |

- **Responsible Disclosure (RD)** och **VDP** (Vulnerability Disclosure Program) är i
  praktiken samma sak: en publicerad policy (ofta `security.txt`) som ger dig
  tillstånd att testa och lovar "safe harbor" (att de inte stämmer dig). Ger oftast
  **ingen betalning**.
- **RD/VDP är ett verktyg på vägen, inte målet** om målet är pengar. Det bygger
  statistik och rykte → öppnar dörren till betalda privata program.

---

## Var tjänar man enklast pengar (bug bounty, 2026)

**Rekommenderad startkombo:** HackerOne + Intigriti parallellt.

1. **HackerOne** – störst utbud av program + gratis träning (Hacker101).
2. **Intigriti** – mest nybörjarvänlig, snabbare triage, Europa-fokus (bra i Sverige).
3. **Bugcrowd** – hanterad triage; bra när man byggt track record.
4. **YesWeHack** – Europa-först, bra scopes.
5. **Immunefi** – Web3/smart contracts (högre belopp, mer nischat).

### Vanligaste nybörjarfällan
Öppna ett stort, överfyllt program (Google/Meta), köra en automatisk scanner, skicka
in dubbletter eller out-of-scope → **noll betalt**.

### Vad som faktiskt fungerar
- **Välj rätt program – undvik konkurrens.** Börja med VDP:er och mindre/nyare
  program. Färre som letar där → högre chans att vara först.
- **Fokusera på bugg-typer som betalar för nybörjare:**
  - IDOR / trasig åtkomstkontroll (ofta lätt att hitta, hög impact)
  - XSS (cross-site scripting)
  - SSRF
  - Program belönar verklig impact: dataexponering, autentiseringsbypass,
    privilegie-eskalering.
- **Skriv rapporter som betalas:** alltid en fungerande proof-of-concept. Håll dig
  strikt inom scope.

---

## Realistisk startplan

| Steg | Vad | Mål |
|------|-----|-----|
| 1 | Skapa konto på HackerOne + Intigriti. Gör Hacker101. | Grundverktyg + scope-vana |
| 2 | Öva IDOR/XSS på PortSwigger Web Security Academy (gratis) | Bekräfta färdigheter |
| 3 | Jaga i 2–3 mindre VDP:er (IDOR/åtkomstkontroll) | Första giltiga rapporter |
| 4 | Sök/acceptera privata program (låg konkurrens, betalt) | Första utbetalning |

**Recon-verktyg för nybörjare:** subfinder, httpx, Burp Suite (Community Edition).

---

## Så hittar man RD/VDP-mål lagligt

- **security.txt** – många sajter har `https://domän/.well-known/security.txt` med
  kontakt + policy.
- **disclose.io** – samlar organisationer med safe harbor-policyer.
- **VDP-program på HackerOne/Intigriti/Bugcrowd** – tillståndet är inbyggt.

---

## Rekommenderad övergripande strategi

1. Använd VDP/RD för att öva och bygga statistik (gratis, lagligt, låg konkurrens).
2. Sikta på betalda bug bounty-program parallellt (där pengarna finns).
3. På sikt: konsultuppdrag med avtal (bäst timpeng, matchar idén om att "erbjuda
   tjänster och rekommendationer" – fast lagligt inramat).

---

## Bugg-typer med exempel (enkla → medelsvåra)

Öva var och en lagligt på **PortSwigger Web Security Academy** innan du jagar dem live
inom scope.

### Enkla – bra att börja med

**IDOR (Insecure Direct Object Reference)**
Appen litar på ett ID i en request utan att kolla att just du får se det.
- *Ex:* `GET /api/invoice/1043` visar din faktura → ändra till `1044` → ser annans.
  Samma med `?user_id=`, `/orders/{id}`, profilbilder.
- Enkel: bara ändra ett värde och observera. Hög impact = betalar ofta bra.

**Reflected XSS**
Input skickas tillbaka oescapat i sidan.
- *Ex:* söksida visar `Du sökte på: <input>` → skicka `<script>alert(1)</script>`.
- Enkel: snabb att testa, tydlig PoC.

**Info disclosure / felkonfiguration**
- Exponerade filer: `/.git/`, `/.env`, `/backup.zip`, `/phpinfo.php`
- Debug-läge i produktion (stack traces avslöjar sökvägar/versioner)
- Saknade säkerhets-headers (låg severity men enkla poäng ibland)

### Medelsvåra – nästa steg

**Stored XSS**
Skadlig input sparas och körs för *andra* användare (t.ex. kommentar, användarnamn).
Högre impact än reflected → betalar mer.

**Broken Access Control (bortom enkel IDOR)**
- Horisontell: nå annan användares data.
- Vertikal / privilege escalation: vanlig användare når admin-funktion. *Ex:*
  `POST /admin/deleteUser` saknar rollkontroll, eller ändra `"role":"user"` →
  `"role":"admin"` i request-body.

**SSRF (Server-Side Request Forgery)**
Få servern att göra requests den inte borde. *Ex:* "hämta bild från URL" pekas mot
`http://169.254.169.254/` (molnmetadata) → kan läcka credentials. Hög impact = höga
bounties.

**CSRF (Cross-Site Request Forgery)**
Lura offrets webbläsare att skicka oönskad request där hen är inloggad. *Ex:* formulär
utan CSRF-token som byter e-post/lösenord → kontoövertagande.

| Bugg | Nivå | Kärnidé | Typisk impact |
|------|------|---------|---------------|
| IDOR | Enkel | Byt ID → se annans data | Dataexponering |
| Reflected XSS | Enkel | Oescapad input reflekteras | Sessionsstöld |
| Info disclosure | Enkel | Exponerade filer/debug | Läckt känslig info |
| Stored XSS | Medel | Sparad kod körs för andra | Kontoövertagande |
| Broken access control | Medel | Nå funktioner du inte ska | Privilege escalation |
| SSRF | Medel | Tvinga servern göra requests | Intern åtkomst, credentials |
| CSRF | Medel | Lura webbläsaren skicka request | Oönskade handlingar |

**Tips:** börja med IDOR + reflected XSS – snabbast första fynden.

---

## Övergången labb → live (det viktigaste mentala skiftet)

| | Labb (PortSwigger, HTB, egna labb) | Live bug bounty |
|---|---|---|
| Tillstånd | Total frihet | Bara det policyn tillåter |
| Mål | Lära dig *hur* buggen fungerar | Bevisa att den finns – utan skada |
| Exploatering | Kör hela vägen, dumpa allt | Stoppa vid minsta bevis på impact |
| Om du gör fel | Inget händer | Lagbrott, avstängning, skadestånd |

**Kärnprincip: "Proof of Concept, inte exploatering".** I labbet är målet att lyckas
exploatera. I live är målet att bevisa med minimal påverkan och sen stanna.

- **IDOR:** kom åt *ett* annat objekt (helst eget testkonto), skärmdumpa, stanna.
  Bläddra ALDRIG i andras riktiga data (personuppgiftsbrott).
- **XSS:** ofarlig PoC som `alert(document.domain)`. Stjäl inte riktiga sessioner.
- **SQLi:** bevisa injektionen ofarligt (`version()`, `1=1`-beteende). Dumpa aldrig
  riktig kunddata.
- **SSRF:** bevisa att servern anropar en server *du* kontrollerar (Burp Collaborator).
  Använd inte läckta credentials för att gå djupare.

### Reglerna du MÅSTE läsa i varje programpolicy
1. **Scope / out-of-scope** – exakt vilka domäner/appar. Allt annat = obehörigt.
2. **Förbjudna tekniker** – nästan alltid: DoS/stresstest/brute force, **automatiska
   scanners** (din AI-agent räknas!), social engineering/phishing, fysisk åtkomst.
3. **Datahantering** – rör inte/spara inte/exfiltrera inte riktig data. Snubblar du på
   PII: stanna, exfiltrera inte, rapportera att den är åtkomlig.
4. **Safe harbor** – skyddet gäller bara så länge du följer reglerna.

**Tumregel:** Labb → "kan jag komma in?" Live → "vad är minsta möjliga för att bevisa
detta, och hur stannar jag direkt efter?"

---

## Automatiska verktyg i live: spider / crawl / scanner

**Fråga: får jag köra Burp spider/crawl för att indexera siten?**
Svar: **läs policyn först.** Automatisk crawling hamnar i gråzonen "automatiska
verktyg" som många program begränsar/förbjuder.

Burp "crawl"/spider navigerar automatiskt, skickar massor av requests och **submittar
formulär** → problem:
- Hög trafikvolym → kan likna DoS (nästan alltid förbjudet).
- Automatisk formulär-submission → kan skapa data/skicka mejl/utföra destruktiva ops.
- Kan krypa utanför scope → obehörigt intrång.

**Beslutslogik:**
1. Sök i policyn efter: "automated tools/scanning/scanners", "crawling/spidering",
   "rate limiting". Förbjuds automatiska scanners → spidern räknas oftast dit.
2. Om tillåtet – konfigurera defensivt: hårt scope i Burp, strypt hastighet, stäng av
   formulär-submission, undvik funktioner med biverkningar.
3. **Säkrast (särskilt som nybörjare): manuell passiv mappning.** Surfa sajten manuellt
   med Burp som proxy → site-mappen byggs passivt av det du besöker (ofarligt). Använd
   passiv recon (Wayback via `gau`/`waybackurls`, JS-analys, `subfinder`).

**Skilj på:** passiv scanning (ofarlig, analyserar bara det du ser) vs aktiv scanner
(skickar attack-payloads – ännu mer aggressiv än crawlern, förbjuden i fler program).

> Passiv site-map genom manuell surf via Burp = nästan alltid säkert.
> Aktiv crawl/spider/scanner = bara om policyn tillåter, hårt scope-begränsat & strypt.

---

## AI-verktyg (2026) – ligg inte steget efter

**Rätt förväntning:** AI är en *förstärkare, inte ersättare*. Många "AI-pentestverktyg"
är scanners med ett LLM-lager ovanpå. Bästa flödet är **human-in-the-loop** – AI gör
recon/analys snabbare, du validerar. (Analys/prioritering kan gå från ~2h → ~30 min.)

### Två kategorier
**1. Enterprise-plattformar** (autonoma, dyra – känn till namnen, inte din liga än):
- **XBOW** – autonom webapp-testning, billigaste dokumenterade ingången (~$4–6k/engagemang)
- **NodeZero (Horizon3.ai)**, **Pentera** – nätverks-/AD-exploatering
- **MindFort**, **RunSybil** – autonom exploatering + remediation

**2. Solohunter / bug bounty** ← din liga

### Vad du bör lära dig (i ordning)
**Steg 1 – Grunden (AI-assisterad, inte AI-styrd):**
| Verktyg | Vad | Varför först |
|---|---|---|
| **Burp Suite** (Community→Pro) | Webbproxy, manipulera requests | Kärnverktyget – allt byggs runt det |
| **PentestGPT** | LLM som vägleder pentest-stegen | Tränings-copilot för metodiken |
| Allmän **LLM** (Claude/ChatGPT) | Förklara kod, PoC, tolka svar, rapporter | Största vinsten för nybörjare |

**Steg 2 – AI-assisterad recon:**
- Klassisk kärna först: `subfinder`, `httpx`, `nuclei`, `amass`.
- AI-recon-ramverk (open source): **Reconator**, **bugbounty-agent** (kedjar recon +
  scanners + AI-validator → scoped rapport med bara AI-granskade fynd).

**Steg 3 – Agentiska CLI (human-in-the-loop):**
- **PentesterFlow** – open source CLI, recon→rapport med analytiker-översikt.
- **BugHunter** – CLI, funkar med gratis/billiga AI-providers (låg tröskel).
- **AIRecon** – körs helt offline (self-hosted Ollama + Kali i Docker), ingen molndata.

*(2026-benchmark: 39+ open source AI-pentest-agenter i 6 arkitekturmönster – fältet är
nytt, verktyg kommer och går.)*

### Rekommendation
1. Bli riktigt bra på **Burp + en LLM** → 80% av vinsten.
2. Lär dig recon-kedjan **manuellt** innan du automatiserar den.
3. Lägg till **PentestGPT** som metodik-copilot.
4. Sen: provkör agentiskt CLI på labb / program där du har tillstånd.

### ⚠️ AI + scope
Kör ALDRIG en autonom AI-agent brett mot ett live-mål: den kan skanna out-of-scope
subdomäner (intrång), generera hög trafik (DoS), eller exploatera bortom PoC (skada).
Live = AI körs begränsat, scope-låst, medvetet. Offline-verktyg minskar risk för
scope-läckage till molnet.

---

## Klassiska recon-kedjan – vad varje verktyg gör

Recon = kartlägg attackytan *innan* du letar buggar. En tratt: brett → smalna av →
zooma in. Inte AI i grunden; AI-lagret läggs ovanpå för att sortera/prioritera.

```
example.com
   │  subfinder + amass   →  "vilka subdomäner finns?"   (passivt, brett)
   │  httpx               →  "vilka lever & vad kör de?" (lätt, filtrerande)
   │  nuclei              →  "finns kända sårbarheter?"   (aggressivt, payloads)
   ▼
Prioriterad lista av mål att undersöka manuellt
```

- **`subfinder`** – hittar subdomäner passivt (cert-loggar, DNS-databaser, sökindex).
  Ofarligt/tyst. OBS: hittad ≠ in-scope, kolla policyn.
- **`amass`** – djupare/bredare subdomän- & attackytekartläggning (fler källor, IP/ASN,
  relaterade domäner). Passivt + aktivt läge (DNS-bruteforce = mer trafik, försiktigt i
  live). Körs ofta ihop med subfinder för max täckning.
- **`httpx`** – testar vilka subdomäner som *lever* (statuskod, titel, teknik/server,
  redirects). Filtrerar bort döda mål.
- **`nuclei`** – template-driven scanner för kända sårbarheter/felkonfig (exponerad
  `.git`, CVE:er, standardlösenord). **Mest aggressiva steget – skickar payloads, räknas
  som automatisk scanner → i live bara om policyn tillåter, strypt.**

| Verktyg | Svarar på | Aggressivitet | Live-risk |
|---|---|---|---|
| `subfinder` | Vilka subdomäner finns? | Passiv | Låg |
| `amass` | (Djupare) subdomäner/IP? | Passiv–aktiv | Låg–medel |
| `httpx` | Vilka lever & vad kör de? | Lätt | Låg |
| `nuclei` | Finns kända sårbarheter? | Aggressiv (payloads) | **Hög – ofta scope-begränsad** |

**AI-lagrets roll:** sortera/prioritera stora datamängder, korrelera ledtrådar, minska
false positives från nuclei, sammanfatta. Datainsamlingen tar lika lång tid; *analysen*
går från timmar → minuter.

---

## Källor (research 2026)

Innehåll omskrivet för att följa licensregler. Nyckelkällor:
- cipherssecurity.com – best bug bounty platforms 2026
- trainingcamp.com – researcher's guide (Intigriti/Bugcrowd mest nybörjarvänliga)
- guptadeepak.com – top 5 platforms 2026 (HackerOne + Intigriti startkombo)
- hackerdna.com, tutorials.technology – nybörjar-bugg-typer (IDOR/XSS/SSRF)
- redfoxsec.com – vad program belönar (verklig impact)
- github.com/The-XSS-Rat – PoC-krav
- hackernoon.com – scope = laglig gräns

AI-verktyg & recon (2026):
- strobes.co – varning: många "AI-verktyg" är scanners med LLM-lager
- securityelites.hashnode.dev – AI-assisterad recon, analys timmar → minuter
- dupple.com, mindfort.ai, redfoxsec.com, codeant.ai – AI-pentest-plattformar
- appsecsanta.com – benchmark 39+ open source AI-pentest-agenter
- cybersecuritynews.com – PentesterFlow, BugHunter, AIRecon
- github.com/rootsploit/Reconator, github.com/Btr4k/bugbounty-agent – AI-recon-ramverk
