# PA#2 — Smartphone as Tangible Interface

## Implemented
- The web application receives smartphone orientation via WebSocket.
- Surface rotation is synchronized with smartphone movement.
- Variant 10 is implemented with accumulated rotation in **ZXY** order (three rotation matrices).
- Webcam stream is mirrored by default and rendered in a fixed-size canvas block.

## Files
- `main.js` — WebSocket connection and orientation applied to the model.
- `sensor-bridge-server.js` — HTTP -> WebSocket bridge for phone sensor data.
- `index.html` — UI (URL input, Connect/Disconnect/Reset).

## Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the bridge:
   ```bash
   node sensor-bridge-server.js
   ```
3. Open `index.html` in a browser.

## iPhone Connection (Sensor Logger)
1. Connect iPhone and laptop to the same Wi-Fi network.
2. In Sensor Logger set Push URL:
   `http://<LAPTOP_IP>:8090/sensor`
3. In the web app set WebSocket URL:
   `ws://<LAPTOP_IP>:8090/sensor-stream`
4. Click `Connect Sensor`.

## Check
- Server check: `http://<LAPTOP_IP>:8090/health`
- Root path `/` is not used (it may return `{"error":"Not found"}`).
- When `Show Webcam Stream` is enabled, the canvas block size does not change.

## What to show in the video
1. Running bridge server in terminal.
2. Data flow: Sensor Logger -> HTTP POST -> bridge -> WebSocket -> WebGL.
3. Synchronized surface rotation while moving the smartphone.
4. Briefly mention ZXY rotation order.

