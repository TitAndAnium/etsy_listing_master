# SBOM & Licenties (samenvatting)

**Software Bill of Materials:** Het project omvat twee Node.js omgevingen (hoofd en functions). In totaal zijn er ongeveer ~**2000** pakketten in de dependency tree, voornamelijk door Firebase en Cypress. Belangrijkste direct dependencies:

- **Backend (functions):** `firebase-admin@12.6.0` (Google, Apache-2.0), `firebase-functions@^4 (of 6.4.0?)` (Google, Apache-2.0), `openai@5.10.2` (MIT), `stripe@14.23.0` (MIT), plus util libs `cors@2.8.5` (MIT), `dotenv@17.x` (BSD-2-Clause), etc.
- **Frontend:** (Via devDependencies in root) `vue` en aanverwanten lijken niet expliciet genoemd, mogelijk is dit een Vite-bundled project. Wel is `cypress@14.5.4` (MIT) en `jest@30.0.5` (MIT) aanwezig voor testing.

**Licentie-overzicht:** Het merendeel van de gebruikte OSS-componenten valt onder permissieve licenties (MIT, Apache 2.0, BSD). Er zijn *geen* GPL- of AGPL-licenties of andere virale licenties aangetroffen in de primaire dependencies. Enkele voorbeelden: OpenAI SDK (MIT), Stripe SDK (MIT), Firebase (Apache-2.0), Node-Fetch (MIT), UUID (MIT), Yargs (MIT). Dit betekent dat licentiecompliance eenvoudig is – MIT en Apache 2.0 vereisen hooguit copyrightvermelding, wat al standaard in package-installaties zit.

**Noteworthy:** De bundeling van **Stripe CLI (stripe.exe)** – deze valt onder Stripe’s own license (MIT-licensed tool). Door het meeleveren hiervan in de repo, dient men die licentie technisch gezien ook te respecteren (hoewel voor intern dev-gebruik het geen issue is). Vermeld het eventueel in een LICENSE.third-party file.

**SBOM gereedschap:** Om zeker te zijn kan een tool als `license-checker` of OWASP Dependency Check nog gedraaid worden, maar op basis van de package.json is er geen reden tot zorg. Het team heeft bovendien zelf `npm audit fix` gedaan voor bekende kwetsbaarheden (er was een *form-data* vulnerability die is gepatcht).

**Conclusie:** Licentietechnisch zit het project goed: het gebruikt gangbare libraries zonder complexe verplichtingen. Zorg er voor de zekerheid voor dat in de eindgebruikers-voorwaarden wordt vermeld dat onderdelen open-source software bevatten onder MIT/Apache licenties, indien nodig. Maar er is geen conflict met closed-source of commerciële uitrol, gezien de gekozen licenties.