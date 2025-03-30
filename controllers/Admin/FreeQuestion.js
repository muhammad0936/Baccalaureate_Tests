const FreeQuestionGroup = require('../../models/FreeQuestionGroup');
const QuestionGroup = require('../../models/QuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Lesson = require('../../models/Lesson');

exports.copyQuestionsToFree = [
  body('numOfGroups')
    .isInt({ min: 1 })
    .withMessage('يرجى إدخال عدد المجموعات كرقم صحيح أكبر من صفر.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { numOfGroups } = req.body;
      let totalCopied = 0;

      // حذف جميع المجموعات المجانية الحالية
      await FreeQuestionGroup.deleteMany({});

      // جلب جميع المواد التي تحتوي على مجموعات أسئلة
      const lessons = await Lesson.find({
        _id: { $in: await QuestionGroup.distinct('lesson') },
      });

      // معالجة كل مادة
      for (const lesson of lessons) {
        // اختيار مجموعات عشوائية من المادة الحالية
        const groups = await QuestionGroup.aggregate([
          { $match: { lesson: lesson._id } },
          { $sample: { size: numOfGroups } },
          {
            $project: {
              __v: 0,
              createdAt: 0,
              updatedAt: 0,
              'questions._id': 0,
              'questions.createdAt': 0,
              'questions.updatedAt': 0,
            },
          },
        ]);

        if (groups.length === 0) continue;

        // إنشاء نسخة جديدة من المجموعات مع إزالة المعرفات
        const groupsToInsert = groups.map((group) => ({
          ...group,
          questions: group.questions.map((question) => ({
            ...question,
            choices: question.choices.map((choice) => ({
              ...choice,
              _id: new mongoose.Types.ObjectId(),
            })),
          })),
        }));

        // إدخال المجموعات في المجموعات المجانية
        const result = await FreeQuestionGroup.insertMany(groupsToInsert);
        totalCopied += result.length;
      }

      res.status(200).json({
        message: `تم استبدال جميع المجموعات المجانية بنجاح وإضافة ${totalCopied} مجموعة جديدة.`,
        totalCopied,
        lessonsProcessed: lessons.length,
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || 'حدث خطأ أثناء معالجة الطلب.',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      });
    }
  },
];
