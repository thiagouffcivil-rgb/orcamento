// ==========================================
// 1. GESTÃO DA TABELA DE CRONOGRAMA
// ==========================================

window.carregarTabelaCronograma = function() {
    const tbody = document.getElementById('tbody-cronograma');
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--danger);">O orçamento está vazio. Adicione itens primeiro.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.appState.orcamento.map((item) => {
        if (item.tipo === 'etapa') {
            return `<tr class="row-etapa"><td>${item.itemEap}</td><td colspan="7"><strong>${item.descricao}</strong></td></tr>`;
        }

        if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', terminoJunto: '', espera: 0 };
        
        let duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (item.cronograma.equipe * 8)) : 1;

        return `
        <tr>
            <td><strong>${item.itemEap}</strong></td>
            <td style="font-size: 0.85rem;">${item.descricao}</td>
            <td class="text-right">
                <input type="number" id="hh-input-${item.id}" min="0" value="${item.cronograma.hh}" style="width: 80px; text-align: right; padding: 4px;" onchange="atualizarCrono(${item.id}, 'hh', this.value)">
            </td>
            <td class="text-center">
                <input type="number" min="1" value="${item.cronograma.equipe}" style="width: 60px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'equipe', this.value)">
            </td>
            <td class="text-center"><strong id="duracao-${item.id}" style="color: var(--primary); font-size: 1.1rem;">${duracao}</strong></td>
            <td class="text-center">
                <input type="text" placeholder="Ex: 1.1" value="${item.cronograma.predecessora}" title="A tarefa inicia após o fim desta EAP" style="width: 70px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'predecessora', this.value)">
            </td>
            <td class="text-center">
                <input type="text" placeholder="PROJETO" value="${item.cronograma.terminoJunto || ''}" title="A tarefa estica até ao fim desta EAP (ou digite PROJETO)" style="width: 80px; text-align: center; padding: 4px; background: #e0f2fe; border: 1px solid #7dd3fc;" onchange="atualizarCrono(${item.id}, 'terminoJunto', this.value)">
            </td>
            <td class="text-center">
                <input type="number" min="0" value="${item.cronograma.espera}" style="width: 60px; text-align: center; padding: 4px;" onchange="atualizarCrono(${item.id}, 'espera', this.value)">
            </td>
        </tr>
        `;
    }).join('');
    
    if (typeof window.atualizarSelectPrazos === 'function') window.atualizarSelectPrazos();
};

window.atualizarCrono = function(id, campo, valor) {
    const item = window.appState.orcamento.find(i => i.id === id);
    if (item) {
        if (campo === 'predecessora' || campo === 'terminoJunto') {
            item.cronograma[campo] = valor.trim().toUpperCase();
        } else {
            item.cronograma[campo] = (parseFloat(valor) || 0);
        }
        
        if (campo === 'equipe' && item.cronograma.equipe < 1) item.cronograma.equipe = 1;

        if (campo === 'hh' || campo === 'equipe') {
            const duracao = item.cronograma.hh > 0 ? Math.ceil(item.cronograma.hh / (item.cronograma.equipe * 8)) : 1;
            document.getElementById(`duracao-${id}`).innerText = duracao;
        }
    }
};

// ==========================================
// 2. MOTOR DO GRÁFICO DE GANTT E CAMINHO CRÍTICO
// ==========================================

window.gerarGraficoGantt = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) return;
    
    google.charts.load('current', {'packages':['gantt']});
    google.charts.setOnLoadCallback(desenharGrafico);

    function proximoDiaUtil(data) {
        let d = new Date(data.getTime());
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        return d;
    }

    function desenharGrafico() {
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
        let tarefasValidas = window.appState.orcamento.filter(i => i.tipo !== 'etapa');
        let mapTarefas = {};
        
        let arrayCalculo = tarefasValidas.map(i => {
            let duracaoDias = (i.cronograma && i.cronograma.hh > 0) ? Math.ceil(i.cronograma.hh / (i.cronograma.equipe * 8)) : 1;
            let obj = {
                id: String(i.id), eap: i.itemEap, desc: i.descricao, 
                duracaoDias: duracaoDias, 
                predEap: i.cronograma ? i.cronograma.predecessora : '',
                terminoJunto: i.cronograma ? i.cronograma.terminoJunto : '',
                esperaDias: i.cronograma ? i.cronograma.espera : 0, 
                start: null, end: null, refItem: i 
            };
            mapTarefas[i.itemEap] = obj;
            return obj;
        });

        let baseDate = new Date(); 
        baseDate.setHours(0,0,0,0);
        baseDate = proximoDiaUtil(baseDate); 
        
        let mudou = true; let loops = 0;
        while(mudou && loops < 100) { 
            mudou = false; loops++;
            arrayCalculo.forEach(t => {
                let prevStart = t.start ? new Date(t.start.getTime()) : null;
                let prevEnd = t.end ? new Date(t.end.getTime()) : null;

                // 1. Calcula o INÍCIO baseado nas predecessoras normais
                let preds = t.predEap ? String(t.predEap).split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];

                if (preds.length === 0) {
                    t.start = new Date(baseDate.getTime()); 
                } else {
                    let maxEndDate = new Date(baseDate.getTime());
                    let encontrouValida = false;
                    preds.forEach(p => {
                        if (mapTarefas[p] && mapTarefas[p].end) {
                            if (mapTarefas[p].end.getTime() > maxEndDate.getTime()) maxEndDate = new Date(mapTarefas[p].end.getTime());
                            encontrouValida = true;
                        }
                    });

                    if (encontrouValida) {
                        let dataComEspera = new Date(maxEndDate.getTime());
                        dataComEspera.setDate(dataComEspera.getDate() + 1 + t.esperaDias);
                        t.start = proximoDiaUtil(dataComEspera);
                    } else {
                        t.start = new Date(baseDate.getTime());
                    }
                }
                
                // 2. Calcula o TÉRMINO (Tarefa Normal vs Tarefa Rede/Hammock)
                if (t.start) {
                    let maxFimVinculado = null;

                    if (t.terminoJunto) {
                        let termos = String(t.terminoJunto).trim().toUpperCase();
                        
                        // PALAVRA MÁGICA: PROJETO
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
                            // Vincula ao fim de EAPs específicas (ex: 1.5, 1.6)
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

                    // Se a tarefa estica como um elástico (Hammock)
                    if (maxFimVinculado && maxFimVinculado.getTime() >= t.start.getTime()) {
                        t.end = new Date(maxFimVinculado.getTime());
                        
                        // Recalcula os dias úteis dessa "caixa de tempo"
                        let countDias = 1;
                        let cur = new Date(t.start.getTime());
                        while(cur < t.end) {
                            cur.setDate(cur.getDate() + 1);
                            if (cur.getDay() !== 0 && cur.getDay() !== 6) countDias++;
                        }
                        t.duracaoDias = countDias;
                        
                        // Auto-Ajusta o HH no orçamento subjacente!
                        if (t.refItem && t.refItem.cronograma) {
                            t.refItem.cronograma.hh = t.duracaoDias * 8 * (parseInt(t.refItem.cronograma.equipe) || 1);
                        }
                    } else {
                        // Tarefa Normal Fixa
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

        // 3. Atualiza a tela em tempo real com os elásticos recalculados
        arrayCalculo.forEach(t => {
            if (t.refItem && t.refItem.cronograma && t.start && t.end) {
                t.refItem.cronograma.dataInicio = t.start;
                t.refItem.cronograma.dataFim = t.end;
                
                if (t.terminoJunto) {
                    let inputHh = document.getElementById(`hh-input-${t.refItem.id}`);
                    let labelDuracao = document.getElementById(`duracao-${t.refItem.id}`);
                    if (inputHh) inputHh.value = t.refItem.cronograma.hh;
                    if (labelDuracao) labelDuracao.innerText = t.duracaoDias;
                }
            }
        });

        // 4. Desenha o Google Charts
        arrayCalculo.forEach(t => {
            if (!t.start || !t.end) return; 

            let chartEnd = new Date(t.end.getTime());
            chartEnd.setDate(chartEnd.getDate() + 1); // Exigência técnica do Google Charts

            let dependenciesString = null;
            if (t.predEap) {
                let predsEapList = String(t.predEap).split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                let validIds = [];
                predsEapList.forEach(pEap => {
                    let predTask = arrayCalculo.find(tk => tk.eap === pEap);
                    if (predTask) validIds.push(predTask.id);
                });
                if (validIds.length > 0) dependenciesString = validIds.join(',');
            }

            rows.push([ t.id, `${t.eap} - ${t.desc.substring(0, 35)}...`, 'Serviços', t.start, chartEnd, null, 0, dependenciesString ]);
        });

        if (rows.length === 0) {
            document.getElementById('gantt_chart_div').innerHTML = '<div style="text-align: center; color: #94a3b8; padding-top: 80px;">Sem dados válidos para desenhar o Gantt.</div>';
            return;
        }

        data.addRows(rows);
        var options = { height: (rows.length * 42) + 50, gantt: { trackHeight: 30, labelStyle: { fontName: 'system-ui', fontSize: 12 } } };
        var chart = new google.visualization.Gantt(document.getElementById('gantt_chart_div'));
        chart.draw(data, options);
    }
};

// ==========================================
// 3. EXPORTAÇÃO E IMPORTAÇÃO DO CRONOGRAMA
// ==========================================

window.exportarCronogramaJSON = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) {
        alert('Não há itens no orçamento para exportar.');
        return;
    }
    const dadosCrono = window.appState.orcamento.filter(i => i.tipo !== 'etapa').map(i => ({
        itemEap: i.itemEap,
        equipe: i.cronograma ? i.cronograma.equipe : 1,
        predecessora: i.cronograma ? i.cronograma.predecessora : '',
        terminoJunto: i.cronograma ? i.cronograma.terminoJunto : '',
        espera: i.cronograma ? i.cronograma.espera : 0
    }));
    window.downloadArquivo(JSON.stringify(dadosCrono, null, 2), `dados_cronograma_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
};

window.importarCronogramaJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importado = JSON.parse(e.target.result);
            if (Array.isArray(importado)) {
                importado.forEach(dado => {
                    const item = window.appState.orcamento.find(i => String(i.itemEap) === String(dado.itemEap));
                    if (item) {
                        if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', terminoJunto: '', espera: 0 };
                        if (dado.equipe !== undefined) item.cronograma.equipe = dado.equipe;
                        if (dado.predecessora !== undefined) item.cronograma.predecessora = dado.predecessora;
                        if (dado.terminoJunto !== undefined) item.cronograma.terminoJunto = dado.terminoJunto;
                        if (dado.espera !== undefined) item.cronograma.espera = dado.espera;
                    }
                });
                window.carregarTabelaCronograma();
                window.gerarGraficoGantt();
                alert('Cronograma importado e aplicado aos serviços com sucesso!');
            } else { alert('O formato do ficheiro deve ser uma lista (Array) de itens.'); }
        } catch (err) { alert('Erro ao ler o ficheiro JSON do cronograma.'); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};
// ==========================================
// 4. MOTOR DE CÁLCULO DE HH (HOMEM-HORA)
// ==========================================

window.calcularHHDosIngredientes = function() {
    if (!window.appState.orcamento || window.appState.orcamento.length === 0) return;
    let basesDeDados = [];
    for (let key in window.appState.databases) {
        if (Array.isArray(window.appState.databases[key])) basesDeDados.push(window.appState.databases[key]);
    }
    let atualizados = 0;

    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa' && parseFloat(item.qtd) > 0) {
            let hhUnitario = 0;
            let lista = item.ingredientes || item.insumos || item.composicao || item.itens || [];
            
            if (lista.length === 0 && item.codigo && item.codigo !== '-') {
                for (let banco of basesDeDados) {
                    let compBanco = banco.find(c => String(c.codigo).trim() === String(item.codigo).trim() || String(c['Código']).trim() === String(item.codigo).trim());
                    if (compBanco) { lista = compBanco.ingredientes || compBanco.insumos || compBanco.composicao || compBanco.itens || []; break; }
                }
            }
            
            const undItem = item.unidade ? String(item.unidade).trim().toUpperCase() : '';
            if (lista.length === 0) {
                if (undItem === 'H' || undItem === 'CHP' || undItem === 'CHI') hhUnitario = 1;
                if (undItem === 'MES' || undItem === 'UN.MÊS') hhUnitario = 176; 
            } else if (lista.length > 0) {
                lista.forEach(ing => {
                    const undIng = ing.unidade || ing['Unidade'] ? String(ing.unidade || ing['Unidade']).trim().toUpperCase() : '';
                    const tipoIng = ing.tipo || ing['Tipo Item'] ? String(ing.tipo || ing['Tipo Item']).trim().toLowerCase() : '';
                    if (undIng === 'H' || undIng === 'CHP' || undIng === 'CHI' || tipoIng.includes('mao_de_obra') || tipoIng.includes('equipamento') || tipoIng.includes('mão de obra')) {
                        let coeficiente = parseFloat(ing.quantidade || ing.coeficiente || ing.consumo || ing.qtd || ing['Coeficiente']) || 0;
                        hhUnitario += coeficiente;
                    }
                });
            }
            
            if (hhUnitario > 0) {
                if (!item.cronograma) item.cronograma = { hh: 0, equipe: 1, predecessora: '', espera: 0 };
                let hhTotal = hhUnitario * parseFloat(item.qtd);
                item.cronograma.hh = Math.ceil(hhTotal);
                atualizados++;
            }
        }
    });

    if (atualizados > 0) {
        alert(`✅ Sucesso! O Cronograma cruzou o orçamento com o Banco de Dados e calculou o HH para ${atualizados} serviços.`);
        window.carregarTabelaCronograma(); 
        window.gerarGraficoGantt(); 
    } else {
        alert('⚠️ Aviso: O sistema não conseguiu cruzar os serviços com as composições no banco de dados.');
    }
};

// ==========================================
// 5. FÁBRICA DE PRAZOS (BANCO LOCAL)
// ==========================================

window.atualizarSelectPrazos = function() {
    const select = document.getElementById('select-servico-prazo');
    if (!select || !window.appState.orcamento) return;
    let html = '<option value="">-- Escolha um serviço --</option>';
    window.appState.orcamento.forEach(item => {
        if (item.tipo !== 'etapa') html += `<option value="${item.codigo}">${item.itemEap} - ${item.descricao.substring(0, 40)}...</option>`;
    });
    select.innerHTML = html;
};

window.carregarDadosServicoPrazo = function() {
    const select = document.getElementById('select-servico-prazo');
    const codigo = select.value;
    if (!codigo) return;
    
    if (window.appState.baseComposicoesPrazos && window.appState.baseComposicoesPrazos[codigo]) {
        const dados = window.appState.baseComposicoesPrazos[codigo];
        
        // Inteligência: Tenta montar o texto da turma lendo os cargos da IA, se existirem
        let descTurma = dados.descricaoTurma || dados.turma || '';
        if (!descTurma && dados.equipeFiscalizacao) {
            descTurma = dados.equipeFiscalizacao.map(e => `${e.quantidade} ${e.cargo}`).join(' + ');
        }
        
        document.getElementById('input-turma-prazo').value = descTurma;
        document.getElementById('input-prod-prazo').value = dados.producaoDiaria || '';
        document.getElementById('input-espera-prazo').value = dados.espera || 0;
    } else {
        document.getElementById('input-turma-prazo').value = '';
        document.getElementById('input-prod-prazo').value = '';
        document.getElementById('input-espera-prazo').value = '0';
    }
};

window.salvarNoBancoPrazos = function() {
    const select = document.getElementById('select-servico-prazo');
    const codigo = select.value;
    if (!codigo) { alert('Selecione um serviço primeiro.'); return; }
    
    const turma = document.getElementById('input-turma-prazo').value.trim();
    const producao = parseFloat(document.getElementById('input-prod-prazo').value);
    const espera = parseFloat(document.getElementById('input-espera-prazo').value) || 0;

    if (!turma || isNaN(producao) || producao <= 0) { alert('Preencha a turma e a produção diária (>0).'); return; }

    // BLINDAGEM: Resgata os dados da IA (se existirem) para não apagar a lista de cargos!
    let dadosExistentes = window.appState.baseComposicoesPrazos[codigo] || {};

    window.appState.baseComposicoesPrazos[codigo] = { 
        ...dadosExistentes, // O "spread operator" mantém a equipeFiscalizacao intacta
        codigo: codigo, 
        descricaoTurma: turma, 
        producaoDiaria: producao, 
        espera: espera 
    };
    
    alert(`Rendimento para o código ${codigo} atualizado na memória!`);
    
    // Força a atualização do cronograma e do Gantt com a nova produção manual
    if (typeof window.atualizarCronogramaComBaseLocal === 'function') {
        window.atualizarCronogramaComBaseLocal();
    } else {
        window.carregarTabelaCronograma();
    }
};
window.exportarBancoPrazos = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.appState.baseComposicoesPrazos, null, 2));
    const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", "base_produtividade.json");
    document.body.appendChild(dl); dl.click(); dl.remove();
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
        } catch (err) { alert('Erro ao ler o ficheiro JSON.'); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};


// ==========================================
// 6. MATRIZ DE ALOCAÇÃO DE RECURSOS (PESSOAL E EQUIPAMENTOS)
// ==========================================

window.gerarMatrizMaoDeObra = function() {
    window.gerarGraficoGantt();

    const tarefas = window.appState.orcamento.filter(i => i.tipo !== 'etapa' && i.cronograma && i.cronograma.dataInicio && i.cronograma.dataFim);
    
    if (tarefas.length === 0) {
        alert("Não há tarefas no cronograma com datas válidas. Carregue os serviços e desenhe o Gantt primeiro.");
        return;
    }

    let minDate = new Date(Math.min(...tarefas.map(t => t.cronograma.dataInicio.getTime())));
    let maxDate = new Date(Math.max(...tarefas.map(t => t.cronograma.dataFim.getTime())));

    let diasProjeto = [];
    let curDate = new Date(minDate.getTime());
    while (curDate <= maxDate) {
        if (curDate.getDay() !== 0 && curDate.getDay() !== 6) diasProjeto.push(new Date(curDate.getTime()));
        curDate.setDate(curDate.getDate() + 1);
    }

    // A MUDANÇA ESTÁ AQUI: Inicializar as matrizes diárias com ZERO
    let matrizMODiaria = {};
    let matrizEqpDiaria = {};
    
    // Passo A: Calcular o efetivo diário
    diasProjeto.forEach(dia => {
        let keyDia = dia.toISOString().split('T')[0];
        let timeDia = dia.getTime();
        
        tarefas.forEach(t => {
            let startT = t.cronograma.dataInicio.getTime();
            let endT = t.cronograma.dataFim.getTime();
            
            // Se a tarefa ocorre neste dia, somamos a equipa
            if (timeDia >= startT && timeDia <= endT) {
                let equipe = (t.cronograma.equipeDetalhada && t.cronograma.equipeDetalhada.length > 0) 
                    ? t.cronograma.equipeDetalhada 
                    : [{ cargo: "Operário (Genérico)", quantidade: parseInt(t.cronograma.equipe) || 1 }];
                    
                let maquinas = t.cronograma.equipamentosDetalhe || [];

                equipe.forEach(prof => {
                    let nomeCargo = prof.cargo.toUpperCase();
                    let qtd = parseInt(prof.quantidade) || 1;
                    if (!matrizMODiaria[nomeCargo]) matrizMODiaria[nomeCargo] = {};
                    if (!matrizMODiaria[nomeCargo][keyDia]) matrizMODiaria[nomeCargo][keyDia] = 0;
                    matrizMODiaria[nomeCargo][keyDia] += qtd; // Soma as sobreposições DO MESMO DIA
                });
                
                maquinas.forEach(maq => {
                    let nomeMaq = maq.equipamento.toUpperCase();
                    let qtdM = parseInt(maq.quantidade) || 1;
                    if (!matrizEqpDiaria[nomeMaq]) matrizEqpDiaria[nomeMaq] = {};
                    if (!matrizEqpDiaria[nomeMaq][keyDia]) matrizEqpDiaria[nomeMaq][keyDia] = 0;
                    matrizEqpDiaria[nomeMaq][keyDia] += qtdM; // Soma as sobreposições DO MESMO DIA
                });
            }
        });
    });

    // Passo B: Encontrar o Pico Semanal
    let semanas = [];
    let currSemana = { titulo: "Sem. 1", mo: {}, eqp: {} };
    let countDias = 0; let numSemana = 1;

    diasProjeto.forEach((dia, index) => {
        let keyDia = dia.toISOString().split('T')[0];
        
        // Pega o efetivo diário de cada cargo e atualiza o pico da semana se for maior
        for (let c in matrizMODiaria) {
            if (!currSemana.mo[c]) currSemana.mo[c] = 0;
            if (matrizMODiaria[c][keyDia] && matrizMODiaria[c][keyDia] > currSemana.mo[c]) {
                currSemana.mo[c] = matrizMODiaria[c][keyDia];
            }
        }
        for (let e in matrizEqpDiaria) {
            if (!currSemana.eqp[e]) currSemana.eqp[e] = 0;
            if (matrizEqpDiaria[e][keyDia] && matrizEqpDiaria[e][keyDia] > currSemana.eqp[e]) {
                currSemana.eqp[e] = matrizEqpDiaria[e][keyDia];
            }
        }

        countDias++;
        if (countDias === 5 || index === diasProjeto.length - 1) { 
            semanas.push(currSemana);
            numSemana++;
            currSemana = { titulo: `Sem. ${numSemana}`, mo: {}, eqp: {} };
            countDias = 0;
        }
    });

    // Passo C: Renderizar as Tabelas HTML
    function desenharTabela(matrizBase, dicionarioSemana, tituloColuna, corHeader) {
        let chaves = Object.keys(matrizBase).sort();
        if (chaves.length === 0) return '';

        let html = `<table class="table-bordered" style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 20px;">
        <thead><tr style="background: ${corHeader}; color: white;">
        <th style="padding: 10px; text-align: left; width: 35%;">${tituloColuna}</th>`;
        
        semanas.forEach(s => { html += `<th style="padding: 10px;">${s.titulo}</th>`; });
        html += `</tr></thead><tbody>`;

        chaves.forEach(chave => {
            html += `<tr><td style="padding: 8px; text-align: left; font-weight: bold; background: #f8fafc;">${chave}</td>`;
            semanas.forEach(s => {
                let picoNaSemana = s[dicionarioSemana][chave] || 0;
                let corTexto = picoNaSemana > 0 ? "var(--primary)" : "#cbd5e1";
                html += `<td style="padding: 8px; color: ${corTexto}; font-weight: ${picoNaSemana > 0 ? 'bold' : 'normal'};">${picoNaSemana > 0 ? picoNaSemana + ' un.' : '-'}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        return html;
    }

    let htmlFinal = desenharTabela(matrizMODiaria, 'mo', '👷 Cargos (Mão de Obra Direta)', '#1e293b');
    let htmlMaquinas = desenharTabela(matrizEqpDiaria, 'eqp', '🏗️ Equipamentos de Apoio / Pesados', '#b45309');

    let container = document.getElementById('matriz-mao-de-obra-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'matriz-mao-de-obra-container';
        container.style.cssText = 'margin-top: 25px; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: white;';
        document.getElementById('gantt_chart_div').parentNode.insertBefore(container, document.getElementById('gantt_chart_div').nextSibling);
    }
    
    container.innerHTML = `
        <h3 style="padding: 10px 15px; margin: 0; background: #f1f5f9; border-bottom: 1px solid var(--border-color); color: #334155; font-size: 1rem;">
            👥 Plano de Mobilização (Histograma Semanal)
        </h3>
        <div style="padding: 15px;">
            ${htmlFinal}
            ${htmlMaquinas ? htmlMaquinas : '<p style="color: #64748b; font-size: 0.9rem; font-style: italic;">Nenhum equipamento pesado registado para mobilização.</p>'}
            <div style="margin-top: 8px; font-size: 0.8rem; color: #64748b;">
                * Os valores representam o pico máximo (simultâneo) necessário dentro de cada semana civil de trabalho.
            </div>
        </div>`;
    
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
};