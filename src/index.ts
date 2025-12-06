import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { runOllama } from './ollama-worker';
import { RerankerPool } from './ranking/reranker-pool';

/* Config */

const pool = new RerankerPool(Number(process.env.RANKER_POOL ?? 1));
const app = express();
app.use(express.json());

/* Auth middleware */

const apiKeyAuth = (req: any, res: any, next: any) => {
  const apiKey = req.header('x-api-key');

  const validApiKey = process.env.API_KEY;

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(403).json({ error: 'Invalid x-api-key' });
  }

  next();
};

/* Endpoints */

// app.post('/ask', apiKeyAuth, async (req: any, res: any) => {
//   const { prompt } = req.body;
//   if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

//   const correlationId = req.query.correlation_id;
//   const streaming = req.query.streaming === 'true';
//   if (streaming && !correlationId)
//     return res.status(400).json({ error: 'Missing correlation id' });

//   try {
//     res.writeHead(200, { 'Content-Type': 'application/json' });
//     res.write(' ');

//     const result = await runOllama(prompt, correlationId);

//     res.end(JSON.stringify({ response: result }));
//   } catch (err) {
//     console.error(err);
//     res.end(JSON.stringify({ error: err?.toString() }));
//   }
// });

app.post('/ask', apiKeyAuth, async (req: any, res: any) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const correlationId = req.query.correlation_id;
  const streaming = req.query.streaming === 'true';

  if (streaming && !correlationId)
    return res.status(400).json({ error: 'Missing correlation id' });

  const model = req.query.model;
  if (!model) return res.status(400).json({ error: 'Missing model' });

  const format = req.query.format;

  try {
    const result = await runOllama(prompt, model, correlationId, format);
    res.json({ response: result, model });
  } catch (err) {
    res.status(500).json({ error: err?.toString() });
  }
});

app.post('/rank', apiKeyAuth, async (req: any, res: any) => {
  const { query, chunks } = req.body;

  if (!query || !chunks || !Array.isArray(chunks) || chunks.length === 0)
    return res
      .status(400)
      .json({ success: false, error: 'Missing correlation id' });

  for (const chunk of chunks) {
    if (!chunk.id || !chunk.text)
      return res.status(400).json({ success: false, error: 'Invalid chunks' });
  }

  try {
    const result = await pool.exec({
      query,
      chunks,
    });

    return res.json({ success: true, scores: Object.fromEntries(result) });
  } catch (err) {
    console.warn(`Ranking error: ${err}`);

    return res.status(500).json({ success: false, error: err });
  }
});

app.listen(process.env.PORT ?? 3000, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
