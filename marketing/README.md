# Caribbean Public Solutions — video ad & campaign kit

A 30-second brand ad in the visual identity of the website (deep ocean blue, warm orange, Fraunces + Inter Tight, the 3D Caribbean map with Bonaire as home base).

## Files

| File | Format | Use |
| --- | --- | --- |
| `video/out/cps-ad-{lang}-16x9.mp4` | 1920×1080, 30 fps, H.264 | LinkedIn feed, YouTube, website, presentations |
| `video/out/cps-ad-{lang}-9x16.mp4` | 1080×1920, 30 fps, H.264 | LinkedIn/Instagram/Facebook Stories & Reels, WhatsApp Status, TikTok |

Languages: `en`, `es`, `nl`, `pap`. All copy comes from the website's translation files (`src/i18n`), so ad and site always say the same thing.

## Storyboard (30 s)

| Time | Scene | Purpose |
| --- | --- | --- |
| 0–3 s | Three recognisable problems, full-screen type: *Long lead times · Unclear requirements · Contracts without clarity* | **Hook**: speak to the viewer's pain in the first seconds |
| 3–5 s | *Sound familiar?* (orange italic) | Agitate / create recognition |
| 5–9 s | Camera flies over the Caribbean and tilts down to Bonaire, glowing orange — *From Bonaire. For the Caribbean.* | Introduce who and where |
| 9–14 s | Connections draw across the region — *Public procurement. Private ambition.* | Brand promise, regional reach |
| 14–21 s | The four services appear one by one | Solution, concretely |
| 21–26 s | Process line lights up: Understand → Define → Select → Contract & Prepare | How it works; reduces perceived risk |
| 26–30 s | End card: logo, promise, **Discuss your project** button, name, tagline | One clear call to action |

## Proven techniques applied

- **Hook in the first 3 seconds** with the viewer's own problem (feed ads are judged in seconds).
- **Problem → agitation → solution → call to action** (PAS/AIDA structure).
- **Brand visible from the first second** (logo top left), so the brand registers even when people scroll on.
- **Designed for sound-off viewing**: every message is on screen as text; most feed video is watched muted.
- **Native formats**: 16:9 for feed and YouTube, 9:16 full-screen for Stories/Reels, with text kept in the safe area.
- **One message, one call to action**; end card on screen ≥ 3 s.
- **Only confirmed facts**: no invented clients, figures, testimonials or results.

## Before publishing

1. **Web address / contact on the end card**: none is confirmed yet. Re-render with it: `AD_URL="www.example.com" node marketing/video/render.mjs en landscape`.
2. **Music (optional)**: the video is silent by design. For YouTube or events, add a *licensed* track (for example from the YouTube Audio Library or a paid stock library) in any editor, or with ffmpeg:
   `ffmpeg -i cps-ad-en-16x9.mp4 -i music.mp3 -c:v copy -c:a aac -shortest out.mp4`
3. **Papiamentu and Spanish copy**: have them checked by a native speaker (same as the website).
4. Measure: run two hooks or two thumbnails side by side (A/B test) and keep the one with the higher view-through rate.

## Post copy

**LinkedIn — English**
> Procurement that takes too long. Requirements nobody agrees on. Contracts that leave too much open.
> Caribbean Public Solutions helps public and private organizations across the Caribbean with procurement, IT and technology projects, practical AI and AI training — from objective to agreement.
> From Bonaire. For the Caribbean. Discuss your project with us.
> #Procurement #PublicProcurement #Caribbean #Bonaire #AI

**LinkedIn — Español**
> Procesos de contratación que se alargan. Requisitos poco claros. Contratos que dejan demasiado abierto.
> Caribbean Public Solutions acompaña a organizaciones públicas y privadas de todo el Caribe en contratación, proyectos de TI y tecnología, soluciones prácticas de IA y capacitación en IA: del objetivo al acuerdo.
> Desde Bonaire. Para todo el Caribe. Hablemos de su proyecto.
> #Contratación #ComprasPúblicas #Caribe #Bonaire #IA

**LinkedIn — Nederlands**
> Inkooptrajecten die te lang duren. Eisen waar niemand het over eens is. Contracten die te veel openlaten.
> Caribbean Public Solutions helpt publieke en private organisaties in het hele Caribisch gebied met inkoop, IT- en technologieprojecten, praktische AI en AI-trainingen — van doelstelling tot overeenkomst.
> Vanuit Bonaire. Voor het hele Caribisch gebied. Bespreek uw project met ons.
> #Inkoop #Aanbesteden #CaribischNederland #Bonaire #AI

**Papiamentu** *(laga un hablante nativo revisá)*
> Trayekto di kompra ku ta dura muchu largu. Eksigensia no kla. Kontrakt ku ta laga muchu habrí.
> Caribbean Public Solutions ta yuda organisashonnan públiko i privá den henter Karibe ku kompra, proyekto di IT i teknologia, IA práktiko i training den IA — for di meta te akuerdo.
> For di Boneiru. Pa henter Karibe. Papia ku nos di boso proyekto.

**Stories / Reels (short)**: *Procurement stalled? From Bonaire, for the Caribbean. Discuss your project.* (+ link sticker once the website is live)

## Rendering

The ad is an HTML animation (`video/ad.html`) with a deterministic timeline, captured frame by frame in headless Chromium and encoded with ffmpeg (x264, CRF 18).

```bash
npm install --no-save playwright-core ffmpeg-static   # plus a Chromium (set CHROMIUM=/path/to/chrome)
node marketing/video/render.mjs en landscape          # or: vertical; languages: en es nl pap
```
