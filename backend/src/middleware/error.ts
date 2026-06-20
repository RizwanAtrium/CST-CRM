import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const notFound: RequestHandler = (req, _res, next) => next(new AppError(404, `Route not found: ${req.method} ${req.path}`));

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, error: error.message, details: error.details });
  if (error instanceof ZodError) return res.status(422).json({ success: false, error: 'Validation failed', details: error.flatten() });
  if (error instanceof mongoose.Error.CastError) return res.status(400).json({ success: false, error: `Invalid ${error.path}` });
  if (error instanceof mongoose.Error.ValidationError) return res.status(422).json({ success: false, error: error.message });
  if (error instanceof mongoose.Error.VersionError) return res.status(409).json({ success: false, error: 'Record changed by another user; refresh and retry' });
  if ((error as { code?: number }).code === 11000) return res.status(409).json({ success: false, error: 'Duplicate record' });
  console.error(error);
  return res.status(500).json({ success: false, error: 'Internal server error' });
};
