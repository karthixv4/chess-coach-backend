const { recalculateProgress } = require('../utils/progressCalc');
const prisma = require('../prisma/prismaConnection');

const VALID_TYPES = ['BOARD', 'TEXT', 'VIDEO', 'IMAGE'];

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

const formatHomeworkResponse = (hw) => {
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
};

// POST /api/classrooms/:classroomId/homework
const create = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { title, type, dueDate, description, imageUrls, challenge } = req.body;

    if (!title || !type || !dueDate) {
      return res.status(400).json({ error: 'BadRequest', message: 'title, type, and dueDate are required.' });
    }

    const normalizedType = type.toUpperCase();
    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({ error: 'BadRequest', message: `type must be one of: ${VALID_TYPES.join(', ')}.` });
    }

    if (imageUrls !== undefined && !Array.isArray(imageUrls)) {
      return res.status(400).json({ error: 'BadRequest', message: '"imageUrls" must be an array of strings.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const homework = await prisma.homework.create({
      data: {
        classroomId,
        title,
        type: normalizedType,
        dueDate: new Date(dueDate),
        description: description || challenge?.description || null,
        imageUrls: imageUrls || [],
        fen: challenge?.fen || null,
        winningMoves: challenge?.winningMoves || [],
        status: 'ASSIGNED',
      },
    });

    return res.status(201).json(formatHomeworkResponse(homework));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/homework/:homeworkId — Trainer only
const update = async (req, res, next) => {
  try {
    const { classroomId, homeworkId } = req.params;
    const { title, dueDate, description, imageUrls, challenge } = req.body;

    if (imageUrls !== undefined && !Array.isArray(imageUrls)) {
      return res.status(400).json({ error: 'BadRequest', message: '"imageUrls" must be an array of strings.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Homework not found.' });
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (dueDate !== undefined) data.dueDate = new Date(dueDate);
    if (description !== undefined) data.description = description;
    else if (challenge?.description !== undefined) data.description = challenge.description;
    if (imageUrls !== undefined) data.imageUrls = imageUrls;
    if (challenge?.fen !== undefined) data.fen = challenge.fen;
    if (challenge?.winningMoves !== undefined) data.winningMoves = challenge.winningMoves;

    const updated = await prisma.homework.update({ where: { id: homeworkId }, data });
    return res.status(200).json(formatHomeworkResponse(updated));
  } catch (err) {
    next(err);
  }
};

// POST /api/classrooms/:classroomId/homework/:homeworkId/submit
const submit = async (req, res, next) => {
  try {
    const { classroomId, homeworkId } = req.params;
    const { submission, submissionImageUrls } = req.body;

    if (!submission) {
      return res.status(400).json({ error: 'BadRequest', message: '"submission" is required.' });
    }

    if (submissionImageUrls !== undefined && !Array.isArray(submissionImageUrls)) {
      return res.status(400).json({ error: 'BadRequest', message: '"submissionImageUrls" must be an array of strings.' });
    }

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the student of this classroom.' });
    }

    const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Homework not found.' });
    }
    if (homework.status === 'EVALUATED') {
      return res.status(400).json({ error: 'BadRequest', message: 'This homework has already been evaluated.' });
    }

    const data = { submission, status: 'SUBMITTED' };
    if (submissionImageUrls !== undefined) data.submissionImageUrls = submissionImageUrls;

    const updated = await prisma.homework.update({ where: { id: homeworkId }, data });
    return res.status(200).json(formatHomeworkResponse(updated));
  } catch (err) {
    next(err);
  }
};

// POST /api/classrooms/:classroomId/homework/:homeworkId/evaluate
const evaluate = async (req, res, next) => {
  try {
    const { classroomId, homeworkId } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'BadRequest', message: '"score" is required.' });
    }
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({ error: 'BadRequest', message: '"score" must be a number between 0 and 100.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Homework not found.' });
    }

    const updated = await prisma.homework.update({
      where: { id: homeworkId },
      data: { score, feedback: feedback || null, status: 'EVALUATED' },
    });

    // Recalculate and persist classroom progress
    await recalculateProgress(classroomId);

    return res.status(200).json(formatHomeworkResponse(updated));
  } catch (err) {
    next(err);
  }
};

// GET /api/classrooms/:classroomId/homework/:homeworkId
const getById = async (req, res, next) => {
  try {
    const { classroomId, homeworkId } = req.params;
    
    // Check if the user has access to this classroom (either student or trainer)
    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.trainerId !== req.user.id && classroom.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this classroom.' });
    }

    const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Homework not found.' });
    }

    return res.status(200).json(formatHomeworkResponse(homework));
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classrooms/:classroomId/homework/:homeworkId — Trainer only
const deleteHomework = async (req, res, next) => {
  try {
    const { classroomId, homeworkId } = req.params;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Homework not found.' });
    }

    await prisma.homework.delete({ where: { id: homeworkId } });

    // Recalculate classroom progress
    await recalculateProgress(classroomId);

    return res.status(200).json({ success: true, message: 'Homework deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, update, submit, evaluate, getById, deleteHomework };
