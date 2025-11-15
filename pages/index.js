import { useEffect, useState } from 'react'
import Script from 'next/script'

export default function Home() {
  const [scriptsLoaded, setScriptsLoaded] = useState({
    jquery: false,
    unmute: false,
    draw: false,
    notes: false,
    audioShader: false,
    plucker: false,
    tonejs: false,
    webaudiofont: false,
    appLogic: false,
  })

  const allScriptsLoaded = Object.values(scriptsLoaded).every(Boolean)

  return (
    <>
      <Script
        src="/jquery.min.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, jquery: true }))}
      />
      <Script
        src="/unmute.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, unmute: true }))}
      />
      <Script
        src="/draw.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, draw: true }))}
      />
      <Script
        src="/notes.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, notes: true }))}
      />
      <Script
        src="/audio_shader.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, audioShader: true }))}
      />
      <Script
        src="/plucker.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, plucker: true }))}
      />
      <Script
        src="/tonejs_midi.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, tonejs: true }))}
      />
      <Script
        src="/webaudiofont/WebAudioFontPlayer.js"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, webaudiofont: true }))}
      />
      <Script
        src="/app-logic.js"
        type="module"
        strategy="afterInteractive"
        onLoad={() => setScriptsLoaded(prev => ({ ...prev, appLogic: true }))}
      />

      <div className="container">
        <div id="draw"></div>
        <div id="controls"></div>
      </div>
    </>
  )
}
