# Renderen

Motion-graphics-versie van de hero-video (9:16, 53 s).

```bash
pip install pillow numpy imageio-ffmpeg
mkdir -p fonts   # zet hier PlayfairDisplay.ttf, PlayfairDisplay-Italic.ttf en Inter.ttf (google/fonts, map ofl/)
python3 render.py ../chatlein-hero-9x16.mp4
python3 render.py stills 3.5 20 37.5   # losse testframes in ./stills
```
