// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Theme toggle (remembered per browser)
const root = document.documentElement;
try {
  const saved = localStorage.getItem("theme");
  if (saved) root.dataset.theme = saved;
} catch {}
document.querySelector(".theme-toggle").addEventListener("click", () => {
  const isDark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = isDark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
});

// Mobile menu
const menuBtn = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
menuBtn.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  })
);

// Works filter
const chips = document.querySelectorAll(".chip");
const cards = document.querySelectorAll(".card");
chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.toggle("active", c === chip));
    const f = chip.dataset.filter;
    cards.forEach((card) =>
      card.classList.toggle("hidden", f !== "all" && card.dataset.cat !== f)
    );
  })
);

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.1 }
);
document.querySelectorAll(".section h2, .card, .news li, .facts").forEach((el) => {
  el.classList.add("reveal");
  io.observe(el);
});

// Contact form (demo only — connect to a service like Formspree to actually send)
document.querySelector(".contact-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const status = form.querySelector(".form-status");
  if (!form.checkValidity()) {
    status.textContent = "未入力の項目があります。";
    return;
  }
  status.textContent = "送信ありがとうございました！（デモ表示です）";
  form.reset();
});
