import Handlebars from 'handlebars';

Handlebars.registerHelper('json', (context: unknown) => {
  return JSON.stringify(context, null, 2);
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

Handlebars.registerHelper('snake_case', (str: string) => {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '');
});

Handlebars.registerHelper('kebab_case', (str: string) => {
  return str.replace(/[_\s]/g, '-').replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^-/, '');
});

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled(data);
}
