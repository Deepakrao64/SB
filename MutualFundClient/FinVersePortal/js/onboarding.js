const onboardingData = {
  personal: {},
  address: { current: {}, permanent: {} },
  financial: {},
  risk: { answers: {}, score: 0, profile: '' },
  documents: {}
};

const draftKey = 'finverse-onboarding-draft';
const sessionKey = 'finverse-user-session';
const totalSteps = 6;
let currentStep = 1;

const pincodeMap = {
  '411014': { city: 'Pune', state: 'Maharashtra' },
  '400001': { city: 'Mumbai', state: 'Maharashtra' },
  '560001': { city: 'Bengaluru', state: 'Karnataka' },
  '110001': { city: 'New Delhi', state: 'Delhi' },
  '600001': { city: 'Chennai', state: 'Tamil Nadu' }
};

const riskQuestions = [
  { id: 1, text: 'What is your preferred investment horizon?', options: [['Less than 2 years', 1], ['2 to 5 years', 3], ['More than 5 years', 5]] },
  { id: 2, text: 'How would you react to a temporary 15% portfolio decline?', options: [['Exit investments', 1], ['Wait for recovery', 3], ['Invest more', 5]] },
  { id: 3, text: 'What level of loss can you tolerate for higher returns?', options: [['Very little', 1], ['Some loss', 3], ['Significant loss', 5]] },
  { id: 4, text: 'Which best describes your primary investment goal?', options: [['Capital protection', 1], ['Balanced growth', 3], ['Maximum growth', 5]] },
  { id: 5, text: 'What equity exposure feels appropriate?', options: [['Up to 20%', 1], ['20% to 60%', 3], ['Above 60%', 5]] },
  { id: 6, text: 'How large is your emergency fund?', options: [['None or less than 3 months', 1], ['3 to 6 months', 3], ['More than 6 months', 5]] },
  { id: 7, text: 'How familiar are you with existing investments?', options: [['New to investing', 1], ['Some experience', 3], ['Highly experienced', 5]] },
  { id: 8, text: 'How important is retirement planning today?', options: [['Not a priority', 1], ['Important', 3], ['Core priority', 5]] },
  { id: 9, text: 'Which SIP frequency would you prefer?', options: [['No SIP', 1], ['Monthly SIP', 3], ['Weekly or flexible SIP', 5]] },
  { id: 10, text: 'How much liquidity do you need from investments?', options: [['Immediate access', 1], ['Some access', 3], ['Long-term lock-in is acceptable', 5]] }
];

const uploadDocuments = [
  { key: 'pan', label: 'PAN Card', testId: 'pan-upload', inputTestId: 'upload-pan' },
  { key: 'aadhaar', label: 'Aadhaar Card', testId: 'aadhaar-upload', inputTestId: 'upload-aadhaar' },
  { key: 'cheque', label: 'Cancelled Cheque', testId: 'cheque-upload', inputTestId: 'upload-cheque' },
  { key: 'photo', label: 'Passport Size Photograph', testId: 'photo-upload', inputTestId: 'upload-photo' },
  { key: 'statement', label: 'Bank Statement', testId: 'statement-upload', inputTestId: 'upload-statement' }
];

function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionKey) || '{}');
    return {
      username: session.username || localStorage.getItem('username') || '',
      role: session.role || localStorage.getItem('userRole') || ''
    };
  } catch (error) {
    return { username: localStorage.getItem('username') || '', role: localStorage.getItem('userRole') || '' };
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function generateInvestorId() {
  const sequence = String(Date.now()).slice(-4);
  return `INV2026${sequence}`;
}

function saveDraft() {
  localStorage.setItem(draftKey, JSON.stringify(onboardingData));
  const status = document.getElementById('draft-status');
  if (status) status.textContent = `Draft saved ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function restoreDraft() {
  const stored = localStorage.getItem(draftKey);
  if (!stored) return;
  try {
    const draft = JSON.parse(stored);
    Object.assign(onboardingData.personal, draft.personal || {});
    Object.assign(onboardingData.address.current, draft.address?.current || {});
    Object.assign(onboardingData.address.permanent, draft.address?.permanent || {});
    Object.assign(onboardingData.financial, draft.financial || {});
    Object.assign(onboardingData.risk, draft.risk || {});
    Object.assign(onboardingData.documents, draft.documents || {});
    populateFormFromState();
  } catch (error) {
    localStorage.removeItem(draftKey);
  }
}

function setFieldValue(id, value) {
  const field = document.getElementById(id);
  if (field && value !== undefined && value !== null) field.value = value;
}

function setChecked(name, values) {
  const selected = Array.isArray(values) ? values : [values];
  document.querySelectorAll(`[name="${name}"]`).forEach((input) => {
    input.checked = selected.includes(input.value);
  });
}

function populateFormFromState() {
  Object.entries(onboardingData.personal).forEach(([key, value]) => setFieldValue(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value));
  Object.entries(onboardingData.address.current).forEach(([key, value]) => setFieldValue(`current-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value));
  Object.entries(onboardingData.address.permanent).forEach(([key, value]) => setFieldValue(`permanent-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value));
  Object.entries(onboardingData.financial).forEach(([key, value]) => {
    if (Array.isArray(value)) setChecked(key === 'wealthSource' ? 'wealthSource' : 'objective', value);
    else setFieldValue(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value);
  });
  setChecked('gender', onboardingData.personal.gender);
  setChecked('investmentExperience', onboardingData.financial.investmentExperience);
  Object.entries(onboardingData.risk.answers || {}).forEach(([questionId, value]) => {
    const input = document.querySelector(`[name="risk-${questionId}"][value="${value}"]`);
    if (input) input.checked = true;
  });
  const sameAddress = document.getElementById('same-address');
  if (sameAddress && onboardingData.address.sameAsCurrent) {
    sameAddress.checked = true;
    copyCurrentToPermanent();
  }
  renderUploadCards();
  calculateRisk();
  renderReview();
}

function collectPersonal() {
  const fields = ['investorId', 'firstName', 'middleName', 'lastName', 'dob', 'mobile', 'email', 'pan', 'aadhaar', 'maritalStatus', 'nationality', 'occupation'];
  fields.forEach((key) => {
    const element = document.getElementById(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    if (element) onboardingData.personal[key] = element.value.trim();
  });
  const gender = document.querySelector('input[name="gender"]:checked');
  onboardingData.personal.gender = gender ? gender.value : '';
}

function collectAddresses() {
  ['current', 'permanent'].forEach((type) => {
    const values = {};
    document.querySelectorAll(`[data-address="${type}"]`).forEach((element) => {
      const key = element.name.replace(`${type}`, '').replace(/^./, (letter) => letter.toLowerCase());
      values[key] = element.value.trim();
    });
    onboardingData.address[type] = values;
  });
  onboardingData.address.sameAsCurrent = document.getElementById('same-address').checked;
}

function collectFinancial() {
  ['annualIncome', 'employmentType', 'monthlyInvestment', 'netWorth', 'nomineeName', 'nomineeRelationship', 'nomineeDob'].forEach((key) => {
    const element = document.getElementById(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
    if (element) onboardingData.financial[key] = element.value.trim();
  });
  onboardingData.financial.wealthSource = [...document.querySelectorAll('input[name="wealthSource"]:checked')].map((input) => input.value);
  onboardingData.financial.objective = [...document.querySelectorAll('input[name="objective"]:checked')].map((input) => input.value);
  const experience = document.querySelector('input[name="investmentExperience"]:checked');
  onboardingData.financial.investmentExperience = experience ? experience.value : '';
}

function collectCurrentState() {
  collectPersonal();
  collectAddresses();
  collectFinancial();
  saveDraft();
}

function setError(target, message) {
  const field = document.getElementById(target);
  const error = document.querySelector(`[data-error-for="${target}"]`);
  if (field) field.closest('.field')?.classList.toggle('invalid', Boolean(message));
  if (error) error.textContent = message || '';
}

function clearStepErrors(step) {
  document.querySelector(`[data-panel="${step}"]`)?.querySelectorAll('.field').forEach((field) => field.classList.remove('invalid'));
  document.querySelector(`[data-panel="${step}"]`)?.querySelectorAll('.field-error').forEach((error) => { error.textContent = ''; });
}

function validateRequiredField(id, message) {
  const value = document.getElementById(id)?.value.trim();
  if (!value) {
    setError(id, message);
    return false;
  }
  return true;
}

function validatePersonal() {
  clearStepErrors(1);
  collectPersonal();
  let valid = true;
  valid = validateRequiredField('first-name', 'First name is required.') && valid;
  valid = validateRequiredField('last-name', 'Last name is required.') && valid;
  const checks = [
    ['dob', OnboardingValidation.validateDOB(onboardingData.personal.dob)],
    ['mobile', OnboardingValidation.validatePhone(onboardingData.personal.mobile)],
    ['email', OnboardingValidation.validateEmail(onboardingData.personal.email)],
    ['pan', OnboardingValidation.validatePAN(onboardingData.personal.pan)],
    ['aadhaar', OnboardingValidation.validateAadhaar(onboardingData.personal.aadhaar)]
  ];
  checks.forEach(([id, result]) => { if (!result.valid) { setError(id, result.message); valid = false; } });
  if (!document.querySelector('input[name="gender"]:checked')) { setError('gender', 'Select a gender.'); valid = false; }
  return valid;
}

function validateAddress() {
  clearStepErrors(2);
  collectAddresses();
  let valid = true;
  ['current-line1', 'current-city', 'current-state', 'permanent-line1', 'permanent-city', 'permanent-state'].forEach((id) => {
    valid = validateRequiredField(id, 'This field is required.') && valid;
  });
  ['current-pincode', 'permanent-pincode'].forEach((id) => {
    const result = OnboardingValidation.validatePincode(document.getElementById(id).value);
    if (!result.valid) { setError(id, result.message); valid = false; }
  });
  return valid;
}

function validateFinancial() {
  clearStepErrors(3);
  collectFinancial();
  let valid = true;
  ['annual-income', 'employment-type', 'nominee-name', 'nominee-relationship'].forEach((id) => { valid = validateRequiredField(id, 'This field is required.') && valid; });
  if (!onboardingData.financial.wealthSource.length) { setError('wealth-source', 'Select at least one source of wealth.'); valid = false; }
  if (!onboardingData.financial.objective.length) { setError('objective', 'Select at least one investment objective.'); valid = false; }
  if (!onboardingData.financial.investmentExperience) { setError('investment-experience', 'Select investment experience.'); valid = false; }
  const amountResult = OnboardingValidation.validateCurrency(onboardingData.financial.monthlyInvestment, 500);
  if (!amountResult.valid) { setError('monthly-investment', amountResult.message); valid = false; }
  return valid;
}

function validateRisk() {
  const unanswered = riskQuestions.find((question) => !onboardingData.risk.answers[question.id]);
  if (unanswered) {
    showToast(`Please answer risk question ${unanswered.id}.`, 'error');
    document.querySelector(`[data-testid="risk-question-${unanswered.id}"]`)?.classList.add('shake');
    return false;
  }
  return true;
}

function validateDocuments() {
  const missing = uploadDocuments.find((document) => !onboardingData.documents[document.key]);
  if (missing) {
    showToast(`Upload ${missing.label} before continuing.`, 'error');
    return false;
  }
  return true;
}

function validateStep(step) {
  if (step === 1) return validatePersonal();
  if (step === 2) return validateAddress();
  if (step === 3) return validateFinancial();
  if (step === 4) return validateRisk();
  if (step === 5) return validateDocuments();
  return true;
}

function updateStepper() {
  document.querySelectorAll('.step').forEach((step) => {
    const number = Number(step.dataset.step);
    step.classList.toggle('active', number === currentStep);
    step.classList.toggle('complete', number < currentStep);
    step.disabled = number >= currentStep;
  });
  document.querySelectorAll('.wizard-step').forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.panel) === currentStep));
  document.getElementById('previous-button').disabled = currentStep === 1;
  document.getElementById('next-button').classList.toggle('hidden', currentStep === totalSteps);
  document.getElementById('submit-onboarding').classList.toggle('hidden', currentStep !== totalSteps);
  document.getElementById('submit-onboarding').disabled = !document.getElementById('declaration').checked;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToStep(step) {
  if (step > currentStep) return;
  currentStep = step;
  updateStepper();
  if (step === 6) renderReview();
}

function nextStep() {
  collectCurrentState();
  if (!validateStep(currentStep)) {
    document.querySelector(`[data-panel="${currentStep}"]`)?.classList.add('shake');
    return;
  }
  if (currentStep < totalSteps) {
    currentStep += 1;
    updateStepper();
    if (currentStep === 4) calculateRisk();
    if (currentStep === 5) renderUploadCards();
    if (currentStep === 6) renderReview();
  }
}

function copyCurrentToPermanent() {
  ['line1', 'line2', 'city', 'state', 'pincode', 'country'].forEach((key) => {
    const source = document.getElementById(`current-${key}`);
    const target = document.getElementById(`permanent-${key}`);
    if (source && target) target.value = source.value;
  });
  collectAddresses();
  saveDraft();
}

function lookupPincode(input) {
  const match = pincodeMap[input.value.trim()];
  if (!match) return;
  const prefix = input.id.startsWith('current') ? 'current' : 'permanent';
  setFieldValue(`${prefix}-city`, match.city);
  setFieldValue(`${prefix}-state`, match.state);
  if (document.getElementById('same-address').checked && prefix === 'current') copyCurrentToPermanent();
  collectAddresses();
  saveDraft();
}

function renderRiskQuestions() {
  const container = document.getElementById('risk-questions');
  container.innerHTML = riskQuestions.map((question) => `<article class="risk-question" data-testid="risk-question-${question.id}"><h3>${question.id}. ${question.text}</h3><div class="risk-options">${question.options.map(([label, score]) => `<label class="risk-option"><input type="radio" name="risk-${question.id}" value="${score}" data-testid="risk-question-${question.id}-option-${score}" /> ${label}</label>`).join('')}</div></article>`).join('');
  container.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    const questionId = Number(event.target.name.replace('risk-', ''));
    onboardingData.risk.answers[questionId] = Number(event.target.value);
    calculateRisk();
    saveDraft();
  });
}

function calculateRisk() {
  const values = Object.values(onboardingData.risk.answers);
  const score = values.reduce((total, value) => total + Number(value), 0);
  const profile = score <= 20 ? 'Conservative' : score <= 35 ? 'Moderate' : 'Aggressive';
  onboardingData.risk.score = score;
  onboardingData.risk.profile = values.length === 10 ? profile : 'Not assessed';
  document.getElementById('risk-score-value').textContent = score;
  document.getElementById('risk-profile-label').textContent = onboardingData.risk.profile;
  document.getElementById('risk-progress').style.width = `${Math.min((values.length / 10) * 100, 100)}%`;
}

function renderUploadCards() {
  const container = document.getElementById('upload-grid');
  container.innerHTML = uploadDocuments.map((document) => `<article class="upload-card" data-testid="${document.testId}" data-upload-key="${document.key}"><h3>${document.label}</h3><p>PDF, PNG or JPEG · max 5 MB</p><div class="upload-drop" data-drop-zone="${document.key}">Drag and drop file here<br /><label class="browse-button" for="${document.inputTestId}">Browse file</label><input class="upload-input" id="${document.inputTestId}" data-testid="${document.inputTestId}" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" /></div><div class="upload-progress hidden" data-upload-progress="${document.key}"><span></span></div><div class="file-result hidden" data-file-result="${document.key}"></div></article>`).join('');
  uploadDocuments.forEach((document) => {
    const card = container.querySelector(`[data-upload-key="${document.key}"]`);
    const input = card.querySelector('input');
    const dropZone = card.querySelector('[data-drop-zone]');
    input.addEventListener('change', () => handleFile(input.files[0], document.key, card));
    ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); card.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); card.classList.remove('dragging'); }));
    dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0], document.key, card));
    renderExistingFile(document.key, card);
  });
}

function handleFile(file, key, card) {
  if (!file) return;
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) {
    showToast('Use a PDF, PNG, or JPEG file up to 5 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  const progress = card.querySelector(`[data-upload-progress="${key}"]`);
  const progressBar = progress?.querySelector('span');
  progress?.classList.remove('hidden');
  reader.onprogress = (event) => {
    if (event.lengthComputable && progressBar) progressBar.style.width = `${(event.loaded / event.total) * 100}%`;
  };
  reader.onload = () => {
    if (progressBar) progressBar.style.width = '100%';
    onboardingData.documents[key] = { name: file.name, size: file.size, type: file.type, preview: reader.result.slice(0, 80) };
    renderExistingFile(key, card);
    saveDraft();
    showToast(`${file.name} uploaded successfully.`, 'success');
  };
  reader.readAsDataURL(file);
}

function renderExistingFile(key, card) {
  const result = card.querySelector(`[data-file-result="${key}"]`);
  const file = onboardingData.documents[key];
  if (!file) { result.classList.add('hidden'); result.innerHTML = ''; return; }
  result.classList.remove('hidden');
  result.innerHTML = `<span>${file.name} · ${(file.size / 1024).toFixed(1)} KB</span><button type="button" class="remove-file" data-remove-file="${key}">Remove</button>`;
  result.querySelector('button').addEventListener('click', () => { delete onboardingData.documents[key]; renderExistingFile(key, card); saveDraft(); });
}

function reviewValue(value) {
  return value || 'Not provided';
}

function renderReview() {
  const container = document.getElementById('review-section');
  const p = onboardingData.personal;
  const a = onboardingData.address;
  const f = onboardingData.financial;
  const cards = [
    { key: 'personal', title: 'Personal Information', rows: [['Investor ID', p.investorId], ['Name', `${p.firstName || ''} ${p.middleName || ''} ${p.lastName || ''}`], ['PAN', p.pan], ['Mobile', p.mobile], ['Email', p.email]] },
    { key: 'address', title: 'Address', rows: [['Current', `${a.current.line1 || ''}, ${a.current.city || ''}, ${a.current.state || ''}`], ['Permanent', `${a.permanent.line1 || ''}, ${a.permanent.city || ''}, ${a.permanent.state || ''}`], ['Pincode', a.current.pincode]] },
    { key: 'financial', title: 'Financial Details', rows: [['Income', f.annualIncome], ['Investment', f.monthlyInvestment ? `₹${Number(f.monthlyInvestment).toLocaleString('en-IN')}` : ''], ['Objectives', f.objective?.join(', ')], ['Nominee', f.nomineeName]] },
    { key: 'risk', title: 'Risk Profile', rows: [['Score', onboardingData.risk.score], ['Profile', onboardingData.risk.profile]] },
    { key: 'documents', title: 'Uploaded Documents', rows: uploadDocuments.map((document) => [document.label, onboardingData.documents[document.key]?.name]) }
  ];
  container.innerHTML = cards.map((card) => `<article class="review-card"><h3>${card.title}<button type="button" class="edit-section" data-edit-step="${card.key}">Edit</button></h3>${card.rows.map(([label, value]) => `<div class="review-row"><span>${label}</span><strong>${reviewValue(value)}</strong></div>`).join('')}</article>`).join('');
  container.querySelectorAll('[data-edit-step]').forEach((button) => button.addEventListener('click', () => goToStep({ personal: 1, address: 2, financial: 3, risk: 4, documents: 5 }[button.dataset.editStep])));
}

function submitOnboarding() {
  collectCurrentState();
  if (!document.getElementById('declaration').checked) return;
  const timestamp = new Date().toISOString();
  const folio = `FV${new Date().getFullYear()}${String(Math.floor(100000 + Math.random() * 900000))}`;
  const completed = { ...onboardingData, submittedAt: timestamp, folioNumber: folio };
  localStorage.setItem('finverse-completed-onboarding', JSON.stringify(completed));
  localStorage.removeItem(draftKey);
  document.getElementById('success-investor-id').textContent = onboardingData.personal.investorId;
  document.getElementById('success-folio').textContent = folio;
  document.getElementById('success-timestamp').textContent = new Date(timestamp).toLocaleString('en-IN');
  document.getElementById('success-modal').classList.remove('hidden');
}

function setupSession() {
  const session = getSession();
  if (!session.username) { window.location.href = 'index.html'; return false; }
  ['rm-name', 'profile-name'].forEach((id) => { document.getElementById(id).textContent = session.username; });
  ['rm-role', 'profile-role'].forEach((id) => { document.getElementById(id).textContent = session.role || 'Relationship Manager'; });
  ['rm-avatar', 'profile-avatar'].forEach((id) => { document.getElementById(id).textContent = session.username.charAt(0).toUpperCase(); });
  return true;
}

function setupEvents() {
  document.getElementById('next-button').addEventListener('click', nextStep);
  document.getElementById('previous-button').addEventListener('click', () => goToStep(Math.max(1, currentStep - 1)));
  document.getElementById('onboarding-form').addEventListener('submit', (event) => { event.preventDefault(); submitOnboarding(); });
  document.getElementById('declaration').addEventListener('change', updateStepper);
  document.querySelectorAll('.step').forEach((step) => step.addEventListener('click', () => goToStep(Number(step.dataset.step))));
  document.querySelectorAll('input, select').forEach((field) => field.addEventListener('change', collectCurrentState));
  document.getElementById('pan').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase(); });
  document.getElementById('aadhaar').addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 12).replace(/(.{4})/g, '$1 ').trim(); });
  ['mobile', 'current-pincode', 'permanent-pincode'].forEach((id) => document.getElementById(id).addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D/g, ''); }));
  ['current-pincode', 'permanent-pincode'].forEach((id) => document.getElementById(id).addEventListener('input', (event) => lookupPincode(event.target)));
  document.getElementById('same-address').addEventListener('change', (event) => { if (event.target.checked) copyCurrentToPermanent(); });
  document.querySelectorAll('.logout-button, #profile-logout').forEach((button) => button.addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; }));
  document.querySelector('[data-testid="profile-menu"]').addEventListener('click', () => document.querySelector('.profile-dropdown').classList.toggle('hidden'));
  document.getElementById('dashboard-button').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
  document.getElementById('view-profile-button').addEventListener('click', () => showToast('Client profile view is ready for the next workflow.', 'success'));
}

function initialize() {
  if (!setupSession()) return;
  setFieldValue('investor-id', generateInvestorId());
  document.getElementById('nationality').value = 'Indian';
  renderRiskQuestions();
  renderUploadCards();
  restoreDraft();
  setupEvents();
  updateStepper();
}

document.addEventListener('DOMContentLoaded', initialize);
