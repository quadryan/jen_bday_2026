"use client";

import { ArrowLeft, Camera, Check, Eye, EyeOff, Image as ImageIcon, Plus, Send, X } from "lucide-react";
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
  const [ownSubmissions, setOwnSubmissions] = useState<StoredSubmission[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reveal, setReveal] = useState(false);
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
        setOwnSubmissions(parseStoredSubmissions(stored));
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
    const ownById = new Map(ownSubmissions.map((submission) => [submission.wish.id, submission.wish]));
    const merged = wishes.map((wish) => ownById.get(wish.id) ?? wish);
    const mergedIds = new Set(merged.map((wish) => wish.id));
    const missingOwnWishes = ownSubmissions.filter((submission) => !mergedIds.has(submission.wish.id)).map((submission) => submission.wish);

    return [...missingOwnWishes, ...merged];
  }, [ownSubmissions, wishes]);

  function saveOwnSubmissions(nextSubmissions: StoredSubmission[]) {
    setOwnSubmissions(nextSubmissions);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSubmissions));
  }

  function openComposer() {
    setComposerOpen(true);
    setReviewing(false);
    setForm(emptyForm);
    setNotice("");
    setError("");
  }

  function closeComposer() {
    if (saving) {
      return;
    }

    setComposerOpen(false);
    setReviewing(false);
    setForm(emptyForm);
    setNotice("");
    setError("");
  }

  function startAnotherSubmission() {
    openComposer();
  }

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

  function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewing(true);
    setError("");
    setNotice("");
  }

  async function confirmSubmit() {
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

      const response = await fetch("/api/wishes", {
        method: "POST",
        body
      });
      const data = (await response.json()) as { wish?: PublicWish; editToken?: string; error?: string };

      if (!response.ok || !data.wish) {
        throw new Error(data.error || "Could not save the wish.");
      }

      const stored = {
        wish: data.wish
      };
      const nextOwnSubmissions = [stored, ...ownSubmissions.filter((submission) => submission.wish.id !== data.wish?.id)];

      saveOwnSubmissions(nextOwnSubmissions);
      setWishes((current) => {
        const exists = current.some((wish) => wish.id === data.wish?.id);
        return exists ? current.map((wish) => (wish.id === data.wish?.id ? data.wish : wish)) : [data.wish!, ...current];
      });
      setNotice("Pinned. Need a change later? Text Ryan.");
      setComposerOpen(false);
      setReviewing(false);
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
        </div>
      </section>

      <section className={`workspace-grid ${mode === "submit" ? "canvas-layout" : ""}`}>
        {mode === "submit" && ownSubmissions.length > 0 ? (
          <section className="submit-banner" aria-live="polite">
            <div>
              <h2>{ownSubmissions.length === 1 ? "Your wish is pinned." : "Your wishes are pinned."}</h2>
              <p>{notice || "Need a change later? Text Ryan."}</p>
            </div>
            <button className="primary-button" type="button" onClick={startAnotherSubmission}>
              <Plus size={17} aria-hidden="true" />
              Submit another
            </button>
          </section>
        ) : null}

        <section className="wall-panel" aria-label="Polaroid wish wall">
          <div className="wall-heading">
            <div>
              <p className="eyebrow">{mode === "reveal" ? "Final wall" : "Birthday wall"}</p>
              <h2>{reveal ? "All wishes are open" : "The wall is waiting"}</h2>
            </div>
            <div className="wall-actions">
              <span className="wish-count">{loading ? "..." : wallWishes.length} pinned</span>
              {mode === "submit" ? (
                <button className="primary-button wall-add-button" type="button" onClick={openComposer}>
                  <Plus size={17} aria-hidden="true" />
                  Add wish
                </button>
              ) : null}
            </div>
          </div>

          {error && !wallWishes.length ? <p className="wall-error">{error}</p> : null}

          <div className="polaroid-wall">
            {wallWishes.length === 0
              ? placeholderPhotos.map((photo) => <PlaceholderCard key={photo.id} photo={photo} />)
              : null}
            {wallWishes.map((wish, index) => (
              <WishCard key={wish.id} wish={wish} index={index} isOwn={ownSubmissions.some((submission) => submission.wish.id === wish.id)} />
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

      {mode === "submit" && composerOpen ? (
        <div className="composer-overlay">
          <section className="composer-dialog" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <button className="icon-button composer-close" type="button" onClick={closeComposer} aria-label="Close wish form" disabled={saving}>
              <X size={18} aria-hidden="true" />
            </button>

            {reviewing ? (
              <ReviewSubmission form={form} previewUrl={previewUrl} saving={saving} error={error} onEdit={() => setReviewing(false)} onConfirm={confirmSubmit} />
            ) : (
              <SubmissionForm form={form} previewUrl={previewUrl} saving={saving} error={error} notice={notice} onFieldChange={updateField} onImageChange={handleImage} onSubmit={handleReview} />
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

type SubmissionFormProps = {
  form: FormState;
  previewUrl: string;
  saving: boolean;
  error: string;
  notice: string;
  onFieldChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function SubmissionForm({ form, previewUrl, saving, error, notice, onFieldChange, onImageChange, onSubmit }: SubmissionFormProps) {
  return (
    <form className="wish-form composer-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <h2 id="composer-title">Pin a polaroid</h2>
        <span>For Jen</span>
      </div>

      <label>
        <span>Your name</span>
        <input value={form.name} onChange={(event) => onFieldChange("name", event.target.value)} maxLength={80} required />
      </label>

      <label>
        <span>Birthday wish</span>
        <textarea value={form.message} onChange={(event) => onFieldChange("message", event.target.value)} maxLength={700} rows={5} required />
      </label>

      <label>
        <span>Favorite memory</span>
        <textarea value={form.memory} onChange={(event) => onFieldChange("memory", event.target.value)} maxLength={420} rows={3} />
      </label>

      <label>
        <span>Song that reminds me of you</span>
        <input value={form.song} onChange={(event) => onFieldChange("song", event.target.value)} maxLength={120} />
      </label>

      <div className="upload-row">
        <label className="upload-drop">
          <input type="file" accept="image/*" onChange={onImageChange} />
          <Camera size={21} aria-hidden="true" />
          <span>{form.image ? form.image.name : "Add photo"}</span>
        </label>
        <div className="segmented" aria-label="Photo crop style">
          <button type="button" className={form.frameFit === "cover" ? "active" : ""} onClick={() => onFieldChange("frameFit", "cover")}>
            Crop
          </button>
          <button type="button" className={form.frameFit === "contain" ? "active" : ""} onClick={() => onFieldChange("frameFit", "contain")}>
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
        <button className="primary-button" type="submit" disabled={saving}>
          <Send size={17} aria-hidden="true" />
          Review wish
        </button>
      </div>
    </form>
  );
}

type ReviewSubmissionProps = {
  form: FormState;
  previewUrl: string;
  saving: boolean;
  error: string;
  onEdit: () => void;
  onConfirm: () => void;
};

function ReviewSubmission({ form, previewUrl, saving, error, onEdit, onConfirm }: ReviewSubmissionProps) {
  return (
    <div className="review-panel">
      <div className="form-heading">
        <h2 id="composer-title">Confirm your wish</h2>
        <span>Last look</span>
      </div>

      <p className="review-copy">Once this is pinned, Ryan can edit it for you later.</p>

      <article className={`polaroid-card review-polaroid ${polaroidSizeClass(form.photoAspectRatio)}`} style={polaroidStyle(0, form.photoAspectRatio)}>
        <span className="tape tape-left" />
        <span className="tape tape-right" />
        <div className={`photo-frame ${form.frameFit === "contain" ? "contain" : ""}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="" />
          ) : (
            <div className="photo-placeholder">
              <span>{initials(form.name)}</span>
            </div>
          )}
        </div>
        <div className="polaroid-caption">
          <p className="caption-name">{form.name}</p>
          <div className="blur-copy">
            <p className="caption-message">{form.message}</p>
            {form.memory ? <p className="caption-extra">Memory: {form.memory}</p> : null}
            {form.song ? <p className="caption-extra">Song: {form.song}</p> : null}
          </div>
        </div>
      </article>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="review-actions">
        <button className="ghost-button" type="button" onClick={onEdit} disabled={saving}>
          <ArrowLeft size={17} aria-hidden="true" />
          Edit
        </button>
        <button className="primary-button" type="button" onClick={onConfirm} disabled={saving}>
          <Check size={17} aria-hidden="true" />
          {saving ? "Pinning..." : "Confirm & pin"}
        </button>
      </div>
    </div>
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
        <p className="caption-name">{wish.name || "Friend of Jen"}</p>
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

function parseStoredSubmissions(value: string): StoredSubmission[] {
  const parsed = JSON.parse(value) as StoredSubmission | StoredSubmission[];
  const submissions = Array.isArray(parsed) ? parsed : [parsed];

  return submissions.filter((submission) => submission && submission.wish && submission.wish.id);
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
