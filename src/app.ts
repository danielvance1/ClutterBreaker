import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import { attachUser } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';

export const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', createAuthRouter());

// Bad JSON bodies are the caller's fault; everything else is ours. Nothing is logged
// from the request, so no passwords or tokens can leak.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  console.error(err instanceof Error ? err.message : 'Unknown error');
  res.status(500).json({ error: 'Something went wrong' });
};
app.use(errorHandler);
