"use client";

import { Check, Eye, EyeOff, LockKeyhole, Pencil, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { prepareImageForUpload, readImageAspectRatio } from "@/lib/client-image";
import { DEFAULT_PHOTO_ASPECT_RATIO, normalizePhotoAspectRatio } from "@/lib/types";
import type { FrameFit, PublicWish, WishListResponse } from "@/lib/types";

type AdminForm = {
  id?: string;
  name: string;
  message: string;
  memory: string;
  song: string;
  frameFit: FrameFit;
  photoAspectRatio: number;
  image: File | null;
};

const emptyAdminForm: AdminForm = {
  name: "",
  message: "",
  memory: "",
  song: "",
  frameFit: "contain",
  photoAspectRatio: DEFAULT_PHOTO_ASPECT_RATIO,
  image: null
};

export function AdminPanel() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [reveal, setReveal] = useState(false);
  const [form, setForm] = useState<AdminForm>(emptyAdminForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const sortedWishes = useMemo(() => [...wishes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [wishes]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("jen-admin-passcode");

    if (stored) {
      setPasscode(stored);
      loadAdmin(stored);
    }
  }, []);

  useEffect(() => {
    if (!form.image) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(form.image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  async function loadAdmin(code = passcode) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/wishes?admin=1", {
        cache: "no-store",
        headers: {
          "x-admin-passcode": code
        }
      });
      const data = (await response.json()) as WishListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not unlock admin.");
      }

      setWishes(data.wishes);
      setReveal(data.reveal);
      setUnlocked(true);
      window.sessionStorage.setItem("jen-admin-passcode", code);
    } catch (loadError) {
      setUnlocked(false);
      setError(loadError instanceof Error ? loadError.message : "Could not unlock admin.");
    } finally {
      setBusy(false);
    }
  }

  function updateField<K extends keyof AdminForm>(key: K, value: AdminForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setNotice("");
    setError("");

    if (!file) {
      setForm((current) => ({ ...current, image: null, photoAspectRatio: DEFAULT_PHOTO_ASPECT_RATIO }));
      return;
    }

    setForm((current) => ({ ...current, image: file, photoAspectRatio: DEFAULT_PHOTO_ASPECT_RATIO }));

    try {
      const aspectRatio = await readImageAspectRatio(file);
      setForm((current) => (current.image === file ? { ...current, photoAspectRatio: aspectRatio } : current));
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Could not read this image.");
    }
  }

  function editWish(wish: PublicWish) {
    setForm({
      id: wish.id,
      name: wish.name || "",
      message: wish.message || "",
      memory: wish.memory || "",
      song: wish.song || "",
      frameFit: wish.frameFit,
      photoAspectRatio: normalizePhotoAspectRatio(wish.photoAspectRatio),
      image: null
    });
    setNotice("");
    setError("");
  }

  async function saveWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const body = new FormData();
      body.set("name", form.name);
      body.set("message", form.message);
      body.set("memory", form.memory);
      body.set("song", form.song);
      body.set("frameFit", form.frameFit);

      if (form.image) {
        const preparedImage = await prepareImageForUpload(form.image);
        body.set("photoAspectRatio", String(preparedImage.aspectRatio));
        body.set("image", preparedImage.file);
      } else {
        body.set("photoAspectRatio", String(form.photoAspectRatio));
      }

      const response = await fetch(form.id ? `/api/wishes/${form.id}` : "/api/wishes", {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "x-admin-passcode": passcode
        },
        body
      });
      const data = (await response.json()) as { wish?: PublicWish; error?: string };

      if (!response.ok || !data.wish) {
        throw new Error(data.error || "Could not save wish.");
      }

      setWishes((current) => {
        const exists = current.some((wish) => wish.id === data.wish?.id);
        return exists ? current.map((wish) => (wish.id === data.wish?.id ? data.wish : wish)) : [data.wish!, ...current];
      });
      setForm(emptyAdminForm);
      setNotice(form.id ? "Wish updated." : "Wish added.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save wish.");
    } finally {
      setBusy(false);
    }
  }

  async function removeWish(id: string) {
    const confirmed = window.confirm("Delete this wish?");

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/wishes/${id}`, {
        method: "DELETE",
        headers: {
          "x-admin-passcode": passcode
        }
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not delete wish.");
      }

      setWishes((current) => current.filter((wish) => wish.id !== id));
      setNotice("Wish deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete wish.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReveal() {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/reveal", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-admin-passcode": passcode
        },
        body: JSON.stringify({ reveal: !reveal })
      });
      const data = (await response.json()) as { reveal?: boolean; error?: string };

      if (!response.ok || typeof data.reveal !== "boolean") {
        throw new Error(data.error || "Could not update reveal.");
      }

      setReveal(data.reveal);
      setNotice(data.reveal ? "Reveal switched on." : "Reveal switched off.");
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "Could not update reveal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand-mark" href="/">
          <span className="brand-pin" />
          <span>Jennifer Lee · 이채은</span>
        </a>
        <nav className="nav-actions" aria-label="Site links">
          <a href="/">
            <Plus size={17} aria-hidden="true" />
            <span>Submit</span>
          </a>
        </nav>
      </header>

      <section className="admin-hero">
        <div>
          <p className="eyebrow">Owner view</p>
          <h1>Admin for Jen&apos;s birthday wall</h1>
          <p className="korean-name">이채은</p>
        </div>
        {unlocked ? (
          <div className="admin-actions">
            <button className={`primary-button ${reveal ? "is-live" : ""}`} type="button" onClick={toggleReveal} disabled={busy}>
              {reveal ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
              {reveal ? "Reveal live" : "Reveal off"}
            </button>
            <button className="ghost-button" type="button" onClick={() => loadAdmin()} disabled={busy}>
              <RefreshCw size={17} aria-hidden="true" />
              Refresh
            </button>
          </div>
        ) : null}
      </section>

      {!unlocked ? (
        <section className="unlock-panel">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadAdmin();
            }}
          >
            <LockKeyhole size={22} aria-hidden="true" />
            <label>
              <span>Admin passcode</span>
              <input value={passcode} onChange={(event) => setPasscode(event.target.value)} type="password" autoComplete="current-password" />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              <Check size={17} aria-hidden="true" />
              Unlock
            </button>
          </form>
          {error ? <p className="form-error">{error}</p> : null}
        </section>
      ) : (
        <section className="admin-grid">
          <form className="admin-editor" onSubmit={saveWish}>
            <div className="form-heading">
              <h2>{form.id ? "Edit wish" : "Add wish"}</h2>
              <span>{reveal ? "Public" : "Hidden"}</span>
            </div>

            <label>
              <span>Name</span>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} maxLength={80} required />
            </label>
            <label>
              <span>Birthday wish</span>
              <textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} maxLength={700} rows={5} required />
            </label>
            <label>
              <span>Favorite memory</span>
              <textarea value={form.memory} onChange={(event) => updateField("memory", event.target.value)} maxLength={420} rows={3} />
            </label>
            <label>
              <span>Song that reminds me of you</span>
              <input value={form.song} onChange={(event) => updateField("song", event.target.value)} maxLength={120} />
            </label>

            <div className="upload-row">
              <label className="upload-drop">
                <input type="file" accept="image/*" onChange={handleImage} />
                <Upload size={20} aria-hidden="true" />
                <span>{form.image ? form.image.name : "Photo"}</span>
              </label>
              <div className="segmented" aria-label="Photo crop style">
                <button type="button" className={form.frameFit === "cover" ? "active" : ""} onClick={() => updateField("frameFit", "cover")}>
                  Crop
                </button>
                <button type="button" className={form.frameFit === "contain" ? "active" : ""} onClick={() => updateField("frameFit", "contain")}>
                  Fit
                </button>
              </div>
            </div>

            {previewUrl ? (
              <div className="image-preview" style={photoStyle(form.photoAspectRatio)}>
                <img src={previewUrl} alt="" className={form.frameFit === "contain" ? "fit-contain" : ""} />
              </div>
            ) : null}

            {error ? <p className="form-error">{error}</p> : null}
            {notice ? <p className="form-notice">{notice}</p> : null}

            <div className="form-actions">
              {form.id ? (
                <button className="ghost-button" type="button" onClick={() => setForm(emptyAdminForm)}>
                  Cancel
                </button>
              ) : null}
              <button className="primary-button" type="submit" disabled={busy}>
                <Save size={17} aria-hidden="true" />
                {form.id ? "Save edit" : "Add wish"}
              </button>
            </div>
          </form>

          <section className="admin-list" aria-label="Submitted wishes">
            <div className="wall-heading">
              <div>
                <p className="eyebrow">Submissions</p>
                <h2>{sortedWishes.length} wishes pinned</h2>
              </div>
            </div>

            <div className="wish-table">
              {sortedWishes.map((wish) => (
                <article className="wish-row" key={wish.id}>
                  <div className="row-image">
                    {wish.imageUrl ? <img src={wish.imageUrl} alt="" /> : <span>{initials(wish.name)}</span>}
                  </div>
                  <div className="row-copy">
                    <h3>{wish.name}</h3>
                    <p>{wish.message}</p>
                    {wish.memory ? <span>Memory: {wish.memory}</span> : null}
                    {wish.song ? <span>Song: {wish.song}</span> : null}
                  </div>
                  <div className="row-actions">
                    <button className="icon-button" type="button" onClick={() => editWish(wish)} aria-label={`Edit ${wish.name || "wish"}`}>
                      <Pencil size={17} aria-hidden="true" />
                    </button>
                    <button className="icon-button danger" type="button" onClick={() => removeWish(wish.id)} aria-label={`Delete ${wish.name || "wish"}`}>
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

function initials(name?: string) {
  if (!name) {
    return "JL";
  }

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function photoStyle(aspectRatio: number): CSSProperties {
  return {
    "--photo-ratio": String(normalizePhotoAspectRatio(aspectRatio))
  } as CSSProperties;
}
