import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc,
  doc, setDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

// AUTH GUARD
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "admin.html";
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

/* ══════════════ CATEGORIES ══════════════ */

const saveCatBtn = document.getElementById("saveCatBtn");
saveCatBtn.addEventListener("click", async () => {
  const name = document.getElementById("catName").value.trim();
  const emoji = document.getElementById("catEmoji").value.trim();
  const order = Number(document.getElementById("catOrder").value) || Date.now();

  if (!name) {
    document.getElementById("catMsg").innerText = "Category పేరు అవసరం";
    return;
  }

  await addDoc(collection(db, "streamCategories"), {
    name, emoji, order, createdAt: serverTimestamp()
  });

  document.getElementById("catName").value = "";
  document.getElementById("catEmoji").value = "";
  document.getElementById("catOrder").value = "";
  document.getElementById("catMsg").innerText = "✅ Category saved";

  loadCategories();
});

async function loadCategories() {
  const listEl = document.getElementById("catList");
  const vidSelect = document.getElementById("vidCategorySelect");

  const q = query(collection(db, "streamCategories"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  listEl.innerHTML = "";
  vidSelect.innerHTML = `<option value="">Select Category</option>`;

  snap.forEach(d => {
    const c = d.data();

    vidSelect.innerHTML += `<option value="${d.id}">${c.emoji || ""} ${c.name}</option>`;

    listEl.innerHTML += `
      <div class="item-row">
        <div class="item-info">
          <div class="item-title">${c.emoji || ""} ${c.name}</div>
          <div class="item-sub">Order: ${c.order}</div>
        </div>
        <div class="item-actions">
          <button class="btn-danger" data-id="${d.id}" data-action="delete-cat">Delete</button>
        </div>
      </div>
    `;
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
  const youtubeId = document.getElementById("vidYoutubeId").value.trim();
  let thumbnail = document.getElementById("vidThumb").value.trim();
  const categorySelect = document.getElementById("vidCategorySelect");
  const categoryId = categorySelect.value;
  const categoryName = categorySelect.options[categorySelect.selectedIndex]?.text.trim() || "";
  const access = document.getElementById("vidAccess").value;
  const duration = document.getElementById("vidDuration").value.trim();
  const year = document.getElementById("vidYear").value.trim();

  if (!title || !youtubeId || !categoryId) {
    document.getElementById("vidMsg").innerText = "Title, YouTube ID మరియు Category అవసరం";
    return;
  }

  if (!thumbnail) {
    thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }

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
  document.getElementById("vidMsg").innerText = "✅ Video saved";

  loadVideos();
});

async function loadVideos() {
  const listEl = document.getElementById("vidList");
  const heroSelect = document.getElementById("heroVideoSelect");

  const q = query(collection(db, "streamVideos"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  listEl.innerHTML = "";
  heroSelect.innerHTML = `<option value="">Select Video</option>`;

  snap.forEach(d => {
    const v = d.data();
    const badge = v.access === "free"
      ? `<span class="badge badge-free">FREE</span>`
      : `<span class="badge badge-paid">PREMIUM</span>`;

    heroSelect.innerHTML += `<option value="${d.id}">${v.title}</option>`;

    listEl.innerHTML += `
      <div class="item-row">
        <img class="item-thumb" src="${v.thumbnail || ""}" alt="">
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
    <div class="panel" style="margin-top:10px;">
      <input type="text" class="e-title" value="${v.title || ""}" placeholder="Title">
      <textarea class="e-desc" placeholder="Description">${v.description || ""}</textarea>
      <div class="row2">
        <input type="text" class="e-yt" value="${v.youtubeId || ""}" placeholder="YouTube ID">
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
    </div>
  `;

  box.querySelector(".e-save").addEventListener("click", async () => {
    const catSelect = box.querySelector(".e-cat");
    const categoryName = catSelect.options[catSelect.selectedIndex]?.text.trim() || "";

    await updateDoc(doc(db, "streamVideos", id), {
      title: box.querySelector(".e-title").value.trim(),
      description: box.querySelector(".e-desc").value.trim(),
      youtubeId: box.querySelector(".e-yt").value.trim(),
      thumbnail: box.querySelector(".e-thumb").value.trim(),
      categoryId: catSelect.value,
      category: categoryName,
      access: box.querySelector(".e-access").value,
      duration: box.querySelector(".e-dur").value.trim(),
      year: box.querySelector(".e-year").value.trim(),
      updatedAt: serverTimestamp()
    });

    alert("✅ Video updated");
    loadVideos();
  });
}

/* ══════════════ HERO / FEATURED ══════════════ */

document.getElementById("saveHeroBtn").addEventListener("click", async () => {
  const videoId = document.getElementById("heroVideoSelect").value;
  if (!videoId) {
    document.getElementById("heroMsg").innerText = "వీడియో ఎంచుకోండి";
    return;
  }

  await setDoc(doc(db, "streamSettings", "hero"), {
    videoId, updatedAt: serverTimestamp()
  });

  document.getElementById("heroMsg").innerText = "✅ Featured video saved";
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

  subs.forEach(s => {
    const active = isActiveSubscription(s);
    const badge = active
      ? `<span class="badge badge-active">Active</span>`
      : `<span class="badge badge-expired">${s.active ? "Expired" : "Inactive"}</span>`;
    const expiryText = s.expiresAt
      ? new Date(s.expiresAt).toLocaleDateString("en-IN")
      : "—";

    tbody.innerHTML += `
      <tr>
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
  const snap = await getDocs(collection(db, "subscribers"));
  let count = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (data.active && data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now()) {
      await updateDoc(doc(db, "subscribers", d.id), { active: false });
      count++;
    }
  }

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
