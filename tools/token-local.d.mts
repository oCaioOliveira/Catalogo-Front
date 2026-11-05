/** Tipos de tools/token-local.mjs, para os E2E (TypeScript). */
export interface TokenLocal {
  token: string;
  expiraEm: string;
  usuario: { id: string; matricula: string; perfil: string };
}

export function tokenLocal(matricula: string): TokenLocal;
