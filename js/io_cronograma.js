// ==========================================
// MÓDULO DE IMPORTAÇÃO E EXPORTAÇÃO DE DADOS (I/O)
// Arquivo: io_cronograma.js
// ==========================================

// Função auxiliar para baixar ficheiros (caso não exista globalmente)
window.downloadArquivoBase = function(conteudo, nomeArquivo, tipo) {
    if (typeof window.downloadArquivo === 'function') {
        window.downloadArquivo(conteudo, nomeArquivo, tipo);
        return;
    }
    const dataStr = `data:${tipo};charset=utf-8,` + encodeURIComponent(conteudo);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", nomeArquivo);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
};

// ==========================================
// 1. I/O - DADOS DO CRONOGRAMA (GANTT E EQUIPES)
// ==========================================
window.exportarCronogramaJSON = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        alert('Não há itens no orçamento para exportar.');
        return;
    }
    
    const dadosCrono = window.appState.orcamento.filter(i => i.tipo !== 'etapa').map(i => ({
        itemEap: i.itemEap,
        equipe: i.cronograma ? i.cronograma.equipe : 1,
        ritmo: i.cronograma ? i.cronograma.ritmo : 100, 
        predecessora: i.cronograma ? i.cronograma.predecessora : '',
        terminoJunto: i.cronograma ? i.cronograma.terminoJunto : '',
        espera: i.cronograma ? i.cronograma.espera : 0
    }));

    const inputData = document.getElementById('input-data-inicio-obra');
    
    // O novo "pacote" guarda a Data da Obra e a Lista de Tarefas juntas
    const payload = {
        dataInicioObra: inputData ? inputData.value : '',
        tarefas: dadosCrono
    };
    
    const jsonStr = JSON.stringify(payload, null, 2);
    window.downloadArquivoBase(jsonStr, `dados_cronograma_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
};

window.extrairJSONSequenciamentoIA = function(textoBruto) {
    if (!textoBruto || typeof textoBruto !== 'string') return null;
    let limpo = textoBruto.trim();

    // 1. Remove blocos markdown ```json ... ``` se existirem
    const matchBloco = limpo.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (matchBloco && matchBloco[1]) {
        limpo = matchBloco[1].trim();
    }

    // 2. Tenta fazer o parse direto
    try {
        const parsed = JSON.parse(limpo);
        if (Array.isArray(parsed) || (parsed && Array.isArray(parsed.tarefas))) {
            return parsed;
        }
    } catch (_) {}

    // 3. Caso a IA tenha colocado texto antes/depois, extrai o primeiro Array [...] ou Objeto {...}
    const idxArrIni = limpo.indexOf('[');
    const idxArrFim = limpo.lastIndexOf(']');
    if (idxArrIni !== -1 && idxArrFim > idxArrIni) {
        try {
            const subArr = JSON.parse(limpo.slice(idxArrIni, idxArrFim + 1));
            if (Array.isArray(subArr)) return subArr;
        } catch (_) {}
    }

    const idxObjIni = limpo.indexOf('{');
    const idxObjFim = limpo.lastIndexOf('}');
    if (idxObjIni !== -1 && idxObjFim > idxObjIni) {
        try {
            const subObj = JSON.parse(limpo.slice(idxObjIni, idxObjFim + 1));
            if (subObj && Array.isArray(subObj.tarefas)) return subObj;
        } catch (_) {}
    }

    return null;
};

window.aplicarDadosSequenciamentoCronograma = function(importado, origemTexto = 'arquivo') {
    let listaTarefas = [];

    if (!Array.isArray(importado) && importado && Array.isArray(importado.tarefas)) {
        listaTarefas = importado.tarefas;
        if (importado.dataInicioObra) {
            const inputData = document.getElementById('input-data-inicio-obra');
            if (inputData) inputData.value = importado.dataInicioObra;
        }
    } else if (Array.isArray(importado)) {
        listaTarefas = importado;
    } else {
        alert('Formato JSON inválido: esperado um Array de tarefas com "itemEap" e "predecessora".');
        return false;
    }

    let atualizados = 0;
    listaTarefas.forEach(dado => {
        if (!dado || dado.itemEap === undefined) return;
        const item = (window.appState.orcamento || []).find(i => String(i.itemEap).trim() === String(dado.itemEap).trim());
        if (item) {
            if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };

            if (dado.equipe !== undefined) item.cronograma.equipe = parseFloat(dado.equipe) || 1;
            if (dado.ritmo !== undefined) item.cronograma.ritmo = parseFloat(dado.ritmo) || 100;
            if (dado.predecessora !== undefined) item.cronograma.predecessora = String(dado.predecessora).trim();
            if (dado.terminoJunto !== undefined) item.cronograma.terminoJunto = String(dado.terminoJunto).trim();
            if (dado.espera !== undefined) item.cronograma.espera = parseInt(dado.espera, 10) || 0;
            atualizados++;
        }
    });

    if (typeof window.carregarTabelaCronograma === 'function') window.carregarTabelaCronograma();
    if (typeof window.gerarGraficoGantt === 'function') window.gerarGraficoGantt();
    if (typeof window.gerarCronogramaFisicoFinanceiro === 'function' && document.getElementById('cronograma-fisico-financeiro-container')?.style.display !== 'none') {
        window.gerarCronogramaFisicoFinanceiro(false);
    }
    if (typeof window.gerarMatrizMaoDeObra === 'function' && document.getElementById('matriz-mao-de-obra-container')) {
        window.gerarMatrizMaoDeObra();
    }
    if (typeof window.salvarEstado === 'function') window.salvarEstado();

    const painel = document.getElementById('painel-colar-sequenciamento-ia');
    if (painel) painel.classList.add('hidden');

    alert(`✅ Sequenciamento aplicado com sucesso via ${origemTexto}!\n\n• Tarefas lidas no JSON: ${listaTarefas.length}\n• Serviços vinculados no orçamento: ${atualizados}`);
    return true;
};

window.importarSequenciamentoDaMemoria = async function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        alert('Adicione ou carregue os itens do orçamento antes de importar o sequenciamento.');
        return;
    }

    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        try {
            const textoMemoria = await navigator.clipboard.readText();
            const jsonExtraido = window.extrairJSONSequenciamentoIA(textoMemoria);
            if (jsonExtraido) {
                window.aplicarDadosSequenciamentoCronograma(jsonExtraido, 'Memória (Área de Transferência)');
                return;
            }
        } catch (err) {
            console.warn('Leitura direta da Área de Transferência bloqueada pelo navegador, abrindo painel manual:', err);
        }
    }

    // Fallback: abre o painel para colar manualmente (Ctrl+V) caso a memória não tenha JSON ou o navegador peça permissão
    const painel = document.getElementById('painel-colar-sequenciamento-ia');
    const txt = document.getElementById('textarea-sequenciamento-ia');
    if (painel) {
        painel.classList.remove('hidden');
        if (txt) {
            txt.focus();
            txt.select();
        }
    }
};

window.aplicarSequenciamentoDoPainelManual = function() {
    const txt = document.getElementById('textarea-sequenciamento-ia');
    if (!txt || !txt.value.trim()) {
        alert('Cole a resposta JSON da IA na caixa de texto primeiro.');
        return;
    }
    const jsonExtraido = window.extrairJSONSequenciamentoIA(txt.value);
    if (!jsonExtraido) {
        alert('Não foi possível encontrar um JSON válido de sequenciamento no texto colado. Verifique se o texto contém a lista [ { "itemEap": ... } ].');
        return;
    }
    window.aplicarDadosSequenciamentoCronograma(jsonExtraido, 'Painel de Colagem IA');
};

window.importarCronogramaJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonExtraido = window.extrairJSONSequenciamentoIA(e.target.result);
            if (!jsonExtraido) throw new Error('JSON inválido');
            window.aplicarDadosSequenciamentoCronograma(jsonExtraido, 'Arquivo JSON');
        } catch (err) { 
            alert('Erro ao ler o ficheiro JSON do cronograma.'); 
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};

// ==========================================
// 2. I/O - BANCO DE PRAZOS (FÁBRICA IA)
// ==========================================
window.exportarBancoPrazos = function() {
    if (!window.appState.baseComposicoesPrazos || Object.keys(window.appState.baseComposicoesPrazos).length === 0) {
        alert('Não há produtividades salvas na memória para exportar.');
        return;
    }
    const jsonStr = JSON.stringify(window.appState.baseComposicoesPrazos, null, 2);
    window.downloadArquivoBase(jsonStr, "base_produtividade.json", "application/json");
};

window.importarBancoPrazos = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            window.appState.baseComposicoesPrazos = data;
            alert('Banco de produtividade importado com sucesso!');
        } catch (err) { 
            alert('Erro ao ler o ficheiro JSON da produtividade.'); 
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};