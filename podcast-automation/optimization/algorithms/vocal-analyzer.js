// podcast-automation/optimization/algorithms/vocal-analyzer.js

const ffmpeg = require('fluent-ffmpeg');
const { fft, util } = require('fft-js'); // Assuming fft-js is installed: npm install fft-js
const { Transform } = require('stream'); // For creating a transform stream if needed

class VocalAnalyzer {
    constructor(sampleRate = 44100, fftSize = 2048) {
        this.sampleRate = sampleRate;
        this.fftSize = fftSize; // Must be a power of 2 (e.g., 1024, 2048, 4096)
        this.buffer = Buffer.alloc(0); // Accumulate raw PCM data
        this.samplesPerFrame = fftSize; // Number of samples for one FFT window
        this.bytesPerSample = 2; // For s16le (16-bit signed integer)
        this.allMagnitudes = []; // Accumulate magnitudes from all FFT windows
    }

    /**
     * Analyzes the voice audio file to extract its frequency profile.
     * This involves decoding the audio to raw PCM, performing FFT on chunks,
     * and aggregating the results to form a vocal frequency profile.
     *
     * @param {string} audioFilePath Path to the ElevenLabs voice MP3 file.
     * @returns {Promise<Object>} A promise resolving to the vocal profile.
     */
    async analyze(audioFilePath) {
        // Reset buffers and accumulated data for a new analysis
        this.buffer = Buffer.alloc(0);
        this.allMagnitudes = [];

        return new Promise((resolve, reject) => {
            // Configure FFmpeg to output raw, mono, 16-bit signed little-endian PCM
            const ffmpegCommand = ffmpeg(audioFilePath)
                .noVideo() // Ensure only audio is processed
                .audioChannels(1) // Convert to mono for simpler analysis
                .audioFrequency(this.sampleRate) // Set target sample rate
                .audioCodec('pcm_s16le') // Raw 16-bit signed little-endian PCM
                .format('s16le') // Raw audio format
                .pipe(); // Pipe the output to stdout (Node.js stream)

            ffmpegCommand.on('data', (chunk) => {
                this.buffer = Buffer.concat([this.buffer, chunk]); // Accumulate incoming data
                this._processBuffer(); // Process accumulated data
            });

            ffmpegCommand.on('end', () => {
                // Process any remaining buffer data that might not fill a full FFT window
                this._processBuffer(true);
                // Finalize vocal profile calculations after all data is processed
                resolve(this._calculateFinalProfile());
            });

            ffmpegCommand.on('error', (err) => {
                console.error('FFmpeg error during vocal analysis:', err.message);
                reject(err);
            });
        });
    }

    /**
     * Processes the accumulated audio buffer in FFT-sized chunks.
     * Converts raw PCM bytes to Float32Array and performs FFT.
     * @param {boolean} [isEnd=false] True if this is the final processing pass (at end of stream).
     */
    _processBuffer(isEnd = false) {
        // Continue processing as long as there's enough data for an FFT frame,
        // or if it's the end of the stream and there's any data left.
        while (this.buffer.length >= this.samplesPerFrame * this.bytesPerSample || (isEnd && this.buffer.length > 0)) {
            let currentSamplesBuffer;
            if (this.buffer.length >= this.samplesPerFrame * this.bytesPerSample) {
                // Extract a full FFT window's worth of bytes
                currentSamplesBuffer = this.buffer.slice(0, this.samplesPerFrame * this.bytesPerSample);
                this.buffer = this.buffer.slice(this.samplesPerFrame * this.bytesPerSample); // Remove processed bytes
            } else {
                // If it's the end and less than a full window, process remaining bytes
                currentSamplesBuffer = this.buffer;
                this.buffer = Buffer.alloc(0); // Clear buffer
            }

            // Convert raw 16-bit signed little-endian bytes to normalized Float32Array (-1.0 to 1.0)
            const floatSamples = new Float32Array(currentSamplesBuffer.length / this.bytesPerSample);
            for (let i = 0; i < floatSamples.length; i++) {
                // Read 16-bit signed integer and normalize (divide by max value for 16-bit signed: 2^15 = 32768)
                floatSamples[i] = currentSamplesBuffer.readInt16LE(i * this.bytesPerSample) / 32768.0;
            }

            // Perform FFT on the samples. fft-js expects an ArrayBuffer.
            const phasors = fft(floatSamples.buffer);

            // Calculate magnitudes for each frequency bin and map to actual frequencies (Hz)
            const magnitudes = util.fftFreq(phasors, this.sampleRate)
                                  .map((freq, ix) => {
                                      const mag = util.fftMag(phasors[ix]); // Calculate magnitude from real/imaginary parts
                                      return { frequency: freq, magnitude: mag };
                                  })
                                  // For real input signals, the FFT result is symmetric,
                                  // so we only need the first half of the bins.
                                  .slice(0, this.fftSize / 2);

            this._accumulateMagnitudes(magnitudes);
        }
    }

    /**
     * Accumulates magnitudes from each FFT window.
     * @param {Array<Object>} magnitudes An array of { frequency, magnitude } objects for one FFT window.
     */
    _accumulateMagnitudes(magnitudes) {
        this.allMagnitudes.push(magnitudes);
    }

    /**
     * Calculates the final vocal frequency profile by aggregating all FFT window magnitudes.
     * @returns {Object} The aggregated vocal profile.
     */
    _calculateFinalProfile() {
        if (!this.allMagnitudes || this.allMagnitudes.length === 0) {
            return this.getDefaultVocalProfile();
        }

        const totalBins = this.fftSize / 2;
        const cumulativeMagnitudes = new Array(totalBins).fill(0);
        const totalWindows = this.allMagnitudes.length;

        // Sum magnitudes for each frequency bin across all processed windows
        this.allMagnitudes.forEach(windowMagnitudes => {
            windowMagnitudes.forEach((bin, index) => {
                if (index < totalBins) {
                    cumulativeMagnitudes[index] += bin.magnitude;
                }
            });
        });

        // Calculate average magnitude for each bin
        const avgMagnitudes = cumulativeMagnitudes.map(sum => sum / totalWindows);

        // Find dominant frequency within a relevant vocal range
        let dominantFrequencyBin = -1;
        let maxAvgMagnitude = -1;
        // Define relevant vocal frequency ranges to avoid picking up noise floor or irrelevant sounds
        const minFreqHz = 80; // Minimum typical fundamental male vocal frequency
        const maxFreqHz = 8000; // Upper limit for essential vocal clarity and sibilance

        let minBin = Math.floor(minFreqHz / (this.sampleRate / this.fftSize));
        let maxBin = Math.ceil(maxFreqHz / (this.sampleRate / this.fftSize));
        minBin = Math.max(0, minBin); // Ensure bin index is not negative
        maxBin = Math.min(totalBins - 1, maxBin); // Ensure bin index is within bounds

        for (let i = minBin; i <= maxBin; i++) {
            if (avgMagnitudes[i] > maxAvgMagnitude) {
                maxAvgMagnitude = avgMagnitudes[i];
                dominantFrequencyBin = i;
            }
        }
        
        const dominantFrequency = dominantFrequencyBin !== -1 ?
            (dominantFrequencyBin * (this.sampleRate / this.fftSize)) : 0; // Convert bin index to Hz

        // Calculate average energy per general band (Low, Mid, High)
        // These bands are defined based on common vocal EQ practices
        const lowBandEndFreq = 500; // e.g., up to 500 Hz (vocal fundamentals, body)
        const midBandEndFreq = 5000; // e.g., 500 Hz to 5000 Hz (vocal clarity, presence)
        
        let lowEnergy = 0;
        let midEnergy = 0;
        let highEnergy = 0;
        let lowCount = 0;
        let midCount = 0;
        let highCount = 0;

        avgMagnitudes.forEach((mag, index) => {
            const freq = index * (this.sampleRate / this.fftSize);
            if (freq <= lowBandEndFreq) {
                lowEnergy += mag;
                lowCount++;
            } else if (freq > lowBandEndFreq && freq <= midBandEndFreq) {
                midEnergy += mag;
                midCount++;
            } else if (freq > midBandEndFreq && freq <= maxFreqHz) { // Only count up to maxFreqHz for 'high'
                highEnergy += mag;
                highCount++;
            }
        });

        const averageEnergyByBand = {
            low: lowCount > 0 ? lowEnergy / lowCount : 0,
            mid: midCount > 0 ? midEnergy / midCount : 0,
            high: highCount > 0 ? highEnergy / highCount : 0,
        };

        // Find top N peak frequencies (for more specific EQ targets or insights)
        const numPeaks = 5; // Number of top peaks to identify
        const sortedMagnitudes = avgMagnitudes
            .map((mag, index) => ({ frequency: index * (this.sampleRate / this.fftSize), magnitude: mag }))
            .filter(item => item.frequency >= minFreqHz && item.frequency <= maxFreqHz) // Filter to relevant vocal range
            .sort((a, b) => b.magnitude - a.magnitude); // Sort by magnitude (highest first)
        const peakFrequencies = sortedMagnitudes.slice(0, numPeaks);


        // Return the final vocal profile, formatted for readability
        return {
            dominantFrequency: parseFloat(dominantFrequency.toFixed(2)),
            averageEnergyByBand: {
                low: parseFloat(averageEnergyByBand.low.toFixed(4)),
                mid: parseFloat(averageEnergyByBand.mid.toFixed(4)),
                high: parseFloat(averageEnergyByBand.high.toFixed(4))
            },
            peakFrequencies: peakFrequencies.map(p => ({ freq: parseFloat(p.frequency.toFixed(2)), mag: parseFloat(p.magnitude.toFixed(4)) }))
        };
    }

    /**
     * Provides a default/empty vocal profile.
     * @returns {Object} Default vocal profile.
     */
    getDefaultVocalProfile() {
        return {
            dominantFrequency: 0,
            averageEnergyByBand: { low: 0, mid: 0, high: 0 },
            peakFrequencies: []
        };
    }
}

module.exports = VocalAnalyzer;
