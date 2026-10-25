// ==========================================
// 1. GESTÃO DA TABELA DE CRONOGRAMA
// ==========================================

window.carregarTabelaCronograma = function() {
    const tbody = document.getElementById('tbody-cronograma');
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: var(--danger);">O orçamento está vazio. Adicione itens primeiro.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appState.orcamento.map((item) => {
        if (item.tipo === 'etapa') {
            return `<tr class="row-etapa"><td>${item.itemEap}</td><td colspan="8"><strong>${item.descricao}</strong></td></tr>`;
        }

        if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };
        if (item.cronograma.ritmo === undefined) item.cronograma.ritmo = 100; 
        
        let fatorRitmo = item.cronograma.ritmo / 100;
        let duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (item.cronograma.equipe * fatorRitmo * 8)) : 1;

        let temMatriz = item.cronograma.equipeDefault ? true : false;
        let corBotao = temMatriz ? '#10b981' : '#94a3b8';

        return `
        <tr>
            <td><strong>${item.itemEap}</strong></td>
            <td style="font-size: 0.85rem;">${item.descricao}</td>
            <td class="text-right">
                <input type="number" id="hh-input-${item.id}" min="0" step="0.01" value="${item.cronograma.hh}" style="width: 80px; text-align: right; padding: 4px;" onchange="atualizarCrono(${item.id}, 'hh', this.value)" title="Horas totais do Profissional Chave (Gargalo)">
            </td>
            <td class="text-center" style="white-space: nowrap;">
                <input type="number" min="0.1" step="1" value="${item.cronograma.equipe}" style="width: 50px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'equipe', this.value)" title="Quantidade de Profissionais Chave simultâneos">
                <button onclick="abrirMatrizEquipa(${item.id})" style="background:${corBotao}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="Ver proporção da equipe desta tarefa">👥</button>
            </td>
            <td class="text-center">
                <input type="number" id="ritmo-input-${item.id}" min="1" max="1000" step="5" value="${item.cronograma.ritmo}" style="width: 60px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'ritmo', this.value)" title="Produtividade da equipe (100% = padrão SINAPI/SCO)">
            </td>
            <td class="text-center"><strong id="duracao-${item.id}" style="color: var(--primary); font-size: 1.1rem;">${duracao}</strong></td>
            <td class="text-center">
                <input type="text" placeholder="Ex: 1.1" value="${item.cronograma.predecessora}" title="Inicia após o término desta EAP (use SS:1.1 para iniciar junto)" style="width: 70px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'predecessora', this.value)">
            </td>
            <td class="text-center">
                <input type="text" placeholder="PROJETO" value="${item.cronograma.terminoJunto || ''}" title="Para Adm. Local / Aluguel contínuo: digite PROJETO ou uma EAP para esticar até o fim dela" style="width: 80px; text-align: center; padding: 4px; background: #e0f2fe; border: 1px solid #7dd3fc;" onchange="atualizarCrono(${item.id}, 'terminoJunto', this.value)">
            </td>
            <td class="text-center">
                <input type="number" min="0" value="${item.cronograma.espera}" style="width: 50px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'espera', this.value)" title="Dias corridos de espera/cura após a predecessora">
            </td>
        </tr>
        `;
    }).join('');
    
    if (typeof window.atualizarSelectPrazos === 'function') window.atualizarSelectPrazos();
    if (typeof window.atualizarSelectFabricaIA === 'function') window.atualizarSelectFabricaIA();
};

window.atualizarCrono = function(id, campo, valor) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        if (campo === 'predecessora' || campo === 'terminoJunto') {
            item.cronograma[campo] = valor.trim().toUpperCase();
        } else {
            item.cronograma[campo] = (parseFloat(valor) || 0);
        }
        
        if (campo === 'equipe' && item.cronograma.equipe <= 0) item.cronograma.equipe = 1;
        if (campo === 'ritmo' && item.cronograma.ritmo <= 0) item.cronograma.ritmo = 1;

        if (campo === 'hh' || campo === 'equipe' || campo === 'ritmo') {
            let fatorRitmo = (item.cronograma.ritmo || 100) / 100;
            const duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (parseFloat(item.cronograma.equipe) * fatorRitmo * 8)) : 1;
            const elDur = document.getElementById(`duracao-${id}`);
            if (elDur) elDur.innerText = duracao;
        }
        window.salvarEstadoLocal();
    }
};

// ==========================================
// 2. MOTOR DO GRÁFICO DE GANTT E CAMINHO CRÍTICO
// ==========================================

window.gerarGraficoGantt = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) return;
    
    function proximoDiaUtil(data) {
        let d = new Date(data.getTime());
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        return d;
    }

    // --- INÍCIO DA DEFINIÇÃO DA DATA BASE ---
    let baseDate = new Date(); 
    const inputDataObra = document.getElementById('input-data-inicio-obra');
    
    if (inputDataObra && inputDataObra.value) {
        window.appState.dataInicioObra = inputDataObra.value;
        let partesData = inputDataObra.value.split('-');
        if(partesData.length === 3) {
            baseDate = new Date(partesData[0], partesData[1] - 1, partesData[2]);
        }
    }
    baseDate.setHours(0,0,0,0);
    baseDate = proximoDiaUtil(baseDate); 
    // --- FIM DA DEFINIÇÃO DA DATA BASE ---

    let tarefasValidas = window.appState.orcamento.filter(i => i.tipo !== 'etapa');
    let mapTarefas = {};
    
    // 1. LIMPEZA MATEMÁTICA E PREVENÇÃO DE INFINITOS
    let arrayCalculo = tarefasValidas.map(i => {
        if (!i.cronograma) i.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };
        let fatorRitmo = (i.cronograma && i.cronograma.ritmo !== undefined ? parseFloat(i.cronograma.ritmo) : 100) / 100;
        if (isNaN(fatorRitmo) || fatorRitmo <= 0) fatorRitmo = 1;
        
        let equipe = i.cronograma ? parseFloat(i.cronograma.equipe) : 1;
        if (isNaN(equipe) || equipe <= 0) equipe = 1; // Previne divisão por ZERO!

        let duracaoDias = (i.cronograma && i.cronograma.hh > 0) ? Math.ceil(i.cronograma.hh / (equipe * fatorRitmo * 8)) : 1;
        if (isNaN(duracaoDias) || duracaoDias < 1 || !isFinite(duracaoDias)) duracaoDias = 1;

        let obj = {
            id: String(i.id), eap: i.itemEap, desc: i.descricao, 
            duracaoDias: duracaoDias, 
            predEap: i.cronograma ? i.cronograma.predecessora : '',
            terminoJunto: i.cronograma ? i.cronograma.terminoJunto : '',
            esperaDias: i.cronograma ? parseFloat(i.cronograma.espera) || 0 : 0, 
            start: null, end: null, refItem: i 
        };
        mapTarefas[i.itemEap] = obj;
        return obj;
    });

    // 2. CÁLCULO ELÁSTICO (Datas Críticas)
    let mudou = true; let loops = 0;
    while(mudou && loops < 100) { 
        mudou = false; loops++;
        arrayCalculo.forEach(t => {
            let prevStart = t.start ? new Date(t.start.getTime()) : null;
            let prevEnd = t.end ? new Date(t.end.getTime()) : null;

            let preds = t.predEap ? String(t.predEap).toUpperCase().split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];

            if (preds.length === 0) {
                t.start = new Date(baseDate.getTime()); 
            } else {
                let maxEndDate = new Date(baseDate.getTime());
                let encontrouValida = false;
                let isStartToStartAtivo = false;

                preds.forEach(p => {
                    let isSS = p.startsWith('SS:');
                    let cleanP = isSS ? p.substring(3).trim() : p; 
                    
                    if (mapTarefas[cleanP]) {
                        if (isSS && mapTarefas[cleanP].start) {
                            if (!encontrouValida || mapTarefas[cleanP].start.getTime() > maxEndDate.getTime()) {
                                maxEndDate = new Date(mapTarefas[cleanP].start.getTime());
                                isStartToStartAtivo = true;
                            }
                            encontrouValida = true;
                        } else if (!isSS && mapTarefas[cleanP].end) {
                            if (!encontrouValida || mapTarefas[cleanP].end.getTime() > maxEndDate.getTime()) {
                                maxEndDate = new Date(mapTarefas[cleanP].end.getTime());
                                isStartToStartAtivo = false;
                            }
                            encontrouValida = true;
                        }
                    }
                });

                if (encontrouValida) {
                    let dataComEspera = new Date(maxEndDate.getTime());
                    if (!isStartToStartAtivo) dataComEspera.setDate(dataComEspera.getDate() + 1 + t.esperaDias);
                    else dataComEspera.setDate(dataComEspera.getDate() + t.esperaDias);
                    
                    t.start = proximoDiaUtil(dataComEspera);
                } else {
                    t.start = new Date(baseDate.getTime());
                }
            }
            
            if (t.start) {
                let maxFimVinculado = null;

                if (t.terminoJunto) {
                    let termos = String(t.terminoJunto).trim().toUpperCase();
                    if (termos === 'PROJETO') {
                        let maxGeral = new Date(t.start.getTime());
                        arrayCalculo.forEach(outra => {
                            let outraEhProjeto = outra.terminoJunto && String(outra.terminoJunto).toUpperCase() === 'PROJETO';
                            if (outra.id !== t.id && !outraEhProjeto && outra.end && outra.end.getTime() > maxGeral.getTime()) {
                                maxGeral = new Date(outra.end.getTime());
                            }
                        });
                        maxFimVinculado = maxGeral;
                    } else {
                        let terminos = termos.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                        terminos.forEach(p => {
                            if (mapTarefas[p] && mapTarefas[p].end) {
                                if (!maxFimVinculado || mapTarefas[p].end.getTime() > maxFimVinculado.getTime()) {
                                    maxFimVinculado = new Date(mapTarefas[p].end.getTime());
                                }
                            }
                        });
                    }
                }

                if (maxFimVinculado && maxFimVinculado.getTime() >= t.start.getTime()) {
                    t.end = new Date(maxFimVinculado.getTime());
                    let countDias = 1;
                    let cur = new Date(t.start.getTime());
                    while(cur < t.end) {
                        cur.setDate(cur.getDate() + 1);
                        if (cur.getDay() !== 0 && cur.getDay() !== 6) countDias++;
                    }
                    t.duracaoDias = countDias;
                    
                    if (t.refItem && t.refItem.cronograma) {
                        let equipeFixa = parseFloat(t.refItem.cronograma.equipe) || 1;
                        if (t.refItem.cronograma.hh > 0) {
                            let ritmoCalculado = (t.refItem.cronograma.hh / (t.duracaoDias * 8 * equipeFixa)) * 100;
                            t.refItem.cronograma.ritmo = ritmoCalculado.toFixed(1);
                        } else {
                            let ritmoFat = (parseFloat(t.refItem.cronograma.ritmo) || 100) / 100;
                            t.refItem.cronograma.hh = t.duracaoDias * 8 * equipeFixa * ritmoFat;
                        }
                    }
                } else {
                    let dataFim = new Date(t.start.getTime());
                    let diasUteisAdicionados = 1;
                    while(diasUteisAdicionados < t.duracaoDias) {
                        dataFim.setDate(dataFim.getDate() + 1);
                        if (dataFim.getDay() !== 0 && dataFim.getDay() !== 6) diasUteisAdicionados++;
                    }
                    t.end = dataFim;
                }
            }
            if (!prevStart || prevStart.getTime() !== t.start.getTime() || !prevEnd || prevEnd.getTime() !== t.end.getTime()) mudou = true;
        });
    }

    // 3. ATUALIZA A TELA E O RESUMO DO PRAZO DA OBRA
    let minStartObra = null;
    let maxEndObra = null;
    arrayCalculo.forEach(t => {
        if (t.refItem && t.refItem.cronograma && t.start && t.end) {
            t.refItem.cronograma.dataInicio = t.start;
            t.refItem.cronograma.dataFim = t.end;

            if (!minStartObra || t.start < minStartObra) minStartObra = new Date(t.start.getTime());
            if (!maxEndObra || t.end > maxEndObra) maxEndObra = new Date(t.end.getTime());
            
            if (t.terminoJunto) {
                let inputHh = document.getElementById(`hh-input-${t.refItem.id}`);
                let inputRitmo = document.getElementById(`ritmo-input-${t.refItem.id}`);
                let labelDuracao = document.getElementById(`duracao-${t.refItem.id}`);
                if (inputHh) inputHh.value = Math.ceil(t.refItem.cronograma.hh);
                if (inputRitmo) inputRitmo.value = parseFloat(t.refItem.cronograma.ritmo).toFixed(0);
                if (labelDuracao) labelDuracao.innerText = t.duracaoDias;
            }
        }
    });

    const resumoPrazoEl = document.getElementById('resumo-prazo-obra-card');
    if (resumoPrazoEl && minStartObra && maxEndObra) {
        const diasCorridos = Math.round((maxEndObra.getTime() - minStartObra.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        let diasUteisTotais = 0;
        let dCursor = new Date(minStartObra.getTime());
        while (dCursor <= maxEndObra) {
            if (dCursor.getDay() !== 0 && dCursor.getDay() !== 6) diasUteisTotais++;
            dCursor.setDate(dCursor.getDate() + 1);
        }
        const mesesEstimados = (diasCorridos / 30).toFixed(1).replace('.', ',');
        resumoPrazoEl.style.display = 'flex';
        resumoPrazoEl.innerHTML = `
            <div>📅 <strong>Início:</strong> ${minStartObra.toLocaleDateString('pt-BR')}</div>
            <div>🏁 <strong>Término Previsto:</strong> ${maxEndObra.toLocaleDateString('pt-BR')}</div>
            <div>🛠️ <strong>Dias Úteis:</strong> ${diasUteisTotais} dias</div>
            <div style="color: var(--primary); font-size: 1.05rem;">⏱️ <strong>Prazo Total (Edital/TR):</strong> ${diasCorridos} dias corridos (~${mesesEstimados} meses)</div>
        `;
    }

    window.salvarEstadoLocal();

    // 4. DESENHO DO GOOGLE CHARTS (COM PROTEÇÃO "DATEFIELD")
    const chartDiv = document.getElementById('gantt_chart_div');
    
    // O gráfico SÓ é desenhado se a aba estiver visível (offsetWidth > 0).
    if (chartDiv && chartDiv.offsetWidth > 0) {
        google.charts.load('current', {'packages':['gantt']});
        google.charts.setOnLoadCallback(() => {
            var data = new google.visualization.DataTable();
            data.addColumn('string', 'Task ID');
            data.addColumn('string', 'Task Name');
            data.addColumn('string', 'Resource');
            data.addColumn('date', 'Start Date');
            data.addColumn('date', 'End Date');
            data.addColumn('number', 'Duration');
            data.addColumn('number', 'Percent Complete');
            data.addColumn('string', 'Dependencies');

            let rows = [];
            arrayCalculo.forEach(t => {
                if (!t.start || !t.end) return; 

                let chartEnd = new Date(t.end.getTime());
                chartEnd.setDate(chartEnd.getDate() + 1);

                let dependenciesString = null;
                if (t.predEap) {
                    let predsEapList = String(t.predEap).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                    let validIds = [];
                    predsEapList.forEach(pEap => {
                        let cleanP = pEap.startsWith('SS:') ? pEap.substring(3).trim() : pEap;
                        let predTask = arrayCalculo.find(tk => tk.eap === cleanP);
                        if (predTask) validIds.push(predTask.id);
                    });
                    if (validIds.length > 0) dependenciesString = validIds.join(',');
                }

                if (!isNaN(t.start.getTime()) && !isNaN(chartEnd.getTime())) {
                    rows.push([ t.id, `${t.eap} - ${t.desc.substring(0, 35)}...`, 'Serviços', t.start, chartEnd, null, 0, dependenciesString ]);
                }
            });

            if (rows.length === 0) {
                chartDiv.innerHTML = '<div style="text-align: center; color: #94a3b8; padding-top: 80px;">Sem dados válidos para desenhar o Gantt.</div>';
                return;
            }

            data.addRows(rows);
            var options = { height: (rows.length * 42) + 50, gantt: { trackHeight: 30, labelStyle: { fontName: 'system-ui', fontSize: 12 } } };
            var chart = new google.visualization.Gantt(chartDiv);
            chart.draw(data, options);
        });
    }
};

// ==========================================
// 5. FÁBRICA DE PRAZOS (BANCO LOCAL)
// ==========================================

const limparCodCrono = (cod) => cod ? String(cod).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

window.atualizarSelectPrazos = function() {
    const select = document.getElementById('select-servico-prazo');
    if (!select || !window.appState.orcamento) return;
    
    const valorAtual = select.value;
    
    let html = '<option value="">-- Escolha um serviço (pelo Código) --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa') {
            html += `<option value="${item.codigo}">${item.itemEap} - Cód: ${item.codigo} - ${item.descricao.substring(0, 50)}...</option>`;
        }
    });
    
    select.innerHTML = html;
    if (valorAtual) select.value = valorAtual;
};

window.carregarDadosServicoPrazo = function() {
    const select = document.getElementById('select-servico-prazo');
    const codigoDoItem = select ? select.value : null;
    
    if (!codigoDoItem) {
        document.getElementById('input-turma-prazo').value = '';
        document.getElementById('input-prod-prazo').value = '';
        document.getElementById('input-espera-prazo').value = '0';
        return;
    }
    
    const itemOrcamento = window.appState.orcamento.find(i => i.codigo === codigoDoItem);
    const codLimpo = limparCodCrono(codigoDoItem);
    
    let dadosSalvos = null;
    if (window.appState.baseComposicoesPrazos) {
        dadosSalvos = window.appState.baseComposicoesPrazos[codLimpo] || window.appState.baseComposicoesPrazos[codigoDoItem];
    }
    
    if (dadosSalvos) {
        let descTurma = dadosSalvos.descricaoTurma || dadosSalvos.turma || '';
        if (!descTurma && dadosSalvos.equipeFiscalizacao) {
            descTurma = dadosSalvos.equipeFiscalizacao.map(e => `${e.quantidade} ${e.cargo}`).join(' + ');
        }
        
        document.getElementById('input-turma-prazo').value = descTurma;
        document.getElementById('input-prod-prazo').value = dadosSalvos.producaoDiaria || '';
        let esperaCrono = (itemOrcamento && itemOrcamento.cronograma) ? itemOrcamento.cronograma.espera : 0;
        document.getElementById('input-espera-prazo').value = dadosSalvos.espera !== undefined ? dadosSalvos.espera : esperaCrono;
    } else {
        document.getElementById('input-turma-prazo').value = '';
        document.getElementById('input-prod-prazo').value = '';
        document.getElementById('input-espera-prazo').value = (itemOrcamento && itemOrcamento.cronograma) ? itemOrcamento.cronograma.espera : '0';
    }
};

window.salvarNoBancoPrazos = function() {
    const select = document.getElementById('select-servico-prazo');
    const codigoDoItem = select ? select.value : '';
    if (!codigoDoItem) {
        alert('Por favor, selecione um serviço do orçamento primeiro.');
        return;
    }

    const turma = document.getElementById('input-turma-prazo')?.value.trim() || '';
    const producaoDiaria = parseFloat(document.getElementById('input-prod-prazo')?.value) || 0;
    const espera = parseFloat(document.getElementById('input-espera-prazo')?.value) || 0;

    if (producaoDiaria <= 0) {
        alert('Informe uma Produção/Dia maior que zero.');
        return;
    }

    const codLimpo = limparCodCrono(codigoDoItem);
    if (!window.appState.baseComposicoesPrazos) window.appState.baseComposicoesPrazos = {};

    const anterior = window.appState.baseComposicoesPrazos[codLimpo] || {};
    window.appState.baseComposicoesPrazos[codLimpo] = {
        ...anterior,
        codigo: codigoDoItem,
        descricaoTurma: turma,
        producaoDiaria: producaoDiaria,
        espera: espera
    };

    let aplicados = 0;
    (window.appState.orcamento || []).forEach(item => {
        if (limparCodCrono(item.codigo) === codLimpo || String(item.codigo) === String(codigoDoItem)) {
            if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, ritmo: 100, predecessora: '', terminoJunto: '', espera: 0 };
            const equipe = parseFloat(item.cronograma.equipe) || 1;
            const dias = Math.ceil((parseFloat(item.qtd) || 1) / producaoDiaria);
            item.cronograma.hh = dias * 8 * equipe;
            item.cronograma.espera = espera;
            aplicados++;
        }
    });

    window.carregarTabelaCronograma();
    window.gerarGraficoGantt();
    if (typeof window.gerarCronogramaFisicoFinanceiro === 'function') {
        const contFF = document.getElementById('cronograma-fisico-financeiro-container');
        if (contFF && contFF.style.display !== 'none') window.gerarCronogramaFisicoFinanceiro(false);
    }
    alert(`✅ Produtividade (${producaoDiaria}/dia) e espera (${espera}d) registradas e aplicadas a ${aplicados} item(ns) no cronograma!`);
};

// ==========================================
// 6. CRONOGRAMA FÍSICO-FINANCEIRO E CURVA S (PADRÃO TCU / LEI 14.133)
// ==========================================

window.calcularDadosFisicoFinanceiro = function(periodicidade = 'mensal_30d') {
    const orcamento = window.appState.orcamento || [];
    const servicosValidos = orcamento.filter(i => i.tipo !== 'etapa');
    if (servicosValidos.length === 0) return null;

    // Garante que as datas de início e fim reflitam qualquer alteração recente de HH, Equipe ou Predecessoras
    if (typeof window.gerarGraficoGantt === 'function') {
        window.gerarGraficoGantt();
    }

    const estado = document.getElementById('select-estado')?.value || window.appState.estadoSelecionado || 'RJ';
    const tabela = document.getElementById('select-tabela')?.value || window.appState.regimeSelecionado || 'nao_desonerada';
    const bdiInput = document.getElementById('input-bdi');
    const bdi = bdiInput ? (parseFloat(bdiInput.value) || 0) : (parseFloat(window.appState.bdi) || 0);
    const bdiDifRaw = parseFloat(document.getElementById('input-bdi-dif')?.value);
    const bdiDif = !isNaN(bdiDifRaw) ? bdiDifRaw : bdi;

    // 1. Descobrir intervalo total de datas da obra
    let minStart = null;
    let maxEnd = null;
    servicosValidos.forEach(i => {
        let dIni = i.cronograma && i.cronograma.dataInicio ? new Date(i.cronograma.dataInicio) : new Date();
        let dFim = i.cronograma && i.cronograma.dataFim ? new Date(i.cronograma.dataFim) : new Date(dIni.getTime());
        if (isNaN(dIni.getTime())) dIni = new Date();
        if (isNaN(dFim.getTime())) dFim = new Date(dIni.getTime());
        dIni.setHours(0, 0, 0, 0);
        dFim.setHours(0, 0, 0, 0);
        i.cronograma.dataInicio = dIni;
        i.cronograma.dataFim = dFim;
        if (!minStart || dIni < minStart) minStart = new Date(dIni.getTime());
        if (!maxEnd || dFim > maxEnd) maxEnd = new Date(dFim.getTime());
    });

    if (!minStart || !maxEnd) return null;

    // 2. Construir lista de Períodos (Colunas do Cronograma)
    const msPorDia = 1000 * 60 * 60 * 24;
    const diasCorridosTotais = Math.max(1, Math.round((maxEnd.getTime() - minStart.getTime()) / msPorDia) + 1);
    let periodos = [];

    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    function obterIndicePeriodo(data) {
        const diffDias = Math.max(0, Math.round((data.getTime() - minStart.getTime()) / msPorDia));
        if (periodicidade === 'mensal_calendario') {
            const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            return periodos.findIndex(p => p.chave === chave);
        } else if (periodicidade === 'quinzenal') {
            return Math.min(periodos.length - 1, Math.floor(diffDias / 15));
        } else if (periodicidade === 'semanal') {
            return Math.min(periodos.length - 1, Math.floor(diffDias / 7));
        } else {
            // mensal_30d (Padrão Edital/TR)
            return Math.min(periodos.length - 1, Math.floor(diffDias / 30));
        }
    }

    if (periodicidade === 'mensal_calendario') {
        let cur = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
        let limite = new Date(maxEnd.getFullYear(), maxEnd.getMonth(), 1);
        let idx = 1;
        while (cur <= limite) {
            const chave = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            const label = `${nomesMeses[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`;
            periodos.push({ indice: idx - 1, chave, titulo: `Mês ${idx}`, subtitulo: label });
            cur.setMonth(cur.getMonth() + 1);
            idx++;
        }
    } else {
        const tamanhoBloco = periodicidade === 'quinzenal' ? 15 : (periodicidade === 'semanal' ? 7 : 30);
        const prefixo = periodicidade === 'quinzenal' ? 'Quinz.' : (periodicidade === 'semanal' ? 'Sem.' : 'Mês');
        const qtdPeriodos = Math.max(1, Math.ceil(diasCorridosTotais / tamanhoBloco));
        for (let p = 0; p < qtdPeriodos; p++) {
            const diaIni = p * tamanhoBloco + 1;
            const diaFim = Math.min(diasCorridosTotais, (p + 1) * tamanhoBloco);
            periodos.push({
                indice: p,
                chave: `P${p + 1}`,
                titulo: `${prefixo} ${p + 1}`,
                subtitulo: `Dias ${diaIni} a ${diaFim}`
            });
        }
    }

    const numPeriodos = periodos.length;

    // 3. Organizar Orçamento em Etapas e Serviços e distribuir valores proporcionalmente aos dias úteis
    let etapas = [];
    let etapaAtual = null;
    let servicosSemEtapa = [];
    let totalGeralObra = 0;

    orcamento.forEach(item => {
        if (item.tipo === 'etapa') {
            etapaAtual = {
                id: item.id,
                itemEap: item.itemEap || '',
                descricao: item.descricao || 'ETAPA',
                valorTotal: 0,
                valoresPeriodo: new Array(numPeriodos).fill(0),
                servicos: []
            };
            etapas.push(etapaAtual);
        } else {
            const precoBase = typeof window.obterPrecoAtualizadoDoItem === 'function'
                ? window.obterPrecoAtualizadoDoItem(item, estado, tabela)
                : (parseFloat(item.precoUnitario) || 0);

            const bdiItem = typeof window.obterBdiDoItem === 'function'
                ? window.obterBdiDoItem(item, bdi, bdiDif)
                : bdi;

            const calc = typeof window.calcularValoresItemTCU === 'function'
                ? window.calcularValoresItemTCU(precoBase, item.qtd, bdiItem)
                : { totalComBdi: window.arredondarMoeda(window.arredondarMoeda(precoBase * (1 + bdiItem / 100)) * (parseFloat(item.qtd) || 0)) };

            const valorTotalItem = calc.totalComBdi || 0;
            totalGeralObra = window.arredondarMoeda(totalGeralObra + valorTotalItem);

            // Coleta os dias úteis em que este serviço ocorre
            let diasPorPeriodo = new Array(numPeriodos).fill(0);
            let totalDiasUteisItem = 0;
            let cur = new Date(item.cronograma.dataInicio.getTime());
            const fim = new Date(item.cronograma.dataFim.getTime());

            while (cur <= fim) {
                if (cur.getDay() !== 0 && cur.getDay() !== 6) {
                    const idxP = Math.max(0, obterIndicePeriodo(cur));
                    diasPorPeriodo[idxP]++;
                    totalDiasUteisItem++;
                }
                cur.setDate(cur.getDate() + 1);
            }

            // Fallback de segurança caso uma tarefa de 1 dia caia em fim de semana
            if (totalDiasUteisItem === 0) {
                const idxP = Math.max(0, obterIndicePeriodo(item.cronograma.dataInicio));
                diasPorPeriodo[idxP] = 1;
                totalDiasUteisItem = 1;
            }

            // Distribui o valorTotalItem entre os períodos ativos com ajuste de centavos na última parcela ativa
            let valoresPeriodoItem = new Array(numPeriodos).fill(0);
            let indicesAtivos = [];
            diasPorPeriodo.forEach((d, idx) => { if (d > 0) indicesAtivos.push(idx); });

            let somaParcelas = 0;
            indicesAtivos.forEach((idxP, pos) => {
                if (pos < indicesAtivos.length - 1) {
                    const parcela = window.arredondarMoeda(valorTotalItem * (diasPorPeriodo[idxP] / totalDiasUteisItem));
                    valoresPeriodoItem[idxP] = parcela;
                    somaParcelas = window.arredondarMoeda(somaParcelas + parcela);
                } else {
                    // Último período ativo recebe o saldo exato de centavos para fechar 100,00%
                    valoresPeriodoItem[idxP] = window.arredondarMoeda(valorTotalItem - somaParcelas);
                }
            });

            const objServico = {
                id: item.id,
                itemEap: item.itemEap || '',
                codigo: item.codigo || '-',
                descricao: item.descricao || '',
                valorTotal: valorTotalItem,
                valoresPeriodo: valoresPeriodoItem,
                dataInicio: item.cronograma.dataInicio,
                dataFim: item.cronograma.dataFim
            };

            if (etapaAtual) {
                etapaAtual.servicos.push(objServico);
                etapaAtual.valorTotal = window.arredondarMoeda(etapaAtual.valorTotal + valorTotalItem);
                for (let p = 0; p < numPeriodos; p++) {
                    etapaAtual.valoresPeriodo[p] = window.arredondarMoeda(etapaAtual.valoresPeriodo[p] + valoresPeriodoItem[p]);
                }
            } else {
                servicosSemEtapa.push(objServico);
            }
        }
    });

    if (servicosSemEtapa.length > 0) {
        let etapaGeral = {
            id: 'etapa-geral',
            itemEap: etapas.length > 0 ? '0' : '1',
            descricao: etapas.length > 0 ? 'SERVIÇOS INICIAIS / SEM ETAPA DEFINIDA' : 'SERVIÇOS GERAIS DA OBRA',
            valorTotal: 0,
            valoresPeriodo: new Array(numPeriodos).fill(0),
            servicos: servicosSemEtapa
        };
        servicosSemEtapa.forEach(s => {
            etapaGeral.valorTotal = window.arredondarMoeda(etapaGeral.valorTotal + s.valorTotal);
            for (let p = 0; p < numPeriodos; p++) {
                etapaGeral.valoresPeriodo[p] = window.arredondarMoeda(etapaGeral.valoresPeriodo[p] + s.valoresPeriodo[p]);
            }
        });
        etapas.unshift(etapaGeral);
    }

    // 4. Calcular vetores de rodapé (Desembolso Simples e Acumulado / Curva S)
    let totaisSimples = new Array(numPeriodos).fill(0);
    let percSimples = new Array(numPeriodos).fill(0);
    let totaisAcumulados = new Array(numPeriodos).fill(0);
    let percAcumulados = new Array(numPeriodos).fill(0);

    let acumMoeda = 0;
    for (let p = 0; p < numPeriodos; p++) {
        let somaCol = 0;
        etapas.forEach(et => {
            somaCol = window.arredondarMoeda(somaCol + et.valoresPeriodo[p]);
        });
        totaisSimples[p] = somaCol;
        percSimples[p] = totalGeralObra > 0 ? (somaCol / totalGeralObra) * 100 : 0;

        acumMoeda = window.arredondarMoeda(acumMoeda + somaCol);
        totaisAcumulados[p] = acumMoeda;
        percAcumulados[p] = totalGeralObra > 0 ? (acumMoeda / totalGeralObra) * 100 : 0;
    }

    return {
        periodicidade,
        minStart,
        maxEnd,
        diasCorridosTotais,
        periodos,
        etapas,
        totalGeralObra,
        totaisSimples,
        percSimples,
        totaisAcumulados,
        percAcumulados
    };
};

window.gerarCronogramaFisicoFinanceiro = function(scroll = true) {
    const container = document.getElementById('cronograma-fisico-financeiro-container');
    if (!container) return;

    const selectPer = document.getElementById('select-ff-periodicidade');
    const selectVisao = document.getElementById('select-ff-visao');
    const periodicidade = selectPer ? selectPer.value : (window.appState.ffPeriodicidade || 'mensal_30d');
    const visao = selectVisao ? selectVisao.value : (window.appState.ffVisao || 'sintetico');

    window.appState.ffPeriodicidade = periodicidade;
    window.appState.ffVisao = visao;

    const dados = window.calcularDadosFisicoFinanceiro(periodicidade);
    if (!dados) {
        alert('O orçamento ainda não possui serviços válidos para gerar o Cronograma Físico-Financeiro.');
        return;
    }

    const fmtMoeda = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPerc = (p) => p.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

    // Cabeçalho das colunas de período
    let thPeriodos = dados.periodos.map(p => `
        <th style="padding: 8px 10px; text-align: right; min-width: 125px; background: #1e293b; color: white; border-left: 1px solid #334155;">
            <div style="font-size: 0.85rem; font-weight: 700;">${p.titulo}</div>
            <div style="font-size: 0.7rem; font-weight: 400; color: #cbd5e1;">${p.subtitulo}</div>
        </th>
    `).join('');

    // Linhas do Corpo (Etapas e opcionalmente Serviços)
    let linhasHtml = '';
    dados.etapas.forEach(et => {
        const pesoEtapa = dados.totalGeralObra > 0 ? (et.valorTotal / dados.totalGeralObra) * 100 : 0;
        const estiloEtapa = visao === 'analitico'
            ? 'background: #f1f5f9; font-weight: 700; border-bottom: 1px solid #cbd5e1;'
            : 'background: #ffffff; border-bottom: 1px solid #e2e8f0;';

        let celulasPeriodoEtapa = et.valoresPeriodo.map(valP => {
            if (valP <= 0) {
                return `<td style="padding: 8px 10px; text-align: right; color: #cbd5e1; border-left: 1px solid #e2e8f0;">-</td>`;
            }
            const percDaEtapaNoMes = et.valorTotal > 0 ? (valP / et.valorTotal) * 100 : 0;
            return `
                <td style="padding: 8px 10px; text-align: right; border-left: 1px solid #e2e8f0;">
                    <div style="font-weight: 600; color: #0f172a; font-size: 0.85rem;">R$ ${fmtMoeda(valP)}</div>
                    <div style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">${fmtPerc(percDaEtapaNoMes)}</div>
                </td>
            `;
        }).join('');

        linhasHtml += `
            <tr style="${estiloEtapa}">
                <td style="padding: 8px 10px; font-weight: 700; color: #1e293b; text-align: center;">${et.itemEap}</td>
                <td style="padding: 8px 10px; font-weight: ${visao === 'analitico' ? '700' : '600'}; color: #1e293b;">${et.descricao}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap;">R$ ${fmtMoeda(et.valorTotal)}</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: #475569;">${fmtPerc(pesoEtapa)}</td>
                ${celulasPeriodoEtapa}
            </tr>
        `;

        if (visao === 'analitico') {
            et.servicos.forEach(srv => {
                const pesoSrv = dados.totalGeralObra > 0 ? (srv.valorTotal / dados.totalGeralObra) * 100 : 0;
                let celulasSrv = srv.valoresPeriodo.map(valP => {
                    if (valP <= 0) {
                        return `<td style="padding: 6px 10px; text-align: right; color: #cbd5e1; border-left: 1px solid #f1f5f9;">-</td>`;
                    }
                    const percSrvMes = srv.valorTotal > 0 ? (valP / srv.valorTotal) * 100 : 0;
                    return `
                        <td style="padding: 6px 10px; text-align: right; border-left: 1px solid #f1f5f9;">
                            <div style="color: #334155; font-size: 0.8rem;">R$ ${fmtMoeda(valP)}</div>
                            <div style="font-size: 0.7rem; color: #64748b;">${fmtPerc(percSrvMes)}</div>
                        </td>
                    `;
                }).join('');

                linhasHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.82rem;">
                        <td style="padding: 6px 10px; color: #64748b; text-align: center;">${srv.itemEap}</td>
                        <td style="padding: 6px 10px; color: #334155; padding-left: 22px;"><span style="color:#94a3b8; font-size:0.75rem;">[${srv.codigo}]</span> ${srv.descricao}</td>
                        <td style="padding: 6px 10px; text-align: right; color: #334155; white-space: nowrap;">R$ ${fmtMoeda(srv.valorTotal)}</td>
                        <td style="padding: 6px 10px; text-align: right; color: #64748b;">${fmtPerc(pesoSrv)}</td>
                        ${celulasSrv}
                    </tr>
                `;
            });
        }
    });

    // Rodapé 1: Desembolso Simples no Período
    let celulasRodapeSimples = dados.totaisSimples.map((val, idx) => `
        <td style="padding: 10px; text-align: right; border-left: 1px solid #cbd5e1; background: #f8fafc;">
            <div style="font-weight: 700; color: #0f172a; font-size: 0.88rem;">R$ ${fmtMoeda(val)}</div>
            <div style="font-size: 0.78rem; color: #0284c7; font-weight: 700;">${fmtPerc(dados.percSimples[idx])}</div>
        </td>
    `).join('');

    // Rodapé 2: Desembolso Acumulado (Curva S)
    let celulasRodapeAcum = dados.totaisAcumulados.map((val, idx) => `
        <td style="padding: 10px; text-align: right; border-left: 1px solid #93c5fd; background: #eff6ff;">
            <div style="font-weight: 800; color: #1e3a8a; font-size: 0.9rem;">R$ ${fmtMoeda(val)}</div>
            <div style="font-size: 0.8rem; color: #059669; font-weight: 800;">${fmtPerc(dados.percAcumulados[idx])}</div>
        </td>
    `).join('');

    // Construção do Gráfico Visual da Curva S (Barras Simples + Curva Acumulada SVG)
    const nP = dados.periodos.length;
    const larguraSvg = Math.max(640, nP * 110);
    const alturaSvg = 230;
    const padLeft = 50;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 40;
    const wUtil = larguraSvg - padLeft - padRight;
    const hUtil = alturaSvg - padTop - padBottom;
    const passoX = wUtil / nP;

    let barrasSvg = '';
    let pontosCurva = [];
    let marcadoresSvg = '';

    dados.periodos.forEach((p, i) => {
        const cx = padLeft + (i + 0.5) * passoX;
        const pSimp = Math.min(100, Math.max(0, dados.percSimples[i]));
        const pAcum = Math.min(100, Math.max(0, dados.percAcumulados[i]));

        const hBarra = (pSimp / 100) * hUtil;
        const yBarra = padTop + hUtil - hBarra;
        const wBarra = Math.min(48, passoX * 0.55);

        const yAcum = padTop + hUtil - (pAcum / 100) * hUtil;
        pontosCurva.push(`${cx.toFixed(1)},${yAcum.toFixed(1)}`);

        barrasSvg += `
            <rect x="${(cx - wBarra / 2).toFixed(1)}" y="${yBarra.toFixed(1)}" width="${wBarra.toFixed(1)}" height="${Math.max(2, hBarra).toFixed(1)}" rx="3" fill="#93c5fd" opacity="0.85">
                <title>${p.titulo}: R$ ${fmtMoeda(dados.totaisSimples[i])} (${fmtPerc(pSimp)} no período)</title>
            </rect>
            <text x="${cx.toFixed(1)}" y="${(alturaSvg - 14).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#334155">${p.titulo}</text>
        `;

        marcadoresSvg += `
            <circle cx="${cx.toFixed(1)}" cy="${yAcum.toFixed(1)}" r="4.5" fill="#059669" stroke="#ffffff" stroke-width="2">
                <title>${p.titulo} Acumulado: R$ ${fmtMoeda(dados.totaisAcumulados[i])} (${fmtPerc(pAcum)})</title>
            </circle>
            <text x="${cx.toFixed(1)}" y="${Math.max(14, yAcum - 8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#065f46">${dados.percAcumulados[i].toFixed(1).replace('.', ',')}%</text>
        `;
    });

    let gradesHorizontais = [0, 25, 50, 75, 100].map(pct => {
        const y = padTop + hUtil - (pct / 100) * hUtil;
        return `
            <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${larguraSvg - padRight}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="4,4" />
            <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${pct}%</text>
        `;
    }).join('');

    container.style.display = 'block';
    container.innerHTML = `
        <div style="padding: 12px 16px; background: #0f172a; color: white; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <h3 style="margin: 0; font-size: 1.05rem; color: #ffffff;">💰 Cronograma Físico-Financeiro e Curva S (Padrão TCU / Lei 14.133)</h3>
                <span style="font-size: 0.78rem; color: #94a3b8;">Valores com BDI distribuídos proporcionalmente aos dias úteis de execução de cada serviço</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <label style="font-size: 0.8rem; color: #cbd5e1; margin: 0;">Período:</label>
                <select id="select-ff-periodicidade" class="form-control" style="width: auto; padding: 4px 8px; font-size: 0.82rem; height: 32px;" onchange="gerarCronogramaFisicoFinanceiro(false)">
                    <option value="mensal_30d" ${periodicidade === 'mensal_30d' ? 'selected' : ''}>Mensal Corrido (30 dias - Padrão Edital)</option>
                    <option value="mensal_calendario" ${periodicidade === 'mensal_calendario' ? 'selected' : ''}>Meses do Calendário (Jan, Fev...)</option>
                    <option value="quinzenal" ${periodicidade === 'quinzenal' ? 'selected' : ''}>Quinzenal (15 em 15 dias)</option>
                    <option value="semanal" ${periodicidade === 'semanal' ? 'selected' : ''}>Semanal (7 em 7 dias)</option>
                </select>
                <label style="font-size: 0.8rem; color: #cbd5e1; margin: 0;">Detalhe:</label>
                <select id="select-ff-visao" class="form-control" style="width: auto; padding: 4px 8px; font-size: 0.82rem; height: 32px;" onchange="gerarCronogramaFisicoFinanceiro(false)">
                    <option value="sintetico" ${visao === 'sintetico' ? 'selected' : ''}>Sintético por Etapas (Padrão Edital)</option>
                    <option value="analitico" ${visao === 'analitico' ? 'selected' : ''}>Analítico (Etapas + Serviços)</option>
                </select>
                <button class="btn btn-sm btn-success" onclick="exportarFisicoFinanceiroCSV()" title="Exportar Cronograma Físico-Financeiro para CSV/Excel">📥 Exportar CSV</button>
            </div>
        </div>

        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #334155; color: white; font-size: 0.82rem;">
                        <th style="padding: 10px; width: 70px; text-align: center;">Item</th>
                        <th style="padding: 10px; text-align: left; min-width: 240px;">Descrição da Etapa / Serviço</th>
                        <th style="padding: 10px; text-align: right; min-width: 130px;">Total c/ BDI (R$)</th>
                        <th style="padding: 10px; text-align: right; width: 85px;">Peso (%)</th>
                        ${thPeriodos}
                    </tr>
                </thead>
                <tbody>
                    ${linhasHtml}
                </tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #94a3b8;">
                        <td colspan="2" style="padding: 10px; font-weight: 700; color: #0f172a; background: #f8fafc;">DESEMBOLSO SIMPLES NO PERÍODO (R$ / % da Obra)</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #0f172a; background: #f8fafc;">R$ ${fmtMoeda(dados.totalGeralObra)}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 700; color: #0284c7; background: #f8fafc;">100,00%</td>
                        ${celulasRodapeSimples}
                    </tr>
                    <tr style="border-top: 1px solid #93c5fd;">
                        <td colspan="2" style="padding: 10px; font-weight: 800; color: #1e3a8a; background: #eff6ff;">📈 DESEMBOLSO ACUMULADO — CURVA S (R$ / % Acum.)</td>
                        <td style="padding: 10px; text-align: right; font-weight: 800; color: #1e3a8a; background: #eff6ff;">R$ ${fmtMoeda(dados.totalGeralObra)}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 800; color: #059669; background: #eff6ff;">100,00%</td>
                        ${celulasRodapeAcum}
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Gráfico Visual da Curva S -->
        <div style="padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 8px;">
                <strong style="font-size: 0.9rem; color: #1e293b;">📈 Gráfico da Curva S (Evolução Físico-Financeira)</strong>
                <div style="display: flex; gap: 16px; font-size: 0.8rem; color: #475569;">
                    <span><span style="display:inline-block; width:12px; height:12px; background:#93c5fd; border-radius:2px; vertical-align:middle; margin-right:4px;"></span> % Simples no Período</span>
                    <span><span style="display:inline-block; width:12px; height:3px; background:#059669; vertical-align:middle; margin-right:4px;"></span> % Acumulado (Curva S)</span>
                </div>
            </div>
            <div style="overflow-x: auto; background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px;">
                <svg width="${larguraSvg}" height="${alturaSvg}" viewBox="0 0 ${larguraSvg} ${alturaSvg}" style="display: block; margin: 0 auto;">
                    ${gradesHorizontais}
                    ${barrasSvg}
                    <polyline fill="none" stroke="#059669" stroke-width="3" points="${pontosCurva.join(' ')}" />
                    ${marcadoresSvg}
                </svg>
            </div>
        </div>
    `;

    if (scroll) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.exportarFisicoFinanceiroCSV = function() {
    const periodicidade = document.getElementById('select-ff-periodicidade')?.value || window.appState.ffPeriodicidade || 'mensal_30d';
    const visao = document.getElementById('select-ff-visao')?.value || window.appState.ffVisao || 'sintetico';
    const dados = window.calcularDadosFisicoFinanceiro(periodicidade);
    if (!dados) return alert('Gere o cronograma primeiro.');

    const fmtNum = (n) => n.toFixed(2).replace('.', ',');
    let cabecalho = ['Item EAP', 'Descrição', 'Valor Total c/ BDI (R$)', 'Peso (%)'];
    dados.periodos.forEach(p => {
        cabecalho.push(`${p.titulo} (R$)`);
        cabecalho.push(`${p.titulo} (%)`);
    });

    let linhas = [cabecalho.join(';')];

    dados.etapas.forEach(et => {
        const pesoEt = dados.totalGeralObra > 0 ? (et.valorTotal / dados.totalGeralObra) * 100 : 0;
        let rowEt = [
            `"${et.itemEap}"`,
            `"${et.descricao.replace(/"/g, '""')}"`,
            fmtNum(et.valorTotal),
            fmtNum(pesoEt)
        ];
        et.valoresPeriodo.forEach(valP => {
            const pMes = et.valorTotal > 0 ? (valP / et.valorTotal) * 100 : 0;
            rowEt.push(fmtNum(valP));
            rowEt.push(fmtNum(pMes));
        });
        linhas.push(rowEt.join(';'));

        if (visao === 'analitico') {
            et.servicos.forEach(srv => {
                const pesoSrv = dados.totalGeralObra > 0 ? (srv.valorTotal / dados.totalGeralObra) * 100 : 0;
                let rowSrv = [
                    `"${srv.itemEap}"`,
                    `"[${srv.codigo}] ${srv.descricao.replace(/"/g, '""')}"`,
                    fmtNum(srv.valorTotal),
                    fmtNum(pesoSrv)
                ];
                srv.valoresPeriodo.forEach(valP => {
                    const pMes = srv.valorTotal > 0 ? (valP / srv.valorTotal) * 100 : 0;
                    rowSrv.push(fmtNum(valP));
                    rowSrv.push(fmtNum(pMes));
                });
                linhas.push(rowSrv.join(';'));
            });
        }
    });

    let rowSimples = ['""', '"DESEMBOLSO SIMPLES NO PERÍODO"', fmtNum(dados.totalGeralObra), '100,00'];
    dados.totaisSimples.forEach((v, i) => {
        rowSimples.push(fmtNum(v));
        rowSimples.push(fmtNum(dados.percSimples[i]));
    });
    linhas.push(rowSimples.join(';'));

    let rowAcum = ['""', '"DESEMBOLSO ACUMULADO (CURVA S)"', fmtNum(dados.totalGeralObra), '100,00'];
    dados.totaisAcumulados.forEach((v, i) => {
        rowAcum.push(fmtNum(v));
        rowAcum.push(fmtNum(dados.percAcumulados[i]));
    });
    linhas.push(rowAcum.join(';'));

    const csvContent = '\uFEFF' + linhas.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Cronograma_Fisico_Financeiro_${periodicidade}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
