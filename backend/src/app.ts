import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
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

const app = express();

// ─── Security ───
app.use(helmet());

// ─── CORS ───
app.use(
  cors({
    origin: env.FRONTEND_URL,
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

// ─── 404 Handler ───
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// ─── Global Error Handler ───
app.use(errorMiddleware);

export default app;
