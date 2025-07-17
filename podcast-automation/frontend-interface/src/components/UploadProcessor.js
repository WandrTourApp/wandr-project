import React, { useState } from "react";
import axios from "axios";

function UploadProcessor() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState("");
  const [outputUrl, setOutputUrl] = useState("");

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setStatus("");
    setOutputUrl("");
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select an audio file first.");
      return;
    }

    const formData = new FormData();
    formData.append("audio", selectedFile);

    setStatus("Uploading and processing...");

    try {
      const res = await axios.post("http://localhost:5000/api/process", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setStatus("✅ Processing complete.");
        setOutputUrl(res.data.outputUrl);
      } else {
        setStatus("❌ Error: " + res.data.error);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Server error.");
    }
  };

  return (
    <div className="upload-container">
      <h1>🎙️ Lost Transmissions Processor</h1>
      <input type="file" accept="audio/*" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload & Process</button>
      <p>{status}</p>
      {outputUrl && (
        <>
          <audio controls src={outputUrl} />
          <a href={outputUrl} download>Download Final Episode</a>
        </>
      )}
    </div>
  );
}

export default UploadProcessor;
