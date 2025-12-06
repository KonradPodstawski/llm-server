import { parentPort } from 'worker_threads';

export interface RerankerTask {
  query: string;
  chunks: { id: string; text: string }[];
}

export type RerankerResult = Map<string, number>;

let reranker: any = null;
let pipeline: any = null;

const loadModel = async () => {
  if (!pipeline) {
    const { pipeline: loadPipeline } = await import('@xenova/transformers');
    pipeline = loadPipeline;
  }

  reranker = await pipeline('text-classification', 'Xenova/bge-reranker-base', {
    quantized: false,
  });
};

const ensureModelLoaded = async () => {
  if (!reranker) {
    await loadModel();
  }
};

 const runRanking = async (task: RerankerTask): Promise<RerankerResult> => {
  if (!reranker || !reranker.tokenizer || !reranker.model)
    throw new Error('Reranker not initialized');
  const results: RerankerResult = new Map();

  // Prepare parallel arrays for batch processing
  const texts = task.chunks.map(() => task.query);
  const pairs = task.chunks.map((c) => c.text);

  try {
    // Tokenize all pairs at once
    const inputs = await reranker.tokenizer(texts, {
      text_pair: pairs,
      padding: true,
      truncation: true,
    });

    // Get logits from model
    const outputs = await reranker.model(inputs);
    const logits = outputs.logits.data;

    // Map logits back to chunk IDs
    for (let i = 0; i < task.chunks.length; i++) {
      results.set(task.chunks[i].id, Number(logits[i] ?? 0));
    }
  } catch (e: any) {
    for (const c of task.chunks) results.set(c.id, 0);
  }

  return results;
}

parentPort!.on('message', async (task: RerankerTask) => {
  await ensureModelLoaded();

  try {
    const results = await runRanking(task);
    parentPort!.postMessage(results);
  } catch (err: any) {
    parentPort!.postMessage({ error: err.message || 'Unknown worker error' });
  }
});
