import { UsuarioAdmin } from '../../../core/administracao/modelo-administracao';
import { mensagemDesativarEquipe } from '../comum/acoes-usuario.service';
import { avisoEdicaoPropria, membrosSemOutraEquipeAtiva } from './regras-administracao';
import { situacaoDoUsuario } from './situacao';

function usuario(extras: Partial<UsuarioAdmin>): UsuarioAdmin {
  return {
    id: 'u',
    matricula: 'm',
    nome: 'n',
    perfil: 'INTERNO',
    ativo: true,
    ultimoAcessoEm: null,
    criadoEm: '2026-10-01T00:00:00Z',
    equipes: [],
    ...extras,
  };
}

describe('aviso ao editar o próprio perfil', () => {
  const eu = usuario({ id: 'eu', perfil: 'ADMINISTRADOR' });

  it('avisa o administrador que troca o PRÓPRIO perfil: perde a administração', () => {
    expect(avisoEdicaoPropria('eu', eu, 'GESTOR')).toContain('perde o acesso à administração');
  });

  it('não avisa se continua administrador, se é outro usuário ou se não está logado', () => {
    expect(avisoEdicaoPropria('eu', eu, 'ADMINISTRADOR')).toBeNull();
    expect(avisoEdicaoPropria('outro', eu, 'GESTOR')).toBeNull();
    expect(avisoEdicaoPropria(null, eu, 'GESTOR')).toBeNull();
  });
});

describe('membros que ficariam sem equipe ativa (RN31)', () => {
  const alfa = { id: 'alfa', nome: 'Alfa', ativa: true };
  const beta = { id: 'beta', nome: 'Beta', ativa: true };
  const betaInativa = { ...beta, ativa: false };

  it('conta só quem é ativo, não é administrador e não tem outra equipe ATIVA', () => {
    const membros = [
      usuario({ id: 'so-alfa', equipes: [alfa] }),
      usuario({ id: 'alfa-e-beta', equipes: [alfa, beta] }),
      usuario({ id: 'alfa-e-beta-inativa', equipes: [alfa, betaInativa] }),
      usuario({ id: 'inativo', ativo: false, equipes: [alfa] }),
      usuario({ id: 'admin', perfil: 'ADMINISTRADOR', equipes: [alfa] }),
    ];
    expect(membrosSemOutraEquipeAtiva(membros, 'alfa').map((u) => u.id)).toEqual(['so-alfa', 'alfa-e-beta-inativa']);
  });

  it('a confirmação diz quantos são afetados e, se alguém ficaria sem equipe, que a desativação é bloqueada', () => {
    expect(mensagemDesativarEquipe('Alfa', 3, 0)).toContain('3 usuário(s) ativo(s) afetado(s)');
    expect(mensagemDesativarEquipe('Alfa', 3, 0)).toContain('NÃO são apagados');
    expect(mensagemDesativarEquipe('Alfa', 3, 2)).toContain('2 usuário(s) ficariam sem NENHUMA equipe ativa');
  });
});

describe('situação do usuário', () => {
  it('Ativo ou Inativo (não há mais bloqueio por tentativas: o login é o do Windows)', () => {
    expect(situacaoDoUsuario(usuario({ ativo: false }))).toEqual({ rotulo: 'Inativo', severidade: 'secondary' });
    expect(situacaoDoUsuario(usuario({ ativo: true }))).toEqual({ rotulo: 'Ativo', severidade: 'success' });
  });
});
