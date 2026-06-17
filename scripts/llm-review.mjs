import { readFileSync } from 'node:fs';

const host = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_MODEL;

if (!model) {
  console.log('Skipping LLM review: set OLLAMA_MODEL to enable it.');
  process.exit(0);
}

const files = [
  'README.md',
  'AGENTS.md',
  'rules/agents-md.md',
  'rules/documentation-architecture.md',
  'templates/AGENTS.project.md',
  'templates/AGENTS.overlay.md',
];

const corpus = files
  .map((file) => `--- ${file} ---\n${readFileSync(file, 'utf8')}`)
  .join('\n\n');

const prompt = `You are reviewing a small documentation-rules library.

Return JSON only with this shape:
{"pass": boolean, "findings": [{"file": string, "problem": string, "fix": string}]}

Pass only if the docs are concise, reusable across repositories, avoid project-specific workflow, avoid tool-specific recommendations, and explain installation clearly.

Documents:
${corpus}`;

const response = await fetch(`${host}/api/generate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    prompt,
    stream: false,
    format: 'json',
    options: {
      temperature: 0,
    },
  }),
}).catch((error) => {
  console.log(`Skipping LLM review: could not reach Ollama at ${host}: ${error.message}`);
  process.exit(0);
});

if (!response.ok) {
  console.log(`Skipping LLM review: Ollama returned HTTP ${response.status}.`);
  process.exit(0);
}

const data = await response.json();
let review;

try {
  review = JSON.parse(data.response);
} catch {
  console.error('LLM review failed: model did not return valid JSON.');
  console.error(data.response);
  process.exit(1);
}

if (!review.pass) {
  console.error('LLM review failed:');
  for (const finding of review.findings ?? []) {
    console.error(`- ${finding.file}: ${finding.problem} Fix: ${finding.fix}`);
  }
  process.exit(1);
}

console.log('LLM review passed.');
