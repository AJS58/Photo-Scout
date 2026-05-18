# Photo Scout PWA

GitHub Pages-ready prototype for Photo Scout.

## What works in this build
- Live camera capture where browser permissions allow
- Gallery upload
- Rule-of-thirds grid
- Prototype genre analysis using image brightness/colour/contrast heuristics
- Photography recommendations for 8 genres
- GPS capture where browser permissions allow
- Saved locations using localStorage
- Calendar export as `.ics`
- Share sheet where supported
- PWA manifest and service worker

## GitHub Pages deployment
1. Create a new GitHub repository, e.g. `photo-scout`.
2. Upload all files in this folder to the repository root.
3. Go to **Settings → Pages**.
4. Select **Deploy from branch**.
5. Choose `main` and `/root`.
6. Open the GitHub Pages URL once deployment completes.

## Important limitations
- Camera and GPS require HTTPS. GitHub Pages provides HTTPS, so this should work when deployed.
- The current genre detection is a prototype heuristic, not true AI vision yet.
- Weather, OpenWeather, Gemini/OpenAI Vision and cloud accounts need a backend/serverless function so API keys are not exposed in GitHub Pages.

## Native app route
This project can later be wrapped with Capacitor for Android and iOS builds.


## v3 update
- Splash screen display extended to roughly 2.8 seconds.
- iPhone/Android/PWA icon PNG files added and referenced in manifest/index.
- Live histogram on/off button added to Scout camera view.
- Zebra button remains as a prototype exposure-warning overlay.
