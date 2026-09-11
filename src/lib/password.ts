export type PasswordCheck = {
  ok: boolean;
  score: number;
  problems: string[];
};

export function checkPassword(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 8) problems.push("pelo menos 8 caracteres");
  if (!/[A-Z]/.test(password)) problems.push("uma letra maiúscula");
  if (!/[a-z]/.test(password)) problems.push("uma letra minúscula");
  if (!/[0-9]/.test(password)) problems.push("um número");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("um símbolo");

  const score = 5 - problems.length + (password.length >= 12 ? 1 : 0);
  return { ok: problems.length === 0, score: Math.max(0, Math.min(6, score)), problems };
}

export const passwordRulesText =
  "A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo.";
