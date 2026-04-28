// ============================
// Typewriter effect for code window
// ============================
const codeLines = [
  { ln: '1',  html: '<span class="cm">// 👋 바이브 코딩 시작!</span>' },
  { ln: '2',  html: '' },
  { ln: '3',  html: '<span class="kw">import</span> { AI } <span class="kw">from</span> <span class="str">"vibe-coding"</span>' },
  { ln: '4',  html: '' },
  { ln: '5',  html: '<span class="kw">const</span> <span class="fn">buildApp</span> = <span class="kw">async</span> () => {' },
  { ln: '6',  html: '  <span class="kw">const</span> idea = <span class="str">"쇼핑몰 만들어줘"</span>' },
  { ln: '7',  html: '  <span class="kw">const</span> app = <span class="kw">await</span> AI.<span class="fn">generate</span>(idea)' },
  { ln: '8',  html: '' },
  { ln: '9',  html: '  <span class="cm">// ✅ 완성! 배포 중...</span>' },
  { ln: '10', html: '  <span class="kw">return</span> app.<span class="fn">deploy</span>()' },
  { ln: '11', html: '}' },
  { ln: '12', html: '' },
  { ln: '13', html: '<span class="fn">buildApp</span>() <span class="cm">// 🚀 Done!</span>' },
];

const codeBody = document.getElementById('codeBody');
let lineIndex = 0;

function renderLine(line) {
  const el = document.createElement('div');
  el.className = 'code-line';
  el.innerHTML = `<span class="ln">${line.ln}</span><span>${line.html}</span>`;
  return el;
}

function typeLine() {
  if (lineIndex >= codeLines.length) {
    // Restart after pause
    setTimeout(() => {
      codeBody.innerHTML = '';
      lineIndex = 0;
      typeLine();
    }, 3000);
    return;
  }

  const el = renderLine(codeLines[lineIndex]);
  codeBody.appendChild(el);
  lineIndex++;

  const delay = codeLines[lineIndex - 1].html === '' ? 100 : 220;
  setTimeout(typeLine, delay);
}

// Start after a short delay
setTimeout(typeLine, 800);

// ============================
// Scroll reveal
// ============================
const revealEls = document.querySelectorAll(
  '.feature-card, .step, .stack-pill, .section-header'
);

revealEls.forEach(el => el.classList.add('reveal'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealEls.forEach(el => observer.observe(el));

// ============================
// Mobile menu
// ============================
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

mobileMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ============================
// CTA Form
// ============================
const ctaForm = document.getElementById('ctaForm');
ctaForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = ctaForm.querySelector('input').value;
  if (email) {
    ctaForm.innerHTML = `<div style="color:#a6e3a1; font-size:1.1rem; font-weight:600;">
      ✅ 감사합니다! <strong>${email}</strong>로 초대장을 보내드릴게요 🎉
    </div>`;
  }
});

// ============================
// Stagger animation for stack pills
// ============================
document.querySelectorAll('.stack-pill').forEach((pill, i) => {
  pill.style.transitionDelay = `${i * 40}ms`;
});
