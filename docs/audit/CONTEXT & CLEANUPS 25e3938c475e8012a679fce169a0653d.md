# CONTEXT & CLEANUPS

# Documentatiebeoordeling & Addendum-advies

De aanwezige documentatie is zeer uitgebreid en vrijwel alle onderdelen van het project zijn ergens beschreven. Dit is een groot pluspunt voor onderhoud en overdracht. Enkele bevindingen en adviezen hierover:

- **Consistentie tussen code en docs:** Over het algemeen lopen de documenten in de pas met de code. Zo geeft *Project Decisions & Logs* gedetailleerd inzicht in welke fixes zijn doorgevoerd (bijv. .env bescherming, UID discipline) en dat zien we terug in de repo. Ook de *Masterdocument v2.1.1* beschrijft het creditsysteem en validaties nauwkeurig, welke grotendeels overeenkomen met de implementatie (credits ≈ $0.045, 13 tags regel, enz.). Wel merkten we een paar verouderde referenties: de releasechecklist noemt React/Next componenten (TitleField.tsx etc.) die in de huidige opzet (Vue) niet bestaan. Dit duidt op een architectuurswitch die niet 100% door alle docs is doorgevoerd. **Advies:** Maak een addendum of update waarin je expliciet noteert dat de frontend nu in Vue is gerealiseerd en niet in Next/React, om verwarring te voorkomen.
- **Aanvullende documentatie nodig?:** Overweeg een beknopte *Security Addendum* of *Privacy Addendum*. Bijvoorbeeld, som hierin op welke beveiligingsmaatregelen zijn getroffen (rate limiting, auth, encryption, etc.) en hoe er met gebruikersdata wordt omgegaan. Dit helpt bij audits en geeft stakeholders vertrouwen. Ook een hoofdstukje over *Assumed Threat Model* kan geen kwaad: welke misbruikscenario’s zijn geïdentificeerd en gecounterd (veel hiervan staat verspreid in cascade-logs, een samenvatting zou nuttig zijn).
- **Documentatie van configuraties:** Er is melding van memory regels in Cascade die bepaalde mappen uitsluiten (Documentatie/* etc.). Dergelijke AI-assistant specifieke config heeft men goed gelogd. Toch zou het behulpzaam zijn om in een *config README* kort samen te vatten welke .env variabelen er zijn en welke Firebase config keys ingesteld moeten worden (we vonden bijv. `functions.config().stripe.secret` gebruikt in code – noteer in documentatie dat men via `firebase functions:config:set stripe.secret=...` dit moet zetten). Dit voorkomt deployment issues.
- **Changelog bijhouden:** Er is een `changelog_v1.md` in de bestanden. Zorg dat voor de release een up-to-date changelog v2 beschikbaar is waarin alle belangrijke wijzigingen sinds v1 staan (zeker de security-kritische fixes zoals auth en persistente credits). Dit hoort bij governance/audit trail.
- **Masterdocument uitbreiden na implementatie:** Het Masterdocument v2.1.1 is zeer volledig over ontwerp. Zodra de laatste onderdelen (credits Firestore, etc.) zijn geïmplementeerd, is het verstandig om hiervan versie 2.2 te maken en de nieuwe realisaties te beschrijven, inclusief evt. nieuwe constraints. Bijvoorbeeld: “In versie 2.2 is authenticatie verplicht gesteld voor AI-calls en worden credits nu in Firestore bijgehouden i.p.v. memory.” Duidelijk markeren wat er sinds v2.1.1 is veranderd.
- **DevOps/Deployment handleiding:** Voeg ter afsluiting een kort document toe voor *Deployment/Operations*. Hierin kan staan hoe men de app lokaal draait (emulators), hoe te deployen naar productie, hoe rollback werkt, en contactpunten voor incidenten. Dit zit wellicht deels in README-DEV.md, maar check of dit volledig is.

Tot slot, de documentatiestructuur is al erg goed (vooral de audit-trail in project_decisions_and_logs). Blijf dit volhouden tot en met de release zodat het **addendum** voor oplevering feitelijk al in de logs verwerkt zit. Een laatste redactieronde om kleine inconsistenties (bijv. terminologie “SDR” vs “PreRunContext”) recht te trekken is aanbevolen, maar inhoudelijk is de doc in orde.

# .env‑ en .gitignore‑controles (root + functions/)

**.env bestanden:** In zowel de hoofdmap als in `/functions/` is een `.env` aanwezig. De `.env.example` laat zien welke keys verwacht worden (OpenAI, Firebase, Stripe, Slack, etc.) en bevat geen geheime waarden – dit is goed. We hebben geverifieerd dat het runtime `.env` bestand daadwerkelijke (placeholder) secrets bevat, bijvoorbeeld een OpenAI key en Slack webhook URL. Deze lijken gesanitized (lijkt niet op een echte live sleutel, meer een placeholder die secret-scan passeert). Geen gevoelige gegevens zijn in de repository gelekt.

**.gitignore dekking:** De `.gitignore` in de root bevat expliciete regels om gevoelige bestanden uit te sluiten, o.a.:

```
# Environment variables
.env
functions/.env

```

bevestigt dat dit punt expliciet is opgepakt. Daarnaast negeert .gitignore ook build-artifacts (`/dist`, `.next/`, etc.), logfiles, debug dumps, en zelfs specifieke projectbestanden zoals `overdrachtsprompt.txt` en analysemateriaal. Dit voorkomt dat testresultaten of prompt-archieven per ongeluk worden gedeeld【27†】. In `functions/.gitignore` staat alleen `node_modules/` en `*.local`, wat gebruikelijk is – `.env` in functions wordt al door root .gitignore gedekt.

We hebben gecontroleerd of er geen gevoelige configuratiebestanden zijn meegecommit. Alles ziet er schoon uit. De Stripe CLI-binary (`*.exe`) staat niet in `.gitignore`, maar dat is een bewuste keuze; de binary bevat geen vertrouwelijke data.
**Aanbeveling:** Voeg voor de zekerheid ook de potentieel gegenereerde output map van de Vue app toe (bijv. `frontend/dist/` of dergelijke, indien van toepassing – al staat `dist/` al in .gitignore【27†】). Controleer of er nergens secrets hardcoded zijn die buiten .env vallen (onze scan heeft niks gevonden). Tot slot, bij release, zorg dat er geen per ongeluk lokale .env in de deploy belandt – gebruik CI secrets of Firebase config voor productie. De huidige opzet gebruikt `functions.config()` voor Stripe keys e.d., wat prima is mits correct ingesteld.

**Conclusie:** .env en .gitignore zijn op orde. Secrets worden via omgevingsvariabelen beheerd en niet in de code opgeslagen. Het risico op het lekken van gevoelige gegevens via version control is daarmee tot een minimum beperkt, mits iedereen de conventies blijft volgen.

[Thema‑overzichten](Thema%E2%80%91overzichten%2025e3938c475e80738354ffe4c52b61eb.md)

[SBOM & Licenties (samenvatting)](SBOM%20&%20Licenties%20(samenvatting)%2025e3938c475e8054baa0ca065787342e.md)

[Scope‑fit matrix (intended vs implemented)](Scope%E2%80%91fit%20matrix%20(intended%20vs%20implemented)%2025e3938c475e8026b3a4d3919fc96eb1.md)

[Bewijsstukken (evidence pack)](Bewijsstukken%20(evidence%20pack)%2025e3938c475e80bebbfbfc388f43d216.md)

[Assumpties & Onzekerheden](Assumpties%20&%20Onzekerheden%2025e3938c475e8017b608ff60149bc802.md)