import { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage, getFieldErrors } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { validateFields } from '../utils/validators.js';
import { Alert, Field, Modal, Pagination, rid } from './ui.jsx';

// Generic, configuration-driven CRUD page: list + search + filters + pagination + create/edit form.
// Each module (Customers, Leads, ...) supplies a config object instead of duplicating this logic.

const resolve = (value, values) => (typeof value === 'function' ? value(values) : value);

const blankForm = (fields) => Object.fromEntries(fields.map((f) => [f.name, '']));

const fromRecord = (fields, record) => {
  const out = {};
  fields.forEach((f) => {
    const v = record[f.name];
    if (v && typeof v === 'object' && !(v instanceof Date)) out[f.name] = v._id ?? v.id ?? '';
    else if (f.type === 'date' && v) out[f.name] = String(v).slice(0, 10);
    else out[f.name] = v ?? '';
  });
  return out;
};

export default function ResourcePage({ config }) {
  const { user } = useAuth();
  const readOnly = !!config.readOnly;
  const canCreate = !readOnly && config.canCreate !== false;
  const canDelete = !readOnly && config.canDelete !== false;

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [modal, setModal] = useState(null); // { mode: 'create' | 'edit', record? }
  const [form, setForm] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [optionCache, setOptionCache] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(config.endpoint, { params: { ...filterValues, q, page, limit: 10 } });
      setItems(data.items);
      setMeta({ page: data.page, pages: data.pages, total: data.total });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, filterValues, q, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(''), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  // Fields visible to the current role (and hidden in edit mode when onlyCreate is set)
  const visibleFields = (config.fields || []).filter(
    (f) => (!f.roles || f.roles.includes(user.role)) && !(f.onlyCreate && modal?.mode === 'edit')
  );

  // Load dropdown options (e.g. customers, users) once per source
  const sources = modal ? [...new Set(visibleFields.map((f) => resolve(f.source, form)).filter(Boolean))] : [];
  const sourcesKey = sources.join('|');
  useEffect(() => {
    sources.forEach(async (src) => {
      if (optionCache[src]) return;
      try {
        const { data } = await api.get(src, { params: { limit: 100 } });
        setOptionCache((c) => ({ ...c, [src]: data.items || [] }));
      } catch {
        setOptionCache((c) => ({ ...c, [src]: [] }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey]);

  const getOptions = (f) => {
    if (f.options) return f.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    const src = resolve(f.source, form);
    if (!src) return [];
    const labelKey = resolve(f.labelKey, form) || 'name';
    return (optionCache[src] || []).map((o) => ({ value: rid(o), label: o[labelKey] || o.name || rid(o) }));
  };

  const openCreate = () => {
    setFormErrors({});
    setFormError('');
    setForm({ ...blankForm(config.fields), ...(config.defaults || {}) });
    setModal({ mode: 'create' });
  };

  const openEdit = (record) => {
    setFormErrors({});
    setFormError('');
    setForm(fromRecord(config.fields, record));
    setModal({ mode: 'edit', record });
  };

  const setValue = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const errs = {
      ...validateFields(visibleFields, form),
      ...(config.extraValidate ? config.extraValidate(form, modal.mode) : {}),
    };
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload = config.toPayload ? config.toPayload(form, modal.mode) : { ...form };
      if (modal.mode === 'create') {
        await api.post(config.endpoint, payload);
        setFlash(`${config.singular} created successfully.`);
      } else {
        await api.put(`${config.endpoint}/${rid(modal.record)}`, payload);
        setFlash(`${config.singular} updated successfully.`);
      }
      setModal(null);
      load();
    } catch (err) {
      setFormErrors(getFieldErrors(err));
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const verb = config.deleteVerb || 'delete';
    if (!window.confirm(`Are you sure you want to ${verb} this ${config.singular.toLowerCase()}?`)) return;
    try {
      await api.delete(`${config.endpoint}/${rid(row)}`);
      setFlash(config.deleteMessage || `${config.singular} deleted.`);
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const runAction = async (action) => {
    try {
      const msg = await action.run();
      setFlash(msg || 'Action completed successfully.');
      load();
    } catch (err) {
      setError(err.response ? getErrorMessage(err) : err.message);
    }
  };

  const renderInput = (f) => {
    const value = form[f.name] ?? '';
    const invalid = formErrors[f.name] ? ' invalid' : '';
    const common = {
      id: f.name,
      name: f.name,
      value,
      onChange: (e) => setValue(f.name, e.target.value),
      placeholder: f.placeholder,
      className: `${f.type === 'select' ? 'select' : f.type === 'textarea' ? 'textarea' : 'input'}${invalid}`,
    };
    if (f.type === 'select') {
      return (
        <select {...common}>
          <option value="">{f.placeholder || 'Select...'}</option>
          {getOptions(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (f.type === 'textarea') return <textarea {...common} />;
    return <input {...common} type={f.type || 'text'} min={f.min} max={f.max} step={f.step} />;
  };

  const actions = (row) => (config.rowActions ? config.rowActions(row) : []);
  const hasActions = !readOnly && (canDelete || config.canEdit !== false || !!config.rowActions);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{config.title}</h1>
          {config.subtitle && <p>{config.subtitle}</p>}
        </div>
        {canCreate && (
          <button className="btn" onClick={openCreate}>
            {config.createLabel || `New ${config.singular}`}
          </button>
        )}
      </div>

      {flash && <Alert type="success">{flash}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="toolbar">
        {config.searchPlaceholder && (
          <input
            className="input grow"
            placeholder={config.searchPlaceholder}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            aria-label="Search"
          />
        )}
        {(config.filters || []).map((f) => (
          <select
            key={f.key}
            className="select"
            style={{ width: 'auto', minWidth: 170 }}
            value={filterValues[f.key] || ''}
            onChange={(e) => { setFilterValues((p) => ({ ...p, [f.key]: e.target.value })); setPage(1); }}
            aria-label={f.label}
          >
            <option value="">All {f.label}</option>
            {f.options.map((o) => {
              const opt = typeof o === 'string' ? { value: o, label: o } : o;
              return <option key={opt.value} value={opt.value}>{opt.label}</option>;
            })}
          </select>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {config.columns.map((c) => <th key={c.label}>{c.label}</th>)}
              {hasActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={config.columns.length + 1} className="empty">Loading...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={config.columns.length + 1} className="empty">{config.emptyText || 'No records found.'}</td></tr>
            )}
            {!loading && items.map((row) => (
              <tr key={rid(row)}>
                {config.columns.map((c) => (
                  <td key={c.label}>{c.render ? c.render(row) : row[c.key] ?? '-'}</td>
                ))}
                {hasActions && (
                  <td className="actions">
                    {actions(row).map((a) => (
                      <button key={a.label} className={`btn small ${a.variant || 'secondary'}`} onClick={() => runAction(a)}>
                        {a.label}
                      </button>
                    ))}
                    {!readOnly && config.canEdit !== false && config.canEdit?.(row, user) !== false && (
                      <button className="btn small secondary" onClick={() => openEdit(row)}>Edit</button>
                    )}
                    {canDelete && config.canDelete?.(row, user) !== false && (
                      <button className="btn small danger" onClick={() => remove(row)}>
                        {config.deleteLabel || 'Delete'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={meta.page} pages={meta.pages} total={meta.total} onChange={setPage} />

      {modal && (
        <Modal title={modal.mode === 'create' ? (config.createLabel || `New ${config.singular}`) : `Edit ${config.singular}`} onClose={() => setModal(null)}>
          <form onSubmit={submit} noValidate>
            {formError && <Alert>{formError}</Alert>}
            <div className="form-grid">
              {visibleFields.map((f) => (
                <Field key={f.name} label={`${f.label}${f.required ? ' *' : ''}`} error={formErrors[f.name]} hint={f.hint} full={f.full}>
                  {renderInput(f)}
                </Field>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
