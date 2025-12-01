# Snap Ratio - Thumbnail Capture Extension

A Chrome extension built with Plasmo, React, TypeScript, and TailwindCSS that captures screenshots of a user-selected 16:9 fixed-ratio area, resizes them to 768×432, compresses using the iLoveIMG API, and downloads the processed thumbnail.

## Features

- **Fixed 16:9 Ratio Selection**: Drag and resize a selection box that maintains a 16:9 aspect ratio
- **Screenshot Capture**: Capture only the selected area from the current tab
- **Automatic Resizing**: Automatically resizes captured images to 768×432 pixels
- **Image Compression**: Compresses images using the iLoveIMG API
- **Automatic Download**: Downloads processed thumbnails with custom filenames

## Tech Stack

- **Plasmo** - Browser extension framework
- **React** - UI library
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Chrome APIs** - Screenshot capture and downloads
- **iLoveIMG API** - Image compression

## Project Structure

```
src/
├── popup.tsx              # Popup UI with Template ID input
├── content.tsx            # Content script with selection overlay
├── background/
│   ├── index.ts          # Background service worker entry
│   └── messages/
│       └── captureScreenshot.ts  # Screenshot processing handler
├── features/              # Feature components
└── style.css             # Global styles with Tailwind
```

## Getting Started

### Installation

1. Install dependencies:

```bash
pnpm install
# or
npm install
```

2. Run the development server:

```bash
pnpm dev
# or
npm run dev
```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev` directory

## Usage

1. Click the extension icon to open the popup
2. Enter a Template ID (this will be used as the filename)
3. Click "Capture Thumbnail"
4. A fullscreen overlay will appear with a 16:9 selection box
5. Drag to move or use corner handles to resize (ratio is locked to 16:9)
6. Click "Capture Frame" to process and download the thumbnail
7. The image will be automatically:
   - Cropped to the selected area
   - Resized to configured dimensions (default: 640×360 pixels)
   - Compressed using iLoveIMG API
   - Downloaded as `<TEMPLATE_ID>.jpg`

## Image Configuration

You can easily adjust image quality, dimensions, and format by editing `src/config/image.ts`:

```typescript
export const imageConfig = {
  width: 640,        // Output width (16:9 ratio)
  height: 360,       // Output height (16:9 ratio)
  quality: 0.85,     // JPEG quality (0.0-1.0, lower = smaller file)
  format: "image/jpeg" // Output format: "image/jpeg" or "image/png"
}
```

**Tips for achieving ~10KB file size:**
- Reduce dimensions: Try 600×338 or 560×315
- Lower quality: Try 0.80-0.82 (still looks good)
- Combine both for maximum compression

## API Configuration

The extension uses the iLoveIMG API for image compression. To use compression, you need to:

1. **Register at iLovePDF Developers**: Go to https://developer.ilovepdf.com/ and create an account
2. **Get your API keys**: 
   - Navigate to the API Keys section in your developer console
   - Copy your Public Key and Secret Key
3. **Set environment variables**:
   - Copy `.env.example` to `.env` (or create a new `.env` file)
   - Add your keys:
     ```
     PLASMO_PUBLIC_ILOVEIMG_PUBLIC_KEY=your_public_key_here
     PLASMO_PUBLIC_ILOVEIMG_SECRET_KEY=your_secret_key_here
     ```
4. **Restart the development server** after adding the keys

**Note**: The extension will fall back to uncompressed images if the API keys are not configured or if compression fails.

## Building for Production

```bash
pnpm build
# or
npm run build
```

This creates a production bundle in the `build/` directory, ready to be packaged and published.

## Permissions

The extension requires the following permissions:

- `tabs` - To access tab information
- `activeTab` - To capture screenshots of the current tab
- `downloads` - To save processed images
- `scripting` - To inject scripts for viewport detection
- `host_permissions` - To access iLoveIMG API

## Development Notes

- The selection overlay uses viewport coordinates which are scaled to match screenshot dimensions
- Device pixel ratio is automatically detected and accounted for
- Image processing uses OffscreenCanvas for efficient processing in the service worker
- Error handling includes fallbacks for compression failures

## License

MIT
