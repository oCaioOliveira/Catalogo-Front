import { ChangeDetectionStrategy, Component, computed, inject, input, output, viewChild } from '@angular/core';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { SITUACOES, faixaDeSituacao } from '../../../core/aprovacao/regras-aprovacao';
import { AuthService } from '../../../core/auth/auth.service';
import { Entidade } from '../../../core/metadados/modelo';
import { Registro } from '../../../core/registros/modelo-registro';
import { formatarDataHoraSistema } from '../../../shared/formatacao/formatar-valor';
import { Decisao, DialogoDecisaoComponent } from '../../aprovacao/dialogo-decisao.component';

/**
 * A faixa do topo do detalhe com a situação de aprovação (RN34 a RN37), só onde a aprovação está ativa para a entidade e a
 * equipe do item: a última decisão (quem, quando e a justificativa completa) e, para o GESTOR da equipe e o ADMINISTRADOR num item
 * pendente, Aprovar e Rejeitar. Cada decisão abre o diálogo de decisão (o mesmo da fila, DialogoDecisaoComponent).
 */
@Component({
  selector: 'app-faixa-aprovacao',
  imports: [Button, Tag, DialogoDecisaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (faixa(); as f) {
      <section
        class="faixa-aprovacao"
        [class.faixa-pendente]="f.situacao === 'PENDENTE'"
        [class.faixa-aprovado]="f.situacao === 'APROVADO'"
        [class.faixa-rejeitado]="f.situacao === 'REJEITADO'"
        aria-labelledby="faixa-aprovacao-titulo"
      >
        <div class="faixa-conteudo">
          <p-tag [value]="situacoes[f.situacao].rotulo" [severity]="situacoes[f.situacao].severidade" />
          <h2 id="faixa-aprovacao-titulo" class="faixa-titulo">{{ f.titulo }}</h2>
          @if (registro().ultimaDecisao; as d) {
            <div class="faixa-decisao">
              <p class="texto-secundario">
                {{ d.decisao === 'APROVAR' ? 'Aprovado' : 'Rejeitado' }} por {{ d.decididoPor?.nome ?? '—' }} em
                {{ formatarDataHoraSistema(d.decididoEm) }}
              </p>
              @if (d.justificativa) {
                <blockquote class="faixa-justificativa">{{ d.justificativa }}</blockquote>
              }
            </div>
          }
        </div>
        @if (f.podeDecidir) {
          <div class="acoes-pagina">
            <p-button label="Aprovar" icon="pi pi-check" severity="success" (onClick)="abrir('APROVAR')" />
            <p-button
              label="Rejeitar"
              icon="pi pi-times"
              severity="danger"
              [outlined]="true"
              (onClick)="abrir('REJEITAR')"
            />
          </div>
        }
      </section>
    }

    <app-dialogo-decisao (decidido)="decidido.emit($event)" />
  `,
})
export class FaixaAprovacaoComponent {
  readonly grupo = input.required<string>();
  readonly entidade = input.required<Entidade>();
  readonly registro = input.required<Registro>();
  /** A decisão foi gravada: o registro atualizado (situação, versão e última decisão novas). */
  readonly decidido = output<Registro>();

  private readonly auth = inject(AuthService);

  readonly faixa = computed(() => faixaDeSituacao(this.auth.usuario(), this.entidade(), this.registro()));
  readonly situacoes = SITUACOES;
  readonly formatarDataHoraSistema = formatarDataHoraSistema;

  private readonly dialogo = viewChild.required(DialogoDecisaoComponent);

  abrir(decisao: Decisao): void {
    const [entidade, registro] = [this.entidade(), this.registro()];
    this.dialogo().abrir({ grupo: this.grupo(), entidade: entidade.chave, id: registro.id, rotulo: null }, decisao);
  }
}
