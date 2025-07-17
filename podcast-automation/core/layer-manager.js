/**
 * LayerManager for Lost Transmissions
 * Creates and manages structured audio layers (voice, ambience, music, effects, structural)
 * by resolving file paths and retrieving durations, preparing them for the TransmissionMixer.
 */

const path = require('path');
const ffmpeg = require('fluent-ffmpeg'); // Used for ffprobe to get audio durations
const fs = require('fs').promises; // For checking file existence

class LayerManager {
    constructor() {
        this.config = require('../config/audio-settings.json');
        this.libraryMappings = require('../config/library-mappings.json');
        // Define the base path for your audio libraries relative to the project root
        // Assuming audio-libraries is parallel to podcast-automation
        this.audioLibraryBasePath = path.join(__dirname, '..', '..', 'audio-libraries');
    }

    /**
     * Creates and prepares an array of audio layer objects for the mixer.
     * Each layer object includes file path, type, volume, fades, and duration.
     *
     * @param {object} params - Parameters for layer creation.
     * @param {string} params.voice - Path to the main voice audio file.
     * @param {object} params.libraries - Object containing selected library categories (e.g., ambience, music).
     * @param {object} params.analysis - Full content analysis object (from ContentAnalyzer).
     * @returns {Promise<Array<object>>} A promise resolving to an array of layer objects.
     */
    async createLayers(params) {
        const { voice: voiceFilePath, libraries, analysis } = params;
        const layers = [];
        let voiceDuration = 0;

        // 1. Add Voice Layer (Primary)
        if (voiceFilePath) {
            voiceDuration = await this._getAudioDuration(voiceFilePath);
            layers.push({
                filePath: voiceFilePath,
                type: 'voice',
                volume: this.config.mixing.voiceVolume,
                fadeIn: 0.5, // Standard intro fade for voice
                fadeOut: 1.0, // Standard outro fade for voice
                duration: voiceDuration,
                startOffset: 0 // Voice starts at the beginning
            });
        } else {
            console.warn('Voice file path not provided. Cannot create voice layer.');
            throw new Error('Voice file path is required.');
        }

        // 2. Add Structural Elements (Intro/Outro)
        // Intro
        if (libraries.structural && libraries.structural.intro) {
            const introPath = this._resolveLibraryPath(libraries.structural.intro);
            const introDuration = await this._getAudioDuration(introPath);
            layers.push({
                filePath: introPath,
                type: 'structural-intro',
                volume: this.config.mixing.introVolume || 1.0, // Assume full volume for structural elements
                fadeIn: 0,
                fadeOut: 0.5, // Fade out into voice
                duration: introDuration,
                startOffset: 0
            });
            // Adjust voice startOffset if intro is present and we want voice to start after it
            // For now, assuming intro mixes *with* the very beginning of the voice.
            // Future enhancement: make voice start after intro, pushing all other layers.
        }

        // Outro (placed at the end of the voice track, potentially extending beyond)
        if (libraries.structural && libraries.structural.outro) {
            const outroPath = this._resolveLibraryPath(libraries.structural.outro);
            const outroDuration = await this._getAudioDuration(outroPath);
            layers.push({
                filePath: outroPath,
                type: 'structural-outro',
                volume: this.config.mixing.outroVolume || 1.0,
                fadeIn: 0.5, // Fade in from main content
                fadeOut: 0,
                duration: outroDuration,
                // Outro starts relative to the end of the voice track (or combined content)
                startOffset: voiceDuration > 0 ? (voiceDuration - 1.0) : 0 // Start 1 sec before voice ends, for crossfade
            });
        }


        // 3. Add Background Ambience
        if (libraries.ambience && libraries.ambience.length > 0) {
            // Pick a random ambience for simplicity for now
            const selectedAmbience = libraries.ambience[Math.floor(Math.random() * libraries.ambience.length)];
            const ambiencePath = this._resolveLibraryPath(selectedAmbience);
            const ambienceDuration = await this._getAudioDuration(ambiencePath); // Get duration for looping or trimming
            layers.push({
                filePath: ambiencePath,
                type: 'ambience',
                volume: this.config.mixing.ambienceVolume,
                fadeIn: 1.0,
                fadeOut: 1.0,
                duration: ambienceDuration,
                loop: true, // Ambience typically loops
                startOffset: 0
            });
        }

        // 4. Add Background Music
        if (libraries.music && libraries.music.length > 0) {
             // Pick a random music track for simplicity for now, based on mood
            const selectedMusic = libraries.music[Math.floor(Math.random() * libraries.music.length)];
            const musicPath = this._resolveLibraryPath(selectedMusic);
            const musicDuration = await this._getAudioDuration(musicPath);
            layers.push({
                filePath: musicPath,
                type: 'music',
                volume: this.config.mixing.musicVolume,
                fadeIn: 2.0, // Longer fade-in for music
                fadeOut: 2.0, // Longer fade-out for music
                duration: musicDuration,
                loop: true, // Music typically loops
                startOffset: 0
            });
        }
        
        // 5. Add Transmission Effects (e.g., static)
        // These can be short, often placed at the beginning or specific points
        if (libraries.effects && libraries.effects.length > 0) {
            // For now, let's add one static effect at the beginning.
            // Future: integrate more precisely based on transcript keywords/sentiment.
            const selectedEffect = libraries.effects[Math.floor(Math.random() * libraries.effects.length)];
            const effectPath = this._resolveLibraryPath(selectedEffect);
            const effectDuration = await this._getAudioDuration(effectPath);
            layers.push({
                filePath: effectPath,
                type: 'transmission-static', // Specific type for static
                volume: this.config.mixing.transmissionStaticVolume, // Use specific static volume
                fadeIn: 0.1,
                fadeOut: 0.5,
                duration: effectDuration,
                startOffset: 0 // Starts at the beginning
            });
        }

        console.log('✅ Layers prepared:', layers.map(l => ({type: l.type, path: l.filePath, duration: l.duration, loop: l.loop, startOffset: l.startOffset})));
        return layers;
    }

    /**
     * Resolves a relative path from library-mappings.json to an absolute file system path.
     * @param {string} relativePath The path as stored in library-mappings.json (e.g., 'ambience/forest/wind-through-trees.mp3').
     * @returns {string} The absolute path to the audio file.
     */
    _resolveLibraryPath(relativePath) {
        if (!relativePath) {
            throw new Error("Relative path cannot be null or undefined.");
        }
        const fullPath = path.join(this.audioLibraryBasePath, relativePath);
        // Optional: Add a check here for file existence if robustness is critical
        // For example:
        // try {
        //     await fs.access(fullPath);
        // } catch (e) {
        //     console.error(`File not found: ${fullPath}`);
        //     throw new Error(`Audio library file not found: ${fullPath}`);
        // }
        return fullPath;
    }

    /**
     * Gets the duration of an audio file using FFmpeg's ffprobe.
     * @param {string} filePath The path to the audio file.
     * @returns {Promise<number>} The duration of the audio in seconds.
     */
    async _getAudioDuration(filePath) {
        return new Promise((resolve, reject) => {
            // Check if file exists before probing
            fs.access(filePath, fs.constants.F_OK)
              .then(() => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) {
                        console.error(`Error probing duration for ${filePath}:`, err);
                        reject(err);
                    } else {
                        resolve(metadata.format.duration);
                    }
                });
              })
              .catch(() => {
                const errorMsg = `Audio file does not exist or is inaccessible: ${filePath}`;
                console.error(errorMsg);
                reject(new Error(errorMsg));
              });
        });
    }
}

module.exports = LayerManager;
