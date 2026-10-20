
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '40kb' }));

const port = Number(process.env.PORT || 8787);
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(apiKey),
    provider: 'Google Gemini',
    message: apiKey ? 'Gemini is configured.' : 'Add GEMINI_API_KEY to .env'
  });
});

const clean = (value, max = 500) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

app.post('/api/generate', async (req, res) => {
  
  const topic = clean(req.body?.topic, 500);
  const platform = clean(req.body?.platform, 40) || 'Instagram';
  const audience = clean(req.body?.audience, 120) || 'content creators';
  const tone = clean(req.body?.tone, 80) || 'Bold and useful';
  const goal = clean(req.body?.goal, 100) || 'Grow an engaged audience';

  if (topic.length < 4) {
    return res.status(400).json({
      error: 'Please enter a more specific content idea.'
    });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini API key is missing. Add GEMINI_API_KEY to your .env file.'
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are CreatorOS, an expert content strategist.
Create specific, useful campaigns for creators.
Never promise guaranteed views or engagement.
Return valid JSON only, with these fields:
title (string), topic (string), platform (string),
hooks (array of 3 strings), caption (string),
cta (string), ideas (array of 3 strings),
thumbnail (string of at most 8 words).
Adapt the format and style to the selected platform.
Avoid generic advice and fabricated statistics.`
            }]
          },
          contents: [{
            role: 'user',
            parts: [{
              text: JSON.stringify({
                topic, platform, audience, tone, goal
              })
            }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', response.status, result.error?.message);
      return res.status(502).json({
        error: result.error?.message ||
          `Gemini API request failed (${response.status}). Check your key, model and API access.`
      });
    }

    const text = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('');

    if (!text) {
      return res.status(502).json({
        error: 'Gemini returned no campaign content. Try again.'
      });
    }

    const campaign = JSON.parse(text);

    if (
      typeof campaign.title !== 'string' ||
      typeof campaign.caption !== 'string' ||
      !Array.isArray(campaign.hooks) ||
      !Array.isArray(campaign.ideas)
    ) {
      throw new Error('Gemini returned an incomplete campaign.');
    }

    res.json({
      mode: 'gemini',
      campaign: { ...campaign, topic, platform }
    });
  } catch (error) {
    console.error('Campaign generation failed:', error);

    if (!res.headersSent && !res.destroyed) {
      const timedOut = error.name === 'TimeoutError';

      res.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? 'Gemini took too long to respond. Please try again.'
          : 'Campaign generation failed. Check the backend terminal for details.',
        details: error.message
      });
    }
  }
});

app.listen(port, () => {
  console.log(`CreatorOS API running at http://localhost:${port}`);
  console.log(apiKey ? `Gemini mode enabled (${model}).` : 'Gemini API key missing.');
});
