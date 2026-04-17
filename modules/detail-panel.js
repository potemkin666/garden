/**
 * detail-panel.js — Side panel showing detailed source information.
 */

import { mapSourceToVisual, STATUS_COLORS, STATUS_LABELS } from './state-map.js';
import { formatDate, timeAgo, escapeHtml, scoreBar } from './utils.js';

const SEVERITY_COLORS = {
  low: '#6a8a4a',
  medium: '#a08a2a',
  high: '#c04a20',
  critical: '#c02040',
};

function severityBadge(severity) {
  if (!severity) return '';
  const col = SEVERITY_COLORS[severity] || '#666';
  return `<span class="severity-badge" style="background:${col}">${escapeHtml(severity)}</span>`;
}

function blockedReasonBlock(reason) {
  if (!reason) return '';
  return `
    <div class="detail-block hostile-block">
      <h4 class="block-label">Block Reason</h4>
      <p class="block-text">${escapeHtml(reason)}</p>
    </div>`;
}

/**
 * Build and return the inner HTML for the detail panel.
 */
function buildPanelContent(source, isUserOwned = false) {
  const visual = mapSourceToVisual(source);
  const statusColor = STATUS_COLORS[visual.status] || '#5a5048';
  const statusLabel = STATUS_LABELS[visual.status] || visual.status;

  return `
    <div class="panel-header">
      <div class="panel-title-row">
        <span class="panel-status-dot" style="background:${statusColor}"></span>
        <h2 class="panel-source-name">${escapeHtml(source.name)}</h2>
        <button class="panel-close" id="panel-close-btn" aria-label="Close panel">✕</button>
      </div>
      <div class="panel-meta-row">
        <span class="panel-category">${escapeHtml(source.category)}</span>
        <span class="panel-status-label status-${visual.status}">${statusLabel}</span>
      </div>
      <p class="panel-status-desc">${escapeHtml(visual.statusDescription)}</p>
    </div>

    <div class="panel-body">

      <div class="detail-block">
        <h4 class="block-label">Scores</h4>
        <div class="score-row">
          <span class="score-name">Freshness</span>
          <span class="score-val">${source.freshnessScore}</span>
          ${scoreBar(source.freshnessScore)}
        </div>
        <div class="score-row">
          <span class="score-name">Reliability</span>
          <span class="score-val">${source.reliabilityScore}</span>
          ${scoreBar(source.reliabilityScore)}
        </div>
      </div>

      <div class="detail-block">
        <h4 class="block-label">Activity</h4>
        <dl class="detail-dl">
          <dt>Last success</dt>
          <dd>${formatDate(source.lastSuccessAt)} <span class="time-ago">(${timeAgo(source.lastSuccessAt)})</span></dd>
          <dt>Last failure</dt>
          <dd>${formatDate(source.lastFailureAt)} <span class="time-ago">(${timeAgo(source.lastFailureAt)})</span></dd>
          <dt>Total failures</dt>
          <dd>${source.failureCount}</dd>
        </dl>
      </div>

      ${source.incidentCountRecent > 0 ? `
      <div class="detail-block incident-block">
        <h4 class="block-label">Recent Incidents</h4>
        <div class="incident-row">
          <span class="incident-count">${source.incidentCountRecent}</span>
          <span class="incident-label">incident(s) in recent window</span>
          ${severityBadge(source.incidentSeverity)}
        </div>
      </div>` : ''}

      ${source.quarantined ? `
      <div class="detail-block quarantine-block">
        <h4 class="block-label">⚠ Quarantine Active</h4>
        <p class="block-text">This source is isolated. Ingestion paused pending manual review.</p>
      </div>` : ''}

      ${blockedReasonBlock(source.blockedReason)}

      ${source.notes ? `
      <div class="detail-block">
        <h4 class="block-label">Notes</h4>
        <p class="block-text">${escapeHtml(source.notes)}</p>
      </div>` : ''}

      <div class="detail-block">
        <h4 class="block-label">Source ID</h4>
        <code class="source-id">${escapeHtml(source.id)}</code>
      </div>

      ${isUserOwned ? `
      <div class="detail-block remove-block">
        <button class="remove-source-btn" id="panel-remove-btn">Remove from garden</button>
      </div>` : ''}

    </div>
  `;
}

/**
 * Open the detail panel for a source.
 * @param {Object} source - Source data object
 * @param {HTMLElement} panelEl - The panel container element
 * @param {HTMLElement} overlayEl - The overlay element
 * @param {Function} onClose - Callback when panel closes
 * @param {Function|null} onRemove - Callback to remove source (only for user-added)
 */
export function openPanel(source, panelEl, overlayEl, onClose, onRemove = null) {
  panelEl.innerHTML = buildPanelContent(source, onRemove !== null);
  panelEl.classList.add('open');
  panelEl.setAttribute('aria-hidden', 'false');
  overlayEl.classList.remove('hidden');

  const closeBtn = panelEl.querySelector('#panel-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => closePanel(panelEl, overlayEl, onClose));
  }

  const removeBtn = panelEl.querySelector('#panel-remove-btn');
  if (removeBtn && typeof onRemove === 'function') {
    removeBtn.addEventListener('click', () => {
      if (confirm(`Remove "${source.name}" from the garden?`)) {
        onRemove(source.id);
      }
    });
  }

  panelEl.querySelector('.panel-close')?.focus();
}

/**
 * Close the detail panel.
 */
export function closePanel(panelEl, overlayEl, onClose) {
  panelEl.classList.remove('open');
  panelEl.setAttribute('aria-hidden', 'true');
  overlayEl.classList.add('hidden');
  if (typeof onClose === 'function') onClose();
}
