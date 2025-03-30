const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student');
const { body, validationResult } = require('express-validator');
// Get student profile controller
exports.getProfile = async (req, res, next) => {
  try {
    const student = await Student.findById(req.userId)
      .select(
        '-password -resetToken -resetTokenExpiration -redeemedCodes -favorites -__v -updatedAt'
      )
      .populate('university', 'name')
      .populate('college', 'name numOfYears')
      .lean();

    if (!student) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'لم يتم العثور على الطالب.',
      });
    }
    if (
      student.university.name === 'بكالوريا' ||
      student.college.name === 'بكالوريا'
    ) {
      delete student.university;
      delete student.college;
      delete student.year;
    }
    res.status(StatusCodes.OK).json({
      message: 'تم جلب بيانات الملف الشخصي بنجاح.',
      profile: student,
    });
  } catch (error) {
    next(error);
  }
};

// Update profile validation middleware
const validateUpdateProfile = [
  body('fname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول الاسم أقل من 50 حرفاً.'),

  body('lname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('يجب أن يكون طول اسم العائلة أقل من 50 حرفاً.'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('صيغة البريد الإلكتروني غير صحيحة.')
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .isString()
    .withMessage('رقم الهاتف يجب أن يكون نصاً.'),

  body('university')
    .optional()
    .isMongoId()
    .withMessage('معرف الجامعة غير صالح.'),

  body('college').optional().isMongoId().withMessage('معرف الكلية غير صالح.'),

  body('year')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('يجب أن تكون السنة الأكاديمية بين 0 و 6.'),

  body('image.filename')
    .optional()
    .isString()
    .withMessage('صيغة اسم الملف يجب أن تكون نصاً.'),
  body('image.accessUrl')
    .optional()
    .isString()
    .withMessage('صيغة رابط الوصول غير صحيحة.'),

  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('يجب أن تكون كلمة المرور على الأقل 6 أحرف.'),
];

// Update profile controller
exports.updateProfile = [
  ...validateUpdateProfile,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ errors: errors.array() });
      }

      const updates = req.body;

      const student = await Student.findById(req.userId)
        .populate('university', 'name')
        .populate('college', 'name numOfYears');
      if (
        student.university.name === 'بكالوريا' ||
        student.college.name === 'بكالوريا'
      ) {
        delete updates.university;
        delete updates.college;
        delete updates.year;
      }
      console.log(updates);

      if (!student) {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: 'لم يتم العثور على الطالب.',
        });
      }

      // Handle email uniqueness
      if (updates.email && updates.email !== student.email) {
        const emailExists = await Student.findOne({ email: updates.email });
        if (emailExists) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'البريد الإلكتروني موجود بالفعل!',
          });
        }
        student.email = updates.email;
      }

      // Handle phone uniqueness
      if (updates.phone && updates.phone !== student.phone) {
        const phoneExists = await Student.findOne({ phone: updates.phone });
        if (phoneExists) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'رقم الهاتف موجود بالفعل!',
          });
        }
        student.phone = updates.phone;
      }

      // Handle university/college relationship
      if (updates.university || updates.college || updates.year) {
        const universityId = updates.university || student.university;
        const collegeId = updates.college || student.college;

        const college = await College.findOne({
          _id: collegeId,
          university: universityId,
        });

        if (!college) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'الكلية المحددة لا تنتمي إلى الجامعة المحددة!',
          });
        }
        if (updates.year < 1 || updates.year > college.numOfYears) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            message: `السنة الدراسية المحددة (${updates.year}) غير متاحة في هذه الكلية (الحد الأقصى ${college.numOfYears}).`,
          });
        }

        student.university = universityId;
        student.college = collegeId;
      }

      // Update password if provided
      if (updates.password) {
        student.password = await bcrypt.hash(updates.password, 12);
      }

      // Update other fields
      const allowedUpdates = ['fname', 'lname', 'year', 'image'];
      allowedUpdates.forEach((field) => {
        if (updates[field] !== undefined) {
          student[field] = updates[field];
        }
      });

      await student.save();

      // Get updated profile without sensitive data
      const updatedProfile = await Student.findById(req.userId)
        .select(
          '-password -resetToken -resetTokenExpiration -redeemedCodes -favorites -__v -updatedAt'
        )
        .populate('university', 'name')
        .populate('college', 'name numOfYears')
        .lean();

      res.status(StatusCodes.OK).json({
        message: 'تم تحديث الملف الشخصي بنجاح.',
        profile: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  },
];
