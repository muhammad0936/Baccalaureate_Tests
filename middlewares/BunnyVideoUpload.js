const multer = require('multer');

// Define allowed video file types
const allowedMimeTypes = [
  'video/mp4',
  'video/x-m4v',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
  'video/mpeg',
  'video/x-mpeg',
  'video/ogg',
  'video/3gpp',
  'video/x-flv',
  'video/x-ms-wmv',
  'audio/mp4',
  'audio/x-m4v',
  'audio/quicktime',
  'audio/x-msvideo',
  'audio/webm',
  'audio/x-matroska',
  'audio/mpeg',
  'audio/x-mpeg',
  'audio/ogg',
  'audio/3gpp',
  'audio/x-flv',
  'audio/x-ms-wmv',
];

// Configure multer with memory storage and file filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Check the file's MIME type
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error('Only video files are allowed!'), false); // Reject the file
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // Optional: Limit file size to 50MB
  },
});
const BunnyVideoUploader = upload.single('video');
module.exports = BunnyVideoUploader;
