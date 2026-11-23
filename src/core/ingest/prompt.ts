import type { Day } from '../time/time';
import { counts, parse, titles, merged, type Group } from './group';

const samples = 5;

export const lines = (groups: Group[]) =>
  groups.map((g) => {
    const parts: string[] = [];
    if (g.commits.length) parts.push(`${g.commits.length} commit(s) (${counts(g.types)})`);
    if (g.prs.length) parts.push(`${g.prs.length} PR(s)`);
    if (g.issues.length) parts.push(`${g.issues.length} issue(s)`);
    if (g.releases.length) parts.push(`${g.releases.length} release(s)`);
    return `${g.repo}: ${parts.join(', ')}`;
  });

export const highlights = (groups: Group[]) =>
  groups.flatMap((g) => [
    ...g.releases.map((r) => `release ${r.title} em ${g.repo}`),
    ...g.prs.filter(merged).map((pr) => `PR merged em ${g.repo}: ${pr.title}`),
  ]);

export const day = (groups: Group[]) => {
  const top = highlights(groups);
  return {
    system: [
      'Você normaliza atividade técnica de GitHub em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil.',
      'Não invente detalhes que não estão no resumo.',
      'Nunca cite nomes ou mensagens de commits individuais — eles não aparecem no texto, só os totais por projeto e os destaques (release/PR) importam.',
      'Não liste os projetos um por um em formato de lista — fale em tom corrido, como quem está contando o dia pra alguém.',
      'Evite aberturas genéricas tipo "Hoje foi um dia produtivo" — comece pelo destaque mais concreto do dia (um release, um PR importante) se houver algum; se não houver destaque, seja específico sobre o volume real (quantos commits, em quantos projetos) em vez de frase de efeito vazia.',
      'Máximo 4 frases.',
    ].join(' '),
    user: `Resumo por projeto:\n${lines(groups).join('\n')}\n\nDestaques do dia:\n${top.length ? top.join('\n') : 'nenhum'}\n\nEscreva o parágrafo.`,
  };
};

export const repos = (groups: Group[], fresh: Set<string>, descriptions: { [repo: string]: string | null }) => {
  const input = Object.fromEntries(
    groups.map((g) => [
      g.repo,
      {
        isNewProject: fresh.has(g.repo),
        repoDescription: descriptions[g.repo] ?? null,
        totalCommits: g.commits.length,
        commitSummary: g.commits.length ? counts(g.types) : null,
        sampleDescriptions: g.commits.slice(0, samples).map((c) => parse(c.title)?.text ?? c.title),
        issueCount: g.issues.length,
        prCount: g.prs.length,
        releaseCount: g.releases.length,
        highlights: titles(g),
      },
    ]),
  );
  return {
    system: [
      'Você recebe dados de atividade técnica de GitHub por projeto e devolve APENAS um objeto JSON válido, sem markdown, sem texto fora do JSON.',
      'O objeto tem uma chave por nome de projeto (exatamente igual ao que veio no input) e o valor é um parágrafo curto (1 a 2 frases) em primeira pessoa, tom direto e informal, em português do Brasil, contando o que foi feito naquele projeto.',
      'Use "sampleDescriptions" pra dar contexto real e específico — parafraseie o que elas indicam sobre o trabalho, mas nunca cite a string literal de uma descrição. Não cite títulos de issues, eles já aparecem em bullets logo abaixo no post.',
      'Se "isNewProject" for true, mencione naturalmente que o projeto foi criado hoje (ex: "criei o projeto X hoje para..."). Se "repoDescription" não for null, use ele como fonte primária do propósito do projeto (é a descrição real que o usuário escreveu no GitHub); senão infira a partir de sampleDescriptions se der pra perceber algo concreto; se nenhum dos dois ajudar, só diga que criou o projeto.',
      'Não invente detalhes que não estão nos dados do projeto.',
      'Cite pelo nome os destaques (release/PR merged) quando existirem.',
      'Se o projeto teve só 1 ou 2 commits e não é novo, o parágrafo pode ter só 1 frase curta.',
    ].join(' '),
    user: `Dados por projeto:\n${JSON.stringify(input, null, 2)}\n\nDevolva o JSON com um parágrafo por projeto.`,
  };
};

export const narratives = (raw: string, repos: string[]): { [repo: string]: string } | null => {
  try {
    const parsed = JSON.parse(raw);
    return Object.fromEntries(repos.filter((r) => typeof parsed[r] === 'string').map((r) => [r, parsed[r]]));
  } catch {
    return null;
  }
};

export const summary = (d: Day) => {
  const langs = d.languages.map((l) => `${l.name} (${l.text})`).join(', ');
  const projects = d.projects.map((p) => `${p.name} (${p.text})`).join(', ');
  return `Tempo total codando: ${d.total}.${langs ? ` Linguagens: ${langs}.` : ''}${projects ? ` Projetos: ${projects}.` : ''}`;
};

export const time = (d: Day) => ({
  system: [
    'Você normaliza estatísticas de tempo de código em um parágrafo curto de blog pessoal, em primeira pessoa, tom direto e informal, em português do Brasil.',
    'O usuário não fez nenhum commit nesse dia, mas passou tempo codando — conte isso normalmente, como só mais um tipo de dia de trabalho, sem soar como desculpa ou pedido de desculpas.',
    'Não invente detalhes que não estão no resumo — fale só em termos de tempo total e das linguagens/projetos predominantes que vieram nos dados.',
    'Não cite a ferramenta de tracking pelo nome nem a palavra "commit".',
    'Máximo 3 frases.',
  ].join(' '),
  user: `${summary(d)}\n\nEscreva o parágrafo.`,
});
