# Video & Audio

## Video

### From a URL

1. Click the **Video** button in the toolbar.
2. Paste a video URL (MP4, WebM, or Ogg).
3. The video element appears on the slide with playback controls.

### By uploading

1. Click the upload arrow next to the Video button.
2. Select a video file from your computer.
3. The file is uploaded to the server and embedded on the slide.

### Video properties

Select the video element to configure in the right panel:

- **Controls** — show/hide playback controls
- **Autoplay** — start playback when the slide becomes active
- **Loop** — repeat when finished
- **Muted** — start with audio muted (required for autoplay in most browsers)
- **Object Fit** — `contain` or `cover`
- **Poster** — a thumbnail image shown before playback starts

::: tip
For autoplay to work in most browsers, you need to also enable **Muted**. Browsers block unmuted autoplay to prevent unwanted audio.
:::

## Audio

1. Click the **Audio** button in the toolbar (under the media section).
2. Enter an audio file URL or upload a file.
3. An audio player element appears on the slide.

Audio elements support the same controls, autoplay, loop, and muted options as video.

## 3D Models

Show a part or an assembly that you and your audience can turn around.

1. Open the **3D Model** menu in the toolbar and choose **Upload STL / GLB**.
2. Pick an **STL** or **GLB** file. Most CAD programs can export one of these (SolidWorks, Fusion, Onshape, FreeCAD, Blender).
3. The model appears on the slide, framed to fit.

Drag to turn it, scroll to zoom, and right-drag to pan. This works when presenting, and in the editor once the model is selected.

### Model properties

Select the model to configure it in the right panel:

- **View**: the angle it starts from (isometric, front, top or right)
- **Up Axis**: which way is up. **Auto** uses Z for STL files, the usual choice in CAD, and Y for GLB files, as glTF defines it. Switch it if the model lies on its side.
- **Color (STL)**: the color of an STL file that has none of its own. GLB files keep their own materials.
- **Background**: transparent by default, so the slide shows through
- **Rotate on its own**: turns slowly, pausing while someone drags it
- **Show edges**: outlines sharp edges, as CAD programs do
- **Replace STL / GLB File**: swap in a new export and keep the settings

::: tip
Export GLB files without Draco or meshopt compression; the viewer can't read those yet. For STEP or IGES files, export an STL or GLB from your CAD program first.
:::
