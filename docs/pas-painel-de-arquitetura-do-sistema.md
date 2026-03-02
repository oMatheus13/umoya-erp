PAS - Painel de Arquitetura do Sistema (novo escopo)

Objetivo

Transformar o PAS em um editor de fluxograma visual (nao mais node graph), focado em documentar caminhos de dados, decisao e processos de todo o ecossistema Umoya.

Direcao do produto
- Editor de fluxograma com UI completa (topbar, toolbar, sidebars, bottombar).
- Ferramentas organizadas por secoes (Padrao, Fluxograma, Formas).
- Tema escuro com acentos discretos em lime.
- Canvas limpo, apenas grid responsivo ao zoom com snap ativo por padrao.

Funcionalidades principais
- Ferramentas padrao: selecionar, mover, texto, bloco de notas, seta.
- Ferramentas de fluxograma: inicio/fim, processo, decisao, entrada/saida, documento, manual, subprocesso, base de dados, conectores.
- Formas genericas: retangulo, retangulo arredondado, elipse, triangulo, losango, hexagono, paralelogramo, estrela.
- Barra superior: tipografia, cores, estilos de linha, setas e opcoes de rotas.
- Sidebar direita: propriedades do elemento selecionado.
- Bottombar: desfazer/refazer, zoom com +/-, e fullscreen.
- Fullscreen: minimiza top/side/bottom e mostra setas centrais nas bordas para reabrir.

Persistencia
- Estado salvo via Supabase em tabela `pas_graphs` (payload JSON unico por workspace).

Fora do escopo
- Validacao automatica dos fluxos.
- Integracoes diretas com banco ou rotas reais.

Primeiros fluxos recomendados
- Orcamento -> Pedido
- Pedido -> Ordem de Producao
- Producao -> Entrega -> Financeiro
