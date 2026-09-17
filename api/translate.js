export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-groq-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      // Read raw body if not parsed
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        body = {};
      }
    }

    const { text, sourceLang = 'auto', targetLang = 'en' } = body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Missing text to translate' });
    }

    if (sourceLang === targetLang && sourceLang !== 'auto') {
      return res.status(200).json({ translatedText: text, sourceLang, targetLang });
    }

    const apiKey = process.env.GROQ_API_KEY || req.headers?.['x-groq-api-key'];

    // Method 1: If Groq API key is available, use LLaMA for high-quality translation
    if (apiKey) {
      try {
        const langNames = {
          en: 'English', es: 'Spanish', fr: 'French', de: 'German',
          hi: 'Hindi', ja: 'Japanese', ko: 'Korean', ar: 'Arabic',
          zh: 'Chinese (Simplified)', pt: 'Portuguese', it: 'Italian',
          ru: 'Russian', tr: 'Turkish'
        };

        const targetLangName = langNames[targetLang] || targetLang;
        const sourceLangName = sourceLang !== 'auto' ? (langNames[sourceLang] || sourceLang) : 'the original language';

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: `You are an expert audio/video translator. Translate the provided transcript from ${sourceLangName} into fluent, natural ${targetLangName}. Maintain punctuation, tone, and pacing. Return ONLY the translated text, without commentary, notes, or quotation marks.`,
              },
              {
                role: 'user',
                content: text,
              },
            ],
            temperature: 0.3,
            max_tokens: 4096,
          }),
        });

        if (groqResponse.ok) {
          const data = await groqResponse.json();
          const translatedText = data.choices?.[0]?.message?.content?.trim();
          if (translatedText) {
            return res.status(200).json({
              translatedText,
              sourceLang,
              targetLang,
              engine: 'groq-llama',
            });
          }
        }
      } catch (err) {
        console.warn('Groq translation failed, falling back to MyMemory:', err);
      }
    }

    // Method 2: Fallback to free MyMemory API (no API key required)
    const src = sourceLang === 'auto' ? 'en' : sourceLang;
    const tgt = targetLang;

    // MyMemory accepts chunks of ~500 chars (translate up to 10 chunks in parallel)
    const chunks = splitIntoChunks(text, 450).slice(0, 10);
    const translatedParts = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${src}|${tgt}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (data.responseData?.translatedText) {
              return data.responseData.translatedText;
            }
          }
        } catch {
          // fallback to original chunk on network error
        }
        return chunk;
      })
    );

    return res.status(200).json({
      translatedText: translatedParts.join(' '),
      sourceLang,
      targetLang,
      engine: 'mymemory',
    });
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({
      error: 'TRANSLATION_ERROR',
      message: error.message || 'Failed to translate transcript',
    });
  }
}

function splitIntoChunks(str, maxLength) {
  if (str.length <= maxLength) return [str];
  const sentences = str.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [str];
  const chunks = [];
  let currentChunk = '';

  for (const s of sentences) {
    if ((currentChunk + ' ' + s).length > maxLength) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = s;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + s;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}
