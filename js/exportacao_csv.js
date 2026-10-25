// ==========================================
// MÓDULO DE EXPORTAÇÕES CSV (TABELAS SIMPLES)
// ==========================================

window.exportarTabelaCSV = function(nomeArquivo, cabecalhos, linhas) {
    let csvContent = '\uFEFF' + cabecalhos.join(';') + '\n';
    linhas.forEach(linha => { 
        const linhaFormatada = linha.map(campo => { 
            if (campo === null || campo === undefined) return '""'; 
            return `"${String(campo).replace(/"/g, '""')}"`; 
        }); 
        csvContent += linhaFormatada.join(';') + '\n'; 
    });
    window.downloadArquivo(csvContent, `${nomeArquivo}_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8;');
};

window.exportarOrcamentoCSV = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) { alert('Não há itens no orçamento para exportar.'); return; }

    const estado = document.getElementById('select-estado').value;
    const tabela = document.getElementById('select-tabela').value;
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;
    const bdiDif = parseFloat(document.getElementById('input-bdi-dif')?.value);
    const bdiDifFinal = !isNaN(bdiDif) ? bdiDif : bdi;
    const { mapaPorId: subtotaisEtapas } = window.calcularSubtotaisPorEtapa(window.appState.orcamento, estado, tabela, bdi, bdiDifFinal);

    const cabecalhos = ['Item EAP', 'Tipo', 'Código', 'Descrição', 'Unidade', 'Quantidade', 'Preço Unitário (R$)', 'BDI Aplicado (%)', 'Preço c/ BDI (R$)', 'Total (R$)'];
    const linhas = window.appState.orcamento.map(item => {
        if (item.tipo === 'etapa') {
            const et = subtotaisEtapas[item.id] || { totalComBdi: 0 };
            return [item.itemEap, 'ETAPA', '', item.descricao, '', '', '', '', '', et.totalComBdi.toFixed(2).replace('.', ',')];
        }
        const precoUnBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
        const bdiItem = window.obterBdiDoItem(item, bdi, bdiDifFinal);
        const { precoUn, precoComBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnBruto, item.qtd, bdiItem);
        return [ item.itemEap, item.tipo.toUpperCase(), item.codigo, item.descricao, item.unidade, (parseFloat(item.qtd) || 0).toFixed(3).replace('.', ','), precoUn.toFixed(2).replace('.', ','), bdiItem.toFixed(2).replace('.', ',') + '%', precoComBdi.toFixed(2).replace('.', ','), totalComBdi.toFixed(2).replace('.', ',') ];
    });
    window.exportarTabelaCSV('Orcamento_Obra', cabecalhos, linhas);
};

window.exportarMaoDeObraCSV = function() {
    if (!window.appState.cachedMaoDeObra || window.appState.cachedMaoDeObra.length === 0) window.gerarLevantamentoCurvaABC();
    if (!window.appState.cachedMaoDeObra || window.appState.cachedMaoDeObra.length === 0) { alert('Nenhum dado de mão de obra disponível.'); return; }

    const cabecalhos = ['Código', 'Descrição / Função', 'Unidade', 'Quantidade Total', 'Preço Unitário (R$)', 'Custo Total (R$)'];
    const linhas = window.appState.cachedMaoDeObra.map(item => [ item.codigo, item.descricao, item.unidade, item.qtdTotal.toFixed(2).replace('.', ','), item.precoUnitario.toFixed(2).replace('.', ','), item.custoTotal.toFixed(2).replace('.', ',') ]);
    window.exportarTabelaCSV('Levantamento_Mao_de_Obra', cabecalhos, linhas);
};

window.exportarCurvaABCMateriaisCSV = function() {
    if (!window.appState.cachedMateriaisABC || window.appState.cachedMateriaisABC.length === 0) window.gerarLevantamentoCurvaABC();
    if (!window.appState.cachedMateriaisABC || window.appState.cachedMateriaisABC.length === 0) { alert('Nenhum dado de materiais disponível na Curva ABC.'); return; }

    const cabecalhos = ['Classe', 'Código', 'Descrição do Material / Insumo', 'Unidade', 'Quantidade Total', 'Preço Unitário (R$)', 'Custo Total (R$)', '% Total', '% Acumulada'];
    const linhas = window.appState.cachedMateriaisABC.map(item => [ item.classeABC || '', item.codigo, item.descricao, item.unidade, item.qtdTotal.toFixed(3).replace('.', ','), item.precoUnitario.toFixed(2).replace('.', ','), item.custoTotal.toFixed(2).replace('.', ','), (item.percTotal || 0).toFixed(2).replace('.', ',') + '%', (item.percAcum || 0).toFixed(2).replace('.', ',') + '%' ]);
    window.exportarTabelaCSV('Curva_ABC_Materiais_Equipamentos', cabecalhos, linhas);
};

window.exportarCurvaABCServicosCSV = function() {
    if (!window.appState.cachedServicosABC || window.appState.cachedServicosABC.length === 0) window.gerarCurvaABCOrcamento();
    if (!window.appState.cachedServicosABC || window.appState.cachedServicosABC.length === 0) { alert('Nenhum dado disponível na Curva ABC de Serviços.'); return; }

    const cabecalhos = ['Classe', 'Item EAP', 'Código', 'Descrição do Serviço', 'Unidade', 'Quantidade', 'Preço c/ BDI (R$)', 'Custo Total (R$)', '% Total', '% Acumulada'];
    const linhas = window.appState.cachedServicosABC.map(item => [ item.classeABC || '', item.itemEap, item.codigo, item.descricao, item.unidade, item.qtd.toFixed(3).replace('.', ','), item.precoComBdi.toFixed(2).replace('.', ','), item.custoTotal.toFixed(2).replace('.', ','), (item.percTotal || 0).toFixed(2).replace('.', ',') + '%', (item.percAcum || 0).toFixed(2).replace('.', ',') + '%' ]);
    window.exportarTabelaCSV('Curva_ABC_Servicos_Orcamento', cabecalhos, linhas);
};
