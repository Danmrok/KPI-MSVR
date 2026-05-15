# AR Shoe Surface

An iOS augmented reality application that renders an anaglyphic stereo 3D shoe surface model aligned to a printed AR marker. Built with ARKit and SceneKit in SwiftUI as a continuation of the WebGL anaglyphic stereo visualization (PA#1).

---

## Overview

The application detects a printed marker using ARKit image tracking and overlays the parametric shoe surface model on top of it in real time. The model is rendered in anaglyphic stereo (red-cyan) with a wireframe overlay on top of filled polygons — matching the rendering style of PA#1. The model automatically scales and fits within the marker bounds regardless of the printed size.

---

## Project Structure

```
ShoeAR/
├── ShoeAR_App.swift        # @main entry point
├── ContentView.swift       # SwiftUI root view with status bar and info overlay
├── ARViewController.swift  # ARKit session + SceneKit rendering pipeline
└── ShoeGeometry.swift      # Parametric shoe surface (Swift port of PA#1 Model.js)
```

> ARKit does not work in Simulator — a real device is required.

---

## Registration Template

As the registration template we use the **Hiro marker** from the AR.js toolkit:

**[https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg](https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg)**


### How to print

1. Open the Hiro marker link above in a browser
2. Save the image and print it at **100% scale**
3. Verify the printed marker is at least **10 × 10 cm**
4. Attach it to a flat surface of any real object (box, book, shoe box, etc.)

### Adding the marker to Xcode

1. Save the Hiro marker image as a PNG file
2. In Xcode, right-click the project navigator → **Add AR Resources** (creates an AR Resources asset group)
3. Drag the saved PNG into the AR Resources group
4. Select the asset and set **Physical Width** to match your printed size

---

## How It Works

### ARKit Image Tracking

The app uses `ARImageTrackingConfiguration` to continuously track the printed marker in the camera feed. When the marker is detected, ARKit provides a world-space `ARImageAnchor` with position and orientation. The shoe node is attached to that anchor and follows it in real time.

### Parametric Shoe Surface

`ShoeGeometry.swift` is a direct Swift port of the `shoePoint()` function from PA#1 `Model.js`, using the same mathematical formula:

```
x = (u − 0.5) × 4.2
toeBulge     = 0.25 · exp(−((u − 0.88) / 0.18)²)
widthProfile = 0.42 + 0.20·sin(πu) + toeBulge
y = widthProfile · v · (0.95 − 0.18u)
z = 0.24·sin(πu) − 0.18x²/4.41 + 0.07·cos(πv)
```

Mesh resolution: 80 × 36 segments → 2 997 vertices, 5 760 triangles.

### Anaglyphic Stereo Rendering

Two separate SceneKit nodes are built for the left and right eyes:

| Eye | Color channels | Horizontal shift |
|-----|---------------|-----------------|
| Left | Red only `(1, 0, 0)` | +eyeShift |
| Right | Cyan only `(0, 1, 1)` | −eyeShift |

The eye shift is calculated as 3% of the marker width, capped by the available space so neither eye overflows the marker boundary. This replicates the asymmetric frustum stereo approach from PA#1.

### Wireframe on Filled Polygons

Each eye node renders filled polygons first, then wireframe edges on top — matching the draw order from PA#1:

```swift
eye.addChildNode(SCNNode(geometry: filledGeometry))    // filled first
eye.addChildNode(SCNNode(geometry: wireframeGeometry)) // wireframe on top
```

### Adaptive Scaling

The model bounding box is computed at runtime and the uniform scale is chosen so the model fits inside the marker on both axes with a 5% padding:

```swift
let scaleForWidth  = (markerWidth  × 0.95) / modelSizeX
let scaleForHeight = (markerHeight × 0.95) / modelSizeY
let scale = min(scaleForWidth, scaleForHeight)
```

This ensures the model always stays within the marker bounds regardless of the physical print size.

---

## Usage

1. Open the Hiro marker image on any screen or print it out
2. Launch the app on iPhone
3. Point the camera at the Hiro marker
4. The green **Marker detected** indicator appears when tracking is active
5. Put on red-cyan anaglyph glasses to see the stereo 3D effect
6. Move the phone around to view the model from different angles

---

## Comparison with PA#1 (WebGL)

| Feature | PA#1 (WebGL) | СT (ARKit) |
|---------|-----------|-----------|
| Rendering | WebGL canvas | SceneKit / ARKit |
| Stereo method | Color mask per draw call | Separate SCNNode per eye |
| Wireframe | `gl.LINES` over triangles | `SCNGeometryPrimitiveType.line` |
| Surface formula | `shoePoint()` in JS | `shoePoint()` ported to Swift |
| Camera control | Trackball mouse rotation | Physical camera movement in AR |
| Marker tracking | N/A | ARKit `ARImageTrackingConfiguration` |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Marker not detected | Ensure good lighting; keep camera 20–50 cm from marker |
| Model appears too small | Increase Physical Width in AR Resources to match actual print size |
| Build error about ARKit | Must run on a real device, Simulator is not supported |
| Camera permission denied | Add `Privacy - Camera Usage Description` in Target → Info |
| Model partially outside marker | Check that Physical Width in AR Resources matches the real printed size |
