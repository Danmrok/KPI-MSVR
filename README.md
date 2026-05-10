# Calculation&graphics work (Spatial audio)

## Implemented
- Stereo 3D rendering with adjustable left/right eye parameters.
- Spatial audio source controlled manually by yaw slider.
- Surface remains fixed while the audio source moves around it.
- WebAudio API graph includes `MediaElementSourceNode`, `PannerNode`, and a band-pass `BiquadFilterNode`.
- Visual sound source sphere is rendered in the 3D scene.
- Audio controls are grouped in a separate UI block for cleaner layout.

## Files
- `main.js` — Core rendering, audio graph, and UI control logic.
- `index.html` — User interface for stereo settings and spatial audio controls.
- `shader.gpu` — GPU shader code for rendering.
- `StereoCamera.js` — Stereo frustum and view handling.
- `Utils/m4.js` — Matrix math utilities.

## Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Open `index.html` in a browser that supports Web Audio and WebGL.
3. Load an audio file using the `Audio Track` control.
4. Use the `Manual Yaw` slider to reposition the audio source.
5. Toggle playback and adjust the band-pass filter settings.

## Notes
- The app no longer requires smartphone sensor input for the current spatial audio demo.
- `sensor-bridge-server.js` is kept in the repo but is not needed for manual yaw control.
- The audio source position is updated independently from the rendered static surface.

## What to show
1. Loading an audio track and enabling spatial audio.
2. Adjusting `Manual Yaw` to move the source around the fixed surface.
3. Switching the band-pass filter on/off and changing frequency/Q values.
4. Demonstrating the separate audio control panel in the UI.

