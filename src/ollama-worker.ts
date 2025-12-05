import Ollama, { Message } from 'ollama';
import { streamToken } from './requests';

export async function runOllama(
  prompt: string | Message[],
  model: string,
  correlation_id?: string,
  format?: string,
): Promise<string> {
  const messages = Array.isArray(prompt)
    ? (prompt as Message[])
    : [{ role: 'user', content: prompt }];

  const generationOptions = {
    temperature: Number(process.env.TEMPERATURE ?? 1),
    top_p: Number(process.env.TOP_P ?? 0.95),
    top_k: Number(process.env.TOP_K ?? 0),
  };

  try {
    if (correlation_id) {
      const stream = await Ollama.chat({
        model,
        // think: false,
        options: {
          low_vram: false,
          ...generationOptions,
        },
        format,
        messages,
        stream: true,
      });

      let response = '';

      for await (const chunk of stream) {
        const content = chunk.message?.content;
        if (content) {
          await streamToken(correlation_id, content);
          response += content;
        }

        if (chunk.done) {
          await streamToken(correlation_id);
          break;
        }
      }

      return response;
    }

    const response = await Ollama.chat({
      model,
      // think: false,
      options: {
        low_vram: false,
        ...generationOptions,
      },
      format,
      messages,
      stream: false,
    });

    return response.message?.content || '';
  } catch (err) {
    console.error('Ollama error:', err);
    throw err;
  }
}
