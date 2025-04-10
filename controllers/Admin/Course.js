const mongoose = require('mongoose');
const Course = require('../../models/Course');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Material = require('../../models/Material');
const Teacher = require('../../models/Teacher');
const { default: axios } = require('axios');

// Create a new course
exports.createCourse = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الدورة.'),
  body('description')
    .optional()
    .isString()
    .withMessage('وصف الدورة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  body('teacher').isMongoId().withMessage('معرف المدرس غير صحيح.'),
  // Correct the field names to use lowercase 'promoVideo720'
  body('promoVideo720.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط الوصول للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.videoId')
    .optional()
    .isString()
    .withMessage('معرف الفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.libraryId')
    .optional()
    .isString()
    .withMessage('معرف المكتبة للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),
  body('promoVideo720.downloadUrl')
    .optional()
    .isString()
    .withMessage('رابط التنزيل للفيديو الترويجي بجودة 720 يجب أن يكون نصاً.'),

  // Add validation for seekPoints
  body('seekPoints')
    .optional()
    .isArray()
    .withMessage('seekPoints يجب أن تكون مصفوفة.'),
  body('seekPoints.*.moment')
    .notEmpty()
    .isString()
    .withMessage('moment يجب أن يكون نصاً ولا يمكن أن يكون فارغاً.'),
  body('seekPoints.*.description')
    .notEmpty()
    .isString()
    .withMessage('الوصف يجب أن يكون نصاً ولا يمكن أن يكون فارغاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const teacherExists = await Teacher.exists({ _id: req.body.teacher });
      if (!teacherExists)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المدرس.' });
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists)
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      if (req.body.promoVideo720) {
        const playDataUrl = `https://video.bunnycdn.com/library/${req.body.promoVideo720?.libraryId}/videos/${req.body.promoVideo720?.videoId}/play?expires=0`;
        const videoPlayData = await axios.get(playDataUrl, {
          // AccessKey: API_KEY,
        });
        req.body.promoVideo720.downloadUrl = videoPlayData?.data?.fallbackUrl;
      }
      const course = new Course(req.body);
      await course.save();
      // Include seekPoints in the destructured object
      const {
        _id,
        name,
        description,
        material,
        teacher,
        promoVideo720,
        seekPoints,
      } = course;
      res.status(201).json({
        course: {
          _id,
          name,
          description,
          material,
          teacher,
          promoVideo720,
          seekPoints, // Include seekPoints in the response
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || err.status || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// controllers/courseController.js

exports.getCourses = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { page, limit, name, description, material, teacher } = req.query;

    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (description) {
      filter.description = { $regex: description, $options: 'i' };
    }

    if (material) {
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      filter.material = new mongoose.Types.ObjectId(material);
    }

    if (teacher) {
      const teacherExists = await Teacher.exists({ _id: teacher });
      if (!teacherExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المدرس.' });
      }
      filter.teacher = new mongoose.Types.ObjectId(teacher);
    }

    const courses = await Course.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      // populate: [
      //   { path: 'material', select: 'name' },
      //   { path: 'teacher', select: 'fname lname phone' },
      // ],
      select: 'name description material teacher promoVideo720 seekPoints',
    });

    return res.status(200).json(courses);
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Delete a course by ID
exports.deleteCourse = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الدورة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const course = await Course.findByIdAndDelete(req.params.id);
      if (!course) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الدورة.' });
      }
      try {
        deletionResponse = await axios.delete(course.promoVideo720.accessUrl, {
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

      // }
      // console.log(deletionResponse?.data);
      res.status(200).json({ message: 'تم حذف الدورة بنجاح.' });
    } catch (err) {
      // console.error(err);
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
