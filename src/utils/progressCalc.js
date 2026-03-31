const prisma = require('../prisma/prismaConnection');

/**
 * Recalculates the progress for a classroom based on evaluated vs total homework.
 * Progress = (evaluatedCount / totalCount) * 100, rounded to nearest integer.
 * Updates the classroom record in-place and returns the new progress value.
 *
 * @param {string} classroomId
 * @returns {Promise<number>} new progress percentage (0–100)
 */
const recalculateProgress = async (classroomId) => {
  const [total, evaluated] = await Promise.all([
    prisma.homework.count({ where: { classroomId } }),
    prisma.homework.count({ where: { classroomId, status: 'EVALUATED' } }),
  ]);

  const progress = total === 0 ? 0 : Math.round((evaluated / total) * 100);

  await prisma.classroom.update({
    where: { id: classroomId },
    data: { progress },
  });

  return progress;
};

module.exports = { recalculateProgress };
