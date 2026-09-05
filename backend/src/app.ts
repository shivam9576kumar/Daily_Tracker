import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { errorMiddleware } from './middleware/errorMiddleware';
import { timezoneMiddleware } from './middleware/timezoneMiddleware';
import { sendSuccess } from './utils/response';

// Route imports
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import notesRoutes from './routes/notesRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import debugRoutes from './routes/debugRoutes';
import planRoutes from './routes/planRoutes';
import progressRoutes from './routes/progressRoutes';
import classesRoutes from './routes/classesRoutes';
import potdRoutes from './routes/potdRoutes';

const app = express();

// ─── Security ───
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// ─── CORS ───
app.use(
  cors({
    origin: env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Timezone'],
  })
);

// ─── Body Parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Timezone Middleware ───
app.use(timezoneMiddleware);

// ─── Request Logging ───
if (env.isDev) {
  app.use(morgan('dev'));
}

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
  sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks', notesRoutes); // Notes nested under /api/tasks/:id/notes
app.use('/api/assignments', assignmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/potd', potdRoutes);

// ─── Production Static Hosting & SPA Fallback ───
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// ─── 404 Handler for API routes ───
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// ─── Global Error Handler ───
app.use(errorMiddleware);

export default app;
