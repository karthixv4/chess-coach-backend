const prisma = require('../prisma/prismaConnection');

// ── Helpers ───────────────────────────────────────────────────────────────────

const verifyTrainerClassroom = async (classroomId, trainerId, res) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    include: { student: { select: { id: true, name: true } } },
  });

  if (!classroom) {
    res.status(404).json({ error: 'NotFound', message: 'Classroom not found.' });
    return null;
  }
  if (classroom.trainerId !== trainerId) {
    res.status(403).json({ error: 'Forbidden', message: 'You do not own this classroom.' });
    return null;
  }
  return classroom;
};

/** Returns UTC midnight for N days ago relative to now. */
const daysAgo = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** Returns UTC midnight for the Monday of the current week. */
const startOfCurrentWeek = () => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1; // shift so Monday = 0
  return daysAgo(diff);
};

/** Returns UTC midnight for the first day of the current month. */
const startOfCurrentMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

/** Compute current consecutive-day streak from a sorted (desc) array of date strings. */
const computeStreak = (logs) => {
  if (!logs.length) return 0;

  let streak = 0;
  let cursor = new Date();
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()));

  for (const log of logs) {
    const logDate = new Date(log.date);
    const logUTC = new Date(Date.UTC(logDate.getUTCFullYear(), logDate.getUTCMonth(), logDate.getUTCDate()));

    if (+logUTC === +cursor) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1); // move cursor back one day
    } else if (+logUTC < +cursor) {
      break; // gap found — streak is over
    }
  }
  return streak;
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/classrooms/:classroomId/analytics/summary
 * Trainer-only. Returns weekly and monthly practice stats for a student.
 */
const getClassroomSummary = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const classroom = await verifyTrainerClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const weekStart = startOfCurrentWeek();
    const monthStart = startOfCurrentMonth();

    // Fetch all logs this month (superset of this week)
    const monthLogs = await prisma.dailyLog.findMany({
      where: { classroomId, date: { gte: monthStart } },
      orderBy: { date: 'desc' },
    });

    // Split into week vs. month buckets
    const weekLogs = monthLogs.filter((l) => new Date(l.date) >= weekStart);

    // Aggregation helpers
    const sum = (arr, key) => arr.reduce((acc, l) => acc + (l[key] || 0), 0);

    const breakdownByCategory = ['OPENINGS', 'TACTICS', 'ENDGAMES'].reduce((acc, cat) => {
      const catLogs = monthLogs.filter((l) => l.category === cat);
      acc[cat] = {
        logs: catLogs.length,
        minutes: sum(catLogs, 'minutesSpent'),
        games: sum(catLogs, 'gamesPlayed'),
      };
      return acc;
    }, {});

    // Days in the current week (Mon–today)
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const daysIntoWeek = Math.floor((+todayUTC - +weekStart) / 86400000) + 1;

    // Streak: fetch all logs sorted desc
    const allLogs = await prisma.dailyLog.findMany({
      where: { classroomId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    return res.status(200).json({
      studentName: classroom.student.name,
      studentId: classroom.student.id,
      classroomId,
      weekly: {
        logsSubmitted: weekLogs.length,
        daysIntoWeek,
        weeklyAccuracy: `${weekLogs.length} / ${daysIntoWeek} days logged this week`,
        totalMinutes: sum(weekLogs, 'minutesSpent'),
        totalGames: sum(weekLogs, 'gamesPlayed'),
      },
      monthly: {
        logsSubmitted: monthLogs.length,
        totalMinutes: sum(monthLogs, 'minutesSpent'),
        totalGames: sum(monthLogs, 'gamesPlayed'),
      },
      breakdownByCategory,
      currentStreak: computeStreak(allLogs),
      recentLogs: monthLogs.slice(0, 7), // last 7 entries for quick display
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/inactive-students?inactiveDays=3
 * Trainer-only. Returns all students under this trainer who haven't submitted
 * a daily log in the last N days (default 3).
 */
const getInactiveStudents = async (req, res, next) => {
  try {
    const inactiveDays = parseInt(req.query.inactiveDays) || 3;

    if (inactiveDays < 1 || inactiveDays > 365) {
      return res.status(400).json({ error: 'BadRequest', message: 'inactiveDays must be between 1 and 365.' });
    }

    const cutoffDate = daysAgo(inactiveDays - 1); // if inactiveDays=3, any log in last 3 days keeps you "active"

    // Get all classrooms for this trainer
    const classrooms = await prisma.classroom.findMany({
      where: { trainerId: req.user.id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        dailyLogs: {
          orderBy: { date: 'desc' },
          take: 1, // only need the most recent log
          select: { date: true },
        },
      },
    });

    const result = classrooms.map((classroom) => {
      const lastLog = classroom.dailyLogs[0] || null;
      const lastLogDate = lastLog ? new Date(lastLog.date) : null;

      let daysInactive;
      let flagged;

      if (!lastLogDate) {
        // Never logged — always flagged
        daysInactive = null;
        flagged = true;
      } else {
        const todayUTC = new Date();
        const todayMidnight = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
        daysInactive = Math.floor((+todayMidnight - +lastLogDate) / 86400000);
        flagged = lastLogDate < cutoffDate;
      }

      return {
        studentId: classroom.student.id,
        studentName: classroom.student.name,
        studentEmail: classroom.student.email,
        classroomId: classroom.id,
        lastLogDate: lastLogDate ? lastLogDate.toISOString().split('T')[0] : null,
        daysInactive,
        flagged,
        neverLogged: !lastLogDate,
      };
    });

    // Sort: flagged first, then by daysInactive desc
    result.sort((a, b) => {
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
      const aInactive = a.daysInactive ?? 9999;
      const bInactive = b.daysInactive ?? 9999;
      return bInactive - aInactive;
    });

    return res.status(200).json({
      inactiveSince: inactiveDays,
      cutoffDate: cutoffDate.toISOString().split('T')[0],
      totalStudents: result.length,
      flaggedCount: result.filter((s) => s.flagged).length,
      students: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getClassroomSummary, getInactiveStudents };
