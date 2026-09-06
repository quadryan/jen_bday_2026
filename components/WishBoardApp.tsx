"use client";

import { Camera, Check, Eye, EyeOff, Image as ImageIcon, Pencil, Send } from "lucide-react";
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { prepareImageForUpload, readImageAspectRatio } from "@/lib/client-image";
import { DEFAULT_PHOTO_ASPECT_RATIO, normalizePhotoAspectRatio } from "@/lib/types";
import type { FrameFit, PublicWish, WishListResponse } from "@/lib/types";

type WishBoardAppProps = {
  mode: "submit" | "reveal";
};

type FormState = {
  name: string;
  message: string;
  memory: string;
  song: string;
  frameFit: FrameFit;
  photoAspectRatio: number;
  image: File | null;
};

type StoredSubmission = {
  wish: PublicWish;
  editToken: string;
};

const emptyForm: FormState = {
  name: "",
  message: "",
  memory: "",
  song: "",
  frameFit: "contain",
  photoAspectRatio: DEFAULT_PHOTO_ASPECT_RATIO,
  image: null
};

const SESSION_KEY = "jen-birthday-own-submission";

type PlaceholderPhoto = {
  id: string;
  src: string;
  rotation: number;
  caption: string;
  aspectRatio: number;
};

const placeholderPhotos: PlaceholderPhoto[] = [
  { id: "jen-childhood", src: "/placeholders/jen-01.jpg", rotation: -5, caption: "Childhood Jen", aspectRatio: 0.774 },
  { id: "jen-chinatown", src: "/placeholders/jen-02.jpg", rotation: 3, caption: "Little adventure", aspectRatio: 1.333 },
  { id: "jen-paris", src: "/placeholders/jen-03.jpg", rotation: -2, caption: "Birthday flowers", aspectRatio: 0.563 },
  { id: "jen-village", src: "/placeholders/jen-04.jpg", rotation: 4, caption: "Postcard day", aspectRatio: 0.563 },
  { id: "jen-sunny", src: "/placeholders/jen-05.jpg", rotation: -4, caption: "Sunny side", aspectRatio: 0.563 },
  { id: "jen-boat", src: "/placeholders/jen-06.jpg", rotation: 2, caption: "On the water", aspectRatio: 1.777 },
  { id: "jen-night", src: "/placeholders/jen-07.jpg", rotation: -3, caption: "After dark", aspectRatio: 1.333 },
  { id: "jen-snow", src: "/placeholders/jen-08.jpg", rotation: 5, caption: "Snow day", aspectRatio: 1.143 }
];

export function WishBoardApp({ mode }: WishBoardAppProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState("");
  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [ownSubmission, setOwnSubmission] = useState<StoredSubmission | null>(null);
  const [reveal, setReveal] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [editingOwn, setEditingOwn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/wishes", { cache: "no-store" });
        const data = (await response.json()) as WishListResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Could not load the wall.");
        }

        setWishes(data.wishes);
        setReveal(data.reveal);
        setDemoMode(data.demoMode);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load the wall.");
      } finally {
        setLoading(false);
      }
    }

    load();

    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        setOwnSubmission(JSON.parse(stored) as StoredSubmission);
      } catch {
        window.sessionStorage.removeItem(SESSION_KEY);
      }
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

  const wallWishes = useMemo(() => {
    const merged = [...wishes];

    if (ownSubmission) {
      const index = merged.findIndex((wish) => wish.id === ownSubmission.wish.id);

      if (index >= 0) {
        merged[index] = ownSubmission.wish;
      } else {
        merged.unshift(ownSubmission.wish);
      }
    }

    return merged;
  }, [ownSubmission, wishes]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
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

  function startEdit() {
    if (!ownSubmission) {
      return;
    }

    setForm({
      name: ownSubmission.wish.name || "",
      message: ownSubmission.wish.message || "",
      memory: ownSubmission.wish.memory || "",
      song: ownSubmission.wish.song || "",
      frameFit: ownSubmission.wish.frameFit,
      photoAspectRatio: normalizePhotoAspectRatio(ownSubmission.wish.photoAspectRatio),
      image: null
    });
    setEditingOwn(true);
    setNotice("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const preparedImage = form.image ? await prepareImageForUpload(form.image) : null;
      const body = new FormData();
      body.set("name", form.name);
      body.set("message", form.message);
      body.set("memory", form.memory);
      body.set("song", form.song);
      body.set("frameFit", form.frameFit);
      body.set("photoAspectRatio", String(preparedImage?.aspectRatio ?? form.photoAspectRatio));

      if (preparedImage) {
        body.set("image", preparedImage.file);
      }

      if (editingOwn && ownSubmission) {
        body.set("editToken", ownSubmission.editToken);
      }

      const endpoint = editingOwn && ownSubmission ? `/api/wishes/${ownSubmission.wish.id}` : "/api/wishes";
      const response = await fetch(endpoint, {
        method: editingOwn ? "PATCH" : "POST",
        body
      });
      const data = (await response.json()) as { wish?: PublicWish; editToken?: string; error?: string };

      if (!response.ok || !data.wish) {
        throw new Error(data.error || "Could not save the wish.");
      }

      const stored = {
        wish: data.wish,
        editToken: data.editToken || ownSubmission?.editToken || ""
      };

      setOwnSubmission(stored);
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
      setWishes((current) => {
        const exists = current.some((wish) => wish.id === data.wish?.id);
        return exists ? current.map((wish) => (wish.id === data.wish?.id ? data.wish : wish)) : [data.wish!, ...current];
      });
      setNotice(editingOwn ? "Updated. It is back on the wall." : "Added. You can still edit it while this tab stays open.");
      setEditingOwn(false);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the wish.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`site-shell ${mode === "reveal" ? "reveal-mode" : ""}`}>
      <header className="topbar">
        <a className="brand-mark" href="/">
          <span className="brand-pin" />
          <span>Jennifer Lee · 이채은</span>
        </a>
        <nav className="nav-actions" aria-label="Site links">
          <a href="/reveal">
            <Eye size={17} aria-hidden="true" />
            <span>Final Wall</span>
          </a>
        </nav>
      </header>

      <section className="hero-band">
        <div className="hero-copy">
          <h1>Jen&apos;s 23rd Birthday Wish Compilation</h1>
          <p className="korean-name">이채은</p>
          <p className="lede">Leave a little birthday note for Jennifer.</p>
        </div>
        <div className="status-strip" aria-live="polite">
          <span className={`status-pill ${reveal ? "live" : ""}`}>
            {reveal ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
            {reveal ? "Reveal is live" : "Blurred until reveal"}
          </span>
          {demoMode ? <span className="status-pill quiet">Demo mode</span> : null}
        </div>
      </section>

      <section className="workspace-grid">
        {mode === "submit" ? (
          <aside className="submission-panel" aria-label="Birthday wish form">
            {ownSubmission && !editingOwn ? (
              <div className="submitted-state">
                <div className="submitted-icon">
                  <Check size={22} aria-hidden="true" />
                </div>
                <h2>Your wish is pinned.</h2>
                <p>It stays editable in this browser tab. After you leave, ask the admin for changes.</p>
                <button className="primary-button" type="button" onClick={startEdit}>
                  <Pencil size={17} aria-hidden="true" />
                  Edit my wish
                </button>
              </div>
            ) : (
              <form className="wish-form" onSubmit={handleSubmit}>
                <div className="form-heading">
                  <h2>{editingOwn ? "Edit your wish" : "Pin a polaroid"}</h2>
                  <span>{editingOwn ? "Still in this tab" : "For Jen"}</span>
                </div>

                <label>
                  <span>Your name</span>
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
                    <Camera size={21} aria-hidden="true" />
                    <span>{form.image ? form.image.name : editingOwn ? "Replace photo" : "Add photo"}</span>
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
                  {editingOwn ? (
                    <button className="ghost-button" type="button" onClick={() => setEditingOwn(false)}>
                      Cancel
                    </button>
                  ) : null}
                  <button className="primary-button" type="submit" disabled={saving}>
                    <Send size={17} aria-hidden="true" />
                    {saving ? "Pinning..." : editingOwn ? "Save wish" : "Pin wish"}
                  </button>
                </div>
              </form>
            )}
          </aside>
        ) : null}

        <section className="wall-panel" aria-label="Polaroid wish wall">
          <div className="wall-heading">
            <div>
              <p className="eyebrow">{mode === "reveal" ? "Final wall" : "Birthday wall"}</p>
              <h2>{reveal ? "All wishes are open" : "The wall is waiting"}</h2>
            </div>
            <span className="wish-count">{loading ? "..." : wallWishes.length} pinned</span>
          </div>

          {error && !wallWishes.length ? <p className="wall-error">{error}</p> : null}

          <div className="polaroid-wall">
            {wallWishes.length === 0
              ? placeholderPhotos.map((photo) => <PlaceholderCard key={photo.id} photo={photo} />)
              : null}
            {wallWishes.map((wish, index) => (
              <WishCard key={wish.id} wish={wish} index={index} isOwn={ownSubmission?.wish.id === wish.id} />
            ))}
            {!loading && wallWishes.length === 0 ? (
              <div className="empty-wall polaroid-card">
                <ImageIcon size={28} aria-hidden="true" />
                <span>0 wishes pinned so far.</span>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function WishCard({ wish, index, isOwn }: { wish: PublicWish; index: number; isOwn: boolean }) {
  const rotation = isOwn ? 0 : wish.rotation || [-4, 3, -2, 5][index % 4];
  const hidden = wish.hidden && !isOwn;
  const aspectRatio = normalizePhotoAspectRatio(wish.photoAspectRatio);

  return (
    <article className={`polaroid-card ${polaroidSizeClass(aspectRatio)} ${hidden ? "is-hidden" : ""} ${isOwn ? "is-own" : ""}`} style={polaroidStyle(rotation, aspectRatio)}>
      <span className="tape tape-left" />
      <span className="tape tape-right" />
      <div className={`photo-frame ${wish.frameFit === "contain" ? "contain" : ""}`}>
        {wish.imageUrl ? (
          <img src={wish.imageUrl} alt="" />
        ) : (
          <div className="photo-placeholder">
            <span>{initials(wish.name)}</span>
          </div>
        )}
      </div>
      <div className="polaroid-caption">
        <p className="caption-name">{hidden ? "Hidden wish" : wish.name}</p>
        <div className="blur-copy">
          <p className="caption-message">{hidden ? "Happy birthday Jen, wishing you the warmest year ahead." : wish.message}</p>
          {hidden ? <p className="caption-extra">Memory: a little note waiting for reveal.</p> : null}
          {!hidden && wish.memory ? <p className="caption-extra">Memory: {wish.memory}</p> : null}
          {!hidden && wish.song ? <p className="caption-extra">Song: {wish.song}</p> : null}
        </div>
      </div>
    </article>
  );
}

function PlaceholderCard({ photo }: { photo: PlaceholderPhoto }) {
  const [missing, setMissing] = useState(false);
  const aspectRatio = normalizePhotoAspectRatio(photo.aspectRatio);

  return (
    <article className={`polaroid-card placeholder-card ${polaroidSizeClass(aspectRatio)} ${missing ? "missing-image" : ""}`} style={polaroidStyle(photo.rotation, aspectRatio)}>
      <span className="tape tape-left" />
      <span className="tape tape-right" />
      <div className="photo-frame contain">
        {missing ? (
          <div className="photo-placeholder">
            <span>JL</span>
          </div>
        ) : (
          <img src={photo.src} alt="" onError={() => setMissing(true)} />
        )}
      </div>
      <div className="polaroid-caption">
        <p className="caption-name">{photo.caption}</p>
        <div className="placeholder-lines" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}

function polaroidStyle(rotation: number, aspectRatio: number): CSSProperties {
  return {
    "--rotation": `${rotation}deg`,
    "--photo-ratio": String(normalizePhotoAspectRatio(aspectRatio))
  } as CSSProperties;
}

function photoStyle(aspectRatio: number): CSSProperties {
  return {
    "--photo-ratio": String(normalizePhotoAspectRatio(aspectRatio))
  } as CSSProperties;
}

function polaroidSizeClass(aspectRatio: number) {
  if (aspectRatio >= 1.35) {
    return "is-landscape";
  }

  if (aspectRatio <= 0.86) {
    return "is-portrait";
  }

  return "is-standard";
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
