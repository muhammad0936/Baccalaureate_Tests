const FreeQuestion = require('../../models/FreeQuestionGroup');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');
const { shuffleArray } = require('../../util/shuffleArray');
const Lesson = require('../../models/Lesson');
const { default: mongoose } = require('mongoose');
const Student = require('../../models/Student');
exports.getFreeQuestions = async (req, res) => {
  try {
    const { limit, lesson } = req.query;

    const validLesson = await Lesson.findById(lesson);

    if (!validLesson) {
      return res.status(404).json({
        message: 'لم يتم العثور على الدرس',
      });
    }

    // Get random questions
    const sampleSize = parseInt(limit, 10) || 10;
    const questions = await FreeQuestion.aggregate([
      { $match: { lesson: new mongoose.Types.ObjectId(lesson) } },
      { $sample: { size: sampleSize } },
      { $project: { __v: 0 } },
    ]);

    // Populate lesson name
    // const populatedQuestions = await FreeQuestion.populate(questions, {
    //   path: 'lesson',
    //   select: 'name',
    // });

    res.status(200).json({
      docs: questions,
      limit: sampleSize,
      total: questions.length,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
