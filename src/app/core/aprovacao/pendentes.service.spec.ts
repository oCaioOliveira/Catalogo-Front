import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Perfil, UsuarioLogado } from '../auth/usuario';
import { Listagem } from '../metadados/listagens';
import { AreaAtualService } from '../metadados/area-atual.service';
import { AprovacaoService } from './aprovacao.service';
import { INTERVALO_CONTADOR_MS, PendentesService } from './pendentes.service';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class TelaVazia {}

function usuario(perfil: Perfil, id = `u-${perfil}`): UsuarioLogado {
  return { id, matricula: id, nome: id, perfil, deveTrocarSenha: false, equipes: [{ id: 'e1', nome: 'Equipe' }] };
}

function area(chave: string): Listagem {
  return { chave, nome: chave, ativo: true, possuiEquipes: true, minhasEquipes: [] } as unknown as Listagem;
}

describe('PendentesService (contador de pendentes de aprovação)', () => {
  let logado: ReturnType<typeof signal<UsuarioLogado | null>>;
  let aprovacao: jasmine.SpyObj<AprovacaoService>;
  let router: Router;
  let areaAtual: AreaAtualService;

  beforeEach(() => {
    jasmine.clock().install();
    localStorage.removeItem('catalogo.ultimaListagem');
    logado = signal<UsuarioLogado | null>(null);
    aprovacao = jasmine.createSpyObj<AprovacaoService>('AprovacaoService', ['quantidadePendentes']);
    aprovacao.quantidadePendentes.and.resolveTo(3);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: TelaVazia },
          { path: 'b', component: TelaVazia },
          { path: 'c', component: TelaVazia },
        ]),
        { provide: AuthService, useValue: { usuario: logado } },
        { provide: AprovacaoService, useValue: aprovacao },
      ],
    });
    router = TestBed.inject(Router);
    areaAtual = TestBed.inject(AreaAtualService);
    areaAtual.atualizarAreas([area('testes_desempenho'), area('inventario')]);
  });

  afterEach(() => jasmine.clock().uninstall());

  function criar(): PendentesService {
    const servico = TestBed.inject(PendentesService);
    TestBed.tick();
    return servico;
  }

  async function navegarPorTresTelas(): Promise<void> {
    for (const tela of ['/a', '/b', '/c']) {
      await router.navigateByUrl(tela);
      TestBed.tick();
    }
  }

  for (const perfil of ['EXTERNO', 'INTERNO'] as const) {
    it(`${perfil}: nenhuma requisição (carga, navegação, troca de área, intervalo, decisão e Início)`, async () => {
      logado.set(usuario(perfil));
      const servico = criar();

      await navegarPorTresTelas();
      areaAtual.definir('inventario');
      TestBed.tick();
      jasmine.clock().tick(INTERVALO_CONTADOR_MS * 3);
      await servico.atualizar();

      expect(await servico.daArea('testes_desempenho')).toBeNull();
      expect(aprovacao.quantidadePendentes).not.toHaveBeenCalled();
      expect(servico.quantidade()).toBeNull();
    });
  }

  for (const perfil of ['GESTOR', 'ADMINISTRADOR'] as const) {
    it(`${perfil}: uma consulta na carga, nenhuma a mais ao navegar, e o contador aparece`, async () => {
      logado.set(usuario(perfil));
      const servico = criar();
      await Promise.resolve();

      expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(1);
      expect(servico.quantidade()).toBe(3);

      await navegarPorTresTelas();
      expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(1);
    });
  }

  it('GESTOR: uma consulta por troca de área e uma a cada intervalo', () => {
    logado.set(usuario('GESTOR'));
    criar();
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(1);

    areaAtual.definir('inventario');
    TestBed.tick();
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(2);

    // A mesma área de novo não consulta.
    areaAtual.definir('inventario');
    TestBed.tick();
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(2);

    jasmine.clock().tick(INTERVALO_CONTADOR_MS);
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(3);
  });

  it('o mesmo usuário recarregado (ex.: depois da troca de senha) não consulta de novo', () => {
    logado.set(usuario('GESTOR'));
    criar();
    logado.set(usuario('GESTOR'));
    TestBed.tick();
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledTimes(1);
  });

  it('GESTOR sai e INTERNO entra na mesma aba: o contador some e nada mais é consultado', async () => {
    logado.set(usuario('GESTOR'));
    const servico = criar();
    await Promise.resolve();
    expect(servico.quantidade()).toBe(3);

    logado.set(null);
    TestBed.tick();
    logado.set(usuario('INTERNO'));
    TestBed.tick();
    aprovacao.quantidadePendentes.calls.reset();

    expect(servico.quantidade()).toBeNull();
    await navegarPorTresTelas();
    jasmine.clock().tick(INTERVALO_CONTADOR_MS * 3);
    await servico.atualizar();
    expect(aprovacao.quantidadePendentes).not.toHaveBeenCalled();
  });

  it('pendentes da área (Início): uma consulta por área, guardada até a próxima atualização', async () => {
    logado.set(usuario('GESTOR'));
    const servico = criar();
    aprovacao.quantidadePendentes.calls.reset();
    aprovacao.quantidadePendentes.withArgs('testes_desempenho').and.resolveTo(2);

    expect(await servico.daArea('testes_desempenho')).toBe(2);
    expect(await servico.daArea('testes_desempenho')).toBe(2);
    expect(aprovacao.quantidadePendentes).toHaveBeenCalledOnceWith('testes_desempenho');

    // Depois de uma decisão, o valor da área é consultado de novo.
    await servico.atualizar();
    await servico.daArea('testes_desempenho');
    expect(aprovacao.quantidadePendentes.calls.allArgs()).toEqual([['testes_desempenho'], [], ['testes_desempenho']]);
  });

  it('falha da consulta: sem contador e sem erro (requisição de fundo)', async () => {
    aprovacao.quantidadePendentes.and.rejectWith(new Error('API fora do ar'));
    logado.set(usuario('GESTOR'));
    const servico = criar();

    await expectAsync(servico.atualizar()).toBeResolved();
    expect(await servico.daArea('testes_desempenho')).toBeNull();
    expect(servico.quantidade()).toBeNull();
  });
});
