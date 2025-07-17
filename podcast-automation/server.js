const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

// Import the core audio engine
const TransmissionMixer = require("./audio-processing/core/mixer");

const app = express();
const port = 5000;

// Enable CORS for frontend dev access
app.use(cors());

// File storage configuration (temporary uploads folder)
const upload = multer({ dest: "uploads/" });

// Serve final output audio from public folder
app.use("/output", express.static(path.join(__dirname, "audio-processing/output")));

/**
 * POST /api/process
 * Uploads a file and processes it with the Lost Transmissions audio engine
 */
app.post("/api/process", upload.single("audio"), async (req, res) => {
  const inputFile = req.file?.path;
  if (!inputFile) {
    return res.status(400).json({ success: false, error: "No audio file uploaded." });
  }

  const mixer = new TransmissionMixer();

  try {
    const result = await mixer.processTransmission(inputFile, {});

    if (result.success) {
      const filename = path.basename(result.outputPath);
      const outputUrl = `http://localhost:${port}/output/${filename}`;

      return res.json({
        success: true,
        outputUrl: outputUrl,
        metadata: result.metadata,
        analysis: result.analysis,
      });
    } else {
      return res.status(500).json({ success: false, error: result.error || "Processing failed." });
    }
  } catch (error) {
    console.error("❌ Processing error:", error);
    return res.status(500).json({ success: false, error: "Internal server error." });
  } finally {
    // Optional: cleanup temporary upload file
    fs.unlink(inputFile, (err) => {
      if (err) console.warn("⚠️ Failed to delete temp file:", err.message);
    });
  }
});

// Start the backend server
app.listen(port, () => {
  console.log(`🚀 Lost Transmissions backend running at http://localhost:${port}`);
});
