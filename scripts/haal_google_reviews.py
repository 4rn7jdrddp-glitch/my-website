"""Haal Google-score, reviews en foto's van Chatlein Group op via de officiële Places API (New).

Gebruik:
    export GOOGLE_MAPS_API_KEY=...        # sleutel met 'Places API (New)' aan
    python3 scripts/haal_google_reviews.py

Schrijft naar data/google/:
    place.json   ruwe API-respons (score, aantal reviews, max. 5 reviews, foto-verwijzingen)
    foto_XX.jpg  foto's van het profiel (max. 10), met naamsvermelding in place.json

Let op: de API geeft maximaal 5 reviews terug. Foto's van klanten blijven van de maker;
gebruik in de video alleen foto's die Gerbian zelf heeft geplaatst, of vraag toestemming.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
QUERY = os.environ.get("PLACE_QUERY", "Chatlein Group Montage & Installatie Pijnacker")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "google")
FIELDS = "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews,places.photos"


def post(url, body, fields):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": fields})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    if not KEY:
        sys.exit("GOOGLE_MAPS_API_KEY ontbreekt")
    os.makedirs(OUT, exist_ok=True)
    res = post("https://places.googleapis.com/v1/places:searchText",
               {"textQuery": QUERY, "languageCode": "nl", "regionCode": "NL"}, FIELDS)
    places = res.get("places", [])
    if not places:
        sys.exit(f"Geen resultaat voor: {QUERY}")
    p = places[0]
    with open(os.path.join(OUT, "place.json"), "w", encoding="utf-8") as f:
        json.dump(p, f, ensure_ascii=False, indent=2)
    print(p.get("displayName", {}).get("text"), "|", p.get("rating"), "/ 5 |", p.get("userRatingCount"), "reviews")
    for rv in p.get("reviews", []):
        txt = (rv.get("originalText") or rv.get("text") or {}).get("text", "")
        print(f"- {rv.get('rating')}★ {rv.get('relativePublishTimeDescription', '')}: {txt[:120]}")
    for i, ph in enumerate(p.get("photos", [])[:10], 1):
        url = f"https://places.googleapis.com/v1/{ph['name']}/media?maxWidthPx=2400&key={urllib.parse.quote(KEY)}"
        dest = os.path.join(OUT, f"foto_{i:02d}.jpg")
        urllib.request.urlretrieve(url, dest)
        who = ", ".join(a.get("displayName", "") for a in ph.get("authorAttributions", []))
        print(f"foto {i:02d} -> {dest} (door: {who})")


if __name__ == "__main__":
    main()
