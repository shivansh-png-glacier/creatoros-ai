
const response = await fetch('http://localhost:8787/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    topic: 'How students can use AI to study smarter',
    platform: 'Instagram',
    audience: 'college students',
    tone: 'Bold and useful',
    goal: 'Grow an engaged audience'
  }),
  signal: AbortSignal.timeout(70000)
});

console.log('HTTP status:', response.status);
console.log('Response:', await response.text());
