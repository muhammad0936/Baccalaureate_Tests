const { StatusCodes } = require('http-status-codes');
const Student = require('../../models/Student'); // Adjust path as needed
const admin = require('../../util/firebase'); // Your Firebase initialization file

exports.sendNotificationToAllStudents = async (req, res, next) => {
  try {
    const { title, message } = req.body;

    // Validate request body
    if (!title || !message) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Title and message are required.',
      });
    }

    // Fetch all students from the database
    const students = await Student.find({}, 'fname lname email fcmToken'); // You can select only needed fields to optimize performance
    if (students.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'No students found.',
      });
    }

    // Assuming you store device tokens in another collection or as part of the Student schema
    const tokens = []; // An array to hold FCM tokens

    // Iterate over students and collect their device tokens
    for (const student of students) {
      if (student.fcmToken) {
        tokens.push(student.fcmToken); // Collect token if exists
      }
    }

    if (tokens.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'No FCM tokens found. Cannot send notifications.',
      });
    }

    // Prepare the notification payload
    const payload = {
      notification: {
        title,
        body: message,
      },
      // Additional data payload can go here if necessary
    };

    // Use Firebase Admin SDK to send notifications
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...payload,
    });

    return res.status(StatusCodes.OK).json({
      message: `Notification sent to ${response.successCount} students.`,
      failures: response.failureCount,
      results: response.responses, // Optional: detailed results
    });
  } catch (error) {
    console.error('Error sending notification:', error.message);
    next(error); // Pass error to the error-handling middleware
  }
};
