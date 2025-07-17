1. Prerequisites
Software Requirements
Node.js (v14+ recommended)

FFmpeg installed and accessible in your PATH

Git (optional, for cloning the repo)

Project Setup
In your terminal:

bash
Copy
Edit
git clone https://github.com/WandrTourApp/wandr-project.git
cd wandr-project/podcast-automation
npm install fluent-ffmpeg @google-cloud/speech express multer cors
2. Initialize Project Environment
Run the setup script to create required directories and verify FFmpeg:

bash
Copy
Edit
node setup.js
✅ Expected output:

python-repl
Copy
Edit
🛠️ Starting Lost Transmissions setup...
📁 Created folder: uploads
...
✅ FFmpeg is installed:
ffmpeg version 6.0 ...
3. Prepare a Test Voice File
Use a short (~30s–2m) ElevenLabs-generated MP3 voice sample:

css
Copy
Edit
/podcast-automation/audio-processing/input/sample-voice.mp3
The filename doesn't matter—just place your test file in the input/ folder or uploads folder.

4. Start the Backend Server
Launch the Express API:

bash
Copy
Edit
node server.js
✅ You should see:

arduino
Copy
Edit
🚀 Lost Transmissions backend running at http://localhost:5000
5. Test via HTTP (cURL)
Simulate file upload and processing:

bash
Copy
Edit
curl -X POST \
  -F "audio=@audio-processing/input/sample-voice.mp3" \
  http://localhost:5000/api/process
✅ Expected JSON response:

json
Copy
Edit
{
  "success": true,
  "outputUrl": "http://localhost:5000/output/transmission-1234567890.mp3",
  "metadata": { ... },
  "analysis": { ... }
}
6. Verify Output File
Navigate to:

bash
Copy
Edit
audio-processing/output/
You should find:

php-template
Copy
Edit
transmission-<timestamp>.mp3
Play this file – it should contain your voice with background ambience, music, and mastering audio layers.

7. Test via React Frontend
In a new terminal:

bash
Copy
Edit
cd frontend-interface
npm install axios
npm start
Open your browser at:

arduino
Copy
Edit
http://localhost:3000
Upload sample-voice.mp3

You should see processing status updates

A player and download link to the final episode should appear when done

✅ Expected behavior:

→ “Uploading and processing...”

→ “✅ Processing complete.”

→ Audio player appears

8. Common Issues & Troubleshooting
Problem	Cause	Solution
ffmpeg: command not found	FFmpeg not in PATH	Install FFmpeg and add to PATH
Error: No audio file uploaded.	Missing form field name	Ensure audio is used in your multipart form
Internal server error	Mixer crashed	Check console logs in mixer.js for stack trace
React UI shows blank	Frontend not running	cd frontend-interface && npm start

🎉 9. Success!
Once you've:

Obtained a processed MP3 that plays correctly,

Received expected metadata & analysis JSON,

Fully tested via both cURL and React UI;

—you can consider the core pipeline good to go.
