# High-motion ad: script en Higgsfield-productieplan

**Chatlein Group Montage & Installatie bedrijf** · Versie 1 · 27-09-2026
Formaat: **9:16, 30 sec** (hero), plus een **15-sec cutdown**. Kanalen: Instagram/Facebook Reels, TikTok, YouTube Shorts.
Uitvoering: **Higgsfield** (image-to-video en camera-presets), met afwerking in CapCut of Premiere.

---

## 1. Data: wat de publieke reviews zeggen

Bron: [`data/reviews.json`](../data/reviews.json). Dat bestand bevat 3 Google-reviews (5★, letterlijk), 1 Werkspot-review (vermoedelijk letterlijk) en de samengevatte Werkspot-reviews, waaronder één negatieve. De Werkspot-score is **4,8 / 5**.
De Google-score en de Google-foto's worden opgehaald met [`scripts/haal_google_reviews.py`](../scripts/haal_google_reviews.py) via de officiële Places API. Daarvoor is een API-sleutel nodig.

### Google: 4,7 / 5 uit 38 reviews (27-09-2026)

Sterrenverdeling: **30× 5★ · 6× 4★ · 1× 3★ · 1× 2★**. 35 reviews hebben tekst.

### Review-mining: welke thema's komen terug? (35 Google-reviews met tekst)

| Thema | Aantal reviews | Sterkste quote (letterlijk) |
|---|---|---|
| **Vakmanschap** | 14 | "Écht vakmanschap schijnt nog te bestaan!" (Rob S.) |
| **Vriendelijk en persoonlijk** | 12 | "Kenmerkend voor Gerbian: vriendelijk, meedenkend, vakmanschap." (Cees M.) |
| **Netheid en details** | 11 | "Let op details en gaat door tot het echt goed is." (Tom) |
| **Meedenken en oplossen** | 10 | "Ook toen er iets fout ging, heeft hij zonder probleem het opgelost." (Ay B.) |
| **Communicatie en afspraken** | 9 | "Gerbian is een top monteur die zijn afspraken altijd nakomt" (Hans B.) |
| **Alles in één hand** | 7 | "Alles in een hand." · "Van demonteren stucen tot monteren verliep alles vlot en volgens afspraak" (maria h.) |
| **Snel en vlot, doorzetten** | 6 | "Super vakman Tot laat gewerkt om keuken af te maken" (Corry V.R.) |

**De sterkste zin uit alle reviews:**
> **"De montage en plaatsing van onze nieuwe keuken was nog beter dan de nieuwe keuken zelf."** (Rob Schouten, 5★)

Dit is de beste hook voor de ad: een klant zegt dat de montage beter was dan het product zelf. Daarmee is de positionering in één zin bewezen.

**Wat de lagere scores zeggen (2★, 3★, 4★):** in de zichtbare tekst staat vooral lof ("zeer kundige vakmensen", "nemen de tijd om het werk netjes af te krijgen"). Het lastige deel is op Google ingekort ("… Meer"). Eén 4★ noemt dat het inmeten "een beetje lastig" begon. Conclusie: geen perfectieclaims, wel rust, controle en afspraken nakomen.

**Wat dit betekent voor de ad:**
1. Hook = de klantquote "nog beter dan de nieuwe keuken zelf".
2. Het bewijs van de kernbelofte: "gaat door tot het echt goed is" en "Tot laat gewerkt om keuken af te maken".
3. Onderscheidend is het totaalpakket: "Alles in een hand", met stucen, tegelzetten en elektra genoemd in reviews. Toon dit **alleen als "volgens klanten"** of na bevestiging van Gerbian, want één review noemt een "aanbevolen loodgieter en elektricien" (partners).
4. Getal op de eindkaart: **4,7 ★ uit 38 Google-reviews**. Dat is sterker en actueler dan alleen Werkspot.

---

## 2. Concept

**"Tot het echt goed is."** Een snelle, ritmische montage van het vakwerk: elke beat is een handeling (meten, boren, stellen, passen, uitlijnen). Klantquotes slaan als tekst in beeld. Het tempo valt pas stil als de keuken af is. De kijker voelt eerst de energie van het werk en daarna de rust van het resultaat.

**Muziek:** 120–128 BPM, een moderne percussieve track met een "drop" op 0:15 (de onthulling). Kies een gelicenseerde track (Artlist, Epidemic Sound) of gebruik de beat uit `video/chatlein-hyper-9x16.mp4`.

---

## 3. Script: hero 30 sec

VO = voice-over van **Gerbian zelf** (eigen opname; een kloon alleen van zijn eigen stem, met zijn toestemming, zie het campagneplan sectie 26).
TXT = tekst in beeld (toevoegen in de montage, **niet** door AI laten genereren).

| # | Tijd | Beeld | Camera (Higgsfield-preset) | TXT | VO | SFX |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:02 | Hal vol keukendozen | **FPV Drone** / **Crash Zoom In** | ★★★★★ "Nog beter dan de nieuwe keuken zelf." | "Nieuwe keuken gekocht?" | whoosh + kick |
| 2 | 0:02–0:03,5 | Kale wand, leidingen uit de muur | **Whip Pan** | EN NU? | – | whip |
| 3 | 0:03,5–0:05,5 | Gerbian stapt binnen met gereedschapskist, tegenlicht | **Super Dolly In**, laag standpunt | GERBIAN CHATLEIN · keukenmonteur | "Dan begint het echte werk." | voetstap, kist neer |
| 4 | 0:05,5–0:07 | Laserlijn schuift over de wand (macro) | **Dolly Left** / Snorricam-achtig | METEN | "Ik meet…" | laser-piep |
| 5 | 0:07–0:08,5 | Boor in scharnierpot, zaagsel vliegt in tegenlicht | **Bullet Time** / slow motion | MONTEREN | "…monteer…" | boor |
| 6 | 0:08,5–0:10 | Kast op stelpoten, hand draait poot, waterpas-bel schuift naar midden | **Crash Zoom In** op de bel | WATERPAS | – | tik |
| 7 | 0:10–0:11,5 | Werkblad zakt op de kasten | **Crane Down** | – | – | doffe klap |
| 8 | 0:11,5–0:13 | Passtuk schuift in de laatste opening | **Dolly In**, macro | PASSEN | "…pas…" | klik |
| 9 | 0:13–0:15 | Greep wordt met maat uitgelijnd, daarna een rij grepen op één lijn | **Tracking** langs de fronten | AFWERKEN | "…en werk af." | scharnier-klik |
| 10 | 0:15–0:17 | **Drop:** van kale ruimte naar af, zelfde standpunt | **Hyperlapse** / start- en eindframe | – | – | impact + stilte |
| 11 | 0:17–0:19,5 | Detail afgewerkte keuken, verlichting gaat aan | **Slow Dolly Out** | ★★★★★ "Hij nam ons echt de stress weg." | – | licht-klik, zachte muziek |
| 12 | 0:19,5–0:22 | Hand strijkt langs werkbladrand / kitnaad | **Dolly Right**, macro | ★★★★★ "Ook toen er iets fout ging, heeft hij zonder probleem het opgelost." | – | – |
| 13 | 0:22–0:25 | Koffie wordt gezet, kopje op werkblad, bewoners genieten | **Orbit** (langzaam) | ★★★★★ "Let op details en gaat door **tot het echt goed is.**" | "Dat zeg ik niet. Dat zeggen mijn klanten." | koffiemachine |
| 14 | 0:25–0:30 | Eindkaart: logo, **4,7 ★ · 38 Google-reviews**, WhatsApp | graphic (geen AI) | NIEUWE KEUKEN GEPLAND? · APP GERBIAN · **06 49 11 03 60** · @chatleingroup | "Nieuwe keuken gepland? Stuur me een appje." | logo-tik |

**Volledige VO (± 40 woorden):**
> Nieuwe keuken gekocht? Dan begint het echte werk. Ik meet, monteer, pas en werk af. [drop, stilte] … Dat zeg ik niet. Dat zeggen mijn klanten. Nieuwe keuken gepland? Stuur me een appje.

**Bij elke review staat klein:** "5 sterren · Google-review" (eventueel met voornaam + initiaal, bijv. "Rob S."). Shot 1 toont de quote van Rob Schouten als hook; de volledige zin is "De montage en plaatsing van onze nieuwe keuken was nog beter dan de nieuwe keuken zelf." Inkorten met behoud van betekenis mag, maar toon dan de volledige zin in de caption. De bewoners in shot 13 worden **niet** als de reviewers gepresenteerd. De quote staat los in beeld, niet bij hun gezicht.

---

## 4. Higgsfield-uitvoering per shot

### Spelregels (voor geloofwaardigheid én eerlijkheid)

| Regel | Waarom |
|---|---|
| **Keukens alleen met echte projectfoto's van Gerbian als startframe** (image-to-video). AI voegt beweging toe, maar verzint geen keuken | Anders toon je werk dat hij niet gemaakt heeft: misleidend en in strijd met de Reclamecode |
| Shots 1, 2 en 4–7 (details, gereedschap, dozen) mogen text-to-video zijn: generiek en niet als "project" gepresenteerd | Die tonen een handeling, geen resultaat |
| **Gerbian (shot 3):** bij voorkeur een echte opname. Anders een **Soul ID** getraind op 10–20 eigen foto's (toestemming is er; wel schriftelijk vastleggen) | Herkenbaarheid |
| **Geen AI-tekst in beeld.** Alle tekst en het logo komen in de montage | Modellen maken fouten in Nederlandse tekst en logo's |
| **Geen lipsync** op AI-Gerbian; de VO blijft off-screen | Onnatuurlijke lipsync verraadt AI |
| **Label** als AI-ondersteund (Meta, TikTok en YouTube vragen dit bij realistische AI-beelden) | Platformregels |

### Instellingen (algemeen)

- **Aspect:** 9:16 · **Resolutie:** 1080p of hoger · **Duur per clip:** 3–5 sec genereren, in de montage inkorten tot 1,5–2 sec.
- **Model:** kies in Higgsfield per shot. Richtlijn: **Kling** of **Seedance** voor fysieke handelingen en handen, **Veo** voor fotorealistische interieurs en licht. Genereer 2–4 varianten per shot en kies de beste.
- **Camera-presets:** de namen hieronder zijn Higgsfield-presets. Namen en beschikbaarheid kunnen per versie verschillen; kies de dichtstbijzijnde.
- **Negatieve prompt (overal):** `text, letters, logo, watermark, distorted hands, extra fingers, melting objects, warped cabinets, floating tools, unrealistic proportions, cartoon, oversaturated`

### Prompts per shot

**Shot 1: Dozen (text-to-video · FPV Drone / Crash Zoom In)**
```
FPV drone shot flying fast through a narrow Dutch hallway stacked with flat-pack kitchen cabinet boxes,
brown cardboard with generic labels, natural daylight from front door, photorealistic, 35mm,
motion blur, energetic, handheld realism
```

**Shot 2: Kale wand (text-to-video · Whip Pan)**
```
Whip pan revealing an empty kitchen wall in a Dutch home, capped water pipes and a drain pipe
sticking out of the wall, electrical outlet boxes, bare plaster, construction dust, soft window light,
photorealistic, 24mm
```

**Shot 3: Gerbian (image-to-video · Super Dolly In)**
Startframe: **echte foto van Gerbian** in werkkleding, of Soul ID.
```
Low-angle super dolly in on a kitchen installer walking confidently into an empty kitchen,
carrying a professional tool case, backlit by window light, calm focused expression,
cinematic, shallow depth of field, photorealistic skin, 35mm
```

**Shot 4: Laser (text-to-video · Dolly Left)**
```
Macro shot of a red cross-line laser level projecting a perfectly straight horizontal line across
a plaster wall, dust particles in the beam, slow lateral dolly, dark moody lighting, photorealistic
```

**Shot 5: Boren (text-to-video · Bullet Time / slow motion)**
```
Extreme close-up slow motion of a cordless drill with a 35mm forstner bit boring a hinge cup hole
into a white kitchen cabinet door, wood chips flying in backlight, bullet time camera arc,
realistic hands with work gloves, photorealistic, 120fps look
```

**Shot 6: Waterpas (text-to-video · Crash Zoom In)**
```
Close-up of a hand adjusting a plastic kitchen cabinet leg, then crash zoom into a spirit level
lying on top of the cabinet, the bubble slides and settles exactly in the center,
crisp focus, photorealistic, warm light
```

**Shot 7: Werkblad (image-to-video · Crane Down)**
Startframe: **echte foto** van een onderkastenrij van Gerbian, zonder werkblad (als die er is). Anders text-to-video, generiek.
```
Crane down shot as two installers carefully lower a dark stone-look kitchen worktop onto a row of
base cabinets, controlled motion, slight dust, photorealistic, 24mm
```

**Shot 8: Passtuk (text-to-video · Dolly In)**
```
Macro dolly in: a narrow white filler panel slides perfectly into the gap between the last kitchen
cabinet and the wall, tight precise fit, fingertips push it flush, photorealistic, soft light
```

**Shot 9: Grepen (image-to-video · Tracking)**
Startframe: **echte foto** van een afgewerkte keukenfront van Gerbian.
```
Slow tracking shot along a row of kitchen cabinet fronts with black bar handles all perfectly
aligned, a steel ruler touches one handle, precise, clean, photorealistic, shallow depth of field
```

**Shot 10: Transformatie (image-to-video met start- en eindframe · Hyperlapse)**
Startframe: **echte voor-foto**. Eindframe: **echte na-foto**, vanaf hetzelfde standpunt. Dit is het belangrijkste shot.
```
Hyperlapse transformation of the same kitchen from empty room to fully finished kitchen,
fixed camera position, cabinets and worktop appear in rapid time-lapse, lights switch on at the end,
photorealistic, no people
```
Is er geen matchend voor/na-paar? Maak dan in de montage een harde **flash-cut** van voor naar na. Laat het niet door AI verzinnen.

**Shot 11–12: Details na (image-to-video · Slow Dolly Out / Dolly Right)**
Startframe: **echte na-foto's** (close-ups werkblad, kitnaad, verlichting).
```
Slow cinematic dolly out on a finished kitchen detail, under-cabinet LED lights switch on,
warm evening atmosphere, subtle reflections on the worktop, photorealistic, calm
```

**Shot 13: Genieten (text-to-video of echte opname · Orbit)**
Liefst **echte klanten** met toestemming. Bij AI: generiek, en niet aan een review koppelen.
```
Slow orbit around a couple in their newly finished modern kitchen, one pours coffee from a
bean-to-cup machine, cup placed on the worktop, genuine relaxed smiles, warm golden hour light,
photorealistic, 50mm, shallow depth of field
```

**Shot 14: Eindkaart**
Geen AI. Gebruik de eindkaart uit `video/src/hyper.py` (logo, **06 49 11 03 60**, WhatsApp · @chatleingroup) of bouw hem na in CapCut met de merkkleuren uit het campagneplan, sectie 27.

---

## 5. Montage en afwerking

1. **Knip op de beat:** shots 1–9 duren elk 1,5–2 sec, met een cut op elke kick. Shot 10 valt op de drop (0:15).
2. **Speed ramps:** elk AI-shot begint op 100 % en ramp in de laatste 6 frames naar 300 %. Dat geeft een naadloze "hyper"-flow tussen shots.
3. **Overgangen:** whip pans (shot 1→2, 9→10), een match cut op beweging (boor → waterpas), een witte flash-frame bij de drop.
4. **Tekst:** Inter Black in hoofdletters voor de stappen (geel op blauw balkje, `#FFDE54` op `#023881`) en Playfair Display Italic voor de reviews. Houd de tekst tussen 15 % en 70 % van de beeldhoogte, buiten de TikTok- en Reels-knoppen.
5. **Kleur:** warm-neutrale LUT over alle clips, zodat AI- en echte beelden als één geheel ogen. Voeg lichte korrel toe (3–5 %).
6. **Geluid:** muziek, dan werkgeluiden op elke handeling (boor, klik, klap), dan de VO bovenop. De eindmix rond −14 LUFS.
7. **Ondertitels:** de VO letterlijk in beeld (max. 2 regels), omdat de meeste kijkers zonder geluid kijken.

---

## 6. Cutdown 15 sec

| Tijd | Shots | TXT |
|---|---|---|
| 0:00–0:02 | 1 | NIEUWE KEUKEN GEKOCHT? |
| 0:02–0:07 | 4, 5, 6, 9 (elk ± 1,2 sec) | METEN · MONTEREN · WATERPAS · AFWERKEN |
| 0:07–0:09 | 10 | – |
| 0:09–0:12 | 13 | ★★★★★ "Let op details en gaat door tot het echt goed is." |
| 0:12–0:15 | 14 | APP GERBIAN · 06 49 11 03 60 |

---

## 7. Checklist vóór publicatie

- [ ] Echte voor/na- en projectfoto's van Gerbian verzameld (Instagram, Google-profiel, telefoon)
- [ ] Toestemming van Gerbian op papier (beeld, Soul ID, stem)
- [ ] Toestemming van klanten als hun keuken of zijzelf herkenbaar in beeld komen
- [ ] Reviewquotes letterlijk gelijk aan `data/reviews.json` (status "letterlijk")
- [ ] Werkspot-score op de publicatiedag gecontroleerd
- [ ] Geen AI-gegenereerde keuken gepresenteerd als project van Gerbian
- [ ] AI-label aangezet bij upload
- [ ] Telefoonnummer en WhatsApp getest (appje sturen vanaf een ander toestel)
- [ ] Muzieklicentie geregeld (of eigen beat gebruikt)

Bronnen Higgsfield-functies: [higgsfield.ai/camera-controls](https://higgsfield.ai/camera-controls) · [higgsfield.ai/ai-video](https://higgsfield.ai/ai-video)
