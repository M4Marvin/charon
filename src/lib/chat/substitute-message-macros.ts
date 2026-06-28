const CHAR_RE = /\{\{char\}\}/gi;
const USER_RE = /\{\{user\}\}/gi;

export function substituteMessageMacros(text: string, env: { char: string; user: string }): string {
  if (!text) return text;
  let result = text;
  if (result.includes("{{")) {
    result = result.replace(CHAR_RE, env.char);
    result = result.replace(USER_RE, env.user);
  }
  return result;
}
