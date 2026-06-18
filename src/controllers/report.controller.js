const prisma = require('../prisma/prismaConnection');

// ── Helper: assert trainer owns classroom ─────────────────────────────────────
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

// ── Helper: assert user is member of classroom ────────────────────────────────
const assertClassroomMember = async (classroomId, userId, res) => {
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) {
    res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    return null;
  }
  if (classroom.trainerId !== userId && classroom.studentId !== userId) {
    res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this classroom.' });
    return null;
  }
  return classroom;
};

// ── Helper: build stats snapshot for a given month/year ──────────────────────
const buildStatsSnapshot = async (classroomId, month, year) => {
  const startDate = new Date(year, month - 1, 1);           // e.g. 2026-05-01
  const endDate   = new Date(year, month, 0, 23, 59, 59);   // last day of month

  // Sessions
  const sessions = await prisma.session.findMany({
    where: {
      classroomId,
      date: { gte: startDate, lte: endDate },
    },
    select: { id: true, status: true },
  });
  const sessionsScheduled = sessions.length;
  const sessionsCompleted = sessions.filter(s => s.status === 'COMPLETED').length;
  const sessionsCancelled = sessions.filter(s => s.status === 'CANCELLED').length;

  // Homework (all homework for this classroom, evaluated/submitted within this month)
  const allHomework = await prisma.homework.findMany({
    where: { classroomId },
    select: { id: true, status: true, score: true, createdAt: true, submittedAt: true },
  });
  // Homework assigned this month
  const hwAssigned = allHomework.filter(h => {
    const d = new Date(h.createdAt);
    return d >= startDate && d <= endDate;
  });
  const hwSubmitted = hwAssigned.filter(h => ['SUBMITTED', 'EVALUATED'].includes(h.status));
  const hwEvaluated = hwAssigned.filter(h => h.status === 'EVALUATED');
  const scores = hwEvaluated.map(h => h.score).filter(s => s != null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Practice logs (if feature in use)
  const practiceLogs = await prisma.dailyLog.findMany({
    where: {
      classroomId,
      date: { gte: startDate, lte: endDate },
    },
    select: { id: true, minutesSpent: true, gamesPlayed: true, category: true },
  });
  const totalPracticeMinutes = practiceLogs.reduce((acc, l) => acc + (l.minutesSpent ?? 0), 0);
  const totalPracticeGames   = practiceLogs.reduce((acc, l) => acc + (l.gamesPlayed ?? 0), 0);

  return {
    month,
    year,
    sessionsScheduled,
    sessionsCompleted,
    sessionsCancelled,
    hwAssigned: hwAssigned.length,
    hwSubmitted: hwSubmitted.length,
    hwEvaluated: hwEvaluated.length,
    avgScore,
    practiceLogsCount: practiceLogs.length,
    totalPracticeMinutes,
    totalPracticeGames,
  };
};

// ── POST /api/classrooms/:classroomId/reports/generate ────────────────────────
// Idempotent: if a report already exists for the given month/year, returns it.
const generate = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'BadRequest', message: 'month and year are required.' });
    }
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'BadRequest', message: 'month must be between 1 and 12.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    // Idempotency: return existing report if already exists
    const existing = await prisma.monthlyReport.findUnique({
      where: { classroomId_month_year: { classroomId, month: Number(month), year: Number(year) } },
    });
    if (existing) {
      return res.status(200).json(existing);
    }

    // Build fresh stats snapshot
    const statsSnapshot = await buildStatsSnapshot(classroomId, Number(month), Number(year));

    const report = await prisma.monthlyReport.create({
      data: {
        classroomId,
        month: Number(month),
        year: Number(year),
        status: 'DRAFT',
        statsSnapshot,
      },
    });

    return res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/classrooms/:classroomId/reports/:reportId ─────────────────────
// Save draft fields (trainer only). Works regardless of DRAFT or PUBLISHED status.
const saveDraft = async (req, res, next) => {
  try {
    const { classroomId, reportId } = req.params;
    const { areasOfStrength, areasToImprove, trainerComments } = req.body;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
    if (!report || report.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Report not found.' });
    }

    const updateData = {};
    if (areasOfStrength !== undefined) updateData.areasOfStrength = areasOfStrength;
    if (areasToImprove  !== undefined) updateData.areasToImprove  = areasToImprove;
    if (trainerComments !== undefined) updateData.trainerComments = trainerComments;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'No fields provided to update.' });
    }

    const updated = await prisma.monthlyReport.update({
      where: { id: reportId },
      data: updateData,
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/classrooms/:classroomId/reports/:reportId/publish ──────────────
const publish = async (req, res, next) => {
  try {
    const { classroomId, reportId } = req.params;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
    if (!report || report.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Report not found.' });
    }

    const updated = await prisma.monthlyReport.update({
      where: { id: reportId },
      data: { status: 'PUBLISHED' },
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/classrooms/:classroomId/reports ──────────────────────────────────
// Trainer: all reports (DRAFT + PUBLISHED). Student: PUBLISHED only.
const getAll = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { id: userId, role } = req.user;

    const classroom = await assertClassroomMember(classroomId, userId, res);
    if (!classroom) return;

    const where = { classroomId };
    if (role.toUpperCase() === 'STUDENT') {
      where.status = 'PUBLISHED';
    }

    const reports = await prisma.monthlyReport.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/classrooms/:classroomId/reports/:reportId/acknowledge ──────────
const acknowledge = async (req, res, next) => {
  try {
    const { classroomId, reportId } = req.params;
    const { id: userId } = req.user;

    const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
    if (!classroom) {
      return res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    }
    if (classroom.studentId !== userId) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the student of this classroom can acknowledge reports.' });
    }

    const report = await prisma.monthlyReport.findUnique({ where: { id: reportId } });
    if (!report || report.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Report not found.' });
    }
    if (report.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'BadRequest', message: 'Only published reports can be acknowledged.' });
    }
    if (report.acknowledgedAt) {
      // Already acknowledged — return as-is (idempotent)
      return res.status(200).json(report);
    }

    const updated = await prisma.monthlyReport.update({
      where: { id: reportId },
      data: { acknowledgedAt: new Date() },
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = { generate, saveDraft, publish, getAll, acknowledge };
