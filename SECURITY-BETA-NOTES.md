# Photo Scout v11 – Beta Safety Notes

This build has been tightened before wider testing.

## What was checked

- No remote JavaScript libraries are loaded.
- No `eval()` or dynamic script execution is used.
- The app is hosted as static files and runs client-side.
- Photos and saved locations are stored locally in the browser/PWA local storage.
- GPS is requested only when the user taps the GPS button.
- Weather data is requested only from `https://api.open-meteo.com` using approximate latitude/longitude.
- The service worker now only handles same-origin app files and does not cache third-party weather responses.
- Old app caches are cleared by the new v11 service-worker cache name.
- A Content Security Policy has been added to restrict scripts, images, media, workers and connections.

## Permissions used

- Camera: used for live scouting preview and photo capture.
- Location/GPS: used only when the user taps GPS.
- Local storage: used for saved locations, notes and planning data.

## Beta testing advice

- Test in browser mode first before installing as a PWA if Android shows an install warning.
- Do not use sensitive/private locations during early beta testing.
- If the camera freezes, close/reopen the app or switch tabs. v11 includes a watchdog that attempts to restart the preview automatically.

## Known limitation

On iPhone/iOS Safari and PWA mode, Apple does not expose full live shutter speed, aperture, ISO or manual exposure control to web apps. That needs a later native iOS build.


## v13 Notes
- Highlight Alert now samples the live video feed locally in the browser and draws red mottling only over likely clipped highlight areas. No video frames are uploaded.
- Tap-to-focus remains browser/device dependent; in many Chrome/Safari PWA environments the app can show a focus marker but cannot force true optical focus.
