import { useMemo, useState } from 'react'
import { Signpost, Plus, Pencil, Trash2, MapPin, ImagePlus, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageHeader, EmptyState, Modal, Badge, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useFleet } from '../context/FleetContext'
import { addSignage, updateSignage, deleteSignage, getSignagePhoto } from '../lib/firestore'
import { readFileAsDataUrl } from '../lib/fileToDataUrl'
import {
  SIGNAGE_TYPES,
  SIGNAGE_CONDITIONS,
  SIGNAGE_CONDITION_COLOR,
  FLOOR_SIGNAGE_TYPES,
  REGIONS,
} from '../lib/constants'

const EMPTY = {
  centerName: '',
  region: '',
  type: 'Stretcher Signage',
  floor: '',
  location: '',
  condition: 'OK',
  quantity: 1,
  lastChecked: '',
  notes: '',
  photoUrl: '',
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

export default function Signages() {
  const { orgId, profile } = useAuth()
  const { signages, sites, loading } = useFleet()

  const [siteFilter, setSiteFilter] = useState('all')
  const [editing, setEditing] = useState(null) // signage object or {…EMPTY}
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoView, setPhotoView] = useState(null) // {type, photoUrl} to enlarge

  const filtered = useMemo(() => {
    if (siteFilter === 'all') return signages
    return signages.filter((s) => s.centerName === siteFilter)
  }, [signages, siteFilter])

  // Group by site so the inventory reads "site-wise".
  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const key = s.centerName || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value })

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file')
    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file) // validates + caps at ~700 KB
      setEditing((cur) => ({ ...cur, photoUrl: dataUrl, _photoDirty: true }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  // Open the edit modal; lazy-fetch the photo (it isn't carried in the list).
  const openEdit = async (s) => {
    setEditing({ ...s, photoUrl: '', _photoDirty: false, _photoLoading: !!s.hasPhoto })
    if (s.hasPhoto) {
      try {
        const url = await getSignagePhoto(orgId, s.id)
        setEditing((cur) => (cur && cur.id === s.id ? { ...cur, photoUrl: url, _photoLoading: false } : cur))
      } catch {
        setEditing((cur) => (cur && cur.id === s.id ? { ...cur, _photoLoading: false } : cur))
      }
    }
  }

  const removePhoto = () => setEditing((cur) => ({ ...cur, photoUrl: '', _photoDirty: true }))

  // View a photo full-size; fetched on demand only when opened.
  const viewPhoto = async (s) => {
    if (!s.hasPhoto && !s.photoUrl) return
    if (s.photoUrl) return setPhotoView({ ...s })
    setPhotoView({ ...s, photoUrl: '', _loading: true })
    try {
      const url = await getSignagePhoto(orgId, s.id)
      setPhotoView((cur) => (cur && cur.id === s.id ? { ...cur, photoUrl: url, _loading: false } : cur))
    } catch {
      setPhotoView((cur) => (cur && cur.id === s.id ? { ...cur, _loading: false } : cur))
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!editing.centerName.trim()) return toast.error('Site (center name) is required')
    setBusy(true)
    try {
      const actor = { uid: profile?.uid, name: profile?.name }
      if (editing.id) {
        // Only re-write the (large) photo doc when it actually changed.
        await updateSignage(orgId, editing.id, { ...editing, photoUrl: editing._photoDirty ? editing.photoUrl : undefined }, actor)
        toast.success('Signage updated')
      } else {
        await addSignage(orgId, editing, actor)
        toast.success('Signage added')
      }
      setEditing(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    try {
      await deleteSignage(orgId, removing.id, { uid: profile?.uid, name: profile?.name }, `${removing.type} @ ${removing.centerName}`)
      toast.success('Signage deleted')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      <PageHeader title="Safety Signage" subtitle="Site-wise inventory of fire & safety signage" icon={Signpost}>
        <select className="input w-auto" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>
          <Plus size={16} /> Add signage
        </button>
      </PageHeader>

      {loading ? (
        <div className="grid place-items-center py-20"><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Signpost}
          title="No signage recorded"
          hint="Add fire exit, assembly point, extinguisher and other safety signs for each site."
          action={<button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={16} /> Add signage</button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([site, items]) => (
            <div key={site}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <MapPin size={15} className="text-brand-500" />
                <h3 className="text-sm font-extrabold text-ink-800">{site}</h3>
                <span className="chip bg-ink-100 text-ink-500">{items.length}</span>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-clay-200/60 text-[11px] uppercase tracking-wide text-ink-400">
                    <tr>
                      <th className="px-4 py-2.5">Photo</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Floor</th>
                      <th className="px-4 py-2.5">Location</th>
                      <th className="px-4 py-2.5">Qty</th>
                      <th className="px-4 py-2.5">Condition</th>
                      <th className="px-4 py-2.5">Last checked</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-200/50">
                    {items.map((s) => (
                      <tr key={s.id} className="hover:bg-clay-50">
                        <td className="px-4 py-2.5">
                          {(s.hasPhoto || s.photoUrl) ? (
                            <button onClick={() => viewPhoto(s)} className="grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-brand-600 transition hover:bg-brand-100" title="View photo">
                              <ImageIcon size={15} />
                            </button>
                          ) : (
                            <span className="grid h-9 w-9 place-items-center rounded-md bg-clay-100 text-ink-300"><ImageIcon size={14} /></span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-ink-800">{s.type}</td>
                        <td className="px-4 py-2.5 text-ink-500">{s.floor || '—'}</td>
                        <td className="px-4 py-2.5 text-ink-500">{s.location || '—'}</td>
                        <td className="px-4 py-2.5 text-ink-600">{s.quantity}</td>
                        <td className="px-4 py-2.5">
                          <Badge color={SIGNAGE_CONDITION_COLOR[s.condition] || '#64748b'}>{s.condition}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-ink-500">{s.lastChecked || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <button className="btn-soft px-2 py-1.5" onClick={() => openEdit(s)} title="Edit"><Pencil size={15} /></button>
                            <button className="btn-soft px-2 py-1.5 text-red-600" onClick={() => setRemoving(s)} title="Delete"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit signage' : 'Add signage'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site / Center name *">
                <input className="input" list="signage-sites" placeholder="e.g. Tower B - Floor 3" value={editing.centerName} onChange={set('centerName')} required />
                <datalist id="signage-sites">
                  {sites.map((s) => <option key={s} value={s} />)}
                </datalist>
              </Field>
              <Field label="Region">
                <select className="input" value={editing.region} onChange={set('region')}>
                  <option value="">—</option>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Signage type">
                <select className="input" value={editing.type} onChange={set('type')}>
                  {SIGNAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label={FLOOR_SIGNAGE_TYPES.includes(editing.type) ? 'Floor (one record per floor)' : 'Floor (optional)'}>
                <input className="input" placeholder="e.g. Ground, 1, 2, Basement" value={editing.floor} onChange={set('floor')} />
              </Field>
              <Field label="Condition">
                <select className="input" value={editing.condition} onChange={set('condition')}>
                  {SIGNAGE_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Location / placement">
                <input className="input" placeholder="e.g. Above stairwell C door" value={editing.location} onChange={set('location')} />
              </Field>
              <Field label="Quantity">
                <input type="number" min={1} className="input" value={editing.quantity} onChange={set('quantity')} />
              </Field>
              <Field label="Last checked">
                <input type="date" className="input" value={editing.lastChecked} onChange={set('lastChecked')} />
              </Field>
            </div>
            <Field label="Photo of signage (optional, image ≤ 700 KB)">
              {editing._photoLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-clay-300 px-4 py-3 text-sm text-ink-500">
                  <Spinner size={16} /> Loading photo…
                </div>
              ) : editing.photoUrl ? (
                <div className="flex items-center gap-3">
                  <img src={editing.photoUrl} alt="Signage" className="h-20 w-20 rounded-lg border border-clay-200 object-cover" />
                  <div className="flex flex-col gap-2">
                    <label className="btn-soft cursor-pointer text-xs">
                      <ImagePlus size={14} /> Replace
                      <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                    </label>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={removePhoto}>
                      <X size={14} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-clay-300 px-4 py-3 text-sm text-ink-500 hover:bg-clay-50">
                  {uploading ? <Spinner size={16} /> : <ImagePlus size={16} />}
                  {uploading ? 'Uploading…' : 'Upload a photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
                </label>
              )}
            </Field>
            <Field label="Notes">
              <textarea className="input" rows={2} value={editing.notes} onChange={set('notes')} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? <Spinner size={16} /> : (editing.id ? 'Save changes' : 'Add signage')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Delete signage?">
        <p className="text-sm text-ink-600">
          Remove <span className="font-semibold">{removing?.type}</span> at{' '}
          <span className="font-semibold">{removing?.centerName}</span>? This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn-danger" onClick={confirmDelete}>Delete</button>
        </div>
      </Modal>

      {/* Photo viewer */}
      <Modal open={!!photoView} onClose={() => setPhotoView(null)} title={photoView ? `${photoView.type}${photoView.floor ? ` · Floor ${photoView.floor}` : ''}` : ''} maxWidth="max-w-2xl">
        {photoView?._loading ? (
          <div className="grid place-items-center py-16"><Spinner size={28} /></div>
        ) : photoView?.photoUrl ? (
          <img src={photoView.photoUrl} alt={photoView.type} className="max-h-[70vh] w-full rounded-xl object-contain" />
        ) : (
          <p className="py-10 text-center text-sm text-ink-500">Photo could not be loaded.</p>
        )}
      </Modal>
    </div>
  )
}
