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

## Källor (research 2026)

Innehåll omskrivet för att följa licensregler. Nyckelkällor:
- cipherssecurity.com – best bug bounty platforms 2026
- trainingcamp.com – researcher's guide (Intigriti/Bugcrowd mest nybörjarvänliga)
- guptadeepak.com – top 5 platforms 2026 (HackerOne + Intigriti startkombo)
- hackerdna.com, tutorials.technology – nybörjar-bugg-typer (IDOR/XSS/SSRF)
- redfoxsec.com – vad program belönar (verklig impact)
- github.com/The-XSS-Rat – PoC-krav
- hackernoon.com – scope = laglig gräns
