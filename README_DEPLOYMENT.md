# String Pluck - Next.js Deployment Guide

This project has been converted to Next.js for easy deployment to Vercel.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI globally:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow the prompts to deploy to production:
```bash
vercel --prod
```

### Option 2: Using Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will automatically detect Next.js and configure the build settings
6. Click "Deploy"

## Project Structure

- `/pages` - Next.js pages
  - `index.js` - Main application page
  - `_app.js` - App wrapper with global styles
  - `_document.js` - HTML document structure
- `/public` - Static assets (MIDI files, JS libraries, etc.)
- `/styles` - Global CSS styles
- `next.config.js` - Next.js configuration
- `vercel.json` - Vercel deployment configuration

## Notes

- All the original functionality is preserved
- The app uses WebGL for GPU-accelerated audio synthesis
- MIDI files are served from the `/public/midis` directory
- The app works client-side only (uses browser APIs like Canvas, WebGL, Web Audio)

## Performance

The application handles:
- 72 strings × 12 overtones × 44,100 samples/second = ~38M calculations/second
- GPU-accelerated audio processing
- Real-time visualization

## Browser Support

Works best in modern browsers with WebGL 2.0 support:
- Chrome/Edge (recommended)
- Firefox
- Safari 15+




