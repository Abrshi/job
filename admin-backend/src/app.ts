import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors';
import { apiRateLimiter } from './middleware/rate-limit';
import { errorHandler, AppError } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import routes from './routes';

const app: Express = express();

// Correlation ID Tracking
app.use(requestIdMiddleware);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiting
app.use('/api', apiRateLimiter);

// Versioned Admin Routes (/api/v1)
app.use('/api/v1', routes);

// 404 Fallback
app.use((req, res, next) => {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
});

// Centralized Error Handler
app.use(errorHandler);

export default app;

