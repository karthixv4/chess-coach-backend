const prisma = require('../prisma/prismaConnection');

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

const assertUserInClassroom = async (classroomId, userId, res) => {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) {
    res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    return null;
  }
  if (classroom.trainerId !== userId && classroom.studentId !== userId) {
    res.status(403).json({ error: 'Forbidden', message: 'You are not part of this classroom.' });
    return null;
  }
  return classroom;
};

// POST /api/classrooms/:classroomId/lessons
const create = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { title, date, summary, detailedNotes, videoUrl, pgn } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'BadRequest', message: 'title and date are required.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const lesson = await prisma.lesson.create({
      data: {
        classroomId,
        title,
        date: new Date(date),
        summary: summary || null,
        detailedNotes: detailedNotes || null,
        videoUrl: videoUrl || null,
        pgn: pgn || null,
        status: 'NEW',
      },
    });

    return res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/lessons/:lessonId
const update = async (req, res, next) => {
  try {
    const { classroomId, lessonId } = req.params;
    const { title, date, summary, detailedNotes, videoUrl, pgn } = req.body;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Lesson not found.' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (date !== undefined) updateData.date = new Date(date);
    if (summary !== undefined) updateData.summary = summary;
    if (detailedNotes !== undefined) updateData.detailedNotes = detailedNotes;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (pgn !== undefined) updateData.pgn = pgn;

    const updated = await prisma.lesson.update({ where: { id: lessonId }, data: updateData });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/lessons/:lessonId/read
const markRead = async (req, res, next) => {
  try {
    const { classroomId, lessonId } = req.params;

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the student of this classroom.' });
    }

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Lesson not found.' });
    }

    await prisma.lesson.update({ where: { id: lessonId }, data: { status: 'REVIEWED' } });
    return res.status(200).json({ success: true, status: 'reviewed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, update, markRead };
