# Anaglyphic Stereo 3D Visualization with Webcam Integration

## Overview
This WebGL application renders a 3D shoe surface model with anaglyphic stereo visualization. It provides interactive control over stereo parameters and integrates a live webcam stream at the zero-parallax plane.

## Features

### 1. Anaglyphic Stereo Rendering
- **Red-Cyan anaglyph** visualization for 3D perception
- **Negative parallax** (objects appear in front of screen)
- Left eye renders in red channel
- Right eye renders in cyan channels (green + blue)
- Requires red-cyan anaglyph glasses

### 2. Rendering Options
- **Wireframe Mode**: Toggle wireframe overlay on the surface
- **Filled Polygons**: Toggle filled polygon rendering
- **Webcam Stream**: Display live webcam feed at zero-parallax plane

### 4. Mouse Interaction
- **Trackball Rotation**: Click and drag to rotate the model around its center
- Smooth, intuitive 3D manipulation

### 5. Webcam Integration
- Stream renders at zero-parallax plane (convergence distance)
- Appears at the same depth as the model convergence point
- Can be toggled on/off with rendering options

## Technical Details

### Architecture

**Files:**
- `index.html` - UI with stereo controls and webcam display
- `main.js` - Rendering engine and parameter management
- `StereoCamera.js` - Stereo camera calculations
- `Model.js` - 3D model definition (shoe surface)
- `shader.gpu` - Vertex and fragment shaders
- `Utils/trackball-rotator.js` - Mouse rotation control
- `Utils/m4.js` - Matrix mathematics library

### Stereo Rendering Pipeline

1. **Initialize Stereo Camera** with parameters
2. **Left Eye Pass**:
   - Set red color mask
   - Translate camera by +eyeSeparation/2
   - Calculate asymmetric frustum based on convergence distance
   - Render filled polygons
   - Render wireframe overlay
3. **Right Eye Pass**:
   - Clear depth buffer only
   - Set cyan color mask
   - Translate camera by -eyeSeparation/2
   - Calculate asymmetric frustum
   - Render filled polygons
   - Render wireframe overlay
4. **Webcam Rendering** (if enabled):
   - Render quad at zero-parallax plane
   - Apply webcam video texture
   - No parallax effect (visible to both eyes identically)

### Frustum Calculation
The projection matrices are calculated based on:
- Near and far clipping planes
- Field of view
- Aspect ratio
- Eye separation and convergence distance for asymmetric frustum

This creates the proper parallax effect for negative parallax (objects in front of screen).

## Usage Instructions

1. **Open in Browser**: Load `index.html` in WebGL-compatible browser
2. **Wear Anaglyph Glasses**: Put on red-cyan 3D glasses
3. **Rotate Model**: Click and drag on canvas to rotate
4. **Adjust Parameters**: Use sliders to find comfortable viewing:
   - Increase eye separation for stronger 3D
   - Adjust convergence distance where you want focus
   - Modify FOV for preference
5. **Enable Webcam** (Optional):
   - Check "Show Webcam Stream"
6. **Reset**: Use "Reset Parameters" button to restore defaults

## Browser Requirements
- WebGL support (modern browsers: Chrome, Firefox, Edge, Safari)
- For webcam: HTTPS connection (or localhost) and camera permission

## Physical Parameters
- Measurements in decimeters (dm)
- Typical comfortable viewing:
  - Eye separation: 0.65-0.75 dm
  - Convergence distance: 12-16 dm
  - FOV: 40-50°

## Tips for Best Experience

1. **Glasses Alignment**: Ensure glasses are properly aligned
2. **Distance**: Sit about 40-50 cm from screen
3. **Parameter Tuning**: Start with defaults, adjust eye separation for comfort
4. **Convergence**: Adjust convergence distance to where model appears
5. **Lighting**: Use in well-lit environment for better color accuracy
6. **Webcam**: Position camera to see your face at zero-parallax plane

## Performance Notes
- Rendered at full canvas resolution
- Dual-pass rendering (once per eye)
- Webcam texture updates per frame
- Smooth performance on modern hardware

## Advanced Features

### Wireframe on Filled
Renders wireframe edges on top of filled polygons for enhanced depth perception:
- Filled polygons provide depth
- Wireframe edges enhance edge definition

### Zero-Parallax Webcam
Webcam rendered at convergence distance ensures:
- No parallax disparity
- Same position for both eyes
- Effective background plane

