const mongoose = require('mongoose');
const CodesGroup = require('../../models/CodesGroup');
const Material = require('../../models/Material');
const Student = require('../../models/Student');
const Question = require('../../models/QuestionGroup');
const Course = require('../../models/Course');
const Video = require('../../models/Video');
const QuestionGroup = require('../../models/QuestionGroup');

exports.getAccessibleMaterials = async (req, res) => {
  try {
    // Fetch student with redeemed codes
    const student = await Student.findById(req.userId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }
    const now = new Date();
    const materialIds = new Set();

    // Check each redemption for valid codes group and used code
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        'codes.value': redemption.code,
        'codes.isUsed': true,
      }).select('materials');

      if (codesGroup) {
        codesGroup.materials.forEach((materialId) => {
          materialIds.add(materialId.toString());
        });
      }
    }

    // Convert material IDs to ObjectIds
    const materialIdsArray = Array.from(materialIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Paginate materials
    const materials = await Material.paginate(
      { _id: { $in: materialIdsArray } },
      {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        select: '-__v -createdAt -updatedAt',
      }
    );

    res.status(200).json(materials);
  } catch (err) {
    console.error(err.message);
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

exports.getAccessibleQuestions = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    // Convert to ObjectId once
    const materialId = new mongoose.Types.ObjectId(material);

    // Verify material exists
    const materialExists = await Material.exists({ _id: materialId });
    if (!materialExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على المادة.' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();
    let hasAccess = false;

    // Check each redemption for valid access
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        materials: materialId,
        codes: {
          $elemMatch: {
            value: redemption.code,
            isUsed: true,
          },
        },
      })
        .select('_id')
        .lean();

      if (codesGroup) {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه المادة.',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of questions for pagination metadata
    const totalQuestions = await Question.countDocuments({
      material: materialId,
    });

    // Retrieve questions with pagination
    const questions = await Question.find({ material: materialId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('material', 'name'); // Populate material details

    res.status(200).json({
      docs: questions,
      totalDocs: totalQuestions,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalQuestions / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleQuestions:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

exports.getAccessibleCoursesByMaterial = async (req, res) => {
  try {
    const { limit = 10, page = 1, material } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!material) {
      return res.status(400).json({ message: 'معرف المادة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(material)) {
      return res.status(400).json({ message: 'صيغة معرف المادة غير صالحة.' });
    }

    // Convert to ObjectId once
    const materialId = new mongoose.Types.ObjectId(material);

    // Verify material exists
    const materialExists = await Material.exists({ _id: materialId });
    if (!materialExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على المادة.' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();

    // Get all codes groups that the student has access to for this material
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      materials: materialId,
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    })
      .select('_id')
      .populate('courses');
    if (accessibleCodesGroups.length === 0) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه المادة.',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of accessible courses for pagination metadata
    const totalCourses = await Course.countDocuments({
      material: materialId,
      _id: {
        $in: accessibleCodesGroups.flatMap((group) => group.courses || []),
      },
    });

    // Retrieve accessible courses with pagination
    const courses = await Course.find({
      material: materialId,
      _id: {
        $in: accessibleCodesGroups.flatMap((group) => group.courses || []),
      },
    })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('material', 'name') // Populate material details
      .populate('teacher', 'fname lname'); // Populate teacher details

    res.status(200).json({
      docs: courses,
      totalDocs: totalCourses,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalCourses / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleCoursesByMaterial:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

exports.getAccessibleVideosByCourse = async (req, res) => {
  try {
    const { limit = 10, page = 1, course } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!course) {
      return res.status(400).json({ message: 'معرف الدورة مطلوب.' });
    }
    if (!mongoose.Types.ObjectId.isValid(course)) {
      return res.status(400).json({ message: 'صيغة معرف الدورة غير صالحة.' });
    }

    // Convert to ObjectId once
    const courseId = new mongoose.Types.ObjectId(course);

    // Verify course exists
    const courseExists = await Course.exists({ _id: courseId });
    if (!courseExists) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الدورة.' });
    }

    // Get student with redeemed codes
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' });
    }

    const now = new Date();

    // Get all codes groups that the student has access to for this course
    const accessibleCodesGroups = await CodesGroup.find({
      _id: { $in: student.redeemedCodes.map((rc) => rc.codesGroup) },
      expiration: { $gt: now },
      courses: courseId,
      codes: {
        $elemMatch: {
          value: { $in: student.redeemedCodes.map((rc) => rc.code) },
          isUsed: true,
        },
      },
    }).select('_id');

    if (accessibleCodesGroups.length === 0) {
      return res.status(403).json({
        message: 'ليس لديك صلاحية الوصول لهذه الدورة.',
      });
    }

    // Implement pagination
    const pageSize = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);

    // Get total number of accessible videos for pagination metadata
    const totalVideos = await Video.countDocuments({
      course: courseId,
    });

    // Retrieve accessible videos with pagination
    const videos = await Video.find({ course: courseId })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .select('-__v -createdAt -updatedAt') // Exclude unnecessary fields
      .populate('course', 'name'); // Populate course details

    res.status(200).json({
      docs: videos,
      totalDocs: totalVideos,
      limit: pageSize,
      page: currentPage,
      totalPages: Math.ceil(totalVideos / pageSize),
    });
  } catch (err) {
    console.error('Error in getAccessibleVideosByCourse:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.',
    });
  }
};

exports.getQuestionGroupWithQuestion = async (req, res) => {
  try {
    const { questionGroupId, questionIndex } = req.query;
    const studentId = req.userId;

    // Validate input parameters
    if (!questionGroupId || !questionIndex) {
      return res
        .status(400)
        .json({ message: 'معرف المجموعة وفهرس السؤال مطلوبان.' }); // "Question group ID and question index are required."
    }
    if (!mongoose.Types.ObjectId.isValid(questionGroupId)) {
      return res.status(400).json({ message: 'صيغة معرف المجموعة غير صالحة.' }); // "Invalid question group ID format."
    }
    if (isNaN(questionIndex) || questionIndex < 0) {
      return res
        .status(400)
        .json({ message: 'فهرس السؤال يجب أن يكون عدداً صحيحاً غير سالب.' }); // "Question index must be a non-negative integer."
    }

    // Find the student
    const student = await Student.findById(studentId).select('redeemedCodes');
    if (!student) {
      return res
        .status(404)
        .json({ message: 'عذراً، لم يتم العثور على الطالب.' }); // "Student not found."
    }
    // Retrieve the question group
    const questionGroup = await QuestionGroup.findById(questionGroupId)
      .select('questions name description material') // Fetch only relevant fields
      .lean();

    if (!questionGroup) {
      return res.status(404).json({ message: 'لم يتم العثور على المجموعة.' }); // "Question group not found."
    }

    // Check if the question index is within bounds
    if (questionIndex >= questionGroup.questions.length) {
      return res.status(400).json({ message: 'فهرس السؤال خارج النطاق.' }); // "Question index out of range."
    }
    const now = new Date();
    let hasAccess = false;

    // Check access rights for the specified question group
    for (const redemption of student.redeemedCodes) {
      const codesGroup = await CodesGroup.findOne({
        _id: redemption.codesGroup,
        expiration: { $gt: now },
        materials: questionGroup.material,
        codes: {
          $elemMatch: {
            value: redemption.code,
            isUsed: true,
          },
        },
      })
        .select('_id')
        .lean();

      if (codesGroup) {
        hasAccess = true;
        break;
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: 'ليس لديك صلاحية الوصول لهذه المجموعة.' }); // "You don't have access to this question group."
    }

    // Get the specific question by its index
    const selectedQuestion = questionGroup.questions[questionIndex];

    // Modify the question group to include only the selected question
    const response = {
      ...questionGroup,
      questions: [selectedQuestion],
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error in getQuestionGroupWithQuestion:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'حدث خطأ في الخادم.', // "An error occurred on the server."
    });
  }
};
