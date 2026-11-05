import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';

/**
 * As ações SECUNDÁRIAS de uma página (importar, exportar, excluir...) num botão "⋯ Mais ações", ao lado da ação principal do
 * cabeçalho (docs/design/guia-de-interface.md → "Ações"). Assim cada tela tem uma ação em destaque e as demais sempre no mesmo
 * lugar. Sem nenhuma ação, o botão não aparece. `ocupado` mostra o carregamento (ex.: exportação em andamento).
 */
@Component({
  selector: 'app-mais-acoes',
  imports: [Button, Menu, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (itens().length > 0) {
      <p-button
        icon="pi pi-ellipsis-h"
        severity="secondary"
        [outlined]="true"
        [loading]="ocupado()"
        ariaLabel="Mais ações"
        pTooltip="Mais ações"
        tooltipPosition="bottom"
        aria-haspopup="menu"
        (onClick)="menu.toggle($event)"
      />
      <p-menu #menu [popup]="true" [model]="itens()" appendTo="body" />
    }
  `,
})
export class MaisAcoesComponent {
  readonly itens = input.required<MenuItem[]>();
  readonly ocupado = input(false);
}
