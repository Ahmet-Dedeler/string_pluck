import { html, render, Component } from "./preact.htm.module.js"

// Auto-initialize when the module loads
(function initApp() {


    function smoothTransition(x, x_start, x_end, start_value, end_value) {
        const scaledX = (x - x_start) / (x_end - x_start) * 10 - 5;
        const sigmoid = 1 / (1 + Math.exp(-scaledX));
        return start_value + (end_value - start_value) * sigmoid;
    }
    window.smoothTransition = smoothTransition;

    const base_freq = Notes.note_to_freq('E2');

    const CanvasModes = {
        pluck: 'pluck',
        draw: 'draw',
        erase: 'erase',
        move: 'move',
    }
    window.CanvasModes = CanvasModes;
    window.canvas_mode = CanvasModes.pluck;

    const LayoutModes = {
        classic: 'classic',
        uniform: 'uniform',
    }
    window.LayoutModes = LayoutModes;
    const savedLayoutMode = typeof localStorage !== 'undefined' ? localStorage.getItem('layout_mode') : null;
    window.layout_mode = Object.values(LayoutModes).includes(savedLayoutMode) ? savedLayoutMode : LayoutModes.classic;

    const getLayoutMode = () => window.layout_mode || LayoutModes.classic;
    const setLayoutMode = (mode) => {
        if (!Object.values(LayoutModes).includes(mode)) {
            return;
        }
        window.layout_mode = mode;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('layout_mode', mode);
        }
        window.dispatchEvent(new CustomEvent('layout_mode_changed', { detail: { mode } }));
    }

    const getNormalizedColorIndex = (order, total) => {
        if (typeof order !== 'number') return 0;
        if (typeof total !== 'number' || total <= 1) return 0;
        const clampedOrder = Math.max(0, Math.min(order, total - 1));
        return clampedOrder / (total - 1);
    }

    const truncateTrackName = (name, maxLength = 50) => {
        if (typeof name !== 'string' || !name.length) {
            return '';
        }
        const ellipsis = '...';
        if (name.length <= maxLength) {
            return name;
        }
        if (maxLength <= ellipsis.length) {
            return ellipsis.slice(0, maxLength);
        }
        return `${name.slice(0, maxLength - ellipsis.length).trimEnd()}${ellipsis}`;
    };

    const createHueTheme = ({
        id,
        label,
        startHue,
        endHue,
        saturation,
        startLightness,
        endLightness,
        phaseMode = 'gradient', // 'gradient' keeps motion within palette, 'hue' rotates hue wheel
    }) => ({
        id,
        label,
        getColor: ({ normalizedIndex, phase = 0 }) => {
            const hueSpan = (typeof endHue === 'number' ? endHue : startHue) - startHue;
            let progress = normalizedIndex;
            if (phaseMode === 'gradient') {
                const normalizedPhase = ((phase / 360) % 1 + 1) % 1;
                progress = (progress + normalizedPhase) % 1;
            }
            let hue = startHue + hueSpan * progress;
            if (phaseMode === 'hue') {
                hue = (hue + phase) % 360;
            }
            const lightnessSpan = (typeof endLightness === 'number' ? endLightness : startLightness) - startLightness;
            const lightness = startLightness + lightnessSpan * progress;
            return hslToRgb((hue + 360) % 360, saturation, Math.max(0, Math.min(100, lightness)));
        },
    });

    const ColorThemes = {
        white: {
            id: 'white',
            label: 'White',
            getColor: ({ normalizedIndex, phase = 0 }) => {
                const normalizedPhase = ((phase / 360) % 1 + 1) % 1;
                const progress = (normalizedIndex + normalizedPhase) % 1;
                const lightness = 65 + progress * 30;
                return hslToRgb(0, 0, Math.max(60, Math.min(100, lightness)));
            },
        },
        rainbow: createHueTheme({
            id: 'rainbow',
            label: 'Rainbow',
            startHue: 0,
            endHue: 300,
            saturation: 70,
            startLightness: 55,
            endLightness: 60,
            phaseMode: 'hue',
        }),
        blue: createHueTheme({
            id: 'blue',
            label: 'Midnight Blue',
            startHue: 205,
            endHue: 225,
            saturation: 80,
            startLightness: 28,
            endLightness: 68,
            phaseMode: 'gradient',
        }),
        gold: createHueTheme({
            id: 'gold',
            label: 'Golden Hour',
            startHue: 34,
            endHue: 50,
            saturation: 88,
            startLightness: 32,
            endLightness: 75,
            phaseMode: 'gradient',
        }),
    };
    const defaultColorThemeId = 'white';
    window.ColorThemes = ColorThemes;

    const ColorThemePreviewStyles = {
        white: 'linear-gradient(135deg, #dcdcdc, #fefefe, #bfbfbf)',
        rainbow: 'linear-gradient(135deg, #ff5f6d, #ffc371, #47c9ff)',
        blue: 'linear-gradient(135deg, #0f1c3f, #1d3f72, #35a0ff)',
        gold: 'linear-gradient(135deg, #5c3b07, #d7a12a, #fff2b0)',
    };

    const getColorThemePreviewStyle = (themeId) => ColorThemePreviewStyles[themeId] || ColorThemePreviewStyles[defaultColorThemeId];

    const getNextListValue = (list, current) => {
        if (!Array.isArray(list) || list.length === 0) {
            return current;
        }
        const index = list.indexOf(current);
        if (index === -1) {
            return list[0];
        }
        return list[(index + 1) % list.length];
    };

    const savedColorTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('color_theme') : null;
    window.color_theme = ColorThemes[savedColorTheme] ? savedColorTheme : defaultColorThemeId;
    window.color_theme_phase = 0;

    const getActiveColorTheme = () => ColorThemes[window.color_theme] || ColorThemes[defaultColorThemeId];
    window.getActiveColorTheme = getActiveColorTheme;
    window.getColorThemeOptions = () => Object.values(ColorThemes).map(theme => ({ id: theme.id, label: theme.label }));

    window.getThemeColor = (order, total, options = {}) => {
        const theme = getActiveColorTheme();
        const normalizedIndex = getNormalizedColorIndex(order, total);
        const phase = typeof options.phase === 'number' ? options.phase : (window.color_theme_phase || 0);
        if (theme && typeof theme.getColor === 'function') {
            return theme.getColor({ index: order, total, normalizedIndex, phase });
        }
        return [255, 255, 255];
    };

    window.setColorTheme = (themeId) => {
        if (!ColorThemes[themeId]) {
            return;
        }
        window.color_theme = themeId;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('color_theme', themeId);
        }
        window.dispatchEvent(new CustomEvent('color_theme_changed', { detail: { themeId } }));
    };

    const savedColorMotion = typeof localStorage !== 'undefined' ? localStorage.getItem('color_motion_enabled') : null;
    window.color_motion_enabled = savedColorMotion === 'true';
    window.setColorMotionEnabled = (enabled) => {
        const resolved = !!enabled;
        if (window.color_motion_enabled === resolved) {
            return;
        }
        window.color_motion_enabled = resolved;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('color_motion_enabled', resolved ? 'true' : 'false');
        }
        window.dispatchEvent(new CustomEvent('color_motion_changed', { detail: { enabled: resolved } }));
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const MASTER_VOLUME_STORAGE_KEY = 'master_volume';
    const DEFAULT_MASTER_VOLUME = 1;
    const getStoredMasterVolume = () => {
        if (typeof localStorage === 'undefined') {
            return DEFAULT_MASTER_VOLUME;
        }
        const stored = parseFloat(localStorage.getItem(MASTER_VOLUME_STORAGE_KEY));
        if (Number.isFinite(stored)) {
            return clamp(stored, 0, 1.5);
        }
        return DEFAULT_MASTER_VOLUME;
    };
    const setStoredMasterVolume = (value) => {
        const resolved = clamp(typeof value === 'number' ? value : DEFAULT_MASTER_VOLUME, 0, 1.5);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(MASTER_VOLUME_STORAGE_KEY, resolved);
        }
        window.master_volume = resolved;
        return resolved;
    };
    window.master_volume = typeof window.master_volume === 'number' ? window.master_volume : getStoredMasterVolume();

    const AudioEngines = {
        shader: 'shader',
        waf: 'webaudiofont',
    };

    const WebAudioFontInstruments = {
        plucked: {
            id: 'plucked',
            label: 'Legacy Strings',
            description: 'Original GPU plucked-string sound',
            engine: AudioEngines.shader,
            icon: '🪕',
        },
        piano: {
            id: 'piano',
            label: 'Grand Piano',
            description: 'Acoustic grand from WebAudioFont',
            engine: AudioEngines.waf,
            script: '/webaudiofont/0000_JCLive_sf2_file.js',
            variable: '_tone_0000_JCLive_sf2_file',
            icon: '🎹',
        },
        organ: {
            id: 'organ',
            label: 'Drawbar Organ',
            description: 'Classic drawbar organ',
            engine: AudioEngines.waf,
            script: '/webaudiofont/0160_JCLive_sf2_file.js',
            variable: '_tone_0160_JCLive_sf2_file',
            icon: '🎛️',
        },
        sax: {
            id: 'sax',
            label: 'Alto Sax',
            description: 'Expressive alto saxophone',
            engine: AudioEngines.waf,
            script: '/webaudiofont/0650_JCLive_sf2_file.js',
            variable: '_tone_0650_JCLive_sf2_file',
            icon: '🎷',
        },
        synthpad: {
            id: 'synthpad',
            label: 'Warm Synth Pad',
            description: 'Lush synth pad for ambience',
            engine: AudioEngines.waf,
            script: '/webaudiofont/0880_JCLive_sf2_file.js',
            variable: '_tone_0880_JCLive_sf2_file',
            icon: '🌌',
        },
        harp: {
            id: 'harp',
            label: 'Plucked Harp',
            description: 'Orchestral harp / plucked strings',
            engine: AudioEngines.waf,
            script: '/webaudiofont/1050_JCLive_sf2_file.js',
            variable: '_tone_1050_JCLive_sf2_file',
            icon: '🎼',
        },
    };

    const NORMALIZATION_CONFIG = {
        targetRms: 0.18,
        minGain: 0.35,
        maxGain: 1.65,
        maxSamples: 48000,
        minStride: 32,
    };
    const presetGainCache = new WeakMap();
    const computeMedian = (values) => {
        if (!Array.isArray(values) || !values.length) {
            return null;
        }
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2) {
            return sorted[mid];
        }
        return (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const computeZoneRms = (zone) => {
        if (!zone || !zone.buffer || typeof zone.buffer.getChannelData !== 'function') {
            return null;
        }
        let channelData;
        try {
            channelData = zone.buffer.getChannelData(0);
        } catch (err) {
            console.warn('Failed to read preset buffer data', err);
            return null;
        }
        if (!channelData || !channelData.length) {
            return null;
        }
        const strideBase = Math.floor(channelData.length / Math.max(1, NORMALIZATION_CONFIG.maxSamples));
        const stride = Math.max(NORMALIZATION_CONFIG.minStride, strideBase || 1);
        let sumSq = 0;
        let sampleCount = 0;
        for (let i = 0; i < channelData.length; i += stride) {
            const sample = channelData[i];
            sumSq += sample * sample;
            sampleCount++;
        }
        if (!sampleCount) {
            return null;
        }
        return Math.sqrt(sumSq / sampleCount);
    };
    const computePresetNormalizationGain = (preset) => {
        if (!preset || !Array.isArray(preset.zones) || !preset.zones.length) {
            return 1;
        }
        const visitedBuffers = new Set();
        const rmsValues = [];
        for (const zone of preset.zones) {
            const buffer = zone && zone.buffer;
            if (!buffer || visitedBuffers.has(buffer)) {
                continue;
            }
            visitedBuffers.add(buffer);
            const rms = computeZoneRms(zone);
            if (typeof rms === 'number' && Number.isFinite(rms) && rms > 0) {
                rmsValues.push(rms);
            }
        }
        if (!rmsValues.length) {
            return 1;
        }
        const medianRms = computeMedian(rmsValues);
        if (!medianRms || !Number.isFinite(medianRms) || medianRms <= 0) {
            return 1;
        }
        const rawGain = NORMALIZATION_CONFIG.targetRms / medianRms;
        return clamp(rawGain, NORMALIZATION_CONFIG.minGain, NORMALIZATION_CONFIG.maxGain);
    };
    const getPresetGainScalar = (preset) => {
        if (!preset || typeof preset !== 'object') {
            return 1;
        }
        if (presetGainCache.has(preset)) {
            return presetGainCache.get(preset);
        }
        const gain = computePresetNormalizationGain(preset);
        presetGainCache.set(preset, gain);
        return gain;
    };

    const instrumentOptions = Object.values(WebAudioFontInstruments).map(instr => ({
        id: instr.id,
        label: instr.label,
        description: instr.description,
        icon: instr.icon || '♪',
    }));

    const defaultMidiGuidance = {
        getPrepDuration: ({ defaultDuration, timeSincePrevNote }) => {
            const base = defaultDuration ?? 0.35;
            if (!timeSincePrevNote) {
                return base;
            }
            const spacing = Math.max(0.05, timeSincePrevNote / 6);
            return Math.min(base, spacing);
        },
        getHorizontalOffset: ({ string, velocity, visualWidth }) => {
            const normalizedVelocity = velocity ? Math.pow(velocity, 0.6) : 1;
            const highFreqDamping = smoothTransition(string.freq, 330, 880, 1, 0.5);
            return string.string_center.x + normalizedVelocity * visualWidth / 2 * highFreqDamping;
        },
        getVerticalOffset: ({ string, velocity, progress }) => {
            const velocityStrength = velocity ? Math.pow(velocity, 1.5) : 1;
            return string.string_center.y + Math.min(
                string.string_slack - 1,
                progress * velocityStrength * string.string_slack
            );
        },
    };

    const scriptLoadCache = {};
    const loadExternalScript = (src) => {
        if (!src) {
            return Promise.resolve();
        }
        if (!scriptLoadCache[src]) {
            scriptLoadCache[src] = new Promise((resolve, reject) => {
                if (document.querySelector(`script[data-inline-src="${src}"]`)) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = src;
                script.async = true;
                script.dataset.inlineSrc = src;
                script.onload = () => resolve();
                script.onerror = (err) => reject(err);
                document.body.appendChild(script);
            });
        }
        return scriptLoadCache[src];
    };

    const defaultInstrumentId = 'piano';
    const savedInstrumentId = typeof localStorage !== 'undefined' ? localStorage.getItem('instrument_preset') : null;
    window.instrument_preset_id = WebAudioFontInstruments[savedInstrumentId] ? savedInstrumentId : defaultInstrumentId;
    window.use_shader_audio = WebAudioFontInstruments[window.instrument_preset_id]?.engine === AudioEngines.shader;

    const getActiveInstrumentConfig = () => WebAudioFontInstruments[window.instrument_preset_id] || WebAudioFontInstruments[defaultInstrumentId];
    const isWebAudioFontActive = () => getActiveInstrumentConfig().engine === AudioEngines.waf;
    const isShaderAudioEnabled = () => getActiveInstrumentConfig().engine === AudioEngines.shader;

    window.getInstrumentOptions = () => instrumentOptions;

    let webAudioFontManagerPromise = null;
    const getWebAudioFontManager = () => {
        if (!webAudioFontManagerPromise) {
            webAudioFontManagerPromise = new Promise((resolve, reject) => {
                const AudioContextFunc = window.AudioContext || window.webkitAudioContext;
                const ensurePlayer = () => {
                    if (typeof window.WebAudioFontPlayer === 'function') {
                        try {
                            const audioCtx = new AudioContextFunc();
                            const player = new window.WebAudioFontPlayer();
                            const mixGainNode = audioCtx.createGain();
                            mixGainNode.gain.value = 1;
                            const limiterNode = audioCtx.createDynamicsCompressor();
                            limiterNode.threshold.value = -18;
                            limiterNode.knee.value = 18;
                            limiterNode.ratio.value = 8;
                            limiterNode.attack.value = 0.002;
                            limiterNode.release.value = 0.25;
                            const masterGainNode = audioCtx.createGain();
                            const baseMasterGain = 0.85;
                            const masterVolume = typeof window.getMasterVolume === 'function' ? window.getMasterVolume() : window.master_volume || DEFAULT_MASTER_VOLUME;
                            masterGainNode.gain.value = baseMasterGain * masterVolume;
                            mixGainNode.connect(limiterNode);
                            limiterNode.connect(masterGainNode);
                            masterGainNode.connect(audioCtx.destination);
                            resolve({
                                audioCtx,
                                player,
                                decodedPresets: new Set(),
                                activeVoices: new Set(),
                                currentPresetId: null,
                                outputNode: mixGainNode,
                                limiterNode,
                                masterGainNode,
                                baseMasterGain,
                            });
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        setTimeout(ensurePlayer, 50);
                    }
                };
                ensurePlayer();
            });
        }
        return webAudioFontManagerPromise;
    };

    const applyMasterVolume = (volume) => {
        const resolved = setStoredMasterVolume(volume);
        const maybeAudioShader = window.audioShader;
        if (maybeAudioShader && typeof maybeAudioShader.applyMasterVolume === 'function') {
            maybeAudioShader.applyMasterVolume(resolved);
        }
        if (webAudioFontManagerPromise) {
            webAudioFontManagerPromise.then(manager => {
                if (!manager || !manager.masterGainNode) return;
                const baseGain = typeof manager.baseMasterGain === 'number' ? manager.baseMasterGain : 0.85;
                manager.masterGainNode.gain.value = baseGain * resolved;
            }).catch(() => { });
        }
        return resolved;
    };
    window.setMasterVolume = applyMasterVolume;
    window.getMasterVolume = () => (typeof window.master_volume === 'number' ? window.master_volume : DEFAULT_MASTER_VOLUME);

    const stopAllWebAudioFontVoices = () => {
        if (!webAudioFontManagerPromise) {
            return;
        }
        webAudioFontManagerPromise.then(manager => {
            if (!manager || !manager.player) {
                return;
            }
            try {
                manager.player.cancelQueue(manager.audioCtx);
            } catch (err) {
                console.error('Failed to cancel WebAudioFont queue', err);
            }
            manager.activeVoices.clear();
        }).catch(() => { });
    };

    const activateWebAudioFontInstrument = async (instrument) => {
        const manager = await getWebAudioFontManager();
        await loadExternalScript(instrument.script);
        const presetVar = window[instrument.variable];
        if (!presetVar) {
            throw new Error(`WebAudioFont preset ${instrument.variable} missing`);
        }
        if (!manager.decodedPresets.has(instrument.variable)) {
            manager.player.loader.decodeAfterLoading(manager.audioCtx, instrument.variable);
            manager.decodedPresets.add(instrument.variable);
        }
        manager.currentPresetId = instrument.id;
        manager.currentPresetVar = presetVar;
        if (manager.audioCtx.state === 'suspended') {
            try {
                await manager.audioCtx.resume();
            } catch (err) {
                console.warn('Unable to resume WebAudioFont audio context', err);
            }
        }
        return manager;
    };

    const scheduleWebAudioFontNote = (note) => {
        if (!isWebAudioFontActive() || !note || typeof note.midi !== 'number') {
            return;
        }
        const instrument = getActiveInstrumentConfig();
        activateWebAudioFontInstrument(instrument).then(manager => {
            if (!manager || !manager.currentPresetVar) {
                return;
            }
            const velocity = typeof note.velocity === 'number' ? clamp(note.velocity, 0, 1) : 0.8;
            const durationSeconds = Math.max(0.1, note.durationSeconds || 1);
            const gainScalar = getPresetGainScalar(manager.currentPresetVar);
            const instrumentScalar = typeof instrument.volumeScalar === 'number' ? instrument.volumeScalar : 1;
            const normalizedVelocity = clamp(velocity * gainScalar * instrumentScalar, 0, 1);
            const targetNode = manager.outputNode || manager.audioCtx.destination;
            const envelope = manager.player.queueWaveTable(
                manager.audioCtx,
                targetNode,
                manager.currentPresetVar,
                manager.audioCtx.currentTime,
                note.midi,
                durationSeconds,
                normalizedVelocity
            );
            if (envelope) {
                manager.activeVoices.add(envelope);
                setTimeout(() => manager.activeVoices.delete(envelope), (durationSeconds + 2) * 1000);
            }
        }).catch(err => {
            console.error('Failed to play WebAudioFont note', err);
        });
    };

    window.playWebAudioFontPreview = (midiNumber, velocity = 0.8) => {
        if (!isWebAudioFontActive()) {
            return;
        }
        scheduleWebAudioFontNote({
            midi: midiNumber,
            velocity: clamp(velocity, 0, 1),
            durationSeconds: 1,
        });
    };

    let pendingInstrumentChange = false;
    const dispatchInstrumentChange = () => {
        if (pendingInstrumentChange) return;
        pendingInstrumentChange = true;
        requestAnimationFrame(() => {
            pendingInstrumentChange = false;
            window.dispatchEvent(new CustomEvent('instrument_changed', { detail: { instrument: getActiveInstrumentConfig() } }));
        });
    };

    const rebuildStringsForInstrumentChange = () => {
        if (!window.canvas_jq || !Array.isArray(pluckableStrings) || !pluckableStrings.length) {
            return;
        }
        const snapshot = pluckableStrings.map(s => ({
            string_center: { x: s.string_center.x, y: s.string_center.y },
            string_width: s.string_width,
            angle: s.angle,
            freq: s.freq,
            midi_number: s.midi_number,
            screen: s.screen,
        }));
        resetAndAddStrings(window.canvas_jq, snapshot, { skip_audio: false });
    };

    window.setInstrumentPreset = async (instrumentId) => {
        const targetId = WebAudioFontInstruments[instrumentId] ? instrumentId : defaultInstrumentId;
        if (window.instrument_preset_id === targetId) {
            return;
        }
        window.instrument_preset_id = targetId;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('instrument_preset', targetId);
        }
        const instrument = getActiveInstrumentConfig();
        window.use_shader_audio = instrument.engine === AudioEngines.shader;
        if (instrument.engine === AudioEngines.waf) {
            try {
                await activateWebAudioFontInstrument(instrument);
            } catch (err) {
                console.error('Failed to activate WebAudioFont instrument', err);
            }
        } else {
            stopAllWebAudioFontVoices();
        }
        rebuildStringsForInstrumentChange();
        dispatchInstrumentChange();
    };

    const getStringVisualWidth = (string) => {
        if (!string) return 0;
        if (typeof string.getVisualWidth === 'function') {
            try {
                return string.getVisualWidth({ includeDynamics: false });
            } catch (err) {
                return string.visual_width || string.string_width || 0;
            }
        }
        return string.visual_width || string.string_width || 0;
    }

    let draw_start = null
    let draw_end = null

    jQuery.event.special.touchstart = {
        setup: function (_, ns, handle) {
            this.addEventListener("touchstart", handle, { passive: false });
        }
    };
    jQuery.event.special.touchmove = {
        setup: function (_, ns, handle) {
            this.addEventListener("touchmove", handle, { passive: false });
        }
    };
    jQuery.event.special.wheel = {
        setup: function (_, ns, handle) {
            this.addEventListener("wheel", handle, { passive: false });
        }
    };
    jQuery.event.special.mousewheel = {
        setup: function (_, ns, handle) {
            this.addEventListener("mousewheel", handle, { passive: false });
        }
    };

    let midi_string_map = {};
    let midi_number_a1 = 33;

    let pluckableStrings = [];

    let width_base_freq;
    let applyLayoutModeToExistingStrings = () => { };



    function string_width_to_freq(string_width, width_base_freq) {
        if (string_width == 0) {
            return 0;
        }
        return Math.round(base_freq * width_base_freq / string_width);
    }
    function freq_to_string_width(freq, width_base_freq) {
        if (freq == 0) {
            return 0;
        }
        return base_freq * width_base_freq / freq;
    }


    const getMidiNumberFromFreq = (freq) => {
        return Math.round(12 * Math.log2(freq / 440) + 69);
    }
    const getFreqFromMidiNumber = (midi_number) => {
        return 440 * Math.pow(2, (midi_number - 69) / 12);
    }

    const hslToRgb = (h, s, l) => {
        const saturation = s / 100;
        const lightness = l / 100;

        const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const hh = (h % 360) / 60;
        const x = c * (1 - Math.abs(hh % 2 - 1));

        let rPrim = 0;
        let gPrim = 0;
        let bPrim = 0;

        if (hh >= 0 && hh < 1) {
            rPrim = c;
            gPrim = x;
        } else if (hh >= 1 && hh < 2) {
            rPrim = x;
            gPrim = c;
        } else if (hh >= 2 && hh < 3) {
            gPrim = c;
            bPrim = x;
        } else if (hh >= 3 && hh < 4) {
            gPrim = x;
            bPrim = c;
        } else if (hh >= 4 && hh < 5) {
            rPrim = x;
            bPrim = c;
        } else {
            rPrim = c;
            bPrim = x;
        }

        const m = lightness - c / 2;

        return [
            Math.round((rPrim + m) * 255),
            Math.round((gPrim + m) * 255),
            Math.round((bPrim + m) * 255),
        ];
    }

    const getRainbowColor = (index, total) => {
        if (total <= 1) {
            return hslToRgb(0, 70, 55);
        }
        const normalizedIndex = Math.max(0, Math.min(index, total - 1));
        const hue = (normalizedIndex / Math.max(1, total - 1)) * 300;
        return hslToRgb(hue, 70, 55);
    }


    const getInitialStrings = (canvas_jq) => {
        let num_strings = 56

        let initial_strings = JSON.parse(localStorage.getItem('strings')) || [];

        if (!initial_strings.length) {
            return getChordStrings(canvas_jq);
        }

        return initial_strings;
    }

    const get72strings = (canvas_jq) => {
        let num_strings = 72;
        let initial_strings = [];
        let width = canvas_jq.width();
        let height = canvas_jq.height();
        for (var i = 0; i < num_strings; i++) {
            initial_strings.push({
                string_center: { x: canvas_jq.width() / 2, y: 100 + (i + 1) * ((height - 200) / num_strings) },
                string_width: Notes.relative_note(width_base_freq, -i) * 2,
                freq: string_width_to_freq(Notes.relative_note(width_base_freq, -i) * 2, width_base_freq),
                angle: 0, // i * Math.PI / 64
            });
        }

        return initial_strings;
    }

    const getTwoFullOctaveStrings = (canvas_jq) => {
        let num_strings = 24;
        let initial_strings = [];
        let width = canvas_jq.width();
        let height = canvas_jq.height();
        for (var i = 0; i < num_strings; i++) {
            initial_strings.push({
                string_center: { x: canvas_jq.width() / 2, y: 100 + (i + 1) * ((height - 200) / num_strings) },
                string_width: Notes.relative_note(width_base_freq, -(i)),
                freq: width_base_freq / Math.pow(2, i / 12),
                angle: 0, // i * Math.PI / 64
            });
        }

        return initial_strings;

    }

    const getSpiralingStrings = (canvas_jq) => {
        // for(var i=0; i<=40; i++) {
        //     initial_strings.push({
        //         string_center: {x: canvas_jq.width()/2 + canvas_jq.width()/4, y: 100 + (i+1) * 15},
        //         string_width: Notes.relative_note(440, -i*1) * 1,
        //         angle: 0, // i * Math.PI / 64
        //     });
        // }
        // for(var i=0; i<=40; i++) {
        //     initial_strings.push({
        //         string_center: {x: canvas_jq.width()/2 - canvas_jq.width()/4, y: 100 + (i+1) * 15},
        //         string_width: Notes.relative_note(440, -i*1) * 1,
        //         angle: 0, // i * Math.PI / 64
        //     });
        // }
        let num_strings = 72
        const initial_strings = [];

        let width = canvas_jq.width();
        let height = canvas_jq.height();
        const total_angle = Math.PI * 2;
        for (var i = 0; i < num_strings; i++) {
            initial_strings.push({
                string_center: {
                    x: (width / 3) * Math.sin((total_angle * i / num_strings)) + width / 2,
                    y: (height / 3) * Math.cos((total_angle * i / num_strings)) + height / 2,
                },
                // string_center: {x: width/2, y: 100 + (i+1) * ((height-200) / num_strings)},
                //string_width: Notes.relative_note(width_base_freq, -(i % 24 + 12*Math.floor(i/24))) * 1.2 ,
                string_width: Notes.relative_note(width_base_freq * 2, -i),
                freq: width_base_freq * 2 / Math.pow(2, i / 12),
                angle: Math.PI * (3 / 4) + i * total_angle / num_strings,
            });
        }

        return initial_strings;
    }

    const getAndalusianCadence = (canvas_jq) => {
        let width = canvas_jq.width();
        let height = canvas_jq.height();
        const midi_notes = [
            // A minor (Am): A3 (57), E4 (64), A4 (69), C4 (60)
            57, 64, 69, 60,
            0,
            // G Major (G): G3 (55), D4 (62), G4 (67), B3 (59)
            55, 62, 67, 59,
            0,
            // F Major (F): F3 (53), C4 (60), F4 (65), A3 (57)
            53, 60, 65, 57,
            0,
            // E Major (E): E3 (52), B3 (59), E4 (64), G#3 (56)
            52, 59, 64, 56,
            0,
            // D minor (Dm): D3 (50), A3 (57), D4 (62), F4 (65)
            50, 57, 62, 65,
            0,
            // E Major (E): E3 (52), B3 (59), E4 (64), G#3 (56)
            52, 59, 64, 56
        ];

        const initial_strings = [];

        const num_chords = midi_notes.filter(n => n == 0).length + 1;
        const chunksize = 5;
        const max_vertical = (height - 200) / 50;
        const columns = 2
        const rows = 3

        let note_i = 0;
        for (var i = 0; i < columns; i++) {
            for (var j = 0; j < rows; j++) {
                const x = 100 + i * (width - 200) / columns;
                const y = 100 + j * (height - 200) / rows;
                const w = (width - 200) / columns;
                const h = (height - 200) / rows;

                console.log(x, y, w, h);

                for (var k = 0; k < chunksize; k++) {
                    const midi_number = midi_notes[note_i];
                    note_i++;
                    if (midi_number == 0) continue;

                    const center = (width / columns / 4) * (i / columns) + x + w / 2;
                    const top = (height / rows / 4) * (j / rows) + y + h / 2 + (k - chunksize / 2) * h / chunksize;

                    const note_offset = midi_number - midi_number_a1;
                    initial_strings.push({
                        string_center: { x: center, y: top },
                        //string_width: Notes.relative_note(width_base_freq, -(i % 24 + 12*Math.floor(i/24))) * 1.2 ,
                        string_width: Notes.relative_note(width_base_freq * 2, -note_offset),
                        freq: getFreqFromMidiNumber(midi_number),
                        angle: 0, // i * Math.PI / 64
                        midi_number,
                    });
                }
            }
        }

        return initial_strings;
    }


    const getCanonChordStrings = (canvas_jq) => {

        let width = canvas_jq.width();
        let height = canvas_jq.height();
        const midi_notes = [
            // D Major (D): D4 (62), A4 (69), D5 (74), F#4 (66)
            62, 69, 74, 66,
            0,
            // A Major (A): A3 (57), E4 (64), A4 (69), C#4 (61)
            57, 64, 69, 61,
            0,
            // B minor (Bm): B3 (59), F#4 (66), B4 (71), D4 (62)
            59, 66, 71, 62,
            0,
            // F# minor (F#m): F#3 (54), C#4 (61), F#4 (66), A3 (57)
            54, 61, 66, 57,
            0,
            // G Major (G): G3 (55), D4 (62), G4 (67), B3 (59)
            55, 62, 67, 59,
            0,
            // D Major (D): D3 (50), A3 (57), D4 (62), F#3 (54)
            50, 57, 62, 54,
            0,
            // G Major (G): G3 (55), D4 (62), G4 (67), B3 (59)
            55, 62, 67, 59,
            0,
            // A Major (A): A3 (57), E4 (64), A4 (69), C#4 (61)
            57, 64, 69, 61
        ];
        const initial_strings = [];

        const num_chords = midi_notes.filter(n => n == 0).length + 1;
        const chunksize = 5;
        const max_vertical = (height - 200) / 50;
        const columns = 3
        const rows = 3


        const start_y = height / 15;

        let note_i = 0;
        for (var i = 0; i < columns; i++) {
            for (var j = 0; j < rows; j++) {
                const x = start_y + i * (width - start_y * 2) / columns;
                const y = start_y + j * (height - start_y * 2) / rows;
                const w = (width - start_y * 2) / columns;
                const h = (height - start_y * 2) / rows;

                console.log(x, y, w, h);

                for (var k = 0; k < chunksize; k++) {
                    const midi_number = midi_notes[note_i];
                    note_i++;
                    if (midi_number == 0) continue;

                    const center = (width / columns / 4) * (i / columns) + x + w / 2;
                    const top = (height / rows / 4) * (j / rows) + y + h / 2 + (k - chunksize / 2) * h / chunksize;

                    const note_offset = midi_number - midi_number_a1;
                    initial_strings.push({
                        string_center: { x: center, y: top },
                        //string_width: Notes.relative_note(width_base_freq, -(i % 24 + 12*Math.floor(i/24))) * 1.2 ,
                        string_width: Notes.relative_note(width_base_freq * 2, -note_offset),
                        freq: getFreqFromMidiNumber(midi_number),
                        angle: 0, // i * Math.PI / 64
                        midi_number,
                    });
                }
            }
        }

        return initial_strings;
    }



    const getChordStrings = (canvas_jq) => {

        let width = canvas_jq.width();
        let height = canvas_jq.height();
        // C, G, Am, F chords
        const midi_notes = [
            // C major
            48,
            52,
            55,
            60,
            64,

            0,
            // G major
            55,
            59,
            62,
            67,
            71,
            0,
            // A minor
            57,
            60,
            64,
            69,
            72,

            0,
            // F major
            53,
            57,
            60,
            65,
            69,

            0,

        ]
        const initial_strings = [];

        const num_chords = midi_notes.filter(n => n == 0).length + 1;
        const chunksize = 6;
        const max_vertical = (height - 200) / 50;
        const columns = 2
        const rows = 2

        let note_i = 0;
        for (var i = 0; i < columns; i++) {
            for (var j = 0; j < rows; j++) {
                const x = 100 + i * (width - 200) / columns;
                const y = 100 + j * (height - 200) / rows;
                const w = (width - 200) / columns;
                const h = (height - 200) / rows;

                for (var k = 0; k < chunksize; k++) {
                    const midi_number = midi_notes[note_i];
                    note_i++;
                    if (midi_number == 0) continue;

                    const center = (width / columns / 4) * (i / columns) + x + w / 2;
                    const top = (height / rows / 4) * (j / rows) + y + h / 2 + (k - chunksize / 2) * h / chunksize;

                    const note_offset = midi_number - midi_number_a1;
                    initial_strings.push({
                        string_center: { x: center, y: top },
                        //string_width: Notes.relative_note(width_base_freq, -(i % 24 + 12*Math.floor(i/24))) * 1.2 ,
                        string_width: Notes.relative_note(width_base_freq * 2, -note_offset),
                        freq: getFreqFromMidiNumber(midi_number),
                        angle: 0, // i * Math.PI / 64
                        midi_number,
                    });
                }
            }
        }

        return initial_strings;
    }

    const getMidiNoteStrings = (canvas_jq, midi_numbers) => {

        let filled_in_midi_numbers = [];
        let min_midi_number = undefined;
        let max_midi_number = undefined;
        for (let i = 0; i < midi_numbers.length; i++) {
            if (min_midi_number === undefined) {
                min_midi_number = midi_numbers[i];
            }
            if (max_midi_number === undefined) {
                max_midi_number = midi_numbers[i];
            }
            min_midi_number = Math.min(min_midi_number, midi_numbers[i]);
            max_midi_number = Math.max(max_midi_number, midi_numbers[i]);
        }
        for (let i = min_midi_number; i <= max_midi_number; i++) {
            filled_in_midi_numbers.push(i);
        }

        let width = canvas_jq.width();
        let height = canvas_jq.height();
        const initial_strings = [];
        const start_y = height / 15;
        for (var i = 0; i < filled_in_midi_numbers.length; i++) {
            const midi_number = filled_in_midi_numbers[i];
            if (midi_number == 0) continue;

            const center = width / 2;
            const top = start_y + (i + 1) * ((height - start_y * 2) / filled_in_midi_numbers.length);

            const note_offset = midi_number - midi_number_a1;
            initial_strings.push({
                string_center: { x: center, y: top },
                //string_width: Notes.relative_note(width_base_freq, -(i % 24 + 12*Math.floor(i/24))) * 1.2 ,
                string_width: Notes.relative_note(width_base_freq * 2, -note_offset),
                freq: getFreqFromMidiNumber(midi_number),
                angle: 0,
                midi_number,
            });
        }

        return initial_strings;
    }


    const resetAndAddStrings = async function (canvas_jq, strings, options = { skip_audio: false }) {
        let width = canvas_jq.width();
        let height = canvas_jq.height();

        const num_strings = strings.length;
        const num_overtones = 12;

        if (options.skip_audio) {
            // console.log('skipping audio')
        } else {
            if (window.audioShader) {
                await window.audioShader.destroy();
                window.audioShader = null;
            }
            if (isShaderAudioEnabled()) {
                window.audioShader = new AudioShader(num_strings, num_overtones);
                window.audioShader.setup_audio();
                if (typeof window.setMasterVolume === 'function') {
                    window.setMasterVolume(window.getMasterVolume());
                }
            }
        }

        pluckableStrings.length = 0;

        midi_string_map = {};

        const resolvedCenters = strings.map((string) => {
            if (!string.string_center) {
                return { x: width / 2, y: height / 2 };
            }
            if (!string.screen || !string.screen.width || !string.screen.height) {
                return { x: string.string_center.x, y: string.string_center.y };
            }
            return {
                x: width * string.string_center.x / string.screen.width,
                y: height * string.string_center.y / string.screen.height,
            };
        });

        const sortedByHeight = resolvedCenters
            .map((center, idx) => ({ idx, y: center ? center.y : 0 }))
            .sort((a, b) => a.y - b.y);

        const colorOrders = new Array(strings.length);
        sortedByHeight.forEach(({ idx }, orderIdx) => {
            colorOrders[idx] = orderIdx;
        });

        const layoutMode = getLayoutMode();
        const uniform_display_width = width * 0.7;

        const preparedStrings = [];
        let midi_min = Infinity;
        let midi_max = -Infinity;
        const shaderAudio = isShaderAudioEnabled() ? window.audioShader : null;

        for (let i = 0; i < strings.length; i++) {
            const string = strings[i];
            const overtones = [];
            if ((!string.string_width && !string.freq) || !string.string_center) {
                console.error('string_width or freq or string_center missing', i, string);
                continue;
            }
            let freq = string.freq ? parseInt(string.freq) : parseInt(base_freq * width_base_freq / string.string_width);
            let string_width = freq_to_string_width(freq, width_base_freq);

            for (let j = 0; j < num_overtones; j++) {
                overtones.push({ freq: (j + 1) * freq, amplitude: 1 });
            }
            const midi_number = getMidiNumberFromFreq(freq);
            let { note, error } = Notes.freq_to_note(freq);
            const sustainDuration = 5000;

            const string_center = resolvedCenters[i];
            string.string_center = string_center;

            const color_order = typeof colorOrders[i] === 'number' ? colorOrders[i] : i;
            const string_color = typeof window.getThemeColor === 'function'
                ? window.getThemeColor(color_order, strings.length)
                : getRainbowColor(i, strings.length);

            midi_min = Math.min(midi_min, midi_number);
            midi_max = Math.max(midi_max, midi_number);

            preparedStrings.push({
                id: i,
                freq,
                midi_number,
                note,
                note_micro_offset: error,
                overtones,
                wave_height: 50,
                string_width,
                string_center,
                angle: string.angle,
                color: string_color,
                source_string: string,
                color_order,
                color_total: strings.length,
                duration: sustainDuration,
            });
        }

        const midi_range = {
            min: Number.isFinite(midi_min) ? midi_min : undefined,
            max: Number.isFinite(midi_max) ? midi_max : undefined,
        };

        preparedStrings.forEach((config) => {
            const {
                source_string,
                duration: preparedDuration,
                ...rest
            } = config;
            const slack_freq = parseFloat(source_string.freq || rest.freq);
            const computed_slack = slack_freq ? Math.min(20, Math.max(8, 10000 / slack_freq)) : 12;

            const drawWave = new pluckableString({
                ...rest,
                canvas: canvas_jq.get(0),
                duration: preparedDuration,
                audio: shaderAudio,
                string_slack: computed_slack,
                screen: { width, height },
                layout: {
                    mode: layoutMode,
                    uniformWidth: uniform_display_width,
                    midiRange: midi_range,
                },
            });
            pluckableStrings.push(drawWave);
            midi_string_map[rest.midi_number] = drawWave;
            source_string.screen = { width, height };
            if (!source_string.freq) {
                source_string.freq = rest.freq;
            }
            source_string.string_width = rest.string_width;
        });

        pluckableStrings.forEach(s => s.draw_still());

        window.NOTE_FONT = Math.min(15, parseInt(height / pluckableStrings.length)) + "px Arial";

        window.dispatchEvent(new CustomEvent('strings_loaded', { detail: { strings: pluckableStrings } }));

        localStorage.setItem('strings', JSON.stringify(strings));

    }
    window.snap_to_note = true;
    $(document).ready(function () {
        // on blur, go into idle
        // on focus, resume
        window.idle = false;
        $(window).focus(function () {
            window.idle = false;
        });
        // create a drawing area inside an element

        var canvas_jq = new Canvas($('#draw').empty());
        window.canvas_jq = canvas_jq;


        let canvas_offset = canvas_jq.offset();
        let width = canvas_jq.width();
        let height = canvas_jq.height();
        let resize_timeout;
        $(window).resize(function () {
            if (resize_timeout) {
                clearTimeout(resize_timeout);
            }
            resize_timeout = setTimeout(() => {
                setCanvasSize(canvas_jq, window.innerWidth, window.innerHeight);
                const old_width_base_freq = width_base_freq;
                const old_width = width;
                const old_height = height;

                width = canvas_jq.width();
                height = canvas_jq.height();
                // reset and add strings

                width_base_freq = Math.min(width * 0.95, 1000);

                // resetAndAddStrings(canvas_jq, pluckableStrings.map(s => { return { string_center: s.string_center, string_width: s.string_width, angle: s.angle, freq: s.freq, screen: s.screen } }), { skip_audio: true });
                for (let string of pluckableStrings) {
                    string.screen = { width, height };
                    string.string_width = string.string_width * width / old_width;
                    string.string_center.x = string.string_center.x * width / old_width;
                    string.string_center.y = string.string_center.y * height / old_height;
                    if (typeof string.updateVisualPosition === 'function') {
                        string.updateVisualPosition({ includeDynamics: false });
                    } else {
                        string.string_position.x = string.string_center.x - string.string_width / 2;
                        string.string_position.y = string.string_center.y;
                    }
                }
                applyLayoutModeToExistingStrings(getLayoutMode());
            }, 100)
        });

        width_base_freq = Math.min(width * 0.95, 1000);

        const initial_strings = getInitialStrings(canvas_jq);

        var canvas = canvas_jq.get(0);
        var context = canvas.getContext("2d");

        const getCurrentMidiRange = () => {
            const midi_numbers = pluckableStrings.map(s => s.midi_number).filter(n => typeof n === 'number');
            if (!midi_numbers.length) {
                return { min: undefined, max: undefined };
            }
            return {
                min: Math.min(...midi_numbers),
                max: Math.max(...midi_numbers),
            };
        };

        applyLayoutModeToExistingStrings = (mode = getLayoutMode()) => {
            const midi_range = getCurrentMidiRange();
            const uniformWidth = width * 0.7;
            pluckableStrings.forEach((string) => {
                if (typeof string.setLayoutOptions === 'function') {
                    string.setLayoutOptions({
                        mode,
                        uniformWidth,
                        midiRange: midi_range,
                    });
                    if (typeof string.updateVisualPosition === 'function') {
                        string.updateVisualPosition({ includeDynamics: false });
                    }
                }
            });
        };

        window.addEventListener('layout_mode_changed', (event) => {
            applyLayoutModeToExistingStrings(event.detail?.mode || getLayoutMode());
        });

        const fill_styles_per_mode = {
            [CanvasModes.pluck]: "rgba(0, 0, 0, 1.0)",
            [CanvasModes.draw]: "rgba(0, 50, 0, 1.0)",
            [CanvasModes.erase]: "rgba(50, 0, 0, 1.0)",
            [CanvasModes.move]: "rgba(0, 0, 50, 1.0)",
        }
        context.fillStyle = "rgba(0, 0, 0, 1.0)";
        context.lineWidth = 2;
        context.strokeStyle = "#fff";

        resetAndAddStrings(canvas_jq, initial_strings);
        applyLayoutModeToExistingStrings(getLayoutMode());


        function start_drawing() {
            window.canvas_mode = CanvasModes.draw;
        }
        function stop_drawing() {
            window.canvas_mode = CanvasModes.pluck;
            finish_drawing_string({ restart_audio: true });
        }

        function finish_drawing_string({ restart_audio = false } = {}) {
            let newStrings = pluckableStrings.map(s => { return { string_center: s.string_center, string_width: s.string_width, angle: s.angle } });

            if (window.canvas_mode == CanvasModes.draw && draw_start) {
                let offsetStart = draw_start;
                let offsetEnd = draw_end;
                let string_center = { x: offsetStart.x + (offsetEnd.x - offsetStart.x) / 2, y: offsetStart.y + (offsetEnd.y - offsetStart.y) / 2 };

                let string_width = Math.sqrt(Math.pow(offsetEnd.x - offsetStart.x, 2) + Math.pow(offsetEnd.y - offsetStart.y, 2))

                let freq = string_width_to_freq(string_width, width_base_freq);

                if (window.snap_to_note) {
                    let snap_freq = Notes.note_to_freq(Notes.freq_to_note(freq).note);
                    string_width = freq_to_string_width(snap_freq, width_base_freq);
                    freq = snap_freq;
                }

                let string = {
                    string_center,
                    string_width,
                    freq,
                    angle: Math.atan2(offsetEnd.y - offsetStart.y, offsetEnd.x - offsetStart.x),
                    screen: { width, height },
                }

                newStrings.push(string);
            }

            resetAndAddStrings(canvas_jq, newStrings, { skip_audio: !restart_audio });
        }

        function finish_erasing_string() {
            const erase_distance = 10;

            if (window.canvas_mode == CanvasModes.erase && draw_start) {
                let offsetStart = draw_start;
                let offsetEnd = draw_end;

                const distance = Math.sqrt(Math.pow(offsetEnd.x - offsetStart.x, 2) + Math.pow(offsetEnd.y - offsetStart.y, 2));
                const num_hops = Math.ceil(distance / erase_distance);

                const string_ids_to_erase = [];
                for (let i = 0; i < num_hops; i++) {
                    const offsetX = offsetStart.x + (offsetEnd.x - offsetStart.x) * i / num_hops;
                    const offsetY = offsetStart.y + (offsetEnd.y - offsetStart.y) * i / num_hops;

                    for (let j = 0; j < pluckableStrings.length; j++) {
                        const string = pluckableStrings[j];


                        const angledOffset = rotate_coordinates_for_string(string, offsetX, offsetY);
                        const angledOffsetX = angledOffset.x;
                        const angledOffsetY = angledOffset.y;

                        const visualWidth = getStringVisualWidth(string);
                        if (angledOffset.x > string.string_position.x && angledOffset.x < string.string_position.x + visualWidth && angledOffset.y > string.string_position.y - erase_distance && angledOffset.y < string.string_position.y + erase_distance) {
                            string_ids_to_erase.push(j);
                        }
                    }
                }
                let newStrings = pluckableStrings.filter((s, i) => !string_ids_to_erase.includes(i)).map(s => { return { string_center: s.string_center, string_width: s.string_width, angle: s.angle } });

                if (newStrings.length < pluckableStrings.length) {
                    resetAndAddStrings(canvas_jq, newStrings, { skip_audio: window.canvas_mode != CanvasModes.pluck });
                }
            }

        }

        let moving_string;
        let moving_string_edge;
        const move_grab_distance = 20;
        canvas_jq.on('mousedown touchstart', (e) => {
            e.preventDefault();

            if (window.canvas_mode == CanvasModes.draw || window.canvas_mode == CanvasModes.erase) {
                const { offsetX, offsetY } = click_or_touch_coordinates(e);
                draw_start = { x: offsetX, y: offsetY };
                draw_end = { x: offsetX, y: offsetY };
            } else if (window.canvas_mode == CanvasModes.move) {
                const { offsetX, offsetY } = click_or_touch_coordinates(e);
                draw_start = { x: offsetX, y: offsetY };
                draw_end = { x: offsetX, y: offsetY };

                // if cursor is on a string, set it as moving
                for (let string of pluckableStrings) {
                    const visualWidth = getStringVisualWidth(string);
                    const angledOffset = rotate_coordinates_for_string(string, offsetX, offsetY);
                    if (angledOffset.x > string.string_position.x - move_grab_distance && angledOffset.x < string.string_position.x + visualWidth + move_grab_distance && angledOffset.y > string.string_position.y - move_grab_distance && angledOffset.y < string.string_position.y + move_grab_distance) {
                        moving_string = string;
                        moving_string.moving = true;
                        // if cursor is near the ends of the string
                        if (Math.abs(angledOffset.x - string.string_position.x) < move_grab_distance) {
                            moving_string_edge = 'left';
                            // console.log('left', angledOffset.x, string.string_position.x)
                        } else if (Math.abs(angledOffset.x - (string.string_position.x + visualWidth)) < move_grab_distance) {
                            moving_string_edge = 'right';
                            // console.log('right', angledOffset.x, string.string_position.x + string.string_width)
                        }
                        window.hovered_string = string;
                    }
                }
            }
        })
        canvas_jq.on('mouseup touchend touchcancel', (e) => {
            e.preventDefault();
            if (draw_start) {
                if (window.canvas_mode == CanvasModes.draw) {
                    finish_drawing_string();
                } else if (window.canvas_mode == CanvasModes.erase) {
                    finish_erasing_string();
                } else if (window.canvas_mode == CanvasModes.move) {
                    if (moving_string) {
                        moving_string.moving = false;
                        moving_string = undefined;
                        // resetAndAddStrings(canvas_jq, pluckableStrings.map(s => { return { string_center: s.string_center, string_width: s.string_width, angle: s.angle, freq: s.freq } }), { skip_audio: true });
                    }
                    moving_string = undefined;
                    moving_string_edge = undefined;
                }
                draw_start = null
                draw_end = null
            }
            window.hovered_string = undefined;
        })
        $(document).on('mousemove touchmove', (e) => {
            if (draw_start) {
                if ((window.canvas_mode == CanvasModes.draw || window.canvas_mode == CanvasModes.erase)) {
                    const offset = click_or_touch_coordinates(e);
                    draw_end.y = offset.offsetY;
                    draw_end.x = offset.offsetX;
                } else if (window.canvas_mode == CanvasModes.move) {
                    const offset = click_or_touch_coordinates(e);
                    draw_end.y = offset.offsetY;
                    draw_end.x = offset.offsetX;
                    if (moving_string) {
                        const moved_x = draw_end.x - draw_start.x;
                        const moved_y = draw_end.y - draw_start.y;
                        if (moving_string_edge == 'left' || moving_string_edge == 'right') {
                            const angle_drawend_to_string_center = Math.atan2(draw_end.y - moving_string.string_center.y, draw_end.x - moving_string.string_center.x)
                            moving_string.angle = angle_drawend_to_string_center - (moving_string_edge == 'left' ? Math.PI : 0);
                        } else {
                            moving_string.string_center.x += moved_x;
                            moving_string.string_center.y += moved_y;

                            if (typeof moving_string.updateVisualPosition === 'function') {
                                moving_string.updateVisualPosition({ includeDynamics: false });
                            } else {
                                moving_string.string_position.x = moving_string.string_center.x - moving_string.string_width / 2;
                                moving_string.string_position.y = moving_string.string_center.y;
                            }
                        }
                    }
                    draw_start.x = draw_end.x;
                    draw_start.y = draw_end.y;
                }

            } else if (window.canvas_mode == CanvasModes.move) {
                // window.hovered_string = undefined;
                const offset = click_or_touch_coordinates(e);
                let new_hover = false;
                for (let string of pluckableStrings) {
                    const visualWidth = getStringVisualWidth(string);
                    const angledOffset = rotate_coordinates_for_string(string, offset.offsetX, offset.offsetY);
                    if (angledOffset.x > string.string_position.x - move_grab_distance && angledOffset.x < string.string_position.x + visualWidth + move_grab_distance && angledOffset.y > string.string_position.y - move_grab_distance && angledOffset.y < string.string_position.y + move_grab_distance) {
                        if (window.hovered_string) {
                            const hoveredStringAngledOffset = rotate_coordinates_for_string(window.hovered_string, offset.offsetX, offset.offsetY);
                            const distance1 = Math.abs(hoveredStringAngledOffset.y - window.hovered_string.string_position.y)
                            const distance2 = Math.abs(angledOffset.y - string.string_position.y)
                            if (distance1 >= distance2) {
                                // dont change hovered string
                                window.hovered_string = string;
                                new_hover = true;
                            }
                        } else {
                            window.hovered_string = string;
                            new_hover = true;
                        }
                    }
                }
                if (!new_hover) {
                    window.hovered_string = undefined;
                }
            }
        })



        let start_time;
        let note_index = 0;
        let pluck_index = 0;
        let midi_track;
        let notes;
        window.midi_paused = true;
        const MIDI_PAUSE_EVENT = 'midi_pause_changed';
        function setMidiPaused(paused) {
            const nextValue = !!paused;
            window.midi_paused = nextValue;
            window.dispatchEvent(new CustomEvent(MIDI_PAUSE_EVENT, { detail: { paused: nextValue } }));
            if (nextValue) {
                stopAllWebAudioFontVoices();
            }
        }
        window.setMidiPaused = setMidiPaused;

        let speed = 1;
        const DEFAULT_PLUCK_DURATION = 0.35;

        let notes_map = {}
        let notes_map_cursors = {}

        let midiDrivenByAudio = false;
        window.setMidiSchedulerSource = function (source) {
            midiDrivenByAudio = (source === 'audio');
        }

        let last_frame_time_ms = Date.now();
        let note_last_frame_ms = Date.now();
        let midi_progress_time = 0;
        let note_time_current = 0;
        const COLOR_MOTION_SPEED_DEG_PER_SEC = 90;
        const COLOR_MOTION_SPEED_DEG_PER_MS = COLOR_MOTION_SPEED_DEG_PER_SEC / 1000;
        let colorThemePhaseInternal = window.color_theme_phase || 0;

        async function set_remote_midi_track(url) {
            console.log('fetching midi', url);
            let midi_file = await fetch(url).then(r => r.arrayBuffer());
            // sate to blob
            let midi_blob = new Blob([midi_file], { type: 'audio/midi' });
            // create a URL for the blob
            let midi_url = URL.createObjectURL(midi_blob);
            // use tonejs to load the midi file
            let midi_json = await Midi.fromUrl(midi_url);


            midi_json.name = url.replace('./midis/', '').replace('.mid', '').replace('/', ': ');

            // console.log(midi_json);
            // set_midi_track(midi_json);
            return midi_json;
        }

        function set_midi_track(new_midi_track) {
            setMidiPaused(true);
            start_time = Date.now();
            note_last_frame_ms = Date.now();
            note_time_current = 0;

            // reset all current plucks
            pluckableStrings.forEach(s => {
                s.reset_pluck_offsets()
                s.stop_sound()
            });

            console.log('playing midi track', new_midi_track);
            if (new_midi_track.header.ticksPerBeat) {
                speed = 1 / (new_midi_track.header.ticksPerBeat / 480);
                console.log('speed', speed, new_midi_track.header.ticksPerBeat);
            }

            note_index = 0;
            midi_track = new_midi_track;
            notes = [];
            notes_map = {}
            notes_map_cursors = {}

            midi_track.tracks.forEach((t, i) => {
                t.notes.forEach(n => {
                    if (n.midi) {
                        notes.push(n);
                    }
                })
            })
            notes.sort((a, b) => a.time - b.time);


            notes.forEach(note => {
                note.time += 1; // leave time for pluck
                const durationFromMidi = typeof note.duration === 'number'
                    ? note.duration
                    : (typeof note.durationTicks === 'number' && midi_track.header && midi_track.header.ticksPerBeat
                        ? note.durationTicks / midi_track.header.ticksPerBeat
                        : 0.6);
                note.durationSeconds = Math.max(0.05, durationFromMidi);
                if (!notes_map[note.midi]) {
                    notes_map[note.midi] = [];
                    notes_map_cursors[note.midi] = 0;
                }
                notes_map[note.midi].push(note);
            })

            for (let note_key in notes_map) {
                let prev_note = undefined;
                for (let i = 0; i < notes_map[note_key].length; i++) {
                    let note = notes_map[note_key][i];
                    if (prev_note && note.time - prev_note.time < 0.05) {
                        notes_map[note_key][i] = undefined;
                    }
                    prev_note = note;
                }
                notes_map[note_key] = notes_map[note_key].filter(n => n);
            }
            notes = Object.values(notes_map).flat();
            notes.sort((a, b) => a.time - b.time);

            // check if all velocities are the same, and set them to random if so
            let velocities_obj = {};
            notes.map(n => velocities_obj[n.velocity.toString()] = n.velocity);
            if (Object.keys(velocities_obj).length < 3) {
                console.log('most notes have same velocity of', velocities_obj)
                notes.forEach(n => n.velocity = 0.3 + Math.random() * 0.7)
            }

            const midi_strings = getMidiNoteStrings(canvas_jq, Object.keys(notes_map));
            // check if every existing string matches the new midi strings
            const stringsMatchCurrentLayout = () => {
                if (pluckableStrings.length !== midi_strings.length) return false;
                return midi_strings.every(s => pluckableStrings.some(p => Math.abs((p.freq || 0) - (s.freq || 0)) < 1e-6));
            };
            if (!stringsMatchCurrentLayout()) {
                resetAndAddStrings(canvas_jq, midi_strings, { skip_audio: false });
            }

            if (window.midi_start_timer) {
                clearTimeout(window.midi_start_timer);
            }
            window.midi_start_timer = setTimeout(() => {
                setMidiPaused(false);
                start_time = Date.now();
                note_last_frame_ms = Date.now();
                note_time_current = 0;

                const midi_length_seconds = Math.max(...notes.map(n => n.time));
                const midi_track_name = midi_track.name;
                setMidiPaused(false);
                const event = new CustomEvent('midi_loaded', { detail: { midi_length_seconds: midi_length_seconds, midi_track_name: midi_track_name } });
                window.dispatchEvent(event);
            }, 100)
        };

        const FALLBACK_FRAME_INTERVAL_MS = 100;
        let fallbackFrameIntervalId = null;

        const startFallbackFrameLoop = () => {
            if (fallbackFrameIntervalId) return;
            fallbackFrameIntervalId = setInterval(() => {
                frame();
            }, FALLBACK_FRAME_INTERVAL_MS);
        };

        const stopFallbackFrameLoop = () => {
            if (fallbackFrameIntervalId) {
                clearInterval(fallbackFrameIntervalId);
                fallbackFrameIntervalId = null;
            }
        };

        function advanceMidi(deltaSeconds = 0) {
            if (deltaSeconds < 0) deltaSeconds = 0;
            if (window.midi_paused) {
                return;
            }

            const scaledDelta = deltaSeconds * speed;
            note_time_current += scaledDelta;
            const midiBehavior = defaultMidiGuidance;

            Object.keys(notes_map_cursors).forEach(midi_num => {
                let cursor = notes_map_cursors[midi_num];
                let note = notes_map[midi_num][cursor];
                if (note) {
                    let plucking_string = midi_string_map[note.midi]
                    if (plucking_string) {
                        const prev_note = notes_map[midi_num][cursor - 1];
                        const timeSincePrevNote = prev_note ? note.time - prev_note.time : undefined;
                        const desiredPrepDuration = midiBehavior && typeof midiBehavior.getPrepDuration === 'function'
                            ? midiBehavior.getPrepDuration({
                                defaultDuration: DEFAULT_PLUCK_DURATION,
                                timeSincePrevNote,
                            })
                            : defaultMidiGuidance.getPrepDuration({
                                defaultDuration: DEFAULT_PLUCK_DURATION,
                                timeSincePrevNote,
                            });
                        const _pluck_duration = Math.max(0.05, desiredPrepDuration || DEFAULT_PLUCK_DURATION);

                        let pluck_time = Math.max((plucking_string.prev_note_time || 0), note.time - _pluck_duration);

                        if (note_time_current >= pluck_time) {
                            const visualWidth = getStringVisualWidth(plucking_string);
                            const velocity = typeof note.velocity === 'number' ? clamp(note.velocity, 0, 1) : 1;
                            const horizontalGuide = midiBehavior && midiBehavior.getHorizontalOffset ? midiBehavior : defaultMidiGuidance;
                            const computedOffsetX = horizontalGuide.getHorizontalOffset({
                                string: plucking_string,
                                velocity,
                                visualWidth,
                            });
                            const rawOffsetX = Number.isFinite(computedOffsetX) ? computedOffsetX : plucking_string.string_center.x;
                            const halfWidth = visualWidth / 2;
                            const minX = plucking_string.string_center.x - halfWidth;
                            const maxX = plucking_string.string_center.x + halfWidth;
                            const offsetX = visualWidth > 0 ? clamp(rawOffsetX, minX + 1, maxX - 1) : plucking_string.string_center.x;

                            let progress = _pluck_duration > 0 ? (note_time_current - pluck_time) / _pluck_duration : 0.5;
                            const normalizedProgress = clamp(progress, 0, 1);
                            const verticalGuide = midiBehavior && midiBehavior.getVerticalOffset ? midiBehavior : defaultMidiGuidance;
                            const computedOffsetY = verticalGuide.getVerticalOffset({
                                string: plucking_string,
                                velocity,
                                progress: normalizedProgress,
                            });
                            const offsetY = Number.isFinite(computedOffsetY) ? computedOffsetY : plucking_string.string_center.y;
                            plucking_string.set_pluck_offsets(offsetX, offsetY);
                        }
                    }
                }
            })

            let note = notes[note_index];
            while (note && note_time_current >= note.time) {
                let string = midi_string_map[note.midi];

                if (string) {
                    string.pluck();
                    string.prev_note_time = note.time;
                }
                scheduleWebAudioFontNote(note);
                note_index++;
                notes_map_cursors[note.midi]++;

                if (note_index >= notes.length) {
                    setMidiPaused(true);
                    break;
                }
                note = notes[note_index];
            }
        }

        window.advanceMidiFromAudio = (deltaSeconds) => {
            midiDrivenByAudio = true;
            advanceMidi(deltaSeconds);
        };

        let frame = () => {
            if (window.idle) {
                return;
            }

            context.fillStyle = fill_styles_per_mode[window.canvas_mode];

            context.fillRect(0, 0, context.width, context.height);


            // pluckableStrings.forEach(s => {
            //     if (s.playing) s.draw()
            //     else if (s.plucking) s.draw_pluck();
            //     else s.draw_still();
            // });

            // draw non-plucking strings first:
            pluckableStrings.forEach(s => {
                if (!s.plucking) {
                    if (!s.playing) s.draw_still();
                }
            });
            const timeOrderedPluckableStrings = pluckableStrings.filter(s => !s.plucking).sort((a, b) => {
                //let progress = (this.duration - this.time_diff) / this.duration;
                // sort by playing strings last, which are then ordered by progress property
                if (!a.playing && !b.playing) {
                    return 0;
                }
                if (a.playing && !b.playing) {
                    return 1;
                } else if (!a.playing && b.playing) {
                    return -1;
                }
                const progress_a = a.duration - a.time_diff;
                const progress_b = b.duration - b.time_diff;
                return progress_a - progress_b;
            })
            timeOrderedPluckableStrings.forEach(s => {
                if (!s.plucking) {
                    if (s.playing) s.draw()
                }
            });
            pluckableStrings.forEach(s => {
                if (s.plucking) s.draw_pluck();
            });



            if (!start_time) {
                start_time = Date.now();
            }

            const now = Date.now();
            const frame_delta = now - note_last_frame_ms;
            const max_frame_delta = 100;
            const clamped_delta = Math.min(frame_delta, max_frame_delta);
            if (window.color_motion_enabled) {
                colorThemePhaseInternal = (colorThemePhaseInternal + clamped_delta * COLOR_MOTION_SPEED_DEG_PER_MS) % 360;
            }
            window.color_theme_phase = colorThemePhaseInternal;
            if (!midiDrivenByAudio) {
                advanceMidi(clamped_delta / 1000);
            }

            note_last_frame_ms = now;
            last_frame_time_ms = now;

            if ((window.canvas_mode == CanvasModes.draw || window.canvas_mode == CanvasModes.erase) && draw_start && draw_end) {
                let string_width = Math.sqrt(Math.pow(draw_end.x - draw_start.x, 2) + Math.pow(draw_end.y - draw_start.y, 2))
                if (string_width > 0) {
                    if (window.canvas_mode == CanvasModes.draw) {
                        context.strokeStyle = "#ffa";
                    } else if (window.canvas_mode == CanvasModes.erase) {
                        context.strokeStyle = "#f00";
                    }
                    context.beginPath();
                    context.moveTo(draw_start.x, draw_start.y);
                    context.lineTo(draw_end.x, draw_end.y);
                    context.stroke();

                    const label_finger_offset = {
                        x: -10,
                        y: -50,
                    }

                    if (draw_end.y < 100) {
                        label_finger_offset.y = 50;
                    }

                    if (window.canvas_mode == CanvasModes.draw) {
                        let freq = string_width_to_freq(string_width, width_base_freq);
                        let { note, error } = Notes.freq_to_note(freq);
                        context.save();
                        context.fillStyle = "#fff";
                        context.font = "20px Arial";
                        context.fillText(note, draw_end.x + label_finger_offset.x, draw_end.y + label_finger_offset.y);

                        if (!window.snap_to_note) {
                            context.font = "10px Arial"
                            context.fillText((error < 0 ? '-' : error > 0 ? '+' : '') + error.toFixed(2) + 'hz', draw_end.x + label_finger_offset.x, draw_end.y + label_finger_offset.y + 10);
                        }
                        context.restore();
                    }
                    if (window.canvas_mode == CanvasModes.erase) {
                        context.save();
                        context.fillStyle = "#f00";
                        context.font = "20px Arial";
                        context.fillText("Erase", draw_end.x - 30, draw_end.y + label_finger_offset.y);
                        context.restore();
                    }
                }


            }


            /*
            for (let coordinate of Object.values(touchInstances)) {
                // draw circle where touch is if in pluck mode
                if (window.canvas_mode == CanvasModes.pluck) {
                    context.save();
                    context.beginPath();
                    context.arc(coordinate.x, coordinate.y, 5, 0, 2 * Math.PI, false);
                    context.fillStyle = '#ffffff44';
                    context.fill();
                    context.restore();
                }
            }
            */
        }

        const rafLoop = () => {
            frame();
            requestAnimationFrame(rafLoop);
        };
        requestAnimationFrame(rafLoop);


        let touchInstances = {};

        setTimeout(() => {
            window.started = true
        }, 100)
        frame();


        function click_or_touch_coordinates(e) {
            let x, y;
            if (e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel') {
                var touch = e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
                x = touch.pageX;
                y = touch.pageY;
            } else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover' || e.type == 'mouseout' || e.type == 'mouseenter' || e.type == 'mouseleave') {
                x = e.clientX;
                y = e.clientY;
            }

            let offsetX = Math.min(Math.max(x - canvas_jq.offset().left, 10), canvas_jq.width() - 10)
            let offsetY = Math.min(Math.max(y - canvas_jq.offset().top, 1), canvas_jq.height())
            return { offsetX, offsetY };
        }

        let always_pluck = false;
        let prev_cursor;

        $(window).blur(function () {
            //strings.forEach(s => s.stop_sound());
            //init()
            touchInstances = {};
        });
        $(document).on('mouseout', function (event) {
            if (!event.relatedTarget) {
                touchInstances = {};
            }
        });


        let auto_pluck_distance = 5;

        let rotate_coordinates_for_string = function (string, offsetX, offsetY) {
            return {
                x: string.string_center.x + (offsetX - string.string_center.x) * Math.cos(-string.angle) - (offsetY - string.string_center.y) * Math.sin(-string.angle),
                y: string.string_center.y + (offsetX - string.string_center.x) * Math.sin(-string.angle) + (offsetY - string.string_center.y) * Math.cos(-string.angle),
            }
        }

        let cursor_move_handler = function (touch) {
            const { id, x, y, prevX, prevY, startX, startY } = touch;
            const offsetX = x;
            const offsetY = y;


            pluckableStrings.forEach(string => {
                const angledOffset = rotate_coordinates_for_string(string, offsetX, offsetY);
                const angledOffsetX = angledOffset.x;
                const angledOffsetY = angledOffset.y;
                const prevAngledOffset = rotate_coordinates_for_string(string, prevX, prevY);
                const prevAngledOffsetX = prevAngledOffset.x;
                const prevAngledOffsetY = prevAngledOffset.y;
                if (string.hand_plucking && string.pluck_source.id === id) {
                    string.set_pluck_offsets(angledOffsetX, angledOffsetY)
                } else {
                    if (always_pluck) {
                        // if prev->current line crosses string
                        const visualWidth = getStringVisualWidth(string);
                        if ((angledOffsetY - string.string_center.y) * (prevAngledOffsetY - string.string_center.y) <= 0 && angledOffsetX > string.string_center.x - visualWidth / 2 && angledOffsetX < string.string_center.x + visualWidth / 2) {
                            if (!string.hand_plucking) {
                                string.hand_plucking = true;
                                string.pluck_source = touch;
                                string.stop_sound()
                            }
                            string.set_pluck_offsets(angledOffsetX, angledOffsetY);
                        }
                    }
                    // if (always_pluck) {
                    //     if (angledOffset.x > string.string_position.x && angledOffset.x < string.string_position.x + string.string_width && angledOffset.y > string.string_position.y - auto_pluck_distance && angledOffset.y < string.string_position.y + auto_pluck_distance) {

                    //         if (string.hand_plucking) {
                    //             string.set_pluck_offsets(angledOffsetX, angledOffsetY)
                    //         } else {
                    //             string.set_pluck_offsets(angledOffsetX, angledOffsetY);
                    //             string.hand_plucking = true;
                    //             string.pluck_source = touch;
                    //             string.stop_sound()
                    //         }

                    //     }
                    // }
                }
            });
        }

        let idle_timeout;

        window.idle = false;
        function handleClickOrTouchEvents(event) {

            if (idle_timeout) {
                clearTimeout(idle_timeout);
                window.idle = false;
            }
            idle_timeout = setTimeout(() => {
                if (window.midi_paused) {
                    window.idle = true;
                }
            }, 15000);


            if (window.canvas_mode !== CanvasModes.pluck) {
                return;
            }
            if (!window.started) {
                return
            }
            event.preventDefault();
            event.stopPropagation();
            let eventType;
            let coordinates;

            if ((event.type == "click" || event.type === 'touchstart' || event.type === 'mousedown')) {
                if (window.audioShader) {
                    window.audioShader.resume();
                } else {
                    console.log('no audio shader', window.audioShader)
                }
            }

            switch (event.type) {
                case 'touchstart':
                case 'touchmove':
                case 'touchend':
                case 'touchcancel':
                    eventType = 'touch';
                    coordinates = Array.from(event.changedTouches).map(touch => {
                        const x = touch.clientX;
                        const y = touch.clientY;
                        let offsetX = Math.min(Math.max(x - canvas_offset.left, 10), width - 10)
                        let offsetY = Math.min(Math.max(y - canvas_offset.top, 1), height)
                        return { id: touch.identifier, x, y }
                    });
                    break;
                case 'mousedown':
                case 'mousemove':
                case 'mouseup':
                    eventType = 'mouse';
                    coordinates = [{ id: 'mouse', x: event.clientX, y: event.clientY }];
                    break;
                default:
                    return;
            }

            for (const coordinate of coordinates) {
                const touch = touchInstances[coordinate.id];

                if (event.type === 'touchend' || event.type === 'mouseup' || event.type === 'touchcancel') {
                    if (touch) {
                        touch.end = true;
                    }
                } else {
                    if (!touch) {
                        touchInstances[coordinate.id] = {
                            id: coordinate.id,
                            prevX: coordinate.x,
                            prevY: coordinate.y,
                            x: coordinate.x,
                            y: coordinate.y,
                            startX: coordinate.x,
                            startY: coordinate.y,
                        };
                    } else {
                        touch.prevX = touch.x;
                        touch.prevY = touch.y;
                        touch.x = coordinate.x;
                        touch.y = coordinate.y;
                    }
                }
            }

            if (event.type === 'touchstart' || event.type === 'mousedown') {
                always_pluck = true;
                Object.values(touchInstances).filter(ti => ti.x && ti.y).forEach(touch => {
                    cursor_move_handler(touch);
                })
            }
            if (event.type === 'touchend' || event.type === 'mouseup' || event.type === 'touchcancel') {
                Object.values(touchInstances).filter(ti => ti.end).forEach(touch => {
                    pluckableStrings.forEach(string => {
                        if (string.hand_plucking && string.pluck_source && string.pluck_source.id === touch.id) {

                            const angledOffset = rotate_coordinates_for_string(string, touch.prevX, touch.prevY);
                            string.pluck(angledOffset.x, angledOffset.y);
                        }
                    });
                    delete touchInstances[touch.id];
                })

                if (Object.values(touchInstances).length === 0) {
                    always_pluck = false;
                }
            }
            if (event.type === 'touchmove' || event.type === 'mousemove') {

                Object.values(touchInstances).filter(ti => ti.x && ti.y).forEach(touch => {
                    const { x, y } = touch;
                    const prev_cursor = touch.prevX && touch.prevY ? { x: touch.prevX, y: touch.prevY } : undefined;
                    if (prev_cursor) {
                        let distance = Math.sqrt(Math.pow(x - prev_cursor.x, 2) + Math.pow(y - prev_cursor.y, 2));
                    }
                    cursor_move_handler(touch);
                })
            }

        }

        ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mousemove', 'mouseup'].forEach(eventName => {
            canvas.addEventListener(eventName, handleClickOrTouchEvents, { passive: false });
        });

        const pick_svg = html`<svg style="width: 20px;height: 15px;" xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 1079.000000 1280.000000" preserveAspectRatio="xMidYMid meet">
<metadata>
Created by potrace 1.15, written by Peter Selinger 2001-2017
</metadata>
<g transform="translate(0.000000,1280.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
<path d="M4830 12794 c-935 -43 -1710 -175 -2430 -414 -733 -243 -1301 -570 -1720 -990 -400 -400 -620 -857 -671 -1390 -15 -160 1 -536 32 -775 80 -608 384 -1553 856 -2660 909 -2132 2275 -4560 3245 -5774 436 -544 765 -812 970 -788 401 48 1423 1247 2635 3092 1645 2505 2917 5066 2998 6035 3 41 14 131 23 200 26 191 23 516 -7 683 -66 378 -206 687 -459 1017 -87 113 -350 374 -487 484 -137 109 -410 292 -575 384 -863 481 -1994 781 -3310 877 -200 15 -923 27 -1100 19z"/>
</g>
</svg>`

        function hashStringToRGBA(str) {
            // Hash function to convert string to a numerical value
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }

            // Generate RGBA values
            const r = (hash >> 24) & 0xFF;
            const g = (hash >> 16) & 0xFF;
            const b = (hash >> 8) & 0xFF;
            const a = 0.3;

            return `rgba(${r}, ${g}, ${b}, ${a})`;
        }


        const DivCustomClick = (props) => {
            const { onClick, ...rest } = props;

            const handleMouseDown = (event) => {
                if (onClick) onClick(event);
                event.preventDefault();
            };

            const handleTouchStart = (event) => {
                if (onClick) onClick(event);
                event.preventDefault();
            };

            return html`
                    <div
                        ...${rest}
                        onMouseDown=${handleMouseDown}
                        onTouchStart=${handleTouchStart}
                    />
                `;
        };

        class Controls extends Component {
            constructor() {
                super();
                this.state = {
                    canvas_mode: window.canvas_mode,
                    snap_to_note: window.snap_to_note,
                    layout_mode: getLayoutMode(),
                    show_presets: false,
                    show_midi_player: true,
                    midis: [],
                    speed: 50,
                    midi_progress_percentage: 0,
                    midi_length_seconds: 0,
                    color_theme: window.color_theme,
                    color_motion_enabled: window.color_motion_enabled,
                    instrument_loading: null,
                    instrument_preset_id: window.instrument_preset_id,
                    playing: false,
                    midi_paused: window.midi_paused,
                    show_main_menu: false,
                    show_info: false,
                    theme: localStorage.getItem('theme') || 'dark',
                    master_volume: (typeof window.getMasterVolume === 'function'
                        ? window.getMasterVolume()
                        : (typeof window.master_volume === 'number' ? window.master_volume : DEFAULT_MASTER_VOLUME)),
                }
                // Apply initial theme
                document.documentElement.setAttribute('data-theme', this.state.theme);
                // Defer updateThemeColors to ensure plucker.js is ready and DOM is updated
                setTimeout(() => {
                    if (window.updateThemeColors) window.updateThemeColors();
                }, 0);
            }
            componentDidMount() {
                window.addEventListener('keydown', (e) => {
                    // if (e.shiftKey) {
                    //     start_drawing();
                    //     this.setState({ canvas_mode: CanvasModes.draw });
                    // }
                })
                const exitDrawingIfDrawMode = () => {
                    if (window.canvas_mode == CanvasModes.draw) {
                        finish_drawing_string();
                        stop_drawing();
                        this.setState({ canvas_mode: CanvasModes.pluck });
                    }
                }
                window.addEventListener('keyup', (e) => {
                    // exitDrawingIfDrawMode();
                })
                const resumeAudioIfNeeded = () => {
                    if (window.audioShader) {
                        window.audioShader.resume();
                    }
                }

                window.addEventListener('visibilitychange', () => {
                    exitDrawingIfDrawMode();
                    resumeAudioIfNeeded();
                    if (document.visibilityState === 'hidden') {
                        startFallbackFrameLoop();
                    } else {
                        stopFallbackFrameLoop();
                    }
                })
                window.addEventListener('blur', () => {
                    exitDrawingIfDrawMode();
                    resumeAudioIfNeeded();
                })
                window.addEventListener('focus', () => {
                    exitDrawingIfDrawMode();
                    resumeAudioIfNeeded();
                })
                window.addEventListener('midi_loaded', (e) => {
                    this.setState({ midi_length_seconds: e.detail.midi_length_seconds, midi_track_name: e.detail.midi_track_name });
                })
                window.addEventListener('strings_loaded', (e) => {
                    this.setState({ show_main_menu: false });
                })
                this.layoutModeListener = (e) => {
                    this.setState({ layout_mode: e.detail?.mode || getLayoutMode() });
                };
                window.addEventListener('layout_mode_changed', this.layoutModeListener);
                this.colorThemeListener = (e) => {
                    this.setState({ color_theme: e.detail?.themeId || window.color_theme });
                };
                window.addEventListener('color_theme_changed', this.colorThemeListener);
                this.colorMotionListener = (e) => {
                    const enabled = typeof e.detail?.enabled === 'boolean' ? e.detail.enabled : window.color_motion_enabled;
                    this.setState({ color_motion_enabled: enabled });
                };
                window.addEventListener('color_motion_changed', this.colorMotionListener);
                this.instrumentListener = (e) => {
                    const instrumentId = e.detail?.instrument?.id || window.instrument_preset_id;
                    this.setState({ instrument_preset_id: instrumentId });
                };
                window.addEventListener('instrument_changed', this.instrumentListener);
                this.midiPauseListener = (e) => {
                    const paused = typeof e.detail?.paused === 'boolean' ? e.detail.paused : window.midi_paused;
                    this.setState({ midi_paused: paused });
                };
                window.addEventListener(MIDI_PAUSE_EVENT, this.midiPauseListener);

                const initialVolume = typeof window.getMasterVolume === 'function'
                    ? window.getMasterVolume()
                    : this.state.master_volume;
                if (typeof window.setMasterVolume === 'function') {
                    window.setMasterVolume(initialVolume);
                }

                // load midi list from midis/midis.json
                fetch('midis/midis.json').then(r => r.json()).then(midis => {
                    // midis is object with folder as key
                    const new_midis = Object.keys(midis).map(folder => {
                        return midis[folder].map(midi => {
                            return `${folder}/${midi}`
                        })
                    }).flat();
                    this.setState({ midis: new_midis });
                })
            }
            componentWillUnmount() {
                if (this.layoutModeListener) {
                    window.removeEventListener('layout_mode_changed', this.layoutModeListener);
                }
                if (this.colorThemeListener) {
                    window.removeEventListener('color_theme_changed', this.colorThemeListener);
                }
                if (this.colorMotionListener) {
                    window.removeEventListener('color_motion_changed', this.colorMotionListener);
                }
                if (this.midiPauseListener) {
                    window.removeEventListener(MIDI_PAUSE_EVENT, this.midiPauseListener);
                }
                if (this.instrumentListener) {
                    window.removeEventListener('instrument_changed', this.instrumentListener);
                }
            }


            render() {
                const touch_device = 'ontouchstart' in document.documentElement;
                const preset_slugs = JSON.parse(localStorage.getItem('preset_slugs')) || [];
                const presets = preset_slugs.map(slug => JSON.parse(localStorage.getItem('preset:' + slug)));
                const { show_main_menu, show_info, layout_mode, midi_paused } = this.state;

                const grouped_midis = this.state.midis.reduce((acc, cur) => {
                    const folder = cur.split('/')[0];
                    if (!acc[folder]) {
                        acc[folder] = [];
                    }
                    acc[folder].push(cur);
                    return acc;
                }, {});
                const colorThemeOptions = (typeof window.getColorThemeOptions === 'function'
                    ? window.getColorThemeOptions()
                    : Object.values(window.ColorThemes || {}).map(theme => ({ id: theme.id, label: theme.label })));
                const instrumentOptions = (typeof window.getInstrumentOptions === 'function'
                    ? window.getInstrumentOptions()
                    : []);
                const currentColorTheme = this.state.color_theme || window.color_theme || 'white';
                const colorMotionEnabled = typeof this.state.color_motion_enabled === 'boolean' ? this.state.color_motion_enabled : !!window.color_motion_enabled;
                const currentInstrumentId = this.state.instrument_preset_id || window.instrument_preset_id || defaultInstrumentId;
                const instrumentLoadingId = this.state.instrument_loading;
                const colorThemeIds = colorThemeOptions.map(option => option.id);
                const colorThemePreviewStyle = {
                    background: getColorThemePreviewStyle(currentColorTheme),
                };
                const currentColorThemeLabel = colorThemeOptions.find(option => option.id === currentColorTheme)?.label || 'Color Theme';
                const instrumentIds = instrumentOptions.map(option => option.id);
                const currentInstrument = instrumentOptions.find(option => option.id === currentInstrumentId);
                const currentInstrumentTitle = currentInstrument ? currentInstrument.label : 'Instrument';
                const currentInstrumentIcon = currentInstrument ? currentInstrument.icon : '♪';
                const layoutModeTitle = layout_mode === LayoutModes.classic ? 'String shape: Long to Short' : 'String shape: Uniform Pulse';
                const masterVolume = typeof this.state.master_volume === 'number'
                    ? this.state.master_volume
                    : (typeof window.getMasterVolume === 'function' ? window.getMasterVolume() : DEFAULT_MASTER_VOLUME);
                const volumePercent = Math.round(masterVolume * 100);
                const displayedTrackName = truncateTrackName(this.state.midi_track_name, 50);

                return html`
                            <div class='controls-top-right'>
                                ${this.state.playing ? html`
                                    <div class='section' id='midi-player'>
                                        ${this.state.playing ? html`
                                            <div class='midi-progress-bar'>
                                                <span class='midi-progress-bar-fill' style='width: ${this.state.midi_progress_percentage}%'></span>
                                                ${' '}${displayedTrackName} [${Math.round(this.state.midi_length_seconds / 60)}:${Math.round(this.state.midi_length_seconds % 60).toString().padStart(2, '0')}]
                                                ${' '}
                                            </div>
                                        ` : html``}
                                        <span class='spacer'></span>
                                        <input type='range' class='speed-slider' min='0' max='100' value='${this.state.speed}' oninput=${(e) => {
                            // cast 0:100 to 0.1:10
                            const val = (e.target.value < 50) ? (0.5 + e.target.value / 100) : 2 * (e.target.value - 50) / 100 + 1;
                            this.setState({ speed: e.target.value });
                            speed = val;
                        }} />
                                        <span class='speed-reset' onClick=${e => {
                            this.setState({ speed: 50 })
                            speed = 1;
                        }}>${(speed).toFixed(2)}x speed</span>
                                        <div class='volume-control volume-inline' title=${`Volume: ${volumePercent}%`}>
                                            <span class='volume-icon' aria-hidden='true'>🔊</span>
                                            <input
                                                type='range'
                                                min='0'
                                                max='150'
                                                step='1'
                                                class='volume-slider'
                                                value=${volumePercent}
                                                aria-label='Master volume'
                                                onInput=${(e) => {
                            const percent = parseInt(e.target.value, 10);
                            const scalar = clamp(percent / 100, 0, 1.5);
                            const applied = typeof window.setMasterVolume === 'function'
                                ? window.setMasterVolume(scalar)
                                : scalar;
                            this.setState({ master_volume: applied });
                        }}
                                            />
                                        </div>
                                        <span class='spacer'></span>
                                        <div class='item midi-pause-button' onClick=${() => {
                            const currentlyPaused = !!window.midi_paused;
                            if (currentlyPaused) {
                                if (window.audioShader) {
                                    window.audioShader.resume();
                                }
                                setMidiPaused(false);
                            } else {
                                setMidiPaused(true);
                            }
                        }}>
                                            ${midi_paused ? "▶ Continue" : "⏸ Pause"}
                                        </div>
                                        <div class='item' onClick=${async () => {
                            if (!this.state.playing) {
                                const midi_file = this.state.selected_midi;
                                const midi_json = await set_remote_midi_track("./midis/" + midi_file);
                                set_midi_track(midi_json);
                                this.setState({ playing: true });
                            } else {
                                this.setState({ playing: false });
                                // stop plucking all strings
                                pluckableStrings.forEach(s => s.reset_pluck_offsets());
                                setMidiPaused(true);
                            }
                        }}>
                                            ${this.state.playing ? "▧ Stop" : "▶️ Play"}
                                        </div>
                                    </div>
                                ` : html``}
                                <!--
                                    <div class='item' onClick=${() => {
                        this.setState({ show_midi_player: !this.state.show_midi_player });
                    }}>
                                        ${this.state.show_midi_player ? 'Hide' : '🎵 MIDI Player'}
                                    </div>
                                -->
                            </div>

                            <div class='controls-top-left'>
                                <${DivCustomClick} class='item toggle' onClick=${() => {
                        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
                        this.setState({ theme: newTheme });
                        document.documentElement.setAttribute('data-theme', newTheme);
                        localStorage.setItem('theme', newTheme);
                        if (window.updateThemeColors) window.updateThemeColors();

                        // Force redraw of strings to pick up new colors
                        if (pluckableStrings) {
                            pluckableStrings.forEach(s => s.draw_still());
                        }
                    }}>
                                    ${this.state.theme === 'dark' ? '🌙' : '☀️'}
                                </${DivCustomClick}>

                                <${DivCustomClick} class='item toggle ${show_info ? '' : ''}' onClick=${() => {

                        this.setState({ show_info: !show_info });
                    }}>
                                        ${show_info ? `ⓧ` : html`<span class='infotoggle'>❓</span>`}
                                </${DivCustomClick}>

                                <div class='minimal-control-bar'>
                                    <button
                                        type='button'
                                        class='control-icon-button color-theme-icon'
                                        title=${`Color theme: ${currentColorThemeLabel}. Click to cycle.`}
                                        aria-label='Cycle color theme'
                                        onClick=${() => {
                        if (!colorThemeIds.length) {
                            return;
                        }
                        const nextTheme = getNextListValue(colorThemeIds, currentColorTheme);
                        window.setColorTheme(nextTheme);
                        this.setState({ color_theme: nextTheme });
                    }}
                                    >
                                        <span class='color-theme-swatch' style=${colorThemePreviewStyle}></span>
                                    </button>

                                    <button
                                        type='button'
                                        class=${`control-icon-button color-motion-icon ${colorMotionEnabled ? 'active' : ''}`}
                                        title=${`Color motion: ${colorMotionEnabled ? 'On' : 'Off'}`}
                                        aria-pressed=${colorMotionEnabled}
                                        aria-label='Toggle color motion'
                                        onClick=${() => {
                        const nextValue = !colorMotionEnabled;
                        window.setColorMotionEnabled(nextValue);
                        this.setState({ color_motion_enabled: nextValue });
                    }}
                                    >
                                        <span class='color-motion-glyph'></span>
                                    </button>

                                    ${instrumentOptions.length ? html`
                                        <button
                                            type='button'
                                            class=${`control-icon-button instrument-icon ${instrumentLoadingId ? 'loading' : ''}`}
                                            title=${`${currentInstrumentTitle}${instrumentLoadingId ? ' (loading...)' : ''}`}
                                            aria-label='Cycle instrument'
                                            onClick=${async () => {
                            if (!instrumentOptions.length || instrumentLoadingId) {
                                return;
                            }
                            const nextInstrumentId = getNextListValue(instrumentIds, currentInstrumentId);
                            this.setState({ instrument_loading: nextInstrumentId });
                            try {
                                await window.setInstrumentPreset(nextInstrumentId);
                                this.setState({ instrument_preset_id: nextInstrumentId });
                            } finally {
                                this.setState({ instrument_loading: null });
                            }
                        }}
                                        >
                                            ${instrumentLoadingId ? html`<span class='control-spinner'></span>` : html`<span class='instrument-glyph'>${currentInstrumentIcon}</span>`}
                                        </button>
                                    ` : html``}

                                    <button
                                        type='button'
                                        class=${`control-icon-button string-shape-icon ${layout_mode === LayoutModes.uniform ? 'uniform' : 'classic'}`}
                                        title=${layoutModeTitle}
                                        aria-label='Toggle string layout'
                                        onClick=${() => {
                        const nextLayout = layout_mode === LayoutModes.classic ? LayoutModes.uniform : LayoutModes.classic;
                        setLayoutMode(nextLayout);
                        this.setState({ layout_mode: nextLayout });
                    }}
                                    >
                                        <span class='string-shape-lines'>
                                            <span class='line'></span>
                                            <span class='line'></span>
                                            <span class='line'></span>
                                        </span>
                                    </button>
                                </div>

                                ${show_info ? html`
                                    <div class='info-panel'>
                                        <div class='info-inner'>
                                            <h1>Pluck</h1>
                                            <p style='opacity: 0.6; font-style: italic;'>by Murat</p> 
                                            <p style='font-size: 1.2em; font-weight: bold; color: rgba(104, 33, 204, 1);'>A math-based string simulator. </p>
                                            <p style='font-size: 1.2em; font-weight: bold;'>Both the audio and visuals are generated using the same math, rendered at different speeds so the eye can see.
                                            </p>
                                            <p>No tricks or audio files are used: everything is calculated from raw sine waves, with a theory of how energy is released in a pluck.</p>
                                            <ul>
                                                <li>The vibrations are modeled based on how far down the string you pluck from.  </li>
                                                <li>The velocity of midi notes are mapped to both pluck position, as well as pluck strength. </li>
                                            </ul>
                                            <p>
                                                This YouTube video of a slow motion string pluck proves that our simulated result is very close to reality.
                                                <br />
                                                <iframe width="350" height="180" style="margin: 10px;" src="https://www.youtube.com/embed/LNNQvG0jWtw?si=DZa9TS3TdcURpwbF" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                                            </p>
                                            <p>
                                                Technical details:
                                                <ul>
                                                    <li>Each string is simulated with 12 overtones (integer multiples of the note frequency) </li>
                                                    <li>To calculate amplitude of each overtone, we take the Fourier transform of the plucked string at the time the pick is released </li>
                                                    <li>Higher frequency overtones decay faster than lower frequency overtones </li>
                                                    <li>72 strings ⅹ 12 overtones ⅹ 44,100 samples per second = 52,920,000 calculations per second </li>
                                                    <li>Audio buffer of 1024 samples are sent to the GPU to compute in parallel on each tick</li>
                                                </ul>
                                            </p>
                                            <p>
                                                There are several directions I can take this project from here:
                                                <ol>
                                                    <li>Turn it into an interactive educational tool to teach physics of sound, timbre & music. </li>
                                                    <li>Turn it into a music learning tool for kids where songs are pre-made as chords that the user can pluck to learn rhythm and feel. </li>
                                                    <li>Turn it into an interactive art installation</li> 
                                                    <li>Turn it into a game where i.e. a bouncing ball plucks the strings & you try to match the melody</li>
                                                </ol>
                                                If you are interested in any of the above, please get in touch at <a href='mailto:murat@ayfer.net'>murat@ayfer.net</a> or <a href='https://twitter.com/mayfer'>@mayfer</a>.
                                            </p>
                                        </div>

                                    </div>
                                ` : html``}
                            </div>

                            
                            <div class='controls-bottom-left'>
                                <div class='controls-bottom-left-flex'>
                                    <${DivCustomClick} class='item toggle ${show_main_menu ? '' : ''}' onClick=${() => {
                        this.setState({ show_main_menu: !show_main_menu });
                    }}>
                                            ${show_main_menu ? `ⓧ` : `♫`}
                                    </${DivCustomClick}>
                                </div>
                            </div>

                            ${show_main_menu ? html`
                                <div class='main-menu-modal'>

                                    <h2>String presets</h2>
                                    <div id='presets'>
                                        <div class='presets-list'>

                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, get72strings(canvas_jq));
                        }}>
                                                <div class='preset-name'>72 strings</div>
                                            </div>

                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, getSpiralingStrings(canvas_jq));
                        }}>
                                                <div class='preset-name'>Spiral harp</div>
                                            </div>

                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, getTwoFullOctaveStrings(canvas_jq));
                        }}>
                                                <div class='preset-name'>2 octaves</div>
                                            </div>

                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, getChordStrings(canvas_jq));
                        }}>
                                                <div class='preset-name'>I–V–vi–IV Chords</div>
                                            </div>


                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, getCanonChordStrings(canvas_jq));
                        }}>
                                                <div class='preset-name'>Canon Chords</div>
                                            </div>

                                            <div class='track-item' onClick=${() => {
                            resetAndAddStrings(canvas_jq, getAndalusianCadence(canvas_jq));
                        }}>
                                                <div class='preset-name'>Andalusian Chords</div>
                                            </div>

                                            ${presets.map(preset => html`
                                                <div class='track-item user-preset' onClick=${() => {
                                resetAndAddStrings(canvas_jq, preset.strings);
                            }}>
                                                    <div class='preset-name'>${preset.name}</div>
                                                </div>
                                            `)}
                                        </div>
                                    </div>

                                    <h2>MIDI tracks</h2>
                                    <div class='pick-midi-track' id='midi-player'>
                                        ${Object.keys(grouped_midis).sort().map(folder => {
                                // use folder title to seed random color
                                const color = hashStringToRGBA("salt" + folder);
                                return html`
                                                <div class='track-artist' style='background: ${color}'>
                                                    <h3>${folder}</h3>
                                                    ${grouped_midis[folder].map(midi => {
                                    const track_name = midi.split('/').pop().replace(/\.mid$/, '');
                                    const featured_tracks = [
                                        'Gymnopedie No. 1',
                                        'Gymnopedie No. 3',
                                        'Clair de Lune',
                                        'Hungarian Rhapsody No. 2',
                                        'La Campanella',
                                        'Fugue BWV 578',
                                        'Moonlight Sonata (3rd movement)',
                                        'Piano Sonata No. 13',
                                        'Suite No. 1, Morning Mood',
                                        'Christmastime is Here',
                                        'Polonaise Op. 53',
                                    ]
                                    const featured = featured_tracks.includes(track_name);
                                    return html`
                                                            <div>
                                                            <div class='track-item ${featured ? 'featured' : ''}' onClick=${async e => {
                                            const midi_file = midi;
                                            this.setState({ selected_midi: midi_file, show_main_menu: false });

                                            const midi_json = await set_remote_midi_track("./midis/" + midi_file);
                                            set_midi_track(midi_json);
                                            this.setState({ playing: true });
                                        }}>${track_name}</div>
                                                            </div>
                                                        `
                                })}
                                                </div>
                                            `
                            })}
                                    </div>
                                    <p>The tracks marked with ⭐️ are author's picks.</p>
                                </div>
                            ` : html``}
                        `
            }
        }
        render(html`<${Controls} />`, document.getElementById('controls'))
    });
})();
