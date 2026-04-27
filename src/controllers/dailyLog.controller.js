const prisma = require('../prisma/prismaConnection');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifies that the requesting user has access to the given classroom.
 * - Students: may only access their own classroom.
 * - Trainers: may only access classrooms they own.
 * Returns the classroom or throws a formatted response.
 */
const verifyClassroomAccess = async (classroomId, user, res) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { student: { select: { id: true, name: true } } },
  });

  if (!classroom) {
    res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    return null;
  }

  if (user.role === 'STUDENT' && classroom.studentId !== user.id) {
    res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this classroom.' });
    return null;
  }

  if (user.role === 'TRAINER' && classroom.trainerId !== user.id) {
    res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this classroom.' });
    return null;
  }

  return classroom;
};

/**
 * Returns a Date object set to UTC midnight for today (or a given date string).
 * Using UTC midnight ensures the date-only field stores cleanly.
 */
const toUTCDate = (dateStr) => {
  if (dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const VALID_CATEGORIES = ['OPENINGS', 'TACTICS', 'ENDGAMES'];
const VALID_WORKSHEET_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/classrooms/:classroomId/daily-logs
 * Student submits their daily practice log.
 * Enforces 1 log per day per classroom at the DB level.
 */
const createLog = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    // Only students should submit logs
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only students can submit daily logs.' });
    }

    const { category, gamesPlayed, minutesSpent, worksheetStatus, notes, date } = req.body;

    // Validate required fields
    if (!category) {
      return res.status(400).json({ error: 'BadRequest', message: 'category is required.' });
    }
    if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({ error: 'BadRequest', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
    }
    if (worksheetStatus && !VALID_WORKSHEET_STATUSES.includes(worksheetStatus.toUpperCase())) {
      return res.status(400).json({ error: 'BadRequest', message: `worksheetStatus must be one of: ${VALID_WORKSHEET_STATUSES.join(', ')}.` });
    }

    const logDate = toUTCDate(date); // defaults to today if not provided
    if (!logDate) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const log = await prisma.dailyLog.create({
      data: {
        classroomId,
        date: logDate,
        category: category.toUpperCase(),
        gamesPlayed: gamesPlayed ? parseInt(gamesPlayed) : null,
        minutesSpent: minutesSpent ? parseInt(minutesSpent) : null,
        worksheetStatus: worksheetStatus ? worksheetStatus.toUpperCase() : null,
        notes: notes || null,
      },
    });

    return res.status(201).json(log);
  } catch (err) {
    // P2002 = Prisma unique constraint violation
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already submitted a practice log for today. Use PATCH to update it.',
      });
    }
    next(err);
  }
};

/**
 * GET /api/classrooms/:classroomId/daily-logs
 * Trainer fetches all logs for a classroom. Student fetches their own.
 * Optional query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=TACTICS
 */
const getLogs = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    const { from, to, category } = req.query;
    const where = { classroomId };

    if (from || to) {
      where.date = {};
      if (from) {
        const fromDate = toUTCDate(from);
        if (!fromDate) return res.status(400).json({ error: 'BadRequest', message: 'Invalid "from" date.' });
        where.date.gte = fromDate;
      }
      if (to) {
        const toDate = toUTCDate(to);
        if (!toDate) return res.status(400).json({ error: 'BadRequest', message: 'Invalid "to" date.' });
        where.date.lte = toDate;
      }
    }

    if (category) {
      const cat = category.toUpperCase();
      if (!VALID_CATEGORIES.includes(cat)) {
        return res.status(400).json({ error: 'BadRequest', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
      }
      where.category = cat;
    }

    const logs = await prisma.dailyLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/classrooms/:classroomId/daily-logs/:logId
 * Fetch a single log entry.
 */
const getLog = async (req, res, next) => {
  try {
    const { classroomId, logId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    const log = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!log || log.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Log entry not found.' });
    }

    return res.status(200).json(log);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/classrooms/:classroomId/daily-logs/:logId
 * Student updates their own log entry. Trainer cannot edit student logs.
 */
const updateLog = async (req, res, next) => {
  try {
    const { classroomId, logId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only students can edit their own logs.' });
    }

    const existing = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!existing || existing.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Log entry not found.' });
    }

    const { category, gamesPlayed, minutesSpent, worksheetStatus, notes } = req.body;
    const updateData = {};

    if (category !== undefined) {
      const cat = category.toUpperCase();
      if (!VALID_CATEGORIES.includes(cat)) {
        return res.status(400).json({ error: 'BadRequest', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}.` });
      }
      updateData.category = cat;
    }
    if (worksheetStatus !== undefined) {
      const ws = worksheetStatus.toUpperCase();
      if (!VALID_WORKSHEET_STATUSES.includes(ws)) {
        return res.status(400).json({ error: 'BadRequest', message: `worksheetStatus must be one of: ${VALID_WORKSHEET_STATUSES.join(', ')}.` });
      }
      updateData.worksheetStatus = ws;
    }
    if (gamesPlayed !== undefined) updateData.gamesPlayed = gamesPlayed === null ? null : parseInt(gamesPlayed);
    if (minutesSpent !== undefined) updateData.minutesSpent = minutesSpent === null ? null : parseInt(minutesSpent);
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.dailyLog.update({ where: { id: logId }, data: updateData });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/classrooms/:classroomId/daily-logs/:logId
 * Trainer deletes a log entry. Students may also delete their own.
 */
const deleteLog = async (req, res, next) => {
  try {
    const { classroomId, logId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    const existing = await prisma.dailyLog.findUnique({ where: { id: logId } });
    if (!existing || existing.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Log entry not found.' });
    }

    await prisma.dailyLog.delete({ where: { id: logId } });
    return res.status(200).json({ success: true, message: 'Log entry deleted.' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/classrooms/:classroomId/push-worksheet
 * Trainer pushes a worksheet (Homework) to a student by setting its status to ASSIGNED
 * and creating a notification so the student is alerted.
 */
const pushWorksheet = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const classroom = await verifyClassroomAccess(classroomId, req.user, res);
    if (!classroom) return;

    if (req.user.role !== 'TRAINER') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only trainers can push worksheets.' });
    }

    const { worksheetId } = req.body;
    if (!worksheetId) {
      return res.status(400).json({ error: 'BadRequest', message: 'worksheetId is required.' });
    }

    const homework = await prisma.homework.findUnique({ where: { id: worksheetId } });
    if (!homework || homework.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Worksheet not found in this classroom.' });
    }

    // Reset status to ASSIGNED and create a notification
    const [updatedHomework] = await prisma.$transaction([
      prisma.homework.update({
        where: { id: worksheetId },
        data: { status: 'ASSIGNED' },
      }),
      prisma.notification.create({
        data: {
          classroomId,
          senderId: req.user.id,
          message: `Your trainer has assigned you a worksheet: "${homework.title}". Please complete it by the due date.`,
        },
      }),
    ]);

    return res.status(200).json({
      message: 'Worksheet pushed to student successfully.',
      homework: updatedHomework,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createLog, getLogs, getLog, updateLog, deleteLog, pushWorksheet };
