// ==========================================
// 4. MÓDULO DE INTELIGÊNCIA (IA & PROMPTS)
// ==========================================

window.atualizarFabricaComposicoes = function() {
    const select = document.getElementById('fabrica-select-item');
    if (!select || !window.appState.orcamento) return;

    let html = '<option value="">-- Escolha um item do orçamento --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && item.codigo && item.codigo !== '-') {
            html += `<option value="${item.codigo}" data-desc="${item.descricao}">${item.codigo} - ${item.descricao.substring(0, 50)}...</option>`;
        }
    });
    select.innerHTML = html;
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
    const descricao = option.getAttribute('data-desc');

    const itemOrc = window.appState.orcamento.find(i => i.codigo === codigo);
    let detalhesInsumos = itemOrc && itemOrc.ingredientes ? JSON.stringify(itemOrc.ingredientes) : "Considere a tabela SINAPI/SCO padrão para este serviço.";

    txtArea.value = `Atue como Engenheiro Civil especialista em Planeamento e Custos de Obras Públicas. Anexei o Caderno Técnico (Markdown) com as regras de aferição e execução.
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

window.salvarComposicaoFabrica = function() {
    const rawJson = document.getElementById('fabrica-json-entrada').value.trim();
    if (!rawJson) return alert("Cole o JSON fornecido pela IA.");

    try {
        let cleanJson = rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\$/, "");
        const obj = JSON.parse(cleanJson);

        if (!obj.codigo || obj.producaoDiaria === undefined) {
            return alert("Erro: O JSON precisa conter pelo menos as chaves 'codigo' e 'producaoDiaria'.");
        }

        window.appState.baseComposicoesPrazos[obj.codigo] = obj;

        alert(`✅ Sucesso! Parâmetros de produtividade para o item [${obj.codigo}] salvos na base local.`);
        document.getElementById('fabrica-json-entrada').value = '';
        
        window.atualizarCronogramaComBaseLocal();

    } catch (err) {
        console.error(err);
        alert("❌ Erro ao processar o JSON. Certifique-se de colar um objeto JSON válido.");
    }
};

window.atualizarCronogramaComBaseLocal = function() {
    if (!window.appState.orcamento) return;
    
    let aplicados = 0;
    window.appState.orcamento.forEach(item => {
        if (window.appState.baseComposicoesPrazos[item.codigo] && parseFloat(item.qtd) > 0) {
            const config = window.appState.baseComposicoesPrazos[item.codigo];
            if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
            
            // Agora usa o tamanho real da equipe (ex: 4) para dividir a carga de trabalho
            let tamanhoDaEquipe = parseInt(config.tamanhoEquipeTotal) || 1;
            let dias = Math.ceil(parseFloat(item.qtd) / config.producaoDiaria);
            
            // Opcional: Se o HH ainda estiver zerado, faz uma estimativa inicial. 
            // Mas o ideal é depois usar o botão "5. Puxar HH das Composições" para a matemática exata!
            if (item.cronograma.hh === 0) item.cronograma.hh = dias * 8 * tamanhoDaEquipe;
            
            item.cronograma.equipe = tamanhoDaEquipe;
            item.cronograma.espera = config.espera || 0;
            
            // Guarda o detalhe da equipa para a sua fiscalização!
            item.cronograma.equipeDetalhada = config.equipeFiscalizacao;
            // Guarda os equipamentos para o fiscal!
            item.cronograma.equipamentosDetalhe = config.equipamentosFiscalizacao || [];

            aplicados++;
        }
    });

    if (aplicados > 0 && typeof window.carregarTabelaCronograma === 'function') {
        window.carregarTabelaCronograma();
        if (typeof window.gerarGraficoGantt === 'function') window.gerarGraficoGantt();
    }
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
[COLE AQUI O SEU ORÇAMENTO (CSV, JSON OU TEXTO COPIADO DA TABELA)]`;

    // Função moderna para copiar para a área de transferência
    navigator.clipboard.writeText(textoPrompt).then(() => {
        alert("✅ Prompt copiado com sucesso!\n\n1. Cole na sua IA (ChatGPT/Claude).\n2. Adicione o seu orçamento abaixo do texto.\n3. Salve a resposta em .json e use o botão 'Importar (JSON)'.");
    }).catch(err => {
        alert("Erro ao copiar o prompt: " + err);
    });
};