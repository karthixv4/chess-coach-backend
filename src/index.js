require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const classroomRoutes = require('./routes/classroom.routes');
const sessionRoutes = require('./routes/session.routes');
const lessonRoutes = require('./routes/lesson.routes');
const homeworkRoutes = require('./routes/homework.routes');
const materialRoutes = require('./routes/material.routes');
const notificationRoutes = require('./routes/notification.routes');
const globalSessionRoutes = require('./routes/globalSession.routes');
const uploadRoutes = require('./routes/upload.routes');
const dailyLogRoutes = require('./routes/dailyLog.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const reportRoutes = require('./routes/report.routes');

const { authenticate } = require('./middleware/auth');
const { requireRole } = require('./middleware/role');
const { getAll: getNotifications, markRead: markNotificationRead } = require('./controllers/notification.controller');
const { errorHandler } = require('./middleware/errorHandler');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust first proxy to fix express-rate-limit X-Forwarded-For error
const PORT = process.env.PORT || 3000;

// ── Rate Limiting Setup ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many requests from this IP, please try again after 15 minutes' }
});

// ── Global Middleware ──────────────────────────────────────────────────────────
// Apply helmet early to inject security headers
app.use(helmet());

// Update CORS to be strict
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'https://chesscoach-theta.vercel.app']
  : ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'https://chesscoach-theta.vercel.app'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Apply global rate limiter
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────

// Auth
app.use('/api/auth', authRoutes);

// Students
app.use('/api/students', studentRoutes);

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

// Daily practice logs (nested under classroom)
app.use('/api/classrooms/:classroomId/daily-logs', dailyLogRoutes);

// Classroom-level analytics (nested under classroom)
app.use('/api/classrooms/:classroomId/analytics', analyticsRoutes);

// Monthly progress reports (nested under classroom)
app.use('/api/classrooms/:classroomId/reports', reportRoutes);

// Global analytics (trainer inbox-style, top-level)
app.use('/api/analytics', analyticsRoutes);

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

// ── Start Jobs & Bots ──────────────────────────────────────────────────────────
const homeworkOverdueJob = require('./jobs/homeworkOverdue.job');
homeworkOverdueJob.start();

const evaluationReminderJob = require('./jobs/evaluationReminder.job');
evaluationReminderJob.start();

const { startDiscordBot } = require('./discord/discordBot');
startDiscordBot();

// ── Start Server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Chess Coach API running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
