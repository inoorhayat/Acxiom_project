import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Required when deployed behind Render/Vercel proxies so rate limiting sees real client IPs
app.set('trust proxy', 1);
app.use(helmet());

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
      return cb(new Error('Origin not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '100kb' }));

// Brute-force protection on login (in addition to per-account lockout)
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again later.' },
  })
);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'AcxiomCRM' }));
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`AcxiomCRM API running on port ${PORT}`)))
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
