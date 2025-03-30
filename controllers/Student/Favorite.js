// controllers/favoriteController.js

const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Student = require('../../models/Student');
const QuestionGroup = require('../../models/QuestionGroup'); // Adjust if necessary

/**
 * Controller to add a question group to a student's favorites.
 */
exports.addFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .isNumeric()
    .withMessage('موقع السؤال يجب أن يكون رقما'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index = 0 } = req.body;

      // Verify that the question group exists
      console.log(questionGroupId);
      const questionGroup = await QuestionGroup.findById(questionGroupId);
      console.log(questionGroup);
      if (!questionGroup) {
        return res.status(404).json({
          message: 'عذراً، لم يتم العثور على مجموعة الأسئلة.',
        });
      }

      // Retrieve the student
      const student = await Student.findById(studentId).populate(
        'redeemedCodes.codesGroup'
      );
      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }
      const accessibleMaterials = student.redeemedCodes
        .map((rc) => {
          return rc.codesGroup.materials.map((m) => m?.toString());
        })
        .flat();
      if (!accessibleMaterials.includes(questionGroup.material?.toString()))
        return res
          .status(400)
          .json({ message: `ليس لك صلاحية الوصول إلى هذا السؤال` });

      // Check if the question group is already in favorites
      if (
        student.favorites.some(
          (fav) =>
            fav.questionGroup?.toString() === questionGroupId &&
            fav.index === index
        )
      ) {
        return res.status(400).json({
          message: 'مجموعة الأسئلة مضافة للمفضلة من قبل.',
        });
      }
      if (questionGroup?.questions?.length <= index) {
        return res.status(400).json({
          message: `موقع السؤال غير صالح, يجب أن يكون بين 0 و ${
            questionGroup?.questions?.length - 1
          }`,
        });
      }
      // Add the question group to favorites and save
      student.favorites.push({ questionGroup: questionGroupId, index });
      await student.save();

      res.status(200).json({
        message: 'تمت إضافة مجموعة الأسئلة إلى المفضلة بنجاح.',
      });
    } catch (err) {
      console.error('Error in addFavoriteQuestionGroup:', err);
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];

/**
 * Controller to remove a question group from a student's favorites.
 */
exports.removeFavoriteQuestionGroup = [
  body('questionGroupId')
    .notEmpty()
    .withMessage('معرف مجموعة الأسئلة مطلوب.')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('صيغة معرف مجموعة الأسئلة غير صالحة.'),
  body('index')
    .notEmpty()
    .withMessage('موقع السؤال مطلوب')
    .isNumeric()
    .withMessage('موقع السؤال يجب أن يكون رقما'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index } = req.body;

      // Retrieve the student
      const student = await Student.findById(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
      }

      // Check if the question group is in favorites
      const favoriteIndex = student.favorites.findIndex(
        (fav) =>
          fav.questionGroup?.toString() === questionGroupId &&
          parseInt(index) === fav.index
      );

      if (favoriteIndex !== -1) {
        student.favorites.splice(favoriteIndex, 1);
        await student.save();
      }

      res.status(200).json({
        message:
          favoriteIndex !== -1
            ? 'تم حذف السؤال من المفضلة بنجاح.'
            : 'السؤال ليس موجودا في المفضلة مسبقا',
      });
    } catch (err) {
      console.error('Error in removeFavoriteQuestionGroup:', err);
      res.status(err.statusCode || 500).json({
        error: err.message || 'حدث خطأ في الخادم.',
      });
    }
  },
];

/**
 * Controller to retrieve the student's favorite question groups.
 */
exports.getFavoriteQuestionGroups = async (req, res) => {
  try {
    const studentId = req.userId;

    // Retrieve the student and populate the favorites field
    const student = await Student.findById(studentId).populate(
      'favorites.questionGroup',
      '-__v -createdAt -updatedAt'
    );
    // .select('favorites');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }
    let returnedFavorites = student.favorites.map((f) => {
      const questions = [f.questionGroup.questions[f.index]];
      const newF = {
        ...f.questionGroup._doc,
        questions,
        index: f.index,
      };
      return newF;
    });
    // returnedFavorites = returnedFavorites.map((r) => {
    //   delete r.questions;
    //   return r;
    // });
    // console.log(returnedFavorites);
    res.status(200).json({ favorites: returnedFavorites });
  } catch (err) {
    console.error('Error in getFavoriteQuestionGroups:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};
