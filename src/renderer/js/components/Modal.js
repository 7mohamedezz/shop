/**
 * Modal component for user interactions
 */

class Modal {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    this.isOpen = false;
    this.currentResolve = null;

    if (this.modal) {
      this.setupEventListeners();
    }
  }

  setupEventListeners() {
    // Close on backdrop click
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) {
        this.close(null);
      }
    });

    // Close on escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close(null);
      }
    });
  }

  open() {
    if (!this.modal) {
      return Promise.resolve(null);
    }

    this.modal.style.display = 'flex';
    this.isOpen = true;

    return new Promise(resolve => {
      this.currentResolve = resolve;
    });
  }

  close(result) {
    if (!this.modal) {
      return;
    }

    this.modal.style.display = 'none';
    this.isOpen = false;

    if (this.currentResolve) {
      this.currentResolve(result);
      this.currentResolve = null;
    }
  }
}

/**
 * Confirmation modal for user confirmations
 */
class ConfirmationModal extends Modal {
  constructor() {
    super('confirm-modal');
    this.titleEl = document.getElementById('confirm-title');
    this.messageEl = document.getElementById('confirm-message');
    this.cancelBtn = document.getElementById('confirm-cancel-btn');
    this.okBtn = document.getElementById('confirm-ok-btn');

    if (this.cancelBtn && this.okBtn) {
      this.cancelBtn.addEventListener('click', () => this.close(false));
      this.okBtn.addEventListener('click', () => this.close(true));
    }
  }

  async show({ title = 'تأكيد', message = 'هل أنت متأكد؟' }) {
    if (!this.modal) {
      return false;
    }

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.messageEl) {
      this.messageEl.textContent = message;
    }

    return await this.open();
  }
}

/**
 * Edit person modal for customer/plumber editing
 */
class EditPersonModal extends Modal {
  constructor() {
    super('edit-person-modal');
    this.titleEl = document.getElementById('edit-person-title');
    this.nameEl = document.getElementById('edit-person-name');
    this.phoneEl = document.getElementById('edit-person-phone');
    this.errorEl = document.getElementById('edit-person-error');
    this.cancelBtn = document.getElementById('edit-person-cancel');
    this.saveBtn = document.getElementById('edit-person-save');

    if (this.cancelBtn && this.saveBtn) {
      this.cancelBtn.addEventListener('click', () => this.close(null));
      this.saveBtn.addEventListener('click', () => this.handleSave());
    }
  }

  async show({ title = 'تعديل', name = '', phone = '', requirePhone = false }) {
    if (!this.modal) {
      return null;
    }

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.nameEl) {
      this.nameEl.value = name || '';
    }
    if (this.phoneEl) {
      this.phoneEl.value = phone || '';
    }
    if (this.errorEl) {
      this.errorEl.textContent = '';
    }

    this.requirePhone = requirePhone;

    return await this.open();
  }

  handleSave() {
    const name = (this.nameEl?.value || '').trim();
    const phone = (this.phoneEl?.value || '').trim();

    // Validation
    if (!name) {
      if (this.errorEl) {
        this.errorEl.textContent = 'الاسم مطلوب';
      }
      return;
    }

    if (this.requirePhone && !phone) {
      if (this.errorEl) {
        this.errorEl.textContent = 'الهاتف مطلوب';
      }
      return;
    }

    this.close({ name, phone });
  }
}

// Global modal instances
let confirmationModal = null;
let editPersonModal = null;

/**
 * Shows a confirmation dialog
 * @param {Object} options - Confirmation options
 * @returns {Promise<boolean>} - User's choice
 */
async function showConfirmation(options = {}) {
  if (!confirmationModal) {
    confirmationModal = new ConfirmationModal();
  }
  return await confirmationModal.show(options);
}

/**
 * Shows an edit person dialog
 * @param {Object} options - Edit options
 * @returns {Promise<Object|null>} - Edited data or null if cancelled
 */
async function openEditPersonModal(options = {}) {
  if (!editPersonModal) {
    editPersonModal = new EditPersonModal();
  }
  return await editPersonModal.show(options);
}

module.exports = {
  Modal,
  ConfirmationModal,
  EditPersonModal,
  showConfirmation,
  openEditPersonModal
};
