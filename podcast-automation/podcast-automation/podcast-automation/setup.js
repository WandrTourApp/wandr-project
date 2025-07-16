#!/usr/bin/env node

/**
 * Lost Transmissions Setup Script
 * 
 * This script automatically:
 * - Creates folder structure
 * - Downloads sample audio files
 * - Sets up the system for first use
 * - Tests FFmpeg installation
 * 
 * Run: node setup.js
 */

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

class LostTransmissionsSetup {
    constructor() {
        this.audioLibDir = './audio-library';
        this.outputDir = './output';
        this.tempDir = './temp';
    }

    /**
     * Main setup function
     */
    async setup() {
        try {
            console.log('🎙️ Lost Transmissions Setup Starting...');
            console.log('');
            
            // Test FFmpeg
            await this.testFFmpeg();
            
            // Create directories
            this.createDirectories();
            
            // Create sample audio library
            await this.createSampleAudioLibrary();
            
            // Create example files
            this.createExampleFiles();
            
            console.log('✅ Setup complete!');
            console.log('');
            console.log('🚀 Ready to process Lost Transmissions!');
            console.log('');
            console.log('Next steps:');
            console.log('1. Put your ElevenLabs MP3 file in this folder');
            console.log('2. Run: node process-transmission.js your-file.mp3');
            console.log('3. Get your finished Lost Transmission!');
            console.log('');
            
        } catch (error) {
            console.error('❌ Setup failed:', error.message);
            console.error('');
            console.error('🔧 Please check:');
            console.error('- FFmpeg is installed on your system');
            console.error('- You have write permissions in this directory');
            console.error('- Node.js is properly installed');
        }
    }

    /**
     * Test FFmpeg installation
     */
    async testFFmpeg() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Testing FFmpeg installation...');
            
            ffmpeg()
                .input('anullsrc=channel_layout=stereo:sample_rate=44100')
                .inputFormat('lavfi')
                .duration(1)
                .audioCodec('libmp3lame')
                .save('./temp-test.mp3')
                .on('end', () => {
                    // Clean up test file
                    if (fs.existsSync('./temp-test.mp3')) {
                        fs.unlinkSync('./temp-test.mp3');
                    }
                    console.log('✅ FFmpeg working correctly!');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('❌ FFmpeg test failed:', err.message);
                    console.error('');
                    console.error('Please install FFmpeg:');
                    console.error('- Windows: Download from https://ffmpeg.org/download.html');
                    console.error('- Mac: brew install ffmpeg');
                    console.error('- Linux: apt-get install ffmpeg');
                    reject(err);
                });
        });
    }

    /**
     * Create necessary directories
     */
    createDirectories() {
        console.log('📁 Creating directory structure...');
        
        const dirs = [
            this.audioLibDir,
            path.join(this.audioLibDir, 'ambience'),
            path.join(this.audioLibDir, 'music'),
            path.join(this.audioLibDir, 'effects'),
            this.outputDir,
            this.tempDir
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`  ✅ Created: ${dir}`);
            } else {
                console.log(`  📂 Exists: ${dir}`);
            }
        });
    }

    /**
     * Create sample audio library with generated sounds
     */
    async createSampleAudioLibrary() {
        console.log('🎵 Creating sample audio library...');
        console.log('   (These are basic generated sounds - you can replace with real Florida audio later)');
        
        const audioFiles = [
            // Ambience
            { path: 'ambience/florida-beach-waves.mp3', type: 'ocean', duration: 30 },
            { path: 'ambience/everglades-swamp.mp3', type: 'swamp', duration: 30 },
            { path: 'ambience/miami-urban.mp3', type: 'city', duration: 30 },
            { path: 'ambience/florida-keys-water.mp3', type: 'water', duration: 30 },
            { path: 'ambience/florida-ambient.mp3', type: 'ambient', duration: 30 },
            
            // Music
            { path: 'music/coastal-mystery.mp3', type: 'music-low', duration: 45 },
            { path: 'music/swamp-atmosphere.mp3', type: 'music-dark', duration: 45 },
            { path: 'music/urban-exploration.mp3', type: 'music-urban', duration: 45 },
            { path: 'music/island-mystery.mp3', type: 'music-tropical', duration: 45 },
            { path: 'music/general-mystery.mp3', type: 'music-mystery', duration: 45 },
            
            // Effects
            { path: 'effects/radio-static.mp3', type: 'static', duration: 10 },
            { path: 'effects/transmission-interference.mp3', type: 'interference', duration: 8 },
            { path: 'effects/vintage-radio-warmth.mp3', type: 'vintage', duration: 15 }
        ];
        
        for (const file of audioFiles) {
            const fullPath = path.join(this.audioLibDir, file.path);
            
            if (!fs.existsSync(fullPath)) {
                console.log(`  🎼 Generating: ${file.path}`);
                await this.generateAudioFile(fullPath, file.type, file.duration);
            } else {
                console.log(`  🎵 Exists: ${file.path}`);
            }
        }
    }

    /**
     * Generate audio files based on type
     */
    async generateAudioFile(outputPath, type, duration) {
        return new Promise((resolve, reject) => {
            let audioCommand;
            
            switch (type) {
                case 'ocean':
                    // Generate ocean wave simulation
                    audioCommand = ffmpeg()
                        .input('anoisesrc=duration=' + duration + ':color=brown:seed=42')
                        .inputFormat('lavfi')
                        .audioFilters([
                            'lowpass=f=800',
                            'highpass=f=50',
                            'volume=0.3'
                        ]);
                    break;
                    
                case 'swamp':
                    // Generate swamp ambience
                    audioCommand = ffmpeg()
                        .input('anoisesrc=duration=' + duration + ':color=brown:seed=123')
                        .inputFormat('lavfi')
                        .audioFilters([
                            'lowpass=f=600',
                            'highpass=f=30',
                            'volume=0.25'
                        ]);
                    break;
                    
                case 'city':
                    // Generate urban ambience
                    audioCommand = ffmpeg()
                        .input('anoisesrc=duration=' + duration + ':color=white:seed=456')
                        .inputFormat('lavfi')
                        .audioFilters([
                            'lowpass=f=2000',
                            'highpass=f=100',
                            'volume=0.2'
                        ]);
                    break;
                    
                case 'static':
                    // Generate radio static
                    audioCommand = ffmpeg()
                        .input('anoisesrc=duration=' + duration + ':color=white:seed=789')
                        .inputFormat('lavfi')
                        .audioFilters([
                            'highpass=f=1000',
                            'volume=0.15'
                        ]);
                    break;
                    
                case 'interference':
                    // Generate transmission interference
                    audioCommand = ffmpeg()
                        .input('anoisesrc=duration=' + duration + ':color=pink:seed=321')
                        .inputFormat('lavfi')
                        .audioFilters([
                            'bandpass=f=1500:width_type=h:w=500',
                            'volume=0.1'
                        ]);
                    break;
                    
                default:
                    // Generate silence for music/other types (to be replaced later)
                    audioCommand = ffmpeg()
                        .input('anullsrc=channel_layout=stereo:sample_rate=44100')
                        .inputFormat('lavfi')
                        .duration(duration);
                    break;
            }
            
            audioCommand
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .audioChannels(2)
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });
    }

    /**
     * Create example files and documentation
     */
    createExampleFiles() {
        console.log('📄 Creating example files...');
        
        // Create README
        const readme = `# Lost Transmissions Audio Processor

## Quick Start

1. Put your ElevenLabs MP3 file in this folder
2. Run: \`node process-transmission.js your-file.mp3\`
3. Find your finished transmission in the \`output/\` folder!

## File Naming Tips

The system detects location and mood from your filename:

### Locations (Florida-focused):
- \`beach\`, \`coast\`, \`ocean\` → Beach ambience
- \`everglades\`, \`swamp\`, \`marsh\` → Swamp atmosphere  
- \`miami\`, \`city\` → Urban sounds
- \`keys\`, \`key west\` → Island vibes

### Moods:
- \`adventure\`, \`explore\` → Adventurous music
- \`scary\`, \`dark\` → Tense atmosphere
- \`calm\`, \`peaceful\` → Peaceful tones

## Examples:
- \`miles-everglades-adventure.mp3\` → Swamp ambience + adventure music
- \`beach-mystery-discovery.mp3\` → Beach waves + mysterious tones
- \`miami-urban-exploration.mp3\` → City sounds + exploration theme

## Customizing Audio

Replace files in \`audio-library/\` with your own Florida recordings:
- \`ambience/\` → Background environmental sounds
- \`music/\` → Background music/scoring
- \`effects/\` → Radio static and transmission effects

## Output

Your finished Lost Transmissions will be in the \`output/\` folder, ready to upload to Spotify or your podcast platform!
`;

        fs.writeFileSync('./README.md', readme);
        console.log('  ✅ Created: README.md');
        
        // Create example batch script for Windows
        const batchScript = `@echo off
echo Lost Transmissions Processor
echo.
echo Drop your ElevenLabs MP3 file here and press Enter
set /p filename="Filename: "
echo.
echo Processing transmission...
node process-transmission.js "%filename%"
echo.
pause
`;

        fs.writeFileSync('./process-transmission.bat', batchScript);
        console.log('  ✅ Created: process-transmission.bat (Windows)');
        
        // Create example shell script for Mac/Linux
        const shellScript = `#!/bin/bash
echo "Lost Transmissions Processor"
echo
echo "Drop your ElevenLabs MP3 file here and press Enter"
read -p "Filename: " filename
echo
echo "Processing transmission..."
node process-transmission.js "$filename"
echo
read -p "Press Enter to continue..."
`;

        fs.writeFileSync('./process-transmission.sh', shellScript);
        fs.chmodSync('./process-transmission.sh', '755');
        console.log('  ✅ Created: process-transmission.sh (Mac/Linux)');
    }
}

// Main execution
async function main() {
    const setup = new LostTransmissionsSetup();
    await setup.setup();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = LostTransmissionsSetup;
