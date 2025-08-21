// ============================
// CONFIGURAÇÕES
// ============================
const CONFIG = {
    whatsappNumber: '5511912109424',
    whatsappBaseUrl: 'https://wa.me/',
    cacheMaxSize: 8, // Máximo de páginas em cache
    preloadRange: 2  // Quantas páginas adjacentes pré-carregar
};

let pedidosCount = 0;

// ============================
// PDF.js - CONFIG OTIMIZADO
// ============================
let pdfDoc = null,
    pageNum = 1,
    pageRendering = false,
    pageNumPending = null,
    scale = 1.2,
    canvas = null,
    ctx = null;

// Sistema de Cache Inteligente
const pageCache = new Map();
const renderQueue = [];
let isPreloading = false;

// Debounce para navegação rápida
let navigationTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadPDF('/RBS-2025.pdf');
});

// ============================
// APP
// ============================
function initializeApp() {
    updatePedidosCount();
    setupEventListeners();
}

// Eventos
function setupEventListeners() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePedidosBox();
        if (e.key === 'ArrowLeft') prevPage();
        if (e.key === 'ArrowRight') nextPage();
    });

    const textarea = document.getElementById('pedidosText');
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
        textarea.addEventListener('input', updatePedidosCount);
    }

    // Otimização para redimensionamento
    window.addEventListener('resize', debounce(() => {
        if (pdfDoc && !pageRendering) {
            clearPageCache();
            renderPage(pageNum);
        }
    }, 300));
}

// ============================
// SISTEMA DE CACHE
// ============================
function addToCache(pageNumber, canvasData) {
    // Remove páginas antigas se cache está cheio
    if (pageCache.size >= CONFIG.cacheMaxSize) {
        const oldestKey = pageCache.keys().next().value;
        pageCache.delete(oldestKey);
    }

    pageCache.set(pageNumber, {
        canvas: canvasData,
        timestamp: Date.now()
    });
}

function getFromCache(pageNumber) {
    return pageCache.get(pageNumber);
}

function clearPageCache() {
    pageCache.clear();
}

function showCacheIndicator(show = true) {
    const indicator = document.getElementById('cacheIndicator');
    if (show) {
        indicator.classList.add('show');
    } else {
        indicator.classList.remove('show');
    }
}

// ============================
// PDF.js - FUNÇÕES OTIMIZADAS
// ============================
function loadPDF(pdfPath) {
    showLoadingState();

    const loadingTask = pdfjsLib.getDocument({
        url: pdfPath,
        enableXfa: true,
        cMapPacked: true,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/cmaps/',
    });

    // Progress callback
    loadingTask.onProgress = function (progress) {
        updateLoadingProgress(progress.loaded, progress.total);
    };

    loadingTask.promise.then(pdfDoc_ => {
        pdfDoc = pdfDoc_;

        // Atualiza interface
        document.getElementById('totalPages').textContent = pdfDoc.numPages;
        document.getElementById('pageInput').max = pdfDoc.numPages;
        document.getElementById('pageInput').value = pageNum;

        // Renderiza primeira página e inicia pré-carregamento
        renderPage(pageNum).then(() => {
            hideLoadingState();
            startPreloading();
        });

    }).catch(err => {
        console.error('Erro ao carregar PDF:', err);
        const viewer = document.getElementById('pdfViewer');
        viewer.innerHTML = `<p class="text-danger">❌ Não foi possível carregar o PDF.</p>`;
        hideLoadingState();
    });
}

function renderPage(num, useCache = true) {
    return new Promise((resolve) => {
        // Verifica cache primeiro
        if (useCache && pageCache.has(num)) {
            const cached = getFromCache(num);
            displayCachedPage(cached.canvas);
            updatePageInfo(num);
            resolve();
            return;
        }

        pageRendering = true;
        showPageTransition();

        pdfDoc.getPage(num).then(page => {
            // Calcula viewport responsivo
            const unscaledViewport = page.getViewport({ scale: 1 });
            const responsiveScale = (window.innerWidth * 0.95) / unscaledViewport.width;
            const viewport = page.getViewport({ scale: responsiveScale });

            // Cria novo canvas se necessário
            if (!canvas) {
                const viewer = document.getElementById('pdfViewer');
                viewer.innerHTML = '<canvas id="pdfCanvas" class="page-transition"></canvas>';
                canvas = document.getElementById('pdfCanvas');
                ctx = canvas.getContext('2d');
            }

            // Ajusta canvas
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: ctx, viewport };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(() => {
                // Salva no cache
                const canvasData = {
                    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
                    width: canvas.width,
                    height: canvas.height
                };
                addToCache(num, canvasData);

                pageRendering = false;
                updatePageInfo(num);
                showPageTransition(false);

                resolve();

                // Processa próximo item da queue
                if (pageNumPending !== null) {
                    const nextPage = pageNumPending;
                    pageNumPending = null;
                    renderPage(nextPage);
                } else {
                    processRenderQueue();
                }
            });
        });
    });
}

function displayCachedPage(canvasData) {
    if (!canvas) {
        const viewer = document.getElementById('pdfViewer');
        viewer.innerHTML = '<canvas id="pdfCanvas" class="page-transition loaded"></canvas>';
        canvas = document.getElementById('pdfCanvas');
        ctx = canvas.getContext('2d');
    }

    canvas.width = canvasData.width;
    canvas.height = canvasData.height;
    ctx.putImageData(canvasData.imageData, 0, 0);
    showPageTransition(false);
}

function queueRenderPage(num) {
    clearTimeout(navigationTimer);

    navigationTimer = setTimeout(() => {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }, 100);
}

// ============================
// PRÉ-CARREGAMENTO INTELIGENTE
// ============================
function startPreloading() {
    if (isPreloading || !pdfDoc) return;

    isPreloading = true;
    showCacheIndicator(true);

    const pagesToPreload = [];

    // Páginas adjacentes
    for (let i = 1; i <= CONFIG.preloadRange; i++) {
        if (pageNum + i <= pdfDoc.numPages && !pageCache.has(pageNum + i)) {
            pagesToPreload.push(pageNum + i);
        }
        if (pageNum - i >= 1 && !pageCache.has(pageNum - i)) {
            pagesToPreload.push(pageNum - i);
        }
    }

    // Adiciona à queue de renderização
    pagesToPreload.forEach(page => {
        renderQueue.push(page);
    });

    processRenderQueue();
}

function processRenderQueue() {
    if (renderQueue.length === 0 || pageRendering) {
        if (renderQueue.length === 0) {
            isPreloading = false;
            showCacheIndicator(false);
        }
        return;
    }

    const nextPage = renderQueue.shift();

    // Renderiza em background (sem exibir)
    pdfDoc.getPage(nextPage).then(page => {
        const unscaledViewport = page.getViewport({ scale: 1 });
        const responsiveScale = (window.innerWidth * 0.95) / unscaledViewport.width;
        const viewport = page.getViewport({ scale: responsiveScale });

        // Canvas temporário para cache
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.height = viewport.height;
        tempCanvas.width = viewport.width;

        const renderContext = { canvasContext: tempCtx, viewport };

        page.render(renderContext).promise.then(() => {
            const canvasData = {
                imageData: tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height),
                width: tempCanvas.width,
                height: tempCanvas.height
            };
            addToCache(nextPage, canvasData);

            // Processa próximo
            setTimeout(() => processRenderQueue(), 50);
        });
    });
}

// ============================
// NAVEGAÇÃO OTIMIZADA
// ============================
function prevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    document.getElementById('pageInput').value = pageNum;
    queueRenderPage(pageNum);
    startPreloading();
}

function nextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    document.getElementById('pageInput').value = pageNum;
    queueRenderPage(pageNum);
    startPreloading();
}

function goToPage(page) {
    const pageNumber = parseInt(page);
    if (pageNumber < 1 || pageNumber > pdfDoc.numPages || pageNumber === pageNum) return;

    pageNum = pageNumber;
    queueRenderPage(pageNum);
    startPreloading();
}

// ============================
// ESTADOS VISUAIS
// ============================
function showLoadingState() {
    const viewer = document.getElementById('pdfViewer');
    viewer.innerHTML = `
        <div class="pdf-loading">
            <div class="loading-spinner"></div>
            <div class="loading-text">Carregando catálogo...</div>
            <div class="loading-progress">
                <div class="loading-progress-bar" id="loadingBar" style="width: 0%"></div>
            </div>
        </div>
    `;
}

function hideLoadingState() {
    // A interface já será substituída pelo canvas
}

function updateLoadingProgress(loaded, total) {
    const progressBar = document.getElementById('loadingBar');
    if (progressBar && total > 0) {
        const percentage = (loaded / total) * 100;
        progressBar.style.width = percentage + '%';
    }
}

function showPageTransition(show = true) {
    if (!canvas) return;

    if (show) {
        canvas.classList.remove('loaded');
        canvas.classList.add('page-transition');
    } else {
        canvas.classList.add('loaded');
    }
}

function updatePageInfo(num) {
    document.getElementById('pageInput').value = num;

    // Atualiza estado dos botões
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    prevBtn.disabled = num <= 1;
    nextBtn.disabled = num >= pdfDoc.numPages;
}

// ============================
// UTILITÁRIOS
// ============================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================
// WHATSAPP + PEDIDOS (MANTIDO ORIGINAL)
// ============================
function openWhatsApp(customMessage = '') {
    const message = customMessage || 'Olá! Vim através do catálogo digital e gostaria de mais informações.';
    window.open(`${CONFIG.whatsappBaseUrl}${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function togglePedidosBox() {
    const popup = document.getElementById('pedidosPopup');
    popup.classList.toggle('active');
    document.body.style.overflow = popup.classList.contains('active') ? 'hidden' : 'auto';
}

function closePedidosBox() {
    document.getElementById('pedidosPopup').classList.remove('active');
    document.body.style.overflow = 'auto';
}

function clearPedidos() {
    const textarea = document.getElementById('pedidosText');
    if (textarea.value.trim() === '') {
        showModal('Não há pedidos para limpar.', 'info');
        return;
    }

    showConfirmModal(
        'Tem certeza que deseja limpar todos os pedidos?',
        'Confirmação',
        () => {
            textarea.value = '';
            updatePedidosCount();
            textarea.focus();
            showModal('Pedidos limpos com sucesso!', 'success');
        }
    );
}

function enviarPedidos() {
    const textarea = document.getElementById('pedidosText');
    const pedidosText = textarea.value.trim();

    if (pedidosText === '') {
        showModal('Por favor, digite seus pedidos antes de enviar.', 'warning');
        textarea.focus();
        return;
    }

    const mensagemFormatada = formatarMensagemPedido(pedidosText);

    closePedidosBox();
    openWhatsApp(mensagemFormatada);

    showModal('Pedido enviado para o WhatsApp! Você será redirecionado automaticamente.', 'success');

    setTimeout(() => {
        showConfirmModal(
            'Pedido enviado! Deseja limpar a lista de pedidos?',
            'Limpeza Opcional',
            () => {
                textarea.value = '';
                updatePedidosCount();
            }
        );
    }, 1000);
}

function formatarMensagemPedido(pedidos) {
    const dataHora = new Date().toLocaleString('pt-BR');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        return `🛒 NOVO PEDIDO - ${dataHora}\n\n📦 Detalhes do Pedido:\n${pedidos}\n\n✅ Enviado através do catálogo digital\n🚚 Aguardo confirmação e informações sobre entrega/retirada.`;
    } else {
        return `NOVO PEDIDO - ${dataHora}\n\nDetalhes do Pedido:\n${pedidos}\n\nEnviado através do catálogo digital\nAguardo confirmação e informações sobre entrega/retirada.`;
    }
}

function updatePedidosCount() {
    const textarea = document.getElementById('pedidosText');
    const countElement = document.getElementById('pedidosCount');
    if (!textarea || !countElement) return;

    const lines = textarea.value.trim().split('\n').filter(l => l.trim() !== '').length;
    pedidosCount = lines;
    countElement.textContent = pedidosCount;
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(200, textarea.scrollHeight) + 'px';
}

// ============================
// MODAL UNIFICADO (MANTIDO ORIGINAL)
// ============================
window.alert = function (message) {
    showModal(message, 'info');
};

window.confirm = function (message) {
    showModal(message, 'warning');
    return false;
};

function showModal(message, type = 'info') {
    const modal = new bootstrap.Modal(document.getElementById('feedbackModal'));
    const modalBody = document.getElementById('feedbackModalBody');
    const modalTitle = document.getElementById('feedbackModalLabel');

    let icon, titleText, alertClass;
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            titleText = 'Sucesso';
            alertClass = 'alert-success';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            titleText = 'Atenção';
            alertClass = 'alert-warning';
            break;
        case 'error':
            icon = 'fas fa-times-circle';
            titleText = 'Erro';
            alertClass = 'alert-danger';
            break;
        default:
            icon = 'fas fa-info-circle';
            titleText = 'Informação';
            alertClass = 'alert-info';
    }

    modalTitle.innerHTML = `<i class="${icon}"></i> ${titleText}`;
    modalBody.innerHTML = `<div class="alert ${alertClass} mb-0">${message}</div>`;
    modal.show();
}

function showConfirmModal(message, title = 'Confirmação', onConfirm = null) {
    const modalElement = document.getElementById('feedbackModal');
    const modal = new bootstrap.Modal(modalElement);
    const modalBody = document.getElementById('feedbackModalBody');
    const modalTitle = document.getElementById('feedbackModalLabel');
    const modalFooter = document.getElementById('feedbackModalFooter');

    modalTitle.innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
    modalBody.innerHTML = `<div class="alert alert-warning mb-0">${message}</div>`;

    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-danger" id="confirmButton">Confirmar</button>
    `;

    const confirmButton = modalFooter.querySelector('#confirmButton');
    confirmButton.addEventListener('click', function () {
        if (onConfirm) onConfirm();
        modal.hide();

        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 300);
    });

    modalElement.addEventListener('hidden.bs.modal', function () {
        modalFooter.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>';

        setTimeout(() => {
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 100);
    }, { once: true });

    modal.show();
}