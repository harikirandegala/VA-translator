export const config = {
  api: {
    bodyParser: false, // Disabling automatic body parsing to handle binary streams / large payloads
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-groq-api-key, x-source-lang');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY || req.headers['x-groq-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        error: 'GROQ_API_KEY_REQUIRED',
        message: 'GROQ_API_KEY is not configured on Vercel yet. Please set GROQ_API_KEY in your Vercel Project Settings > Environment Variables.',
      });
    }

    // Read incoming request body into Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBuffer = Buffer.concat(chunks);

    if (!rawBuffer || rawBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty request body. Please provide audio data.' });
    }

    let audioBuffer = rawBuffer;
    let mimeType = req.headers['content-type'] || 'audio/wav';
    let language = req.headers['x-source-lang'] || req.query?.lang;

    // Check if body is JSON
    if (mimeType.includes('application/json')) {
      try {
        const jsonBody = JSON.parse(rawBuffer.toString('utf8'));
        if (jsonBody.audioBase64) {
          audioBuffer = Buffer.from(jsonBody.audioBase64, 'base64');
        }
        if (jsonBody.mimeType) {
          mimeType = jsonBody.mimeType;
        }
        if (jsonBody.language) {
          language = jsonBody.language;
        }
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    // Prepare FormData for Groq Whisper
    const formData = new FormData();
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp3') ? 'mp3' : 'wav';
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => ({}));
      return res.status(groqResponse.status).json({
        error: 'GROQ_API_ERROR',
        message: errData.error?.message || `Groq Whisper failed with status ${groqResponse.status}`,
      });
    }

    const result = await groqResponse.json();
    return res.status(200).json({
      text: result.text || '',
      language: result.language || language || 'en',
      duration: result.duration || 0,
      segments: result.segments || [],
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: error.message || 'Internal server error during transcription',
    });
  }
}
