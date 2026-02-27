TODO / PROMPT – PAS (Painel de Arquitetura do Sistema)

Você pode mandar isso pro seu agente praticamente como está:

Objetivo

Criar o módulo PAS – Painel de Arquitetura do Sistema, um editor visual estilo node graph para mapear o fluxo completo do sistema (ERP, PDV, POP, PTC, Rastreio).

O PAS não executa lógica real do sistema.
Ele é uma ferramenta visual de arquitetura e documentação viva.

Escopo do MVP
1. Editor Visual (Canvas)

Node graph com:

Pan

Zoom

Mini-map

Conexão arrastável entre nós

Seleção múltipla

Organização fluida

2. Tipos de Nós
Ação

Ex: “Finalizar OP”, “Registrar Produção”, “Gerar Pedido”

Entradas (dados lidos)

Saídas (dados alterados ou criados)

Entidade

Ex: orders, ops, lots, stock, financial_entries

Entrada: write

Saída: read

Evento/Efeito

Ex:

Atualiza estoque

Gera lote

Lança financeiro

Atualiza status

Grupo (Container)

Módulo (ERP, PDV, POP, PTC, Rastreio)

Subgrupo (Produção, Estoque, Financeiro, Cadastros etc)

Colapsável

3. Paleta Lateral

Gerada automaticamente a partir:

Das rotas principais

Das ações do sistema

Das tabelas principais

Começar limitado a:

30 ações principais

20 entidades principais

Com:

Busca

Filtro por módulo

Tags

4. Propriedades do Nó (Painel lateral)

Cada nó deve ter:

Nome

Tipo

Módulo

Grupo

Referência opcional:

ref_table

ref_route

ref_action

Status:

OK

Faltando

Dúvida

Prioridade:

Alta

Média

Baixa

Notas

5. Conexões (Edges)

Cada conexão deve permitir:

Tipo:

leitura

escrita

evento

Label opcional

Nota opcional

6. Persistência

Opção A (mais simples para MVP):

Salvar como JSON no Supabase (tabela pas_graphs)
ou

Salvar como JSON único por empresa

Opção B:

Tabelas estruturadas (nodes, edges, groups)

MVP pode começar com JSON.

7. Import / Export

Exportar JSON completo do grafo

Importar JSON

Permitir versionamento manual

Esse JSON servirá como checklist para implementação e validação do sistema.

8. Objetivo Prático do PAS

Permitir que o fundador:

Visualize o caminho completo de um dado

Identifique funções que não refletem corretamente

Detecte lacunas no fluxo

Planeje melhorias

Documente arquitetura viva

9. Fora do Escopo (por enquanto)

Integração automática com banco

Execução de ações reais

Testes automatizados

Validação automática de rotas/tabelas

Isso pode vir depois.

Primeiros Fluxos para Criar no PAS

Orçamento → Pedido

Pedido → OP

POP Registrar Produção → Atualiza OP → Gera Lote → Atualiza Estoque

Entrega → Baixa Estoque

Recebimento → Financeiro → Caixas

Pagamento RH → Financeiro → Caixas

PTC → Geração opcional de Pedido/OP

Resultado Esperado

Um painel visual bonito, técnico e organizado, que represente a arquitetura completa do sistema e evolua junto com ele.
