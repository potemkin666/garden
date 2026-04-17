/**
 * add-source.js — Modal form for adding new sources to the garden.
 */

import { escapeHtml } from './utils.js';

const STATUS_OPTIONS = [
  'healthy', 'stale', 'failing', 'blocked', 'dead', 'recovering', 'quarantined',
];

const SEVERITY_OPTIONS = ['', 'low', 'medium', 'high', 'critical'];

/**
 * Open the add-source modal.
 * @param {Function} onSubmit - Called with the new source object when submitted
 * @param {Function} onClose - Called when modal is closed
 * @param {Object} [editSource] - Optional existing source to edit
 */
export function openAddSourceModal(onSubmit, onClose, editSource = null) {
  // Remove any existing modal
  closeAddSourceModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-source-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-container';
  modal.id = 'add-source-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', editSource ? 'Edit source' : 'Add new source');
  modal.setAttribute('aria-modal', 'true');

  const isEdit = !!editSource;
  const src = editSource || {};

  modal.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? 'Edit Source' : 'Add New Source'}</h2>
      <button class="modal-close-btn" id="modal-close-btn" aria-label="Close">✕</button>
    </div>
    <form id="add-source-form" class="modal-form" novalidate>
      <div class="form-row">
        <label class="form-label" for="src-name">Name <span class="required">*</span></label>
        <input type="text" id="src-name" class="form-input" required maxlength="100"
          placeholder="e.g. Reuters Wire" value="${escapeHtml(src.name || '')}" />
      </div>
      <div class="form-row-pair">
        <div class="form-row">
          <label class="form-label" for="src-category">Category</label>
          <input type="text" id="src-category" class="form-input" maxlength="40"
            placeholder="e.g. news, finance, tech" value="${escapeHtml(src.category || '')}" />
        </div>
        <div class="form-row">
          <label class="form-label" for="src-status">Status</label>
          <select id="src-status" class="form-select">
            ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === (src.status || 'healthy') ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-pair">
        <div class="form-row">
          <label class="form-label" for="src-freshness">Freshness (0–100)</label>
          <input type="number" id="src-freshness" class="form-input" min="0" max="100"
            value="${src.freshnessScore ?? 80}" />
        </div>
        <div class="form-row">
          <label class="form-label" for="src-reliability">Reliability (0–100)</label>
          <input type="number" id="src-reliability" class="form-input" min="0" max="100"
            value="${src.reliabilityScore ?? 80}" />
        </div>
      </div>
      <div class="form-row-pair">
        <div class="form-row">
          <label class="form-label" for="src-failures">Failure Count</label>
          <input type="number" id="src-failures" class="form-input" min="0"
            value="${src.failureCount ?? 0}" />
        </div>
        <div class="form-row">
          <label class="form-label" for="src-incidents">Recent Incidents</label>
          <input type="number" id="src-incidents" class="form-input" min="0"
            value="${src.incidentCountRecent ?? 0}" />
        </div>
      </div>
      <div class="form-row-pair">
        <div class="form-row">
          <label class="form-label" for="src-severity">Incident Severity</label>
          <select id="src-severity" class="form-select">
            ${SEVERITY_OPTIONS.map((s) => `<option value="${s}" ${s === (src.incidentSeverity || '') ? 'selected' : ''}>${s || '— none —'}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <label class="form-label" for="src-quarantined">
            <input type="checkbox" id="src-quarantined" ${src.quarantined ? 'checked' : ''} />
            Quarantined
          </label>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label" for="src-blocked-reason">Blocked Reason</label>
        <input type="text" id="src-blocked-reason" class="form-input" maxlength="200"
          placeholder="If blocked, explain why" value="${escapeHtml(src.blockedReason || '')}" />
      </div>
      <div class="form-row">
        <label class="form-label" for="src-notes">Notes</label>
        <textarea id="src-notes" class="form-textarea" rows="2" maxlength="500"
          placeholder="Additional context…">${escapeHtml(src.notes || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="form-btn form-btn-cancel" id="modal-cancel-btn">Cancel</button>
        <button type="submit" class="form-btn form-btn-submit">${isEdit ? 'Save Changes' : 'Plant Source'}</button>
      </div>
    </form>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // Focus first input
  const firstInput = modal.querySelector('#src-name');
  if (firstInput) setTimeout(() => firstInput.focus(), 60);

  // Event handlers
  const closeModal = () => {
    closeAddSourceModal();
    if (typeof onClose === 'function') onClose();
  };

  overlay.addEventListener('click', closeModal);
  modal.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  modal.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  });

  const form = modal.querySelector('#add-source-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = form.querySelector('#src-name').value.trim();
    if (!name) {
      form.querySelector('#src-name').focus();
      return;
    }

    const newSource = {
      id: isEdit ? src.id : `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      category: form.querySelector('#src-category').value.trim() || 'uncategorized',
      status: form.querySelector('#src-status').value,
      lastSuccessAt: src.lastSuccessAt || new Date().toISOString(),
      lastFailureAt: src.lastFailureAt || null,
      failureCount: parseInt(form.querySelector('#src-failures').value, 10) || 0,
      freshnessScore: parseInt(form.querySelector('#src-freshness').value, 10) || 0,
      reliabilityScore: parseInt(form.querySelector('#src-reliability').value, 10) || 0,
      blockedReason: form.querySelector('#src-blocked-reason').value.trim() || null,
      quarantined: form.querySelector('#src-quarantined').checked,
      incidentCountRecent: parseInt(form.querySelector('#src-incidents').value, 10) || 0,
      incidentSeverity: form.querySelector('#src-severity').value || null,
      notes: form.querySelector('#src-notes').value.trim(),
    };

    closeAddSourceModal();
    if (typeof onSubmit === 'function') onSubmit(newSource);
  });
}

/**
 * Close the add-source modal if open.
 */
export function closeAddSourceModal() {
  const overlay = document.getElementById('add-source-overlay');
  const modal = document.getElementById('add-source-modal');
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}
