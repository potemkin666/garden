/**
 * detail-panel.js — Side panel showing detailed source information.
 *
 * Improvements:
 *  2. Sparklines — shows freshness/reliability trend from localStorage history
 *  9. Error categorization and remediation hints — suggests fixes based on error category
 */

import { mapSourceToVisual, STATUS_COLORS, STATUS_LABELS } from './state-map.js';
import { formatDate, timeAgo, escapeHtml, scoreBar } from './utils.js';
import { getSourceHistory, renderSparkline } from './sparkline.js';

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
      ${buildRemediationHint(reason)}
    </div>`;
}

/**
 * Generate a remediation hint based on the block/error reason text.
 */
function buildRemediationHint(reason) {
  if (!reason) return '';
  const lower = reason.toLowerCase();
  let hint = '';

  if (lower.includes('anti-bot') || lower.includes('cloudflare') || lower.includes('captcha')) {
    hint = 'Consider using a headless browser (Playwright/Puppeteer) or a residential proxy to bypass anti-bot protection.';
  } else if (lower.includes('403') || lower.includes('auth') || lower.includes('api key') || lower.includes('credential')) {
    hint = 'Rotate or refresh API credentials. Check if the access token has expired or been revoked.';
  } else if (lower.includes('404') || lower.includes('not found') || lower.includes('removed') || lower.includes('deprecated')) {
    hint = 'The endpoint may have been removed or relocated. Search for a replacement URL or updated API docs.';
  } else if (lower.includes('429') || lower.includes('rate limit')) {
    hint = 'Implement exponential backoff and reduce polling frequency. Consider using a distributed proxy pool.';
  } else if (lower.includes('timeout') || lower.includes('network') || lower.includes('dns')) {
    hint = 'Check network connectivity and DNS resolution. The server may be temporarily unreachable.';
  } else if (lower.includes('ssl') || lower.includes('certificate')) {
    hint = 'The SSL certificate may have expired or changed. Verify the certificate chain.';
  }

  if (!hint) return '';
  return `<p class="remediation-hint"><span class="hint-icon" aria-hidden="true">💡</span> ${escapeHtml(hint)}</p>`;
}

/**
 * Show an in-app confirmation dialog instead of the native confirm().
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 */
function showConfirmModal(message) {
  return new Promise((resolve) => {
    // Remove any existing confirm modal
    const existing = document.getElementById('confirm-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal-overlay';
    overlay.id = 'confirm-modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-container confirm-modal';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Confirm action');

    dialog.innerHTML = `
      <div class="confirm-body">
        <p class="confirm-message">${escapeHtml(message)}</p>
      </div>
      <div class="confirm-actions">
        <button class="form-btn form-btn-cancel" id="confirm-cancel-btn">Cancel</button>
        <button class="form-btn confirm-btn-danger" id="confirm-ok-btn">Remove</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);

    function cleanup(result) {
      overlay.remove();
      dialog.remove();
      document.removeEventListener('keydown', escHandler);
      resolve(result);
    }

    function escHandler(e) {
      if (e.key === 'Escape') cleanup(false);
    }

    overlay.addEventListener('click', () => cleanup(false));
    dialog.querySelector('#confirm-cancel-btn').addEventListener('click', () => cleanup(false));
    dialog.querySelector('#confirm-ok-btn').addEventListener('click', () => cleanup(true));
    document.addEventListener('keydown', escHandler);

    // Focus the cancel button by default (safe option)
    setTimeout(() => dialog.querySelector('#confirm-cancel-btn')?.focus(), 60);
  });
}

/**
 * Build and return the inner HTML for the detail panel.
 */
function buildPanelContent(source, isUserOwned = false) {
  const visual = mapSourceToVisual(source);
  const statusColor = STATUS_COLORS[visual.status] || '#5a5048';
  const statusLabel = STATUS_LABELS[visual.status] || visual.status;

  // Sparkline history
  const history = getSourceHistory(source.id);
  const freshnessSparkline = history
    ? renderSparkline(history.freshness, { color: '#5a9a4a', label: 'Freshness trend', width: 80, height: 18 })
    : '';
  const reliabilitySparkline = history
    ? renderSparkline(history.reliability, { color: '#3a7a9a', label: 'Reliability trend', width: 80, height: 18 })
    : '';

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
        ${freshnessSparkline ? `<div class="sparkline-row">${freshnessSparkline}</div>` : ''}
        <div class="score-row">
          <span class="score-name">Reliability</span>
          <span class="score-val">${source.reliabilityScore}</span>
          ${scoreBar(source.reliabilityScore)}
        </div>
        ${reliabilitySparkline ? `<div class="sparkline-row">${reliabilitySparkline}</div>` : ''}
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
        ${buildRemediationHintFromNotes(source)}
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
 * Generate remediation hint from the notes field for non-blocked sources.
 */
function buildRemediationHintFromNotes(source) {
  // Only show for sources that are failing, stale, or dead
  if (!['failing', 'stale', 'dead', 'blocked'].includes(source.status)) return '';
  // Don't duplicate if blockedReason already provides a hint
  if (source.blockedReason) return '';
  return buildRemediationHint(source.notes);
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
    removeBtn.addEventListener('click', async () => {
      const confirmed = await showConfirmModal(`Remove "${source.name}" from the garden?`);
      if (confirmed) {
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
