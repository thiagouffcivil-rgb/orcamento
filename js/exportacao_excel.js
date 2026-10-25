// ============================================================================
// MÓDULO DE EXPORTAÇÃO EXCEL AVANÇADA (EXCELJS - Cores INCA + Brasão + 9 Abas)
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
    const bdiDifRaw = parseFloat(document.getElementById('input-bdi-dif')?.value);
    const bdiDif = !isNaN(bdiDifRaw) ? bdiDifRaw : bdi;
    const dataBaseRef = document.getElementById('select-data-base').options[document.getElementById('select-data-base').selectedIndex].text;
    const basesUtilizadas = "SINAPI, SCO (RJ)"; 

    const dadosOrc = typeof window.obterDadosOrcamentista === 'function'
        ? window.obterDadosOrcamentista()
        : { nome: '', cargo: 'Engenheiro Civil / Orçamentista', registro: '', art: 'ANEXADAS AO PROCESSO' };
    const textoArtHeader = `ART/RRT: ${dadosOrc.art || 'ANEXADAS AO PROCESSO'}${dadosOrc.nome ? ' | RESP.: ' + dadosOrc.nome.toUpperCase() : ''}`;

    const corVermelhoINCA = 'FFBE1622'; 
    const corCinzaINCA = 'FF595959';    
    const corFundoEtapa = 'FFF3F4F6';   
    const corBorda = 'FFCBD5E1';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = dadosOrc.nome || 'INCA - Engenharia';
    workbook.created = new Date();

    const logoId = workbook.addImage({ base64: BRASAO_BASE64, extension: 'png' });
    const lNCAId = workbook.addImage({ base64: INCA_BASE64, extension: 'png' });

    // Posiciona o Brasão da República exatamente no centro horizontal da largura total das colunas da aba
    function adicionarImagensCabecalhoINCA(ws, numCols) {
        const larguraBrasaoPx = 102;
        const alturaBrasaoPx = 58;
        const emuPorPixel = 9525; // 914400 EMUs/inch ÷ 96 px/inch
        const pxPorUnidadeColuna = 8.6; // Fator real de renderização de largura de coluna (Calc/Excel em Linux/DPI)

        let largurasPx = [];
        let larguraTotalPx = 0;
        for (let c = 1; c <= numCols; c++) {
            const colObj = ws.getColumn(c);
            const wChar = (colObj && colObj.width) ? colObj.width : 12;
            const wPx = wChar * pxPorUnidadeColuna;
            largurasPx.push(wPx);
            larguraTotalPx += wPx;
        }

        let targetLeftPx = Math.max(0, (larguraTotalPx - larguraBrasaoPx) / 2);
        let colIndex0 = 0;
        let offsetDentroColPx = targetLeftPx;

        for (let i = 0; i < largurasPx.length; i++) {
            if (offsetDentroColPx <= largurasPx[i] || i === largurasPx.length - 1) {
                colIndex0 = i;
                break;
            }
            offsetDentroColPx -= largurasPx[i];
        }

        const nativeColOffBrasao = Math.round(offsetDentroColPx * emuPorPixel);

        ws.addImage(logoId, {
            tl: { nativeCol: colIndex0, nativeColOff: nativeColOffBrasao, nativeRow: 0, nativeRowOff: 78000 },
            ext: { width: larguraBrasaoPx, height: alturaBrasaoPx }
        });
        ws.addImage(lNCAId, {
            tl: { nativeCol: 0, nativeColOff: 770000, nativeRow: 0, nativeRowOff: 400000 },
            ext: { width: 128, height: 67 }
        });
    }

    // Bloco oficial de identificação e assinatura do Responsável Técnico no rodapé das planilhas
    function adicionarBlocoAssinaturaExcel(ws, numCols) {
        ws.addRow([]);
        ws.addRow([]);
        const rLinha = ws.addRow([]);
        ws.mergeCells(rLinha.number, 1, rLinha.number, numCols);
        rLinha.getCell(1).value = '____________________________________________________________';
        rLinha.getCell(1).alignment = { horizontal: 'center', vertical: 'bottom' };
        rLinha.getCell(1).font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };

        const rNome = ws.addRow([]);
        ws.mergeCells(rNome.number, 1, rNome.number, numCols);
        rNome.getCell(1).value = (dadosOrc.nome || 'RESPONSÁVEL TÉCNICO PELO ORÇAMENTO').toUpperCase();
        rNome.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        rNome.getCell(1).font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FF0F172A' } };

        const rCargo = ws.addRow([]);
        ws.mergeCells(rCargo.number, 1, rCargo.number, numCols);
        const textoReg = dadosOrc.registro ? ` — ${dadosOrc.registro}` : '';
        rCargo.getCell(1).value = `${dadosOrc.cargo || 'Engenheiro / Orçamentista'}${textoReg} | ART/RRT: ${dadosOrc.art || 'ANEXADAS AO PROCESSO'}`;
        rCargo.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        rCargo.getCell(1).font = { size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    }

    // Formata o identificador de tipo para rótulo legível e compacto nas planilhas
    function formatarTipoExcel(tipoBruto) {
        const t = String(tipoBruto || '').toLowerCase().trim();
        const mapaTipos = {
            'composicao': 'COMP. SINAPI',
            'insumo': 'INSUMO SINAPI',
            'sco_composicao': 'COMP. SCO',
            'sco_insumo': 'INSUMO SCO',
            'base_propria': 'BASE PRÓPRIA',
            'item_avulso': 'ITEM AVULSO',
            'etapa': 'ETAPA'
        };
        return mapaTipos[t] || String(tipoBruto || '').toUpperCase().replace(/_/g, ' ');
    }

    // Calcula a altura ideal da linha (em pontos) considerando quebras de linha automáticas (wrapText) e explícitas (\n)
    function calcularAlturaLinhaExcel(paresTextoLargura, alturaMin = 24, ptsPorLinha = 15) {
        let maxLinhas = 1;
        paresTextoLargura.forEach(([texto, larguraUtil]) => {
            if (!texto) return;
            const larg = Math.max(8, larguraUtil || 45);
            const paragrafos = String(texto).split('\n');
            let linhasTexto = 0;
            paragrafos.forEach(p => {
                const len = p.trim().length;
                linhasTexto += Math.max(1, Math.ceil(len / larg));
            });
            if (linhasTexto > maxLinhas) maxLinhas = linhasTexto;
        });
        return Math.max(alturaMin, Math.ceil(maxLinhas * ptsPorLinha + 8));
    }

    let analiticoCompleto = [];
    try {
        const dataBaseCode = document.getElementById('select-data-base').value;
        const urlRaiz = `https://raw.githubusercontent.com/thiagouffcivil-rgb/orcamento/main/${dataBaseCode}/`;
        let scoAnalitico = (window.appState.databases && window.appState.databases.sco_analitico && window.appState.databases.sco_analitico.length > 0) ? window.appState.databases.sco_analitico : await fetch(`${urlRaiz}sco_analitico_${dataBaseCode}.json`).then(r => r.json());
        let sinapiAnalitico = (window.appState.databases && window.appState.databases.sinapi_analitico && window.appState.databases.sinapi_analitico.length > 0) ? window.appState.databases.sinapi_analitico : await fetch(`${urlRaiz}sinapi_analitico_${dataBaseCode}.json`).then(r => r.json());
        analiticoCompleto = sinapiAnalitico.concat(scoAnalitico);
    } catch(e) { console.warn("Aviso: Falha ao recarregar bases analíticas.", e); }

    const { listaEtapas, mapaPorId: subtotaisEtapas } = window.calcularSubtotaisPorEtapa(window.appState.orcamento, estado, tabela, bdi, bdiDif);

    let totalGeralObra = 0;
    let subtotalGeralSemBdi = 0;
    let valorBdiPadraoGeral = 0;
    let valorBdiDifGeral = 0;
    let temItemComBdiDif = false;
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa') {
            const precoUnBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
            const bdiItem = window.obterBdiDoItem(item, bdi, bdiDif);
            const { subtotalSemBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnBruto, item.qtd, bdiItem);
            const parcBdi = window.arredondarMoeda(totalComBdi - subtotalSemBdi);
            totalGeralObra = window.arredondarMoeda(totalGeralObra + totalComBdi);
            subtotalGeralSemBdi = window.arredondarMoeda(subtotalGeralSemBdi + subtotalSemBdi);
            if (item.usarBdiDiferenciado) {
                temItemComBdiDif = true;
                valorBdiDifGeral = window.arredondarMoeda(valorBdiDifGeral + parcBdi);
            } else {
                valorBdiPadraoGeral = window.arredondarMoeda(valorBdiPadraoGeral + parcBdi);
            }
        }
    });

    // ============================================================================
    // ABA 1: RESUMO DO ORÇAMENTO
    // ============================================================================
    const wsResumo = workbook.addWorksheet('Resumo');
    wsResumo.columns = [ { key: 'eap', width: 15 }, { key: 'descricao', width: 75 }, { key: 'total', width: 30, style: { numFmt: '"R$ "#,##0.00' } } ];

    wsResumo.mergeCells('A1:C1');
    wsResumo.getCell('A1').value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    wsResumo.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    wsResumo.getCell('A1').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsResumo.getRow(1).height = 110; 
    adicionarImagensCabecalhoINCA(wsResumo, 3);

    wsResumo.mergeCells('A2:C2');
    wsResumo.getCell('A2').value = "RESUMO FINANCEIRO POR ETAPA";
    wsResumo.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    wsResumo.getCell('A2').font = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    wsResumo.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    wsResumo.getRow(2).height = 25;

    wsResumo.mergeCells('A3:B3'); wsResumo.getCell('A3').value = `PROJETO: ${nomeObra}`; wsResumo.getCell('C3').value = `PROCESSO: ${processo}`;
    wsResumo.mergeCells('A4:B4'); wsResumo.getCell('A4').value = `LOCAL: ${local}`; wsResumo.getCell('C4').value = `DATA-BASE: ${dataBaseRef}`;
    wsResumo.mergeCells('A5:B5'); wsResumo.getCell('A5').value = `ORÇAMENTISTA: ${dadosOrc.nome || 'NÃO INFORMADO'}${dadosOrc.registro ? ' (' + dadosOrc.registro + ')' : ''}`; wsResumo.getCell('C5').value = `ART/RRT: ${dadosOrc.art}`;
    
    for (let i = 2; i <= 5; i++) { wsResumo.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderResumo = wsResumo.getRow(7);
    rowHeaderResumo.values = ['ITEM EAP', 'DESCRIÇÃO DA ETAPA', 'PREÇO TOTAL (R$)'];
    rowHeaderResumo.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });

    listaEtapas.forEach(etapa => {
        const row = wsResumo.addRow([etapa.eap, etapa.descricao, etapa.totalComBdi]);
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
    adicionarBlocoAssinaturaExcel(wsResumo, 3);

    // ============================================================================
    // ABA 2: ORÇAMENTO SINTÉTICO
    // ============================================================================
    const wsSintetico = workbook.addWorksheet('Orçamento Sintético');
    wsSintetico.columns = [
        { key: 'eap', width: 12 }, { key: 'tipo', width: 18 }, { key: 'codigo', width: 18 }, { key: 'descricao', width: 64 }, { key: 'unidade', width: 10 }, { key: 'qtd', width: 15, style: { numFmt: '#,##0.000' } },
        { key: 'precoUn', width: 20, style: { numFmt: '"R$ "#,##0.00' } }, { key: 'precoBdi', width: 20, style: { numFmt: '"R$ "#,##0.00' } }, { key: 'total', width: 20, style: { numFmt: '"R$ "#,##0.00' } }
    ];

    wsSintetico.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsSintetico.mergeCells('A1:I1');
    const cellInstSint = wsSintetico.getCell('A1');
    cellInstSint.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstSint.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstSint.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsSintetico.getRow(1).height = 110; 
    adicionarImagensCabecalhoINCA(wsSintetico, 9);

    wsSintetico.mergeCells('A2:I2');
    const cellTituloSint = wsSintetico.getCell('A2');
    cellTituloSint.value = "PLANILHA DE ORÇAMENTOS DE PROJETOS E OBRAS - SINTÉTICA";
    cellTituloSint.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloSint.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloSint.alignment = { horizontal: 'center', vertical: 'middle' };

    wsSintetico.mergeCells('A3:E3'); wsSintetico.mergeCells('F3:I3');
    wsSintetico.getCell('A3').value = `PROJETO: ${nomeObra}`; wsSintetico.getCell('F3').value = `PROCESSO: ${processo}`;
    wsSintetico.mergeCells('A4:E4'); wsSintetico.mergeCells('F4:I4');
    wsSintetico.getCell('A4').value = `LOCAL: ${local}`; wsSintetico.getCell('F4').value = textoArtHeader;

    wsSintetico.mergeCells('A5:D5');
    wsSintetico.getCell('A5').value = `NOME DA OBRA: ${nomeObra}`;
    wsSintetico.getCell('E5').value = "BDI"; wsSintetico.getCell('F5').value = "BDI DIF."; wsSintetico.getCell('G5').value = "REGIME TRIBUTÁRIO"; wsSintetico.getCell('H5').value = "DATA-BASE"; wsSintetico.getCell('I5').value = "REVISÃO";
    
    wsSintetico.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if(colNumber >= 5) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    });

    wsSintetico.mergeCells('A6:D6');
    wsSintetico.getCell('A6').value = `BASE DE DADOS: ${basesUtilizadas}`; wsSintetico.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsSintetico.getCell('E6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsSintetico.getCell('F6').value = `${bdiDif.toFixed(2).replace('.', ',')}%`; wsSintetico.getCell('G6').value = regimeTributario; wsSintetico.getCell('H6').value = dataBaseRef; wsSintetico.getCell('I6').value = revisao;
    
    wsSintetico.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if(colNumber >= 5) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

    for (let i = 2; i <= 6; i++) { wsSintetico.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderCols = wsSintetico.getRow(8);
    rowHeaderCols.values = ['ITEM', 'TIPO', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'QUANTIDADE', 'CUSTO UNITÁRIO (R$)', 'PREÇO UNIT c/ BDI (R$)', 'PREÇO TOTAL (R$)'];
    rowHeaderCols.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    rowHeaderCols.height = 30;

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            const dadosEtapa = subtotaisEtapas[item.id] || { totalComBdi: 0 };
            const row = wsSintetico.addRow({ eap: item.itemEap, tipo: 'ETAPA', codigo: '', descricao: item.descricao, total: dadosEtapa.totalComBdi });
            wsSintetico.mergeCells(`D${row.number}:H${row.number}`);
            row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoEtapa } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(9).numFmt = '"R$ "#,##0.00';
            row.height = calcularAlturaLinhaExcel([[item.descricao, 95]], 24, 15);
        } else {
            const precoUnBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
            const bdiItem = window.obterBdiDoItem(item, bdi, bdiDif);
            const { precoUn, precoComBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnBruto, item.qtd, bdiItem);
            const temMem = Boolean(item.memoria && item.memoria !== '-');
            const tagBdiDif = item.usarBdiDiferenciado ? ` [BDI Dif.: ${bdiDif.toFixed(2).replace('.', ',')}%]` : '';
            const memTexto = temMem ? `\n[Memória de Cálculo: ${item.memoria}]` : '';
            const textoDescCompleto = item.descricao + tagBdiDif + memTexto;
            const tipoFormatado = formatarTipoExcel(item.tipo);
            const row = wsSintetico.addRow({ eap: item.itemEap, tipo: tipoFormatado, codigo: item.codigo, descricao: textoDescCompleto, unidade: item.unidade, qtd: parseFloat(item.qtd), precoUn: precoUn, precoBdi: precoComBdi, total: totalComBdi });
            row.height = calcularAlturaLinhaExcel([
                [textoDescCompleto, 52],
                [item.codigo, 15],
                [tipoFormatado, 15]
            ], 24, 15);
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
            row.getCell(1).font = { bold: true }; row.getCell(9).font = { bold: true };
        }
    });

    const blankRowSint = wsSintetico.addRow([]);
    const rowSub = wsSintetico.addRow(['', '', '', '', '', '', '', '', subtotalGeralSemBdi]);
    wsSintetico.mergeCells(`A${rowSub.number}:H${rowSub.number}`); rowSub.getCell(1).value = 'Subtotal (Sem BDI):'; rowSub.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowSub.getCell(1).font = { bold: true }; rowSub.getCell(9).font = { bold: true }; rowSub.getCell(9).numFmt = '"R$ "#,##0.00';
    
    const rowBdi1 = wsSintetico.addRow(['', '', '', '', '', '', '', '', valorBdiPadraoGeral]);
    wsSintetico.mergeCells(`A${rowBdi1.number}:H${rowBdi1.number}`); rowBdi1.getCell(1).value = `Valor do BDI Padrão (${bdi.toFixed(2).replace('.', ',')}%):`; rowBdi1.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowBdi1.getCell(1).font = { bold: true }; rowBdi1.getCell(9).font = { bold: true }; rowBdi1.getCell(9).numFmt = '"R$ "#,##0.00';

    if (temItemComBdiDif) {
        const rowBdiDif = wsSintetico.addRow(['', '', '', '', '', '', '', '', valorBdiDifGeral]);
        wsSintetico.mergeCells(`A${rowBdiDif.number}:H${rowBdiDif.number}`); rowBdiDif.getCell(1).value = `Valor do BDI Diferenciado — Súmula 253 TCU (${bdiDif.toFixed(2).replace('.', ',')}%):`; rowBdiDif.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowBdiDif.getCell(1).font = { bold: true, color: { argb: 'FFB45309' } }; rowBdiDif.getCell(9).font = { bold: true, color: { argb: 'FFB45309' } }; rowBdiDif.getCell(9).numFmt = '"R$ "#,##0.00';
    }
    
    const rowTotal1 = wsSintetico.addRow(['', '', '', '', '', '', '', '', totalGeralObra]);
    wsSintetico.mergeCells(`A${rowTotal1.number}:H${rowTotal1.number}`); rowTotal1.getCell(1).value = 'TOTAL DO ORÇAMENTO:'; rowTotal1.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' }; rowTotal1.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; rowTotal1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; rowTotal1.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } }; rowTotal1.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; rowTotal1.getCell(9).numFmt = '"R$ "#,##0.00';

    wsSintetico.eachRow((row, rowNumber) => { if(rowNumber >= 8 && row.number !== blankRowSint.number) { row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } }; }); } });
    adicionarBlocoAssinaturaExcel(wsSintetico, 9);

    // ============================================================================
    // ABA 3: MEMÓRIA DE CÁLCULO DE QUANTITATIVOS
    // ============================================================================
    const wsMemoria = workbook.addWorksheet('Memória de Cálculo');
    wsMemoria.columns = [
        { key: 'eap', width: 12 },
        { key: 'codigo', width: 18 },
        { key: 'descricao', width: 54 },
        { key: 'unidade', width: 10 },
        { key: 'demonstrativo', width: 58 },
        { key: 'qtd', width: 18, style: { numFmt: '#,##0.000' } }
    ];
    wsMemoria.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };
    wsMemoria.getColumn('demonstrativo').alignment = { wrapText: true, vertical: 'middle' };

    wsMemoria.mergeCells('A1:F1');
    const cellInstMem = wsMemoria.getCell('A1');
    cellInstMem.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstMem.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstMem.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsMemoria.getRow(1).height = 110;
    adicionarImagensCabecalhoINCA(wsMemoria, 6);

    wsMemoria.mergeCells('A2:F2');
    const cellTitMem = wsMemoria.getCell('A2');
    cellTitMem.value = "MEMÓRIA DE CÁLCULO E DEMONSTRATIVO DE QUANTITATIVOS";
    cellTitMem.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTitMem.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTitMem.alignment = { horizontal: 'center', vertical: 'middle' };

    wsMemoria.mergeCells('A3:D3'); wsMemoria.mergeCells('E3:F3');
    wsMemoria.getCell('A3').value = `PROJETO: ${nomeObra}`; wsMemoria.getCell('E3').value = `PROCESSO: ${processo}`;
    wsMemoria.mergeCells('A4:D4'); wsMemoria.mergeCells('E4:F4');
    wsMemoria.getCell('A4').value = `LOCAL: ${local}`; wsMemoria.getCell('E4').value = textoArtHeader;
    for (let i = 2; i <= 4; i++) {
        wsMemoria.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
            cell.font = cell.font || { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
            cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
        });
    }

    wsMemoria.addRow([]);
    const rowHeaderMem = wsMemoria.getRow(6);
    rowHeaderMem.values = ['ITEM EAP', 'CÓDIGO', 'DESCRIÇÃO DO SERVIÇO', 'UNID.', 'DEMONSTRATIVO / FÓRMULA DA MEMÓRIA DE CÁLCULO', 'QUANTIDADE TOTAL'];
    rowHeaderMem.height = 28;
    rowHeaderMem.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    window.appState.orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            const rEt = wsMemoria.addRow({ eap: item.itemEap, codigo: 'ETAPA', descricao: item.descricao, unidade: '', demonstrativo: '', qtd: null });
            wsMemoria.mergeCells(`C${rEt.number}:F${rEt.number}`);
            rEt.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoEtapa } };
                cell.font = { bold: true, color: { argb: corCinzaINCA } };
            });
            rEt.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            rEt.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
            const temMem = Boolean(item.memoria && item.memoria !== '-');
            let textoDemonstrativo = 'Quantidade informada diretamente';
            let qtdLinhas = 1;

            if (temMem) {
                const linhasRaw = String(item.memoria).split('\n').map(l => l.trim()).filter(Boolean);
                qtdLinhas = linhasRaw.length;
                if (linhasRaw.length > 1 && typeof window.resolverFormulaLinhaMemoria === 'function') {
                    textoDemonstrativo = linhasRaw.map(l => {
                        const valParcial = window.resolverFormulaLinhaMemoria(l);
                        const sufixo = (!isNaN(valParcial) && isFinite(valParcial))
                            ? `  ➔  Parcial = ${valParcial.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${item.unidade || ''}`
                            : '';
                        return `${l}${sufixo}`;
                    }).join('\n');
                } else {
                    textoDemonstrativo = String(item.memoria);
                }
            }

            const rSrv = wsMemoria.addRow({
                eap: item.itemEap,
                codigo: item.codigo,
                descricao: item.descricao,
                unidade: item.unidade,
                demonstrativo: textoDemonstrativo,
                qtd: parseFloat(item.qtd) || 0
            });
            rSrv.height = calcularAlturaLinhaExcel([
                [item.descricao, 44],
                [textoDemonstrativo, 48],
                [item.codigo, 15]
            ], 24, 15);
            rSrv.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            rSrv.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            rSrv.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            rSrv.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            rSrv.getCell(5).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            rSrv.getCell(6).font = { bold: true };
            if (temMem) {
                rSrv.getCell(5).font = { bold: true, color: { argb: 'FF1E3A8A' } };
            } else {
                rSrv.getCell(5).font = { italic: true, color: { argb: 'FF64748B' } };
            }
        }
    });

    wsMemoria.eachRow((row, rowNumber) => {
        if (rowNumber >= 6) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
            });
        }
    });
    adicionarBlocoAssinaturaExcel(wsMemoria, 6);

    // ============================================================================
    // ABA 4: ORÇAMENTO ANALÍTICO
    // ============================================================================
    const wsAnalitico = workbook.addWorksheet('Orçamento Analítico');
    wsAnalitico.columns = [
        { header: 'EAP / Código', key: 'codigo', width: 22 }, { header: 'Tipo', key: 'tipo', width: 18 }, { header: 'Descrição', key: 'descricao', width: 75 },
        { header: 'Und', key: 'unidade', width: 8 }, { header: 'Coeficiente', key: 'coeficiente', width: 18, style: { numFmt: '#,##0.0000000' } },
        { header: 'Custo Un. Direto (R$)', key: 'custoUn', width: 22, style: { numFmt: '"R$ "#,##0.00' } }, { header: 'Custo Total Direto (R$)', key: 'custoTotal', width: 22, style: { numFmt: '"R$ "#,##0.00' } }
    ];

    wsAnalitico.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsAnalitico.mergeCells('A1:G1');
    const cellInstAnalitico = wsAnalitico.getCell('A1');
    cellInstAnalitico.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstAnalitico.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstAnalitico.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAnalitico.getRow(1).height = 110; 
    adicionarImagensCabecalhoINCA(wsAnalitico, 7);

    wsAnalitico.mergeCells('A2:G2');
    const cellTituloAnalitico = wsAnalitico.getCell('A2');
    cellTituloAnalitico.value = "PLANILHA DE ORÇAMENTOS DE PROJETOS E OBRAS - ANALÍTICA";
    cellTituloAnalitico.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloAnalitico.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloAnalitico.alignment = { horizontal: 'center', vertical: 'middle' };

    wsAnalitico.mergeCells('A3:D3'); wsAnalitico.mergeCells('E3:G3');
    wsAnalitico.getCell('A3').value = `PROJETO: ${nomeObra}`; wsAnalitico.getCell('E3').value = `PROCESSO: ${processo}`;
    wsAnalitico.mergeCells('A4:D4'); wsAnalitico.mergeCells('E4:G4');
    wsAnalitico.getCell('A4').value = `LOCAL: ${local}`; wsAnalitico.getCell('E4').value = textoArtHeader;

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
    rowHeaderAnalitico.values = ['EAP / CÓDIGO', 'TIPO', 'DESCRIÇÃO', 'UND', 'COEFICIENTE', 'CUSTO UN. DIRETO (R$)', 'CUSTO TOTAL DIRETO (R$)'];
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
            row.height = calcularAlturaLinhaExcel([[item.descricao, 95]], 24, 15);
            row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundoEtapa } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; cell.alignment = { vertical: 'middle', wrapText: true }; });
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
            const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
            const codSrv = `[${item.itemEap}] ${item.codigo}`;
            const rowSrv = wsAnalitico.addRow({ codigo: codSrv, tipo: 'SERVIÇO', descricao: item.descricao, unidade: item.unidade, coeficiente: 1, custoUn: precoUn, custoTotal: precoUn });
            rowSrv.height = calcularAlturaLinhaExcel([[item.descricao, 62], [codSrv, 18]], 24, 15);
            rowSrv.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.font = { bold: true, color: { argb: corCinzaINCA } }; cell.border = { top: { style: 'thin', color: { argb: corBorda} }, bottom: { style: 'thin', color: { argb: corBorda} } }; });
            rowSrv.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            rowSrv.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            rowSrv.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            rowSrv.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

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

                    let custoIng = ing.precoUnitario || ing['Preço Unitário (R$)'];
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

                        let percentual = tabelaPercentuaisEVE[String(ingObj.codigoItem).trim()] || ingObj.custoIng || 0;

                        ingObj.custoTotalCalculado = ingObj.coeficiente * (percentual / 100) * baseDeCalculo;
                        
                        imprimirCustoUn = baseDeCalculo; 
                        ingObj.descricao = `${ingObj.descricao} (Base: R$ ${baseDeCalculo.toFixed(2)} à taxa de ${percentual}%)`;
                    }

                    const rIng = wsAnalitico.addRow({ 
                        codigo: ingObj.codigoItem, 
                        tipo: formatarTipoExcel(ingObj.tipoItem), 
                        descricao: ingObj.descricao, 
                        unidade: ingObj.unidade, 
                        coeficiente: ingObj.coeficiente, 
                        custoUn: imprimirCustoUn, 
                        custoTotal: window.arredondarMoeda(ingObj.custoTotalCalculado) 
                    });
                    rIng.height = calcularAlturaLinhaExcel([[ingObj.descricao, 62], [ingObj.codigoItem, 18]], 20, 14);
                    rIng.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    rIng.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    rIng.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                    rIng.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                });
            } else {
                wsAnalitico.addRow({ codigo: '-', tipo: 'AVISO', descricao: '   [Nenhuma receita detalhada na base]', unidade: '-', coeficiente: 0, custoUn: 0, custoTotal: 0 });
            }
            wsAnalitico.addRow([]);
        }
    });
    adicionarBlocoAssinaturaExcel(wsAnalitico, 7);

    // ============================================================================
    // ABA 5: CURVA ABC DE SERVIÇOS
    // ============================================================================
    const wsAbc = workbook.addWorksheet('Curva ABC de Serviços');
    wsAbc.columns = [
        { header: 'Classe', key: 'classe', width: 10 }, { header: 'Item EAP', key: 'eap', width: 12 }, { header: 'Código', key: 'codigo', width: 18 },
        { header: 'Descrição do Serviço', key: 'descricao', width: 62 }, { header: 'Und', key: 'unidade', width: 8 }, { header: 'Qtd', key: 'qtd', width: 12, style: { numFmt: '#,##0.000' } },
        { header: 'Preço c/ BDI (R$)', key: 'precoBdi', width: 18, style: { numFmt: '"R$ "#,##0.00' } }, { header: 'Custo Total (R$)', key: 'custoTotal', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
        { header: '% Total', key: 'percTotal', width: 12, style: { numFmt: '0.00%' } }, { header: '% Acumulada', key: 'percAcum', width: 14, style: { numFmt: '0.00%' } }
    ];

    wsAbc.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsAbc.mergeCells('A1:J1');
    const cellInstAbc = wsAbc.getCell('A1');
    cellInstAbc.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstAbc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstAbc.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsAbc.getRow(1).height = 110; 
    adicionarImagensCabecalhoINCA(wsAbc, 10);

    wsAbc.mergeCells('A2:J2');
    const cellTituloAbc = wsAbc.getCell('A2');
    cellTituloAbc.value = "CURVA ABC DE SERVIÇOS DO ORÇAMENTO";
    cellTituloAbc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTituloAbc.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTituloAbc.alignment = { horizontal: 'center', vertical: 'middle' };

    wsAbc.mergeCells('A3:E3'); wsAbc.mergeCells('F3:J3');
    wsAbc.getCell('A3').value = `PROJETO: ${nomeObra}`; wsAbc.getCell('F3').value = `PROCESSO: ${processo}`;
    wsAbc.mergeCells('A4:E4'); wsAbc.mergeCells('F4:J4');
    wsAbc.getCell('A4').value = `LOCAL: ${local}`; wsAbc.getCell('F4').value = textoArtHeader;

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
    wsAbc.getCell('F6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsAbc.getCell('G6').value = `${bdiDif.toFixed(2).replace('.', ',')}%`; wsAbc.getCell('H6').value = regimeTributario; wsAbc.getCell('I6').value = dataBaseRef; wsAbc.getCell('J6').value = revisao;
    
    wsAbc.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if(colNumber >= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

    for (let i = 2; i <= 6; i++) { wsAbc.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } }; }); }

    const rowHeaderABC = wsAbc.getRow(8);
    rowHeaderABC.values = ['CLASSE', 'ITEM EAP', 'CÓDIGO', 'DESCRIÇÃO DO SERVIÇO', 'UND', 'QTD', 'PREÇO C/ BDI (R$)', 'CUSTO TOTAL (R$)', '% TOTAL', '% ACUMULADA'];
    rowHeaderABC.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } }; 
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Arial' };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: {argb: corBorda} }, bottom: { style: 'thin', color: {argb: corBorda} }, left: { style: 'thin', color: {argb: corBorda} }, right: { style: 'thin', color: {argb: corBorda} } };
    });
    rowHeaderABC.height = 30;

    let itensABC = window.appState.orcamento.filter(item => item.tipo !== 'etapa').map(item => {
        const precoUnBruto = window.obterPrecoAtualizadoDoItem(item, estado, tabela);
        const bdiItem = window.obterBdiDoItem(item, bdi, bdiDif);
        const { precoComBdi, totalComBdi } = window.calcularValoresItemTCU(precoUnBruto, item.qtd, bdiItem);
        return { ...item, precoComBdi, custoTotal: totalComBdi };
    });

    itensABC.sort((a, b) => b.custoTotal - a.custoTotal);
    let somaTotalABC = window.arredondarMoeda(itensABC.reduce((acc, item) => acc + item.custoTotal, 0));
    let custoAcumuladoABC = 0;

    itensABC.forEach(item => {
        custoAcumuladoABC = window.arredondarMoeda(custoAcumuladoABC + item.custoTotal);
        const percTotal = somaTotalABC > 0 ? (item.custoTotal / somaTotalABC) : 0;
        const percAcum = somaTotalABC > 0 ? (custoAcumuladoABC / somaTotalABC) : 0;
        
        let classeABC = 'A'; let corClasse = 'FFB91C1C'; // Vermelho (Classe A - Alta Prioridade)
        if (percAcum > 0.95) { classeABC = 'C'; corClasse = 'FF15803D'; } // Verde (Classe C)
        else if (percAcum > 0.80) { classeABC = 'B'; corClasse = 'FFB45309'; } // Âmbar (Classe B)

        const row = wsAbc.addRow({ classe: classeABC, eap: item.itemEap, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, qtd: parseFloat(item.qtd), precoBdi: item.precoComBdi, custoTotal: item.custoTotal, percTotal: percTotal, percAcum: percAcum });
        row.height = calcularAlturaLinhaExcel([[item.descricao, 50], [item.codigo, 15]], 22, 14.5);
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; row.getCell(1).font = { bold: true, color: { argb: corClasse } }; row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }; row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }; row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }; });
    });

    wsAbc.addRow([]);
    const rowTotalABC = wsAbc.addRow(['', '', '', 'TOTAL DO ORÇAMENTO (COM BDI):', '', '', '', somaTotalABC, 1, 1]);
    rowTotalABC.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }; rowTotalABC.getCell(4).font = { bold: true, color: { argb: corCinzaINCA } }; rowTotalABC.getCell(8).font = { bold: true, color: { argb: corVermelhoINCA } };
    adicionarBlocoAssinaturaExcel(wsAbc, 10);

    // ============================================================================
    // ABA 6: CURVA ABC DE INSUMOS (MATERIAIS, EQUIPAMENTOS E MÃO DE OBRA)
    // ============================================================================
    if (typeof window.calcularInsumosExplodidos === 'function') {
        const { listaInsumos } = window.calcularInsumosExplodidos(estado, tabela);
        const wsAbcInsumos = workbook.addWorksheet('Curva ABC de Insumos');
        wsAbcInsumos.columns = [
            { header: 'Classe', key: 'classe', width: 10 },
            { header: 'Categoria', key: 'categoria', width: 20 },
            { header: 'Código', key: 'codigo', width: 18 },
            { header: 'Descrição do Insumo', key: 'descricao', width: 60 },
            { header: 'Und', key: 'unidade', width: 8 },
            { header: 'Qtd Total', key: 'qtd', width: 14, style: { numFmt: '#,##0.000' } },
            { header: 'Preço Un. s/ BDI (R$)', key: 'precoUn', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
            { header: 'Custo Total Direto (R$)', key: 'custoTotal', width: 22, style: { numFmt: '"R$ "#,##0.00' } },
            { header: '% Simples', key: 'percTotal', width: 12, style: { numFmt: '0.00%' } },
            { header: '% Acumulada', key: 'percAcum', width: 14, style: { numFmt: '0.00%' } }
        ];
        wsAbcInsumos.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

        wsAbcInsumos.mergeCells('A1:J1');
        const cellInstIns = wsAbcInsumos.getCell('A1');
        cellInstIns.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
        cellInstIns.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cellInstIns.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
        wsAbcInsumos.getRow(1).height = 110;
        adicionarImagensCabecalhoINCA(wsAbcInsumos, 10);

        wsAbcInsumos.mergeCells('A2:J2');
        const cellTitIns = wsAbcInsumos.getCell('A2');
        cellTitIns.value = "CURVA ABC DE INSUMOS DO ORÇAMENTO (MATERIAIS, EQUIPAMENTOS E MÃO DE OBRA)";
        cellTitIns.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cellTitIns.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cellTitIns.alignment = { horizontal: 'center', vertical: 'middle' };

        wsAbcInsumos.mergeCells('A3:E3'); wsAbcInsumos.mergeCells('F3:J3');
        wsAbcInsumos.getCell('A3').value = `PROJETO: ${nomeObra}`; wsAbcInsumos.getCell('F3').value = `PROCESSO: ${processo}`;
        wsAbcInsumos.mergeCells('A4:E4'); wsAbcInsumos.mergeCells('F4:J4');
        wsAbcInsumos.getCell('A4').value = `LOCAL: ${local}`; wsAbcInsumos.getCell('F4').value = textoArtHeader;

        wsAbcInsumos.mergeCells('A5:E5');
        wsAbcInsumos.getCell('A5').value = `NOME DA OBRA: ${nomeObra}`;
        wsAbcInsumos.getCell('F5').value = "BDI"; wsAbcInsumos.getCell('G5').value = "BDI DIF."; wsAbcInsumos.getCell('H5').value = "REGIME TRIBUTÁRIO"; wsAbcInsumos.getCell('I5').value = "DATA-BASE"; wsAbcInsumos.getCell('J5').value = "REVISÃO";
        wsAbcInsumos.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (colNumber >= 6) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
            cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
        });

        wsAbcInsumos.mergeCells('A6:E6');
        wsAbcInsumos.getCell('A6').value = `BASE DE DADOS: ${basesUtilizadas}`; wsAbcInsumos.getCell('A6').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
        wsAbcInsumos.getCell('F6').value = `${bdi.toFixed(2).replace('.', ',')}%`; wsAbcInsumos.getCell('G6').value = `${bdiDif.toFixed(2).replace('.', ',')}%`; wsAbcInsumos.getCell('H6').value = regimeTributario; wsAbcInsumos.getCell('I6').value = dataBaseRef; wsAbcInsumos.getCell('J6').value = revisao;
        wsAbcInsumos.getRow(6).eachCell({ includeEmpty: true }, (cell, colNumber) => { if (colNumber >= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' }; });

        for (let i = 2; i <= 6; i++) { wsAbcInsumos.getRow(i).eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } }; }); }

        const rowHeaderIns = wsAbcInsumos.getRow(8);
        rowHeaderIns.values = ['CLASSE', 'CATEGORIA', 'CÓDIGO', 'DESCRIÇÃO DO INSUMO', 'UND', 'QTD TOTAL', 'PREÇO UN. S/ BDI (R$)', 'CUSTO TOTAL DIRETO (R$)', '% SIMPLES', '% ACUMULADA'];
        rowHeaderIns.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 9, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
        });
        rowHeaderIns.height = 30;

        const somaTotalIns = window.arredondarMoeda(listaInsumos.reduce((acc, i) => acc + (parseFloat(i.custoTotal) || 0), 0));
        let custoAcumIns = 0;

        listaInsumos.forEach(ins => {
            custoAcumIns = window.arredondarMoeda(custoAcumIns + (parseFloat(ins.custoTotal) || 0));
            const percTotal = somaTotalIns > 0 ? (ins.custoTotal / somaTotalIns) : 0;
            const percAcum = somaTotalIns > 0 ? (custoAcumIns / somaTotalIns) : 0;

            let classeABC = 'A'; let corClasse = 'FFB91C1C';
            if (percAcum > 0.95) { classeABC = 'C'; corClasse = 'FF15803D'; }
            else if (percAcum > 0.80) { classeABC = 'B'; corClasse = 'FFB45309'; }

            const rIns = wsAbcInsumos.addRow({
                classe: classeABC,
                categoria: ins.categoria || 'MATERIAL / SERVIÇO',
                codigo: ins.codigo,
                descricao: ins.descricao,
                unidade: ins.unidade,
                qtd: parseFloat(ins.qtdTotal) || 0,
                precoUn: parseFloat(ins.precoUnitario) || 0,
                custoTotal: parseFloat(ins.custoTotal) || 0,
                percTotal: percTotal,
                percAcum: percAcum
            });
            rIns.height = calcularAlturaLinhaExcel([[ins.descricao, 48], [ins.codigo, 15]], 22, 14.5);
            rIns.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            rIns.getCell(1).font = { bold: true, color: { argb: corClasse } };
            rIns.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            rIns.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            rIns.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            rIns.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            rIns.eachCell({ includeEmpty: true }, (cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } }; });
        });

        wsAbcInsumos.addRow([]);
        const rowTotalIns = wsAbcInsumos.addRow(['', '', '', 'TOTAL DIRETO DOS INSUMOS EXPLODIDOS (SEM BDI):', '', '', '', somaTotalIns, 1, 1]);
        rowTotalIns.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        rowTotalIns.getCell(4).font = { bold: true, color: { argb: corCinzaINCA } };
        rowTotalIns.getCell(8).font = { bold: true, color: { argb: corVermelhoINCA } };
        adicionarBlocoAssinaturaExcel(wsAbcInsumos, 10);
    }

    // ============================================================================
    // ABA 7: COMPOSIÇÃO ANALÍTICA DO BDI (ACÓRDÃO 2622/2013 - TCU)
    // ============================================================================
    const wsBdi = workbook.addWorksheet('Composição do BDI');
    wsBdi.columns = [
        { key: 'parcela', width: 48 },
        { key: 'referencia', width: 34 },
        { key: 'padrao', width: 22 },
        { key: 'diferenciado', width: 24 }
    ];

    wsBdi.mergeCells('A1:D1');
    const cellInstBdi = wsBdi.getCell('A1');
    cellInstBdi.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstBdi.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstBdi.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsBdi.getRow(1).height = 110;
    adicionarImagensCabecalhoINCA(wsBdi, 4);

    wsBdi.mergeCells('A2:D2');
    const cellTitBdi = wsBdi.getCell('A2');
    cellTitBdi.value = "DEMONSTRATIVO DA COMPOSIÇÃO ANALÍTICA DO BDI (ACÓRDÃO 2622/2013 - TCU)";
    cellTitBdi.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
    cellTitBdi.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cellTitBdi.alignment = { horizontal: 'center', vertical: 'middle' };

    wsBdi.mergeCells('A3:B3'); wsBdi.mergeCells('C3:D3');
    wsBdi.getCell('A3').value = `PROJETO: ${nomeObra}`; wsBdi.getCell('C3').value = `PROCESSO: ${processo}`;
    wsBdi.mergeCells('A4:B4'); wsBdi.mergeCells('C4:D4');
    wsBdi.getCell('A4').value = `REGIME TRIBUTÁRIO: ${regimeTributario}`; wsBdi.getCell('C4').value = textoArtHeader;
    for (let i = 2; i <= 4; i++) {
        wsBdi.getRow(i).eachCell({ includeEmpty: true }, (cell) => {
            cell.font = cell.font || { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
            cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
        });
    }

    wsBdi.addRow([]);
    const rowHeaderBdi = wsBdi.getRow(6);
    rowHeaderBdi.values = ['PARCELA / COMPONENTE DO BDI', 'INTERVALOS DE REFERÊNCIA (ACÓRDÃO 2622/2013 TCU)', 'BDI PADRÃO (OBRAS E SERVIÇOS)', 'BDI DIFERENCIADO (EQUIPAMENTOS - SÚMULA 253)'];
    rowHeaderBdi.height = 28;
    rowHeaderBdi.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const compBdi = window.appState.composicaoBdi || {
        padrao: { ac: 4.00, sg: 0.80, r: 1.27, df: 1.23, l: 7.40, pis: 0.65, cofins: 3.00, iss: 2.00, cprb: 0.00 },
        diferenciado: { ac: 3.00, sg: 0.48, r: 0.85, df: 0.85, l: 5.11, pis: 0.65, cofins: 3.00, iss: 0.00, cprb: 0.00 }
    };

    const linhasParcelasBdi = [
        ['AC — Administração Central', 'Obras: 3,00% a 5,50% | Equip.: 1,50% a 4,49%', compBdi.padrao.ac, compBdi.diferenciado.ac],
        ['S + G — Seguro e Garantia', 'Obras: 0,80% a 1,00% | Equip.: 0,30% a 0,82%', compBdi.padrao.sg, compBdi.diferenciado.sg],
        ['R — Riscos e Imprevistos', 'Obras: 0,97% a 1,27% | Equip.: 0,56% a 0,89%', compBdi.padrao.r, compBdi.diferenciado.r],
        ['DF — Despesas Financeiras', 'Obras: 0,59% a 1,39% | Equip.: 0,85% a 1,11%', compBdi.padrao.df, compBdi.diferenciado.df],
        ['L — Lucro Bruto', 'Obras: 6,16% a 8,96% | Equip.: 3,50% a 6,22%', compBdi.padrao.l, compBdi.diferenciado.l],
        ['PIS — Programa de Integração Social', 'Alíquota Federal Padrão: 0,65%', compBdi.padrao.pis, compBdi.diferenciado.pis],
        ['COFINS — Contribuição p/ Seguridade Social', 'Alíquota Federal Padrão: 3,00%', compBdi.padrao.cofins, compBdi.diferenciado.cofins],
        ['ISS — Imposto Sobre Serviços (Base Municipal)', 'Obras: 2,00% a 5,00% | Fornec. Equip.: 0,00%', compBdi.padrao.iss, compBdi.diferenciado.iss],
        ['CPRB — Contribuição Previdenciária s/ Receita Bruta', '0,00% (Não Desonerado) ou 4,50% (Desonerado)', compBdi.padrao.cprb, compBdi.diferenciado.cprb]
    ];

    linhasParcelasBdi.forEach(([nomeP, refTcu, valPad, valDif]) => {
        const r = wsBdi.addRow([
            nomeP,
            refTcu,
            `${(parseFloat(valPad) || 0).toFixed(2).replace('.', ',')}%`,
            `${(parseFloat(valDif) || 0).toFixed(2).replace('.', ',')}%`
        ]);
        r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).font = { bold: true };
        r.getCell(4).font = { bold: true, color: { argb: 'FFB45309' } };
    });

    const rForm = wsBdi.addRow([
        'FÓRMULA OFICIAL TCU (ACÓRDÃO 2622/2013):',
        'BDI = [((1 + AC + S + G + R) × (1 + DF) × (1 + L)) ÷ (1 - Tributos)] - 1',
        '',
        ''
    ]);
    wsBdi.mergeCells(`B${rForm.number}:D${rForm.number}`);
    rForm.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.font = { italic: true, bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    });

    const rFinalBdi = wsBdi.addRow([
        'TAXA DE BDI ADOTADA NO ORÇAMENTO:',
        'Conforme Súmula 253 e Acórdão 2622/2013 - TCU',
        `${bdi.toFixed(2).replace('.', ',')}%`,
        `${bdiDif.toFixed(2).replace('.', ',')}%`
    ]);
    rFinalBdi.height = 24;
    rFinalBdi.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    });
    rFinalBdi.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    rFinalBdi.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    rFinalBdi.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    wsBdi.eachRow((row, rowNumber) => {
        if (rowNumber >= 6) {
            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
            });
        }
    });
    adicionarBlocoAssinaturaExcel(wsBdi, 4);

    // ============================================================================
    // ABA 8: MAPA DE COTAÇÕES (TCU)
    // ============================================================================
    const wsCotacoes = workbook.addWorksheet('Mapa de Cotações');

    wsCotacoes.columns = [
        { key: 'eap', width: 12 },
        { key: 'codigo', width: 18 },
        { key: 'descricao', width: 52 },
        { key: 'unidade', width: 10 },
        { key: 'precoAdotado', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
        { key: 'justificativa', width: 72 }
    ];

    wsCotacoes.getColumn('justificativa').alignment = { wrapText: true, vertical: 'middle' };
    wsCotacoes.getColumn('descricao').alignment = { wrapText: true, vertical: 'middle' };

    wsCotacoes.mergeCells('A1:F1');
    const cellInstCot = wsCotacoes.getCell('A1');
    cellInstCot.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
    cellInstCot.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cellInstCot.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
    wsCotacoes.getRow(1).height = 110; 
    adicionarImagensCabecalhoINCA(wsCotacoes, 6);

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
    wsCotacoes.getCell('C4').value = `${local} | Processo SEI: ${processo} | ${textoArtHeader}`;

    [3, 4].forEach(rowIndex => {
        wsCotacoes.getRow(rowIndex).eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
            cell.alignment = { vertical: 'middle' };
        });
    });

    wsCotacoes.addRow([]);

    const rowHeaderCot = wsCotacoes.getRow(6);
    rowHeaderCot.values = ['EAP', 'CÓDIGO', 'DESCRIÇÃO DO INSUMO (COTAÇÃO)', 'UNID', 'PREÇO ESTATÍSTICO (R$)', 'JUSTIFICATIVA E FONTES DE PESQUISA (LEI 14.133)'];
    rowHeaderCot.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
        cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: {style:'thin', color:{argb:corBorda}}, left: {style:'thin', color:{argb:corBorda}}, bottom: {style:'thin', color:{argb:corBorda}}, right: {style:'thin', color:{argb:corBorda}} };
    });
    rowHeaderCot.height = 30;

    let qtdCotacoes = 0;

    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa') {
            if (item.justificativa) {
                qtdCotacoes++;
                const precoUn = window.arredondarMoeda(window.obterPrecoAtualizadoDoItem(item, estado, tabela));
                const row = wsCotacoes.addRow({ eap: item.itemEap, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, precoAdotado: precoUn, justificativa: item.justificativa });
                row.height = calcularAlturaLinhaExcel([[item.descricao, 42], [item.justificativa, 58]], 24, 15);
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
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
                        const descIng = `[Dentro de: ${item.codigo}] ${ing.descricao}`;
                        const row = wsCotacoes.addRow({ eap: item.itemEap, codigo: ing.codigoItem, descricao: descIng, unidade: ing.unidade, precoAdotado: ing.precoUnitario, justificativa: ing.justificativa });
                        row.height = calcularAlturaLinhaExcel([[descIng, 42], [ing.justificativa, 58]], 24, 15);
                        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
                        row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
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
    adicionarBlocoAssinaturaExcel(wsCotacoes, 6);

    // ============================================================================
    // ABA 9: CRONOGRAMA FÍSICO-FINANCEIRO (PADRÃO TCU / LEI 14.133)
    // ============================================================================
    if (typeof window.calcularDadosFisicoFinanceiro === 'function') {
        const periodicidadeFF = window.appState.ffPeriodicidade || 'mensal_30d';
        const dadosFF = window.calcularDadosFisicoFinanceiro(periodicidadeFF);
        if (dadosFF && dadosFF.periodos && dadosFF.periodos.length > 0) {
            const wsCrono = workbook.addWorksheet('Cronograma Físico-Financeiro', { views: [{ showGridLines: true }] });
            const totalColsFF = 4 + dadosFF.periodos.length;

            let colsDef = [
                { key: 'eap', width: 12 },
                { key: 'descricao', width: 48 },
                { key: 'valorTotal', width: 20, style: { numFmt: '"R$ "#,##0.00' } },
                { key: 'peso', width: 12, style: { numFmt: '0.00"%"' } }
            ];
            dadosFF.periodos.forEach((p, idx) => {
                colsDef.push({ key: `per_${idx}`, width: 18, style: { numFmt: '"R$ "#,##0.00' } });
            });
            wsCrono.columns = colsDef;

            wsCrono.mergeCells(1, 1, 1, totalColsFF);
            const cellInstFF = wsCrono.getCell('A1');
            cellInstFF.value = "\n\n\n\nSERVIÇO PÚBLICO FEDERAL\nMINISTÉRIO DA SAÚDE\nINSTITUTO NACIONAL DE CÂNCER - INCA\nDIVISÃO DE ENGENHARIA E INFRAESTRUTURA";
            cellInstFF.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cellInstFF.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };
            wsCrono.getRow(1).height = 110;
            adicionarImagensCabecalhoINCA(wsCrono, totalColsFF);

            wsCrono.mergeCells(2, 1, 2, totalColsFF);
            const cellTitFF = wsCrono.getCell('A2');
            cellTitFF.value = `CRONOGRAMA FÍSICO-FINANCEIRO (${dadosFF.diasCorridosTotais} DIAS CORRIDOS)`;
            cellTitFF.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
            cellTitFF.font = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cellTitFF.alignment = { horizontal: 'center', vertical: 'middle' };

            wsCrono.mergeCells(3, 1, 3, totalColsFF);
            wsCrono.getCell('A3').value = `PROJETO: ${nomeObra} | LOCAL: ${local} | PROCESSO: ${processo} | BDI: ${bdi.toFixed(2).replace('.', ',')}% | BDI DIF.: ${bdiDif.toFixed(2).replace('.', ',')}% | ${textoArtHeader}`;
            wsCrono.getCell('A3').font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };

            wsCrono.addRow([]);

            const headerVals = ['ITEM', 'DESCRIÇÃO DA ETAPA', 'VALOR C/ BDI (R$)', 'PESO (%)', ...dadosFF.periodos.map(p => `${p.titulo.toUpperCase()}\n(${p.subtitulo})`)];
            const rowHeaderFF = wsCrono.getRow(5);
            rowHeaderFF.values = headerVals;
            rowHeaderFF.height = 30;
            rowHeaderFF.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corVermelhoINCA } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });

            dadosFF.etapas.forEach(et => {
                const pesoEt = dadosFF.totalGeralObra > 0 ? (et.valorTotal / dadosFF.totalGeralObra) * 100 : 0;
                const rowValores = [et.itemEap, et.descricao, et.valorTotal, pesoEt, ...et.valoresPeriodo];
                const rVal = wsCrono.addRow(rowValores);
                rVal.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                rVal.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } };

                const rowPercs = ['', '   % Físico da Etapa no Período', '', '', ...et.valoresPeriodo.map(v => et.valorTotal > 0 ? (v / et.valorTotal) * 100 : 0)];
                const rPct = wsCrono.addRow(rowPercs);
                rPct.font = { italic: true, size: 8, name: 'Arial', color: { argb: 'FF475569' } };
                for (let c = 5; c <= totalColsFF; c++) {
                    rPct.getCell(c).numFmt = '0.00"%"';
                }
            });

            const rSimplesR = wsCrono.addRow(['', 'DESEMBOLSO SIMPLES NO PERÍODO (R$)', dadosFF.totalGeralObra, 100, ...dadosFF.totaisSimples]);
            rSimplesR.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: corCinzaINCA } }; });

            const rSimplesP = wsCrono.addRow(['', 'PERCENTUAL SIMPLES NO PERÍODO (%)', '', 100, ...dadosFF.percSimples]);
            rSimplesP.eachCell((cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF0284C7' } };
                if (colNumber >= 4) cell.numFmt = '0.00"%"';
            });

            const rAcumR = wsCrono.addRow(['', 'DESEMBOLSO ACUMULADO — CURVA S (R$)', dadosFF.totalGeralObra, 100, ...dadosFF.totaisAcumulados]);
            rAcumR.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1E3A8A' } }; });

            const rAcumP = wsCrono.addRow(['', 'PERCENTUAL ACUMULADO — CURVA S (%)', '', 100, ...dadosFF.percAcumulados]);
            rAcumP.eachCell((cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF059669' } };
                if (colNumber >= 4) cell.numFmt = '0.00"%"';
            });

            wsCrono.eachRow((row, rowNumber) => {
                if (rowNumber >= 5) {
                    row.eachCell({ includeEmpty: true }, (cell) => {
                        cell.border = { top: { style: 'thin', color: { argb: corBorda } }, left: { style: 'thin', color: { argb: corBorda } }, bottom: { style: 'thin', color: { argb: corBorda } }, right: { style: 'thin', color: { argb: corBorda } } };
                    });
                }
            });
            adicionarBlocoAssinaturaExcel(wsCrono, totalColsFF);
        }
    }

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
