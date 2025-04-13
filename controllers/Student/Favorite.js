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
    .custom((value) => {
      if (typeof value !== 'number') {
        throw new Error('موقع السؤال يجب أن يكون رقما');
      }
      return true;
    }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const studentId = req.userId;
      const { questionGroupId, index = 0 } = req.body;

      // Verify question group existence with populated material path
      const questionGroup = await QuestionGroup.findById(
        questionGroupId
      ).populate({
        path: 'lesson',
        select: 'unit',
        populate: {
          path: 'unit',
          select: 'material',
        },
      });

      if (!questionGroup?.lesson?.unit?.material) {
        return res.status(404).json({
          message:
            'عذراً، لم يتم العثور على مجموعة الأسئلة أو الدرس أو الوحدة.',
        });
      }

      const materialId = questionGroup.lesson.unit.material.toString();

      // Retrieve student with access check
      const student = await Student.findById(studentId).populate(
        'redeemedCodes.codesGroup'
      );

      if (!student) {
        return res.status(404).json({
          message: 'عذراً، لم يتم العثور على الطالب.',
        });
      }

      // Check material access through redeemed codes
      const hasAccess = student.redeemedCodes.some((redemption) => {
        return redemption.codesGroup.materials.some(
          (m) =>
            m.toString() === materialId &&
            redemption.codesGroup.expiration > new Date() &&
            redemption.codesGroup.codes.some(
              (c) => c.value === redemption.code && c.isUsed
            )
        );
      });

      if (!hasAccess) {
        return res.status(403).json({
          message: 'ليس لديك صلاحية الوصول إلى هذا السؤال.',
        });
      }

      // Validate question index
      if (index >= questionGroup.questions?.length) {
        return res.status(400).json({
          message: `موقع السؤال غير صالح، يجب أن يكون بين 0 و ${
            questionGroup.questions?.length - 1
          }`,
        });
      }

      // Check for existing favorite
      const exists = student.favorites.some(
        (fav) =>
          fav.questionGroup.equals(questionGroupId) && fav.index === index
      );

      if (exists) {
        return res.status(400).json({
          message: 'مجموعة الأسئلة مضافة للمفضلة من قبل.',
        });
      }

      // Add to favorites
      student.favorites.push({
        questionGroup: questionGroupId,
        index,
      });

      await student.save();

      res.status(200).json({
        message: 'تمت إضافة مجموعة الأسئلة إلى المفضلة بنجاح.',
      });
    } catch (err) {
      console.error('Error in addFavoriteQuestionGroup:', err);
      res.status(500).json({
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
