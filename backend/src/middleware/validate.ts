import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from './error-handler';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies,
      })) as any;

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) {
        try {
          req.query = parsed.query;
        } catch {
          Object.assign(req.query, parsed.query);
        }
      }
      if (parsed.params !== undefined) {
        try {
          req.params = parsed.params;
        } catch {
          Object.assign(req.params, parsed.params);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => {
          const fullPath = issue.path.map(String).join('.');
          const field = fullPath.replace(/^(body|query|params|cookies)\./, '');
          return {
            field: field || fullPath,
            message: issue.message,
          };
        });
        return next(
          AppError.validation(
            'Validation failed. Please check the submitted information.',
            details,
            error
          )
        );
      }
      next(error);
    }
  };
};
