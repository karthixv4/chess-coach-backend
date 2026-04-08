const prisma = require('../prisma/prismaConnection');

const formatUser = (user) => ({
  id: user.id,
  name: user.name,
  avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`,
});

const formatClassroomSummary = (classroom) => ({
  id: classroom.id,
  trainerId: classroom.trainerId,
  studentId: classroom.studentId,
  studentName: classroom.student?.name,
  studentAvatar: formatUser(classroom.student).avatar,
  trainerName: classroom.trainer?.name,
  progress: classroom.progress,
  recentActivity: classroom._count
    ? `${classroom._count.sessions} sessions, ${classroom._count.homework} homework`
    : null,
});

// POST /api/classrooms
const create = async (req, res, next) => {
  try {
    const { studentEmail } = req.body;
    const trainerId = req.user.id;

    if (!studentEmail) {
      return res.status(400).json({ error: 'BadRequest', message: '"studentEmail" is required.' });
    }

    // Find the student by email
    const student = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (!student) {
      return res.status(404).json({ error: 'NotFound', message: `No user found with email "${studentEmail}".` });
    }
    if (student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'BadRequest', message: 'The specified user is not a student.' });
    }
    if (student.id === trainerId) {
      return res.status(400).json({ error: 'BadRequest', message: 'A trainer cannot create a classroom with themselves.' });
    }

    // A student can only belong to one classroom
    const existing = await prisma.classroom.findUnique({ where: { studentId: student.id } });
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'This student already belongs to a classroom.' });
    }

    const classroom = await prisma.classroom.create({
      data: { trainerId, studentId: student.id },
      include: { student: true, trainer: true },
    });

    return res.status(201).json(formatClassroomSummary({ ...classroom, _count: null }));
  } catch (err) {
    next(err);
  }
};

// GET /api/classrooms
const getAll = async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const where = role === 'TRAINER' ? { trainerId: id } : { studentId: id };

    const classrooms = await prisma.classroom.findMany({
      where,
      include: {
        student: true,
        trainer: true,
        _count: { select: { sessions: true, homework: true } },
      },
    });

    return res.status(200).json(classrooms.map(formatClassroomSummary));
  } catch (err) {
    next(err);
  }
};

// GET /api/classrooms/:classroomId
const getById = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { id, role } = req.user;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        student: true,
        trainer: true,
        sessions: {
          include: {
            sessionMaterials: { include: { material: true } },
            sessionHomework: { include: { homework: true } },
          },
          orderBy: { date: 'desc' },
        },
        lessons: { orderBy: { date: 'desc' } },
        homework: { orderBy: { createdAt: 'desc' } },
        materials: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }

    // RBAC: user must be part of this classroom
    if (classroom.trainerId !== id && classroom.studentId !== id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not part of this classroom.' });
    }

    const response = {
      id: classroom.id,
      trainerId: classroom.trainerId,
      studentId: classroom.studentId,
      studentName: classroom.student.name,
      trainerName: classroom.trainer.name,
      progress: classroom.progress,
      sessions: classroom.sessions,
      lessons: classroom.lessons,
      homework: classroom.homework.map(hw => {
        if (hw.type === 'BOARD') {
          const { fen, winningMoves, ...rest } = hw;
          return {
            ...rest,
            challenge: {
              fen,
              winningMoves,
              description: hw.description
            }
          };
        }
        return hw;
      }),
      materials: classroom.materials,
    };

    // Notes are only returned to trainers
    if (role === 'TRAINER') {
      response.notes = classroom.notes;
    }

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/notes
const updateNotes = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({ error: 'BadRequest', message: '"notes" field is required.' });
    }

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.trainerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the trainer of this classroom.' });
    }

    await prisma.classroom.update({ where: { id: classroomId }, data: { notes } });
    return res.status(200).json({ success: true, notes });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classrooms/:classroomId
const deleteClassroom = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const trainerId = req.user.id;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { student: true },
    });

    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }

    if (classroom.trainerId !== trainerId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the trainer of this classroom.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete classroom (cascades sessions, homework, materials, etc.)
      await tx.classroom.delete({ where: { id: classroomId } });
      
      // 2. Delete any notifications sent by the student
      await tx.notification.deleteMany({ where: { senderId: classroom.studentId } });

      // 3. Delete the actual student record
      await tx.user.delete({ where: { id: classroom.studentId } });
    });

    return res.status(200).json({ success: true, message: 'Classroom and student deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getAll, getById, updateNotes, deleteClassroom };
