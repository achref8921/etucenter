"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, Save, Building2, Phone, MapPin, Loader2 } from "lucide-react";

interface CenterData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  phone: string | null;
  address: string | null;
}

export default function AdminParametresPage() {
  const [center, setCenter] = useState<CenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [centerCode, setCenterCode] = useState("");

  useEffect(() => {
    fetch("/api/admin/center")
      .then((r) => r.json())
      .then((data) => {
        setCenter(data);
        setName(data.name || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setLogo(data.logo || null);
        setCenterCode(data.code || "");
        setLoading(false);
      });
  }, []);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 256;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/admin/center", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, logo }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Error saving");
    } else {
      setSuccess("Settings saved successfully!");
      setCenter(data);
    }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Center Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your center name, logo, and contact information</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{success}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Logo */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Center Logo</h2>
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {logo ? (
                <img src={logo} alt="Logo" className="h-full w-full object-contain p-2" />
              ) : (
                <div className="text-center">
                  <Building2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-500" />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Click to upload</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" /> Upload Logo
            </button>
            {logo && (
              <button onClick={() => setLogo(null)} className="text-xs text-red-500 hover:text-red-700">
                Remove logo
              </button>
            )}
            <p className="text-xs text-slate-400 dark:text-slate-500">PNG, JPG, max 2MB. Recommended: 256x256px</p>
          </div>
        </div>

        {/* Center Info */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Center Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/40 dark:bg-violet-900/20">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">Code du centre</label>
                <p className="font-mono text-xl font-bold tracking-widest text-violet-800 dark:text-violet-200">{centerCode || "—"}</p>
              </div>
              <p className="ml-auto max-w-[220px] text-xs leading-relaxed text-violet-600 dark:text-violet-300">
                Donnez ce code aux élèves et profs pour qu&apos;ils s&apos;inscrivent dans votre centre.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Center Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                placeholder="Your center name"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                  placeholder="+216 XX XXX XXX"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Address</span>
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                  placeholder="City, Country"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">Slug</label>
              <input
                disabled
                value={center?.slug || ""}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Slug cannot be changed</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 dark:border-slate-700 pt-4">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Preview — Sidebar & Header</h2>
        <div className="flex gap-6">
          {/* Sidebar preview */}
          <div className="w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="flex h-16 items-center gap-3 border-b border-slate-100 dark:border-slate-700 px-4">
              {logo ? (
                <img src={logo} alt="Logo" className="h-9 w-9 rounded-xl object-contain" />
              ) : (
                <img src="/icon-192.png" alt="Logo" className="h-9 w-9 rounded-xl object-contain" />
              )}
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{name || "Center Name"}</span>
                <p className="text-[10px] font-medium uppercase text-slate-400 dark:text-slate-500">Administrateur</p>
              </div>
            </div>
            <div className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500">Dashboard · Utilisateurs · Groupes ...</div>
          </div>
          {/* Header preview */}
          <div className="flex-1">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
              <div />
              <div className="flex items-center gap-3">
                {logo && <img src={logo} alt="Logo" className="h-6 w-6 rounded-lg object-contain" />}
                <span className="text-xs text-slate-400 dark:text-slate-500">Notifications</span>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Admin</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
