export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(input: string, vars: TemplateVars): string {
  return input.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (_m, key: string) => {
    const value = vars[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}



