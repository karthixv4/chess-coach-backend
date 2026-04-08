const prisma = require('../prisma/prismaConnection');

// DELETE /api/students/:studentId
const deleteStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const trainerId = req.user.id; // User must be a trainer

    // 1. Find the student and verify they are a STUDENT
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: { classroomAsStudent: true },
    });

    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({ error: 'NotFound', message: 'Student not found.' });
    }

    // 2. If the student is assigned to a classroom, check if the requesting trainer owns that classroom
    if (student.classroomAsStudent && student.classroomAsStudent.trainerId !== trainerId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the trainer for this student.' });
    }

    // 3. Initiate Transaction to delete related entities and the user
    await prisma.$transaction(async (tx) => {
      // 3a. Delete Classroom to trigger cascade deletes on derived entities
      if (student.classroomAsStudent) {
        await tx.classroom.delete({ where: { id: student.classroomAsStudent.id } });
      }

      // 3b. Delete any notifications where the student is the sender (in case they aren't caught by cascade)
      await tx.notification.deleteMany({ where: { senderId: student.id } });

      // 3c. Finally delete the User record
      await tx.user.delete({ where: { id: student.id } });
    });

    return res.status(200).json({ success: true, message: 'Student and all related records have been deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { deleteStudent };
