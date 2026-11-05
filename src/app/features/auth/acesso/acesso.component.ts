import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/auth/auth.service';
import { BotaoTemaComponent } from '../../../tema/botao-tema.component';
import { LogoMarcaComponent } from '../../../tema/logo-marca.component';

/**
 * /acesso — não há tela de login: quem entra é o usuário do Windows (RN23, ADR 0054). Esta tela aparece só quando não há sessão:
 *   - ao chegar sem sessão (ex.: o token expirou), entra pelo Windows sozinha e volta para o returnUrl;
 *   - se a API recusar (401/403): "acesso negado"; se não responder: "indisponível". Os dois com "Tentar de novo";
 *   - depois de "Sair", não entra sozinha (o Windows entraria na hora): espera o "Entrar de novo".
 */
@Component({
  selector: 'app-acesso',
  imports: [Button, LogoMarcaComponent, BotaoTemaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pagina-acesso">
      <div class="tema-acesso"><app-botao-tema /></div>
      <section class="apresentacao-acesso" aria-label="Sobre o Catálogo">
        <app-logo-marca [altura]="44" />
        <p class="nome-sistema">Catálogo</p>
      </section>
      <section class="cartao-acesso" aria-labelledby="titulo-acesso" aria-live="polite">
        @switch (situacao()) {
          @case ('entrando') {
            <h1 id="titulo-acesso">Entrando…</h1>
            <p class="texto-secundario">
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i> Identificando você pelo login do Windows.
            </p>
          }
          @case ('negado') {
            <h1 id="titulo-acesso">Acesso negado</h1>
            <p class="texto-secundario" role="alert">
              Não foi possível entrar com o seu usuário do Windows, ou o seu acesso ao Catálogo está desativado. Se
              precisar de acesso, procure um administrador do Catálogo.
            </p>
            <p-button label="Tentar de novo" icon="pi pi-refresh" styleClass="w-full" (onClick)="entrar()" />
          }
          @case ('indisponivel') {
            <h1 id="titulo-acesso">Catálogo indisponível</h1>
            <p class="texto-secundario" role="alert">O Catálogo não respondeu. Tente de novo em alguns instantes.</p>
            <p-button label="Tentar de novo" icon="pi pi-refresh" styleClass="w-full" (onClick)="entrar()" />
          }
          @case ('saiu') {
            <h1 id="titulo-acesso">Você saiu</h1>
            <p class="texto-secundario">Para voltar, entre de novo com o seu usuário do Windows.</p>
            <p-button label="Entrar de novo" icon="pi pi-sign-in" styleClass="w-full" (onClick)="entrar()" />
          }
        }
      </section>
    </main>
  `,
})
export class AcessoComponent implements OnInit {
  /** Para onde voltar depois de entrar (query param, posto pelo guard e pelo interceptor). */
  readonly returnUrl = input<string | undefined>(undefined);

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly entrando = signal(false);
  readonly situacao = computed(() => (this.entrando() ? 'entrando' : (this.auth.falha() ?? 'entrando')));

  ngOnInit(): void {
    // Sem falha anterior (ex.: a sessão expirou numa tela aberta): entra sozinha. Com falha, mostra e espera o botão.
    if (this.auth.falha() === null) {
      void this.entrar();
    }
  }

  async entrar(): Promise<void> {
    this.entrando.set(true);
    const entrou = await this.auth.entrar();
    this.entrando.set(false);
    if (entrou) {
      await this.router.navigateByUrl(this.destinoSeguro() ?? '/');
    }
  }

  /** Só caminhos internos ("/..."), para o returnUrl não levar a outro site. */
  private destinoSeguro(): string | null {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/acesso') ? url : null;
  }
}
