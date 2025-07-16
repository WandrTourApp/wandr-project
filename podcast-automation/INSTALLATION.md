# 🎙️ Lost Transmissions Audio Processor
## Complete Installation & Setup Guide

---

## 📋 **WHAT YOU'LL GET**

✅ **Automated audio mixing** - ElevenLabs voice → Professional podcast episode  
✅ **Florida-focused audio library** - Beach, Everglades, Miami, Keys atmospheres  
✅ **Intelligent content detection** - Automatically selects audio based on filename  
✅ **Professional effects** - Radio static, vintage warmth, transmission interference  
✅ **Ready-to-publish output** - Upload directly to Spotify/podcast platforms  

---

## 🚀 **SUPER SIMPLE INSTALLATION**

### **Step 1: Clone This Repository**
```bash
git clone https://github.com/WandrTourApp/wandr-project.git
cd wandr-project/podcast-automation
Step 2: Install Requirements
Install Node.js (if you don't have it):

Go to https://nodejs.org
Download the "LTS" version
Install it (just click through the installer)

Install FFmpeg (audio processing engine):
Windows:

Go to https://ffmpeg.org/download.html
Download Windows build
Extract to a folder like C:\ffmpeg
Add C:\ffmpeg\bin to your PATH environment variable

Mac:

Open Terminal
Type: brew install ffmpeg
If you don't have Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

Linux:

Open Terminal
Type: sudo apt-get install ffmpeg

Step 3: Setup the System

Install dependencies:
bashnpm install

Run setup script:
bashnode setup.js


The setup will:

Test your FFmpeg installation
Create all necessary folders
Generate sample Florida audio library
Create example scripts


🎯 HOW TO USE IT
Process Your First Transmission

Put your ElevenLabs MP3 file in the podcast-automation folder
Run the processor:
bashnode process-transmission.js your-elevenlabs-file.mp3

Get your finished episode in the output/ folder!

Smart Filename Detection
Name your files to automatically get the right atmosphere:
Florida Locations:

miles-beach-discovery.mp3 → Beach waves + mystery music
everglades-adventure.mp3 → Swamp sounds + adventure theme
miami-urban-exploration.mp3 → City ambience + exploration music
keys-mystery.mp3 → Island atmosphere + mysterious tones

Mood Keywords:

adventure, explore → Upbeat, adventurous music
scary, dark → Tense, dramatic atmosphere
calm, peaceful → Gentle, soothing tones
mystery → Mysterious, investigative mood (default)


🎵 AUDIO LIBRARY STRUCTURE
After setup, you'll have:
podcast-automation/
├── audio-library/
│   ├── ambience/
│   │   ├── florida-beach-waves.mp3
│   │   ├── everglades-swamp.mp3
│   │   ├── miami-urban.mp3
│   │   ├── florida-keys-water.mp3
│   │   └── florida-ambient.mp3
│   ├── music/
│   │   ├── coastal-mystery.mp3
│   │   ├── swamp-atmosphere.mp3
│   │   ├── urban-exploration.mp3
│   │   ├── island-mystery.mp3
│   │   └── general-mystery.mp3
│   └── effects/
│       ├── radio-static.mp3
│       ├── transmission-interference.mp3
│       └── vintage-radio-warmth.mp3
├── output/           (Your finished transmissions)
├── process-transmission.js
├── setup.js
└── package.json

🔧 CUSTOMIZATION
Replace Sample Audio
The setup creates basic generated sounds. Replace them with real Florida recordings:

Record your own Florida ambiences (beach, Everglades, etc.)
Download royalty-free music and effects
Replace files in audio-library/ folders
Keep the same filenames so the system knows which audio to use

Add New Locations
Edit process-transmission.js to add new detection keywords and corresponding audio files.

🎧 WHAT THE OUTPUT SOUNDS LIKE
Your finished Lost Transmissions will have:
✅ Your ElevenLabs voice (clear and prominent)
✅ Background atmosphere (Florida location ambience)
✅ Subtle background music (mood-appropriate scoring)
✅ Radio transmission effects (static, interference, vintage warmth)
✅ Professional mixing (EQ, compression, balanced levels)
✅ Broadcast quality (192kbps MP3, ready for Spotify)

🤖 AI TEAM COLLABORATION
This system is being built collaboratively by:

Claude: Audio processing core and system architecture
ChatGPT: Frontend interface and user experience
Gemini: Performance optimization and advanced algorithms

For ChatGPT - Frontend Tasks:

Build web interface in /frontend-interface/
Create upload form that calls the mixer
Design processing dashboard with real-time progress
Implement audio preview and adjustment controls

For Gemini - Optimization Tasks:

Enhance algorithms in /optimization/
Improve processing speed and quality
Add advanced audio analysis features
Optimize FFmpeg command generation


🚨 TROUBLESHOOTING
"FFmpeg not found" error:

Make sure FFmpeg is installed and in your PATH
Try restarting Terminal/Command Prompt after installation
On Windows, you might need to add FFmpeg to environment variables

"File not found" error:

Make sure your ElevenLabs file is in the same folder
Check the filename spelling (no spaces or special characters work best)
Try using quotes: node process-transmission.js "my file.mp3"

No audio output:

Check that the input file is a valid audio format (MP3, WAV)
Make sure you have write permissions in the folder
Try running setup again: node setup.js


🎯 NEXT STEPS

Test with your ElevenLabs files
Replace sample audio with real Florida recordings
Process multiple episodes to build your Lost Transmissions library
Upload to Spotify or your podcast platform
Scale up with the team's advanced features


Ready to create amazing Lost Transmissions! 🚀📡

4. **Scroll down and click "Commit new file"**

**Once you do that, your GitHub repo will be COMPLETE and ready for the AI team!** 🎉
