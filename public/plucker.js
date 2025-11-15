X_INCREMENT = 5;

const COLOR_PLUCKING = [185, 130, 225];
const COLOR_PLUCKED = [255, 255, 255];
const COLOR_IDLE = [40, 40, 40];
const COLOR_DRAW = [150, 185, 150];
const COLOR_MOVE = [90, 90, 155];
const COLOR_ERASE = [245, 215, 215];
const COLOR_HOVER = [255, 255, 255];

const mixColors = (colorA, colorB, amount) => {
    const t = Math.max(0, Math.min(1, amount));
    return [
        Math.round(colorA[0] + (colorB[0] - colorA[0]) * t),
        Math.round(colorA[1] + (colorB[1] - colorA[1]) * t),
        Math.round(colorA[2] + (colorB[2] - colorA[2]) * t),
    ];
};

const dimColor = (color, factor = 0.5) => {
    const clampFactor = Math.max(0, Math.min(1, factor));
    return [
        Math.round(color[0] * clampFactor),
        Math.round(color[1] * clampFactor),
        Math.round(color[2] * clampFactor),
    ];
};

const colorToRgba = (color, alpha = 1) => {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
};
window.NOTE_FONT = "15px Arial";

function drawRoundedPolygon(ctx,
    x,
    y,
    radius,
    rotation,
    cornerPercent,
    shadowBlur,
    color,
    numberOfCorners) {


    function getPolygonCorner(index, numberOfCorners) {
        const angle = (index + 0.5) * 2 * Math.PI / numberOfCorners
        return [Math.sin(angle), Math.cos(angle)]
    }

    function lerp(p1, p2, t) {
        return [p1[0] * (1 - t) + p2[0] * (t),
        p1[1] * (1 - t) + p2[1] * (t)]
    }

    ctx.save()
    ctx.translate(x, y)
    ctx.scale(radius, radius)
    ctx.rotate(rotation * Math.PI / 180)
    ctx.beginPath()

    const corners = []

    for (let i = 0; i < numberOfCorners; i++)
        corners.push(getPolygonCorner(i, numberOfCorners))

    for (let i = 0; i < numberOfCorners; i++) {

        const prevCorner = corners[(i + 0) % numberOfCorners]
        const thisCorner = corners[(i + 1) % numberOfCorners]
        const nextCorner = corners[(i + 2) % numberOfCorners]

        const q1 = lerp(thisCorner, prevCorner, cornerPercent / 200)
        const q2 = lerp(thisCorner, nextCorner, cornerPercent / 200)

        ctx.lineTo(q1[0], q1[1]);
        ctx.quadraticCurveTo(thisCorner[0], thisCorner[1], q2[0], q2[1])
    }

    ctx.closePath();
    ctx.shadowBlur = shadowBlur
    ctx.shadowColor = 'black'
    ctx.shadowOffsetX = ctx.shadowOffsetY = 0
    ctx.fillStyle = color
    ctx.fill();
    ctx.restore()
}

function pluckableString({
    id,
    canvas,
    freq,
    midi_number,
    overtones,
    wave_height,
    string_width,
    string_center,
    angle,
    duration,
    audio,
    string_slack,
    screen,
    color,
    layout = {},
    color_order,
    color_total,
    instrumentPreset,
    instrumentOptions = {},
}) {
    this.audio = audio;
    this.overtones = overtones; // {freq, amplitude}
    this.id = id;
    this.freq = freq;
    this.note_name = Notes.freq_to_note(freq).note;
    this.midi_number = midi_number;
    this.screen = screen;

    this.context = canvas.getContext("2d");
    this.lineWidth = 3;
    if (window.innerWidth > 600) {
        this.lineWidth = 3;
    }
    if (window.innerWidth > 1000) {
        this.lineWidth = 4;
    }
    if (window.innerWidth > 1400) {
        this.lineWidth = 5;
    }
    this.context.lineWidth = this.lineWidth;

    this.wave_height = wave_height;
    this.wave_halfheight = this.wave_height / 2;
    this.center = this.wave_halfheight;

    this.angle = angle;

    this.duration = duration;

    this.string_center = string_center;
    this.string_width = string_width;
    this.string_position = { x: string_center.x - string_width / 2, y: string_center.y };
    this.string_height = wave_height;
    this.base_color = color || COLOR_IDLE;
    this.default_color = this.base_color;
    this.color_order = typeof color_order === 'number' ? color_order : undefined;
    this.color_total = typeof color_total === 'number' ? color_total : undefined;
    this.getThemeBaseColor = function() {
        if (typeof window.getThemeColor === 'function' && typeof this.color_order === 'number' && typeof this.color_total === 'number') {
            return window.getThemeColor(this.color_order, this.color_total);
        }
        return this.default_color;
    }
    this.layout = {
        mode: layout.mode || (window.layout_mode || (window.LayoutModes ? window.LayoutModes.classic : 'classic')),
        uniformWidth: typeof layout.uniformWidth === 'number' ? layout.uniformWidth : string_width,
        midiRange: layout.midiRange || { min: midi_number, max: midi_number },
    };

    this.setLayoutOptions = function(options = {}) {
        if (options.mode && window.LayoutModes && Object.values(window.LayoutModes).includes(options.mode)) {
            this.layout.mode = options.mode;
        }
        if (typeof options.uniformWidth === 'number') {
            this.layout.uniformWidth = options.uniformWidth;
        }
        if (options.midiRange) {
            this.layout.midiRange = options.midiRange;
        }
    }

    this.instrumentOptionsSeed = instrumentOptions || {};
    this.instrumentPreset = instrumentPreset || null;
    this.instrumentOvertoneMultipliers = new Array(this.overtones.length).fill(1);
    this.instrumentDecayBase = undefined;
    this.applyInstrumentPreset = function(preset, options = {}) {
        const resolvedPreset = preset || null;
        this.instrumentPreset = resolvedPreset;
        if (resolvedPreset && typeof resolvedPreset.getOvertoneGain === 'function') {
            for (let i = 0; i < this.overtones.length; i++) {
                const gain = resolvedPreset.getOvertoneGain(i, this.overtones[i].freq, { baseFreq: this.base_freq, string: this });
                this.instrumentOvertoneMultipliers[i] = Math.max(0.02, gain || 1);
            }
        } else {
            for (let i = 0; i < this.instrumentOvertoneMultipliers.length; i++) {
                this.instrumentOvertoneMultipliers[i] = 1;
            }
        }
        if (options && typeof options.duration === 'number' && options.duration > 0) {
            this.duration = options.duration;
        }
        this.instrumentDecayBase = options && typeof options.decayPower === 'number' ? options.decayPower : undefined;
    };
    this.getInstrumentOvertoneGain = function(index) {
        if (typeof index !== 'number') return 1;
        return this.instrumentOvertoneMultipliers[index] ?? 1;
    };

    this.getVisualWidth = function({ includeDynamics = false } = {}) {
        const layoutMode = this.layout.mode || (window.LayoutModes ? window.LayoutModes.classic : 'classic');
        let baseWidth = layoutMode === (window.LayoutModes ? window.LayoutModes.uniform : 'uniform')
            ? (this.layout.uniformWidth || this.string_width)
            : this.string_width;

        if (layoutMode === (window.LayoutModes ? window.LayoutModes.uniform : 'uniform') && includeDynamics) {
            const midiRange = this.layout.midiRange || {};
            const minMidi = typeof midiRange.min === 'number' ? midiRange.min : this.midi_number;
            const maxMidi = typeof midiRange.max === 'number' ? midiRange.max : this.midi_number;
            const range = Math.max(1, maxMidi - minMidi);
            let pitchNormalized = (this.midi_number - minMidi) / range;
            pitchNormalized = Math.max(0, Math.min(1, pitchNormalized));
            const energy = this.playing ? Math.max(0, Math.min(1, 1 - (this.time_diff || 0) / this.duration)) : 0;
            const pitchInfluence = 0.2 + 0.3 * pitchNormalized;
            const dynamicScale = 1 + energy * pitchInfluence;
            baseWidth = baseWidth * dynamicScale;
        }

        return baseWidth;
    }

    this.updateVisualPosition = function(options = {}) {
        const width = this.getVisualWidth(options);
        this.visual_width = width;
        this.string_position.x = this.string_center.x - width / 2;
        this.string_position.y = this.string_center.y;
        return {
            width,
            startX: this.string_position.x,
        };
    }

    this.updateVisualPosition({ includeDynamics: false });

    this.base_freq = overtones[0].freq;
    if (this.instrumentPreset) {
        this.applyInstrumentPreset(this.instrumentPreset, this.instrumentOptionsSeed);
    }
    this.string_slack = string_slack || Math.min(25, Math.max(8, 10000/this.freq));

    this.playing = false;

    this.fourier = function (points) {
        let freqs = {};
        let overtone_freqs = this.overtones.map(o => o.freq);
        for (let freq = this.base_freq; freq <= overtone_freqs[overtone_freqs.length - 1]; freq += this.base_freq) {
            let resonance = 0;
            for (let i = 0; i < points.length; i++) {
                let radians = 2 * Math.PI * (freq / (this.base_freq * 2)) * i / points.length;
                resonance += points[i] * -Math.sin(radians)
            }
            freqs[freq] = resonance;
        }
        return freqs;
    }

    this.autoEnvelopeValue = function (overtone, time_diff) {
        let percent_progress = Math.min(1, time_diff / this.duration);
        percent_progress = Math.max(0, percent_progress);
        let { freq, amplitude } = overtone;
        const baseDecay = typeof this.instrumentDecayBase === 'number' ? this.instrumentDecayBase : 2;
        const decayExponent = Math.max(0.1, baseDecay * (freq / this.base_freq));
        let auto = amplitude * Math.pow(Math.max(0, 1 - percent_progress), decayExponent);

        return auto;
    }

    this.getPlotY = function (overtone, time_diff, dynamic_amplitude, x) {
        let { freq } = overtone;

        let standing = Math.PI / this.string_width;
        let relative_freq = standing * freq / this.base_freq;

        let speed_adjustment = Math.sqrt(this.overtones[0].freq / 220) * (freq / this.base_freq) / 18;

        let phase = 0;

        let step = Math.PI / 4 + time_diff * (Math.PI / 20) * speed_adjustment % Math.PI * 2;
        let volume_envelope_amplitude = dynamic_amplitude;

        let current_amplitude = 3 * Math.sin(step + phase) * volume_envelope_amplitude * this.wave_halfheight;
        let y = -current_amplitude * Math.sin(relative_freq * x);
        return y;
    };

    this.draw_still = function () {
        let context = this.context;
        context.save();
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);
        
        const isActive = !!this.playing;
        const themeBaseColor = this.getThemeBaseColor();
        const inactiveColor = dimColor(themeBaseColor, 0.5);
        let color_idle = themeBaseColor || COLOR_IDLE;
        if (!isActive) {
            color_idle = inactiveColor;
        }
        if(window.canvas_mode == window.CanvasModes.draw) {
            color_idle = COLOR_DRAW;
        } else if(window.canvas_mode == window.CanvasModes.move) {
            color_idle = COLOR_MOVE;
        } else if(window.canvas_mode == window.CanvasModes.erase) {
            color_idle = COLOR_ERASE;
        }
        const { width: visualWidth, startX } = this.updateVisualPosition({ includeDynamics: false });
        context.strokeStyle = `rgba(${color_idle[0]}, ${color_idle[1]}, ${color_idle[2]}, 1.0)`
        if(window.hovered_string && window.hovered_string.id == this.id) {
            context.strokeStyle = `rgba(${COLOR_HOVER[0]}, ${COLOR_HOVER[1]}, ${COLOR_HOVER[2]}, 1.0)`
            // show text
            context.font = NOTE_FONT;
            const hoverTextColor = mixColors(isActive ? themeBaseColor : inactiveColor, COLOR_PLUCKED, 0.6);
            context.fillStyle = `rgba(${hoverTextColor[0]}, ${hoverTextColor[1]}, ${hoverTextColor[2]}, 1)`;
            context.fillText(this.note_name, startX + visualWidth + 15, this.string_position.y + 5);

            context.beginPath();
            // draw small circle dots at ends of string
            context.arc(startX, this.string_position.y, 5, 0, 2 * Math.PI, false);  
            context.fill();
            context.beginPath();
            context.arc(startX + visualWidth, this.string_position.y, 5, 0, 2 * Math.PI, false);  
            context.fill();
        }
        context.lineWidth = this.lineWidth;


        context.beginPath();
        context.moveTo(startX, this.string_position.y);
        context.lineTo(startX + visualWidth, this.string_position.y);
        context.stroke();
        context.restore();
    }
    this.draw = function () {
        this.time_diff = Math.min(this.duration, this.start_time ? Date.now() - this.start_time : 0);

        if (this.time_diff >= this.duration) {
            this.playing = false;
            this.draw_still();
            this.sync_worklet();
            return;
        }
        let context = this.context;
        this.context.lineWidth = this.lineWidth;
        context.save();
        let progress = (this.duration - this.time_diff) / this.duration;
        let brightness = Math.max(0, Math.min(1, 0.1 + Math.pow(progress, 4)));

        const themeBaseColor = this.getThemeBaseColor();
        const energyBoost = Math.pow(1 - progress, 0.8);
        const energized_color = mixColors(themeBaseColor, COLOR_PLUCKED, energyBoost * 0.35);
        const alpha = 1.0;


        let color_arr = energized_color;
        if(window.canvas_mode == window.CanvasModes.pluck) {
        } else if(window.canvas_mode == window.CanvasModes.draw) {
            color_arr = COLOR_DRAW;
        } else if(window.canvas_mode == window.CanvasModes.move) {
            color_arr = COLOR_MOVE;
        } else if(window.canvas_mode == window.CanvasModes.erase) {
            color_arr = COLOR_ERASE;
        }

        context.strokeStyle = `rgba(${color_arr[0]}, ${color_arr[1]}, ${color_arr[2]}, ${alpha})`
        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);

        const { width: visualWidth, startX } = this.updateVisualPosition({ includeDynamics: true });

        context.beginPath();
        context.moveTo(startX, this.string_position.y);
        const physicalStep = Math.max(1, X_INCREMENT);
        for (let i = 0; i <= this.string_width; i += physicalStep) {
            let coords = { x: 0, y: 0 };
            for (let j = 0; j < this.overtones.length; j++) {
                let overtone = this.overtones[j];

                let dynamic_amplitude = this.autoEnvelopeValue(overtone, this.time_diff);
                let current_y = this.getPlotY(overtone, this.time_diff, dynamic_amplitude, i);

                coords.y += current_y;
            }


            coords.y = coords.y / this.overtones.length;
            const ratio = this.string_width > 0 ? (i / this.string_width) : 0;
            const visualX = startX + ratio * visualWidth;
            this.context.lineTo(visualX, coords.y + this.string_position.y);
        }
        this.context.lineTo(startX + visualWidth, this.string_position.y);
        context.stroke();

        // write note name
        context.font = NOTE_FONT;
        context.fillStyle = `rgba(${color_arr[0]}, ${color_arr[1]}, ${color_arr[2]}, ${brightness })`
        context.shadowOffsetX = 0;  // Horizontal shadow displacement
        context.shadowOffsetY = 0;  // Vertical shadow displacement
        context.shadowBlur = 5;     // Blur level
        context.shadowColor = 'black';  // Shadow color
        context.fillText(this.note_name, startX + visualWidth + 15, this.string_position.y + 5);

        context.restore();
    };

    this.set_pluck_offsets = function (offsetX, offsetY) {
        this.plucking = true;
        this.pluck_offset_x = offsetX;
        this.pluck_offset_y = offsetY;

        this.stop_sound();

        const { width: baseVisualWidth, startX } = this.updateVisualPosition({ includeDynamics: false });
        if (Math.abs(offsetY - this.string_position.y) > this.string_slack || offsetX < startX || offsetX > startX + baseVisualWidth) {
            if(offsetY - this.string_position.y > this.string_slack) {
                this.pluck_offset_y = this.string_position.y + this.string_slack;
            } else if(offsetY - this.string_position.y < -this.string_slack) {
                this.pluck_offset_y = this.string_position.y - this.string_slack;
            }
            this.pluck(this.pluck_offset_x, this.pluck_offset_y);
        }
    }

    this.reset_pluck_offsets = function () {
        this.pluck_offset_x = undefined;
        this.pluck_offset_y = undefined;
        this.plucking = false;
        this.hand_plucking = false;
        this.stop_sound();
        this.start_time = undefined;
        this.prev_note_time = undefined;
    }

    this.draw_pluck = function (offsetX, offsetY) {
        let context = this.context;
        context.save();
        const plucking_color_array = mixColors(this.getThemeBaseColor(), COLOR_PLUCKED, 0.3);
        const plucking_color = colorToRgba(plucking_color_array, 1.0);
        context.strokeStyle = plucking_color
        context.strokeStyle = plucking_color

        context.translate(this.string_center.x, this.string_center.y);
        context.rotate(this.angle);
        context.translate(-this.string_center.x, -this.string_center.y);

        if (!offsetX) {
            if (!this.pluck_offset_x) {
                return;
            } else {
                offsetX = this.pluck_offset_x;
                offsetY = this.pluck_offset_y;
            }
        }

        // write note name
        context.font = NOTE_FONT
        context.fillStyle = plucking_color;

        context.shadowOffsetX = 0;  // Horizontal shadow displacement
        context.shadowOffsetY = 0;  // Vertical shadow displacement
        context.shadowBlur = 3;     // Blur level
        context.shadowColor = 'black';  // Shadow color

        const { width: visualWidth, startX } = this.updateVisualPosition({ includeDynamics: false });
        context.fillText(this.note_name, startX + visualWidth + 15, this.string_position.y + 5);


        // context.fillStyle = "#c8b1e3"
        // context.beginPath();
        // context.arc(offsetX, offsetY, 10, 0, 2 * Math.PI, false);
        // context.fill();

        // finger test
        // context.beginPath();
        // context.moveTo(offsetX + 10, this.string_position.y - 10);
        // context.lineTo(offsetX, offsetY);
        // context.stroke();

        let string_y = this.string_position.y;

        context.beginPath();
        context.moveTo(startX, this.string_position.y);
        context.lineTo(offsetX, offsetY);
        context.lineTo(startX + visualWidth, this.string_position.y);
        context.stroke();

        if(offsetY > this.string_position.y) {

            drawRoundedPolygon(context,
                offsetX,
                offsetY + 10,
                10, // radius
                0, // rotation
                50,// cornerPercent
                5, //shadowBlur,
                '#bbb',// color,
                3 //numberOfCorners
            )
        } else if(offsetY < this.string_position.y) {
            drawRoundedPolygon(context,
                offsetX,
                offsetY - 10,
                10, // radius
                180, // rotation
                50,// cornerPercent
                5, //shadowBlur,
                '#bbb',// color,
                3 //numberOfCorners
            )
        }


        context.restore();

        const visualRatio = visualWidth > 0 ? (offsetX - startX) / visualWidth : 0;
        const clampedRatio = Math.max(0, Math.min(1, visualRatio));

        this.pluck_coordinates = {
            x: clampedRatio,
            y: (offsetY - this.string_position.y) / this.string_height,
        }

        let points = [];
        let count = 500;
        let pluck_index = clampedRatio * count;
        pluck_index = Math.max(1, Math.min(count - 1, pluck_index));
        for (let i = 0; i < count; i++) {
            if (i <= pluck_index) {
                start_y = 0;
                end_y = offsetY - string_y
                points[i] = start_y + end_y * (i / pluck_index);
            } else {
                start_y = offsetY - string_y;
                end_y = 0;
                points[i] = start_y * ((count - i) / (count - pluck_index));
            }
        }
    }

    this.auto_pluck = function () {
        const { width: visualWidth, startX } = this.updateVisualPosition({ includeDynamics: false });
        let offsetX = startX + Math.random() * visualWidth;
        let offsetY = this.string_center.y + this.string_slack / 2;
        this.set_pluck_offsets(offsetX, offsetY);
        this.pluck(offsetX, offsetY);
    }

    this.pluck = function (offsetX, offsetY) {
        if (!offsetX || !offsetY) {
            offsetX = this.pluck_offset_x
            offsetY = this.pluck_offset_y
        }
        this.pluck_offset_x = undefined;
        this.pluck_offset_y = undefined;
        this.plucking = false;
        this.hand_plucking = false;
        let points = [];
        let count = 100;
        const { width: visualWidth, startX } = this.updateVisualPosition({ includeDynamics: false });
        let relativeXVisual = (offsetX - startX);
        let relativeY = (offsetY - this.string_position.y);

        const normalizedX = visualWidth > 0 ? relativeXVisual / visualWidth : 0;
        const clampedNormalizedX = Math.max(0, Math.min(1, normalizedX));
        let relativeX = clampedNormalizedX * this.string_width;

        let pluck_index = clampedNormalizedX * count;
        pluck_index = Math.max(1, Math.min(count - 1, pluck_index));
        for (let i = 0; i < count; i++) {
            if (i <= pluck_index) {
                points[i] = relativeY * (i / pluck_index) / this.string_height;
            } else {
                points[i] = relativeY * ((count - i) / (count - pluck_index)) / this.string_height;
            }
        }

        let freqs = this.fourier(points);

        for (let wi = 0; wi < this.overtones.length; wi++) {

            let low_freq_amp_adjustment = this.freq < 200  ? window.smoothTransition(this.freq, 0, 200, wi/3 + 0.5, 1) : 1;
            let high_freq_amp_adjustment = this.freq > 1200 ? window.smoothTransition(this.freq, 1200, 2000, 1, 0.5) : 1;

            const resonance = freqs[this.overtones[wi].freq] || 0;
            const instrumentGain = this.getInstrumentOvertoneGain(wi);
            this.overtones[wi].amplitude = instrumentGain * low_freq_amp_adjustment * high_freq_amp_adjustment * (resonance) / 5
        }

        this.start_time = Date.now();
        this.pluck_source = undefined;
        this.hand_plucking = false;

        this.play_sound();
        if (typeof window.playWebAudioFontPreview === 'function' && typeof this.midi_number === 'number') {
            const normalizedVelocity = Math.min(1, Math.abs(relativeY) / Math.max(1, this.string_slack) + 0.2);
            window.playWebAudioFontPreview(this.midi_number, normalizedVelocity);
        }
    }

    this.post_message_to_worklet = function (message) {
        if (this.audio) this.audio.updateString(message);
    }

    this.sync_worklet = function () {
        if (this.playing) {
            this.post_message_to_worklet({
                string: {
                    id: this.id,
                    freq: this.freq,
                    overtones: this.overtones.map(o => { return { freq: o.freq, amplitude: Math.abs(o.amplitude) } }),
                    duration: this.duration
                },
            });
        } else {
            this.post_message_to_worklet({
                string: {
                    id: this.id,
                    stopped: !this.playing,
                },
            });
        }
    }

    this.play_sound = function () {
        this.playing = true;
        this.plucking = false;
        this.sync_worklet();
    }

    this.stop_sound = function () {
        if (this.playing) {
            this.playing = false;
            this.sync_worklet();
        }
    }

    return this;
}

