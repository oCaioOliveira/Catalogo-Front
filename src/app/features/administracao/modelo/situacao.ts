import { UsuarioAdmin } from '../../../core/administracao/modelo-administracao';

/** A situação de um usuário na listagem e no detalhe (regras-administracao.spec.ts): Ativo ou Inativo. */
export interface Situacao {
  rotulo: string;
  severidade: 'success' | 'warn' | 'secondary';
}

export function situacaoDoUsuario(usuario: Pick<UsuarioAdmin, 'ativo'>): Situacao {
  return usuario.ativo ? { rotulo: 'Ativo', severidade: 'success' } : { rotulo: 'Inativo', severidade: 'secondary' };
}
