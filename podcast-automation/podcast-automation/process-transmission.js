#!/usr/bin/env node

/**
 * Lost Transmissions - Main Processing Script
 * 
 * USAGE: node process-transmission.js <your-elevenlabs-file.mp3>
 * 
 * This script takes your ElevenLabs voice file and automatically:
 * - Analyzes content for location/mood
 * - Selects appropriate Florida audio
 * - Mixes professional-quality transmission
 * - Outputs ready-to-publish episode
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

class LostTransmissionsProcessor {
    constructor() {
        this.outputDir = './output';
        this.audioLibDir = './audio-library';
        
        // Create directories if they don't exist
        this.ensureDirectories();
        
        // Florida-focused audio mappings
        this.audioMappings = {
            locations: {
                beach: {
                    ambience: 'florida-beach-waves.mp3',
                    music: 'coastal-mystery.mp3'
                },
                everglades: {
                    ambience: 'everglades-swamp.mp3',
                    music: 'swamp-atmosphere.mp3'
                },
                miami: {
                    ambience: 'miami-urban.mp3',
                    music: 'urban-exploration.mp3'
                },
                keys: {
                    ambience: 'florida-keys-water.mp3',
                    music: 'island-mystery.mp3'
                },
                default: {
                    ambience: 'florida-ambient.mp3',
                    music: 'general-mystery.mp3'
                }
            },
            effects: {
                radioStatic: 'radio-static.mp3',
                interference: 'transmission-interference.mp3',
                vintage: 'vintage-radio-warmth.mp3'
            }
        };
    }

    /**
     * Main processing function
     */
    async processTransmission(inputFile, options = {}) {
        try {
            console.log('🎙️ Starting Lost Transmission processing...');
            console.log('📁 Input:', inputFile);
            
            // Validate input file
            if (!fs.existsSync(inputFile)) {
                throw new Error(`Input file not found: ${inputFile}`);
            }
            
            // Analyze content
            const analysis = await this.analyzeContent(inputFile);
            console.log('📊 Analysis:', analysis);
            
            // Select audio files
            const audioFiles = this.selectAudioFiles(analysis);
            console.log('🎵 Selected audio:', audioFiles);
            
            // Generate output filename
            const outputFile = this.generateOutputFilename(analysis);
            
            // Process audio
            await this.mixAudio(inputFile, audioFiles, outputFile);
            
            // Generate metadata
            const metadata = this.generateMetadata(analysis, outputFile);
            
            console.log('✅ Lost Transmission complete!');
            console.log('🎯 Output:', outputFile);
            
            return {
                success: true,
                outputFile: outputFile,
                metadata: metadata,
                analysis: analysis
            };
            
        } catch (error) {
            console.error('❌ Processing failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze content for automatic audio selection
     */
    async analyzeContent(inputFile) {
        const filename = path.basename(inputFile).toLowerCase();
        
        // Basic content analysis from filename and audio properties
        let location = 'default';
        let mood = 'mysterious';
        let intensity = 'medium';
        
        // Location detection
        if (filename.includes('beach') || filename.includes('coast') || filename.includes('ocean')) {
            location = 'beach';
        } else if (filename.includes('everglades') || filename.includes('swamp') || filename.includes('marsh')) {
            location = 'everglades';
        } else if (filename.includes('miami') || filename.includes('city')) {
            location = 'miami';
        } else if (filename.includes('keys') || filename.includes('key west')) {
            location = 'keys';
        }
        
        // Mood detection
        if (filename.includes('adventure') || filename.includes('explore')) {
            mood = 'adventurous';
            intensity = 'high';
        } else if (filename.includes('scary') || filename.includes('dark')) {
            mood = 'tense';
            intensity = 'high';
        } else if (filename.includes('calm') || filename.includes('peaceful')) {
            mood = 'peaceful';
            intensity = 'low';
        }
        
        // Get audio duration
        const duration = await this.getAudioDuration(inputFile);
        
        return {
            location: location,
            mood: mood,
            intensity: intensity,
            duration: duration,
            filename: filename
        };
    }

    /**
     * Select appropriate audio files based on analysis
     */
    selectAudioFiles(analysis) {
        const locationMapping = this.audioMappings.locations[analysis.location] || 
                               this.audioMappings.locations.default;
        
        return {
            ambience: path.join(this.audioLibDir, 'ambience', locationMapping.ambience),
            music: path.join(this.audioLibDir, 'music', locationMapping.music),
            static: path.join(this.audioLibDir, 'effects', this.audioMappings.effects.radioStatic),
            interference: path.join(this.audioLibDir, 'effects', this.audioMappings.effects.interference)
        };
    }

    /**
     * Mix audio using FFmpeg with professional settings
     */
    async mixAudio(voiceFile, audioFiles, outputFile) {
        return new Promise((resolve, reject) => {
            console.log('🎛️ Mixing audio layers...');
            
            let command = ffmpeg();
            let inputIndex = 0;
            let filterParts = [];
            let mixInputs = [];
            
            // Add voice (primary)
            command.input(voiceFile);
            filterParts.push(`[${inputIndex}:a]volume=0.85,equalizer=f=3000:g=3[voice]`);
            mixInputs.push('[voice]');
            inputIndex++;
            
            // Add ambience if exists
            if (fs.existsSync(audioFiles.ambience)) {
                command.input(audioFiles.ambience);
                filterParts.push(`[${inputIndex}:a]volume=0.25,equalizer=f=8000:g=-6[amb]`);
                mixInputs.push('[amb]');
                inputIndex++;
            }
            
            // Add music if exists
            if (fs.existsSync(audioFiles.music)) {
                command.input(audioFiles.music);
                filterParts.push(`[${inputIndex}:a]volume=0.15,equalizer=f=2000:g=-3[music]`);
                mixInputs.push('[music]');
                inputIndex++;
            }
            
            // Add static if exists
            if (fs.existsSync(audioFiles.static)) {
                command.input(audioFiles.static);
                filterParts.push(`[${inputIndex}:a]volume=0.08[static]`);
                mixInputs.push('[static]');
                inputIndex++;
            }
            
            // Create final mix
            const finalMix = `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[mixed]`;
            filterParts.push(finalMix);
            
            // Add final processing
            filterParts.push('[mixed]compand=attacks=0.1:decays=0.5:points=-80/-80|-20/-20|-10/-10|0/-5[out]');
            
            // Apply complex filter
            command
                .complexFilter(filterParts.join(';'), 'out')
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
                .audioChannels(2)
                .audioFrequency(44100)
                .on('start', () => {
                    console.log('⚡ FFmpeg processing started...');
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log('🎯 Audio mixing complete!');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('💥 FFmpeg error:', err.message);
                    reject(err);
                })
                .save(outputFile);
        });
    }

    /**
     * Get audio duration
     */
    async getAudioDuration(audioFile) {
        return new Promise((resolve) => {
            ffmpeg.ffprobe(audioFile, (err, metadata) => {
                if (err) {
                    resolve(0);
                } else {
                    resolve(metadata.format.duration || 0);
                }
            });
        });
    }

    /**
     * Generate output filename
     */
    generateOutputFilename(analysis) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const location = analysis.location !== 'default' ? `-${analysis.location}` : '';
        return path.join(this.outputDir, `lost-transmission-${timestamp}${location}.mp3`);
    }

    /**
     * Generate episode metadata
     */
    generateMetadata(analysis, outputFile) {
        const locationText = analysis.location !== 'default' ? 
            ` from ${analysis.location.charAt(0).toUpperCase() + analysis.location.slice(1)}` : '';
        
        return {
            title: `Lost Transmission${locationText}`,
            description: `Miles Wandr discovers mysterious signals${locationText}. What secrets lie hidden in these transmissions?`,
            location: analysis.location,
            mood: analysis.mood,
            duration: Math.round(analysis.duration),
            outputFile: outputFile,
            created: new Date().toISOString()
        };
    }

    /**
     * Ensure necessary directories exist
     */
    ensureDirectories() {
        const dirs = [
            this.outputDir,
            this.audioLibDir,
            path.join(this.audioLibDir, 'ambience'),
            path.join(this.audioLibDir, 'music'),
            path.join(this.audioLibDir, 'effects')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('');
        console.log('🎙️  Lost Transmissions Audio Processor');
        console.log('');
        console.log('Usage: node process-transmission.js <elevenlabs-file.mp3>');
        console.log('');
        console.log('Examples:');
        console.log('  node process-transmission.js miles-everglades.mp3');
        console.log('  node process-transmission.js beach-discovery.mp3');
        console.log('  node process-transmission.js miami-mystery.mp3');
        console.log('');
        console.log('The system will automatically detect location and mood from filename.');
        console.log('');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const processor = new LostTransmissionsProcessor();
    
    console.log('🚀 Lost Transmissions Automation System');
    console.log('📡 Processing transmission...');
    console.log('');
    
    const result = await processor.processTransmission(inputFile);
    
    if (result.success) {
        console.log('');
        console.log('🎉 SUCCESS! Your Lost Transmission is ready!');
        console.log('');
        console.log('📁 Output file:', result.outputFile);
        console.log('🎯 Title:', result.metadata.title);
        console.log('📝 Description:', result.metadata.description);
        console.log('⏱️  Duration:', result.metadata.duration + ' seconds');
        console.log('');
        console.log('🎧 Ready to upload to Spotify or your podcast platform!');
        console.log('');
    } else {
        console.error('');
        console.error('💥 Processing failed:', result.error);
        console.error('');
        console.error('🔧 Make sure you have:');
        console.error('- FFmpeg installed on your system');
        console.error('- Valid audio file as input');
        console.error('- Proper file permissions');
        console.error('');
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = LostTransmissionsProcessor;
