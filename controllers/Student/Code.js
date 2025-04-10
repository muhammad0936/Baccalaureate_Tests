const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Student = require('../../models/Student');

exports.redeemCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('الكود مطلوب.')
    .isLength({ min: 12, max: 12 })
    .withMessage('يجب أن يكون طول الكود 12 حرفاً.'),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { code } = req.body;
      const studentId = req.userId;

      // 1. Find the code in CodesGroups
      const codesGroup = await CodesGroup.findOne(
        { 'codes.value': code }, // Search condition
        { 'codes.$': 1, expiration: 1, materials: 1, courses: 1 } // Projection
      )
        .populate({
          path: 'materials',
        })
        .populate({
          path: 'courses',
          populate: [
            {
              path: 'material',
              select: '_id', // Select only _id for material
            },
            {
              path: 'teacher',
              select: 'fname lname', // Select fname and lname for teacher
            },
          ],
        })
        .session(session);

      if (!codesGroup) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الكود.' });
      }

      // 2. Check code status and expiration
      const targetCode = codesGroup.codes[0];
      if (targetCode.isUsed) {
        return res.status(400).json({ error: 'الكود مستخدم بالفعل.' });
      }

      if (new Date() > codesGroup.expiration) {
        return res
          .status(400)
          .json({ error: 'مجموعة الأكواد منتهية الصلاحية.' });
      }

      // 3. Check student hasn't redeemed from this group
      const student = await Student.findById(studentId)
        .session(session)
        .select('redeemedCodes');
      if (!student) return res.status(401).json({ message: 'غير مصرح!' });

      const existingRedemption = student.redeemedCodes?.some((redemption) =>
        redemption?.codesGroup?.equals(codesGroup._id)
      );

      if (existingRedemption) {
        return res.status(409).json({
          error: 'لقد قمت باسترداد كود من هذه المجموعة مسبقاً.',
        });
      }

      // 4. Update code status and student record
      await CodesGroup.updateOne(
        { _id: codesGroup._id, 'codes.value': code },
        { $set: { 'codes.$.isUsed': true } }
      ).session(session);

      const newRedemption = {
        code,
        codesGroup: codesGroup._id,
        redeemedAt: new Date(),
      };

      await Student.updateOne(
        { _id: studentId },
        { $push: { redeemedCodes: newRedemption } }
      ).session(session);

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        message: 'تم استرداد الكود بنجاح.',
        data: {
          code,
          materials: codesGroup.materials,
          courses: codesGroup.courses,
          expiration: codesGroup.expiration,
        },
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      next(err);
    }
  },
];

exports.getCodesInfo = async (req, res) => {
  try {
    // Extract the user ID from the request object
    const userId = req.userId;

    // Find the student document by ID and populate necessary fields
    const student = await Student.findById(userId).populate({
      path: 'redeemedCodes.codesGroup',
      select: 'expiration',
      populate: [
        {
          path: 'materials',
          select: 'name',
        },
        {
          path: 'courses',
          select: 'name',
          populate: {
            path: 'material',
            select: '_id',
          },
        },
      ],
    });

    // Check if the student exists
    if (!student) {
      return res.status(404).json({
        message: 'لم يتم العثور على الطالب', // "Student not found"
      });
    }

    // Retrieve and return the redeemed codes
    const { redeemedCodes } = student;
    return res.status(200).json(redeemedCodes);
  } catch (error) {
    // Handle unexpected server errors
    return res.status(error.statusCode || 500).json({
      error: error.message || 'حدث خطأ في الخادم.', // "An error occurred on the server"
    });
  }
};
