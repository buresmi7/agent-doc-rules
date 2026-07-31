export const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    failedCriteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                target: {
                  type: 'string',
                  enum: ['response', 'file'],
                },
                path: { type: 'string' },
                quote: { type: 'string' },
              },
              required: ['target', 'path', 'quote'],
            },
          },
        },
        required: ['id', 'reason', 'evidence'],
      },
    },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
  required: ['pass', 'score', 'failedCriteria', 'requiredFixes', 'notes'],
};

export function render(template, values) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
