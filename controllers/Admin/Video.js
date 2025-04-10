const mongoose = require('mongoose');
const Video = require('../../models/Video');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { default: axios } = require('axios');

// Create a new video
exports.createVideo = [
  body('name').notEmpty().withMessage('اسم الفيديو مطلوب.'),
  body('course').isMongoId().withMessage('معرف الدورة غير صالح.'),
  body('video720.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول لفيديو 720 نصاً.'),
  body('video720.videoId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف الفيديو لفيديو 720 نصاً.'),
  body('video720.libraryId')
    .optional()
    .isString()
    .withMessage('يجب أن يكون معرف المكتبة لفيديو 720 نصاً.'),
  body('video720.downloadUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط التنزيل لفيديو 720 نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      // Verify if the associated course exists
      const courseExists = await Course.exists({ _id: req.body.course });
      if (!courseExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
      }
      if (req.body.video720) {
        const playDataUrl = `https://video.bunnycdn.com/library/${req.body.video720?.libraryId}/videos/${req.body.video720?.videoId}/play?expires=0`;
        const videoPlayData = await axios.get(playDataUrl, {
          // AccessKey: API_KEY,
        });
        req.body.video720.downloadUrl = videoPlayData?.data?.fallbackUrl;
      }
      const video = new Video(req.body);
      await video.save();

      // Destructure to send back an appropriate response
      const { _id, name, video720, course, seekPoints } = video;
      res.status(201).json({
        video: { _id, name, video720, course, seekPoints },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get videos with pagination and filters
exports.getVideos = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    // Destructure pagination and filter parameters from the query string
    const { page, limit, name, course } = req.query;
    const filter = {};

    // Filter based on video name using a case-insensitive regex
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (!course) {
      return res.status(400).json({ message: 'معرف الدورة مطلوب.' });
    }

    // Verify if the provided course exists
    const courseExists = await Course.exists({ _id: course });
    if (!courseExists) {
      return res
        .status(400)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
    }
    filter.course = new mongoose.Types.ObjectId(course);

    // Paginate videos based on filter and pagination options
    const videos = await Video.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      populate: { path: 'course', select: 'name description' },
      select: 'name video course video720 seekPoints',
    });

    res.status(200).json(videos);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

// Delete a video by ID
exports.deleteVideo = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف الفيديو بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const video = await Video.findByIdAndDelete(req.params.id);
      if (!video) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الفيديو.' });
      }
      try {
        deletionResponse = await axios.delete(video.video720.accessUrl, {
          headers: {
            Accept: 'application/json',
            AccessKey: process.env.BUNNY_API_KEY,
          },
        });
      } catch (deleteError) {
        if (deleteError.response && deleteError.response.status === 404) {
          console.log('Video not found, skipping deletion.');
        } else {
          // Re-throw other errors
          throw deleteError;
        }
      }
      res.status(200).json({ message: 'تم حذف الفيديو بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
