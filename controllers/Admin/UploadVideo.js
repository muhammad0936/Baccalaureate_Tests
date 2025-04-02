const axios = require('axios');
const multer = require('multer');
const { Readable } = require('stream');

// Use in-memory storage so the file is available as a buffer in req.file
const storage = multer.memoryStorage();
exports.upload = multer({ storage });

// Load your environment variables
const API_KEY = process.env.BUNNY_API_KEY; // e.g., "your-bunny-api-key"
const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID; // e.g., "your-library-id"

/**
 * Controller that:
 * 1. Receives a video file (field name "video") and a title via multipart/form-data.
 * 2. Creates video metadata on Bunny Stream.
 * 3. Uploads the video file using a PUT request with a Readable stream.
 * 4. Returns a success response including the video ID and access URL.
 */
const fs = require('fs');
const path = require('path');

exports.uploadVideo = async (req, res) => {
  try {
    const file = req.files[0];
    if (!file) {
      return res.status(400).json({ error: 'Video file is missing.' });
    }
    const metadataUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos`;
    const metadataResponse = await axios.post(
      metadataUrl,
      { title: file.originalname || 'Any title' },
      {
        headers: {
          AccessKey: API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const videoId = metadataResponse.data.guid;

    const uploadUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}`;
    const binaryData = file.buffer;
    await axios.put(uploadUrl, binaryData, {
      headers: {
        AccessKey: API_KEY,
        'Content-Type': 'application/octet-stream',
      },
    });
    const playDataUrl = `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${videoId}/play?expires=0`;
    const videoPlayData = await axios.get(playDataUrl, {
      AccessKey: API_KEY,
    });
    const donwnloadUrl = videoPlayData?.data?.fallbackUrl;
    res.status(200).json({
      message: 'Video uploaded successfully!',
      video: {
        videoId,
        libraryId: LIBRARY_ID,
        accessUrl: uploadUrl,
        donwnloadUrl,
      },
    });
  } catch (error) {
    console.error(error);
    console.error(
      'Error uploading video:',
      error.response?.data || error.message
    );
    res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
};
