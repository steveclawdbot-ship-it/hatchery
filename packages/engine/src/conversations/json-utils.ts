/**
 * Extract JSON from an LLM response that may include markdown fences or prose.
 */
export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceStart = text.indexOf('{');
  const bracketStart = text.indexOf('[');
  if (braceStart === -1 && bracketStart === -1) {
    throw new Error('No JSON found in LLM response');
  }
  const start = braceStart === -1 ? bracketStart
    : bracketStart === -1 ? braceStart
    : Math.min(braceStart, bracketStart);
  const isArray = text[start] === '[';
  const closer = isArray ? ']' : '}';

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === text[start]) depth++;
    if (text[i] === closer) depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Unbalanced JSON in LLM response');
}
