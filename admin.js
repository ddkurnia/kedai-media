// ============================================================
// KEDAI MEDIA ADMIN PANEL - admin.js
// Firebase Auth + Firestore + GitHub API Integration
// ============================================================

// === FIREBASE CONFIG ===
// Dapatkan config ini dari: Firebase Console > Project Settings > Web App
// Ganti nilai di bawah dengan config yang benar dari Firebase Console Anda
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCob2WoQs8nbtqwVojD_39H39Uuq8WDYpQ",
    authDomain: "kedaimedia-a26e5.firebaseapp.com",
    projectId: "kedaimedia-a26e5",
    storageBucket: "kedaimedia-a26e5.firebasestorage.app",
    messagingSenderId: "594372373056",
    appId: "1:594372373056:web:dc1e5e0d7ff3de7c430da5",
    measurementId: "G-LTM1QNFLVP"
};

// === CLOUDINARY CONFIG ===
const CLOUDINARY_CONFIG = {
    cloudName: 'dnpdjhdgr',
    uploadPreset: 'kedaimedia',
    // Auto kompres: WebP format + quality auto + max width 1200px
    get uploadUrl() {
        return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    },
    // Thumbnail URL: auto format (WebP) + auto quality + width 600
    getThumbUrl: function(publicId) {
        return `https://res.cloudinary.com/${this.cloudName}/image/upload/f_auto,q_auto,w_600/${publicId}`;
    },
    // Artikel gambar URL: auto format + auto quality + width 800
    getArticleUrl: function(publicId) {
        return `https://res.cloudinary.com/${this.cloudName}/image/upload/f_auto,q_auto,w_800/${publicId}`;
    },
    // OG Image URL: 1200x630
    getOgUrl: function(publicId) {
        return `https://res.cloudinary.com/${this.cloudName}/image/upload/f_auto,q_auto,w_1200,h_630,c_fill/${publicId}`;
    }
};

let lastUploadedUrl = '';
let lastUploadedPublicId = '';

// === CLOUDINARY UPLOAD FUNCTIONS ===
function compressImage(file, maxWidth, quality) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if wider than maxWidth
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(function(blob) {
                    resolve(blob);
                }, 'image/webp', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function uploadToCloudinary(file) {
    const zone = document.getElementById('uploadZone');
    const zoneContent = document.getElementById('uploadZoneContent');
    const progress = document.getElementById('uploadProgress');
    const statusText = document.getElementById('uploadStatusText');

    // Show progress
    zone.classList.add('uploading');
    zoneContent.classList.add('hidden');
    progress.classList.remove('hidden');
    statusText.textContent = 'Mengkompres gambar...';

    try {
        // Step 1: Kompres gambar (max 1600px, quality 0.8)
        const compressedFile = await compressImage(file, 1600, 0.8);
        const originalSize = file.size;
        const compressedSize = compressedFile.size;
        const savings = Math.round((1 - compressedSize / originalSize) * 100);

        statusText.textContent = `Terkompres ${savings}% (${formatBytes(compressedSize)}) — Mengupload...`;

        // Step 2: Upload ke Cloudinary (unsigned upload)
        const formData = new FormData();
        formData.append('file', compressedFile, file.name.replace(/\.[^.]+$/, '.webp'));
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        // Cloudinary server-side transformations untuk kompresi tambahan
        formData.append('quality', 'auto:good');
        formData.append('fetch_format', 'auto');

        const response = await fetch(CLOUDINARY_CONFIG.uploadUrl, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Upload gagal');
        }

        // Step 3: Tampilkan hasil
        lastUploadedUrl = CLOUDINARY_CONFIG.getArticleUrl(data.public_id);
        lastUploadedPublicId = data.public_id;

        // Show result
        document.getElementById('uploadResult').classList.remove('hidden');
        document.getElementById('uploadPreviewImg').src = CLOUDINARY_CONFIG.getThumbUrl(data.public_id);
        document.getElementById('uploadFileName').textContent = data.public_id.split('/').pop();
        document.getElementById('uploadFileSize').textContent =
            `${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (hemat ${savings}%) | Format: ${data.format}`;

        showToast(`Gambar berhasil diupload! Kompresi: ${savings}%`, 'success');

    } catch (error) {
        showToast('Upload gagal: ' + error.message, 'error');
    } finally {
        // Reset zone
        zone.classList.remove('uploading');
        zoneContent.classList.remove('hidden');
        progress.classList.add('hidden');
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
        showToast('Hanya file gambar yang diperbolehkan.', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('Ukuran file maksimal 10MB.', 'error');
        return;
    }

    uploadToCloudinary(file);
    event.target.value = ''; // Reset input
}

function copyUploadUrl() {
    if (!lastUploadedUrl) return;
    navigator.clipboard.writeText(lastUploadedUrl).then(() => {
        showToast('URL gambar berhasil di-copy!', 'success');
    });
}

function useAsThumbnail() {
    if (!lastUploadedUrl) return;
    // Use thumbnail size for article image
    const thumbUrl = CLOUDINARY_CONFIG.getThumbUrl(lastUploadedPublicId);
    document.getElementById('articleImage').value = thumbUrl;
    showImagePreview();
    showToast('Gambar dijadikan thumbnail!', 'success');
}

function insertImageToContent() {
    if (!lastUploadedUrl) return;
    const articleTitle = document.getElementById('articleTitle').value || 'gambar';
    const imgTag = `<img src="${lastUploadedUrl}" alt="${escAttr(articleTitle)}">`;
    const textarea = document.getElementById('articleContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + imgTag + '\n' + textarea.value.substring(end);
    textarea.focus();
    showToast('Gambar di-insert ke konten artikel!', 'success');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// === DRAG & DROP ===
function initDragDrop() {
    const zone = document.getElementById('uploadZone');
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        zone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        zone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.classList.remove('drag-over');
        });
    });

    zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                uploadToCloudinary(file);
            } else {
                showToast('Hanya file gambar yang diperbolehkan.', 'error');
            }
        }
    });
}

// === SITE CONFIG ===
const SITE_CONFIG = {
    domain: 'kedaimedia.com',
    siteUrl: 'https://kedaimedia.com',
    blogPath: '/blog/',
    siteName: 'Kedai Media Indonesia',
    author: 'Tim Kedai Media',
    authorImg: 'https://i.pravatar.cc/150?img=68',
    googleSiteVerification: 'uhQbLYS0LhZkFZtxX9bQBlViS_13YCNKOyJcya7nyX4'
};

// === EXISTING ARTICLES (dari sitemap.xml yang sudah ada) ===
const EXISTING_ARTICLES = [
    { slug: 'cara-mengembalikan-akun-facebook-di-hack', title: 'Cara Mengembalikan Akun Facebook yang Di Hack: Panduan Lengkap' },
    { slug: 'akun-facebook-di-hack-email-diganti', title: 'Akun Facebook Di Hack Email Diganti? Ini Solusinya' },
    { slug: 'akun-facebook-di-hack-nomor-diganti', title: 'Akun Facebook Di Hack Nomor HP Diganti: Cara Mengatasinya' },
    { slug: 'cara-memulihkan-akun-facebook-tidak-bisa-login', title: 'Cara Memulihkan Akun Facebook Tidak Bisa Login' },
    { slug: 'cara-mencegah-akun-sosial-media-di-hack', title: '5 Cara Mencegah Akun Sosial Media Di Hack' },
    { slug: 'cara-mengamankan-akun-instagram-dari-hacking', title: 'Cara Mengamankan Akun Instagram dari Hacking' },
    { slug: 'cara-mengembalikan-akun-facebook-instagram-tiktok-dinonaktifkan', title: 'Cara Mengembalikan Akun Facebook, Instagram, dan TikTok yang Dinonaktifkan' }
];

// === GLOBALS ===
let db = null;
let articles = [];
let deleteTargetId = null;

// === INIT FIREBASE ===
function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(FIREBASE_CONFIG);
            db = firebase.firestore();
            console.log('Firebase initialized');
        } else {
            console.warn('Firebase SDK not loaded. Using localStorage only.');
        }
    } catch (e) {
        console.error('Firebase init error:', e);
    }
}

// === AUTH ===
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');

    errorEl.textContent = '';
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    // Cek Firebase status
    if (db && typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                showDashboard(userCredential.user);
            })
            .catch((error) => {
                let msg = 'Login gagal. ' + error.message;
                if (error.code === 'auth/user-not-found') msg = 'Email tidak terdaftar di Firebase. Gunakan mode fallback atau tambah user di Firebase Console.';
                else if (error.code === 'auth/wrong-password') msg = 'Password salah.';
                else if (error.code === 'auth/invalid-credential') msg = 'Email atau password salah.';
                else if (error.code === 'auth/too-many-requests') msg = 'Terlalu banyak percobaan. Coba lagi nanti.';
                else if (error.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
                errorEl.textContent = msg;
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
            });
    } else {
        // Fallback: localStorage auth
        setTimeout(() => {
            if (email === 'admin@kedaimedia.com' && password.length >= 6) {
                localStorage.setItem('km_admin_auth', JSON.stringify({ email, timestamp: Date.now() }));
                showDashboard({ email });
            } else {
                var fbStatus = firebaseLoading ? 'masih loading...' : 'tidak tersedia';
                errorEl.textContent = "Login gagal. Gunakan email admin@kedaimedia.com. (Firebase " + fbStatus + ")";
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
            }
        }, 500);
    }
}

function showDashboard(user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('adminEmail').textContent = user.email;
    loadArticles();
    updateDashboard();
}

function logout() {
    if (db) {
        firebase.auth().signOut();
    }
    localStorage.removeItem('km_admin_auth');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginBtnText').classList.remove('hidden');
    document.getElementById('loginSpinner').classList.add('hidden');
}

function checkAuth() {
    if (db) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                showDashboard(user);
            }
        });
    } else {
        const stored = localStorage.getItem('km_admin_auth');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Session valid for 24 hours
                if (Date.now() - data.timestamp < 86400000) {
                    showDashboard(data);
                } else {
                    localStorage.removeItem('km_admin_auth');
                }
            } catch (e) {
                localStorage.removeItem('km_admin_auth');
            }
        }
    }
}

function togglePassword() {
    const pw = document.getElementById('loginPassword');
    const icon = document.getElementById('eyeIcon');
    if (pw.type === 'password') {
        pw.type = 'text';
        icon.className = 'ri-eye-line';
    } else {
        pw.type = 'password';
        icon.className = 'ri-eye-off-line';
    }
}

// === NAVIGATION ===
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const section = document.getElementById('section-' + sectionId);
    if (section) section.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (navItem) navItem.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'articles': 'Kelola Artikel',
        'new-article': 'Artikel Baru',
        'seo': 'SEO Tools',
        'settings': 'Pengaturan'
    };
    document.getElementById('pageTitle').textContent = titles[sectionId] || sectionId;

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');

    // Refresh data when switching sections
    if (sectionId === 'dashboard') updateDashboard();
    if (sectionId === 'articles') renderArticlesTable();
    if (sectionId === 'seo') updateSEOStatus();
    if (sectionId === 'settings') loadSettings();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// === ARTICLES CRUD (localStorage + Firestore) ===
function getArticles() {
    // Priority: Firestore > localStorage
    return new Promise((resolve) => {
        if (db) {
            db.collection('articles').orderBy('createdAt', 'desc').get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        articles = data;
                        localStorage.setItem('km_articles', JSON.stringify(data));
                        resolve(data);
                    } else {
                        const local = JSON.parse(localStorage.getItem('km_articles') || '[]');
                        articles = local;
                        resolve(local);
                    }
                })
                .catch(() => {
                    const local = JSON.parse(localStorage.getItem('km_articles') || '[]');
                    articles = local;
                    resolve(local);
                });
        } else {
            const local = JSON.parse(localStorage.getItem('km_articles') || '[]');
            articles = local;
            resolve(local);
        }
    });
}

function loadArticles() {
    getArticles().then(() => {
        renderArticlesTable();
        updateDashboard();
    });
}

function saveArticleToStorage(articleData) {
    if (articleData.id) {
        // Update
        const idx = articles.findIndex(a => a.id === articleData.id);
        if (idx !== -1) {
            articles[idx] = { ...articles[idx], ...articleData, updatedAt: new Date().toISOString() };
        }
    } else {
        // Create
        articleData.id = 'art_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        articleData.createdAt = new Date().toISOString();
        articleData.updatedAt = articleData.createdAt;
        articles.unshift(articleData);
    }

    localStorage.setItem('km_articles', JSON.stringify(articles));

    // Also save to Firestore
    if (db) {
        const firestoreData = { ...articleData };
        delete firestoreData.id;
        db.collection('articles').doc(articleData.id).set(firestoreData, { merge: true })
            .catch(e => console.warn('Firestore save error:', e));
    }

    return articleData;
}

function deleteArticleFromStorage(articleId) {
    articles = articles.filter(a => a.id !== articleId);
    localStorage.setItem('km_articles', JSON.stringify(articles));

    if (db) {
        db.collection('articles').doc(articleId).delete()
            .catch(e => console.warn('Firestore delete error:', e));
    }
}

// === RENDER ARTICLES TABLE ===
function renderArticlesTable() {
    const tbody = document.getElementById('articlesTableBody');
    if (!tbody) return;

    if (articles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#9aa0a6;">Belum ada artikel. Klik "Artikel Baru" untuk membuat.</td></tr>';
        return;
    }

    const search = (document.getElementById('searchArticles')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';

    let filtered = articles.filter(a => {
        const matchSearch = !search || a.title.toLowerCase().includes(search) || (a.slug || '').includes(search);
        const matchStatus = statusFilter === 'all' || a.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#9aa0a6;">Tidak ada artikel yang cocok.</td></tr>';
        return;
    }

    const categoryLabels = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', keamanan: 'Keamanan', tutorial: 'Tutorial' };

    tbody.innerHTML = filtered.map(a => `
        <tr>
            <td style="font-weight:500;max-width:300px;"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(a.title)}</div></td>
            <td>${categoryLabels[a.category] || a.category || '-'}</td>
            <td><span class="status-badge ${a.status === 'published' ? 'status-published' : 'status-draft'}">${a.status === 'published' ? 'Terbit' : 'Draft'}</span></td>
            <td style="white-space:nowrap;color:#5f6368;font-size:13px;">${a.date || formatDate(a.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editArticle('${a.id}')"><i class="ri-edit-line"></i> Edit</button>
                    <button class="btn-delete" onclick="showDeleteModal('${a.id}')"><i class="ri-delete-bin-line"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterArticles() {
    renderArticlesTable();
}

// === SAVE ARTICLE ===
function saveArticle() {
    const title = document.getElementById('articleTitle').value.trim();
    const slug = document.getElementById('articleSlug').value.trim();
    const category = document.getElementById('articleCategory').value;
    const metaTitle = document.getElementById('articleMetaTitle').value.trim();
    const metaDesc = document.getElementById('articleMetaDesc').value.trim();
    const keywords = document.getElementById('articleKeywords').value.trim();
    const image = document.getElementById('articleImage').value.trim();
    const readTime = document.getElementById('articleReadTime').value.trim() || '5 menit';
    const status = document.getElementById('articleStatus').value;
    const excerpt = document.getElementById('articleExcerpt').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    const editId = document.getElementById('editArticleId').value;

    // Validation
    if (!title) return showToast('Judul artikel wajib diisi.', 'error');
    if (!slug) return showToast('URL Slug wajib diisi.', 'error');
    if (!content) return showToast('Konten artikel wajib diisi.', 'error');

    // Check duplicate slug
    const slugExists = articles.find(a => a.slug === slug && a.id !== editId);
    if (slugExists) return showToast('Slug sudah digunakan artikel lain.', 'error');

    const articleData = {
        title, slug, category, metaTitle, metaDesc, keywords,
        image, readTime, status, excerpt, content,
        date: formatDate(new Date().toISOString())
    };

    if (editId) {
        articleData.id = editId;
    }

    saveArticleToStorage(articleData);
    showToast(editId ? 'Artikel berhasil diperbarui!' : 'Artikel berhasil disimpan!', 'success');
    resetForm();
    loadArticles();
}

// === EDIT ARTICLE ===
function editArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) return;

    document.getElementById('editArticleId').value = article.id;
    document.getElementById('editorTitle').textContent = 'Edit Artikel';
    document.getElementById('articleTitle').value = article.title || '';
    document.getElementById('articleSlug').value = article.slug || '';
    document.getElementById('articleCategory').value = article.category || 'facebook';
    document.getElementById('articleMetaTitle').value = article.metaTitle || '';
    document.getElementById('articleMetaDesc').value = article.metaDesc || '';
    document.getElementById('articleKeywords').value = article.keywords || '';
    document.getElementById('articleImage').value = article.image || '';
    document.getElementById('articleReadTime').value = article.readTime || '';
    document.getElementById('articleStatus').value = article.status || 'draft';
    document.getElementById('articleExcerpt').value = article.excerpt || '';
    document.getElementById('articleContent').value = article.content || '';
    updateCharCount();
    updateSlugPreview();
    showImagePreview();
    showSection('new-article');
    window.scrollTo(0, 0);
}

// === DELETE ARTICLE ===
function showDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.add('hidden');
}

function confirmDeleteArticle() {
    if (!deleteTargetId) return;
    deleteArticleFromStorage(deleteTargetId);
    showToast('Artikel berhasil dihapus.', 'success');
    closeDeleteModal();
    loadArticles();
}

function confirmClearData() {
    if (confirm('Hapus SEMUA data artikel lokal? Tindakan ini tidak bisa dibatalkan.')) {
        articles = [];
        localStorage.removeItem('km_articles');
        if (db) {
            db.collection('articles').get().then(snap => {
                const batch = db.batch();
                snap.docs.forEach(doc => batch.delete(doc.ref));
                return batch.commit();
            }).catch(() => {});
        }
        showToast('Semua data berhasil dihapus.', 'success');
        loadArticles();
    }
}

// === FORM HELPERS ===
function resetForm() {
    document.getElementById('articleForm').reset();
    document.getElementById('editArticleId').value = '';
    document.getElementById('editorTitle').textContent = 'Tulis Artikel Baru';
    document.getElementById('previewSection').classList.add('hidden');
    document.getElementById('generatedHTMLSection').classList.add('hidden');
    document.getElementById('imagePreviewContainer').innerHTML = '';
    document.getElementById('uploadResult')?.classList.add('hidden');
    updateCharCount();
    updateSlugPreview();
}

function updateCharCount() {
    const title = document.getElementById('articleMetaTitle').value;
    const desc = document.getElementById('articleMetaDesc').value;
    const titleCount = document.getElementById('titleCharCount');
    const descCount = document.getElementById('descCharCount');
    titleCount.textContent = title.length + '/60';
    descCount.textContent = desc.length + '/160';
    titleCount.style.color = title.length > 60 ? '#d93025' : '#9aa0a6';
    descCount.style.color = desc.length > 160 ? '#d93025' : '#9aa0a6';
}

function updateSlugPreview() {
    const slug = document.getElementById('articleSlug').value || 'slug-anda';
    document.getElementById('slugPreview').textContent = slug;
}

function showImagePreview() {
    const url = document.getElementById('articleImage').value.trim();
    const container = document.getElementById('imagePreviewContainer');
    if (url) {
        container.innerHTML = `<img src="${escAttr(url)}" alt="Preview" onerror="this.style.display='none'">`;
    } else {
        container.innerHTML = '';
    }
}

// === EDITOR TOOLBAR ===
function insertTag(tag) {
    const textarea = document.getElementById('articleContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let insertion = '';

    const templates = {
        'h2': '<h2>Judul Sub Heading</h2>',
        'h3': '<h3>Judul Sub Heading</h3>',
        'p': '<p>Paragraf artikel Anda di sini...</p>',
        'strong': '<strong>teks tebal</strong>',
        'em': '<em>teks miring</em>',
        'ul': '<ul>\n<li>Point pertama</li>\n<li>Point kedua</li>\n<li>Point ketiga</li>\n</ul>',
        'ol': '<ol>\n<li>Langkah pertama</li>\n<li>Langkah kedua</li>\n<li>Langkah ketiga</li>\n</ol>',
        'img': '<img src="https://images.unsplash.com/photo-xxx?w=800&q=80" alt="deskripsi gambar">',
        'a': '<a href="https://kedaimedia.com">teks link</a>',
        'blockquote': '<blockquote>Kutipan penting di sini...</blockquote>',
        'pre': '<pre>Kode atau teks yang diformat</pre>'
    };

    insertion = templates[tag] || `<${tag}>${selected}</${tag}>`;
    textarea.value = textarea.value.substring(0, start) + insertion + textarea.value.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
}

// === PREVIEW ARTICLE ===
function previewArticle() {
    const content = document.getElementById('articleContent').value;
    const title = document.getElementById('articleTitle').value || 'Judul Artikel';
    const previewEl = document.getElementById('articlePreview');
    previewEl.innerHTML = `<h1>${escHtml(title)}</h1>` + content;
    document.getElementById('previewSection').classList.remove('hidden');
    document.getElementById('generatedHTMLSection').classList.add('hidden');
}

// === GENERATE ARTICLE HTML ===
function generateArticleHTML() {
    const title = document.getElementById('articleTitle').value.trim();
    const slug = document.getElementById('articleSlug').value.trim();
    const metaTitle = document.getElementById('articleMetaTitle').value.trim() || title;
    const metaDesc = document.getElementById('articleMetaDesc').value.trim();
    const keywords = document.getElementById('articleKeywords').value.trim();
    const image = document.getElementById('articleImage').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    const category = document.getElementById('articleCategory').value;

    const articleUrl = SITE_CONFIG.siteUrl + '/blog/' + slug;
    const ogImage = image || 'https://via.placeholder.com/1200x630?text=Kedai+Media';

    // Match the existing article template style
    return `<!DOCTYPE html>  <html lang="id">  
<head>  <meta charset="UTF-8">  
<meta name="viewport" content="width=device-width, initial-scale=1.0">  
<title>${escHtml(metaTitle)} | Kedai Media</title>  
<meta name="description" content="${escAttr(metaDesc)}">  
<link rel="canonical" href="${articleUrl}" />  
<meta name="robots" content="index, follow">  
<meta name="author" content="${SITE_CONFIG.siteName}">  
<meta name="keywords" content="${escAttr(keywords)}">  
<meta name="google-site-verification" content="${SITE_CONFIG.googleSiteVerification}" />  

<meta property="og:locale" content="id_ID">  
<meta property="og:type" content="article">  
<meta property="og:title" content="${escAttr(metaTitle)}">  
<meta property="og:description" content="${escAttr(metaDesc)}">  
<meta property="og:url" content="${articleUrl}">  
<meta property="og:site_name" content="${SITE_CONFIG.siteName}">  
<meta property="og:image" content="${ogImage}">  
<meta property="og:image:width" content="1200">  
<meta property="og:image:height" content="630">  
<meta name="twitter:card" content="summary_large_image">  
<meta name="twitter:title" content="${escAttr(metaTitle)}">  
<meta name="twitter:description" content="${escAttr(metaDesc)}">  
<meta name="twitter:image" content="${ogImage}">  
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6218465141589887" crossorigin="anonymous"><\/script>  
<style>  
body{  
font-family: Arial, sans-serif;  
line-height:1.7;  
max-width:800px;  
margin:auto;  
padding:20px;  
color:#333;  
}  
h1,h2{  
margin-top:30px;  
}  
img{  
width:100%;  
border-radius:10px;  
margin:20px 0;  
}  
.box{  
background:#f5f7fb;  
padding:20px;  
border-radius:10px;  
margin:25px 0;  
}  
.cta{  
background:#e8f1ff;  
padding:20px;  
border-radius:10px;  
}  
a{  
color:#0077ff;  
text-decoration:none;  
font-weight:bold;  
}  
</style>  </head>  <body>  
<h1>${escHtml(title)}</h1>  
${image ? '<img src="' + image + '" alt="' + escAttr(title) + '">' : ''}
${content}
<div class="cta">  
<p>Butuh bantuan profesional untuk memulihkan akun Anda? <a href="https://kedaimedia.com/">Hubungi Kedai Media</a> untuk konsultasi gratis.</p>  
</div>  
</body>  </html>`;
}

function generateHTML() {
    const html = generateArticleHTML();
    document.getElementById('generatedHTML').value = html;
    document.getElementById('generatedHTMLSection').classList.remove('hidden');
    document.getElementById('previewSection').classList.add('hidden');
    runSEOChecker();
}

function copyGeneratedHTML() {
    const textarea = document.getElementById('generatedHTML');
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast('HTML berhasil di-copy!', 'success');
    });
}

function downloadHTML() {
    const slug = document.getElementById('articleSlug').value.trim() || 'artikel';
    const html = document.getElementById('generatedHTML').value;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slug + '.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('File HTML berhasil di-download!', 'success');
}

// === PUBLISH TO GITHUB ===
function getGitHubConfig() {
    return {
        token: localStorage.getItem('km_github_token') || '',
        owner: localStorage.getItem('km_github_owner') || 'ddkurnia',
        repo: localStorage.getItem('km_github_repo') || 'kedai-media',
        branch: localStorage.getItem('km_github_branch') || 'main'
    };
}

async function githubAPI(method, path, body) {
    const config = getGitHubConfig();
    if (!config.token) {
        showToast('GitHub token belum dikonfigurasi. Buka Pengaturan > GitHub Integration.', 'error');
        return null;
    }

    const url = `https://api.github.com/repos/${config.owner}/${config.repo}${path}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
    };

    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(url, options);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || `HTTP ${res.status}`);
        }
        return data;
    } catch (e) {
        showToast('GitHub API error: ' + e.message, 'error');
        return null;
    }
}

async function publishToGitHub() {
    const slug = document.getElementById('articleSlug').value.trim();
    const title = document.getElementById('articleTitle').value.trim();
    const status = document.getElementById('articleStatus').value;
    if (!slug) return showToast('Slug wajib diisi.', 'error');
    if (!title) return showToast('Judul wajib diisi.', 'error');

    // Auto-save dulu jika belum
    const editId = document.getElementById('editArticleId').value;
    if (!editId) {
        saveArticle();
    }

    const btn = document.getElementById('btnPublishGitHub');
    btn.disabled = true;
    let step = 1;
    const totalSteps = 4;
    const updateBtn = (msg) => { btn.innerHTML = `<span class="spinner"></span> [${step++}/${totalSteps}] ${msg}`; };

    try {
        // ========== STEP 1: Upload file HTML artikel ==========
        updateBtn('Upload artikel HTML...');
        const html = generateArticleHTML();
        const articlePath = `blog/${slug}.html`;

        const existingArticle = await githubAPI('GET', `/contents/${articlePath}`);
        const articleSha = existingArticle?.sha || null;

        const articleResult = await githubAPI('PUT', `/contents/${articlePath}`, {
            message: `artikel: ${slug}`,
            content: btoa(unescape(encodeURIComponent(html))),
            sha: articleSha,
            branch: getGitHubConfig().branch
        });
        if (!articleResult) throw new Error('Gagal upload artikel HTML');

        // ========== STEP 2: Update blog/index.html ==========
        updateBtn('Update blog index...');
        const image = document.getElementById('articleImage').value.trim();
        const readTime = document.getElementById('articleReadTime').value.trim() || '5 menit';
        const excerpt = document.getElementById('articleExcerpt').value.trim();
        const category = document.getElementById('articleCategory').value;
        const date = document.getElementById('articleMetaTitle') ? formatDate(new Date().toISOString()) : '';

        const blogIndexFile = await githubAPI('GET', '/contents/blog/index.html');
        if (!blogIndexFile) throw new Error('Gagal membaca blog/index.html');

        let blogIndexContent = decodeURIComponent(escape(atob(blogIndexFile.content)));

        // Cek apakah artikel sudah ada di blogPosts (berdasarkan slug di url)
        const articleUrl = `${SITE_CONFIG.siteUrl}/blog/${slug}`;
        const alreadyInIndex = blogIndexContent.includes(articleUrl);

        if (!alreadyInIndex) {
            // Cari ID tertinggi yang sudah ada
            const idMatches = blogIndexContent.match(/id:\s*(\d+)/g);
            let maxId = 0;
            if (idMatches) {
                idMatches.forEach(m => {
                    const num = parseInt(m.match(/\d+/)[0]);
                    if (num > maxId) maxId = num;
                });
            }
            const newId = maxId + 1;

            const newEntry = `  {
    id: ${newId},
    title: "${title.replace(/"/g, '\\"')}",
    excerpt: "${(excerpt || '').replace(/"/g, '\\"').substring(0, 200)}",
    category: "${category}",
    url: "${articleUrl}",
    image: "${image || 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&q=80'}",
    author: "${SITE_CONFIG.author}",
    authorImg: "${SITE_CONFIG.authorImg}",
    date: "${date}",
    readTime: "${readTime}",
    featured: false
  }`;

            // Inject sebelum penutup array ];
            blogIndexContent = blogIndexContent.replace(
                /(\}\s*\];)/,
                `},\n${newEntry}\n$1`
            );

            const blogIndexResult = await githubAPI('PUT', '/contents/blog/index.html', {
                message: `update: tambah artikel ${slug} ke blogPosts`,
                content: btoa(unescape(encodeURIComponent(blogIndexContent))),
                sha: blogIndexFile.sha,
                branch: getGitHubConfig().branch
            });
            if (!blogIndexResult) throw new Error('Gagal update blog/index.html');
        }

        // ========== STEP 3: Update sitemap.xml ==========
        updateBtn('Update sitemap...');
        const sitemapFile = await githubAPI('GET', '/contents/sitemap.xml');
        if (sitemapFile) {
            let sitemapContent = decodeURIComponent(escape(atob(sitemapFile.content)));

            // Cek apakah sudah ada di sitemap
            if (!sitemapContent.includes(articleUrl)) {
                const newUrlEntry = `\n<url>\n<loc>${articleUrl}</loc>\n<priority>0.80</priority>\n</url>\n  `;
                sitemapContent = sitemapContent.replace('</urlset>', `${newUrlEntry}</urlset>`);

                await githubAPI('PUT', '/contents/sitemap.xml', {
                    message: `update: sitemap tambah ${slug}`,
                    content: btoa(unescape(encodeURIComponent(sitemapContent))),
                    sha: sitemapFile.sha,
                    branch: getGitHubConfig().branch
                });
            }
        }

        // ========== STEP 4: Ping Google ==========
        updateBtn('Ping Google...');
        try {
            await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITE_CONFIG.siteUrl + '/sitemap.xml')}`, { mode: 'no-cors' });
        } catch (e) {}

        // ========== DONE ==========
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-github-fill"></i> Publish ke GitHub';
        showToast(`Artikel LIVE! ${alreadyInIndex ? '' : 'blog/index.html + sitemap.xml updated + '}Google pinged. URL: ${articleUrl}`, 'success');

        // Update status artikel jadi published
        const art = articles.find(a => a.slug === slug);
        if (art && art.status !== 'published') {
            art.status = 'published';
            localStorage.setItem('km_articles', JSON.stringify(articles));
            if (db) {
                db.collection('articles').doc(art.id).set({ status: 'published' }, { merge: true });
            }
            loadArticles();
        }

    } catch (error) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ri-github-fill"></i> Publish ke GitHub';
        showToast('Publish gagal: ' + error.message, 'error');
    }
}

async function publishSitemapToGitHub() {
    const content = document.getElementById('sitemapContent').value;
    if (!content) return showToast('Generate sitemap terlebih dahulu.', 'error');

    const encoded = btoa(unescape(encodeURIComponent(content)));
    const path = 'sitemap.xml';

    const existing = await githubAPI('GET', `/contents/${path}`);
    const sha = existing?.sha || null;

    const result = await githubAPI('PUT', `/contents/${path}`, {
        message: 'update: sitemap.xml',
        content: encoded,
        sha: sha,
        branch: getGitHubConfig().branch
    });

    if (result) {
        showToast('Sitemap berhasil di-update di GitHub!', 'success');
    }
}

// === SEO TOOLS ===
async function requestIndexing() {
    const url = document.getElementById('indexingUrl').value.trim();
    if (!url) return showToast('Masukkan URL untuk diindeks.', 'error');

    const resultEl = document.getElementById('indexingResult');
    const btn = document.getElementById('btnIndexing');

    btn.disabled = true;
    btn.textContent = 'Memproses...';
    resultEl.className = 'result-msg info';
    resultEl.textContent = 'Mengirim request...';
    resultEl.style.display = 'block';

    // Method 1: Google Ping (works without API key)
    try {
        const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(url)}`;
        const res = await fetch(pingUrl, { mode: 'no-cors' });
        resultEl.className = 'result-msg success';
        resultEl.textContent = `Ping berhasil dikirim untuk: ${url}. Google akan memproses dalam beberapa jam.`;
    } catch (e) {
        resultEl.className = 'result-msg info';
        resultEl.textContent = `Ping dikirim (no-cors). Untuk indexing instan, gunakan Google Search Console API. URL: ${url}`;
    }

    btn.disabled = false;
    btn.textContent = 'Request Indexing';
}

async function pingSitemap() {
    const resultEl = document.getElementById('pingResult');
    const btn = document.getElementById('btnPing');

    btn.disabled = true;
    btn.textContent = 'Memproses...';
    resultEl.className = 'result-msg info';
    resultEl.textContent = 'Mengirim ping...';
    resultEl.style.display = 'block';

    try {
        await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITE_CONFIG.siteUrl + '/sitemap.xml')}`, { mode: 'no-cors' });
        resultEl.className = 'result-msg success';
        resultEl.textContent = 'Sitemap berhasil di-ping ke Google! Crawler akan segera memproses.';
    } catch (e) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = 'Gagal mengirim ping.';
    }

    btn.disabled = false;
    btn.textContent = 'Ping Sitemap';
}

function generateSitemap() {
    const btn = document.getElementById('btnSitemap');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    // Static pages
    const staticPages = [
        { loc: SITE_CONFIG.siteUrl + '/', priority: '1.00' },
        { loc: SITE_CONFIG.siteUrl + '/blog/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/pemulihan-akun-sosmed/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/jasa-pembuatan-website/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/whatsapp-automation/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/optimasi-sosial-media/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/iklan-digital/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/desain-grafis/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/keamanan-akun/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/sistem-custom/', priority: '0.90' },
        { loc: SITE_CONFIG.siteUrl + '/produk/', priority: '0.80' }
    ];

    // Existing articles
    const existingArticlePages = EXISTING_ARTICLES.map(a => ({
        loc: SITE_CONFIG.siteUrl + '/blog/' + a.slug,
        priority: '0.80'
    }));

    // New articles from admin
    const newArticlePages = articles
        .filter(a => a.status === 'published' && a.slug)
        .filter(a => !EXISTING_ARTICLES.find(e => e.slug === a.slug))
        .map(a => ({
            loc: SITE_CONFIG.siteUrl + '/blog/' + a.slug,
            priority: '0.80'
        }));

    const allPages = [...staticPages, ...existingArticlePages, ...newArticlePages];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    allPages.forEach(page => {
        xml += `\n<url>\n<loc>${page.loc}</loc>\n<priority>${page.priority}</priority>\n</url>\n`;
    });
    xml += '</urlset>\n';

    document.getElementById('sitemapContent').value = xml;
    document.getElementById('sitemapEditor').classList.remove('hidden');

    btn.disabled = false;
    btn.textContent = 'Generate Sitemap';
    showToast('Sitemap berhasil di-generate!', 'success');
}

function copySitemap() {
    navigator.clipboard.writeText(document.getElementById('sitemapContent').value).then(() => {
        showToast('Sitemap XML berhasil di-copy!', 'success');
    });
}

function generateBlogIndex() {
    const btn = document.getElementById('btnBlogIndex');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    const published = articles.filter(a => a.status === 'published' && a.slug);

    if (published.length === 0) {
        showToast('Tidak ada artikel yang sudah dipublish.', 'error');
        btn.disabled = false;
    }

    let code = published.map((a, i) => {
        const existingMax = EXISTING_ARTICLES.length;
        const id = existingMax + i + 1;
        return `  {
    id: ${id},
    title: "${(a.title || '').replace(/"/g, '\\"')}",
    excerpt: "${(a.excerpt || '').replace(/"/g, '\\"').substring(0, 200)}",
    category: "${a.category || 'tutorial'}",
    url: "${SITE_CONFIG.siteUrl}/blog/${a.slug}",
    image: "${a.image || 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&q=80'}",
    author: "${SITE_CONFIG.author}",
    authorImg: "${SITE_CONFIG.authorImg}",
    date: "${a.date || formatDate(a.createdAt)}",
    readTime: "${a.readTime || '5 menit'}",
    featured: false
  }`;
    }).join(',\n');

    document.getElementById('blogIndexContent').value = code;
    document.getElementById('blogIndexEditor').classList.remove('hidden');

    btn.disabled = false;
    btn.textContent = 'Generate blogPosts Code';
    showToast('Kode blogPosts berhasil di-generate!', 'success');
}

function copyBlogIndex() {
    navigator.clipboard.writeText(document.getElementById('blogIndexContent').value).then(() => {
        showToast('Kode berhasil di-copy!', 'success');
    });
}

// === SEO CHECKER ===
function runSEOChecker() {
    const title = document.getElementById('articleTitle').value.trim();
    const metaTitle = document.getElementById('articleMetaTitle').value.trim();
    const metaDesc = document.getElementById('articleMetaDesc').value.trim();
    const keywords = document.getElementById('articleKeywords').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    const slug = document.getElementById('articleSlug').value.trim();
    const image = document.getElementById('articleImage').value.trim();

    const checks = [];
    let score = 0;
    const total = 10;

    // Check 1: Title exists
    if (title.length > 0) { score++; checks.push({ pass: true, text: 'Judul artikel diisi' }); }
    else checks.push({ pass: false, text: 'Judul artikel kosong' });

    // Check 2: Meta title length
    if (metaTitle.length >= 30 && metaTitle.length <= 60) { score++; checks.push({ pass: true, text: `Meta title panjang ideal (${metaTitle.length} karakter)` }); }
    else if (metaTitle.length > 0) { checks.push({ warn: true, text: `Meta title ${metaTitle.length > 60 ? 'terlalu panjang' : 'terlalu pendek'} (${metaTitle.length}/60)` }); }
    else checks.push({ pass: false, text: 'Meta title kosong' });

    // Check 3: Meta description
    if (metaDesc.length >= 120 && metaDesc.length <= 160) { score++; checks.push({ pass: true, text: `Meta description panjang ideal (${metaDesc.length} karakter)` }); }
    else if (metaDesc.length > 0) { checks.push({ warn: true, text: `Meta description ${metaDesc.length > 160 ? 'terlalu panjang' : 'terlalu pendek'} (${metaDesc.length}/160)` }); }
    else checks.push({ pass: false, text: 'Meta description kosong' });

    // Check 4: Keywords
    if (keywords.length > 0) { score++; checks.push({ pass: true, text: 'Keywords diisi' }); }
    else checks.push({ warn: true, text: 'Keywords kosong (disarankan 5-10 kata kunci)' });

    // Check 5: Content length
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 300) { score++; checks.push({ pass: true, text: `Konten cukup panjang (${wordCount} kata)` }); }
    else if (wordCount > 0) { checks.push({ warn: true, text: `Konten terlalu pendek (${wordCount} kata, min 300)` }); }
    else checks.push({ pass: false, text: 'Konten kosong' });

    // Check 6: Has headings
    if (content.includes('<h2>') || content.includes('<h3>')) { score++; checks.push({ pass: true, text: 'Mengandung heading (H2/H3)' }); }
    else checks.push({ warn: true, text: 'Tidak ada heading H2/H3 dalam konten' });

    // Check 7: Has image
    if (image.length > 0) { score++; checks.push({ pass: true, text: 'Thumbnail image diisi' }); }
    else checks.push({ warn: true, text: 'Tidak ada thumbnail image' });

    // Check 8: Slug format
    if (slug && slug.match(/^[a-z0-9-]+$/) && slug.length > 3) { score++; checks.push({ pass: true, text: 'URL slug format benar' }); }
    else if (slug) { checks.push({ warn: true, text: 'URL slug format kurang tepat (gunakan huruf kecil, angka, dan -)' }); }
    else checks.push({ pass: false, text: 'URL slug kosong' });

    // Check 9: Has internal/external links
    if (content.includes('<a ') || content.includes('href=')) { score++; checks.push({ pass: true, text: 'Mengandung link' }); }
    else checks.push({ warn: true, text: 'Tidak ada link dalam konten' });

    // Check 10: Has list
    if (content.includes('<ul>') || content.includes('<ol>')) { score++; checks.push({ pass: true, text: 'Mengandung daftar (list)' }); }
    else checks.push({ warn: true, text: 'Tidak ada daftar (list) dalam konten' });

    const percentage = Math.round((score / total) * 100);
    const scoreClass = percentage >= 70 ? 'good' : percentage >= 40 ? 'ok' : 'bad';

    let html = `<div class="seo-score ${scoreClass}">${percentage}/100</div>`;
    checks.forEach(c => {
        const cls = c.pass ? 'seo-pass' : c.warn ? 'seo-warn' : 'seo-fail';
        const icon = c.pass ? '<i class="ri-checkbox-circle-fill"></i>' : c.warn ? '<i class="ri-error-warning-fill"></i>' : '<i class="ri-close-circle-fill"></i>';
        html += `<div class="seo-report-item ${cls}">${icon} ${c.text}</div>`;
    });

    document.getElementById('seoReport').innerHTML = html;
}

function updateSEOStatus() {
    const list = document.getElementById('seoStatusList');
    if (!list) return;

    const allSlugs = [
        ...EXISTING_ARTICLES.map(a => a.slug),
        ...articles.filter(a => a.status === 'published' && a.slug).map(a => a.slug)
    ];

    const uniqueSlugs = [...new Set(allSlugs)];

    list.innerHTML = uniqueSlugs.slice(0, 10).map(a => {
        const shortTitle = (EXISTING_ARTICLES.find(e => e.slug === a)?.title || articles.find(ar => ar.slug === a)?.title || a).substring(0, 35);
        return `<div class="seo-item">
            <span style="flex:1;margin-right:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(shortTitle)}</span>
            <span class="status-badge status-indexed"><i class="ri-check-line"></i> Live</span>
        </div>`;
    }).join('');
}

// === DASHBOARD ===
function updateDashboard() {
    const total = articles.length;
    const published = articles.filter(a => a.status === 'published').length;
    const draft = articles.filter(a => a.status === 'draft').length;
    const indexed = EXISTING_ARTICLES.length + published;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPublished').textContent = published;
    document.getElementById('statDraft').textContent = draft;
    document.getElementById('statIndexed').textContent = indexed;

    // Recent articles
    const recentEl = document.getElementById('recentArticles');
    if (articles.length === 0) {
        recentEl.innerHTML = '<p style="color:#9aa0a6;font-size:14px;">Belum ada artikel di admin.</p>';
    } else {
        recentEl.innerHTML = articles.slice(0, 5).map(a => `
            <div class="recent-item">
                <span class="recent-item-title">${escHtml(a.title)}</span>
                <span class="recent-item-date">${a.date || formatDate(a.createdAt)}</span>
            </div>
        `).join('');
    }

    // SEO status
    updateSEOStatus();
}

// === SETTINGS ===
function saveGitHubSettings() {
    const token = document.getElementById('githubToken').value.trim();
    const owner = document.getElementById('githubOwner').value.trim();
    const repo = document.getElementById('githubRepo').value.trim();
    const branch = document.getElementById('githubBranch').value.trim();

    localStorage.setItem('km_github_token', token);
    localStorage.setItem('km_github_owner', owner);
    localStorage.setItem('km_github_repo', repo);
    localStorage.setItem('km_github_branch', branch);

    showToast('Pengaturan GitHub berhasil disimpan!', 'success');
}

function loadSettings() {
    document.getElementById('githubToken').value = localStorage.getItem('km_github_token') || '';
    document.getElementById('githubOwner').value = localStorage.getItem('km_github_owner') || 'ddkurnia';
    document.getElementById('githubRepo').value = localStorage.getItem('km_github_repo') || 'kedai-media';
    document.getElementById('githubBranch').value = localStorage.getItem('km_github_branch') || 'main';
}

async function testGitHubConnection() {
    const resultEl = document.getElementById('githubTestResult');
    resultEl.className = 'result-msg info';
    resultEl.textContent = 'Menguji koneksi...';
    resultEl.style.display = 'block';

    // Save first
    saveGitHubSettings();

    const config = getGitHubConfig();
    if (!config.token) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = 'Token belum diisi.';
        return;
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
            headers: { 'Authorization': `Bearer ${config.token}` }
        });
        const data = await res.json();
        if (res.ok) {
            resultEl.className = 'result-msg success';
            resultEl.textContent = `Koneksi berhasil! Repo: ${data.full_name} (Private: ${data.private})`;
        } else {
            resultEl.className = 'result-msg error';
            resultEl.textContent = `Gagal: ${data.message}`;
        }
    } catch (e) {
        resultEl.className = 'result-msg error';
        resultEl.textContent = 'Error: ' + e.message;
    }
}

// === EXPORT / IMPORT ===
function exportData() {
    const data = {
        articles: articles,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kedaimedia-articles-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data berhasil di-export!', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.articles && Array.isArray(data.articles)) {
                articles = data.articles;
                localStorage.setItem('km_articles', JSON.stringify(articles));

                // Sync to Firestore
                if (db) {
                    const batch = db.batch();
                    articles.forEach(a => {
                        const ref = db.collection('articles').doc(a.id);
                        const d = { ...a };
                        delete d.id;
                        batch.set(ref, d, { merge: true });
                    });
                    batch.commit().catch(e => console.warn('Import to Firestore error:', e));
                }

                showToast(`${articles.length} artikel berhasil di-import!`, 'success');
                loadArticles();
            } else {
                showToast('Format file tidak valid.', 'error');
            }
        } catch (err) {
            showToast('Gagal membaca file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// === UTILITIES ===
function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
}

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type || 'info'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

// === EVENT LISTENERS ===
try {
    document.getElementById('articleSlug').addEventListener('input', updateSlugPreview);
    document.getElementById('articleImage').addEventListener('input', showImagePreview);
} catch(e) {}
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    // Double-check handleLogin exists
    if (typeof handleLogin === 'function') {
        handleLogin(e);
    } else {
        alert('Error: admin.js belum selesai loading. Refresh halaman (Ctrl+Shift+R).');
    }
});

// === FIREBASE READY FLAG ===
let firebaseReady = false;
let firebaseLoading = true;

// === INIT ===
function initApp() {
    // Init drag & drop
    try { initDragDrop(); } catch(e) {}

    // Load Firebase SDK dengan timeout & error handling
    const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.0/';
    const scripts = [
        'firebase-app-compat.js',
        'firebase-auth-compat.js',
        'firebase-firestore-compat.js'
    ];

    // Timeout 6 detik - fallback ke localStorage
    const fallbackTimer = setTimeout(() => {
        if (!firebaseReady) {
            console.warn('Firebase SDK timeout. Using localStorage fallback.');
            firebaseLoading = false;
            checkAuth();
        }
    }, 6000);

    function loadScripts(index) {
        if (index >= scripts.length) {
            // Semua SDK loaded
            clearTimeout(fallbackTimer);
            firebaseReady = true;
            firebaseLoading = false;
            try {
                initFirebase();
            } catch(e) {
                console.warn('initFirebase error:', e);
            }
            checkAuth();
            return;
        }

        const s = document.createElement('script');
        s.src = SDK_BASE + scripts[index];
        s.onload = () => loadScripts(index + 1);
        s.onerror = () => {
            console.warn(`Failed to load ${scripts[index]}. Using localStorage fallback.`);
            clearTimeout(fallbackTimer);
            firebaseLoading = false;
            checkAuth();
        };
        document.head.appendChild(s);
    }

    loadScripts(0);
}

// Jalankan init - gunakan DOMContentLoaded jika tersedia, langsung jalankan jika sudah
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
