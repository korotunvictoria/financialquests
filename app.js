// --- SCORM API WRAPPER ---
const SCORM = {
    api: null,
    init: function() {
        this.api = this.getAPI(window);
        if (this.api) {
            this.api.LMSInitialize("");
            let status = this.api.LMSGetValue("cmi.core.lesson_status");
            if (status === "not attempted" || status === "unknown" || status === "") {
                this.api.LMSSetValue("cmi.core.lesson_status", "incomplete");
            }
        }
    },
    getAPI: function(win) {
        let attempts = 0;
        while (win.API == null && win.parent != null && win.parent != win) {
            attempts++;
            if (attempts > 7) return null;
            win = win.parent;
        }
        return win.API;
    },
    set: function(param, value) {
        if (this.api) this.api.LMSSetValue(param, value);
    },
    get: function(param) {
        if (this.api) return this.api.LMSGetValue(param);
        return "";
    },
    commit: function() {
        if (this.api) this.api.LMSCommit("");
    },
    finish: function() {
        if (this.api) {
            this.api.LMSCommit("");
            this.api.LMSFinish("");
        }
    }
};

// --- ЛОГИКА И СТИЛИ КАЛЬКУЛЯТОРА И ТЕКСТУР ---
let calcState = {
displayValue: '0',
firstOperand: null,
waitingForSecondOperand: false,
operator: null,
isVisible: false
};

const calcStyle = document.createElement('style');
calcStyle.innerHTML = `
/* === СТИЛИ КАЛЬКУЛЯТОРА === */
.surreal-calc-popup {
position: fixed;
top: 50%;
right: 5%;
transform: translateY(-50%);
background: var(--surface-pressed, #2a2a2e);
border: 1px solid var(--copper, #d4af37);
border-radius: 16px;
padding: 20px;
width: 280px;
box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.05);
z-index: 9999;
display: none;
flex-direction: column;
gap: 15px;
}
.surreal-calc-popup.show { display: flex; }
.calc-header {
display: flex;
justify-content: space-between;
align-items: center;
color: var(--copper, #d4af37);
font-size: 1.4vh;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 1px;
}
.calc-close {
cursor: pointer;
font-size: 20px;
color: var(--text-muted, #888);
transition: color 0.2s;
line-height: 1;
}
.calc-close:hover { color: white; }
.calc-display {
background: #1a1a1d;
border: 1px solid rgba(255,255,255,0.05);
border-radius: 8px;
padding: 15px;
text-align: right;
font-size: 28px;
color: white;
overflow: hidden;
white-space: nowrap;
}
.calc-grid {
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 8px;
}
.calc-btn {
background: rgba(255,255,255,0.05);
border: 1px solid rgba(255,255,255,0.02);
border-radius: 8px;
padding: 12px 0;
font-size: 18px;
color: white;
cursor: pointer;
transition: all 0.2s;
}
.calc-btn:hover { background: rgba(255,255,255,0.1); }
.calc-btn:active { transform: scale(0.95); }
.calc-btn.operator {
background: rgba(212, 175, 55, 0.1);
color: var(--copper, #d4af37);
font-weight: bold;
}
.calc-btn.operator:hover { background: rgba(212, 175, 55, 0.2); }
.calc-btn.equals {
background: var(--copper, #d4af37);
color: black;
font-weight: bold;
grid-column: span 2;
}
.calc-btn.equals:hover { filter: brightness(1.1); }

/* === СТИЛИ МОДАЛЬНЫХ ОКОН (SCORM) === */
.surreal-modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
    display: flex; justify-content: center; align-items: center;
    z-index: 10000; opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.surreal-modal-overlay.show { opacity: 1; pointer-events: auto; }
.surreal-modal {
    background: var(--surface-pressed, #2a2a2e); border: 1px solid var(--copper, #d4af37);
    border-radius: 16px; padding: 40px; max-width: 450px; width: 90%; text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 2px 10px rgba(255,255,255,0.05);
    transform: translateY(20px); transition: transform 0.3s;
}
.surreal-modal-overlay.show .surreal-modal { transform: translateY(0); }
.surreal-modal h2 { color: white; font-size: clamp(18px, 2.5vh, 24px); margin-bottom: 30px; line-height: 1.4; font-weight: normal; }
.surreal-modal .modal-buttons { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }

@media (max-width: 1024px) {
    .surreal-calc-popup {
        right: 50%;
        transform: translate(50%, -50%);
    }
}

/* === СТИЛИ ТЕКСТОВ === */
.exp-text p, .task-desc p, .content-centered p {
    margin-top: 1.5vh;
    margin-bottom: 0;
}

.card-body ul {
    list-style: none;
    padding-left: 0;
    margin-top: 2vh;
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5vh;
}

.content-centered {
    position: relative;
    z-index: 5; 
}

.content-centered ul {
    width: fit-content;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
}

.card-body li {
    position: relative;
    padding-left: 1.5rem;
    line-height: 1.4;
    color: var(--text-main, #ffffff);
}

.card-body li::before {
    content: '●';
    position: absolute;
    left: 0;
    top: 0.4em;
    font-size: 0.6em;
    color: var(--text-muted, #888);
}

/* === ТЕМНЫЙ МАТОВЫЙ ЭФФЕКТ С ШУМОМ И ТИСНЕНИЕМ === */
.surreal-card.embossed-texture {
    background-color: #121214 !important; 
    position: relative; 
    
    background-image: 
        url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.06'/%3E%3C/svg%3E"),
        linear-gradient(rgba(18, 18, 20, 0.85), rgba(18, 18, 20, 0.85)),
        url('pattern.jpg') !important; 
        
    background-size: 150px, 100%, 400px !important; 
    background-repeat: repeat, no-repeat, repeat !important;
    background-position: center !important;
    
    box-shadow: inset 0 0 120px rgba(0,0,0,0.95) !important;
}

/* === ПЛАВНАЯ АНИМАЦИЯ ФОНА НА ПЕРВОМ ЭКРАНЕ === */
@keyframes smoothCrossfade {
    0%, 20% { opacity: 0; }   
    40%, 60% { opacity: 1; }  
    80%, 100% { opacity: 0; } 
}

.surreal-card.animated-cover-bg::after {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    border-radius: inherit;
    z-index: 1; 
    pointer-events: none; 
    
    will-change: opacity;
    transform: translateZ(0);
    
    background-image: 
        url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.06'/%3E%3C/svg%3E"),
        linear-gradient(rgba(18, 18, 20, 0.85), rgba(18, 18, 20, 0.85)),
        url('pattern2.jpg'); 
        
    background-size: 150px, 100%, 400px; 
    background-repeat: repeat, no-repeat, repeat;
    background-position: center;
    
    box-shadow: inset 0 0 120px rgba(0,0,0,0.95);
    
    animation: smoothCrossfade 16s infinite linear;
}

/* === СТИЛИ ЭКРАНА СИТУАЦИИ С КАРТИНКОЙ === */
.surreal-card.context-mode .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.context-split {
    display: flex;
    height: 100%;
    gap: 3vh;
}
.context-text-area {
    flex: 2; 
    display: flex;
    flex-direction: column;
    justify-content: center; 
}
.context-image-desktop {
    flex: 1; 
    display: flex;
    align-items: center; 
    justify-content: center;
    min-height: 0;
}
.context-image-desktop img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: center; 
}
.context-image-mobile {
    display: none; 
}

/* === ОБЛОЖКА И АДАПТИВ === */
.surreal-card.cover-mode {
    padding: 0 !important;
}
.surreal-card.cover-mode .card-header {
    padding: 4vh 5vh 0 5vh;
    margin-bottom: 0;
    position: relative;
    z-index: 10;
}
.surreal-card.cover-mode .card-body {
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden; 
}
.cover-top {
    flex: 2; 
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 5vh;
    position: relative;
    z-index: 5; 
}
.cover-top h1 {
    font-size: clamp(3vh, 5vh, 40px);
    font-weight: 800;
    margin-bottom: 2vh;
    line-height: 1.2;
    background: linear-gradient(135deg, #FFF, var(--copper, #d4af37));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
.cover-top p {
    font-size: var(--font-size-body, 16px);
    line-height: 1.6;
    max-width: 800px;
    margin-bottom: 4vh;
    color: var(--text-muted, #888);
}
.cover-bottom {
    flex: 1; 
    display: flex;
    justify-content: center;
    align-items: flex-end; 
    width: 100%;
    min-height: 0; 
    position: relative;
    z-index: 5; 
}
.alina-cover-img {
    width: 100%; 
    height: 100%; 
    object-fit: contain; 
    object-position: bottom center; 
    display: block;
    transform: scale(1.2);
    transform-origin: bottom center;
}

@media (max-width: 768px), (max-height: 650px) {
    .surreal-card.cover-mode {
        height: auto !important; 
        min-height: 0 !important;
    }
    .surreal-card.cover-mode .card-header {
        padding: 2.5vh 3vh 0 3vh;
    }
    .cover-top {
        flex: none;
        padding: 0 3vh;
        margin-top: 2vh; 
        margin-bottom: 2vh;
    }
    .cover-top h1 {
        font-size: clamp(28px, 8.5vw, 36px); 
        margin-bottom: 1.5vh;
        word-break: keep-all; 
        overflow-wrap: normal;
        hyphens: none;
    }
    .cover-top p {
        margin-bottom: 3vh;
    }
    .cover-bottom {
        flex: none; 
        width: 100%;
        display: block; 
    }
    .alina-cover-img {
        transform: none;
        width: 100%; 
        height: auto; 
        object-fit: contain; 
        object-position: top center; 
        display: block;
    }

    .context-split {
        display: block;
    }
    .context-image-desktop {
        display: none; 
    }
    
    .surreal-card.context-mode {
        display: flex;
        flex-direction: column;
        height: auto !important; 
    }
    
    .surreal-card.context-mode .card-body {
        flex: none; 
        overflow: visible;
        margin-bottom: 1vh;
    }
    
    .context-image-mobile {
        display: flex; 
        justify-content: center;
        align-items: flex-start; 
        width: 100%;
        margin-top: 2vh;
        padding-bottom: 2vh; 
    }
    
    .context-image-mobile img {
        width: 100%;
        height: auto; 
        max-height: 45vh; 
        object-fit: contain;
        object-position: top center; 
    }
}
`;
document.head.appendChild(calcStyle);

// --- SCORM SAVE/LOAD ЛОГИКА И МОДАЛКИ ---
function saveProgress() {
    const stateClone = { ...state, visitedScreens: Array.from(state.visitedScreens) };
    SCORM.set("cmi.suspend_data", JSON.stringify(stateClone));
    SCORM.commit();
}

function showModal(text, buttons) {
    let overlay = document.getElementById('surreal-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'surreal-modal-overlay';
        overlay.className = 'surreal-modal-overlay';
        overlay.innerHTML = `
            <div class="surreal-modal">
                <h2 id="surreal-modal-text"></h2>
                <div class="modal-buttons" id="surreal-modal-buttons"></div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('surreal-modal-text').innerText = text;
    const btnContainer = document.getElementById('surreal-modal-buttons');
    btnContainer.innerHTML = '';
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = b.class;
        btn.innerText = b.text;
        btn.onclick = b.action;
        btnContainer.appendChild(btn);
    });
    overlay.classList.add('show');
}

function hideModal() {
    const overlay = document.getElementById('surreal-modal-overlay');
    if (overlay) overlay.classList.remove('show');
}

function promptResume() {
    showModal(
        "У вас есть сохраненный прогресс. Продолжить с момента остановки или начать сначала?",
        [
            { text: "Продолжить", class: "btn-surreal", action: () => {
                hideModal();
                state = { ...state, ...window.savedState, visitedScreens: new Set(window.savedState.visitedScreens || []) };
                render();
            }},
            { text: "Начать сначала", class: "btn-surreal btn-secondary", action: () => {
                hideModal();
                initShuffle();
                saveProgress();
                render();
            }}
        ]
    );
}

function renderCalculator() {
if (document.getElementById('surreal-calculator')) return;
const calcDiv = document.createElement('div');
calcDiv.id = 'surreal-calculator';
calcDiv.className = 'surreal-calc-popup';
calcDiv.innerHTML = `<div class="calc-header">             <span>Калькулятор</span>             <span class="calc-close" onclick="toggleCalculator(false)">✕</span>         </div>         <div class="calc-display" id="calc-display">0</div>         <div class="calc-grid">             <button class="calc-btn operator" onclick="inputCalc('clear')">C</button>             <button class="calc-btn operator" onclick="inputCalc('sign')">±</button>             <button class="calc-btn operator" onclick="inputCalc('percent')">%</button>             <button class="calc-btn operator" onclick="inputCalc('operator', '/')">/</button>             <button class="calc-btn" onclick="inputCalc('digit', '7')">7</button>             <button class="calc-btn" onclick="inputCalc('digit', '8')">8</button>             <button class="calc-btn" onclick="inputCalc('digit', '9')">9</button>             <button class="calc-btn operator" onclick="inputCalc('operator', '*')">×</button>             <button class="calc-btn" onclick="inputCalc('digit', '4')">4</button>             <button class="calc-btn" onclick="inputCalc('digit', '5')">5</button>             <button class="calc-btn" onclick="inputCalc('digit', '6')">6</button>             <button class="calc-btn operator" onclick="inputCalc('operator', '-')">−</button>             <button class="calc-btn" onclick="inputCalc('digit', '1')">1</button>             <button class="calc-btn" onclick="inputCalc('digit', '2')">2</button>             <button class="calc-btn" onclick="inputCalc('digit', '3')">3</button>             <button class="calc-btn operator" onclick="inputCalc('operator', '+')">+</button>             <button class="calc-btn" onclick="inputCalc('digit', '0')" style="grid-column: span 2;">0</button>             <button class="calc-btn" onclick="inputCalc('decimal', '.')">,</button>             <button class="calc-btn equals" onclick="inputCalc('operator', '=')">=</button>         </div>`;
document.body.appendChild(calcDiv);
}

function toggleCalculator(forceClose = null) {
if (!document.getElementById('surreal-calculator')) renderCalculator();
const calc = document.getElementById('surreal-calculator');
if (forceClose === false) {
calc.classList.remove('show');
calcState.isVisible = false;
} else if (forceClose === true) {
calc.classList.add('show');
calcState.isVisible = true;
} else {
calc.classList.toggle('show');
calcState.isVisible = !calcState.isVisible;
}
}

function updateCalcDisplay() {
const display = document.getElementById('calc-display');
if (display) display.innerText = calcState.displayValue.replace('.', ',');
}

function inputCalc(type, value) {
if (type === 'digit') {
if (calcState.waitingForSecondOperand) {
calcState.displayValue = value;
calcState.waitingForSecondOperand = false;
} else {
calcState.displayValue = calcState.displayValue === '0' ? value : calcState.displayValue + value;
}
} else if (type === 'decimal') {
if (calcState.waitingForSecondOperand) {
calcState.displayValue = '0.';
calcState.waitingForSecondOperand = false;
return updateCalcDisplay();
}
if (!calcState.displayValue.includes('.')) calcState.displayValue += '.';
} else if (type === 'clear') {
calcState.displayValue = '0';
calcState.firstOperand = null;
calcState.waitingForSecondOperand = false;
calcState.operator = null;
} else if (type === 'sign') {
calcState.displayValue = String(parseFloat(calcState.displayValue) * -1);
} else if (type === 'percent') {
calcState.displayValue = String(parseFloat(calcState.displayValue) / 100);
} else if (type === 'operator') {
const inputValue = parseFloat(calcState.displayValue);
if (calcState.operator && calcState.waitingForSecondOperand) {
calcState.operator = value;
return;
}
if (calcState.firstOperand == null && !isNaN(inputValue)) {
calcState.firstOperand = inputValue;
} else if (calcState.operator) {
let result = 0;
const prev = calcState.firstOperand;
if (calcState.operator === '+') result = prev + inputValue;
else if (calcState.operator === '-') result = prev - inputValue;
else if (calcState.operator === '*') result = prev * inputValue;
else if (calcState.operator === '/') result = prev / inputValue;
else result = inputValue;

        calcState.displayValue = String(parseFloat(result.toFixed(7)));
        calcState.firstOperand = result;
    }
    calcState.waitingForSecondOperand = true;
    calcState.operator = value;
}
updateCalcDisplay();

}

const cases = [
{
id: 1,
title: "В котором Алина мечтает открыть фотостудию",
contextImage: "alina-situation1.png",
context: "Алина — фотограф. Она уже несколько лет снимает семейные праздники и делает контент для брендов. Заказов стало так много, что <b>Алина загорелась идеей открыть собственную фотостудию.</b><br> В её планах всё выглядит идеально, но на деле требуются серьёзные вложения: нужны деньги на аренду помещения, ремонт, профессиональное световое оборудование, мебель и рекламу.",
taskText: "Алина поставила перед собой финансовую цель: <b>накопить на открытие фотостудии за 8 месяцев</b>. <p>Что можно улучшить при постановке этой цели?</p> <div style=\"color: var(--text-muted); font-size: 1.8vh; margin-top: 2vh; text-transform: uppercase; letter-spacing: 1px;\">Может быть несколько вариантов ответа.</div>",
tasks: [
{ type: 'checkbox', weight: 20,
options: [
"Сейчас в цели не хватает конкретики: какого формата будет студия, где она будет находиться, какое оборудование понадобится",
"В цели отсутствует сумма, которую необходимо накопить для запуска студии",
"Цель сформулирована правильно, улучшать ничего не нужно",
"Срок 8 месяцев точно нереалистичен для такой цели, поэтому его сразу нужно увеличить"
], correct: [0, 1] }
],
explanation: "Чтобы финансовая цель была поставлена грамотно, в ней должно быть больше конкретики. Алине нужно понять, какую именно студию хочет открыть: маленькую интерьерную, большую с несколькими залами или студию только для предметной съёмки. От этого будет зависеть и сумма. <p>Сейчас в цели нет и самой суммы — а без неё невозможно понять, сколько нужно откладывать каждый месяц.</p> <p>А вот утверждать, что 8 месяцев — это обязательно нереалистичный срок, нельзя: мы не знаем, сколько Алина уже накопила, какой у неё доход и есть ли дополнительная помощь.</p>"
},
{
id: 2,
title: "В котором Алина ищет скрытые резервы",
context: `Брать кредит на открытие бизнеса страшно. Прежде чем лезть в долги, Алина решила провести честную ревизию своих финансов.<br><br><b>Пассивы и активы Алины:</b> <div class="info-grid">     <div class="info-cell top-left">         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>         <span>Фотоаппарат, объективы и свет для съёмки</span>     </div>     <div class="info-cell top-right">         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>         <span>Деньги на банковском вкладе</span>     </div>     <div class="info-cell bottom-left">         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="2" y1="8" x2="22" y2="8"></line><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="10" y1="6" x2="10.01" y2="6"></line><polyline points="7 12 9 16 12 12 15 16 17 12"></polyline></svg>         <span>Сайт-портфолио, через который приходят клиенты</span>     </div>     <div class="info-cell bottom-right">         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19h7a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"></path><path d="M21 11h-3a2 2 0 0 0 0 4h3"></path><line x1="19" y1="13" x2="19.01" y2="13"></line><circle cx="7" cy="16" r="5"></circle><polyline points="7 14 7 16 8.5 17.5"></polyline></svg>         <span>Потребительский кредит на ремонт в квартире</span>     </div> </div>`,
taskText: "Давай проанализируем пассивы и активы вместе с Алиной. Обращай внимание на указанные в ответах типы активов. <div style=\"color: var(--text-muted); font-size: 1.8vh; margin-top: 2vh; text-transform: uppercase; letter-spacing: 1px;\">Выбери верные утверждения.</div>",
tasks: [
{ text: "Вопрос 1 из 4", type: 'radio', weight: 5, options: ["Фотоаппарат и оборудование — материальный актив, который можно продать и получить доход", "Фотоаппарат и оборудование — нематериальный актив, который можно продать"], correct: [0] },
{ text: "Вопрос 2 из 4", type: 'radio', weight: 5, options: ["Сайт-портфолио — нематериальный актив, потому что он помогает получать клиентов", "Сайт-портфолио — пассив, потому что на него когда-то были потрачены деньги"], correct: [0] },
{ text: "Вопрос 3 из 4", type: 'radio', weight: 5, options: ["Деньги на банковском вкладе — материальный актив Алины", "Деньги на банковском вкладе — пассив Алины, потому что они не вложены в бизнес"], correct: [0] },
{ text: "Вопрос 4 из 4", type: 'radio', weight: 5, options: ["Кредит на ремонт — пассив, потому что требует регулярных выплат", "Кредит на ремонт — актив, потому что ремонт повышает комфорт жизни"], correct: [0] }
],
explanation: "Оборудование (фотоаппарат, объективы, свет) — это материальные активы: они существуют физически, их можно продать и получить деньги. <p>Сайт-портфолио — это нематериальный актив. У него нет физической формы, но он помогает Алине привлекать клиентов и зарабатывать.</p> <p>Деньги на вкладе — это материальный актив, причём самый ликвидный из всех (то есть его проще всего превратить в наличные).</p><p>А вот кредит на ремонт — это пассив, потому что он не приносит доходов, а наоборот, создаёт обязательства и требует от Алины регулярных расходов.</p>"
},
{
id: 3,
title: "В котором Алина считает долговую нагрузку",
contextImage: "alina-situation3.png",
context: "У Алины есть действующий потребительский кредит. При этом ей <b>хочется уже сейчас начать инвестировать</b> небольшие суммы, чтобы «деньги не лежали без дела». Но сначала нужно понять, позволяет ли это её финансовая ситуация.",
taskText: "Ежемесячный платёж Алины по кредиту на ремонт — 18 000 рублей. Средний месячный доход Алины состоит из зарплаты в 50 000 рублей и дохода от фотосъёмок в 20 000 рублей. Рассчитай объём долговой нагрузки Алины. Для этого можешь воспользоваться формулой:<br><br><div style=\"display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; background: var(--surface-pressed); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 3vh 2vh; margin: 1vh 0 2vh 0; color: var(--copper); box-shadow: inset 0 4px 10px rgba(0,0,0,0.2);\"><div style=\"display: flex; align-items: center; justify-content: center; gap: 1.5vh; flex-wrap: nowrap; max-width: 100%;\"><div style=\"display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex-shrink: 1;\"><div style=\"padding-bottom: 1vh; line-height: 1.2; font-size: clamp(12px, 1.8vh, 16px);\">Ежемесячные платежи по всем кредитам</div><div style=\"height: 1px; background-color: var(--copper); width: 100%;\"></div><div style=\"padding-top: 1vh; line-height: 1.2; font-size: clamp(12px, 1.8vh, 16px);\">Среднемесячный доход</div></div><div style=\"display: flex; align-items: center; gap: 1vh; font-weight: 700; white-space: nowrap; flex-shrink: 0;\"><div style=\"font-size: clamp(16px, 3vh, 26px); font-weight: 300;\">×</div><div style=\"font-size: clamp(12px, 1.8vh, 16px);\">100%</div></div></div></div><div style=\"display: flex; align-items: center; gap: 1vh; cursor: pointer; margin-bottom: 2vh; width: fit-content; opacity: 0.8; transition: opacity 0.2s;\" onmouseover=\"this.style.opacity='1'\" onmouseout=\"this.style.opacity='0.8'\" onclick=\"toggleCalculator()\"><div style=\"color: var(--text-muted); font-size: 1.8vh; text-transform: uppercase; letter-spacing: 1px;\">ПРИ НЕОБХОДИМОСТИ ИСПОЛЬЗУЙ КАЛЬКУЛЯТОР</div><svg style=\"color: var(--copper); width: 2.5vh; height: 2.5vh;\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\" ry=\"2\"></rect><line x1=\"8\" y1=\"6\" x2=\"16\" y2=\"6\"></line><line x1=\"16\" y1=\"14\" x2=\"16\" y2=\"14.01\"></line><line x1=\"16\" y1=\"10\" x2=\"16\" y2=\"10.01\"></line><line x1=\"16\" y1=\"18\" x2=\"16\" y2=\"18.01\"></line><line x1=\"12\" y1=\"14\" x2=\"12\" y2=\"14.01\"></line><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"10.01\"></line><line x1=\"12\" y1=\"18\" x2=\"12\" y2=\"18.01\"></line><line x1=\"8\" y1=\"14\" x2=\"8\" y2=\"14.01\"></line><line x1=\"8\" y1=\"10\" x2=\"8\" y2=\"10.01\"></line><line x1=\"8\" y1=\"18\" x2=\"8\" y2=\"18.01\"></line></svg></div>",
tasks: [
{ text: "Введи получившийся процент (округли до целого числа):", type: 'input', suffix: '%', weight: 10, correct: "26" },
{ type: 'info', content: `<div style=\"display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; background: var(--surface-pressed); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 3vh 2vh; margin: 1vh 0 3vh 0; color: var(--copper); box-shadow: inset 0 4px 10px rgba(0,0,0,0.2);\"><div style=\"display: flex; align-items: center; justify-content: center; gap: 1vh; flex-wrap: nowrap; max-width: 100%;\"><div style=\"display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; line-height: 1.2; flex-shrink: 1;\"><div style=\"padding-bottom: 1vh; font-weight: 500; font-size: clamp(14px, 2vh, 16px);\">18 000</div><div style=\"height: 1px; background-color: var(--copper); width: 100%;\"></div><div style=\"padding-top: 1vh; font-weight: 500; font-size: clamp(14px, 2vh, 16px);\">50 000 + 20 000</div></div><div style=\"display: flex; align-items: center; gap: 1vh; font-weight: 700; white-space: nowrap; font-size: clamp(14px, 2vh, 16px); flex-shrink: 0;\"><div style=\"font-size: clamp(16px, 4vh, 32px); font-weight: 300; transform: translateY(0.5vh);\">*</div><div>100%</div><div>=</div><div>26%</div></div></div></div>Сумма ежемесячных платежей Алины составляет 18 000 рублей. Делим это число на 70 000 рублей (зарплата Алины + доход от фотосъёмок). Получаем примерно 0,26. Умножаем на 100% и получаем показатель долговой нагрузки в 26%.`
},
{ questionText: "Показатель объёма долговой нагрузки Алины — 26%. Может ли она при такой долговой нагрузке позволить себе инвестировать часть средств?", type: 'radio', weight: 10, options: ["Это слишком высокий показатель, Алине нельзя думать об инвестициях", "Это комфортный показатель: Алина может инвестировать, если есть подушка безопасности", "Долговая нагрузка критическая, весь доход нужно направлять на погашение кредита"], correct: [1] }
],
explanation: "<div style=\"border: 1px solid var(--copper); border-radius: 16px; padding: 2vh 3vh; margin-bottom: 2vh; text-align: center;\">Комфортным обычно считается уровень долговой нагрузки примерно до 25-30%.</div> У Алины этот показатель — 26%, то есть он находится в допустимых пределах. Это значит, что она может осторожно задумываться об инвестициях, но только если контролирует бюджет, не допускает просрочек и уже создала хотя бы минимальную финансовую подушку."
},
{
id: 4,
title: "В котором Алина копит на обучение",
contextImage: "alina-situation4.png",
context: "Алина решила, что открытие студии пока подождёт. Сначала она <b>хочет пройти сильную профессиональную программу по коммерческой фотографии</b>, чтобы увеличить доход. Обучение стоит 180 000 рублей, деньги понадобятся через 9 месяцев.",
taskText: "Помоги Алине выбрать подходящий вариант для накопления на эту цель.",
tasks: [
{ type: 'radio', weight: 20, options: [
"Открыть накопительный счёт или вклад — это подходящий выбор для краткосрочной цели",
"Купить акции быстрорастущих компаний: за 9 месяцев они дадут высокий доход",
"Вложить деньги в криптовалюту, потому что для краткосрочной цели лучше всего подходят инструменты с высокой доходностью",
"Купить золото, потому что оно гарантированно растёт в цене"
], correct: [0] }
],
explanation: "Цель Алины краткосрочная — деньги понадобятся уже через 9 месяцев. Для таких целей обычно выбирают консервативные и предсказуемые инструменты, например накопительный счёт или вклад. Главное правило: чем короче срок, тем меньше риска должно быть в инструментах.<p>Акции и криптовалюта слишком рискованны для такого короткого срока: никто не гарантирует рост, и через 9 месяцев их цена может оказаться ниже, чем в момент покупки.</p><p>Золото считается защитным активом, но оно не гарантирует прибыль на коротком промежутке времени и больше подходит для сохранения денег на годы вперёд.</p>"
},
{
id: 5,
title: "В котором Алина задумывается о защите",
contextImage: "alina-situation5.png",
context: "Алина начала инвестировать небольшие суммы и старается делать это разумно. У неё уже есть подушка безопасности в размере трёх ежемесячных расходов, а также полис страхования здоровья. Теперь она думает, как ещё <b>усилить свой защитный блок, чтобы не бояться форс-мажоров.</b>",
taskText: "Предложи, что ещё можно сделать, чтобы <b>усилить защитный блок.</b> <div style=\"color: var(--text-muted); font-size: 1.8vh; margin-top: 2vh; text-transform: uppercase; letter-spacing: 1px;\">Выбери все подходящие варианты.</div>",
tasks: [
{ type: 'checkbox', weight: 20, options: [
"Увеличить размер подушки безопасности хотя бы до 6 ежемесячных расходов",
"Застраховать технику, с помощью которой она зарабатывает",
"Если в будущем Алина вступит в брак, рассмотреть оформление брачного договора",
"Сделать так, чтобы почти весь портфель состоял из акций",
"Полностью отказаться от подушки безопасности в пользу инвестиций, чтобы деньги быстрее росли"
], correct: [0, 1, 2] }
],
explanation: "Защитный блок — это не только инвестиции, но и всё, что помогает человеку пережить сложные ситуации без финансового кризиса. Что действительно усиливает защиту: <ul><li>подушка безопасности в размере не меньше 3, а лучше 6 ежемесячных расходов;</li><li>страхование имущества или техники, особенно если они приносят доход;</li><li>юридическая защита, например брачный договор в подходящей жизненной ситуации.</li></ul> <p>А вот слишком большая доля акций не делает портфель защитным. Наоборот, она повышает риск. Также нельзя отказываться от подушки безопасности в пользу инвестиций: это делает финансовое положение уязвимым.</p>"
}
];

let state = {
screen: 'cover',
currentCase: 0,
currentSubTask: 0,
score: 0,
attempt: 1,
scormSubmitted: false,
progress: [null, null, null, null, null],
allAnswers: [{}, {}, {}, {}, {}],
isEvaluated: [{}, {}, {}, {}, {}],
casePoints: [0, 0, 0, 0, 0],
optionOrders: [],
visitedScreens: new Set(),
justEvaluated: false
};

const app = document.getElementById('app');

function shuffleArray(array) {
let shuffled = array.slice();
for (let i = shuffled.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
return shuffled;
}

function initShuffle() {
state.optionOrders = [];
cases.forEach((c) => {
let caseOrders = [];
c.tasks.forEach((t) => {
if (t.options) {
let originalIndices = t.options.map((_, i) => i);
caseOrders.push(shuffleArray(originalIndices));
} else {
caseOrders.push(null);
}
});
state.optionOrders.push(caseOrders);
});
}

function jumpToCase(index) {
    state.currentCase = index;
    state.currentSubTask = 0;
    changeScreen('context');
}

function render() {
let screenKey = state.screen;
if (['case_cover', 'context', 'task', 'explanation'].includes(state.screen)) {
    screenKey += '_' + state.currentCase;
}
if (state.screen === 'task') {
    screenKey += '_' + state.currentSubTask;
}

const isVisited = state.visitedScreens.has(screenKey);
state.visitedScreens.add(screenKey);

const animate = (cls) => isVisited ? '' : cls;

app.innerHTML = '';

const layout = document.createElement('div'); layout.className = 'task-layout';
const cardWrapper = document.createElement('div'); cardWrapper.className = 'card-wrapper';
const card = document.createElement('div'); card.className = 'surreal-card';

const isTaskPhase = ['context', 'task', 'explanation'].includes(state.screen);

if (state.screen === 'cover') {
card.classList.add('cover-mode');
card.classList.add('animated-cover-bg');
} else if (state.screen === 'case_cover') {
    card.classList.add('case-cover-layout');
}

if (!isTaskPhase) {
card.classList.add('embossed-texture');
}

// --- ШАПКА КАРТОЧКИ ---
const header = document.createElement('div'); header.className = 'card-header';
if (isTaskPhase) {
const pts = state.screen === 'task' ? calculateStepPoints(state.currentSubTask) : 0;
let nodesHTML = '';
for(let i=0; i<5; i++) {
    let statusClass = state.progress[i] === 'success' ? 'success' : state.progress[i] === 'fail' ? 'fail' : i === state.currentCase ? 'active' : '';
    
    let clickHTML = '';
    let clickableClass = '';
    if (state.progress[i] !== null && i !== state.currentCase) {
        clickableClass = ' clickable';
        clickHTML = ` onclick="jumpToCase(${i})" title="Перейти к кейсу №${i+1}"`;
    }
    
    nodesHTML += `<div class="progress-node ${statusClass}${clickableClass}"${clickHTML}>${i+1}</div>`;
    if(i < 4) nodesHTML += `<div class="progress-line"></div>`;
}

const isEval = state.isEvaluated[state.currentCase][state.currentSubTask] || false;
let badgeAnim = '';
if (isEval && pts > 0) {
    if (state.justEvaluated) {
        badgeAnim = ' badge-pop';
        state.justEvaluated = false;
    }
}

header.innerHTML = `
    <div class="points-badge ${isEval && pts > 0 ? 'visible' : ''}${badgeAnim}">+ ${pts} баллов</div>
    <div class="surreal-progress">${nodesHTML}</div>
    <div class="close-btn" onclick="closeModule()">✕</div>
`;

} else {
header.innerHTML = `<div></div><div></div><div class="close-btn" onclick="closeModule()">✕</div>`;
}
card.appendChild(header);

// --- ТЕЛО КАРТОЧКИ ---
const body = document.createElement('div'); body.className = 'card-body';

if (state.screen === 'cover') {
body.innerHTML = `
        <div class="cover-top">
            <h1 class="${animate('slide-in-left')}">Финансовые квесты:<br>проверь, как ты управляешь бюджетом</h1>
            <p class="${animate('slide-in-right')}">Анализируй ситуации, принимай решения и помогай Алине достигать финансовых целей.</p>
            <div class="cover-nav-buttons ${animate('anim-fade-buttons')}">
                <button class="btn-surreal btn-pulse-7s" onclick="changeScreen('nav')">Приступить</button>
            </div>
        </div>
        <div class="cover-bottom ${animate('fly-in-bottom')}">
            <img src="alina-cover.png" alt="Алина" class="alina-cover-img">
        </div>
`;
} else if (state.screen === 'nav') {
body.innerHTML = `<div class="rules-split">             
    <div class="rules-text">                 
        <h1 class="${animate('fade-in-up')}">Правила прохождения</h1>                 
        <p class="${animate('fade-in-up delay-1')}">Сегодня предлагаем тебе решить пять кейсов из реальной жизни.</p>                 
        <p class="${animate('fade-in-up delay-2')}" style="color: var(--copper); font-weight: bold; margin-bottom: 2vh;">За каждый правильно решённый кейс начисляется 20 баллов. Всего ты можешь набрать 100 баллов!</p>                 
        <p class="${animate('fade-in-up delay-3')}">У тебя будет одна попытка ответить на вопросы, поэтому внимательно читай описание ситуаций.</p>             
    </div>             
    <div class="rules-image">                 
        <img src="rules.png" alt="Правила" class="${animate('image-reveal delay-3')}">             
    </div>         
</div>`;
} else if (state.screen === 'case_cover') {
    const c = cases[state.currentCase];
    const alignClass = (c.id === 1 || c.id === 3 || c.id === 5) ? 'align-right' : 'align-left';
    const animFly = (c.id === 1 || c.id === 3 || c.id === 5) ? 'fly-in-right' : 'fly-in-left';

    body.innerHTML = `
        <div class="case-cover-top">
            <h1 class="${animate('slide-in-left')}" style="font-size: clamp(40px, 6vh, 60px); color: var(--copper); margin-bottom: 3vh; background: none; -webkit-text-fill-color: var(--copper);">
                Кейс №${c.id}
            </h1>
            
            <p class="${animate('slide-in-right')}" style="font-size: clamp(20px, 3vh, 28px); color: var(--text-main); font-weight: 600; max-width: 600px; line-height: 1.4; margin-bottom: 4vh; text-align: center; margin-left: auto; margin-right: auto;">
                ${c.title}
            </p>
            
            <div class="case-nav-buttons ${animate('anim-fade-buttons')}" style="display: flex; gap: 2vh; justify-content: center; flex-wrap: wrap;">
                <button class="btn-surreal btn-secondary" onclick="goBack()">← Назад</button>
                <button class="btn-surreal btn-pulse-7s" onclick="startCase()">Посмотреть</button>
            </div>
        </div>
        <div class="case-cover-bottom ${alignClass} ${animate(animFly)}">
            <img src="case${c.id}-cover.png" alt="Обложка кейса">
        </div>
    `;

} else if (state.screen === 'results') {
// SCORM фиксирует статус "completed" и баллы только один раз (при первой попытке)
if (!state.scormSubmitted) { 
    console.log(`[SCORM] Запись баллов: ${state.score} и статуса: completed`); 
    SCORM.set("cmi.core.score.raw", state.score);
    SCORM.set("cmi.core.score.min", 0);
    SCORM.set("cmi.core.score.max", 100);
    SCORM.set("cmi.core.lesson_status", "completed");
    state.scormSubmitted = true; 
}
body.innerHTML = `<div class="content-centered">         
    <h1 class="${animate('fade-in-up')}">Твой результат</h1>         
    <h1 class="${animate('score-pop delay-1')}" style="font-size: clamp(40px, 12vw, 120px); white-space: nowrap; color: var(--copper); background: none; -webkit-text-fill-color: var(--copper);">${state.score} / 100</h1>         
    <p class="${animate('fade-in-up delay-2')}">Ты можешь ещё раз прорешать кейсы без зачисления баллов.</p>         
</div>`;
} else if (state.screen === 'final') {
body.innerHTML = `<div class="content-centered">         
    <h1 class="${animate('fade-in-up')}">Итоги марафона <br>«Управление личным бюджетом»</h1>         
    <p class="${animate('fade-in-up delay-1')}" style="color: #ffffff;">Спасибо за участие в марафоне! Надеемся, теперь тебе стало немного понятнее:</p>         
    <ul>         
        <li class="${animate('fade-in-up delay-2')}" style="color: #ffffff;">С чего начать копить на исполнение твоей мечты</li>         
        <li class="${animate('fade-in-up delay-3')}" style="color: #ffffff;">Как всё-таки достичь поставленной финансовой цели</li>         
        <li class="${animate('fade-in-up delay-4')}" style="color: #ffffff;">Как организовать бюджет так, чтобы он работал на тебя</li>         
        <li class="${animate('fade-in-up delay-5')}" style="color: #ffffff;">Как сделать первые шаги в инвестировании</li>         
    </ul>         
    <p class="${animate('fade-in-up delay-6')}" style="color: #ffffff;">Пусть твои финансы всегда будут под контролем. Удачи!</p>         
</div>`;
} else if (state.screen === 'context') {
const c = cases[state.currentCase];

if (c.contextImage) {
    card.classList.add('context-mode');
    body.innerHTML = `
        <div class="context-split">
            <div class="context-text-area">
                <div class="task-desc ${animate('fade-in-up')}"><b>Ситуация:</b><br>${c.context}</div>
            </div>
            <div class="context-image-desktop">
                <img src="${c.contextImage}" alt="Ситуация" class="${animate('image-reveal delay-1')}">
            </div>
        </div>
    `;
} else {
    body.innerHTML = `<div class="task-desc ${animate('fade-in-up')}"><b>Ситуация:</b><br>${c.context}</div>`;
}

} else if (state.screen === 'task') {
const c = cases[state.currentCase];
const tIndex = state.currentSubTask;
const task = c.tasks[tIndex];

if (task.type === 'info') {
    body.innerHTML = `<div class="exp-title ${animate('fade-in-up')}" style="margin-bottom: 2vh;">Давай разбираться!</div><div class="exp-text ${animate('fade-in-up delay-1')}">${task.content}</div>`;
} else {
    const isEval = state.isEvaluated[state.currentCase][tIndex] || false;
    
    let html = `<div class="task-desc ${animate('fade-in-up')}">${task.questionText || c.taskText}</div>`;
    if (task.text) html += `<div class="${animate('fade-in-up delay-1')}" style="color: var(--text-muted); font-size: 1.8vh; margin-bottom: 2vh; text-transform: uppercase; letter-spacing: 1px;">${task.text}</div>`;
    body.innerHTML = html;
    
    const opts = document.createElement('div'); opts.className = 'options-container';
    if (task.type === 'radio' || task.type === 'checkbox') {
        
        const order = state.optionOrders[state.currentCase][tIndex];
        let delayBase = task.text ? 2 : 1; 

        order.forEach((originalIdx, loopIdx) => {
            const opt = task.options[originalIdx]; 
            
            const btn = document.createElement('div'); btn.className = `tactile-option type-${task.type}`;
            if (!isVisited) {
                btn.classList.add('fade-in-up', 'delay-' + Math.min(delayBase + loopIdx, 6)); 
            }
            
            const saved = state.allAnswers[state.currentCase][tIndex];
            const isChecked = task.type === 'radio' ? saved === originalIdx : (saved && saved.includes(originalIdx));
            
            if (isChecked && !isEval) btn.classList.add('selected');
            if (isEval) {
                const isCorrect = task.correct.includes(originalIdx);
                if (isChecked && isCorrect) btn.classList.add('correct');
                else if (isChecked && !isCorrect) btn.classList.add('wrong');
                else if (!isChecked && isCorrect) btn.classList.add('correct'); 
            } else {
                btn.onclick = () => { updateAnswers(task.type, originalIdx, !isChecked); };
            }
            btn.innerHTML = `<div class="custom-indicator"></div><div>${opt}</div>`; 
            opts.appendChild(btn);
        });
    } else if (task.type === 'input') {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-wrapper' + (isVisited ? '' : ' fade-in-up delay-2');

        const input = document.createElement('input');
        input.type = 'number'; 
        
        if (state.allAnswers[state.currentCase][tIndex] !== undefined) {
            input.value = state.allAnswers[state.currentCase][tIndex];
        }
        
        if (isEval) {
            input.disabled = true;
            if (String(input.value).trim() === task.correct) input.classList.add('correct');
            else input.classList.add('wrong');
        } else {
            input.oninput = (e) => { updateAnswers('input', e.target.value, true); };
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = String(input.value).trim();
                    if (val !== '') {
                        const actionBtn = document.getElementById('action-btn');
                        if (actionBtn && !actionBtn.disabled) {
                            actionBtn.click();
                        }
                    }
                }
            });
        }
        
        inputWrapper.appendChild(input);

        if (task.suffix) {
            const suffix = document.createElement('div');
            suffix.className = 'input-suffix';
            suffix.innerHTML = task.suffix;
            inputWrapper.appendChild(suffix);
        }

        opts.appendChild(inputWrapper);
        
        if (!isEval) {
            setTimeout(() => input.focus(), 100);
        }
    }
    body.appendChild(opts);
}

} else if (state.screen === 'explanation') {
const c = cases[state.currentCase];
body.innerHTML = `<div class="exp-title ${animate('fade-in-up')}">Давай разбираться!</div><div class="exp-text ${animate('fade-in-up delay-1')}">${c.explanation}</div>`;
}
card.appendChild(body);

// --- НАВИГАЦИЯ (КНОПКИ ВНИЗУ) ---
const nav = document.createElement('div'); nav.className = 'nav-controls';
if (!isTaskPhase) nav.classList.add('center-align');

if (!['cover', 'case_cover'].includes(state.screen) && !isVisited) {
    nav.classList.add('anim-fade-buttons-fast');
}

const backBtnHTML = `<button class="btn-surreal btn-secondary" onclick="goBack()">← Назад</button>`;

if (state.screen === 'cover') {
nav.style.display = 'none';
} else if (state.screen === 'nav') {
nav.innerHTML = `${backBtnHTML} <button class="btn-surreal" onclick="changeScreen('case_cover')">Перейти к кейсам</button>`;
} else if (state.screen === 'case_cover') {
    nav.style.display = 'none'; 
} else if (state.screen === 'results') {
nav.innerHTML = `${backBtnHTML} <button class="btn-surreal" onclick="resetAndRetry()">Повторить</button> <button class="btn-surreal btn-secondary" onclick="changeScreen('final')">К итогам</button>`;
} else if (state.screen === 'final') {
nav.innerHTML = `<button class="btn-surreal btn-secondary" onclick="changeScreen('results')">← К результатам</button> <button class="btn-surreal" onclick="closeModule()">Завершить</button>`;
} else if (state.screen === 'context') {
nav.innerHTML = `${backBtnHTML} <button class="btn-surreal" onclick="changeScreen('task')">К заданию →</button>`;
} else if (state.screen === 'task') {
nav.innerHTML = backBtnHTML;

const actionBtn = document.createElement('button'); 
actionBtn.className = 'btn-surreal'; actionBtn.id = 'action-btn';

const c = cases[state.currentCase];
const task = c.tasks[state.currentSubTask];

if (task.type === 'info') {
    actionBtn.innerHTML = 'Далее →';
    actionBtn.onclick = () => {
        if (state.currentSubTask === c.tasks.length - 1) {
            if (!state.progress[state.currentCase]) {
                state.progress[state.currentCase] = state.casePoints[state.currentCase] === 20 ? 'success' : 'fail';
            }
            changeScreen('explanation');
        } else { 
            state.currentSubTask++; 
            render(); 
        }
    };
} else {
    const ans = state.allAnswers[state.currentCase][state.currentSubTask];
    const hasAns = ans !== undefined && ans !== null && String(ans).trim() !== '' && (!Array.isArray(ans) || ans.length > 0);
    const isEval = state.isEvaluated[state.currentCase][state.currentSubTask] || false;
    
    if (!isEval) {
        actionBtn.innerHTML = 'Ответить';
        actionBtn.disabled = !hasAns;
        actionBtn.onclick = () => {
            state.isEvaluated[state.currentCase][state.currentSubTask] = true; 
            state.justEvaluated = true;
            
            const pts = calculateStepPoints(state.currentSubTask);
            state.casePoints[state.currentCase] += pts;
            
            state.score += pts; 
            saveProgress(); 
            render();
        };
    } else {
        actionBtn.innerHTML = 'Далее →';
        actionBtn.onclick = () => {
            if (state.currentSubTask === c.tasks.length - 1) {
                if (!state.progress[state.currentCase]) {
                    state.progress[state.currentCase] = state.casePoints[state.currentCase] === 20 ? 'success' : 'fail';
                }
                changeScreen('explanation');
            } else { 
                state.currentSubTask++; 
                render(); 
            }
        };
    }
}
nav.appendChild(actionBtn);

} else if (state.screen === 'explanation') {
const nextText = state.currentCase === cases.length - 1 ? 'К результатам' : 'Следующий кейс →';
nav.innerHTML = `${backBtnHTML} <button class="btn-surreal" onclick="nextFromExplanation()">${nextText}</button>`;
}

card.appendChild(nav);

// ДОБАВЛЯЕМ КАРТИНКУ ПОД КНОПКИ ДЛЯ МОБИЛЬНЫХ (КЕЙСЫ)
if (state.screen === 'context' && cases[state.currentCase].contextImage) {
const mobileImgDiv = document.createElement('div');
mobileImgDiv.className = 'context-image-mobile';
mobileImgDiv.innerHTML = `<img src="${cases[state.currentCase].contextImage}" alt="Ситуация" class="${animate('image-reveal delay-1')}">`;
card.appendChild(mobileImgDiv);
}

// ДОБАВЛЯЕМ КАРТИНКУ ПОД КНОПКИ ДЛЯ ЭКРАНА ПРАВИЛ
if (state.screen === 'nav') {
const rulesMobileImg = document.createElement('div');
rulesMobileImg.className = 'rules-image-mobile';
rulesMobileImg.innerHTML = `<img src="rules.png" alt="Правила" class="${animate('image-reveal delay-3')}">`;
card.appendChild(rulesMobileImg);
}

cardWrapper.appendChild(card);
layout.appendChild(cardWrapper);
app.appendChild(layout);

}

function changeScreen(s) {
state.screen = s;
if (typeof toggleCalculator === 'function') toggleCalculator(false);
saveProgress();
render();
}

function startCase() {
state.currentSubTask = 0;
changeScreen('context');
}

function nextFromExplanation() {
if (state.currentCase < cases.length - 1) {
state.currentCase++;
changeScreen('case_cover');
} else {
changeScreen('results');
}
}

function goBack() {
if (state.screen === 'nav') {
changeScreen('cover');
} else if (state.screen === 'case_cover') {
if (state.currentCase === 0) {
changeScreen('nav');
} else {
state.currentCase--;
changeScreen('explanation');
}
} else if (state.screen === 'context') {
changeScreen('case_cover');
} else if (state.screen === 'task') {
if (state.currentSubTask === 0) {
changeScreen('context');
} else {
state.currentSubTask--;
changeScreen('task');
}
} else if (state.screen === 'explanation') {
state.currentSubTask = cases[state.currentCase].tasks.length - 1;
changeScreen('task');
} else if (state.screen === 'results') {
state.currentCase = cases.length - 1;
changeScreen('explanation');
}
}

function updateAnswers(type, val, isChecked) {
const c = state.currentCase;
const t = state.currentSubTask;

if (type === 'radio' || type === 'input') state.allAnswers[c][t] = type === 'radio' ? parseInt(val) : val;
else {
if (!state.allAnswers[c][t]) state.allAnswers[c][t] = [];
const arr = state.allAnswers[c][t];
if (isChecked) arr.push(parseInt(val)); else state.allAnswers[c][t] = arr.filter(v => v !== parseInt(val));
}
if (type === 'input') checkActionButtonState();
else render();
}

function checkActionButtonState() {
const btn = document.getElementById('action-btn');
if (!btn) return;
const ans = state.allAnswers[state.currentCase][state.currentSubTask];
btn.disabled = !(ans !== undefined && ans !== null && String(ans).trim() !== '' && (!Array.isArray(ans) || ans.length > 0));
}

function calculateStepPoints(tIndex) {
const task = cases[state.currentCase].tasks[tIndex];
if (task.type === 'info') return 0;
const ans = state.allAnswers[state.currentCase][tIndex];
if (ans === undefined) return 0;
if (task.type === 'radio' && task.correct.includes(ans)) return task.weight;
if (task.type === 'checkbox' && JSON.stringify([...task.correct].sort()) === JSON.stringify([...ans].sort())) return task.weight;
if (task.type === 'input' && String(ans).trim() === task.correct) return task.weight;
return 0;
}

function resetAndRetry() {
state.attempt++;
state.score = 0;
state.currentCase = 0;
state.currentSubTask = 0;

state.progress = [null, null, null, null, null];
state.allAnswers = [{}, {}, {}, {}, {}];
state.isEvaluated = [{}, {}, {}, {}, {}];
state.casePoints = [0, 0, 0, 0, 0];
state.visitedScreens.clear();
state.justEvaluated = false;

initShuffle();

changeScreen('case_cover');
}

function closeModule() {
if (typeof toggleCalculator === 'function') toggleCalculator(false);
showModal(
    "Ты точно хочешь закрыть курс и перейти на платформу?",
    [
        { text: "Остаться", class: "btn-surreal", action: hideModal },
        { text: "Закрыть", class: "btn-surreal btn-secondary", action: () => {
            hideModal();
            saveProgress();
            SCORM.finish();
            if (window.parent && window.parent !== window) window.parent.close();
            window.close();
        }}
    ]
);
}

// --- ФОНОВАЯ АСИНХРОННАЯ ПРЕДЗАГРУЗКА КАРТИНОК ---
function preloadImagesAsync() {
    const imagesToPreload = [
        'alina-cover.png', 'rules.png', 'pattern.jpg', 'pattern2.jpg',
        'case1-cover.png', 'case2-cover.png', 'case3-cover.png', 'case4-cover.png', 'case5-cover.png',
        'alina-situation1.png', 'alina-situation3.png', 'alina-situation4.png', 'alina-situation5.png'
    ];
    setTimeout(() => {
        imagesToPreload.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }, 500); 
}

// === ИНИЦИАЛИЗАЦИЯ КУРСА С ПОДДЕРЖКОЙ SCORM ===
function bootstrapApp() {
    SCORM.init();
    const savedData = SCORM.get("cmi.suspend_data");
    
    if (savedData) {
        try {
            window.savedState = JSON.parse(savedData);
            initShuffle(); 
            render();      
            promptResume();
        } catch (e) {
            initShuffle();
            render();
        }
    } else {
        initShuffle();
        render();
    }
    
    // Запускаем предзагрузку картинок в фоне уже ПОСЛЕ отрисовки интерфейса
    preloadImagesAsync();
}

// Запускаем как только DOM готов, чтобы не ждать загрузки тяжелых файлов
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
    bootstrapApp();
}

window.addEventListener("beforeunload", function() {
    saveProgress();
    SCORM.finish();
});