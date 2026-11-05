import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../../api/api';
// Direto do arquivo de cada operação (e não do barril api/functions): este serviço carrega na partida, e o barril leva o cliente
// inteiro para o bundle inicial (cada função gerada tem um efeito colateral, o `.PATH`, que impede o tree-shaking).
import { apiV1AuthEuGet } from '../../api/fn/auth/api-v-1-auth-eu-get';
import { apiV1AuthLoginPost } from '../../api/fn/auth/api-v-1-auth-login-post';
import { silencioso } from '../erros/contexto-erros';
import { MetadadosService } from '../metadados/metadados.service';
import { gravarToken, lerToken } from './armazenamento-sessao';
import { UsuarioLogado, usuarioDeDto } from './usuario';

/**
 * Por que não há sessão: `negado` (a API recusou o usuário do Windows: sem credencial, 401, ou usuário desativado, 403),
 * `indisponivel` (a API não respondeu ou deu erro) ou `saiu` (a pessoa clicou em Sair).
 */
export type FalhaAcesso = 'negado' | 'indisponivel' | 'saiu';

/**
 * Sessão do usuário: o token (espelhado em sessionStorage) e o usuário logado, como signals. Não há tela de login: o login é a
 * autenticação integrada do Windows (RN23, ADR 0054). Ao abrir, o front chama POST /auth/login com as credenciais do navegador
 * (withCredentials, posto pelo authInterceptor) e guarda o JWT, que vale para o resto da API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly metadados = inject(MetadadosService);

  readonly token = signal<string | null>(lerToken());
  readonly usuario = signal<UsuarioLogado | null>(null);
  readonly logado = computed(() => this.token() !== null && this.usuario() !== null);
  /** Nulo enquanto há sessão (ou antes da primeira tentativa). */
  readonly falha = signal<FalhaAcesso | null>(null);

  /**
   * Ao abrir ou recarregar a página: entra pelo Windows (sempre, mesmo com um token guardado: assim o perfil, as equipes e a
   * situação vêm atualizados). Não lança: se não der para entrar, `falha` diz por quê.
   */
  async iniciar(): Promise<void> {
    await this.entrar();
  }

  /** Login pelo Windows (RN23): devolve se entrou. A matrícula nova vira um usuário EXTERNO sem equipe (RN105). */
  async entrar(): Promise<boolean> {
    try {
      // Sem toast: quem mostra o erro é a tela de acesso (negado ou indisponível).
      const resposta = await this.api.invoke(apiV1AuthLoginPost, {}, silencioso());
      this.definirToken(resposta.token ?? null);
      // O "eu" traz as equipes ATIVAS e o perfil atual (podem ter mudado depois do token, RN23).
      await this.carregarUsuario();
      this.falha.set(null);
      return true;
    } catch (erro) {
      this.limparSessao();
      this.falha.set(falhaDoErro(erro));
      return false;
    }
  }

  async carregarUsuario(): Promise<UsuarioLogado> {
    const usuario = usuarioDeDto(await this.api.invoke(apiV1AuthEuGet));
    this.usuario.set(usuario);
    return usuario;
  }

  /** Esquece a sessão e mostra a tela de acesso, sem entrar de novo sozinho (o Windows entraria na hora). */
  sair(): void {
    this.limparSessao();
    this.falha.set('saiu');
    void this.router.navigate(['/acesso']);
  }

  /** Esquece o token, o usuário e os metadados (o próximo usuário pode ver outras entidades). */
  limparSessao(): void {
    this.definirToken(null);
    this.usuario.set(null);
    this.metadados.limpar();
  }

  private definirToken(token: string | null): void {
    gravarToken(token);
    this.token.set(token);
  }
}

/** 401 (sem credencial do Windows ou matrícula inválida) e 403 (usuário desativado): negado. O resto: indisponível. */
export function falhaDoErro(erro: unknown): FalhaAcesso {
  return erro instanceof HttpErrorResponse && (erro.status === 401 || erro.status === 403) ? 'negado' : 'indisponivel';
}
