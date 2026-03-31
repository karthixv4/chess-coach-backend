require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const classroomRoutes = require('./routes/classroom.routes');
const sessionRoutes = require('./routes/session.routes');
const lessonRoutes = require('./routes/lesson.routes');
const homeworkRoutes = require('./routes/homework.routes');
const materialRoutes = require('./routes/material.routes');
const notificationRoutes = require('./routes/notification.routes');
const globalSessionRoutes = require('./routes/globalSession.routes');
const uploadRoutes = require('./routes/upload.routes');

const { authenticate } = require('./middleware/auth');
const { requireRole } = require('./middleware/role');
const { getAll: getNotifications, markRead: markNotificationRead } = require('./controllers/notification.controller');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────

// Auth
app.use('/api/auth', authRoutes);

// Classrooms (base)
app.use('/api/classrooms', classroomRoutes);

// Nested classroom sub-resources
app.use('/api/classrooms/:classroomId/sessions', sessionRoutes);
app.use('/api/classrooms/:classroomId/lessons', lessonRoutes);
app.use('/api/classrooms/:classroomId/homework', homeworkRoutes);
app.use('/api/classrooms/:classroomId/materials', materialRoutes);
app.use('/api/classrooms/:classroomId/notifications', notificationRoutes);

// Global sessions
app.use('/api/sessions', globalSessionRoutes);
app.use('/api/upload', uploadRoutes);

// Top-level notifications (trainer inbox)
app.get('/api/notifications', authenticate, requireRole('trainer'), getNotifications);
app.patch('/api/notifications/:notificationId/read', authenticate, requireRole('trainer'), markNotificationRead);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Global Error Handler (must be last) ────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Chess Coach API running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
