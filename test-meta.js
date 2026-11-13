import 'dotenv/config';

const key = process.env.MODEL_API_KEY;

if (!key) {
  console.error('MODEL_API_KEY is missing from .env');
  process.exit(1);
}

try {
  const response = await fetch('https://api.meta.ai/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.MODEL_API_MODEL || 'muse-spark-1.3',
      input: 'Reply with exactly: Meta API works'
    }),
    signal: AbortSignal.timeout(60000)
  });

  console.log('HTTP status:', response.status);
  console.log('Response:', await response.text());
} catch (error) {
  console.error('Request failed:', error.message);
  console.error('Cause:', error.cause?.message || 'No additional details');
}
