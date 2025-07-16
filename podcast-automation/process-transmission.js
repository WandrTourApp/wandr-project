#!/usr/bin/env node

/**
 * Lost Transmissions - Main Processing Script
 * Usage: node process-transmission.js <your-elevenlabs-file.mp3>
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

class LostTransmissionsProcessor {
    constructor() {
        this.outputDir = './output';
        
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir);
        }
    }

    async processTransmission(inputFile, options = {}) {
        try {
            console.log('🎙️ Starting Lost Transmission processing...');
            console.log('📁 Input:', inputFile);
            
            // Generate output filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = path.join(this.outputDir, `lost-transmission-${timestamp}.mp3`);
            
            // Basic mixing (will be enhanced with Gemini's algorithms)
            await this.mixAudio(inputFile, outputFile);
            
            console.log('✅ Lost Transmission complete!');
            console.log('🎯 Output:', outputFile);
            
            return { success: true, outputFile: outputFile };
            
        } catch (error) {
            console.error('❌ Processing failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async mixAudio(voiceFile, outputFile) {
        return new Promise((resolve, reject) => {
            console.log('🎛️ Mixing audio...');
            
            ffmpeg(voiceFile)
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
                .audioChannels(2)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log(`📊 Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    console.log('🎯 Audio processing complete!');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('💥 FFmpeg error:', err.message);
                    reject(err);
                })
                .save(outputFile);
        });
    }
}

// CLI execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🎙️ Lost Transmissions Audio Processor');
        console.log('Usage: node process-transmission.js <elevenlabs-file.mp3>');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const processor = new LostTransmissionsProcessor();
    
    const result = await processor.processTransmission(inputFile);
    
    if (result.success) {
        console.log('🎉 SUCCESS! Your Lost Transmission is ready!');
    } else {
        console.error('💥 Failed:', result.error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = LostTransmissionsProcessor;
