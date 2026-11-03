// Пробное приложение: путь по физике островками, как в Duolingo. Вопросы и проверку ответов делает код бота в браузере.

const PYODIDE = "https://ehot524.github.io/pyodide/"; // Python для браузера уже лежит на сайте с опытами
const BUNDLE = "bot.zip?v=2";
const STORE_KEY = "progress";
const XP_PER_ANSWER = 10;
const XP_PERFECT_BONUS = 20;
const LESSON_SIZE = 10;
const MAX_MISTAKES = 200; // в облаке Telegram на одно значение 4096 символов
const PRAISE = ["Отлично! 💪", "Верно! 🎉", "Так держать! ✨", "Правильно! 🚀", "Супер! 🔥"];
const LEVEL_HINTS = { easy: "4 варианта", medium: "8 вариантов", hard: "пишешь сам" };
const UNIT_COLORS = [["#58cc02", "#46a302"], ["#1cb0f6", "#1899d6"], ["#ce82ff", "#a568cc"], ["#ff9600", "#cc7800"],
                     ["#ff4b4b", "#d93a3a"], ["#2b70c9", "#1f5aa3"], ["#00cd9c", "#00a47d"]];
const ZIGZAG = [0, 55, 85, 55, 0, -55, -85, -55]; // сдвиг островков вправо и влево

const $ = (id) => document.getElementById(id);
const tg = window.Telegram?.WebApp;
let api, info, progress, lesson, path, opened;

// Скрипт Telegram грузится и в обычном браузере, но там его окна и кнопки бросают ошибку
const cloud = tg?.CloudStorage && tg.isVersionAtLeast?.("6.9") ? tg.CloudStorage : null;
const popups = tg?.isVersionAtLeast?.("6.2") ?? false;
const backButton = tg?.isVersionAtLeast?.("6.1") ? tg.BackButton : null;

function alertBox(text) {
  popups ? tg.showAlert(text) : alert(text);
}

function confirmBox(text, onYes) {
  if (popups) tg.showConfirm(text, (yes) => yes && onYes());
  else if (confirm(text)) onYes();
}

function haptic(kind) {
  try { tg?.HapticFeedback?.notificationOccurred(kind); } catch {}
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// ---------- прогресс: облако Telegram, а вне Telegram память браузера ----------

function emptyProgress() {
  return { xp: 0, streak: 0, best: 0, last: null, lessons: 0, answered: 0, correct: 0, mistakes: [], path: {}, mode: null, level: null };
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

// ---------- путь: то же хранение, что в боте: в классе число пройденных шагов, в экзамене список номеров ----------

function doneCount() {
  return path.classes ? progress.path[progress.mode] || 0 : 0;
}

function examDone() {
  return new Set(path.classes ? [] : progress.path[progress.mode] || []);
}

function stepState(i) {
  const step = path.steps[i];
  if (!path.classes) return examDone().has(step.number) ? "done" : "open";
  const done = doneCount();
  return i < done ? "done" : i === done ? "current" : "locked";
}

function unitEnd(unit) {
  return path.steps.reduce((end, s, i) => (s.unit === unit ? i + 1 : end), 0);
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
    $("loading-text").textContent = "⚠️ Не получилось загрузить приложение. Проверь интернет и открой его ещё раз.";
    document.querySelector(".spinner").hidden = true;
    return;
  }
  progress.mode ||= "7";
  progress.level ||= "easy";
  openMap();
}

function show(screen) {
  for (const id of ["loading", "map", "card", "lesson", "result"]) $(id).hidden = id !== screen;
  $("sheet").hidden = true;
  $("popover").hidden = true;
  window.scrollTo(0, 0);
  if (backButton) ["card", "lesson"].includes(screen) ? backButton.show() : backButton.hide();
}

// ---------- карта ----------

function openMap() {
  path = JSON.parse(api.path(progress.mode));
  renderMap();
  show("map");
  const target = document.querySelector(".island.current") || [...document.querySelectorAll(".island:not(.done)")][0];
  target?.scrollIntoView({ block: "center" });
}

function renderMap() {
  $("mode-title").textContent = info.modes[progress.mode];
  $("level-title").textContent = info.levels[progress.level].split(" ")[0];
  $("xp").textContent = progress.xp;
  $("streak").textContent = currentStreak();
  $("review-count").textContent = progress.mistakes.length;
  $("review").disabled = !progress.mistakes.length;

  const parts = [];
  if (path.classes) {
    path.units.forEach((title, unit) => {
      const own = path.steps.map((s, i) => [s, i]).filter(([s]) => s.unit === unit);
      const done = doneCount();
      const unlocked = own[0][1] <= done;
      const finished = own.at(-1)[1] < done;
      parts.push(unitBanner(unit, `Раздел ${unit + 1}`, title, unlocked && !finished, !unlocked));
      parts.push(islands(own, unit));
    });
  } else {
    const title = progress.mode === "oge" ? "Номера ОГЭ" : "Номера ЕГЭ";
    parts.push(unitBanner(0, "Все номера открыты", title, false, false));
    if (path.note) {
      const note = document.createElement("p");
      note.className = "exam-note";
      note.textContent = path.note;
      parts.push(note);
    }
    parts.push(islands(path.steps.map((s, i) => [s, i]), 0));
  }
  $("path").replaceChildren(...parts);
}

function unitBanner(unit, label, title, canSkip, locked) {
  const [c, cd] = UNIT_COLORS[unit % UNIT_COLORS.length];
  const el = document.createElement("div");
  el.className = "unit" + (locked ? " locked" : "");
  el.style.setProperty("--c", c);
  el.style.setProperty("--cd", cd);
  el.innerHTML = `<div><div class="unit-label">${escapeHtml(label)}</div><div class="unit-title">${escapeHtml(title)}</div></div>`;
  if (canSkip) {
    const skip = document.createElement("button");
    skip.className = "unit-skip";
    skip.textContent = "⏭ Знаю раздел";
    skip.onclick = () => openPopover({ skip: unit });
    el.append(skip);
  }
  return el;
}

function islands(items, unit) {
  const [c, cd] = UNIT_COLORS[unit % UNIT_COLORS.length];
  const box = document.createElement("div");
  box.className = "islands";
  items.forEach(([step, i], k) => {
    const state = stepState(i);
    const wrap = document.createElement("div");
    wrap.className = "island-wrap";
    wrap.style.transform = `translateX(${ZIGZAG[k % ZIGZAG.length]}px)`;
    const b = document.createElement("button");
    b.className = `island ${state}` + (step.control ? " control" : "");
    b.style.setProperty("--c", c);
    b.style.setProperty("--cd", cd);
    b.setAttribute("aria-label", step.title);
    b.textContent = state === "locked" ? "🔒" : step.control ? "🏆" : state === "done" ? (path.classes ? "✓" : `✓${step.number}`) :
                    path.classes ? "⭐" : step.number;
    if (!path.classes && state === "done") b.style.fontSize = "20px";
    b.onclick = () => openPopover({ step: i });
    wrap.append(b);
    if (state === "current") {
      const tag = document.createElement("div");
      tag.className = "start-tag";
      tag.style.setProperty("--c", c);
      tag.textContent = "НАЧАТЬ";
      wrap.prepend(tag);
    }
    const label = document.createElement("div");
    label.className = "island-label";
    label.textContent = path.classes ? step.title : step.title.replace(/^Задание \d+\. /, "");
    wrap.append(label);
    box.append(wrap);
  });
  return box;
}

function openPopover(target) {
  const go = $("pop-go");
  go.className = "btn big primary";
  go.disabled = false;
  if (target.skip !== undefined) {
    $("pop-title").textContent = `⏭ ${path.units[target.skip]}`;
    $("pop-text").textContent = `Контрольная по всему разделу. Если наберёшь ${info.pass}%, все его шаги засчитаются.`;
    go.textContent = "Пройти контрольную";
    go.onclick = () => startLesson({ kind: "skip", unit: target.skip });
  } else {
    const i = target.step;
    const step = path.steps[i];
    const state = stepState(i);
    $("pop-title").textContent = step.title;
    if (state === "locked") {
      $("pop-text").textContent = "Этот шаг откроется, когда пройдёшь предыдущие.";
      go.textContent = "🔒 Пока закрыто";
      go.className = "btn big locked";
      go.disabled = true;
    } else {
      $("pop-text").textContent = state === "done" ? "Пройдено. Можно повторить." :
        step.control ? `Нужно ${info.pass}% верных ответов.` : path.classes ? "Сначала короткая карточка с новым, потом урок." :
        "Сначала теория номера, потом задачи.";
      go.textContent = state === "done" ? "Повторить" : "Начать";
      go.onclick = () => openCard(i);
    }
  }
  $("popover").hidden = false;
}

// ---------- карточка шага ----------

function openCard(index) {
  const card = JSON.parse(api.card(progress.mode, index));
  $("card-title").textContent = card.title;
  $("card-list").replaceChildren(...card.cards.map((html) => {
    const el = document.createElement("div");
    el.className = "card-item";
    el.innerHTML = html; // текст собран кодом бота и экранирован
    return el;
  }));
  $("card-start").onclick = () => startLesson({ kind: "step", index });
  show("card");
}

// ---------- урок ----------

function startLesson(ctx) {
  const raw = ctx.kind === "step" ? api.step_lesson(progress.mode, ctx.index, progress.level)
    : ctx.kind === "skip" ? api.skip_lesson(progress.mode, ctx.unit, progress.level)
    : ctx.kind === "review" ? api.review(JSON.stringify(progress.mistakes), progress.mode, progress.level, LESSON_SIZE)
    : api.lesson(progress.mode, progress.level, JSON.stringify(progress.path), LESSON_SIZE);
  const questions = JSON.parse(raw);
  if (!questions.length) {
    alertBox(ctx.kind === "practice" ? "Формулы появятся, когда пройдёшь первые шаги пути." : "Здесь пока нечего повторять.");
    return;
  }
  lesson = { ...ctx, questions, idx: 0, total: 0, correct: 0, wrong: new Set(), repeated: new Set(), picked: null, answered: false };
  show("lesson");
  showQuestion();
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
  if (given !== null) ok = q.options.length ? lesson.picked === q.correct : api.check(q.id, given);
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
  if (!ok && given && !q.options.length) lines.push(`Твой ответ: ${escapeHtml(given)}`);
  if (!ok && q.answer !== null) lines.push(`Правильный ответ: <b>${escapeHtml(q.answer)}</b>`);
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

// Как path_result в боте: шаг засчитывается с 80% первых ответов
function pathResult(pct) {
  const passed = pct >= info.pass;
  const mode = progress.mode;
  if (lesson.kind === "skip") {
    if (!passed) return { text: `Для зачёта раздела нужно ${info.pass}%. Лучше пройти его по шагам.`, next: null };
    progress.path[mode] = Math.max(doneCount(), unitEnd(lesson.unit));
    return { text: "⏭ Раздел зачтён!", next: progress.path[mode] < path.steps.length ? progress.path[mode] : null };
  }
  const step = path.steps[lesson.index];
  if (!path.classes) {
    if (passed) progress.path[mode] = [...new Set([...(progress.path[mode] || []), step.number])].sort((a, b) => a - b);
    return { text: passed ? "✅ Номер отмечен как пройденный." : `Чтобы отметить номер, нужно ${info.pass}%.`,
             next: passed ? null : lesson.index, again: !passed };
  }
  if (!passed) return { text: `Для следующего шага нужно ${info.pass}%. Повтори карточку и попробуй ещё раз.`, next: lesson.index, again: true };
  if (lesson.index === doneCount()) progress.path[mode] = lesson.index + 1;
  const done = doneCount();
  if (done >= path.steps.length) return { text: "🎉 Весь путь пройден!", next: null };
  return { text: `🔓 Открыт шаг: ${path.steps[done].title}`, next: done };
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

  const pct = lesson.total ? Math.round((100 * lesson.correct) / lesson.total) : 0;
  const result = ["step", "skip"].includes(lesson.kind) ? pathResult(pct) : null;
  saveProgress();

  $("result-emoji").textContent = perfect ? "🏆" : pct >= 70 ? "🎉" : "💪";
  $("result-title").textContent = perfect ? "Идеально! Ни одной ошибки!" : pct >= 70 ? "Урок пройден!" : "Урок пройден, есть над чем поработать";
  $("res-correct").textContent = `${lesson.correct}/${lesson.total}`;
  $("res-xp").textContent = `+${xp}`;
  $("res-streak").textContent = `🔥 ${progress.streak}`;
  $("res-mistakes").textContent = (grew ? "Стрик продлён! " : "") +
    (lesson.wrong.size ? `На повторение добавлено: ${lesson.wrong.size}.` : "");
  $("res-path").hidden = !result;
  if (result) $("res-path").textContent = result.text;

  const main = $("res-main");
  main.hidden = false;
  if (result && result.next !== null) {
    main.textContent = result.again ? "📖 Ещё раз" : "▶️ Следующий шаг";
    main.onclick = () => openCard(result.next);
  } else if (result) {
    main.hidden = true;
  } else {
    const kind = lesson.kind === "review" && !progress.mistakes.length ? "practice" : lesson.kind;
    main.textContent = "▶️ Ещё урок";
    main.onclick = () => startLesson({ kind });
  }
  show("result");
  haptic("success");
}

function quitLesson() {
  if (!$("card").hidden) return openMap();
  confirmBox("Закончить урок? Прогресс этого урока не сохранится, а ошибки останутся на повторении.", openMap);
}

// ---------- настройки ----------

function chip(html, on, onClick) {
  const b = document.createElement("button");
  b.className = "chip" + (on ? " on" : "");
  b.innerHTML = html;
  b.onclick = onClick;
  return b;
}

function renderSettings() {
  $("modes").replaceChildren(...Object.entries(info.modes).map(([key, title]) =>
    chip(escapeHtml(title), key === progress.mode, () => { progress.mode = key; saveProgress(); renderSettings(); })));
  $("levels").replaceChildren(...Object.entries(info.levels).map(([key, title]) =>
    chip(`<span>${title}</span><span class="muted">${LEVEL_HINTS[key]}</span>`, key === progress.level,
         () => { progress.level = key; saveProgress(); renderSettings(); })));
}

// ---------- кнопки ----------

$("open-settings").onclick = () => { renderSettings(); $("settings").hidden = false; };
$("close-settings").onclick = () => { $("settings").hidden = true; openMap(); };
$("settings").onclick = (e) => { if (e.target === $("settings")) $("close-settings").click(); };
$("popover").onclick = (e) => { if (e.target === $("popover")) $("popover").hidden = true; };
$("review").onclick = () => startLesson({ kind: "review" });
$("practice").onclick = () => startLesson({ kind: "practice" });
$("card-close").onclick = openMap;
$("res-map").onclick = openMap;
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
