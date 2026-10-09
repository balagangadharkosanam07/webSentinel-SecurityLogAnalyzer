import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  metaOrStatusCode?: Record<string, any> | number,
  statusCode = 200
): Response {
  let meta: Record<string, any> = {};
  let status = statusCode;

  if (typeof metaOrStatusCode === 'number') {
    status = metaOrStatusCode;
  } else if (metaOrStatusCode) {
    meta = metaOrStatusCode;
  }

  return res.status(status).json({
    success: true,
    data,
    meta,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: any
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
