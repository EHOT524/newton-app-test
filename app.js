// Пробное приложение: урок «Формулы» по физике. Вопросы и проверку ответов делает код бота, запущенный в браузере.

const PYODIDE = "https://ehot524.github.io/pyodide/"; // Python для браузера уже лежит на сайте с опытами
const BUNDLE = "bot.zip?v=1";
const STORE_KEY = "progress";
const XP_PER_ANSWER = 10;
const XP_PERFECT_BONUS = 20;
const LESSON_SIZE = 10;
const MAX_MISTAKES = 300; // в облаке Telegram на одно значение 4096 символов
const PRAISE = ["Отлично! 💪", "Верно! 🎉", "Так держать! ✨", "Правильно! 🚀", "Супер! 🔥"];
const LEVEL_HINTS = { easy: "4 варианта", medium: "8 вариантов", hard: "пишешь сам" };

const $ = (id) => document.getElementById(id);
const tg = window.Telegram?.WebApp;
let api, info, progress, lesson;

// ---------- прогресс: облако Telegram, а вне Telegram память браузера ----------

const cloud = tg?.CloudStorage && tg.isVersionAtLeast?.("6.9") ? tg.CloudStorage : null;
// Скрипт Telegram грузится и в обычном браузере, но там его окна и кнопки бросают ошибку
const popups = tg?.isVersionAtLeast?.("6.2") ?? false;
const backButton = tg?.isVersionAtLeast?.("6.1") ? tg.BackButton : null;

function alertBox(text) {
  popups ? tg.showAlert(text) : alert(text);
}

function confirmBox(text, onYes) {
  if (popups) tg.showConfirm(text, (yes) => yes && onYes());
  else if (confirm(text)) onYes();
}

function emptyProgress() {
  return { xp: 0, streak: 0, best: 0, last: null, lessons: 0, answered: 0, correct: 0, mistakes: [], mode: null, level: null };
}

function parse(raw) {
  try { return { ...emptyProgress(), ...JSON.parse(raw) }; } catch { return emptyProgress(); }
}

function loadLocal() {
  try { return parse(localStorage.getItem(STORE_KEY)); } catch { return emptyProgress(); }
}

function loadProgress() {
  if (!cloud) return Promise.resolve(loadLocal());
  return new Promise((resolve) => {
    cloud.getItem(STORE_KEY, (err, value) => resolve(err || !value ? loadLocal() : parse(value)));
  });
}

function saveProgress() {
  progress.mistakes = progress.mistakes.slice(-MAX_MISTAKES);
  const raw = JSON.stringify(progress);
  try { localStorage.setItem(STORE_KEY, raw); } catch {}
  if (cloud) cloud.setItem(STORE_KEY, raw, () => {});
}

// Дни стрика считаются по Москве, как в боте
function moscowDay(offsetDays = 0) {
  return new Date(Date.now() + 3 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
}

function currentStreak() {
  return progress.last && progress.last >= moscowDay(-1) ? progress.streak : 0;
}

// ---------- запуск ----------

async function boot() {
  tg?.ready();
  tg?.expand();
  try {
    $("loading-text").textContent = "Загружаем Python… В первый раз это занимает несколько секунд.";
    const { loadPyodide } = await import(PYODIDE + "pyodide.mjs");
    const py = await loadPyodide({ indexURL: PYODIDE });
    $("loading-text").textContent = "Загружаем задания…";
    const bundle = await fetch(BUNDLE);
    if (!bundle.ok) throw new Error(`задания не загрузились (${bundle.status})`);
    py.unpackArchive(await bundle.arrayBuffer(), "zip");
    api = py.pyimport("webapi");
    info = JSON.parse(api.info());
    progress = await loadProgress();
  } catch (e) {
    console.error(e);
    $("loading-text").innerHTML = "⚠️ Не получилось загрузить приложение. Проверь интернет и открой его ещё раз.";
    document.querySelector(".spinner").hidden = true;
    return;
  }
  progress.mode ||= "ege";
  progress.level ||= "easy";
  buildHome();
  show("home");
}

function show(screen) {
  for (const id of ["loading", "home", "lesson", "result"]) $(id).hidden = id !== screen;
  $("sheet").hidden = true;
  window.scrollTo(0, 0);
  if (backButton) screen === "lesson" ? backButton.show() : backButton.hide();
}

function haptic(kind) {
  try { tg?.HapticFeedback?.notificationOccurred(kind); } catch {}
}

// ---------- главная ----------

function chip(text, on, onClick) {
  const b = document.createElement("button");
  b.className = "chip" + (on ? " on" : "");
  b.innerHTML = text;
  b.onclick = onClick;
  return b;
}

function buildHome() {
  $("xp").textContent = progress.xp;
  $("streak").textContent = currentStreak();
  $("modes").replaceChildren(...Object.entries(info.modes).map(([key, title]) =>
    chip(title, key === progress.mode, () => { progress.mode = key; saveProgress(); buildHome(); })));
  $("levels").replaceChildren(...Object.entries(info.levels).map(([key, title]) =>
    chip(`<span>${title}</span><span class="muted">${LEVEL_HINTS[key]}</span>`, key === progress.level,
         () => { progress.level = key; saveProgress(); buildHome(); })));
  const count = progress.mistakes.length;
  $("review-count").textContent = count ? `(${count})` : "";
  $("review").disabled = !count;
}

// ---------- урок ----------

function startLesson(kind) {
  const raw = kind === "review"
    ? api.review(JSON.stringify(progress.mistakes), progress.mode, progress.level, LESSON_SIZE)
    : api.lesson(progress.mode, progress.level, LESSON_SIZE);
  const questions = JSON.parse(raw);
  if (!questions.length) {
    const text = "В этом режиме пока нечего повторять.";
    alertBox(text);
    return;
  }
  lesson = { kind, questions, idx: 0, total: 0, correct: 0, wrong: new Set(), repeated: new Set(), picked: null, answered: false };
  show("lesson");
  showQuestion();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function showQuestion() {
  const q = lesson.questions[lesson.idx];
  const n = lesson.questions.length;
  lesson.picked = null;
  lesson.answered = false;
  $("bar-fill").style.width = `${(100 * lesson.idx) / n}%`;
  $("counter").textContent = `${lesson.idx + 1}/${n}`;
  $("repeat-note").hidden = !q.repeat;
  $("question").innerHTML = q.text; // текст уже размечен ботом и экранирован
  $("dunno").disabled = false;
  $("check").disabled = true;

  const typed = !q.options.length;
  $("typed").hidden = !typed;
  $("options").hidden = typed;
  if (typed) {
    $("answer").value = "";
    $("answer").disabled = false;
    $("answer").focus();
    return;
  }
  const short = q.options.every((o) => o.length <= 14);
  $("options").className = "options" + (short ? " two" : "");
  $("options").replaceChildren(...q.options.map((text, i) => {
    const b = document.createElement("button");
    b.className = "option";
    b.textContent = text;
    b.onclick = () => {
      if (lesson.answered) return;
      lesson.picked = i;
      for (const el of $("options").children) el.classList.toggle("picked", el === b);
      $("check").disabled = false;
    };
    return b;
  }));
}

function answer(given) {
  if (lesson.answered) return;
  const q = lesson.questions[lesson.idx];
  let ok = false;
  if (given !== null) {
    ok = q.options.length ? lesson.picked === q.correct : api.check(q.id, given);
  }
  lesson.answered = true;
  if (!q.repeat) {
    lesson.total += 1;
    lesson.correct += ok;
  }
  // Как в боте: верный ответ убирает вопрос из работы над ошибками, ошибку повторяем в конце урока
  if (ok) {
    if (!lesson.wrong.has(q.key)) progress.mistakes = progress.mistakes.filter((k) => k !== q.key);
  } else {
    lesson.wrong.add(q.key);
    if (!progress.mistakes.includes(q.key)) progress.mistakes.push(q.key);
    if (!lesson.repeated.has(q.key)) {
      lesson.repeated.add(q.key);
      lesson.questions.push({ ...q, repeat: true });
    }
  }
  saveProgress();

  if (q.options.length) {
    [...$("options").children].forEach((el, i) => {
      el.disabled = true;
      el.classList.toggle("right", i === q.correct);
      el.classList.toggle("wrong", i === lesson.picked && !ok);
    });
  } else {
    $("answer").disabled = true;
  }
  $("check").disabled = true;
  $("dunno").disabled = true;
  haptic(ok ? "success" : "error");

  const lines = [];
  if (!ok && q.answer !== null) lines.push(`Правильный ответ: <b>${escapeHtml(q.answer)}</b>`);
  if (!ok && given && !q.options.length) lines.unshift(`Твой ответ: ${escapeHtml(given)}`);
  lines.push(q.explanation);
  $("sheet").className = "sheet" + (ok ? "" : " bad");
  $("sheet-title").textContent = ok ? PRAISE[Math.floor(Math.random() * PRAISE.length)]
    : given === null ? "🤷 Ничего страшного, запоминай:" : "❌ Неверно";
  $("sheet-body").innerHTML = lines.join("\n");
  $("sheet").hidden = false;
  $("next").focus();
}

function nextQuestion() {
  $("sheet").hidden = true;
  lesson.idx += 1;
  if (lesson.idx >= lesson.questions.length) finish();
  else showQuestion();
}

function finish() {
  const perfect = lesson.total > 0 && lesson.correct === lesson.total;
  const xp = lesson.correct * XP_PER_ANSWER + (perfect ? XP_PERFECT_BONUS : 0);
  const today = moscowDay();
  const grew = progress.last !== today;
  if (progress.last === moscowDay(-1)) progress.streak += 1;
  else if (progress.last !== today) progress.streak = 1;
  progress.last = today;
  progress.best = Math.max(progress.best, progress.streak);
  progress.xp += xp;
  progress.lessons += 1;
  progress.answered += lesson.total;
  progress.correct += lesson.correct;
  saveProgress();

  const pct = lesson.total ? Math.round((100 * lesson.correct) / lesson.total) : 0;
  $("result-emoji").textContent = perfect ? "🏆" : pct >= 70 ? "🎉" : "💪";
  $("result-title").textContent = perfect ? "Идеально! Ни одной ошибки!" : pct >= 70 ? "Урок пройден!" : "Урок пройден, есть над чем поработать";
  $("res-correct").textContent = `${lesson.correct}/${lesson.total}`;
  $("res-xp").textContent = `+${xp}`;
  $("res-streak").textContent = `🔥 ${progress.streak}`;
  $("res-mistakes").textContent = (grew ? "Стрик продлён! " : "") +
    (lesson.wrong.size ? `На повторение добавлено: ${lesson.wrong.size}.` : "");
  show("result");
  haptic("success");
}

function quitLesson() {
  const leave = () => { buildHome(); show("home"); };
  const text = "Закончить урок? Прогресс этого урока не сохранится, а ошибки останутся на повторении.";
  confirmBox(text, leave);
}

// ---------- кнопки ----------

$("start").onclick = () => startLesson("lesson");
$("review").onclick = () => startLesson("review");
$("again").onclick = () => startLesson(lesson?.kind === "review" && progress.mistakes.length ? "review" : "lesson");
$("home-btn").onclick = () => { buildHome(); show("home"); };
$("quit").onclick = quitLesson;
backButton?.onClick(quitLesson);
$("dunno").onclick = () => answer(null);
$("check").onclick = () => {
  const q = lesson.questions[lesson.idx];
  answer(q.options.length ? q.options[lesson.picked] : $("answer").value.trim());
};
$("answer").oninput = () => { $("check").disabled = !$("answer").value.trim(); };
$("answer").onkeydown = (e) => { if (e.key === "Enter" && $("answer").value.trim()) $("check").click(); };
$("next").onclick = nextQuestion;

window.addEventListener("load", () => boot());
