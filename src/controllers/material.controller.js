const prisma = require('../prisma/prismaConnection');

const VALID_TYPES = ['PDF', 'VIDEO', 'LINK', 'IMAGE'];

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

// POST /api/classrooms/:classroomId/materials
const create = async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const { title, type, url, imageUrls } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'BadRequest', message: 'title and type are required.' });
    }

    const normalizedType = type.toUpperCase();
    if (!VALID_TYPES.includes(normalizedType)) {
      return res.status(400).json({ error: 'BadRequest', message: `type must be one of: ${VALID_TYPES.join(', ')}.` });
    }

    if (normalizedType === 'IMAGE') {
      if ((!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) && !url) {
        return res.status(400).json({ error: 'BadRequest', message: 'url or imageUrls array is required for IMAGE.' });
      }
    } else {
      if (!url) {
        return res.status(400).json({ error: 'BadRequest', message: 'url is required for PDF, VIDEO, and LINK types.' });
      }
    }

    if (imageUrls !== undefined && !Array.isArray(imageUrls)) {
      return res.status(400).json({ error: 'BadRequest', message: '"imageUrls" must be an array of strings.' });
    }

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const material = await prisma.material.create({
      data: { 
        classroomId, 
        title, 
        type: normalizedType, 
        url: url || null,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : []
      },
    });

    return res.status(201).json(material);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/classrooms/:classroomId/materials/:materialId
const remove = async (req, res, next) => {
  try {
    const { classroomId, materialId } = req.params;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material || material.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Material not found.' });
    }

    await prisma.material.delete({ where: { id: materialId } });
    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/classrooms/:classroomId/materials/:materialId
const update = async (req, res, next) => {
  try {
    const { classroomId, materialId } = req.params;
    const { title, type, url, imageUrls } = req.body;

    const classroom = await assertTrainerOwnsClassroom(classroomId, req.user.id, res);
    if (!classroom) return;

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material || material.classroomId !== classroomId) {
      return res.status(404).json({ error: 'NotFound', message: 'Material not found.' });
    }

    const updateData = {};
    if (title) updateData.title = title;
    
    const normalizedType = type ? type.toUpperCase() : material.type;
    if (type) {
      if (!VALID_TYPES.includes(normalizedType)) {
        return res.status(400).json({ error: 'BadRequest', message: `type must be one of: ${VALID_TYPES.join(', ')}.` });
      }
      updateData.type = normalizedType;
    }

    const currentUrl = url !== undefined ? url : material.url;
    const currentImageUrls = imageUrls !== undefined ? imageUrls : material.imageUrls;

    if (normalizedType === 'IMAGE') {
       if ((!currentImageUrls || !Array.isArray(currentImageUrls) || currentImageUrls.length === 0) && !currentUrl) {
         return res.status(400).json({ error: 'BadRequest', message: 'url or imageUrls array is required for IMAGE.' });
       }
    } else {
       if (!currentUrl) {
         return res.status(400).json({ error: 'BadRequest', message: 'url is required for PDF, VIDEO, and LINK types.' });
       }
    }
    
    if (url !== undefined) updateData.url = url || null;
    if (imageUrls !== undefined) {
      if (!Array.isArray(imageUrls)) {
        return res.status(400).json({ error: 'BadRequest', message: '"imageUrls" must be an array of strings.' });
      }
      updateData.imageUrls = imageUrls;
    }

    const updatedMaterial = await prisma.material.update({
      where: { id: materialId },
      data: updateData,
    });

    return res.status(200).json(updatedMaterial);
  } catch (err) {
    next(err);
  }
};

module.exports = { create, remove, update };
