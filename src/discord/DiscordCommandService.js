const prisma = require('../prisma/prismaConnection');

class DiscordCommandService {
  async getStudentStatus(studentName) {
    const student = await this._findStudentByName(studentName);
    if (!student) return 'Student not found.';

    const classroom = student.classroomAsStudent;
    if (!classroom) return `${studentName} is not enrolled in any classroom.`;

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sessionsThisMonth = await prisma.session.count({
      where: {
        classroomId: classroom.id,
        status: 'COMPLETED',
        date: { gte: startOfMonth }
      }
    });

    const pendingWorksheets = await prisma.homework.count({
      where: { classroomId: classroom.id, status: 'ASSIGNED' }
    });

    const completedWorksheets = await prisma.homework.count({
      where: { classroomId: classroom.id, status: { in: ['SUBMITTED', 'EVALUATED'] } }
    });

    const lastSession = await prisma.session.findFirst({
      where: { classroomId: classroom.id, status: 'COMPLETED' },
      orderBy: { date: 'desc' }
    });

    const nextSession = await prisma.session.findFirst({
      where: { classroomId: classroom.id, status: 'SCHEDULED' },
      orderBy: { date: 'asc' }
    });

    const lastNote = await prisma.coachNote.findFirst({
      where: { classroomId: classroom.id },
      orderBy: { createdAt: 'desc' }
    });

    return `**${student.name}**\n` +
      `Sessions This Month: ${sessionsThisMonth}\n` +
      `Pending Worksheets: ${pendingWorksheets}\n` +
      `Completed Worksheets: ${completedWorksheets}\n\n` +
      `Last Session: ${lastSession ? lastSession.title : 'None'}\n` +
      `Last Session Date: ${lastSession ? lastSession.date.toISOString().split('T')[0] : 'N/A'}\n\n` +
      `Next Session: ${nextSession ? nextSession.date.toISOString().split('T')[0] + ' ' + nextSession.startTime : 'None Scheduled'}\n\n` +
      `Recent Coach Notes: ${lastNote ? lastNote.note : 'None'}`;
  }

  async getPendingHomework() {
    const homeworks = await prisma.homework.findMany({
      where: { status: 'ASSIGNED' },
      include: { classroom: { include: { student: true } } },
      orderBy: { classroom: { student: { name: 'asc' } } }
    });

    if (homeworks.length === 0) return 'No pending homework.';

    const pendingMap = {};
    for (const hw of homeworks) {
      if (hw.classroom && hw.classroom.student) {
        const sname = hw.classroom.student.name;
        if (!pendingMap[sname]) pendingMap[sname] = [];
        pendingMap[sname].push(hw.title);
      }
    }

    let response = '**Pending Homework**\n\n';
    for (const [student, titles] of Object.entries(pendingMap)) {
      response += `**${student}**\n` + titles.map(t => `* ${t}`).join('\n') + '\n\n';
    }
    return response.trim();
  }

  async getTodaysSessions() {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const sessions = await prisma.session.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: 'SCHEDULED'
      },
      include: { classroom: { include: { student: true } } },
      orderBy: { startTime: 'asc' }
    });

    if (sessions.length === 0) return 'No sessions scheduled today.';

    let response = '**Today\'s Sessions**\n\n';
    for (const s of sessions) {
      const studentName = s.classroom?.student?.name || 'Unknown Student';
      response += `${s.startTime} - ${studentName}\n`;
    }
    return response.trim();
  }

  async getWeeklySummary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const classrooms = await prisma.classroom.findMany({
      include: {
        student: true,
        sessions: { where: { date: { gte: sevenDaysAgo }, status: 'COMPLETED' } },
        homework: { where: { updatedAt: { gte: sevenDaysAgo } } } // using updatedAt as a proxy for completed recently, or submittedAt
      }
    });

    if (classrooms.length === 0) return 'No active classrooms.';

    let response = '**Weekly Summary**\n\n';
    for (const c of classrooms) {
      const sessionsCount = c.sessions.length;
      const completedCount = c.homework.filter(h => h.status === 'SUBMITTED' || h.status === 'EVALUATED').length;
      const pendingCount = c.homework.filter(h => h.status === 'ASSIGNED').length;

      response += `**${c.student.name}**\n` +
        `Sessions: ${sessionsCount}\n`;
      if (completedCount > 0) {
        response += `Worksheets Completed: ${completedCount}\n\n`;
      } else {
        response += `Pending Worksheets: ${pendingCount}\n\n`;
      }
    }
    return response.trim();
  }

  async getAllStudents() {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', classroomAsStudent: { isNot: null } },
      orderBy: { name: 'asc' }
    });

    if (students.length === 0) return 'No active students found.';

    return '**Active Students**\n\n' + students.map(s => s.name).join('\n');
  }

  async addCoachNote(studentName, noteText) {
    const student = await this._findStudentByName(studentName);
    if (!student) return 'Student not found.';
    const classroom = student.classroomAsStudent;
    if (!classroom) return 'Student is not enrolled in a classroom.';

    await prisma.coachNote.create({
      data: {
        note: noteText,
        classroomId: classroom.id
      }
    });

    return 'Coach note saved successfully.';
  }

  async completeSession(studentName, topic) {
    const student = await this._findStudentByName(studentName);
    if (!student) return 'Student not found.';
    const classroom = student.classroomAsStudent;
    if (!classroom) return 'Student is not enrolled in a classroom.';

    const nextSession = await prisma.session.findFirst({
      where: { classroomId: classroom.id, status: 'SCHEDULED' },
      orderBy: { date: 'asc' }
    });

    if (!nextSession) return `No scheduled sessions found for ${student.name}.`;

    await prisma.session.update({
      where: { id: nextSession.id },
      data: { status: 'COMPLETED', notes: topic }
    });

    return `Session marked completed. Topic: ${topic}`;
  }

  async getPendingEvaluations() {
    const homeworks = await prisma.homework.findMany({
      where: { status: 'SUBMITTED' },
      include: { classroom: { include: { student: true } } },
      orderBy: { classroom: { student: { name: 'asc' } } }
    });

    if (homeworks.length === 0) return 'No worksheets pending for evaluation.';

    const pendingMap = {};
    for (const hw of homeworks) {
      if (hw.classroom && hw.classroom.student) {
        const sname = hw.classroom.student.name;
        if (!pendingMap[sname]) pendingMap[sname] = [];
        
        let dateStr = '';
        if (hw.submittedAt) {
          const d = hw.submittedAt;
          const month = d.toLocaleString('en-US', { month: 'long' });
          const day = d.getDate();
          const year = d.getFullYear();
          
          const getOrdinal = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
          };
          
          dateStr = ` (Submitted: ${month} ${getOrdinal(day)}, ${year})`;
        }
        
        pendingMap[sname].push(`${hw.title}${dateStr}`);
      }
    }

    let response = '**Worksheets Pending for Evaluation**\n\n';
    for (const [student, titles] of Object.entries(pendingMap)) {
      response += `**${student}**\n` + titles.map(t => `* ${t}`).join('\n') + '\n\n';
    }
    return response.trim();
  }

  async _findStudentByName(name) {
    // Basic case-insensitive search by name
    return prisma.user.findFirst({
      where: {
        role: 'STUDENT',
        name: { equals: name, mode: 'insensitive' }
      },
      include: { classroomAsStudent: true }
    });
  }
}

module.exports = new DiscordCommandService();
