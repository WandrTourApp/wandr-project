// podcast-automation/optimization/algorithms/eq-calculator.js

class EQCalculator {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        // Define common vocal frequency ranges for reference
        // These are used to inform where to place EQ cuts or to identify relevant vocal areas.
        this.VOCAL_FREQS = {
            lowCutoff: 80,   // Frequencies below this are often cut for voice (rumble)
            bodyLow: 100,    // Vocal warmth, lower body
            bodyHigh: 300,   // Vocal fullness, can be muddy if over-emphasized in backgrounds
            midPresenceLow: 1000, // Core vocal clarity and intelligibility area
            midPresenceHigh: 5000, // Upper clarity, sibilance, harshness if overdone
            air: 8000        // Sparkle, 'air' frequencies
        };
    }

    /**
     * Calculates a Q (Quality Factor) value for a parametric EQ.
     * Q determines the width of the EQ band. A higher Q means a narrower band.
     * Q = Fcenter / Bandwidth (in Hz)
     * This is an approximation for FFmpeg's 'equalizer' filter where width_type='q'.
     *
     * @param {number} fCenter Center frequency of the EQ band in Hz.
     * @param {number} bandwidthInHz Desired bandwidth of the EQ band in Hz.
     * @returns {number} Calculated Q value. Returns 1.0 to avoid division by zero if bandwidth is 0.
     */
    calculateQFromBandwidth(fCenter, bandwidthInHz) {
        if (bandwidthInHz === 0) return 1.0; // Prevent division by zero
        return fCenter / bandwidthInHz;
    }

    /**
     * Generates an FFmpeg filter string for applying intelligent complementary EQ to a background layer.
     * This aims to create space for the main voice track by subtly cutting frequencies
     * where the vocal profile indicates strong presence.
     *
     * @param {Object} vocalProfile The vocal profile object obtained from VocalAnalyzer.
     * @param {string} layerType The type of the background layer ('ambience', 'music', 'effects').
     * @param {string} inputLabel The FFmpeg input label for this specific audio layer (e.g., '[bg0_vol]').
     * @returns {string} A string representing FFmpeg's `equalizer` or `highpass` filter chain,
     * or just the pass-through string if no EQ is applied.
     * The output label will be '[inputLabel_eq]'.
     */
    generateBackgroundEQ(vocalProfile, layerType, inputLabel) {
        const filters = [];
        // Define the output label for the processed audio stream
        const outputLabel = `${inputLabel.replace('[', '').replace(']', '')}_eq`;

        // Determine general EQ strategy based on layer type and vocal analysis
        let baseGainReduction = -4; // A common subtle cut for backgrounds when voice is present
        
        // 1. General Low-End Cut for Backgrounds (High-Pass Filter)
        // This frees up low-frequency space for clarity and prevents muddy build-up.
        // A high-pass filter below 90Hz is often a good practice for most background elements.
        filters.push(`highpass=f=90`);

        // 2. Mid-Range Scoop based on Vocal Dominance (PRIMARY VOCAL UNMASKING)
        // This is the most crucial part: making a cut in the background where the voice is strongest.
        if (vocalProfile && vocalProfile.dominantFrequency > this.VOCAL_FREQS.bodyLow && vocalProfile.dominantFrequency < this.VOCAL_FREQS.midPresenceHigh) {
            const centerFreq = vocalProfile.dominantFrequency; // Use the most dominant vocal frequency
            const gain = baseGainReduction; // Apply a cut
            // Calculate a Q that creates a relatively wide scoop (e.g., bandwidth of 1500Hz)
            // This broad cut helps unmask the voice without making the background sound too thin.
            const bandwidth = 1500; 
            const qValue = this.calculateQFromBandwidth(centerFreq, bandwidth);

            // Apply a parametric equalizer cut
            filters.push(`equalizer=f=${centerFreq}:width_type=q:width=${qValue.toFixed(2)}:g=${gain}`);
        } else {
             // Fallback to a general mid-range scoop if the dominant vocal frequency isn't clear
             // A common frequency for general vocal presence is around 2000 Hz (2kHz).
             filters.push(`equalizer=f=2000:width_type=q:width=0.8:g=${baseGainReduction}`); 
        }
        
        // 3. Subtle High-Mid/Presence Cut for Ambience/Music
        // This aims to reduce potential harshness or overly bright elements in backgrounds
        // that might interfere with vocal clarity or cause listening fatigue over time.
        // Applies specifically to continuous ambience and music layers.
        if (layerType === 'ambience' || layerType === 'music') {
            filters.push(`equalizer=f=5000:width_type=q:width=1.0:g=-3`); // Small cut around 5kHz
        }

        // Construct the final FFmpeg filter string for this layer.
        // It takes the inputLabel, applies all generated filters, and outputs to the new outputLabel.
        if (filters.length > 0) {
            return `${inputLabel},${filters.join(',')}[${outputLabel}]`;
        }
        // If no filters were added, simply pass the input through to the new output label.
        return `${inputLabel}[${outputLabel}]`;
    }
}

module.exports = EQCalculator;
