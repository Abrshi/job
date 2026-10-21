import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors';
import { apiRateLimiter } from './middleware/rate-limit';
import { errorHandler, AppError } from './middleware/error-handler';
import routes from './routes';

const app: Express = express();

// Common Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting for API endpoints
app.use('/api', apiRateLimiter);

// Top-level API Routes (versioned under /api/v1)
app.use('/api/v1', routes);

// 404 Fallback
app.use((req, res, next) => {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

// Centralized Error Handler
app.use(errorHandler);

export default app;

