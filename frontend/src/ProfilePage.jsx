import { useEffect, useRef, useState } from "react";
import "./ProfilePage.css";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:5002/api").replace(/\/+$/, "");
const API_BASE = API_ROOT.endsWith("/api") ? API_ROOT : `${API_ROOT}/api`;
const PROFILE_API = `${API_BASE}/profile`;

function getErrorMessage(data, fallback) {
  return typeof data?.message === "string" ? data.message : fallback;
}

export default function ProfilePage({ onBack, onProfileUpdated }) {
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${PROFILE_API}/me`, {
          credentials: "include"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Could not load your profile"));
        }
        if (active) {
          setProfile(data.user);
          setName(data.user?.name || "");
          setBio(data.user?.bio || "");
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load your profile");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  function applyProfile(updatedProfile) {
    setProfile(updatedProfile);
    setName(updatedProfile?.name || "");
    setBio(updatedProfile?.bio || "");
    onProfileUpdated?.(updatedProfile);
  }

  function handlePhotoSelection(event) {
    const file = event.target.files?.[0];
    setNotice("");
    setError("");
    setSelectedPhoto(null);
    setPreviewUrl("");

    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image that is 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setSelectedPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${PROFILE_API}/me`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Could not save your profile"));
      }
      applyProfile(data.user);
      setNotice("Profile saved successfully.");
    } catch (saveError) {
      setError(saveError.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto() {
    if (!selectedPhoto) {
      fileInputRef.current?.click();
      return;
    }

    setUploading(true);
    setNotice("");
    setError("");
    const formData = new FormData();
    formData.append("photo", selectedPhoto);

    try {
      const response = await fetch(`${PROFILE_API}/me/photo`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Could not upload your photo"));
      }
      applyProfile(data.user);
      setSelectedPhoto(null);
      setPreviewUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Profile photo updated.");
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload your photo");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!profile?.profilePhoto?.url) return;
    setRemovingPhoto(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${PROFILE_API}/me/photo`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Could not remove your photo"));
      }
      applyProfile(data.user);
      setNotice("Profile photo removed.");
    } catch (removeError) {
      setError(removeError.message || "Could not remove your photo");
    } finally {
      setRemovingPhoto(false);
    }
  }

  const photoUrl = previewUrl || profile?.profilePhoto?.url || "";
  const initials = (profile?.name || name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading" role="status">Loading your profile…</div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <header className="profile-topbar">
          {onBack ? (
            <button className="profile-back-button" type="button" onClick={onBack}>
              <span aria-hidden="true">←</span> Back
            </button>
          ) : <span className="profile-brand">GRIDOPHONIC</span>}
          <span className="profile-topbar-label">Your account</span>
        </header>

        <div className="profile-content">
          <div className="profile-heading">
            <div>
              <p className="profile-eyebrow">ACCOUNT SETTINGS</p>
              <h1>Your profile</h1>
              <p className="profile-subtitle">Make your creative space feel like yours.</p>
            </div>
            <div className="profile-heading-mark" aria-hidden="true">✳</div>
          </div>

          {error && <div className="profile-alert profile-alert-error" role="alert">{error}</div>}
          {notice && <div className="profile-alert profile-alert-success" role="status">{notice}</div>}

          <div className="profile-grid">
            <section className="profile-card profile-photo-card" aria-labelledby="photo-title">
              <div>
                <p className="profile-card-kicker">YOUR IMAGE</p>
                <h2 id="photo-title">Profile photo</h2>
                <p className="profile-card-description">Add a photo so collaborators can recognize you.</p>
              </div>

              <div className="profile-avatar-wrap">
                {photoUrl ? (
                  <img className="profile-avatar" src={photoUrl} alt="Your profile" />
                ) : (
                  <div className="profile-avatar profile-avatar-placeholder" aria-label="No profile photo">
                    {initials || "U"}
                  </div>
                )}
                <span className="profile-avatar-status" aria-hidden="true" />
              </div>

              <input
                ref={fileInputRef}
                className="profile-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelection}
              />

              <div className="profile-photo-actions">
                <button
                  className="profile-button profile-button-primary"
                  type="button"
                  onClick={selectedPhoto ? uploadPhoto : () => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading…" : selectedPhoto ? "Upload photo" : "Choose photo"}
                </button>
                {profile?.profilePhoto?.url && !selectedPhoto && (
                  <button
                    className="profile-button profile-button-quiet"
                    type="button"
                    onClick={removePhoto}
                    disabled={removingPhoto}
                  >
                    {removingPhoto ? "Removing…" : "Remove"}
                  </button>
                )}
                {selectedPhoto && (
                  <button
                    className="profile-button profile-button-quiet"
                    type="button"
                    onClick={() => {
                      setSelectedPhoto(null);
                      setPreviewUrl("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <p className="profile-hint">JPG, PNG, or WebP · Up to 5 MB</p>
            </section>

            <form className="profile-card profile-details-card" onSubmit={saveProfile}>
              <div>
                <p className="profile-card-kicker">ABOUT YOU</p>
                <h2>Personal details</h2>
                <p className="profile-card-description">Your email is used for sign-in and can’t be changed here.</p>
              </div>

              <label className="profile-field">
                <span>Display name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>

              <label className="profile-field">
                <span>Email address</span>
                <input type="email" value={profile?.email || ""} readOnly disabled />
              </label>

              <label className="profile-field">
                <span>Bio <small>Optional</small></span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  maxLength={300}
                  rows={5}
                  placeholder="Tell your collaborators a little about yourself…"
                />
                <span className="profile-character-count">{bio.length}/300</span>
              </label>

              <div className="profile-form-footer">
                <span className="profile-role-pill">{profile?.role || "producer"}</span>
                <button className="profile-button profile-button-primary" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
