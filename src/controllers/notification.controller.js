const prisma = require('../prisma/prismaConnection');

// POST /api/classrooms/:classroomId/notifications
const send = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { message, fen } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'BadRequest', message: '"message" is required.' });
    }

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the student of this classroom.' });
    }

    const notification = await prisma.notification.create({
      data: {
        classroomId,
        senderId: req.user.id,
        message,
        fen: fen || null,
      },
    });

    return res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications
const getAll = async (req, res, next) => {
  try {
    const { id: trainerId } = req.user;

    // Get all classrooms this trainer manages
    const classrooms = await prisma.classroom.findMany({
      where: { trainerId },
      select: { id: true },
    });
    const classroomIds = classrooms.map((c) => c.id);

    const notifications = await prisma.notification.findMany({
      where: {
        classroomId: { in: classroomIds },
        isRead: false,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        classroom: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(notifications);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:notificationId/read
const markRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const { id: trainerId } = req.user;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { classroom: true },
    });

    if (!notification) {
      return res.status(404).json({ error: 'NotFound', message: 'Notification not found.' });
    }
    if (notification.classroom.trainerId !== trainerId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not own this notification.' });
    }

    await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { send, getAll, markRead };
