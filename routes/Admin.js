const express = require('express');
const router = express.Router();
const isAuth = require('../middlewares/isAuth');
const multerMiddleware = require('../middlewares/multerWithFiles');
const multerGlobal = require('../middlewares/multerGlobal');
const {
  createAdmin,
  login,
  updatePassword,
} = require('../controllers/Admin/Auth');

const {
  createMaterial,
  getMaterials,
  deleteMaterial,
} = require('../controllers/Admin/Material');

const {
  createTeacher,
  getTeachers,
  deleteTeacher,
} = require('../controllers/Admin/Teacher');
const {
  createCourse,
  getCourses,
  deleteCourse,
} = require('../controllers/Admin/Course');
const {
  createVideo,
  getVideos,
  deleteVideo,
} = require('../controllers/Admin/Video');
const {
  createCodesGroup,
  getCodesGroups,
  deleteCodesGroup,
  getCodesFromGroup,
  exportCodesPDF,
  exportCodeCardsPDF,
} = require('../controllers/Admin/CodesGroup');
const { copyQuestionsToFree } = require('../controllers/Admin/FreeQuestion');
const {
  createQuestionGroup,
  getQuestionGroups,
  deleteQuestionGroup,
} = require('../controllers/Admin/Question');
const { uploadVideo, addVideo } = require('../controllers/Admin/UploadVideo');
const BunnyVideoUploader = require('../middlewares/BunnyVideoUpload');
const { uploadImage } = require('../controllers/Admin/UploadImage');
const BunnyImageUploader = require('../middlewares/BunnyImageUpload');
const { getTeachersStatistics } = require('../controllers/Admin/Statistics');
const {
  sendNotificationToAllStudents,
} = require('../controllers/Admin/Notification');
const {
  createSellCenter,
  deleteSellCenter,
} = require('../controllers/Admin/SellCenter');
const {
  createUnit,
  getUnits,
  deleteUnit,
} = require('../controllers/Admin/Unit');
const {
  createLesson,
  getLessons,
  deleteLesson,
} = require('../controllers/Admin/Lesson');
const {
  getStudents,
  blockStudent,
  checkBlockedStatus,
} = require('../controllers/Admin/Student');
const { getUserNotifications } = require('../controllers/Student/Notification');

router.post('/addVideo', addVideo);
router.post('/uploadImage', BunnyImageUploader, uploadImage);
router.post('/admin', isAuth, multerGlobal, createAdmin);
router.post('/login', multerGlobal, login);
router.post('/updatePassword', isAuth, multerGlobal, updatePassword);

router.get('/students', multerGlobal, isAuth, getStudents);
router.put('/toggleBlock/:id', multerGlobal, isAuth, blockStudent);
router.get('/checkBlock/:id', multerGlobal, isAuth, checkBlockedStatus);

router.post('/material', multerGlobal, isAuth, createMaterial);
router.delete('/material/:id', multerGlobal, isAuth, deleteMaterial);

router.post('/unit', multerGlobal, isAuth, createUnit);
router.delete('/unit/:id', multerGlobal, isAuth, deleteUnit);

router.post('/lesson', multerGlobal, isAuth, createLesson);
router.delete('/lesson/:id', multerGlobal, isAuth, deleteLesson);

router.post('/questions', multerGlobal, isAuth, createQuestionGroup);
router.get('/questions', multerGlobal, isAuth, getQuestionGroups);
router.delete('/question/:id', multerGlobal, isAuth, deleteQuestionGroup);

router.post('/teacher', multerGlobal, isAuth, createTeacher);
router.get('/teachers', multerGlobal, isAuth, getTeachers);
router.delete('/teacher/:id', multerGlobal, isAuth, deleteTeacher);

router.post('/course', multerGlobal, isAuth, createCourse);
router.get('/courses', multerGlobal, isAuth, getCourses);
router.delete('/course/:id', multerGlobal, isAuth, deleteCourse);

router.post('/video', multerGlobal, isAuth, createVideo);
router.get('/videos', multerGlobal, isAuth, getVideos);
router.delete('/video/:id', multerGlobal, isAuth, deleteVideo);

router.post('/codesGroup', multerGlobal, isAuth, createCodesGroup);
router.get('/codesGroups', multerGlobal, isAuth, getCodesGroups);
router.get('/codes/:id', multerGlobal, isAuth, getCodesFromGroup);
router.delete('/codesGroup/:id', multerGlobal, isAuth, deleteCodesGroup);
router.get('/codesGroup/:id/export-pdf', multerGlobal, exportCodeCardsPDF);

router.post('/changeFreeQuestions', multerGlobal, isAuth, copyQuestionsToFree);
router.get('/teachersStatistics', multerGlobal, isAuth, getTeachersStatistics);

router.post('/sendNotification', isAuth, sendNotificationToAllStudents);

router.post('/sellCenter', isAuth, createSellCenter);
router.delete('/sellCenter/:id', isAuth, deleteSellCenter);

router.get('/notifications', isAuth, getUserNotifications);

module.exports = router;
