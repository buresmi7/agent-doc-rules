export const defaultSecurityRules = [
  {
    id: 'remote-script-execution',
    message: 'Remote script execution can run unreviewed code from documentation.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:curl|wget)\b[^|\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python|node)\b/i,
      /\b(?:sh|bash|zsh|python|node)\s+<\(\s*(?:curl|wget)\b/i,
    ],
  },
  {
    id: 'secret-exfiltration-command',
    message: 'A network command appears to send secrets or local credentials.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:curl|wget|httpie|http|scp|rsync|nc|netcat|gh\s+gist)\b.*\b(?:\.env|id_rsa|id_ed25519|github_token|aws_secret_access_key|secret|token|password|private[_ -]?key|credentials?|cookies?)\b/i,
    ],
  },
  {
    id: 'secret-disclosure-instruction',
    message: 'The line appears to ask an agent to disclose secrets or credentials.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:cat|echo|printenv|dump|paste|copy|send|upload|post|share)\b.*\b(?:\.env|id_rsa|id_ed25519|github_token|aws_secret_access_key|secrets?|tokens?|passwords?|private keys?|credentials?|cookies?)\b/i,
    ],
  },
  {
    id: 'agent-instruction-override',
    message: 'The line appears to override higher-priority agent instructions or hide changes.',
    allowSafetyFraming: false,
    patterns: [
      /\bignore\s+(?:all\s+)?(?:previous|prior|system|developer|higher[- ]priority)\s+instructions\b/i,
      /\b(?:do\s+not|don't)\s+(?:tell|mention|report|disclose|warn|notify)\s+(?:the\s+)?user\b/i,
      /\b(?:silently|secretly)\s+(?:change|edit|modify|add|remove|bypass)\b/i,
    ],
  },
  {
    id: 'validation-bypass',
    message: 'The line appears to bypass validation, tests, linting, or security checks.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:skip|bypass|disable|ignore)\b.{0,80}\b(?:tests?|lint|validation|checks?|docs:check|pre-commit|precommit|security scan|security check)\b/i,
      /(?:^|[^\w-])--no-verify\b/i,
      /\bSKIP_(?:TESTS|CHECKS|VALIDATION|LINT)\b/i,
    ],
  },
  {
    id: 'backdoor-or-auth-bypass',
    message: 'The line appears to add a backdoor or weaken authentication, authorization, or validation.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:add|create|keep|leave|implement|use)\b.{0,80}\b(?:backdoor|hardcoded admin|admin fallback|debug endpoint|bypass auth|auth bypass|fail open)\b/i,
      /\b(?:disable|bypass|turn off|remove)\b.{0,80}\b(?:auth|authentication|authorization|csrf|tls|ssl|certificate validation|input validation|rate limit|permission checks?)\b/i,
    ],
  },
  {
    id: 'remote-markdown-image',
    message: 'Remote Markdown images and HTML images can leak reader metadata.',
    allowSafetyFraming: true,
    patterns: [
      /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+/i,
      /<img\b[^>]*\bsrc=["']https?:\/\//i,
    ],
  },
  {
    id: 'tracking-link',
    message: 'Tracking query parameters do not belong in reusable repository documentation.',
    allowSafetyFraming: true,
    patterns: [
      /https?:\/\/[^\s)]+[?&](?:utm_[a-z0-9_]+|fbclid|gclid|mc_cid|ga_[a-z0-9_]+|yclid)=/i,
    ],
  },
  {
    id: 'encoded-execution-payload',
    message: 'Encoded execution payloads are hard to review in documentation.',
    allowSafetyFraming: true,
    patterns: [
      /\b(?:base64|atob|Buffer\.from)\b.{0,80}\b(?:eval|exec|sh|bash|curl|wget)\b/i,
    ],
  },
];

export function findSecurityIssues(content, {
  file,
  allowPatterns = [],
  rules = defaultSecurityRules,
} = {}) {
  const findings = [];
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (allowPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    const clauses = splitSecurityClauses(line);

    for (const rule of rules) {
      const matchingClause = clauses.find((clause) => {
        if (rule.allowSafetyFraming && isSafetyFramed(clause)) {
          return false;
        }

        return rule.patterns.some((pattern) => pattern.test(clause));
      });

      if (!matchingClause) {
        continue;
      }

      findings.push({
        file,
        line: index + 1,
        rule: rule.id,
        message: rule.message,
        text: trimFindingText(matchingClause),
      });
    }
  }

  return findings;
}

export function normalizeSecurityAllow(patterns = []) {
  return patterns.map((pattern) => new RegExp(pattern, 'i'));
}

function isSafetyFramed(line) {
  return /^\s*(?:[-*+]\s+|\d+\.\s+|>\s*)?(?:do not|don't|never|avoid|refuse|reject|block|fail|flag|detect|warn|warning|forbid|prohibit|must not|should not|cannot|can't)\b/i
    .test(line);
}

function splitSecurityClauses(line) {
  return line
    .split(/\s*;\s*|(?<=[.!?])\s+(?=[A-Z`"'])|\s+(?:but|unless|except|instead|then)\s+/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function trimFindingText(line) {
  const text = line.trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}
