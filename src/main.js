import "./style.css";
import { supabase } from "./supabase.js";

const app = document.querySelector("#app");
let session = null;
let currentSubject = null;
let currentChapter = null;
let search = "";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);

function icon(name) {
  const icons = {
    book: "📚", folder: "📁", file: "📄", plus: "＋", back: "←",
    logout: "↪", trash: "🗑", search: "⌕", upload: "↑"
  };
  return icons[name] || "";
}

function shell(content, title = "Mes cours", back = false) {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand" data-home>
          <div class="logo">${icon("book")}</div>
          <div><strong>Course Hub</strong><small>Ma bibliothèque</small></div>
        </div>
        ${session ? `<button class="ghost" data-logout>${icon("logout")} <span>Déconnexion</span></button>` : ""}
      </header>
      <section class="content">
        <div class="page-title">
          <div>
            ${back ? `<button class="back" data-back>${icon("back")}</button>` : ""}
            <div><p class="eyebrow">COURSE HUB</p><h1>${escapeHtml(title)}</h1></div>
          </div>
        </div>
        ${content}
      </section>
    </main>`;

  app.querySelector("[data-logout]")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
  });
  app.querySelector("[data-home]")?.addEventListener("click", () => {
    currentSubject = null; currentChapter = null; render();
  });
  app.querySelector("[data-back]")?.addEventListener("click", () => {
    if (currentChapter) currentChapter = null;
    else currentSubject = null;
    render();
  });
}

function authView(message = "") {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-card">
        <div class="big-logo">${icon("book")}</div>
        <p class="eyebrow">BIENVENUE</p>
        <h1>Course Hub</h1>
        <p class="muted">Tous tes cours, au même endroit.</p>
        <form id="auth-form">
          <label>Email<input name="email" type="email" required autocomplete="email" placeholder="toi@exemple.fr"></label>
          <label>Mot de passe<input name="password" type="password" required minlength="6" autocomplete="current-password" placeholder="••••••••"></label>
          <button class="primary" type="submit">Se connecter</button>
          <button class="secondary" type="button" id="signup">Créer mon compte</button>
        </form>
        <p class="message">${escapeHtml(message)}</p>
      </section>
    </main>`;

  const form = document.querySelector("#auth-form");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get("email"), password: fd.get("password")
    });
    if (error) authView(error.message);
  });

  document.querySelector("#signup").addEventListener("click", async () => {
    const fd = new FormData(form);
    const email = fd.get("email"), password = fd.get("password");
    if (!email || !password) return authView("Entre d'abord ton email et ton mot de passe.");
    const { error } = await supabase.auth.signUp({ email, password });
    authView(error ? error.message : "Compte créé. Vérifie ton email si la confirmation est activée.");
  });
}

async function subjectsView() {
  const { data: subjects, error } = await supabase
    .from("subjects").select("*").order("position").order("created_at");

  if (error) return shell(`<div class="notice">${escapeHtml(error.message)}</div>`);

  shell(`
    <div class="toolbar">
      <div class="search">${icon("search")}<input id="search" placeholder="Rechercher une matière..." value="${escapeHtml(search)}"></div>
      <button class="primary compact" id="add-subject">${icon("plus")} Matière</button>
    </div>
    <div class="grid" id="subjects">
      ${(subjects || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s => `
        <article class="card subject-card" data-id="${s.id}">
          <div class="card-icon">${escapeHtml(s.emoji || "📘")}</div>
          <div class="grow"><h2>${escapeHtml(s.name)}</h2><p>Ouvrir la matière</p></div>
          <button class="icon-button danger" data-delete="${s.id}" title="Supprimer">${icon("trash")}</button>
        </article>`).join("") || `<div class="empty">Aucune matière. Ajoute ta première matière ✨</div>`}
    </div>`);

  document.querySelector("#search").addEventListener("input", e => { search = e.target.value; subjectsView(); });
  document.querySelector("#add-subject").addEventListener("click", addSubject);
  document.querySelectorAll(".subject-card").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("[data-delete]")) return;
    currentSubject = subjects.find(s => s.id === el.dataset.id);
    render();
  }));
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async e => {
    e.stopPropagation();
    if (!confirm("Supprimer cette matière, ses chapitres et ses fichiers ?")) return;
    await deleteSubject(btn.dataset.delete);
    render();
  }));
}

async function addSubject() {
  const name = prompt("Nom de la matière :");
  if (!name?.trim()) return;
  const emoji = prompt("Emoji (facultatif) :", "📘") || "📘";
  const { error } = await supabase.from("subjects").insert({
    user_id: session.user.id, name: name.trim(), emoji: emoji.trim().slice(0, 8)
  });
  if (error) alert(error.message);
  render();
}

async function deleteSubject(id) {
  const { data: files } = await supabase.from("course_files").select("storage_path").eq("subject_id", id);
  if (files?.length) await supabase.storage.from("course-files").remove(files.map(f => f.storage_path));
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) alert(error.message);
}

async function subjectView() {
  const [{ data: chapters }, { data: files }] = await Promise.all([
    supabase.from("chapters").select("*").eq("subject_id", currentSubject.id).order("position").order("created_at"),
    supabase.from("course_files").select("*").eq("subject_id", currentSubject.id).is("chapter_id", null).order("created_at", { ascending: false })
  ]);

  shell(`
    <div class="toolbar">
      <p class="muted">${escapeHtml(currentSubject.emoji || "📘")} Classe tes cours par chapitre ou dépose-les directement ici.</p>
      <div class="actions">
        <button class="secondary compact" id="add-chapter">${icon("plus")} Chapitre</button>
        <label class="primary compact upload-button">${icon("upload")} Ajouter un fichier<input id="upload-root" type="file" multiple hidden></label>
      </div>
    </div>
    <h3 class="section-title">Chapitres</h3>
    <div class="grid">
      ${(chapters || []).map(c => `
        <article class="card chapter-card" data-id="${c.id}">
          <div class="card-icon">${icon("folder")}</div>
          <div class="grow"><h2>${escapeHtml(c.name)}</h2><p>Ouvrir le chapitre</p></div>
          <button class="icon-button danger" data-delete-chapter="${c.id}">${icon("trash")}</button>
        </article>`).join("") || `<div class="empty small">Aucun chapitre pour l'instant.</div>`}
    </div>
    <h3 class="section-title">Fichiers sans chapitre</h3>
    ${fileList(files || [])}
  `, currentSubject.name, true);

  document.querySelector("#add-chapter").addEventListener("click", async () => {
    const name = prompt("Nom du chapitre :");
    if (!name?.trim()) return;
    const { error } = await supabase.from("chapters").insert({
      user_id: session.user.id, subject_id: currentSubject.id, name: name.trim()
    });
    if (error) alert(error.message);
    render();
  });
  document.querySelector("#upload-root").addEventListener("change", e => uploadFiles(e.target.files, null));
  bindFileButtons();
  document.querySelectorAll(".chapter-card").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("[data-delete-chapter]")) return;
    currentChapter = chapters.find(c => c.id === el.dataset.id);
    render();
  }));
  document.querySelectorAll("[data-delete-chapter]").forEach(btn => btn.addEventListener("click", async e => {
    e.stopPropagation();
    if (!confirm("Supprimer ce chapitre et ses fichiers ?")) return;
    const { data: chapterFiles } = await supabase.from("course_files").select("storage_path").eq("chapter_id", btn.dataset.deleteChapter);
    if (chapterFiles?.length) await supabase.storage.from("course-files").remove(chapterFiles.map(f => f.storage_path));
    await supabase.from("chapters").delete().eq("id", btn.dataset.deleteChapter);
    render();
  }));
}

async function chapterView() {
  const { data: files } = await supabase.from("course_files")
    .select("*").eq("chapter_id", currentChapter.id).order("created_at", { ascending: false });

  shell(`
    <div class="toolbar">
      <p class="muted">${escapeHtml(currentSubject.name)} / ${escapeHtml(currentChapter.name)}</p>
      <label class="primary compact upload-button">${icon("upload")} Ajouter des fichiers<input id="upload" type="file" multiple hidden></label>
    </div>
    ${fileList(files || [])}
  `, currentChapter.name, true);

  document.querySelector("#upload").addEventListener("change", e => uploadFiles(e.target.files, currentChapter.id));
  bindFileButtons();
}

function fileList(files) {
  if (!files.length) return `<div class="empty">Aucun fichier ici pour l'instant.</div>`;
  return `<div class="file-list">${files.map(f => `
    <article class="file-row">
      <div class="file-icon">${icon("file")}</div>
      <div class="grow"><strong>${escapeHtml(f.name)}</strong><small>${formatBytes(f.size_bytes)} · ${escapeHtml(f.mime_type || "fichier")}</small></div>
      <button class="secondary compact" data-open="${f.id}">Ouvrir</button>
      <button class="icon-button danger" data-delete-file="${f.id}" data-path="${escapeHtml(f.storage_path)}">${icon("trash")}</button>
    </article>`).join("")}</div>`;
}

function bindFileButtons() {
  document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => openFile(btn.dataset.open)));
  document.querySelectorAll("[data-delete-file]").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Supprimer ce fichier ?")) return;
    const { error: storageError } = await supabase.storage.from("course-files").remove([btn.dataset.path]);
    if (storageError) return alert(storageError.message);
    const { error } = await supabase.from("course_files").delete().eq("id", btn.dataset.deleteFile);
    if (error) alert(error.message);
    render();
  }));
}

async function uploadFiles(fileList, chapterId) {
  for (const file of [...fileList]) {
    const extension = file.name.includes(".")
  ? file.name.split(".").pop().toLowerCase()
  : "";

const path = `${session.user.id}/${currentSubject.id}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
    const { error: uploadError } = await supabase.storage.from("course-files").upload(path, file);
    if (uploadError) { alert(`Upload impossible : ${uploadError.message}`); continue; }

    const { error } = await supabase.from("course_files").insert({
      user_id: session.user.id,
      subject_id: currentSubject.id,
      chapter_id: chapterId,
      name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size
    });
    if (error) {
      await supabase.storage.from("course-files").remove([path]);
      alert(error.message);
    }
  }
  render();
}

async function openFile(id) {
  const { data: row, error } = await supabase
    .from("course_files")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  const { data, error: signError } = await supabase.storage
    .from("course-files")
    .createSignedUrl(row.storage_path, 3600);

  if (signError) {
    alert(signError.message);
    return;
  }

  if (row.mime_type !== "application/pdf") {
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    return;
  }

  showPdfViewer(row.name, data.signedUrl);
}

function showPdfViewer(fileName, url) {
  app.innerHTML = `
    <main class="pdf-page">

      <header class="pdf-header">
        <button class="back pdf-back" id="close-pdf">
          ←
        </button>

        <div class="pdf-title">
          <strong>${escapeHtml(fileName)}</strong>
          <small>
            ${escapeHtml(currentSubject?.name || "")}
            ${currentChapter ? ` / ${escapeHtml(currentChapter.name)}` : ""}
          </small>
        </div>
      </header>

      <div class="pdf-container">
        <iframe
          class="pdf-viewer"
          src="${url}"
          title="${escapeHtml(fileName)}"
        ></iframe>
      </div>

    </main>
  `;

  document
    .querySelector("#close-pdf")
    .addEventListener("click", render);
}

function formatBytes(bytes) {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function render() {
  if (!session) return authView();
  if (currentChapter) return chapterView();
  if (currentSubject) return subjectView();
  return subjectsView();
}

const { data } = await supabase.auth.getSession();
session = data.session;
supabase.auth.onAuthStateChange((_event, newSession) => {
  session = newSession;
  currentSubject = null;
  currentChapter = null;
  setTimeout(render, 0);
});
render();
