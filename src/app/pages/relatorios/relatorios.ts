import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdemServicoService } from '../../core/services/ordem-servico.service';
import { OrdemServico, Prioridade, StatusOs } from '../../core/models/ordem-servico.model';
import { StatusLabelPipe } from '../../shared/status-label.pipe';

type SerieItem = {
  label: string;
  value: number;
  tone: string;
  bar: string;
};

type TecnicoResumo = {
  id: string;
  nome: string;
  horas: number;
  ordens: number;
  concluidas: number;
  emAndamento: number;
};

type SetorResumo = {
  setor: string;
  total: number;
  abertas: number;
  concluidas: number;
};

@Component({
  selector: 'app-relatorios',
  imports: [CommonModule, RouterLink, StatusLabelPipe],
  templateUrl: './relatorios.html',
})
export class Relatorios implements OnInit {
  private service = inject(OrdemServicoService);

  ordens = signal<OrdemServico[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  total = computed(() => this.ordens().length);
  abertas = computed(() => this.ordens().filter((o) => o.status === StatusOs.ABERTA).length);
  emAndamento = computed(() => this.ordens().filter((o) => o.status === StatusOs.EM_ANDAMENTO).length);
  aguardandoPeca = computed(() => this.ordens().filter((o) => o.status === StatusOs.AGUARDANDO_PECA).length);
  concluidas = computed(() => this.ordens().filter((o) => o.status === StatusOs.CONCLUIDA).length);
  canceladas = computed(() => this.ordens().filter((o) => o.status === StatusOs.CANCELADA).length);
  criticas = computed(() =>
    this.ordens().filter(
      (o) => o.prioridade === Prioridade.CRITICA && o.status !== StatusOs.CONCLUIDA && o.status !== StatusOs.CANCELADA
    ).length
  );

  totalHoras = computed(() =>
    this.ordens().reduce((acc, o) => acc + (Number(o.horas_trabalhadas) || 0), 0)
  );

  tempoMedioConclusaoHoras = computed(() => {
    const concluidas = this.ordens().filter((o) => !!o.conclusao_em);
    if (!concluidas.length) return 0;

    const totalHoras = concluidas.reduce((acc, ordem) => {
      const abertura = new Date(ordem.abertura_em).getTime();
      const conclusao = new Date(ordem.conclusao_em!).getTime();
      return acc + Math.max(0, (conclusao - abertura) / (1000 * 60 * 60));
    }, 0);

    return Number((totalHoras / concluidas.length).toFixed(1));
  });

  statusSeries = computed<SerieItem[]>(() => [
    {
      label: 'Abertas',
      value: this.abertas(),
      tone: 'text-blue-300',
      bar: 'bg-blue-500',
    },
    {
      label: 'Em andamento',
      value: this.emAndamento(),
      tone: 'text-amber-300',
      bar: 'bg-amber-500',
    },
    {
      label: 'Aguardando peça',
      value: this.aguardandoPeca(),
      tone: 'text-orange-300',
      bar: 'bg-orange-500',
    },
    {
      label: 'Concluídas',
      value: this.concluidas(),
      tone: 'text-emerald-300',
      bar: 'bg-emerald-500',
    },
    {
      label: 'Canceladas',
      value: this.canceladas(),
      tone: 'text-slate-300',
      bar: 'bg-slate-500',
    },
  ]);

  prioridadeSeries = computed<SerieItem[]>(() => {
    const ordens = this.ordens();
    const count = (prioridade: Prioridade) => ordens.filter((o) => o.prioridade === prioridade).length;

    return [
      {
        label: 'Baixa',
        value: count(Prioridade.BAIXA),
        tone: 'text-slate-300',
        bar: 'bg-slate-400',
      },
      {
        label: 'Média',
        value: count(Prioridade.MEDIA),
        tone: 'text-blue-300',
        bar: 'bg-blue-500',
      },
      {
        label: 'Alta',
        value: count(Prioridade.ALTA),
        tone: 'text-amber-300',
        bar: 'bg-amber-500',
      },
      {
        label: 'Crítica',
        value: count(Prioridade.CRITICA),
        tone: 'text-red-300',
        bar: 'bg-red-500',
      },
    ];
  });

  horasPorTecnico = computed<TecnicoResumo[]>(() => {
    const grupos = new Map<string, TecnicoResumo>();

    for (const ordem of this.ordens()) {
      for (const apontamento of ordem.apontamentos ?? []) {
        const tecnicoId = apontamento.tecnico?.id ?? apontamento.tecnicoId;
        const tecnicoNome = apontamento.tecnico?.nome ?? ordem.tecnico?.nome ?? 'Técnico não identificado';
        const grupo = grupos.get(tecnicoId) ?? {
          id: tecnicoId,
          nome: tecnicoNome,
          horas: 0,
          ordens: 0,
          concluidas: 0,
          emAndamento: 0,
        };

        if (apontamento.fimEm) {
          grupo.horas += Math.max(
            0,
            (new Date(apontamento.fimEm).getTime() - new Date(apontamento.inicioEm).getTime()) /
              (1000 * 60 * 60)
          );
        }

        grupos.set(tecnicoId, grupo);
      }
    }

    for (const ordem of this.ordens()) {
      const tecnicoId = ordem.tecnico?.id;
      if (!tecnicoId) continue;

      const grupo = grupos.get(tecnicoId) ?? {
        id: tecnicoId,
        nome: ordem.tecnico?.nome ?? 'Técnico não identificado',
        horas: 0,
        ordens: 0,
        concluidas: 0,
        emAndamento: 0,
      };

      grupo.ordens += 1;
      if (ordem.status === StatusOs.CONCLUIDA) grupo.concluidas += 1;
      if (ordem.status === StatusOs.EM_ANDAMENTO || ordem.status === StatusOs.AGUARDANDO_PECA) {
        grupo.emAndamento += 1;
      }

      grupos.set(tecnicoId, grupo);
    }

    return Array.from(grupos.values())
      .map((grupo) => ({
        ...grupo,
        horas: Number(grupo.horas.toFixed(2)),
      }))
      .sort((a, b) => b.horas - a.horas || b.concluidas - a.concluidas);
  });

  ordensPorSetor = computed<SetorResumo[]>(() => {
    const grupos = new Map<string, SetorResumo>();

    for (const ordem of this.ordens()) {
      const setor = ordem.equipamento?.setor?.trim() || 'Não informado';
      const grupo = grupos.get(setor) ?? {
        setor,
        total: 0,
        abertas: 0,
        concluidas: 0,
      };

      grupo.total += 1;
      if (ordem.status === StatusOs.CONCLUIDA) {
        grupo.concluidas += 1;
      } else if (ordem.status !== StatusOs.CANCELADA) {
        grupo.abertas += 1;
      }

      grupos.set(setor, grupo);
    }

    return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
  });

  ordensRecentes = computed(() =>
    [...this.ordens()]
      .sort((a, b) => new Date(b.abertura_em).getTime() - new Date(a.abertura_em).getTime())
      .slice(0, 10)
  );

  ngOnInit(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (data) => {
        this.ordens.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível carregar os dados de relatórios.');
        this.loading.set(false);
      },
    });
  }

  percent(value: number, total: number): number {
    if (!total) return 0;
    return Number(((value / total) * 100).toFixed(1));
  }

  widthByMax(value: number, values: number[]): number {
    const max = Math.max(...values, 0);
    if (!max) return 0;
    return Number(((value / max) * 100).toFixed(1));
  }

  statusClass(status: StatusOs): string {
    switch (status) {
      case StatusOs.ABERTA:
        return 'bg-blue-900/40 text-blue-400';
      case StatusOs.EM_ANDAMENTO:
        return 'bg-yellow-900/40 text-yellow-400';
      case StatusOs.AGUARDANDO_PECA:
        return 'bg-orange-900/40 text-orange-400';
      case StatusOs.CONCLUIDA:
        return 'bg-green-900/40 text-green-400';
      case StatusOs.CANCELADA:
        return 'bg-slate-800 text-slate-500';
    }
  }

  prioridadeClass(prioridade: Prioridade): string {
    switch (prioridade) {
      case Prioridade.CRITICA:
        return 'text-red-400';
      case Prioridade.ALTA:
        return 'text-orange-400';
      case Prioridade.MEDIA:
        return 'text-yellow-400';
      case Prioridade.BAIXA:
        return 'text-slate-400';
    }
  }
}
