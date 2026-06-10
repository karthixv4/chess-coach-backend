const prisma = require('../prisma/prismaConnection');

const VALID_STATUSES = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED', 'PREPONED'];

const assertTrainerOwnsClassroom = async (classroomId, trainerId, res) => {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) {
    res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    return null;
  }
  if (classroom.trainerId !== trainerId) {
    res.status(403).json({ error: 'Forbidden', message: 'You are not the trainer of this classroom.' });
    return null;
  }
  return classroom;
};

// POST /api/classrooms/:classroomId/sessions
const create = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { title, date, startTime, endTime, link, notes, remarks, mode } = req.body;

    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'BadRequest', message: 'title, date, startTime, and endTime are required.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const session = await prisma.session.create({
      data: {
        classroomId,
        title,
        date: new Date(date),
        startTime,
        endTime,
        mode: mode || 'ONLINE',
        link: link || null,
        notes: notes || remarks || null,
        status: 'SCHEDULED',
      },
    });

    return res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/sessions/:sessionId
const update = async (req, res, next) => {
  try {
    const { classroomId, sessionId } = req.params;
    const { title, date, startTime, endTime, link, mode } = req.body;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Session not found.' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (date !== undefined) updateData.date = new Date(date);
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (mode !== undefined) updateData.mode = mode;
    if (link !== undefined) updateData.link = link || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'No fields provided to update.' });
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        sessionMaterials: { include: { material: true } },
        sessionHomework: { include: { homework: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/sessions/:sessionId/status
const updateStatus = async (req, res, next) => {
  try {
    const { classroomId, sessionId } = req.params;
    const {
      status,
      cancellationReason,
      rescheduledTo,
      notes,
      materials,
      materialIds,
      homeworkIds,
    } = req.body;

    const finalMaterialIds = materialIds || materials;

    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      return res.status(400).json({
        error: 'BadRequest',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Session not found.' });
    }

    const updateData = { status: status.toUpperCase() };

    if (notes !== undefined) updateData.notes = notes;
    if (cancellationReason) updateData.cancellationReason = cancellationReason;

    if (rescheduledTo) {
      updateData.rescheduledDate = new Date(rescheduledTo.date);
      updateData.rescheduledStart = rescheduledTo.startTime;
      updateData.rescheduledEnd = rescheduledTo.endTime;
      // Also update the primary date/time so the session reflects the new schedule
      updateData.date = new Date(rescheduledTo.date);
      updateData.startTime = rescheduledTo.startTime;
      updateData.endTime = rescheduledTo.endTime;
    }

    // Sync materials for session (if materials array is provided)
    if (finalMaterialIds && Array.isArray(finalMaterialIds)) {
      // First, remove existing links for this session
      await prisma.sessionMaterial.deleteMany({ where: { sessionId } });
      // Then create new links if there are any
      if (finalMaterialIds.length > 0) {
        await prisma.sessionMaterial.createMany({
          data: finalMaterialIds.map((materialId) => ({ sessionId, materialId })),
        });
      }
    }

    // Sync homework for session (if homework array is provided)
    if (homeworkIds && Array.isArray(homeworkIds)) {
      // First, remove existing links for this session
      await prisma.sessionHomework.deleteMany({ where: { sessionId } });
      // Then create new links if there are any
      if (homeworkIds.length > 0) {
        await prisma.sessionHomework.createMany({
          data: homeworkIds.map((homeworkId) => ({ sessionId, homeworkId })),
        });
      }
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        sessionMaterials: { include: { material: true } },
        sessionHomework: { include: { homework: true } },
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classrooms/:classroomId/sessions/:sessionId
const remove = async (req, res, next) => {
  try {
    const { classroomId, sessionId } = req.params;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Session not found.' });
    }

    await prisma.session.delete({ where: { id: sessionId } });
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

// GET /api/classrooms/:classroomId/sessions
const getAllForClassroom = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { startDate, endDate } = req.query;
    const { id, role } = req.user;

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }

    if (classroom.trainerId !== id && classroom.studentId !== id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to these sessions.' });
    }

    const whereClause = { classroomId };
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      include: {
        sessionMaterials: { include: { material: true } },
        sessionHomework: { include: { homework: true } },
      },
    });

    return res.status(200).json(sessions);
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/student/:studentId
const getByStudentId = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    const { id, role } = req.user;

    if (role.toUpperCase() === 'STUDENT' && id !== studentId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only view your own sessions.' });
    }

    const classroom = await prisma.classroom.findUnique({ where: { studentId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'No classroom found for this student.' });
    }

    if (role.toUpperCase() === 'TRAINER' && classroom.trainerId !== id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the trainer for this student.' });
    }

    const whereClause = { classroomId: classroom.id };
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      include: {
        sessionMaterials: { include: { material: true } },
        sessionHomework: { include: { homework: true } },
      },
    });

    return res.status(200).json(sessions);
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/trainer
const getByTrainerId = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const { id, role } = req.user;

    if (role.toUpperCase() !== 'TRAINER') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only trainers can access this endpoint.' });
    }

    const whereClause = {
      classroom: { trainerId: id },
    };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) whereClause.date.lte = new Date(endDate);
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
      include: {
        classroom: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        sessionMaterials: { include: { material: true } },
        sessionHomework: { include: { homework: true } },
      },
    });

    return res.status(200).json(sessions);
  } catch (err) {
    next(err);
  }
};

module.exports = { create, update, updateStatus, remove, getAllForClassroom, getByStudentId, getByTrainerId };
