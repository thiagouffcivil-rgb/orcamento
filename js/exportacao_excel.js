// ============================================================================
// MÓDULO DE EXPORTAÇÃO EXCEL AVANÇADA (EXCELJS - Cores INCA + Brasão + 5 Abas)
// ============================================================================

window.exportarOrcamentoExcel = async function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        alert('Não há itens no orçamento para exportar.');
        return;
    }

    const nomeObra = document.getElementById('input-obra-nome')?.value.toUpperCase() || 'PROJETO NÃO NOMEADO';
    const local = document.getElementById('input-obra-local')?.value.toUpperCase() || 'LOCAL NÃO INFORMADO';
    const processo = document.getElementById('input-obra-processo')?.value || '-';
    const revisao = document.getElementById('input-obra-revisao')?.value || 'R00';
    const estado = document.getElementById('select-estado').value;
    const tabela = document.getElementById('select-tabela').value;
    const regimeTributario = tabela === 'desonerada' ? 'DESONERADO' : 'NÃO DESONERADO';
    const bdi = parseFloat(document.getElementById('input-bdi').value) || 0;
    const dataBaseRef = document.getElementById('select-data-base').options[document.getElementById('select-data-base').selectedIndex].text;
    const basesUtilizadas = "SINAPI, SCO (RJ)"; 

    const corVermelhoINCA = 'FFBE1622'; 
    const corCinzaINCA = 'FF595959';    
    const corFundoEtapa = 'FFF3F4F6';   
    const corBorda = 'FFCBD5E1';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'INCA - Engenharia';
    workbook.created = new Date();

    const logoId = workbook.addImage({ base64: BRASAO_BASE64, extension: 'png' });
    const lNCAId = workbook.addImage({ base64: INCA_BASE64, extension: 'png' });

    let analiticoCompleto = [];
    try {
        const dataBaseCode = document.getElementById('select-data-base').value;
        const urlRaiz = `https://raw.githubusercontent.com/thiagouffcivil-rgb/orcamento/main/${dataBaseCode}/`;
        let scoAnalitico = (window.appState.databases && window.appState.databases.sco_analitico && window.appState.databases.sco_analitico.length > 0) ? window.appState.databases.sco_analitico : await fetch(`${urlRaiz}sco_analitico_${dataBaseCode}.json`).then(r => r.json());
        let sinapiAnalitico = (window.appState.databases && window.appState.databases.sinapi_analitico && window.appState.databases.sinapi_analitico.length > 0) ? window.appState.databases.sinapi_analitico : await fetch(`${urlRaiz}sinapi_analitico_${dataBaseCode}.json`).then(r => r.json());
        analiticoCompleto = sinapiAnalitico.concat(scoAnalitico);
    } catch(e) { console.warn("Aviso: Falha ao recarregar bases analíticas.", e); }

    let resumoData = []; let etapaAtual = null; let totalGeralObra = 0; let subtotalGeralSemBdi = 0;
    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            etapaAtual = { eap: item.itemEap, descricao: item.descricao, total: 0 };
            resumoData.push(etapaAtual);
        } else {
            const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
            const precoComBdi = window.arredondarMoeda(precoUn * (1 + bdi / 100));
            const totalLinha = window.arredondarMoeda(precoComBdi * item.qtd);
            if (etapaAtual) etapaAtual.total += totalLinha;
            totalGeralObra += totalLinha;
            subtotalGeralSemBdi += window.arredondarMoeda(precoUn * item.qtd);
        }
    });

    // ============================================================================
    // ABA 1: RESUMO DO ORÇAMENTO
    // ============================================================================
    const wsResumo = workbook.addWorksheet('Resumo');
    wsResumo.columns = [ { key: 'eap', width: 15 }, { key: 'descricao', width: 75 }, { key: 'total', width: 30, style: { numFmt: '"R\$ "#,##0.00' } } ];

    wsResumo.mergeCells('A1:C1');
    wsResumo.getCell('A1').value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    wsResumo.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    wsResumo.getCell('A1').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsResumo.getRow(1).height = 110; 
    wsResumo.addImage(logoId, { tl: { nativeCol: 1, nativeColOff: 2510000, nativeRow: 0, nativeRowOff: 078000 }, ext: { width: 102, height: 58 } }); 
    wsResumo.addImage(lNCAId, { tl: { nativeCol: 0, nativeColOff: 0770000, nativeRow: 0, nativeRowOff: 400000 }, ext: { width: 128, height: 67 } });

    wsResumo.mergeCells('A2:C2');
    wsResumo.getCell('A2').value = "RESUMO FINANCEIRO POR ETAPA";
    wsResumo.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    wsResumo.getCell('A2').font = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    wsResumo.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    wsResumo.getRow(2).height = 25;

    wsResumo.mergeCells('A3:B3'); wsResumo.getCell('A3').value = `PROJETO: ${nomeObra}`; wsResumo.getCell('C3').value = `PROCESSO: ${processo}`;
    wsResumo.mergeCells('A4:B4'); wsResumo.getCell('A4').value = `LOCAL: ${local}`; wsResumo.getCell('C4').value = `DATA-BASE: ${dataBaseRef}`;
    
    for (let i = 2; i <= 4; i++) { wsResumo.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderResumo = wsResumo.getRow(6);
    rowHeaderResumo.values = ['ITEM EAP', 'DESCRIÇÃO DA ETAPA', 'PREÇO TOTAL (R\$)'];
    rowHeaderResumo.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    resumoData.forEach(etapa => {
        const row = wsResumo.addRow([etapa.eap, etapa.descricao, etapa.total]);
        row.font = { bold: true, color: { argb: corCinzaINCA } };
        row.getCell(1).alignment = { horizontal: 'center' };
        row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }; });
    });

    wsResumo.addRow([]);
    const rowTotalResumo = wsResumo.addRow(['', 'TOTAL GERAL DA OBRA:', totalGeralObra]);
    rowTotalResumo.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    rowTotalResumo.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rowTotalResumo.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    rowTotalResumo.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rowTotalResumo.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };

    // ============================================================================
    // ABA 2: ORÇAMENTO SINTÉTICO
    // ============================================================================
    const wsSintetico = workbook.addWorksheet('Orçamento Sintético');
    wsSintetico.columns = [
        { key: 'eap', width: 12 }, { key: 'tipo', width: 15 }, { key: 'codigo', width: 12 }, { key: 'descricao', width: 60 }, { key: 'unidade', width: 10 }, { key: 'qtd', width: 15, style: { numFmt: '#,##0.000' } },
        { key: 'precoUn', width: 20, style: { numFmt: '"R\$ "#,##0.00' } }, { key: 'precoBdi', width: 20, style: { numFmt: '"R\$ "#,##0.00' } }, { key: 'total', width: 20, style: { numFmt: '"R\$ "#,##0.00' } }
    ];

    wsSintetico.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsSintetico.mergeCells('A1:I1');
    const cellInstSint = wsSintetico.getCell('A1');
    cellInstSint.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstSint.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstSint.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsSintetico.getRow(1).height = 110; 
    wsSintetico.addImage(logoId, { tl: { nativeCol: 3, nativeColOff: 3055000, nativeRow: 0, nativeRowOff: 078000 }, ext: { width: 102, height: 58 } }); 
    wsSintetico.addImage(lNCAId, { tl: { nativeCol: 0, nativeColOff: 0770000, nativeRow: 0, nativeRowOff: 400000 }, ext: { width: 128, height: 67 } });

    wsSintetico.mergeCells('A2:I2');
    const cellTituloSint = wsSintetico.getCell('A2');
    cellTituloSint.value = "PLANILHA DE ORÇAMENTOS DE PROJETOS E OBRAS - SINTÉTICA";
    cellTituloSint.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloSint.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloSint.alignment = { horizontal: 'center', vertical: 'middle' };

    wsSintetico.mergeCells('A3:E3'); wsSintetico.mergeCells('F3:I3');
    wsSintetico.getCell('A3').value = `PROJETO: ${nomeObra}`; wsSintetico.getCell('F3').value = `PROCESSO: ${processo}`;
    wsSintetico.mergeCells('A4:E4'); wsSintetico.mergeCells('F4:I4');
    wsSintetico.getCell('A4').value = `LOCAL: ${local}`; wsSintetico.getCell('F4').value = `ARTs: ANEXADAS AO PROCESSO`;

    wsSintetico.mergeCells('A5:D5');
    wsSintetico.getCell('A5').value = `NOME DA OBRA: ${nomeObra}`;
    wsSintetico.getCell('E5').value = "BDI"; wsSintetico.getCell('F5').value = "BDI DIF."; wsSintetico.getCell('G5').value = "REGIME TRIBUTÁRIO"; wsSintetico.getCell('H5').value = "DATA-BASE"; wsSintetico.getCell('I5').value = "REVISÃO";
    
    wsSintetico.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if(colNumber >= 5) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    });

    wsSintetico.mergeCells('A6:D6');
    wsSintetico.getCell('A6').value = `BASE DE DADOS: ${basesUtilizadas}`; wsSintetico.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsSintetico.getCell('E6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsSintetico.getCell('F6').value = "0,00%"; wsSintetico.getCell('G6').value = regimeTributario; wsSintetico.getCell('H6').value = dataBaseRef; wsSintetico.getCell('I6').value = revisao;
    
    wsSintetico.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if(colNumber >= 5) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

    for (let i = 2; i <= 6; i++) { wsSintetico.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderCols = wsSintetico.getRow(8);
    rowHeaderCols.values = ['ITEM', 'TIPO', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'QUANTIDADE', 'CUSTO UNITÁRIO (R\$)', 'PREÇO UNIT c/ BDI (R\$)', 'PREÇO TOTAL (R\$)'];
    rowHeaderCols.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    rowHeaderCols.height = 30;

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            const row = wsSintetico.addRow({ eap: item.itemEap, tipo: 'ETAPA', codigo: '', descricao: item.descricao });
            wsSintetico.mergeCells(`D${row.number}:I${row.number}`);
            row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoEtapa } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; });
            row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(2).alignment = { horizontal: 'center' };
        } else {
            const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
            const precoComBdi = window.arredondarMoeda(precoUn * (1 + bdi / 100));
            const memTexto = (item.memoria && item.memoria !== '-') ? `\n[Memória de Cálculo: ${item.memoria}]` : '';
            const row = wsSintetico.addRow({ eap: item.itemEap, tipo: item.tipo.toUpperCase(), codigo: item.codigo, descricao: item.descricao + memTexto, unidade: item.unidade, qtd: parseFloat(item.qtd), precoUn: precoUn, precoBdi: precoComBdi, total: window.arredondarMoeda(precoComBdi * item.qtd) });
            row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(2).alignment = { horizontal: 'center' }; row.getCell(3).alignment = { horizontal: 'center' }; row.getCell(5).alignment = { horizontal: 'center' };
            row.getCell(1).font = { bold: true }; row.getCell(9).font = { bold: true };
        }
    });

    const blankRowSint = wsSintetico.addRow([]); const valorBdi = totalGeralObra - subtotalGeralSemBdi;
    const rowSub = wsSintetico.addRow(['', '', '', '', '', '', '', '', subtotalGeralSemBdi]);
    wsSintetico.mergeCells(`A${rowSub.number}:H${rowSub.number}`); rowSub.getCell(1).value = 'Subtotal (Sem BDI):'; rowSub.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowSub.getCell(1).font = { bold: true }; rowSub.getCell(9).font = { bold: true }; rowSub.getCell(9).numFmt = '"R\$ "#,##0.00';
    
    const rowBdi1 = wsSintetico.addRow(['', '', '', '', '', '', '', '', valorBdi]);
    wsSintetico.mergeCells(`A${rowBdi1.number}:H${rowBdi1.number}`); rowBdi1.getCell(1).value = `Valor do BDI (${bdi.toFixed(2).replace('.', ',')}%):`; rowBdi1.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowBdi1.getCell(1).font = { bold: true }; rowBdi1.getCell(9).font = { bold: true }; rowBdi1.getCell(9).numFmt = '"R\$ "#,##0.00';
    
    const rowTotal1 = wsSintetico.addRow(['', '', '', '', '', '', '', '', totalGeralObra]);
    wsSintetico.mergeCells(`A${rowTotal1.number}:H${rowTotal1.number}`); rowTotal1.getCell(1).value = 'TOTAL DO ORÇAMENTO:'; rowTotal1.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowTotal1.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; rowTotal1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; rowTotal1.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } }; rowTotal1.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; rowTotal1.getCell(9).numFmt = '"R\$ "#,##0.00';

    wsSintetico.eachRow((row, rowNumber) => { if(rowNumber >= 8 && row.number !== blankRowSint.number) { row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } }; }); } });

    // ============================================================================
    // ABA 3: ORÇAMENTO ANALÍTICO
    // ============================================================================
    const wsAnalitico = workbook.addWorksheet('Orçamento Analítico');
    wsAnalitico.columns = [
        { header: 'EAP / Código', key: 'codigo', width: 22 }, { header: 'Tipo', key: 'tipo', width: 18 }, { header: 'Descrição', key: 'descricao', width: 75 },
        { header: 'Und', key: 'unidade', width: 8 }, { header: 'Coeficiente', key: 'coeficiente', width: 18, style: { numFmt: '#,##0.0000000' } },
        { header: 'Custo Un. Direto (R\$)', key: 'custoUn', width: 22, style: { numFmt: '"R\$ "#,##0.00' } }, { header: 'Custo Total Direto (R\$)', key: 'custoTotal', width: 22, style: { numFmt: '"R\$ "#,##0.00' } }
    ];

    wsAnalitico.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsAnalitico.mergeCells('A1:G1');
    const cellInstAnalitico = wsAnalitico.getCell('A1');
    cellInstAnalitico.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstAnalitico.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstAnalitico.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAnalitico.getRow(1).height = 110; 
    wsAnalitico.addImage(logoId, { tl: { nativeCol: 2, nativeColOff: 3015000, nativeRow: 0, nativeRowOff: 078000 }, ext: { width: 102, height: 58 } }); 
    wsAnalitico.addImage(lNCAId, { tl: { nativeCol: 0, nativeColOff: 0770000, nativeRow: 0, nativeRowOff: 400000 }, ext: { width: 128, height: 67 } });

    wsAnalitico.mergeCells('A2:G2');
    const cellTituloAnalitico = wsAnalitico.getCell('A2');
    cellTituloAnalitico.value = "PLANILHA DE ORÇAMENTOS DE PROJETOS E OBRAS - ANALÍTICA";
    cellTituloAnalitico.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloAnalitico.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloAnalitico.alignment = { horizontal: 'center', vertical: 'middle' };

    wsAnalitico.mergeCells('A3:D3'); wsAnalitico.mergeCells('E3:G3');
    wsAnalitico.getCell('A3').value = `PROJETO: ${nomeObra}`; wsAnalitico.getCell('E3').value = `PROCESSO: ${processo}`;
    wsAnalitico.mergeCells('A4:D4'); wsAnalitico.mergeCells('E4:G4');
    wsAnalitico.getCell('A4').value = `LOCAL: ${local}`; wsAnalitico.getCell('E4').value = `ARTs: ANEXADAS AO PROCESSO`;

    wsAnalitico.mergeCells('A5:C5');
    wsAnalitico.getCell('A5').value = `NOME DA OBRA: ${nomeObra}`;
    wsAnalitico.getCell('D5').value = "BDI"; wsAnalitico.getCell('E5').value = "REGIME TRIBUTÁRIO"; wsAnalitico.getCell('F5').value = "DATA-BASE"; wsAnalitico.getCell('G5').value = "REVISÃO";

    wsAnalitico.getCell('E5').alignment = { vertical: 'middle', wrapText: true };
    
    wsAnalitico.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if(colNumber >= 4) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    });

    wsAnalitico.mergeCells('A6:C6');
    wsAnalitico.getCell('A6').value = `BASE DE DADOS: ${basesUtilizadas}`; wsAnalitico.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAnalitico.getCell('D6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsAnalitico.getCell('E6').value = regimeTributario; wsAnalitico.getCell('E6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; wsAnalitico.getCell('F6').value = dataBaseRef; wsAnalitico.getCell('G6').value = revisao;
    
    wsAnalitico.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if(colNumber >= 4) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

    for (let i = 2; i <= 6; i++) { wsAnalitico.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderAnalitico = wsAnalitico.getRow(8);
    rowHeaderAnalitico.values = ['EAP / CÓDIGO', 'TIPO', 'DESCRIÇÃO', 'UND', 'COEFICIENTE', 'CUSTO UN. DIRETO (R\$)', 'CUSTO TOTAL DIRETO (R\$)'];
    rowHeaderAnalitico.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; 
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } };
    });
    rowHeaderAnalitico.height = 30;

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            const row = wsAnalitico.addRow({ codigo: item.itemEap, tipo: 'ETAPA', descricao: item.descricao });
            wsAnalitico.mergeCells(`C${row.number}:G${row.number}`);
            row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoEtapa } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; });
        } else {
            const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
            const rowSrv = wsAnalitico.addRow({ codigo: `[${item.itemEap}] ${item.codigo}`, tipo: 'SERVIÇO', descricao: item.descricao, unidade: item.unidade, coeficiente: 1, custoUn: precoUn, custoTotal: precoUn });
            rowSrv.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; cell.border = { top: { style: 'thin', color: { argb: corBorda} }, bottom: { style: 'thin', color: { argb: corBorda} } }; });

            const limparCodigoStr = (cod) => cod ? String(cod).replace(/\s*\(\s*\/\s*\)\s*/g, '').trim() : '';
            
            let lista = [];
            if (item.ingredientes && item.ingredientes.length > 0) lista = item.ingredientes;
            else if (item.codigo && item.codigo !== '-') {
                const codigoMaeLimpo = limparCodigoStr(item.codigo);
                
                if (window.appState.databases && window.appState.databases.base_propria) {
                    const compPropria = window.appState.databases.base_propria.find(i => limparCodigoStr(i['Código']) === codigoMaeLimpo);
                    if (compPropria && Array.isArray(compPropria.ingredientes)) lista = compPropria.ingredientes;
                }
                if (lista.length === 0) {
                    lista = analiticoCompleto.filter(i => limparCodigoStr(i['Código'] || i['Código Mãe']) === codigoMaeLimpo);
                }
            }

            if (lista && lista.length > 0) {
                let custosTotaisInsumos = {};
                let ingredientesFormatados = [];

                // --- ETAPA A: PRIMEIRA PASSADA ---
                lista.forEach(ing => {
                    const codigoItem = ing['Código do Item'] || ing['Código Item'] || ing['Código'] || ing.codigoItem || ing.codigo || '-';
                    if (limparCodigoStr(codigoItem).toUpperCase() === limparCodigoStr(item.codigo).toUpperCase()) return; 

                    const descricao = ing['Descrição'] || ing.descricao || 'Insumo';
                    const unidade = (ing['Unidade'] || ing.unidade || '-').trim();
                    const coeficiente = parseFloat(ing['Coeficiente'] || ing.coeficiente) || 1.0;
                    
                    const tipoBruto = String(ing['Tipo Item'] || ing.tipoItem || 'INSUMO').toLowerCase();
                    const isSubComp = tipoBruto.includes('composicao') || tipoBruto === 'comp';
                    const isSCOItem = String(codigoItem).startsWith('SCO') || String(codigoItem).startsWith('AD ') || String(codigoItem).startsWith('MAT') || String(codigoItem).startsWith('MOD') || String(codigoItem).startsWith('MOI') || String(codigoItem).startsWith('EQ ') || String(codigoItem).startsWith('IEQ') || String(codigoItem).startsWith('REQ');
                    const tipoItem = ing.tipoItem || (isSubComp ? (isSCOItem ? 'sco_composicao' : 'composicao') : (isSCOItem ? 'sco_insumo' : 'insumo'));

                    let custoIng = ing.precoUnitario || ing['Preço Unitário (R\$)'];
                    if (custoIng === undefined || custoIng === null) { 
                        if (typeof window.obterPrecoItemPorCodigoETipo === 'function') 
                            custoIng = window.obterPrecoItemPorCodigoETipo(codigoItem, tipoItem, estado, tabela); 
                    }
                    custoIng = parseFloat(custoIng) || 0;

                    let custoTotalIngrediente = 0;

                    if (unidade !== '%') {
                        custoTotalIngrediente = coeficiente * custoIng;
                        custosTotaisInsumos[codigoItem] = custoTotalIngrediente;
                    }

                    ingredientesFormatados.push({
                        orig: ing,
                        codigoItem: codigoItem,
                        descricao: descricao,
                        unidade: unidade,
                        tipoItem: tipoItem,
                        custoIng: custoIng,
                        coeficiente: coeficiente,
                        custoTotalCalculado: custoTotalIngrediente
                    });
                });

               // --- ETAPA B: SEGUNDA PASSADA (Calcula Taxas %) ---
ingredientesFormatados.forEach(ingObj => {
    let imprimirCustoUn = ingObj.custoIng; 

    if (ingObj.unidade === '%') {
        let baseDeCalculo = 0;
        let arrayBaseEVE = ingObj.orig['Insumos_Base_EVE'];
        
        if (typeof arrayBaseEVE === 'string') {
            try { arrayBaseEVE = JSON.parse(arrayBaseEVE); } catch(e) { arrayBaseEVE = []; }
        }

        if (Array.isArray(arrayBaseEVE) && arrayBaseEVE.length > 0) {
            baseDeCalculo = arrayBaseEVE.reduce((soma, codBase) => {
                const cleanCodBase = String(codBase).trim();
                return soma + (custosTotaisInsumos[cleanCodBase] || 0);
            }, 0);
        } 
        else {
            const isSCOItemT = String(ingObj.codigoItem).startsWith('EVE') || String(ingObj.codigoItem).startsWith('SCO');
            if (isSCOItemT) {
                baseDeCalculo = Object.keys(custosTotaisInsumos).reduce((soma, chaveMaoDeObra) => {
                    if (chaveMaoDeObra.startsWith('MOD') || chaveMaoDeObra.startsWith('MOI')) {
                        return soma + custosTotaisInsumos[chaveMaoDeObra];
                    }
                    return soma;
                }, 0);
            } else {
                baseDeCalculo = Object.values(custosTotaisInsumos).reduce((a, b) => a + b, 0); 
            }
        }

        // ---> MAPEAMENTO DIRETO PELO CÓDIGO DO INSUMO (Muito mais robusto!) <---
        const tabelaPercentuaisEVE = {
            'EVE000050': 3,   // EPI / Ferramentas (sobre Mão de Obra)
            'EVE000100': 5,   // EPI / Tráfego (sobre Mão de Obra)
            'EVE000200': 3,   // Perda areia grossa
            'EVE000250': 5,   // Perda areia grossa
            'EVE000300': 3,   // Perda brita 0
            'EVE000350': 5,   // Perda brita 0
            'EVE000400': 3,   // Perda brita 1
            'EVE000450': 5,   // Perda brita 1
            'EVE000500': 3,   // Perda brita 2
            'EVE000550': 5,   // Perda brita 2
            'EVE000600': 5,   // Perda cal hidratada
            'EVE000650': 5,   // Perda cimento branco
            'EVE000700': 5,   // Perda cimento CP-32
            'EVE000750': 5,   // Perda Gesso estuque
            'EVE000800': 5,   // Perda perfil aço "H"
            'EVE000850': 5,   // Perda perfil trilho
            'EVE000900': 3,   // Perda pó-de-pedra
            'EVE000950': 5,   // Perda saibro
            'EVE001000': 5,   // Perda terra preta
            'EVE001050': 10,  // Perda tirante 25mm
            'EVE001100': 10   // Perda tirante 32mm
        };

        // Descobre o percentual olhando o dicionário, ou cai para o valor do item se houver
        let percentual = tabelaPercentuaisEVE[String(ingObj.codigoItem).trim()] || ingObj.custoIng || 0;

        // Cálculo Real: Coeficiente * (Percentual / 100) * BaseCalculo
        ingObj.custoTotalCalculado = ingObj.coeficiente * (percentual / 100) * baseDeCalculo;
        
        imprimirCustoUn = baseDeCalculo; 
        ingObj.descricao = `${ingObj.descricao} (Base: R$ ${baseDeCalculo.toFixed(2)} à taxa de ${percentual}%)`;
    }

    wsAnalitico.addRow({ 
        codigo: ingObj.codigoItem, 
        tipo: ingObj.tipoItem.toUpperCase().replace('_', ' '), 
        descricao: ingObj.descricao, 
        unidade: ingObj.unidade, 
        coeficiente: ingObj.coeficiente, 
        custoUn: imprimirCustoUn, 
        custoTotal: window.arredondarMoeda(ingObj.custoTotalCalculado) 
    });
});
            } else {
                wsAnalitico.addRow({ codigo: '-', tipo: 'AVISO', descricao: '   [Nenhuma receita detalhada na base]', unidade: '-', coeficiente: 0, custoUn: 0, custoTotal: 0 });
            }
            wsAnalitico.addRow([]);
        }
    });

    // ============================================================================
    // ABA 4: CURVA ABC DE SERVIÇOS
    // ============================================================================
    const wsAbc = workbook.addWorksheet('Curva ABC de Serviços');
    wsAbc.columns = [
        { header: 'Classe', key: 'classe', width: 10 }, { header: 'Item EAP', key: 'eap', width: 12 }, { header: 'Código', key: 'codigo', width: 15 },
        { header: 'Descrição do Serviço', key: 'descricao', width: 60 }, { header: 'Und', key: 'unidade', width: 8 }, { header: 'Qtd', key: 'qtd', width: 12, style: { numFmt: '#,##0.000' } },
        { header: 'Preço c/ BDI (R\$)', key: 'precoBdi', width: 18, style: { numFmt: '"R\$ "#,##0.00' } }, { header: 'Custo Total (R\$)', key: 'custoTotal', width: 20, style: { numFmt: '"R\$ "#,##0.00' } },
        { header: '% Total', key: 'percTotal', width: 12, style: { numFmt: '0.00%' } }, { header: '% Acumulada', key: 'percAcum', width: 14, style: { numFmt: '0.00%' } }
    ];

    wsAbc.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsAbc.mergeCells('A1:J1');
    const cellInstAbc = wsAbc.getCell('A1');
    cellInstAbc.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstAbc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstAbc.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAbc.getRow(1).height = 110; 
    wsAbc.addImage(logoId, { tl: { nativeCol: 3, nativeColOff: 3090000, nativeRow: 0, nativeRowOff: 078000 }, ext: { width: 102, height: 58 } }); 
    wsAbc.addImage(lNCAId, { tl: { nativeCol: 0, nativeColOff: 0770000, nativeRow: 0, nativeRowOff: 400000 }, ext: { width: 128, height: 67 } });

    wsAbc.mergeCells('A2:J2');
    const cellTituloAbc = wsAbc.getCell('A2');
    cellTituloAbc.value = "CURVA ABC DE SERVIÇOS DO ORÇAMENTO";
    cellTituloAbc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloAbc.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloAbc.alignment = { horizontal: 'center', vertical: 'middle' };

    wsAbc.mergeCells('A3:E3'); wsAbc.mergeCells('F3:J3');
    wsAbc.getCell('A3').value = `PROJETO: ${nomeObra}`; wsAbc.getCell('F3').value = `PROCESSO: ${processo}`;
    wsAbc.mergeCells('A4:E4'); wsAbc.mergeCells('F4:J4');
    wsAbc.getCell('A4').value = `LOCAL: ${local}`; wsAbc.getCell('F4').value = `ARTs: ANEXADAS AO PROCESSO`;

    wsAbc.mergeCells('A5:E5');
    wsAbc.getCell('A5').value = `NOME DA OBRA: ${nomeObra}`;
    wsAbc.getCell('F5').value = "BDI"; wsAbc.getCell('G5').value = "BDI DIF."; wsAbc.getCell('H5').value = "REGIME TRIBUTÁRIO"; wsAbc.getCell('I5').value = "DATA-BASE"; wsAbc.getCell('J5').value = "REVISÃO";
    
    wsAbc.getCell('H5').alignment = { vertical: 'middle', wrapText: true };

    wsAbc.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if(colNumber >= 6) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    });

    wsAbc.mergeCells('A6:E6');
    wsAbc.getCell('A6').value = `BASE DE DADOS: ${basesUtilizadas}`; wsAbc.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAbc.getCell('F6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsAbc.getCell('G6').value = "0,00%"; wsAbc.getCell('H6').value = regimeTributario; wsAbc.getCell('I6').value = dataBaseRef; wsAbc.getCell('J6').value = revisao;
    
    wsAbc.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if(colNumber >= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

    for (let i = 2; i <= 6; i++) { wsAbc.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderABC = wsAbc.getRow(8);
    rowHeaderABC.values = ['CLASSE', 'ITEM EAP', 'CÓDIGO', 'DESCRIÇÃO DO SERVIÇO', 'UND', 'QTD', 'PREÇO C/ BDI (R\$)', 'CUSTO TOTAL (R\$)', '% TOTAL', '% ACUMULADA'];
    rowHeaderABC.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; 
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } };
    });
    rowHeaderABC.height = 30;

    let itensABC = window.appState.orcamento.filter(item => item.tipo !== 'etapa').map(item => {
        const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
        const precoComBdi = window.arredondarMoeda(precoUn * (1 + bdi / 100));
        const custoTotal = window.arredondarMoeda(precoComBdi * item.qtd);
        return { ...item, precoComBdi, custoTotal };
    });

    itensABC.sort((a, b) => b.custoTotal - a.custoTotal);
    let somaTotalABC = itensABC.reduce((acc, item) => acc + item.custoTotal, 0); let custoAcumuladoABC = 0;

    itensABC.forEach(item => {
        custoAcumuladoABC += item.custoTotal;
        const percTotal = somaTotalABC > 0 ? (item.custoTotal / somaTotalABC) : 0;
        const percAcum = somaTotalABC > 0 ? (custoAcumuladoABC / somaTotalABC) : 0;
        
        let classeABC = 'A'; let corClasse = 'FF15803D'; 
        if (percAcum > 0.95) { classeABC = 'C'; corClasse = 'FFB91C1C'; } 
        else if (percAcum > 0.80) { classeABC = 'B'; corClasse = 'FFB45309'; } 

        const row = wsAbc.addRow({ classe: classeABC, eap: item.itemEap, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, qtd: parseFloat(item.qtd), precoBdi: item.precoComBdi, custoTotal: item.custoTotal, percTotal: percTotal, percAcum: percAcum });
        row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(1).font = { bold: true, color: { argb: corClasse } }; row.getCell(2).alignment = { horizontal: 'center' }; row.getCell(3).alignment = { horizontal: 'center' }; row.getCell(5).alignment = { horizontal: 'center' };
        row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }; });
    });

    wsAbc.addRow([]);
    const rowTotalABC = wsAbc.addRow(['', '', '', 'TOTAL DO ORÇAMENTO (COM BDI):', '', '', '', somaTotalABC, 1, 1]);
    rowTotalABC.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }; rowTotalABC.getCell(4).font = { bold: true, color: { argb: corCinzaINCA } }; rowTotalABC.getCell(8).font = { bold: true, color: { argb: corVermelhoINCA } };


    // ============================================================================
    // ABA 5: MAPA DE COTAÇÕES (TCU)
    // ============================================================================
    const wsCotacoes = workbook.addWorksheet('Mapa de Cotações');

    wsCotacoes.columns = [
        { key: 'eap', width: 12 },
        { key: 'codigo', width: 15 },
        { key: 'descricao', width: 50 },
        { key: 'unidade', width: 10 },
        { key: 'precoAdotado', width: 20, style: { numFmt: '"R\$ "#,##0.00' } },
        { key: 'justificativa', width: 70 }
    ];

    wsCotacoes.mergeCells('A1:F1');
    const cellInstCot = wsCotacoes.getCell('A1');
    cellInstCot.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstCot.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstCot.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsCotacoes.getRow(1).height = 110; 

    wsCotacoes.addImage(logoId, { tl: { nativeCol: 3, nativeColOff: 1700000, nativeRow: 0, nativeRowOff: 078000 }, ext: { width: 102, height: 58 } }); 
    wsCotacoes.addImage(lNCAId, { tl: { nativeCol: 0, nativeColOff: 0770000, nativeRow: 0, nativeRowOff: 400000 }, ext: { width: 128, height: 67 } });

    wsCotacoes.mergeCells('A2:F2');
    const cellTituloCot = wsCotacoes.getCell('A2');
    cellTituloCot.value = "MAPA DE COTAÇÕES (CONFORME LEI 14.133/2021)";
    cellTituloCot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloCot.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloCot.alignment = { horizontal: 'center', vertical: 'middle' };

    wsCotacoes.mergeCells('A3:B3'); wsCotacoes.mergeCells('C3:F3'); 
    wsCotacoes.getCell('A3').value = "PROJETO:"; 
    wsCotacoes.getCell('C3').value = nomeObra;

    wsCotacoes.mergeCells('A4:B4'); wsCotacoes.mergeCells('C4:F4'); 
    wsCotacoes.getCell('A4').value = "LOCAL/SEI:"; 
    wsCotacoes.getCell('C4').value = `${local} | Processo SEI: ${processo}`;

    [3, 4].forEach(rowIndex => {
        wsCotacoes.getRow(rowIndex).eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
            cell.alignment = { vertical: 'middle' };
        });
    });

    const blankRowCot = wsCotacoes.addRow([]);

    const rowHeaderCot = wsCotacoes.getRow(6);
    rowHeaderCot.values = ['EAP', 'CÓDIGO', 'DESCRIÇÃO DO INSUMO (COTAÇÃO)', 'UNID', 'PREÇO ESTATÍSTICO (R\$)', 'JUSTIFICATIVA E FONTES DE PESQUISA (LEI 14.133)'];
    rowHeaderCot.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: {style:'thin', color:{argb:corBorda}}, left: {style:'thin', color:{argb:corBorda}}, bottom: {style:'thin', color:{argb:corBorda}}, right: {style:'thin', color:{argb:corBorda}} };
    });
    rowHeaderCot.height = 30;

    wsCotacoes.getColumn('justificativa').alignment = { wrapText: true, vertical: 'middle' };
    wsCotacoes.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    let qtdCotacoes = 0;

    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa') {
            if (item.justificativa) {
                qtdCotacoes++;
                const precoUn = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
                const row = wsCotacoes.addRow({ eap: item.itemEap, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, precoAdotado: precoUn, justificativa: item.justificativa });
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            let listaIngredientes = item.ingredientes || [];
            if (listaIngredientes.length === 0 && item.codigo) {
                if (window.appState.databases && window.appState.databases.base_propria) {
                    const compPropria = window.appState.databases.base_propria.find(i => String(i['Código']).trim() === String(item.codigo).trim());
                    if (compPropria && Array.isArray(compPropria.ingredientes)) listaIngredientes = compPropria.ingredientes;
                }
            }

            if (listaIngredientes && Array.isArray(listaIngredientes)) {
                listaIngredientes.forEach(ing => {
                    if (ing.tipoItem === 'avulso_inventado' && ing.justificativa) {
                        qtdCotacoes++;
                        const row = wsCotacoes.addRow({ eap: item.itemEap, codigo: ing.codigoItem, descricao: `[Dentro de: ${item.codigo}] ${ing.descricao}`, unidade: ing.unidade, precoAdotado: ing.precoUnitario, justificativa: ing.justificativa });
                        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            }
        }
    });

    if (qtdCotacoes === 0) {
        const emptyRow = wsCotacoes.addRow(['', '', 'Nenhuma cotação de mercado vinculada a este orçamento.', '', '', '']);
        wsCotacoes.mergeCells(`C${emptyRow.number}:F${emptyRow.number}`);
        emptyRow.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        emptyRow.getCell(3).font = { italic: true, color: { argb: corCinzaINCA } };
    }

    wsCotacoes.eachRow((row, rowNumber) => {
        if (rowNumber >= 6) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
            });
        }
    });

    // ============================================================================
    // GERAÇÃO E DOWNLOAD DO ARQUIVO EXCEL
    // ============================================================================
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Orcamento_INCA_${nomeObra.replace(/\s+/g, '_')}_${estado}_${tabela}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};