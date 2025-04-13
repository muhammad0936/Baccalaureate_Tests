const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Lesson = require('../../models/Lesson');
const { default: mongoose } = require('mongoose');
const { default: axios } = require('axios');

exports.createQuestionGroup = [
  body('paragraph')
    .optional()
    .isString()
    .withMessage('يجب أن تكون الفقرة نصية.'),

  body('image.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),

  body('lesson').notEmpty().isMongoId().withMessage('معرف الدرس غير صالح.'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('يجب إدخال مجموعة من الأسئلة.'),

  // Add infoImages validations
  body('questions.*.infoImages')
    .optional()
    .isArray()
    .withMessage('يجب أن تكون صور المعلومات مصفوفة.'),
  body('questions.*.infoImages.*.filename')
    .notEmpty()
    .withMessage('اسم ملف صورة المعلومات مطلوب.')
    .isString(),
  body('questions.*.infoImages.*.accessUrl')
    .notEmpty()
    .withMessage('رابط الوصول لصورة المعلومات مطلوب.')
    .isString(),

  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      if (!question.text?.trim()) {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }

      if (!question.choices?.length || question.choices.length < 2) {
        throw new Error(
          `يجب أن يحتوي السؤال رقم ${index + 1} على خيارين على الأقل.`
        );
      }

      question.choices.forEach((choice, choiceIndex) => {
        if (!choice.text?.trim()) {
          throw new Error(
            `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
              choiceIndex + 1
            }.`
          );
        }
      });

      const correctChoices = question.choices.filter((c) => c.isCorrect).length;
      if (correctChoices < 1) {
        throw new Error(
          `يجب تحديد إجابة صحيحة واحدة على الأقل في السؤال رقم ${index + 1}.`
        );
      }

      // Validate infoImages structure
      if (question.infoImages) {
        question.infoImages.forEach((img, imgIndex) => {
          if (!img.filename?.trim()) {
            throw new Error(
              `اسم الملف مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
          if (!img.accessUrl?.trim()) {
            throw new Error(
              `رابط الوصول مطلوب لصورة المعلومات ${imgIndex + 1} في السؤال ${
                index + 1
              }.`
            );
          }
        });
      }
    });
    return true;
  }),

  body('questions.*.text').notEmpty().withMessage('نص السؤال مطلوب.'),
  body('questions.*.isMultipleChoice')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isMultipleChoice قيمة منطقية.'),
  body('questions.*.isEnglish')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isEnglish قيمة منطقية.'),
  body('questions.*.choices')
    .isArray({ min: 2 })
    .withMessage('الخيارات يجب أن تكون قائمة تحتوي على خيارين على الأقل.'),
  body('questions.*.choices.*.text')
    .notEmpty()
    .withMessage('نص الاختيار مطلوب.'),
  body('questions.*.choices.*.isCorrect')
    .optional()
    .isBoolean()
    .withMessage('يجب أن يكون isCorrect قيمة منطقية.'),
  body('questions.*.information')
    .optional()
    .isString()
    .withMessage('يجب أن تكون المعلومات نصاً.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const groupData = req.body;
      // Verify lesson exists
      const lessonExists = await Lesson.exists({ _id: groupData.lesson });
      if (!lessonExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، الدرس المحدد غير موجود.' });
      }

      const newGroup = new QuestionGroup(groupData);
      await newGroup.save();

      res.status(201).json({
        message: 'تم إنشاء مجموعة الأسئلة بنجاح.',
        group: newGroup,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

exports.getQuestionGroups = async (req, res) => {
  try {
    await ensureIsAdmin(req.userId);
    const { limit = 10, page = 1, lesson } = req.query;

    if (!lesson) {
      return res.status(400).json({ message: 'معرف الدرس مطلوب.' });
    }

    const filter = { lesson: new mongoose.Types.ObjectId(lesson) };
    const pageSize = parseInt(limit);
    const currentPage = parseInt(page);

    const [groups, totalGroups] = await Promise.all([
      QuestionGroup.find(filter)
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),
      QuestionGroup.countDocuments(filter),
    ]);

    res.status(200).json({
      docs: groups,
      totalDocs: totalGroups,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalGroups / pageSize),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.deleteQuestionGroup = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف السؤال بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const questionGroupId = req.params.id;
      const group = await QuestionGroup.findById(questionGroupId);

      if (!group) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على السؤال.' });
      }

      // Capture all files for deletion
      const bunnyDeletions = [];

      // Group image
      if (group.image?.accessUrl) {
        bunnyDeletions.push({
          type: 'question_image',
          accessUrl: group.image.accessUrl,
        });
      }

      // Info images from questions
      group.questions.forEach((question) => {
        if (question.infoImages) {
          question.infoImages.forEach((img) => {
            if (img.accessUrl) {
              bunnyDeletions.push({
                type: 'question_info_image',
                accessUrl: img.accessUrl,
              });
            }
          });
        }
      });

      // Delete the entire question group
      await QuestionGroup.deleteOne({ _id: questionGroupId });

      // Process file deletions
      const deletionResults = [];
      for (const file of bunnyDeletions) {
        try {
          await axios.delete(file.accessUrl, {
            headers: {
              Accept: 'application/json',
              AccessKey: process.env.BUNNY_STORAGE_API_KEY,
            },
          });
          deletionResults.push({ type: file.type, status: 'success' });
        } catch (error) {
          deletionResults.push({
            type: file.type,
            status: 'error',
            error: error.response?.data || error.message,
          });
        }
      }

      res.status(200).json({
        message: 'تم حذف مجموعة الأسئلة بنجاح.',
        details: {
          databaseDeleted: true,
          bunnyDeletions: deletionResults,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ في الخادم.',
        details: {
          databaseDeleted: false,
          bunnyDeletions: [],
        },
      });
    }
  },
];
