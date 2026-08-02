import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc,
  doc, setDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// AUTH GUARD
// IMPORTANT: This only checks WHO is signed in, not WHETHER they're an admin.
// Your public site (index.html) lets any visitor sign in with Google, and they
// share the same Firebase Auth project as this dashboard — so without this
// allowlist, any signed-in visitor who finds this URL gets full admin access.
// Add every admin's email here, and ALSO restrict writes to streamVideos /
// streamCategories / streamSettings / subscribers in your Firestore Security
// Rules to this same list — a client-side check alone can be bypassed.
const ADMIN_EMAILS = [
  // "you@example.com",
];

onAuthStateChanged(auth, (user) => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    if (user) signOut(auth);
    window.location.href = "admin.html";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin.html";
});

// NAV
const navButtons = document.querySelectorAll(".dash-btn");
const sections = document.querySelectorAll(".dash-section");
navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    navButtons.forEach(b => b.classList.remove("active"));
    sections.forEach(s => s.classList.remove("active-section"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.section).classList.add("active-section");
  });
});

function showMsg(el, text, type) {
  el.innerText = text;
  el.className = `msg ${type}`;
}

function extractYoutubeId(input) {
  if (!input) return "";
  input = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  try {
    const url = new URL(input);
    const v = url.searchParams.get("v");
    if (v) return v;
  } catch (e) {}
  // Fallback: bare ID with a tracking param stuck on, e.g. "H381ZZstCd4?si=xxxx"
  // (happens when the domain/prefix isn't included in what was pasted)
  const bare = input.split(/[?&#\s]/)[0];
  if (/^[a-zA-Z0-9_-]{11}$/.test(bare)) return bare;
  return input;
}

/* ══════════════ CATEGORIES ══════════════ */

const saveCatBtn = document.getElementById("saveCatBtn");
saveCatBtn.addEventListener("click", async () => {
  const name = document.getElementById("catName").value.trim();
  const emoji = document.getElementById("catEmoji").value.trim();
  const order = Number(document.getElementById("catOrder").value) || Date.now();
  const msgEl = document.getElementById("catMsg");

  if (!name) {
    showMsg(msgEl, "Category పేరు అవసరం", "error");
    return;
  }

  saveCatBtn.disabled = true;
  saveCatBtn.innerHTML = `<span class="spinner-inline"></span>Saving...`;

  try {
    await addDoc(collection(db, "streamCategories"), {
      name, emoji, order, createdAt: serverTimestamp()
    });

    document.getElementById("catName").value = "";
    document.getElementById("catEmoji").value = "";
    document.getElementById("catOrder").value = "";
    showMsg(msgEl, "✅ Category saved", "success");

    loadCategories();
  } catch (e) {
    showMsg(msgEl, "❌ Error saving category", "error");
  } finally {
    saveCatBtn.disabled = false;
    saveCatBtn.innerText = "Save Category";
  }
});

async function loadCategories() {
  const listEl = document.getElementById("catList");
  const vidSelect = document.getElementById("vidCategorySelect");

  const q = query(collection(db, "streamCategories"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  listEl.innerHTML = "";
  vidSelect.innerHTML = `<option value="">Select Category</option>`;

  if (snap.empty) {
    listEl.innerHTML = `<p style="color:var(--text3);font-size:0.85rem;">ఇంకా categories లేవు</p>`;
    return;
  }

  let i = 0;
  snap.forEach(d => {
    const c = d.data();

    vidSelect.innerHTML += `<option value="${d.id}">${c.emoji || ""} ${c.name}</option>`;

    listEl.innerHTML += `
      <div class="item-row" style="animation-delay:${i * 0.03}s">
        <div class="item-info">
          <div class="item-title">${c.emoji || ""} ${c.name}</div>
          <div class="item-sub">Order: ${c.order}</div>
        </div>
        <div class="item-actions">
          <button class="btn-danger" data-id="${d.id}" data-action="delete-cat">Delete</button>
        </div>
      </div>
    `;
    i++;
  });

  listEl.querySelectorAll('[data-action="delete-cat"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("ఈ category delete చేయాలా? ఇందులోని వీడియోలు uncategorized అవుతాయి.")) return;
      await deleteDoc(doc(db, "streamCategories", btn.dataset.id));
      loadCategories();
    });
  });
}

/* ══════════════ VIDEOS ══════════════ */

const saveVidBtn = document.getElementById("saveVidBtn");
saveVidBtn.addEventListener("click", async () => {
  const title = document.getElementById("vidTitle").value.trim();
  const description = document.getElementById("vidDesc").value.trim();
  const youtubeId = extractYoutubeId(document.getElementById("vidYoutubeId").value.trim());
  let thumbnail = document.getElementById("vidThumb").value.trim();
  const categorySelect = document.getElementById("vidCategorySelect");
  const categoryId = categorySelect.value;
  const categoryName = categorySelect.options[categorySelect.selectedIndex]?.text.trim() || "";
  const access = document.getElementById("vidAccess").value;
  const duration = document.getElementById("vidDuration").value.trim();
  const year = document.getElementById("vidYear").value.trim();
  const msgEl = document.getElementById("vidMsg");

  if (!title || !youtubeId || !categoryId) {
    showMsg(msgEl, "Title, YouTube ID మరియు Category అవసరం", "error");
    return;
  }

  if (!thumbnail) {
    thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  saveVidBtn.disabled = true;
  saveVidBtn.innerHTML = `<span class="spinner-inline"></span>Saving...`;

  try {
    await addDoc(collection(db, "streamVideos"), {
      title, description, youtubeId, thumbnail,
      categoryId, category: categoryName, access,
      duration, year, createdAt: serverTimestamp()
    });

    document.getElementById("vidTitle").value = "";
    document.getElementById("vidDesc").value = "";
    document.getElementById("vidYoutubeId").value = "";
    document.getElementById("vidThumb").value = "";
    document.getElementById("vidDuration").value = "";
    document.getElementById("vidYear").value = "";
    showMsg(msgEl, "✅ Video saved", "success");

    loadVideos();
  } catch (e) {
    showMsg(msgEl, "❌ Error saving video", "error");
  } finally {
    saveVidBtn.disabled = false;
    saveVidBtn.innerText = "Save Video";
  }
});

async function loadVideos() {
  const listEl = document.getElementById("vidList");
  const heroSelect = document.getElementById("heroVideoSelect");

  const q = query(collection(db, "streamVideos"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  listEl.innerHTML = "";
  heroSelect.innerHTML = `<option value="">Select Video</option>`;

  if (snap.empty) {
    listEl.innerHTML = `<p style="color:var(--text3);font-size:0.85rem;">ఇంకా వీడియోలు లేవు</p>`;
    return;
  }

  let i = 0;
  snap.forEach(d => {
    const v = d.data();
    const badge = v.access === "free"
      ? `<span class="badge badge-free">FREE</span>`
      : `<span class="badge badge-paid">PREMIUM</span>`;

    heroSelect.innerHTML += `<option value="${d.id}">${v.title}</option>`;

    listEl.innerHTML += `
      <div class="item-row" style="animation-delay:${i * 0.03}s">
        <img class="item-thumb" src="${v.thumbnail || ""}" alt="" loading="lazy">
        <div class="item-info">
          <div class="item-title">${v.title} ${badge}</div>
          <div class="item-sub">${v.category || "No category"} • ${v.duration || ""} • ${v.year || ""}</div>
        </div>
        <div class="item-actions">
          <button class="btn-outline" data-id="${d.id}" data-action="edit-vid">Edit</button>
          <button class="btn-danger" data-id="${d.id}" data-action="delete-vid">Delete</button>
        </div>
      </div>
      <div class="vid-edit-box" id="vidEdit-${d.id}" style="display:none;"></div>
    `;
    i++;
  });

  listEl.querySelectorAll('[data-action="delete-vid"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("ఈ వీడియో delete చేయాలా?")) return;
      await deleteDoc(doc(db, "streamVideos", btn.dataset.id));
      loadVideos();
    });
  });

  listEl.querySelectorAll('[data-action="edit-vid"]').forEach(btn => {
    btn.addEventListener("click", () => openVideoEditor(btn.dataset.id));
  });
}

async function openVideoEditor(id) {
  const box = document.getElementById(`vidEdit-${id}`);
  if (box.style.display === "block") { box.style.display = "none"; return; }

  const snap = await getDoc(doc(db, "streamVideos", id));
  if (!snap.exists()) return;
  const v = snap.data();

  const catSnap = await getDocs(collection(db, "streamCategories"));
  let catOptions = `<option value="">Select Category</option>`;
  catSnap.forEach(c => {
    const cd = c.data();
    catOptions += `<option value="${c.id}" ${c.id === v.categoryId ? "selected" : ""}>${cd.emoji || ""} ${cd.name}</option>`;
  });

  box.style.display = "block";
  box.innerHTML = `
    <div class="panel fade-in" style="margin-top:10px;">
      <input type="text" class="e-title" value="${v.title || ""}" placeholder="Title">
      <textarea class="e-desc" placeholder="Description">${v.description || ""}</textarea>
      <div class="row2">
        <input type="text" class="e-yt" value="${v.youtubeId || ""}" placeholder="YouTube URL లేదా ID">
        <input type="text" class="e-thumb" value="${v.thumbnail || ""}" placeholder="Thumbnail URL">
      </div>
      <div class="row2">
        <select class="e-cat">${catOptions}</select>
        <select class="e-access">
          <option value="free" ${v.access === "free" ? "selected" : ""}>Free</option>
          <option value="paid" ${v.access === "paid" ? "selected" : ""}>Premium (Paid)</option>
        </select>
      </div>
      <div class="row2">
        <input type="text" class="e-dur" value="${v.duration || ""}" placeholder="Duration">
        <input type="text" class="e-year" value="${v.year || ""}" placeholder="Year">
      </div>
      <button class="btn-primary e-save">Save Changes</button>
      <p class="msg e-msg"></p>
    </div>
  `;

  box.querySelector(".e-save").addEventListener("click", async () => {
    const catSelect = box.querySelector(".e-cat");
    const categoryName = catSelect.options[catSelect.selectedIndex]?.text.trim() || "";
    const cleanId = extractYoutubeId(box.querySelector(".e-yt").value.trim());
    let editThumb = box.querySelector(".e-thumb").value.trim();
    const thumbLooksBroken = !editThumb || editThumb.includes("?") || editThumb.includes("si=");
    if (thumbLooksBroken && cleanId) {
      editThumb = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
    }
    const saveBtn = box.querySelector(".e-save");
    const msgEl = box.querySelector(".e-msg");

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-inline"></span>Saving...`;

    try {
      await updateDoc(doc(db, "streamVideos", id), {
        title: box.querySelector(".e-title").value.trim(),
        description: box.querySelector(".e-desc").value.trim(),
        youtubeId: cleanId,
        thumbnail: editThumb,
        categoryId: catSelect.value,
        category: categoryName,
        access: box.querySelector(".e-access").value,
        duration: box.querySelector(".e-dur").value.trim(),
        year: box.querySelector(".e-year").value.trim(),
        updatedAt: serverTimestamp()
      });

      showMsg(msgEl, "✅ Video updated", "success");
      loadVideos();
    } catch (e) {
      showMsg(msgEl, "❌ Error updating video", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save Changes";
    }
  });
}

/* ══════════════ HERO / FEATURED ══════════════ */

document.getElementById("saveHeroBtn").addEventListener("click", async () => {
  const videoId = document.getElementById("heroVideoSelect").value;
  const msgEl = document.getElementById("heroMsg");

  if (!videoId) {
    showMsg(msgEl, "వీడియో ఎంచుకోండి", "error");
    return;
  }

  await setDoc(doc(db, "streamSettings", "hero"), {
    videoId, updatedAt: serverTimestamp()
  });

  showMsg(msgEl, "✅ Featured video saved", "success");
});

async function loadHeroCurrent() {
  const snap = await getDoc(doc(db, "streamSettings", "hero"));
  if (!snap.exists()) return;
  const heroId = snap.data().videoId;
  const select = document.getElementById("heroVideoSelect");
  if (heroId) select.value = heroId;
}

/* ══════════════ SUBSCRIBERS ══════════════ */

function isActiveSubscription(data) {
  if (!data || !data.active) return false;
  if (!data.expiresAt) return true;
  return new Date(data.expiresAt).getTime() > Date.now();
}

async function loadSubscribers() {
  const tbody = document.getElementById("subsTableBody");
  const snap = await getDocs(collection(db, "subscribers"));

  const subs = [];
  snap.forEach(d => subs.push({ id: d.id, ...d.data() }));

  tbody.innerHTML = "";

  if (subs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:20px;">Subscribers లేరు</td></tr>`;
    return;
  }

  subs.forEach((s, i) => {
    const active = isActiveSubscription(s);
    const badge = active
      ? `<span class="badge badge-active">Active</span>`
      : `<span class="badge badge-expired">${s.active ? "Expired" : "Inactive"}</span>`;
    const expiryText = s.expiresAt
      ? new Date(s.expiresAt).toLocaleDateString("en-IN")
      : "—";

    tbody.innerHTML += `
      <tr style="animation-delay:${i * 0.03}s">
        <td>${s.name || "—"}</td>
        <td>${s.email || "—"}</td>
        <td>${s.plan || "—"}</td>
        <td>₹${s.amount || 0}</td>
        <td>${badge}</td>
        <td>${expiryText}</td>
        <td>
          <button class="btn-outline" data-id="${s.id}" data-current="${s.active}" data-action="toggle-sub">
            ${s.active ? "Deactivate" : "Activate"}
          </button>
        </td>
      </tr>
    `;
  });

  tbody.querySelectorAll('[data-action="toggle-sub"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const newState = btn.dataset.current !== "true";
      await updateDoc(doc(db, "subscribers", btn.dataset.id), { active: newState });
      loadSubscribers();
    });
  });
}

document.getElementById("cleanupExpiredBtn").addEventListener("click", async () => {
  const btn = document.getElementById("cleanupExpiredBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-inline"></span>Checking...`;

  const snap = await getDocs(collection(db, "subscribers"));
  let count = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (data.active && data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now()) {
      await updateDoc(doc(db, "subscribers", d.id), { active: false });
      count++;
    }
  }

  btn.disabled = false;
  btn.innerText = "గడువు ముగిసిన వారిని Deactivate చేయండి";

  alert(`✅ ${count} గడువు ముగిసిన subscribers deactivate చేయబడ్డారు`);
  loadSubscribers();
});

/* ══════════════ INIT ══════════════ */

async function init() {
  await loadCategories();
  await loadVideos();
  await loadHeroCurrent();
  await loadSubscribers();
}

init();
