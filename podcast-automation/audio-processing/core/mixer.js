/**
 * Lost Transmissions Audio Mixer
 * Main engine for automated podcast production.
 * This class orchestrates the entire audio mixing pipeline using FFmpeg,
 * applying dynamic ducking, intelligent EQ, and other professional audio processing.
 */

const ffmpeg = require('fluent-ffmpeg'); // FFmpeg wrapper
const fs = require('fs').promises;     // File system promises for async operations
const path = require('path');           // Path utility for file paths

const ContentAnalyzer = require('./content-analyzer'); // Imports our enhanced Content Analyzer
const LayerManager = require('./layer-manager');       // Imports Layer Manager (Claude's responsibility)
const EQCalculator = require('../../optimization/algorithms/eq-calculator'); // Imports our Intelligent EQ Calculator

class TransmissionMixer {
    constructor() {
        // Load configuration settings for mixing parameters, processing, and effects
        this.config = require('../config/audio-settings.json');
        // Load library mappings for selecting audio assets based on analysis
        this.libraryMappings = require('../config/library-mappings.json');
        
        // Initialize core components
        this.contentAnalyzer = new ContentAnalyzer();
        this.layerManager = new LayerManager(); // Placeholder for Claude's implementation
        this.eqCalculator = new EQCalculator(this.config.processing.sampleRate); // Initialize EQCalculator with sample rate
    }

    /**
     * Main processing function: Takes a raw ElevenLabs voice file and
     * transforms it into a fully produced podcast episode.
     * @param {string} voiceFilePath Path to the raw ElevenLabs voice MP3/WAV file.
     * @param {object} options Optional settings for processing (e.g., outputPath).
     * @returns {Promise<object>} An object indicating success, output path, analysis, and metadata.
     */
    async processTransmission(voiceFilePath, options = {}) {
        try {
            console.log('🎙️ Starting Lost Transmission processing...');
            
            // 1. Analyze voice content for location, mood, sentiment, and vocal frequency profile
            const analysis = await this.contentAnalyzer.analyze(voiceFilePath);
            console.log('📊 Content analysis completed.');
            console.log('   Location:', analysis.location, 'Mood:', analysis.mood, 'Sentiment:', analysis.sentimentScore);
            console.log('   Dominant Vocal Freq:', analysis.vocalProfile?.dominantFrequency.toFixed(2) + 'Hz');
            
            // 2. Select appropriate audio libraries based on content analysis
            // NOTE: This relies on LayerManager to map analysis results to actual file paths.
            const audioLibrariesSelection = this.selectAudioLibraries(analysis); 
            console.log('🎵 Selected audio libraries for LayerManager:', audioLibrariesSelection);
            
            // 3. Create structured audio layers (voice, ambience, music, effects, structural)
            // LayerManager (Claude's task) will take analysis and selections to provide actual file paths and durations.
            // For testing, ensure LayerManager provides a valid 'layers' array with 'filePath', 'type', 'duration'.
            const layers = await this.layerManager.createLayers({
                voice: voiceFilePath,
                libraries: audioLibrariesSelection, // Used by LayerManager to find specific files
                analysis: analysis // Full analysis can inform LayerManager's choices
            });
            console.log('🎚️ Audio layers created:', layers.map(l => l.type));

            // Ensure durations are available for all layers (especially for fading)
            for (const layer of layers) {
                if (!layer.duration) {
                    // Fallback: get duration if LayerManager didn't provide it (e.g., for dynamically selected short effects)
                    try {
                        const metadata = await new Promise((resolve, reject) => {
                            ffmpeg.ffprobe(layer.filePath, (err, meta) => {
                                if (err) reject(err);
                                resolve(meta);
                            });
                        });
                        layer.duration = metadata.format.duration;
                    } catch (durErr) {
                        console.warn(`Could not get duration for layer ${layer.type} (${layer.filePath}): ${durErr.message}. Defaulting to 0.`);
                        layer.duration = 0; // Default to 0 to prevent errors
                    }
                }
            }
            
            // 4. Mix all layers together using FFmpeg with intelligent processing
            // Pass the full analysis object to buildFilterComplex for intelligent EQ
            const outputPath = await this.mixLayers(layers, { ...options, vocalAnalysis: analysis });
            console.log('✅ Transmission complete:', outputPath);
            
            return {
                success: true,
                outputPath: outputPath,
                analysis: analysis, // Return the full analysis for show notes, metadata etc.
                metadata: this.generateMetadata(analysis) // Generate podcast-specific metadata
            };
            
        } catch (error) {
            console.error('❌ Transmission processing failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Selects appropriate audio library categories based on content analysis.
     * This function's output informs LayerManager.js about which types of audio files to look for.
     * LayerManager is then responsible for finding the actual file paths.
     * @param {object} analysis The content analysis result.
     * @returns {object} An object specifying categories of audio files to select.
     */
    selectAudioLibraries(analysis) {
        // This logic should be refined by Claude's LayerManager, but this defines what it should look for.
        return {
            ambience: this.libraryMappings.locations[analysis.location]?.ambience || this.libraryMappings.locations.unknown.ambience,
            music: this.libraryMappings.moods[analysis.mood]?.music || this.libraryMappings.moods.mysterious.music,
            // Effects might be selected more granularly based on keywords or specific themes from analysis
            effects: this.libraryMappings.transmissionEffects.static, // Example: always add some static
            structural: {
                intro: this.libraryMappings.structuralElements.intro[0],
                outro: this.libraryMappings.structuralElements.outro[0]
            }
            // Add more granular effect selection based on analysis.keywords or analysis.theme
            // e.g., if analysis.keywords includes "door", add a door sound effect.
        };
    }

    /**
     * Mixes all audio layers using FFmpeg's complex filter graph.
     * Applies volumes, fades, dynamic ducking, and intelligent EQ.
     * @param {Array<object>} layers An array of layer objects, each with filePath, type, volume, duration etc.
     * @param {object} options Options including vocalAnalysis and outputPath.
     * @returns {Promise<string>} A promise resolving to the path of the mixed output file.
     */
    async mixLayers(layers, options) {
        // Determine the output path, defaulting if not provided
        const outputPath = options.outputPath || 
            path.join(__dirname, '../output', `transmission-${Date.now()}.${this.config.processing.format}`);
        
        return new Promise((resolve, reject) => {
            let command = ffmpeg();
            
            // Separate voice layer from others for sidechaining
            const voiceLayer = layers.find(layer => layer.type === 'voice');
            const backgroundLayers = layers.filter(layer => layer.type !== 'voice');

            if (!voiceLayer || !voiceLayer.filePath) {
                return reject(new Error('Voice layer (primary input) is missing or has no file path.'));
            }

            // Add voice input first (FFmpeg input index 0)
            command = command.input(voiceLayer.filePath);
            
            // Add other background inputs sequentially (FFmpeg input indices 1, 2, 3...)
            backgroundLayers.forEach(layer => {
                if (layer.filePath) {
                    command = command.input(layer.filePath);
                } else {
                    console.warn(`Layer of type ${layer.type} has no filePath and will be skipped.`);
                }
            });
            
            // Build the complex filter graph string, passing vocal analysis for intelligent EQ
            const filterComplex = this.buildFilterComplex(voiceLayer, backgroundLayers, options.vocalAnalysis);
            
            command
                .complexFilter(filterComplex) // Apply the generated FFmpeg filter graph
                .audioCodec('libmp3lame')     // Use LAME MP3 encoder
                .audioBitrate(this.config.processing.bitRate) // Set target bitrate
                .audioChannels(this.config.processing.channels) // Set output channels
                .outputOption('-map [out]') // Ensure only the final mixed stream is mapped to output

                // Event listeners for FFmpeg progress and completion
                .on('start', (commandLine) => {
                    console.log('🎛️ FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log('⚡ Processing:', Math.round(progress.percent) + '%');
                    }
                })
                .on('end', () => {
                    console.log('🎯 Audio mixing complete.');
                    resolve(outputPath);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('❌ FFmpeg error:', err.message);
                    console.error('FFmpeg stdout:', stdout);
                    console.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .save(outputPath); // Save the output file
        });
    }

    /**
     * Builds the FFmpeg complex filter graph string for multi-layer mixing.
     * This function dynamically generates the FFmpeg commands for:
     * - Individual layer volume and fades
     * - Intelligent EQ for background layers (informed by vocal analysis)
     * - Dynamic ducking of background layers by the voice track
     * - Final mixing of all processed layers.
     * @param {object} voiceLayer The primary voice layer object.
     * @param {Array<object>} backgroundLayers An array of background layer objects.
     * @param {object} vocalAnalysis The vocal analysis result (including vocalProfile).
     * @returns {string} The complete FFmpeg complex filter graph string.
     */
    buildFilterComplex(voiceLayer, backgroundLayers, vocalAnalysis) {
        const filters = []; // Array to hold individual FFmpeg filter chains
        
        // Define FFmpeg input labels. Voice is always input 0.
        const voiceInputLabel = '[0:a]'; 
        let currentVoiceLabel = '[processedVoice]'; // Label for the voice stream after its individual processing
        
        // 1. Process Voice Layer: Apply Volume, Fading, and Static EQ from config
        let voiceFilterChain = `${voiceInputLabel}volume=${voiceLayer.volume || this.config.mixing.voiceVolume}`;
        if (voiceLayer.fadeIn > 0) voiceFilterChain += `,afade=t=in:ss=0:d=${voiceLayer.fadeIn}`;
        if (voiceLayer.fadeOut > 0 && voiceLayer.duration) voiceFilterChain += `,afade=t=out:st=${voiceLayer.duration - voiceLayer.fadeOut}:d=${voiceLayer.fadeOut}`;
        
        // Apply Voice EQ from audio-settings.json config
        const voiceEQ = this.config.effects.voiceEQ;
        if (voiceEQ) {
            voiceFilterChain += `,equalizer=f=${voiceEQ.frequency}:width_type=h:width=${voiceEQ.width}:g=${voiceEQ.gain}`;
        }
        filters.push(`${voiceFilterChain}${currentVoiceLabel}`); // Add processed voice stream to filters

        // Array to hold labels of processed background layers before final mixing
        let processedBackgroundLabels = [];
        
        // 2. Process Individual Background Layers: Apply Volume, Fading, and Intelligent EQ
        backgroundLayers.forEach((layer, index) => {
            const inputLabel = `[${index + 1}:a]`; // Background layers start from FFmpeg input index 1
            let currentBgLabel = `${inputLabel}`; // Start with raw input label
            let finalBgLabel = `[bg${index}_final]`; // Final label for this background layer after all processing

            // Apply Volume and Fades
            let bgVolFadeFilter = `volume=${layer.volume || this.config.mixing[`${layer.type}Volume`] || 0.1}`;
            if (layer.fadeIn > 0) bgVolFadeFilter += `,afade=t=in:ss=0:d=${layer.fadeIn}`;
            if (layer.fadeOut > 0 && layer.duration) bgVolFadeFilter += `,afade=t=out:st=${layer.duration - layer.fadeOut}:d=${layer.fadeOut}`;
            
            currentBgLabel = `[bg${index}_volfade]`; // Label after volume and fades
            filters.push(`${inputLabel}${bgVolFadeFilter}${currentBgLabel}`);

            // Apply Intelligent EQ from EQCalculator for background layers
            let eqFilterString = '';
            if (vocalAnalysis && vocalAnalysis.vocalProfile) {
                // eqCalculator.generateBackgroundEQ takes the current stream label and returns a new filter string
                // like '[input_label],filter_chain[output_label]'
                eqFilterString = this.eqCalculator.generateBackgroundEQ(vocalAnalysis.vocalProfile, layer.type, currentBgLabel);
            }
            
            if (eqFilterString) {
                // If EQ filter string is generated, apply it to the filter array
                filters.push(`${eqFilterString}`); 
                // Extract the output label from the generated EQ string to chain correctly
                const eqOutputLabelMatch = eqFilterString.match(/\[([^\]]+)\]$/);
                if (eqOutputLabelMatch) {
                    finalBgLabel = `[${eqOutputLabelMatch[1]}]`; // Use the output label generated by EQCalculator
                } else {
                    console.warn(`EQCalculator for layer ${layer.type} did not return a valid output label. Using previous label.`);
                    finalBgLabel = currentBgLabel; // Fallback if EQCalculator output is malformed
                }
            } else {
                // If no EQ applied, the label after volume/fades is the final one for this layer
                finalBgLabel = currentBgLabel; 
            }
            
            processedBackgroundLabels.push(finalBgLabel); // Add to list for mixing
        });

        let mixedBackgroundsLabel = '[mixedBackgrounds]'; // Label for all background layers combined
        if (processedBackgroundLabels.length > 0) {
            // Merge all processed background layers into a single stream
            filters.push(`${processedBackgroundLabels.join('')}amix=inputs=${processedBackgroundLabels.length}:duration=longest[rawMixedBackgrounds]`);

            // 3. Apply Dynamic Ducking (Sidechain Compression) to the mixed background
            if (this.config.ducking.enabled) {
                const ducking = this.config.ducking;
                // sidechaincompress: [main_input][sidechain_input]sidechaincompress=...[output]
                // Main input is rawMixedBackgrounds, sidechain input is currentVoiceLabel
                filters.push(`[rawMixedBackgrounds]${currentVoiceLabel}sidechaincompress=threshold=${ducking.threshold}:ratio=${ducking.ratio}:attack=${ducking.attack}:release=${ducking.release}${mixedBackgroundsLabel}`);
            } else {
                // If ducking is disabled, the raw mixed backgrounds become the final mixed backgrounds
                mixedBackgroundsLabel = '[rawMixedBackgrounds]'; 
            }
        } else {
            // No background layers, so no mixedBackgroundsLabel is needed for final amix
            mixedBackgroundsLabel = null;
        }

        // 4. Final Mix of Voice and (Ducked & EQ'd) Backgrounds
        let finalMixInputLabels = [currentVoiceLabel];
        if (mixedBackgroundsLabel) {
            finalMixInputLabels.push(mixedBackgroundsLabel);
        }

        if (finalMixInputLabels.length > 1) {
            // If both voice and backgrounds are present, mix them
            filters.push(`${finalMixInputLabels.join('')}amix=inputs=${finalMixInputLabels.length}:duration=first:dropout_transition=2[preMaster]`);
        } else {
            // If only voice (no backgrounds), the processed voice stream is the pre-master output
            filters.push(`${currentVoiceLabel}anull[preMaster]`); // anull ensures a valid output stream even with one input
        }

        // 5. Mastering (Loudness Normalization and Limiting) - Based on config
        const masteringConfig = this.config.mastering;
        let masterFilterChain = '[preMaster]'; // Start with the pre-master mix
        let finalOutputLabel = '[out]';

        if (masteringConfig.normalizeLoudness && this.config.processing.targetLufs) {
            // Apply loudness normalization using 'loudnorm' filter
            // I will aim for a single-pass implementation for speed, if 'measured' values are not needed.
            // For a two-pass approach, we'd run one pass to measure, then another to apply.
            // Single-pass is faster for automation.
            masterFilterChain += `,loudnorm=i=${this.config.processing.targetLufs}:tp=${this.config.processing.truePeakDb}:lra=7:print_format=json`; // tp for true peak, lra for loudness range
        }
        
        if (masteringConfig.limiterThreshold && masteringConfig.limiterAttack && masteringConfig.limiterRelease) {
             // Apply a final limiter to catch any peaks and adhere to true peak limits
             masterFilterChain += `,alimiter=level_in=1:level_out=${Math.pow(10, masteringConfig.limiterThreshold / 20)}:limit=${Math.pow(10, masteringConfig.limiterThreshold / 20)}:attack=${masteringConfig.limiterAttack}:release=${masteringConfig.limiterRelease}`;
        }

        filters.push(`${masterFilterChain}${finalOutputLabel}`); // Add mastering chain

        return filters.join(';'); // Join all filter chains with semicolons
    }

    /**
     * Generates episode metadata based on the content analysis.
     * This metadata can be used for podcast platforms, show notes, etc.
     * @param {object} analysis The content analysis result.
     * @returns {object} Metadata object.
     */
    generateMetadata(analysis) {
        return {
            title: `Lost Transmission: ${analysis.location || 'Unknown Location'} - ${analysis.mood || 'Mysterious'}`,
            description: `Miles Wandr discovers mysterious signals from ${analysis.location || 'an unknown location'}, revealing a ${analysis.mood || 'mysterious'} story. Recorded: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            duration: analysis.duration, // Total episode duration
            location: analysis.location,
            mood: analysis.mood,
            keywords: analysis.keywords.join(', '), // Join keywords into a string
            sentiment: analysis.sentimentScore,
            vocalProfile: `Dominant Freq: ${analysis.vocalProfile?.dominantFrequency.toFixed(2)}Hz, Mid Energy: ${analysis.vocalProfile?.averageEnergyByBand?.mid.toFixed(4)}`,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = TransmissionMixer;
