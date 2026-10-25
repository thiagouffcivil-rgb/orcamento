// ==========================================
// 4. MÓDULO DE INTELIGÊNCIA (IA & PROMPTS)
// ==========================================

window.atualizarFabricaComposicoes = function() {
    if (typeof window.atualizarSelectFabricaIA === 'function') {
        window.atualizarSelectFabricaIA();
    }
};

window.prepararPromptFabrica = function() {
    const select = document.getElementById('fabrica-select-item');
    const txtArea = document.getElementById('fabrica-prompt-gerado');
    const option = select.options[select.selectedIndex];
    
    if (!select.value) {
        txtArea.value = '';
        return;
    }

    const codigo = select.value;
    const itemOrc = window.appState.orcamento.find(i => String(i.codigo) === String(codigo));
    const descricao = (option && option.getAttribute('data-desc')) || (itemOrc ? itemOrc.descricao : '');

    let listaIngredientes = (itemOrc && itemOrc.ingredientes) ? itemOrc.ingredientes : [];
    if (listaIngredientes.length === 0 && window.appState.databases) {
        const compPropria = (window.appState.databases.base_propria || []).find(i => String(i['Código']).trim() === String(codigo).trim());
        if (compPropria && Array.isArray(compPropria.ingredientes)) {
            listaIngredientes = compPropria.ingredientes;
        } else {
            const analitico = (window.appState.databases.sinapi_analitico || []).concat(window.appState.databases.sco_analitico || []);
            listaIngredientes = analitico.filter(i => String(i['Código'] || i['Código Mãe'] || '').trim() === String(codigo).trim());
        }
    }

    let detalhesInsumos = listaIngredientes.length > 0
        ? JSON.stringify(listaIngredientes)
        : "Considere a tabela SINAPI/SCO padrão para este serviço.";

    txtArea.value = `Atue como Engenheiro Civil especialista em Planejamento e Custos de Obras Públicas.
Analise o seguinte serviço de engenharia:
- Código: ${codigo}
- Descrição: ${descricao}
- Dados de insumos/composição: ${detalhesInsumos}

Sua tarefa: Analisar a proporção da composição para definir a equipe física no canteiro E os equipamentos de grande porte necessários para fiscalização (mobilização logística).

Forneça APENAS um objeto JSON cru (sem markdown) estruturado EXATAMENTE com estas chaves:
{
  "codigo": "${codigo}",
  "producaoDiaria": [Número representando a produção da equipe por dia na unidade do serviço],
  "unidade": "Unidade de medida do serviço",
  "espera": [Número de dias de espera técnica/cura, ou 0],
  "tamanhoEquipeTotal": [Número inteiro somando os operários da equipe contínua],
  "equipeFiscalizacao": [
    { "cargo": "Nome do Cargo (ex: Telhadista)", "quantidade": [Número inteiro] }
  ],
  "equipamentosFiscalizacao": [
    { "equipamento": "Nome da Máquina (ex: Guindaste Hidráulico)", "quantidade": [Número inteiro, ou omita a lista se não houver maquinário pesado] }
  ]
}`;
};

window.copiarPromptFabrica = function() {
    const txtArea = document.getElementById('fabrica-prompt-gerado');
    if (!txtArea.value) return alert("Selecione um serviço primeiro.");
    navigator.clipboard.writeText(txtArea.value);
    alert("📋 Prompt copiado para a área de transferência! Cole na sua IA de preferência.");
};

window.exportarBaseComposicoes = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.appState.baseComposicoesPrazos, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "base_fabrica_composicoes.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
};

// ==========================================
// MÓDULO: PROMPT DE SEQUENCIAMENTO (CRONOGRAMA)
// ==========================================

window.copiarPromptSequenciamento = function() {
    const itensExecutaveis = (window.appState.orcamento || [])
        .filter(i => i.tipo !== 'etapa')
        .map(i => `- EAP ${i.itemEap} | Cód: ${i.codigo} | ${i.descricao} | Qtd: ${i.qtd} ${i.unidade}`)
        .join('\n');

    const blocoOrcamento = itensExecutaveis
        ? itensExecutaveis
        : '[COLE AQUI O SEU ORÇAMENTO (CSV, JSON OU TEXTO COPIADO DA TABELA)]';

    const textoPrompt = `Atue como um Engenheiro Civil Sênior especialista em Planejamento, Custos e MS Project.
Vou te fornecer a lista de serviços (EAP e Descrição) de uma obra pública. 

Sua tarefa é analisar a engenharia do projeto e definir o Caminho Crítico, estabelecendo o sequenciamento lógico de execução (Relação Término-Início / Predecessoras) e eventuais tempos de espera técnica (ex: tempo de cura do concreto antes da desforma).

Regras EXATAS para o sequenciamento:
1. Trabalhe apenas com os serviços executáveis (ignore os títulos de Etapas/Fases).
2. Use EXATAMENTE o número do "Item EAP" para referenciar a predecessora (ex: "1.1.1").
3. Se um serviço depender de múltiplos serviços anteriores, separe os EAPs por vírgula (ex: "1.1.1, 1.1.2").
4. Se um serviço puder começar no primeiro dia da obra, deixe a predecessora em branco: "".
5. O tempo de "espera" deve ser o número de dias corridos após o término da predecessora (ex: 7 para cura de laje).

Retorne APENAS um código JSON cru (sem formatação markdown, sem explicações), que seja um Array de Objetos, seguindo estritamente este formato para o meu sistema importar:

[
  {
    "itemEap": "1.1.1",
    "equipe": 1,
    "predecessora": "",
    "espera": 0
  },
  {
    "itemEap": "1.1.2",
    "equipe": 1,
    "predecessora": "1.1.1",
    "espera": 0
  }
]

Aqui estão os dados do orçamento da obra:
${blocoOrcamento}`;

    navigator.clipboard.writeText(textoPrompt).then(() => {
        alert("✅ Prompt (já com a lista de serviços do orçamento atual) copiado com sucesso!\n\n1. Cole na sua IA (ChatGPT/Claude/Gemini).\n2. Copie a resposta da IA e clique em '📋 Colar Sequenciamento (Memória)' para aplicar direto sem precisar salvar arquivo!");
    }).catch(err => {
        alert("Erro ao copiar o prompt: " + err);
    });
};
