# String Pluck - Vercel Deployment Guide

## 🚀 Quick Deploy

### Method 1: Deploy via Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Method 2: Deploy via GitHub + Vercel Dashboard

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Convert to Next.js for Vercel deployment"
   git push origin master
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js settings
   - Click "Deploy"

## ✅ What's Been Done

### Converted to Next.js
- ✅ Created Next.js project structure
- ✅ Moved all assets to `/public` directory
- ✅ Extracted styles to `/styles/globals.css`
- ✅ Created Next.js pages (`index.js`, `_app.js`, `_document.js`)
- ✅ Configured `next.config.js` for production
- ✅ Added `vercel.json` for proper headers (WebGL/Audio support)

### Preserved Functionality
- ✅ All original features work identically
- ✅ GPU-accelerated audio synthesis via WebGL
- ✅ MIDI playback system
- ✅ Interactive string simulator
- ✅ Touch and mouse support
- ✅ All presets and configurations

### Files Added/Modified
```
New Files:
├── package.json              # Dependencies
├── next.config.js            # Next.js config
├── vercel.json               # Vercel deployment config
├── .gitignore                # Git ignore rules
├── pages/
│   ├── index.js              # Main page
│   ├── _app.js               # App wrapper
│   └── _document.js          # HTML structure
├── styles/
│   └── globals.css           # Global styles
└── public/                   # All static assets moved here
    ├── jquery.min.js
    ├── unmute.js
    ├── draw.js
    ├── notes.js
    ├── audio_shader.js
    ├── plucker.js
    ├── tonejs_midi.js
    ├── preact.htm.module.js
    ├── app-logic.js          # Main application logic
    ├── appstore.svg
    ├── midis/                # All MIDI files
    └── AppIcons/             # App icons
```

## 🧪 Testing Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production (test before deploying)
npm run build

# Run production build locally
npm start
```

Visit `http://localhost:3000` to test.

## 🌐 After Deployment

Your app will be available at:
- Preview: `https://your-project-name-xyz123.vercel.app`
- Production: `https://your-domain.vercel.app` (or custom domain)

## 📊 Performance Notes

The application is optimized for client-side rendering and uses:
- WebGL 2.0 for GPU-accelerated audio
- Web Audio API for sound output
- Canvas 2D API for visualization
- ~38 million calculations per second

## 🔧 Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Audio Issues
The app requires these headers (already configured in `vercel.json`):
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

### MIDI Files Not Loading
Ensure all MIDI files are in `/public/midis/` and listed in `/public/midis/midis.json`

## 📱 Browser Compatibility

Works best in:
- Chrome/Edge 90+ ✅
- Firefox 88+ ✅
- Safari 15+ ✅

Requires WebGL 2.0 and Web Audio API support.

## 🎉 Ready to Deploy!

Your app is now ready for public deployment on Vercel. Simply run:

```bash
vercel --prod
```

And share the link with the world! 🌍

