import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AreaAtualService } from '../metadados/area-atual.service';
import { podeVerAprovacoes } from '../permissoes/permissoes';
import { AprovacaoService } from './aprovacao.service';

/** De quanto em quanto tempo o contador de pendentes do menu é atualizado, além de ao entrar e ao trocar de área (ADR 0045). */
export const INTERVALO_CONTADOR_MS = 2 * 60 * 1000;

/**
 * Os contadores de pendentes de aprovação: o de "Aprovações" no cabeçalho (todas as áreas) e o do Início (por área). Só para quem
 * vê a fila (GESTOR e ADMINISTRADOR, RN36: a mesma regra que mostra o atalho); para os outros perfis, NENHUMA requisição.
 *
 * Quando consulta: ao entrar (ou trocar de usuário na mesma aba), ao trocar de área, depois de uma decisão (`atualizar`) e a cada
 * 2 minutos, sem tempo real (ADR 0045). Navegar entre telas não consulta de novo: o Início usa o valor guardado da área. As
 * consultas são de fundo: se falharem, falham em silêncio (sem toast) e o menu mostra só o item.
 *
 * O serviço é da raiz e sobrevive ao logout: por isso ele segue o usuário logado (um GESTOR que sai e um INTERNO que entra na mesma
 * aba não herdam o contador nem o intervalo). Também guarda o endereço da fila (com os filtros), para o detalhe voltar a ela.
 */
@Injectable({ providedIn: 'root' })
export class PendentesService {
  private readonly aprovacao = inject(AprovacaoService);
  private readonly auth = inject(AuthService);
  private readonly areaAtual = inject(AreaAtualService);

  readonly quantidade = signal<number | null>(null);
  /** A fila como a pessoa a deixou (filtros na URL). */
  readonly urlDaFila = signal('/aprovacoes');

  /** O usuário que conta (id), ou null se ninguém logado ou o perfil não vê a fila. Só muda com o usuário ou o perfil. */
  private readonly quemConta = computed(() => {
    const usuario = this.auth.usuario();
    return usuario && podeVerAprovacoes(usuario) ? usuario.id : null;
  });
  private intervalo: ReturnType<typeof setInterval> | null = null;
  /** Os pendentes por área, para o Início (um pedido por área até a próxima atualização). */
  private porArea = new Map<string, Promise<number | null>>();

  constructor() {
    effect(() => {
      const quem = this.quemConta();
      this.areaAtual.grupo();
      untracked(() => (quem ? this.ligar() : this.desligar()));
    });
    inject(DestroyRef).onDestroy(() => this.desligar());
  }

  /** Atualiza o contador do cabeçalho e esquece os das áreas. Sem permissão, não faz nada (nenhuma requisição). */
  async atualizar(): Promise<void> {
    const quem = this.quemConta();
    if (!quem) {
      return;
    }
    this.porArea.clear();
    try {
      const quantidade = await this.aprovacao.quantidadePendentes();
      if (this.quemConta() === quem) {
        this.quantidade.set(quantidade);
      }
    } catch {
      // Sem contador (ex.: API fora do ar): o menu mostra só o item.
    }
  }

  /** Os pendentes de uma área (Início). null: o perfil não vê a fila, ou a consulta falhou. */
  daArea(grupo: string): Promise<number | null> {
    if (!this.quemConta()) {
      return Promise.resolve(null);
    }
    let pedido = this.porArea.get(grupo);
    if (!pedido) {
      pedido = this.aprovacao.quantidadePendentes(grupo).catch(() => {
        this.porArea.delete(grupo);
        return null;
      });
      this.porArea.set(grupo, pedido);
    }
    return pedido;
  }

  private ligar(): void {
    void this.atualizar();
    this.intervalo ??= setInterval(() => void this.atualizar(), INTERVALO_CONTADOR_MS);
  }

  private desligar(): void {
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
    this.porArea.clear();
    this.quantidade.set(null);
  }
}
