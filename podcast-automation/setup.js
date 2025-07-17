const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const foldersToCreate = [
  "uploads",
  "audio-processing/output",
  "audio-libraries/ambience",
  "audio-libraries/music",
  "audio-libraries/transmission-effects",
  "audio-libraries/structural/intros",
  "audio-libraries/structural/outros"
];

function ensureFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, ".gitkeep"), "");
    console.log(`📁 Created folder: ${folderPath}`);
  } else {
    console.log(`✔️ Folder exists: ${folderPath}`);
  }
}

function checkFFmpeg() {
  console.log("🔍 Checking FFmpeg installation...");
  exec("ffmpeg -version", (error, stdout, stderr) => {
    if (error) {
      console.error("❌ FFmpeg is not installed or not found in PATH.");
      console.error("Please install FFmpeg before running the podcast processor.");
    } else {
      console.log("✅ FFmpeg is installed:");
      console.log(stdout.split("\n")[0]); // Print version line
    }
  });
}

console.log("🛠️ Starting Lost Transmissions setup...");

foldersToCreate.forEach((relativePath) => {
  const fullPath = path.join(__dirname, relativePath);
  ensureFolder(fullPath);
});

checkFFmpeg();
