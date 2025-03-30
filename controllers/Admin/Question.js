const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const Lesson = require('../../models/Lesson');
const { default: mongoose } = require('mongoose');

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

  body('questions').custom((questions) => {
    questions.forEach((question, index) => {
      // Validate question text
      if (!question.text?.trim()) {
        throw new Error(`نص السؤال مطلوب للسؤال رقم ${index + 1}.`);
      }

      // All questions must have at least 2 choices
      if (!question.choices?.length || question.choices.length < 2) {
        throw new Error(
          `يجب أن يحتوي السؤال رقم ${index + 1} على خيارين على الأقل.`
        );
      }

      // Validate choices structure
      question.choices.forEach((choice, choiceIndex) => {
        if (!choice.text?.trim()) {
          throw new Error(
            `نص الاختيار مطلوب في السؤال رقم ${index + 1}, الاختيار رقم ${
              choiceIndex + 1
            }.`
          );
        }
      });

      // Validate correct answers based on isMultipleChoice
      const correctChoices = question.choices.filter((c) => c.isCorrect).length;
      if (correctChoices < 1) {
        throw new Error(
          `يجب تحديد إجابة صحيحة واحدة على الأقل في السؤال رقم ${index + 1}.`
        );
      }
    });
    return true;
  }),

  // Question validations
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
          .json({ message: 'عذراً، الدرس المحددة غير موجودة.' });
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

      const questionId = req.params.id;
      const group = await QuestionGroup.findById(questionId);

      if (!group) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على السؤال.' });
      }

      // Remove the question from the array
      group.questions.pull(questionId);
      await group.save();

      // Delete the group if empty
      if (group.questions.length === 0) {
        await QuestionGroup.findByIdAndDelete(group._id);
      }

      res.status(200).json({ message: 'تم حذف السؤال بنجاح.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
