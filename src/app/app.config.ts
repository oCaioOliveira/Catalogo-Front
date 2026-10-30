import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { ApiConfiguration, provideApiConfiguration } from './api/api-configuration';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { carregarUrlApi } from './core/configuracao/configuracao-api';
import { erroInterceptor } from './core/erros/erro.interceptor';
import { traducaoPrimeNgPtBr } from './tema/primeng-pt-br';
import { TemaCatalogo, opcoesTema } from './tema/tema';
import { TemaService } from './tema/tema.service';

registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Os parâmetros da rota (inclusive os do pai: :grupo e :entidade) chegam aos componentes como inputs.
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ paramsInheritanceStrategy: 'always' })),
    // A ordem importa: o de autenticação vê o erro primeiro (401, troca de senha); o de erros mostra o toast.
    provideHttpClient(withInterceptors([erroInterceptor, authInterceptor])),
    // A URL da API (BACK_API_URL) vem do config.json, lido no inicializador abaixo. Todas as chamadas (cliente gerado, login,
    // exportação, importação) partem dela. Vazia (local): caminhos relativos /api/v1/..., que o `npm start` leva à API pelo proxy.
    provideApiConfiguration(''),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: TemaCatalogo, options: opcoesTema }, translation: traducaoPrimeNgPtBr }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    MessageService,
    ConfirmationService,
    // Primeiro a URL da API (config.json, ver core/configuracao); só depois, com um token guardado (página recarregada), carrega o
    // usuário antes da primeira tela. Num inicializador só: os inicializadores do Angular rodam ao mesmo tempo, não em sequência.
    provideAppInitializer(async () => {
      const configuracao = inject(ApiConfiguration);
      const auth = inject(AuthService);
      configuracao.rootUrl = await carregarUrlApi();
      await auth.restaurar();
    }),
    // Tema claro, escuro ou "seguir o sistema" (o padrão), desde a primeira tela, inclusive o login.
    provideAppInitializer(() => void inject(TemaService)),
  ],
};
