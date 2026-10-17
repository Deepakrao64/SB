(() => {
  'use strict';

  const STORAGE = {
    session: 'finverse-user-session',
    orders: 'finverseOrders',
    context: 'finverseTradeContext'
  };
  const NAV_DATE = '2026-10-15';
  const PAGE_SIZE = 8;
  const UNIT_PRECISION = 4;
  // Redemption may exceed stored units only by this documented decimal-rounding tolerance.
  const UNIT_TOLERANCE = 0.0001;
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatMoney = value => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(Number(value) || 0);
  const formatUnits = value => Number(value || 0).toFixed(UNIT_PRECISION);
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(date);
  };
  const formatTimestamp = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };
  const futureDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  const investors = [
    {
      id: 'INV2026001', name: 'Ananya Mehta', type: 'Individual', risk: 'Moderate', kyc: 'Verified',
      cash: 250000, folios: [
        { number: 'FOLIO10001', mode: 'Single', mandate: 'Active', bank: 'HDFC Bank •••• 4421', holdings: [{ code: 'PPFCF', units: 125.5, daysHeld: 120 }, { code: 'AXISBC', units: 320, daysHeld: 420 }] },
        { number: 'FOLIO10002', mode: 'Joint', mandate: 'Active', bank: 'ICICI Bank •••• 9082', holdings: [{ code: 'ICIN50', units: 210, daysHeld: 520 }, { code: 'SBILIQ', units: 10.5, daysHeld: 22 }] }
      ]
    },
    {
      id: 'INV2026002', name: 'Rohan Iyer', type: 'Individual', risk: 'Conservative', kyc: 'Verified',
      cash: 175000, folios: [
        { number: 'FOLIO20001', mode: 'Single', mandate: 'Active', bank: 'Axis Bank •••• 3816', holdings: [{ code: 'HDBAF', units: 85, daysHeld: 210 }, { code: 'SBILIQ', units: 12, daysHeld: 14 }] },
        { number: 'FOLIO20002', mode: 'Single', mandate: 'Pending', bank: 'Mandate registration pending', holdings: [{ code: 'PPCON', units: 300, daysHeld: 800 }] }
      ]
    },
    {
      id: 'INV2026003', name: 'Kavya Nair', type: 'HUF', risk: 'Growth', kyc: 'Pending',
      cash: 420000, folios: [
        { number: 'FOLIO30001', mode: 'HUF', mandate: 'Active', bank: 'SBI •••• 7639', holdings: [{ code: 'MOMID', units: 95, daysHeld: 65 }, { code: 'NIPGRO', units: 44, daysHeld: 460 }] },
        { number: 'FOLIO30002', mode: 'HUF', mandate: 'Inactive', bank: 'Mandate inactive', holdings: [{ code: 'AXLIQ', units: 8, daysHeld: 35 }] }
      ]
    }
  ];
  const userAccounts = { deepak: 'INV2026001', rm01: 'INV2026001', admin: 'INV2026001', comp01: 'INV2026003' };
  const schemes = typeof mockFunds !== 'undefined' && Array.isArray(mockFunds) ? mockFunds.map(fund => ({
    ...fund,
    navDate: NAV_DATE,
    minimumInitial: Number(fund.minimumLumpsum) || 100,
    minimumAdditional: Number(fund.minimumLumpsum) || 100,
    minimumSip: Number(fund.minimumSip) || 100,
    eligible: fund.eligible !== false,
    option: fund.option || 'Growth'
  })) : [];

  const session = readJSON(STORAGE.session, { username: 'deepak', role: 'Investor' });
  const role = typeof session?.role === 'string' ? session.role : 'Investor';
  const username = typeof session?.username === 'string' ? session.username : 'deepak';
  const canSelectInvestor = role === 'Relationship Manager' || role === 'Admin';
  const canReviewAllOrders = canSelectInvestor;
  const canApproveOrders = canSelectInvestor;
  const permittedInvestorId = userAccounts[username] || investors[0].id;
  let selectedInvestor = investors.find(item => item.id === permittedInvestorId) || investors[0];
  let selectedFolio = selectedInvestor.folios[0];
  let selectedScheme = null;
  let transactionType = 'purchase';
  let currentPage = 1;
  let newestFirst = true;
  let reviewSnapshot = null;
  let submitting = false;
  let showValidation = false;
  const formValues = Object.create(null);
  let orders = [];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`FinVerse Trade Center could not read ${key}; using safe defaults.`, error);
      return fallback;
    }
  }

  function persistOrders() {
    try {
      localStorage.setItem(STORAGE.orders, JSON.stringify(orders));
      return true;
    } catch (error) {
      console.error('FinVerse Trade Center could not save order data.', error);
      showToast('Order data could not be saved in this browser. Check storage availability and try again.', true);
      return false;
    }
  }

  function persistContext() {
    try {
      localStorage.setItem(STORAGE.context, JSON.stringify({
        investorId: selectedInvestor.id,
        folio: selectedFolio.number
      }));
    } catch (error) {
      console.error('FinVerse Trade Center could not save account context.', error);
      showToast('Account selection could not be saved in this browser.', true);
    }
  }

  function getScheme(code) {
    return schemes.find(scheme => scheme.code === code) || null;
  }

  function getHolding(folio, code) {
    return folio?.holdings.find(holding => holding.code === code) || null;
  }

  function exitLoadFor(scheme, holding) {
    if (!scheme || !holding) return { rate: 0, description: 'No holding selected' };
    const text = String(scheme.exitLoad || '').toLowerCase();
    if (text.includes('3 year lock-in') && holding.daysHeld < 1095) {
      return { rate: 0, locked: true, description: 'Mock ELSS lock-in applies' };
    }
    const rateMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (!rateMatch) return { rate: 0, description: 'No exit load configured' };
    const percent = Number(rateMatch[1]);
    const daysMatch = text.match(/(\d+)\s*days?/);
    const durationDays = daysMatch ? Number(daysMatch[1]) : text.includes('1 year') ? 365 : 365;
    const active = holding.daysHeld < durationDays;
    return {
      rate: active ? percent / 100 : 0,
      description: active ? `${percent}% within ${durationDays} days (mock scheme rule)` : 'No exit load at this holding age (mock rule)'
    };
  }

  function normalizeStatus(status) {
    const known = ['Submitted', 'Pending Approval', 'Accepted', 'Rejected', 'Cancelled'];
    if (known.includes(status)) return status;
    if (status === 'Processing') return 'Pending Approval';
    if (status === 'Completed') return 'Accepted';
    return 'Submitted';
  }

  function normalizeLegacyOrder(order) {
    if (!order || typeof order !== 'object' || typeof order.id !== 'string') return null;
    const legacyScheme = getScheme(order.code) || schemes.find(item => item.name === order.fund);
    const investor = investors.find(item => item.id === order.investor?.id) || investors[0];
    const folio = investor.folios.find(item => item.number === order.folio?.number) || investor.folios[0];
    const dateOnly = typeof order.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(order.date) ? order.date : NAV_DATE;
    const submittedAt = typeof order.submittedAt === 'string' && !Number.isNaN(Date.parse(order.submittedAt))
      ? order.submittedAt
      : `${dateOnly}T00:00:00.000Z`;
    const typeMap = { Buy: 'Purchase', Sell: 'Redemption', SIP: 'SIP Registration' };
    const status = normalizeStatus(order.status);
    const snapshot = order.snapshot || {
      investor: { id: investor.id, name: investor.name, type: investor.type, risk: investor.risk, kyc: investor.kyc },
      folio: { number: folio.number, mode: folio.mode, bank: folio.bank, mandate: folio.mandate },
      scheme: legacyScheme ? schemeSnapshot(legacyScheme) : { code: order.code || '', name: order.fund || 'Legacy order', category: '—', risk: '—', nav: 0, navDate: NAV_DATE, exitLoad: 'Not captured' },
      transactionType: typeMap[order.type] || order.type || 'Purchase',
      amount: Number(order.amount) || 0,
      units: Number(order.units) || 0,
      redemptionMode: order.units ? 'units' : 'amount',
      calculation: { investmentAmount: Number(order.amount) || 0, charges: 0, totalDebit: Number(order.amount) || 0, grossValue: Number(order.amount) || 0, exitLoad: 0, netProceeds: Number(order.amount) || 0, estimatedUnits: Number(order.units) || 0 }
    };
    const history = Array.isArray(order.history) && order.history.length
      ? order.history
      : [{ status, at: submittedAt, actor: 'Legacy demo data', note: 'Imported from the previous Trade Center order list; unavailable details were not reconstructed.' }];
    return {
      id: order.id,
      status,
      submittedAt,
      investorId: snapshot.investor?.id || investor.id,
      folioNumber: snapshot.folio?.number || folio.number,
      snapshot,
      history,
    };
  }

  function loadOrders() {
    const stored = readJSON(STORAGE.orders, []);
    if (!Array.isArray(stored)) {
      console.warn('FinVerse Trade Center order data was not an array; starting with an empty order book.');
      orders = [];
      return;
    }
    orders = stored.map(normalizeLegacyOrder).filter(Boolean);
    if (JSON.stringify(stored) !== JSON.stringify(orders)) persistOrders();
  }

  function schemeSnapshot(scheme) {
    return {
      code: scheme.code,
      name: scheme.name,
      amc: scheme.amc,
      category: scheme.category,
      option: scheme.option,
      risk: scheme.risk,
      nav: Number(scheme.nav),
      navDate: scheme.navDate,
      minimumInitial: scheme.minimumInitial,
      minimumAdditional: scheme.minimumAdditional,
      minimumSip: scheme.minimumSip,
      exitLoad: scheme.exitLoad,
      eligible: scheme.eligible
    };
  }

  function restoreContext() {
    const saved = readJSON(STORAGE.context, null);
    if (!canSelectInvestor) return;
    const investor = investors.find(item => item.id === saved?.investorId);
    if (!investor) return;
    selectedInvestor = investor;
    selectedFolio = investor.folios.find(item => item.number === saved.folio) || investor.folios[0];
  }

  function renderIdentity() {
    const displayName = role === 'Investor' ? selectedInvestor.name : username;
    const labelName = role === 'Admin' ? 'Administrator' : role;
    $('#sidebar-name').textContent = displayName;
    $('#sidebar-role').textContent = role;
    $('#profile-name').textContent = displayName;
    $('#profile-role').textContent = labelName;
    $('#sidebar-avatar').textContent = displayName.slice(0, 1).toUpperCase();
    $('#profile-avatar').textContent = displayName.slice(0, 1).toUpperCase();
    $('#investor-control').classList.toggle('hidden', !canSelectInvestor);
    $('#investor-select').disabled = !canSelectInvestor;
    renderInvestorOptions();
  }

  function renderInvestorOptions() {
    $('#investor-select').innerHTML = investors.map(investor =>
      `<option value="${escapeHTML(investor.id)}">${escapeHTML(investor.name)} · ${escapeHTML(investor.id)}</option>`
    ).join('');
    $('#investor-select').value = selectedInvestor.id;
  }

  function renderAccount() {
    const folioSelect = $('#folio-select');
    folioSelect.innerHTML = selectedInvestor.folios.map(folio =>
      `<option value="${escapeHTML(folio.number)}">${escapeHTML(folio.number)} · ${escapeHTML(folio.mode)}</option>`
    ).join('');
    folioSelect.value = selectedFolio.number;
    folioSelect.disabled = selectedInvestor.folios.length < 2;
    $('#context-investor-id').textContent = selectedInvestor.id;
    $('#context-kyc').textContent = selectedInvestor.kyc;
    $('#context-kyc').className = selectedInvestor.kyc === 'Verified' ? 'fact-good' : 'fact-bad';
    $('#context-holding-mode').textContent = selectedFolio.mode;
    $('#context-mandate').textContent = selectedFolio.mandate;
    $('#context-mandate').className = selectedFolio.mandate === 'Active' ? 'fact-good' : 'fact-bad';
    $('#payment-details').innerHTML = `
      <div class="payment-fact"><small>Registered bank mandate</small><strong>${escapeHTML(selectedFolio.bank)}</strong></div>
      <div class="payment-fact"><small>Mandate status</small><strong class="${selectedFolio.mandate === 'Active' ? 'fact-good' : 'fact-bad'}">${escapeHTML(selectedFolio.mandate)}</strong></div>`;
    renderEligibility();
    renderCalculation();
  }

  function savedValue(key, fallback = '') {
    return formValues[`${transactionType}:${key}`] ?? fallback;
  }

  function fieldMarkup({ key, label, type = 'text', value = '', options = null, min = null, step = null, testId = null, hint = null }) {
    const id = `field-${key}`;
    if (options) {
      return `<label class="control-field" for="${id}">${escapeHTML(label)}<select id="${id}" data-value-key="${escapeHTML(key)}" ${testId ? `data-testid="${escapeHTML(testId)}"` : ''}>${options.map(option =>
        `<option value="${escapeHTML(option.value)}" ${String(value) === String(option.value) ? 'selected' : ''}>${escapeHTML(option.label)}</option>`
      ).join('')}</select></label>`;
    }
    return `<label class="control-field" for="${id}">${escapeHTML(label)}<input id="${id}" data-value-key="${escapeHTML(key)}" type="${escapeHTML(type)}" ${min !== null ? `min="${escapeHTML(min)}"` : ''} ${step !== null ? `step="${escapeHTML(step)}"` : ''} value="${escapeHTML(value)}" ${testId ? `data-testid="${escapeHTML(testId)}"` : ''} /></label>${hint ? `<p class="field-hint">${escapeHTML(hint)}</p>` : ''}`;
  }

  function renderTransactionFields() {
    const fields = $('#transaction-fields');
    if (transactionType === 'redemption') {
      const mode = savedValue('redemptionMode', 'amount');
      const held = getHolding(selectedFolio, selectedScheme?.code);
      const choices = [
        { value: 'amount', label: 'By amount' },
        { value: 'units', label: 'By units' },
        { value: 'full', label: 'Full available holding' }
      ];
      fields.innerHTML = `
        ${fieldMarkup({ key: 'redemptionMode', label: 'Redemption mode', options: choices, value: mode, testId: 'redemption-mode' })}
        ${mode !== 'full' ? fieldMarkup({
          key: 'redemptionValue',
          label: mode === 'units' ? 'Units to redeem' : 'Redemption amount',
          type: 'number',
          value: savedValue('redemptionValue'),
          min: '0',
          step: mode === 'units' ? '0.0001' : '0.01',
          testId: mode === 'units' ? 'redemption-units' : 'order-amount'
        }) : '<p class="field-hint">All currently available units in this folio will be included.</p>'}
        <p class="field-hint" id="holding-context">${held && selectedScheme ? `Available: ${formatUnits(held.units)} units · indicative value ${formatMoney(held.units * selectedScheme.nav)} · held ${held.daysHeld} days` : 'Select a scheme held in this folio to view available units.'} Unit precision is four decimals; rounding tolerance is 0.0001 units.</p>`;
    } else if (transactionType === 'sip') {
      fields.innerHTML = `
        ${fieldMarkup({ key: 'amount', label: 'Installment amount', type: 'number', value: savedValue('amount'), min: '0', step: '0.01', testId: 'order-amount' })}
        ${fieldMarkup({ key: 'frequency', label: 'Frequency', options: [{ value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }], value: savedValue('frequency', 'Monthly'), testId: 'sip-frequency' })}
        ${fieldMarkup({ key: 'startDate', label: 'Start date', type: 'date', value: savedValue('startDate', futureDate()), min: futureDate(), testId: 'sip-start-date' })}
        ${fieldMarkup({ key: 'duration', label: 'Duration', options: [6, 12, 24, 36].map(months => ({ value: months, label: `${months} months` })), value: savedValue('duration', 12), testId: 'sip-duration' })}
        <p class="field-hint">A SIP creates a recurring instruction; its planned total is not debited now.</p>`;
    } else {
      const minimum = selectedScheme
        ? (transactionType === 'additional' ? selectedScheme.minimumAdditional : selectedScheme.minimumInitial)
        : 0;
      fields.innerHTML = `
        ${fieldMarkup({ key: 'amount', label: 'Investment amount', type: 'number', value: savedValue('amount'), min: String(minimum), step: '0.01', testId: 'order-amount' })}
        <p class="field-hint">${selectedScheme ? `${transactionType === 'additional' ? 'Additional' : 'Initial'} investment minimum: ${formatMoney(minimum)}.` : 'Select a scheme to view its minimum investment.'}</p>`;
    }
    fields.querySelectorAll('[data-value-key]').forEach(field => {
      field.addEventListener('input', () => {
        formValues[`${transactionType}:${field.dataset.valueKey}`] = field.value;
        renderEligibility();
        renderCalculation();
        if (showValidation) validateOrder();
      });
      field.addEventListener('change', () => {
        formValues[`${transactionType}:${field.dataset.valueKey}`] = field.value;
        if (transactionType === 'redemption' && field.dataset.valueKey === 'redemptionMode') {
          delete formValues[`${transactionType}:redemptionValue`];
          renderTransactionFields();
        }
        renderEligibility();
        renderCalculation();
        if (showValidation) validateOrder();
      });
    });
    renderEligibility();
    renderCalculation();
  }

  function getFormValue(key) {
    const field = $(`[data-value-key="${key}"]`, $('#transaction-fields'));
    return field ? field.value : savedValue(key);
  }

  function getRedemptionMode() {
    return transactionType === 'redemption' ? (getFormValue('redemptionMode') || 'amount') : null;
  }

  function calculateOrder() {
    if (!selectedScheme) return null;
    const scheme = selectedScheme;
    const calculation = {
      charges: 0,
      totalDebit: 0,
      grossValue: 0,
      exitLoad: 0,
      netProceeds: 0,
      estimatedUnits: 0,
      plannedInstallments: 0,
      plannedContributionTotal: 0
    };
    if (transactionType === 'purchase' || transactionType === 'additional') {
      const amount = Number(getFormValue('amount')) || 0;
      calculation.investmentAmount = amount;
      // Demo charges are separate and currently zero, so the full investment amount buys units.
      calculation.charges = 0;
      calculation.totalDebit = amount;
      calculation.estimatedUnits = Math.floor((amount / scheme.nav + Number.EPSILON) * 10 ** UNIT_PRECISION) / 10 ** UNIT_PRECISION;
    } else if (transactionType === 'redemption') {
      const holding = getHolding(selectedFolio, scheme.code);
      if (!holding) return { ...calculation, redemptionMode: getRedemptionMode(), requestedUnits: 0 };
      const mode = getRedemptionMode();
      let requestedUnits = 0;
      if (mode === 'full') requestedUnits = holding.units;
      else if (mode === 'units') requestedUnits = Number(getFormValue('redemptionValue')) || 0;
      else {
        const amount = Number(getFormValue('redemptionValue')) || 0;
        requestedUnits = Math.floor((amount / scheme.nav + Number.EPSILON) * 10 ** UNIT_PRECISION) / 10 ** UNIT_PRECISION;
      }
      calculation.redemptionMode = mode;
      calculation.requestedUnits = requestedUnits;
      calculation.requestedAmount = mode === 'units' || mode === 'full' ? requestedUnits * scheme.nav : Number(getFormValue('redemptionValue')) || 0;
      calculation.grossValue = requestedUnits * scheme.nav;
      const exitLoad = exitLoadFor(scheme, holding);
      calculation.exitLoadRate = exitLoad.rate;
      calculation.exitLoadDescription = exitLoad.description;
      calculation.exitLoad = calculation.grossValue * exitLoad.rate;
      calculation.netProceeds = calculation.grossValue - calculation.exitLoad;
      calculation.estimatedUnits = requestedUnits;
    } else if (transactionType === 'sip') {
      const amount = Number(getFormValue('amount')) || 0;
      const duration = Number(getFormValue('duration')) || 12;
      const frequency = getFormValue('frequency') || 'Monthly';
      const plannedInstallments = frequency === 'Quarterly' ? Math.floor(duration / 3) : duration;
      calculation.investmentAmount = amount;
      calculation.frequency = frequency;
      calculation.startDate = getFormValue('startDate');
      calculation.durationMonths = duration;
      calculation.plannedInstallments = plannedInstallments;
      calculation.plannedContributionTotal = amount * plannedInstallments;
    }
    return calculation;
  }

  function renderCalculation() {
    const target = $('#calculation-content');
    const calculation = calculateOrder();
    if (!calculation) {
      target.innerHTML = '<p class="empty-summary">Select an eligible scheme and enter transaction details.</p>';
      return;
    }
    let rows = [];
    if (transactionType === 'purchase' || transactionType === 'additional') {
      rows = [
        ['Investment amount', formatMoney(calculation.investmentAmount)],
        ['Configured demo charges', formatMoney(calculation.charges)],
        ['Estimated total debit', formatMoney(calculation.totalDebit), 'total'],
        ['Mock NAV · ' + formatDate(selectedScheme.navDate), formatMoney(selectedScheme.nav)],
        ['Estimated units', formatUnits(calculation.estimatedUnits)]
      ];
    } else if (transactionType === 'redemption') {
      rows = [
        [calculation.redemptionMode === 'full' ? 'Redemption instruction' : 'Requested value', calculation.redemptionMode === 'full' ? 'Full available holding' : formatMoney(calculation.requestedAmount)],
        ['Requested units', formatUnits(calculation.requestedUnits)],
        ['Estimated gross value', formatMoney(calculation.grossValue)],
        ['Exit load · ' + calculation.exitLoadDescription, formatMoney(calculation.exitLoad)],
        ['Other demo charges', formatMoney(0)],
        ['Estimated net proceeds', formatMoney(calculation.netProceeds), 'total positive']
      ];
    } else {
      rows = [
        ['Installment amount', formatMoney(calculation.investmentAmount)],
        ['Frequency', calculation.frequency],
        ['Start date', calculation.startDate ? formatDate(calculation.startDate) : '—'],
        ['Planned installments', String(calculation.plannedInstallments)],
        ['Planned contribution total', formatMoney(calculation.plannedContributionTotal), 'total'],
        ['Immediate debit', formatMoney(0), 'positive']
      ];
    }
    target.innerHTML = `<div class="calc-table">${rows.map(([label, value, className = '']) =>
      `<div class="calc-row ${escapeHTML(className)}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`
    ).join('')}</div>`;
  }

  function checkResults() {
    const holding = getHolding(selectedFolio, selectedScheme?.code);
    const checks = [
      ['Investor and folio selected', Boolean(selectedInvestor && selectedFolio)],
      [`KYC verified (${selectedInvestor.kyc})`, selectedInvestor.kyc === 'Verified'],
      ['Eligible scheme selected', Boolean(selectedScheme?.eligible)],
      [transactionType === 'additional' ? 'Scheme held in selected folio' : 'Folio context confirmed', transactionType !== 'additional' || Boolean(holding)],
      [transactionType === 'redemption' ? 'Available holding confirmed' : transactionType === 'sip' ? 'Active bank mandate' : 'Purchase mandate active', transactionType === 'redemption' ? Boolean(holding) : selectedFolio.mandate === 'Active'],
      ['Order inputs meet configured limits', !showValidation || validateFieldsOnly()]
    ];
    return checks;
  }

  function validateFieldsOnly() {
    if (!selectedScheme) return false;
    if (transactionType === 'purchase' || transactionType === 'additional' || transactionType === 'sip') {
      const amount = Number(getFormValue('amount'));
      const minimum = transactionType === 'sip' ? selectedScheme.minimumSip : transactionType === 'additional' ? selectedScheme.minimumAdditional : selectedScheme.minimumInitial;
      if (!Number.isFinite(amount) || amount < minimum || amount > selectedInvestor.cash) return false;
      if (transactionType === 'sip') {
        const date = getFormValue('startDate');
        return Boolean(date && date >= futureDate() && ['6', '12', '24', '36'].includes(String(getFormValue('duration'))));
      }
      if (transactionType === 'additional' && !getHolding(selectedFolio, selectedScheme.code)) return false;
      return true;
    }
    const holding = getHolding(selectedFolio, selectedScheme.code);
    if (!holding || exitLoadFor(selectedScheme, holding).locked) return false;
    const mode = getRedemptionMode();
    const calculation = calculateOrder();
    if (mode === 'full') return holding.units > 0;
    if (mode === 'units') {
      const units = Number(getFormValue('redemptionValue'));
      return Number.isFinite(units) && units > 0 && units <= holding.units + UNIT_TOLERANCE;
    }
    const amount = Number(getFormValue('redemptionValue'));
    return Number.isFinite(amount) && amount > 0 && amount <= holding.units * selectedScheme.nav + UNIT_TOLERANCE && calculation.requestedUnits > 0;
  }

  function renderEligibility() {
    const list = $('#eligibility-list');
    const checks = checkResults();
    list.innerHTML = checks.map(([label, passed]) =>
      `<li class="${passed ? 'pass' : (showValidation ? 'fail' : '')}">${escapeHTML(label)}</li>`
    ).join('');
    const warning = selectedScheme && (
      (selectedInvestor.risk === 'Conservative' && ['High', 'Very High'].includes(selectedScheme.risk)) ||
      (selectedInvestor.risk === 'Moderate' && selectedScheme.risk === 'Very High')
    );
    $('#suitability-warning').classList.toggle('hidden', !warning);
    $('#suitability-warning').textContent = warning
      ? `${selectedScheme.risk}-risk scheme may not align with this ${selectedInvestor.risk} mock risk profile. Review suitability; this training warning is not regulatory advice.`
      : '';
  }

  function validateOrder() {
    const errors = [];
    if (!selectedInvestor || !selectedFolio) errors.push('Select an investor and folio.');
    if (!selectedScheme) errors.push('Select a mutual fund scheme.');
    if (selectedInvestor.kyc !== 'Verified') errors.push('Verified KYC is required for this simulated instruction.');
    if (selectedScheme && !selectedScheme.eligible) errors.push('This scheme is not eligible for simulated orders.');
    if (selectedScheme && selectedFolio.mandate !== 'Active' && transactionType !== 'redemption') {
      errors.push('An active registered bank mandate is required for this instruction.');
    }
    if (transactionType === 'additional' && selectedScheme && !getHolding(selectedFolio, selectedScheme.code)) {
      errors.push('Additional Purchase requires this scheme to be held in the selected folio.');
    }
    if (transactionType === 'purchase' || transactionType === 'additional' || transactionType === 'sip') {
      const amount = Number(getFormValue('amount'));
      const minimum = selectedScheme
        ? transactionType === 'sip' ? selectedScheme.minimumSip : transactionType === 'additional' ? selectedScheme.minimumAdditional : selectedScheme.minimumInitial
        : 0;
      if (!Number.isFinite(amount) || amount <= 0) errors.push('Enter an amount greater than zero.');
      else if (!/^\d+(\.\d{1,2})?$/.test(getFormValue('amount'))) errors.push('Use no more than two decimal places for the amount.');
      else if (amount < minimum) errors.push(`Amount is below the configured ${transactionType === 'sip' ? 'SIP' : 'investment'} minimum of ${formatMoney(minimum)}.`);
      if (amount > selectedInvestor.cash) errors.push(`Amount exceeds the mock available cash limit of ${formatMoney(selectedInvestor.cash)}.`);
      if (transactionType === 'sip') {
        const startDate = getFormValue('startDate');
        if (!startDate || startDate < futureDate()) errors.push('Choose a SIP start date from tomorrow onward.');
        if (!['6', '12', '24', '36'].includes(String(getFormValue('duration')))) errors.push('Choose a supported SIP duration.');
      }
    }
    if (transactionType === 'redemption') {
      const holding = getHolding(selectedFolio, selectedScheme?.code);
      if (!holding) errors.push('Redemption is available only for a scheme held in this folio.');
      else {
        const load = exitLoadFor(selectedScheme, holding);
        if (load.locked) errors.push('This holding is within the configured mock ELSS lock-in period.');
        const mode = getRedemptionMode();
        const calculation = calculateOrder();
        if (mode === 'full') {
          if (holding.units <= 0) errors.push('There are no available units to redeem.');
        } else if (mode === 'units') {
          const units = Number(getFormValue('redemptionValue'));
          if (!Number.isFinite(units) || units <= 0) errors.push('Enter redemption units greater than zero.');
          else if (!/^\d+(\.\d{1,4})?$/.test(getFormValue('redemptionValue'))) errors.push('Use up to four decimal places for units.');
          else if (units > holding.units + UNIT_TOLERANCE) errors.push(`Requested units exceed the available ${formatUnits(holding.units)} units.`);
        } else {
          const amountValue = getFormValue('redemptionValue');
          const amount = Number(amountValue);
          if (!Number.isFinite(amount) || amount <= 0) errors.push('Enter a redemption amount greater than zero.');
          else if (!/^\d+(\.\d{1,2})?$/.test(amountValue)) errors.push('Use no more than two decimal places for the redemption amount.');
          else if (amount > holding.units * selectedScheme.nav + UNIT_TOLERANCE) errors.push(`Requested amount exceeds the estimated holding value of ${formatMoney(holding.units * selectedScheme.nav)}.`);
          else if (calculation.requestedUnits <= 0) errors.push('The amount is below one redeemable unit at this mock NAV.');
        }
      }
    }
    $('#scheme-error').textContent = showValidation && !selectedScheme ? 'Select an eligible scheme from the search results.' : '';
    $('#transaction-error').textContent = showValidation && errors.length ? errors[0] : '';
    $('#form-alert').classList.toggle('hidden', !showValidation || errors.length === 0);
    $('#form-alert').textContent = errors.length ? [...new Set(errors)].join(' ') : '';
    renderEligibility();
    return errors.length === 0;
  }

  function renderSchemeSearch(query = '') {
    const target = $('#scheme-results');
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      target.classList.add('hidden');
      target.innerHTML = '';
      $('#scheme-search').setAttribute('aria-expanded', 'false');
      return;
    }
    const matches = schemes.filter(scheme =>
      scheme.name.toLowerCase().includes(normalized) || scheme.code.toLowerCase().includes(normalized)
    ).slice(0, 8);
    target.innerHTML = matches.length ? matches.map(scheme => `
      <button type="button" class="scheme-result" role="option" aria-selected="${selectedScheme?.code === scheme.code}" data-scheme-code="${escapeHTML(scheme.code)}">
        <strong>${escapeHTML(scheme.name)} (${escapeHTML(scheme.code)})</strong><span>${formatMoney(scheme.nav)}</span>
        <small>${escapeHTML(scheme.category)} · ${escapeHTML(scheme.risk)} risk · NAV dated ${formatDate(scheme.navDate)}</small>
      </button>`).join('') : '<div class="scheme-result"><strong>No matching schemes</strong><small>Search by scheme name or code.</small></div>';
    target.classList.remove('hidden');
    $('#scheme-search').setAttribute('aria-expanded', 'true');
  }

  function selectScheme(scheme) {
    selectedScheme = scheme;
    $('#scheme-search').value = scheme.name;
    $('#scheme-results').classList.add('hidden');
    $('#scheme-search').setAttribute('aria-expanded', 'false');
    const target = $('#selected-scheme');
    target.innerHTML = `
      <strong>${escapeHTML(scheme.name)} <span>(${escapeHTML(scheme.code)})</span></strong>
      <span>${escapeHTML(scheme.category)} · ${escapeHTML(scheme.option)} · ${escapeHTML(scheme.risk)} risk</span>
      <span>Mock NAV ${formatMoney(scheme.nav)} · ${formatDate(scheme.navDate)}</span>
      <span>Exit load: ${escapeHTML(scheme.exitLoad || 'None configured')}</span>`;
    target.classList.remove('hidden');
    renderTransactionFields();
    validateOrderIfVisible();
  }

  function validateOrderIfVisible() {
    if (showValidation) validateOrder();
    else renderEligibility();
  }

  function orderSnapshot() {
    const calculation = calculateOrder();
    return {
      investor: {
        id: selectedInvestor.id, name: selectedInvestor.name, type: selectedInvestor.type,
        risk: selectedInvestor.risk, kyc: selectedInvestor.kyc
      },
      folio: {
        number: selectedFolio.number, mode: selectedFolio.mode,
        mandate: selectedFolio.mandate, bank: selectedFolio.bank
      },
      scheme: schemeSnapshot(selectedScheme),
      transactionType,
      amount: transactionType === 'redemption'
        ? calculation.requestedAmount
        : calculation.investmentAmount,
      units: calculation.estimatedUnits,
      redemptionMode: calculation.redemptionMode || null,
      frequency: calculation.frequency || null,
      startDate: calculation.startDate || null,
      durationMonths: calculation.durationMonths || null,
      calculation
    };
  }

  function reviewOrder(event) {
    event.preventDefault();
    showValidation = true;
    if (!validateOrder()) return;
    reviewSnapshot = orderSnapshot();
    $('#review-content').innerHTML = renderReview(reviewSnapshot);
    $('#review-modal').classList.remove('hidden');
    $('#submit-order').disabled = false;
    $('#submit-order').textContent = 'Submit Order';
    $('#submit-order').focus();
  }

  function renderReview(snapshot) {
    const { investor, folio, scheme, calculation } = snapshot;
    const financialRows = transactionType === 'redemption'
      ? [
        ['Redemption mode', snapshot.redemptionMode === 'full' ? 'Full available holding' : snapshot.redemptionMode === 'units' ? 'By units' : 'By amount'],
        ['Requested amount', formatMoney(snapshot.amount)],
        ['Requested units', formatUnits(snapshot.units)],
        ['Estimated gross value', formatMoney(calculation.grossValue)],
        ['Mock exit load', formatMoney(calculation.exitLoad)],
        ['Estimated net proceeds', formatMoney(calculation.netProceeds)]
      ]
      : transactionType === 'sip'
        ? [
          ['Installment amount', formatMoney(calculation.investmentAmount)],
          ['Frequency', snapshot.frequency],
          ['Start date', formatDate(snapshot.startDate)],
          ['Duration', `${snapshot.durationMonths} months`],
          ['Planned installments', String(calculation.plannedInstallments)],
          ['Planned contributions (not an immediate debit)', formatMoney(calculation.plannedContributionTotal)],
          ['Immediate debit', formatMoney(0)]
        ]
        : [
          ['Investment amount', formatMoney(calculation.investmentAmount)],
          ['Configured demo charges', formatMoney(calculation.charges)],
          ['Estimated total debit', formatMoney(calculation.totalDebit)],
          ['Estimated units', formatUnits(calculation.estimatedUnits)]
        ];
    const rows = [
      ['Investor', `${investor.name} (${investor.id})`],
      ['Investor type / risk', `${investor.type} · ${investor.risk}`],
      ['KYC status', investor.kyc],
      ['Folio / holding mode', `${folio.number} · ${folio.mode}`],
      ['Transaction', transactionLabel(snapshot.transactionType)],
      ['Scheme', `${scheme.name} (${scheme.code})`],
      ['Category / risk', `${scheme.category} · ${scheme.risk}`],
      ['Mock NAV and valuation date', `${formatMoney(scheme.nav)} · ${formatDate(scheme.navDate)}`],
      ...financialRows.map(([label, value]) => [label, String(value)]),
      ...(snapshot.transactionType !== 'redemption' ? [['Bank mandate', `${folio.bank} · ${folio.mandate}`]] : [])
    ];
    const warning = (investor.risk === 'Conservative' && ['High', 'Very High'].includes(scheme.risk)) ||
      (investor.risk === 'Moderate' && scheme.risk === 'Very High');
    return `<dl class="review-grid">${rows.map(([label, value]) =>
      `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd>`
    ).join('')}</dl>${warning ? `<p class="suitability-warning">Suitability warning: ${escapeHTML(scheme.risk)} risk may not align with the ${escapeHTML(investor.risk)} mock profile.</p>` : ''}`;
  }

  function transactionLabel(type) {
    return ({ purchase: 'Purchase', additional: 'Additional Purchase', redemption: 'Redemption', sip: 'SIP Registration' })[type] || type;
  }

  function submitOrder() {
    if (submitting) return;
    showValidation = true;
    if (!validateOrder()) {
      $('#review-modal').classList.add('hidden');
      return;
    }
    const current = orderSnapshot();
    if (!reviewSnapshot || JSON.stringify(current) !== JSON.stringify(reviewSnapshot)) {
      showToast('Order details changed after review. Review the updated instruction before submitting.', true);
      $('#review-modal').classList.add('hidden');
      reviewSnapshot = null;
      return;
    }
    submitting = true;
    const button = $('#submit-order');
    button.disabled = true;
    const reference = generateOrderReference();
    const now = new Date().toISOString();
    const initialStatus = role === 'Investor' ? 'Pending Approval' : 'Submitted';
    const record = {
      id: reference,
      status: initialStatus,
      submittedAt: now,
      investorId: current.investor.id,
      folioNumber: current.folio.number,
      snapshot: structuredCloneSafe(current),
      history: [{
        status: initialStatus,
        at: now,
        actor: `${role} · ${username}`,
        note: initialStatus === 'Pending Approval' ? 'Submitted for simulated Relationship Manager approval.' : 'Instruction submitted to the simulated order workflow.'
      }]
    };
    orders.unshift(record);
    if (!persistOrders()) {
      orders.shift();
      button.disabled = false;
      submitting = false;
      return;
    }
    $('#review-modal').classList.add('hidden');
    reviewSnapshot = null;
    submitting = false;
    showValidation = false;
    currentPage = 1;
    renderOrders();
    showToast(`Order ${reference} submitted · ${initialStatus}. This does not indicate execution or settlement.`);
    $('#trade-form').reset();
    $('#transaction-type').value = transactionType;
    selectedScheme = null;
    $('#scheme-search').value = '';
    $('#selected-scheme').classList.add('hidden');
    $('#selected-scheme').textContent = '';
    Object.keys(formValues).forEach(key => {
      if (key.startsWith(`${transactionType}:`)) delete formValues[key];
    });
    renderTransactionFields();
    button.disabled = false;
  }

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function generateOrderReference() {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    let suffix = 1;
    let reference = `FV${stamp}01`;
    while (orders.some(order => order.id === reference)) {
      suffix += 1;
      reference = `FV${stamp}${String(suffix).padStart(2, '0')}`;
    }
    return reference;
  }

  function renderOrders() {
    const query = $('#order-search').value.trim().toLowerCase();
    const typeFilter = $('#type-filter').value;
    const statusFilter = $('#status-filter').value;
    let visible = orders.filter(order => {
      if (!canReviewAllOrders && order.investorId !== permittedInvestorId) return false;
      if (typeFilter && order.snapshot.transactionType !== typeFilter) return false;
      if (statusFilter && order.status !== statusFilter) return false;
      const investorName = order.snapshot.investor?.name || '';
      const schemeName = order.snapshot.scheme?.name || '';
      return !query || [order.id, investorName, schemeName].some(value => String(value).toLowerCase().includes(query));
    });
    visible.sort((a, b) => (newestFirst ? -1 : 1) * a.submittedAt.localeCompare(b.submittedAt));
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const body = $('#orders-body');
    body.innerHTML = pageItems.length ? pageItems.map(order => renderOrderRow(order)).join('') :
      '<tr class="empty-row"><td colspan="10">No orders match these filters. Adjust your search or submit an instruction to begin.</td></tr>';
    $('#order-count').textContent = `${visible.length} ${visible.length === 1 ? 'order' : 'orders'} · ${orders.length} stored`;
    $('#order-pagination').innerHTML = `
      <button type="button" data-page="${Math.max(1, currentPage - 1)}" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
      <span>${currentPage} / ${totalPages}</span>
      <button type="button" data-page="${Math.min(totalPages, currentPage + 1)}" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
  }

  function renderOrderRow(order) {
    const snapshot = order.snapshot;
    const statusClass = `status-${order.status.toLowerCase().replace(/\s+/g, '-')}`;
    const allowedToAct = role === 'Admin' || role === 'Relationship Manager';
    const canCancel = ['Submitted', 'Pending Approval'].includes(order.status) &&
      (allowedToAct || order.investorId === permittedInvestorId);
    const actions = [
      `<button type="button" class="text-action" data-action="details" data-order-id="${escapeHTML(order.id)}">Details</button>`,
      ...(canCancel ? [`<button type="button" class="text-action danger" data-action="cancel" data-order-id="${escapeHTML(order.id)}">Cancel</button>`] : []),
      ...(allowedToAct && order.status === 'Pending Approval' ? [
        `<button type="button" class="text-action" data-action="accept" data-order-id="${escapeHTML(order.id)}">Accept</button>`,
        `<button type="button" class="text-action danger" data-action="reject" data-order-id="${escapeHTML(order.id)}">Reject</button>`
      ] : [])
    ].join('');
    const amount = snapshot.transactionType === 'redemption'
      ? formatMoney(snapshot.calculation.grossValue)
      : formatMoney(snapshot.amount);
    const units = snapshot.units ? formatUnits(snapshot.units) : '—';
    return `<tr>
      <td><span class="order-reference">${escapeHTML(order.id)}</span></td>
      <td>${escapeHTML(snapshot.investor?.name || '—')}</td>
      <td>${escapeHTML(snapshot.folio?.number || order.folioNumber || '—')}</td>
      <td>${escapeHTML(snapshot.scheme?.name || '—')}<small>${escapeHTML(snapshot.scheme?.code || '')}</small></td>
      <td>${escapeHTML(transactionLabel(snapshot.transactionType))}</td>
      <td>${escapeHTML(amount)}</td>
      <td>${escapeHTML(units)}</td>
      <td>${escapeHTML(formatTimestamp(order.submittedAt))}</td>
      <td><span class="status-badge ${statusClass}" data-testid="order-status">${escapeHTML(order.status)}</span></td>
      <td><div class="row-actions">${actions}</div></td>
    </tr>`;
  }

  function transitionOrder(order, status, note) {
    const previousStatus = order.status;
    const now = new Date().toISOString();
    order.status = status;
    order.history.push({ status, at: now, actor: `${role} · ${username}`, note });
    if (!persistOrders()) {
      order.status = previousStatus;
      order.history.pop();
      return;
    }
    renderOrders();
    showToast(`Order ${order.id} moved to ${status}. This is a simulated workflow state only.`);
  }

  function openOrderDetails(order) {
    const snapshot = order.snapshot;
    const calculation = snapshot.calculation || {};
    const detailRows = [
      ['Order reference', order.id],
      ['Current status', order.status],
      ['Investor', `${snapshot.investor?.name || '—'} · ${snapshot.investor?.id || '—'}`],
      ['Folio', `${snapshot.folio?.number || '—'} · ${snapshot.folio?.mode || '—'}`],
      ['KYC at submission', snapshot.investor?.kyc || '—'],
      ['Scheme snapshot', `${snapshot.scheme?.name || '—'} (${snapshot.scheme?.code || '—'})`],
      ['Category / risk', `${snapshot.scheme?.category || '—'} · ${snapshot.scheme?.risk || '—'}`],
      ['Mock NAV / date', `${formatMoney(snapshot.scheme?.nav)} · ${formatDate(snapshot.scheme?.navDate)}`],
      ['Transaction', transactionLabel(snapshot.transactionType)],
      ['Order amount', formatMoney(snapshot.amount)],
      ['Units', formatUnits(snapshot.units)],
      ['Charges', formatMoney(calculation.charges || calculation.exitLoad || 0)],
      ['Other demo charges', formatMoney(calculation.charges || 0)],
      ...(snapshot.transactionType === 'redemption' ? [['Mock exit-load assumption', calculation.exitLoadDescription || snapshot.scheme?.exitLoad || 'None configured']] : []),
      ['Total debit / net proceeds', snapshot.transactionType === 'redemption' ? formatMoney(calculation.netProceeds) : snapshot.transactionType === 'sip' ? 'No immediate debit' : formatMoney(calculation.totalDebit)],
      ['Bank mandate snapshot', snapshot.folio?.bank ? `${snapshot.folio.bank} · ${snapshot.folio.mandate}` : 'Not applicable'],
      ['Submitted', formatTimestamp(order.submittedAt)]
    ];
    $('#details-title').textContent = `Order ${order.id}`;
    $('#details-content').innerHTML = `
      <dl class="detail-grid">${detailRows.map(([label, value]) =>
        `<dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd>`
      ).join('')}</dl>
      <h3 class="dialog-section-title">Status history</h3>
      <ol class="history-list" data-testid="order-history">${(order.history || []).map(event =>
        `<li><strong>${escapeHTML(event.status)} · ${escapeHTML(event.note)}</strong><small>${escapeHTML(event.actor)} · ${escapeHTML(formatTimestamp(event.at))}</small></li>`
      ).join('')}</ol>`;
    $('#details-modal').classList.remove('hidden');
  }

  function showToast(message, isError = false) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add('hidden'), 6000);
  }

  function resetEntry() {
    $('#trade-form').reset();
    $('#transaction-type').value = transactionType;
    selectedScheme = null;
    showValidation = false;
    reviewSnapshot = null;
    Object.keys(formValues).forEach(key => delete formValues[key]);
    $('#scheme-search').value = '';
    $('#scheme-search').setAttribute('aria-expanded', 'false');
    $('#scheme-results').classList.add('hidden');
    $('#scheme-error').textContent = '';
    $('#transaction-error').textContent = '';
    $('#form-alert').classList.add('hidden');
    $('#selected-scheme').classList.add('hidden');
    renderTransactionFields();
  }

  function resetDemoData() {
    if (!window.confirm('Clear simulated Trade Center orders and saved account selection?')) return;
    try {
      localStorage.removeItem(STORAGE.orders);
      localStorage.removeItem(STORAGE.context);
      orders = [];
      selectedInvestor = investors.find(item => item.id === permittedInvestorId) || investors[0];
      selectedFolio = selectedInvestor.folios[0];
      renderIdentity();
      renderAccount();
      resetEntry();
      currentPage = 1;
      renderOrders();
      showToast('Trade Center demo orders and saved selection were cleared.');
    } catch (error) {
      console.error('FinVerse Trade Center could not reset demo data.', error);
      showToast('Demo data could not be cleared in this browser.', true);
    }
  }

  function initializeEvents() {
    $('[data-testid="notification-icon"]').addEventListener('click', () => {
      showToast('No new Trade Center notifications.');
    });
    $('#investor-select').addEventListener('change', event => {
      const investor = investors.find(item => item.id === event.target.value);
      if (!canSelectInvestor || !investor) return;
      selectedInvestor = investor;
      selectedFolio = investor.folios[0];
      renderIdentity();
      renderAccount();
      resetEntry();
      persistContext();
    });
    $('#folio-select').addEventListener('change', event => {
      const folio = selectedInvestor.folios.find(item => item.number === event.target.value);
      if (!folio) return;
      selectedFolio = folio;
      renderAccount();
      resetEntry();
      persistContext();
    });
    $('#transaction-type').addEventListener('change', event => {
      const visibleFields = $('#transaction-fields').querySelectorAll('[data-value-key]');
      visibleFields.forEach(field => { formValues[`${transactionType}:${field.dataset.valueKey}`] = field.value; });
      transactionType = event.target.value;
      showValidation = false;
      $('#transaction-error').textContent = '';
      $('#form-alert').classList.add('hidden');
      renderTransactionFields();
    });
    $('#scheme-search').addEventListener('input', event => renderSchemeSearch(event.target.value));
    $('#scheme-search').addEventListener('keydown', event => {
      const results = [...$('#scheme-results').querySelectorAll('[data-scheme-code]')];
      if (event.key === 'ArrowDown' && results.length) {
        event.preventDefault();
        results[0].focus();
      } else if (event.key === 'Escape') {
        $('#scheme-results').classList.add('hidden');
        $('#scheme-search').setAttribute('aria-expanded', 'false');
      } else if (event.key === 'Enter' && results.length === 1) {
        event.preventDefault();
        results[0].click();
      }
    });
    $('#scheme-results').addEventListener('click', event => {
      const button = event.target.closest('[data-scheme-code]');
      if (!button) return;
      const scheme = getScheme(button.dataset.schemeCode);
      if (scheme) selectScheme(scheme);
    });
    $('#trade-form').addEventListener('submit', reviewOrder);
    $('#submit-order').addEventListener('click', submitOrder);
    $('#reset-form').addEventListener('click', resetEntry);
    $('#reset-demo').addEventListener('click', resetDemoData);
    $('[data-testid="profile-menu"]').addEventListener('click', event => {
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      $('#profile-dropdown').classList.toggle('hidden', expanded);
    });
    $('[data-testid="logout-button"]').addEventListener('click', signOut);
    $('[data-testid="profile-logout"]').addEventListener('click', signOut);
    $('#order-search').addEventListener('input', () => { currentPage = 1; renderOrders(); });
    $('#type-filter').addEventListener('change', () => { currentPage = 1; renderOrders(); });
    $('#status-filter').addEventListener('change', () => { currentPage = 1; renderOrders(); });
    $('#sort-orders').addEventListener('click', () => {
      newestFirst = !newestFirst;
      $('#sort-orders').textContent = newestFirst ? 'Newest first ↓' : 'Oldest first ↑';
      $('#sort-orders').setAttribute('aria-label', `Sort by submission date, ${newestFirst ? 'newest' : 'oldest'} first`);
      renderOrders();
    });
    $('#order-pagination').addEventListener('click', event => {
      const button = event.target.closest('[data-page]');
      if (!button || button.disabled) return;
      currentPage = Number(button.dataset.page);
      renderOrders();
    });
    $('#orders-body').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const order = orders.find(item => item.id === button.dataset.orderId);
      if (!order) return;
      if (button.dataset.action === 'details') openOrderDetails(order);
      if (button.dataset.action === 'cancel' && ['Submitted', 'Pending Approval'].includes(order.status) &&
          (canApproveOrders || order.investorId === permittedInvestorId)) {
        transitionOrder(order, 'Cancelled', 'Cancelled before simulated acceptance.');
      }
      if (canApproveOrders && order.status === 'Pending Approval' && button.dataset.action === 'accept') {
        transitionOrder(order, 'Accepted', 'Approved by an authorized simulated Relationship Manager or Admin.');
      }
      if (canApproveOrders && order.status === 'Pending Approval' && button.dataset.action === 'reject') {
        transitionOrder(order, 'Rejected', 'Rejected by an authorized simulated Relationship Manager or Admin.');
      }
    });
    document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => {
      $(`#${button.dataset.closeModal}`).classList.add('hidden');
      if (button.dataset.closeModal === 'review-modal') reviewSnapshot = null;
    }));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        backdrop.classList.add('hidden');
        if (backdrop.id === 'review-modal') reviewSnapshot = null;
      }
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.add('hidden'));
        $('#scheme-results').classList.add('hidden');
        $('#scheme-search').setAttribute('aria-expanded', 'false');
        reviewSnapshot = null;
      }
    });
  }

  function signOut() {
    try {
      localStorage.removeItem(STORAGE.session);
      window.location.href = 'index.html';
    } catch (error) {
      console.error('FinVerse could not clear the current login session.', error);
      showToast('Unable to sign out because browser storage is unavailable.', true);
    }
  }

  function initialize() {
    restoreContext();
    selectedInvestor = investors.find(item => item.id === selectedInvestor.id) || investors[0];
    selectedFolio = selectedInvestor.folios.find(item => item.number === selectedFolio.number) || selectedInvestor.folios[0];
    loadOrders();
    renderIdentity();
    renderAccount();
    $('#transaction-type').value = transactionType;
    renderTransactionFields();
    initializeEvents();
    renderOrders();
    persistContext();
  }

  initialize();
})();
