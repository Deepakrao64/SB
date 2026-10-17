(function () {
  function result(valid, message = '') { return { valid, message }; }
  function validatePAN(value) { return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).trim().toUpperCase()) ? result(true) : result(false, 'Invalid PAN Number. Use ABCDE1234F.'); }
  function validateEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? result(true) : result(false, 'Enter a valid email address.'); }
  function validatePhone(value) { return /^\d{10}$/.test(String(value).replace(/\D/g, '')) ? result(true) : result(false, 'Mobile number must contain exactly 10 digits.'); }
  function validateAadhaar(value) { return /^\d{12}$/.test(String(value).replace(/\s/g, '')) ? result(true) : result(false, 'Aadhaar number must contain 12 digits.'); }
  function validatePincode(value) { return /^[1-9][0-9]{5}$/.test(String(value).trim()) ? result(true) : result(false, 'Enter a valid 6-digit pincode.'); }
  function validateDOB(value) { const date = new Date(value); if (!value || Number.isNaN(date.getTime())) return result(false, 'Date of birth is required.'); const today = new Date(); let age = today.getFullYear() - date.getFullYear(); const month = today.getMonth() - date.getMonth(); if (month < 0 || (month === 0 && today.getDate() < date.getDate())) age -= 1; return age >= 18 && age <= 100 ? result(true) : result(false, 'Investor age must be between 18 and 100 years.'); }
  function validateCurrency(value, minimum = 0) { const amount = Number(String(value).replace(/[^0-9.]/g, '')); return Number.isFinite(amount) && amount >= minimum ? result(true) : result(false, `Amount must be at least ₹${minimum.toLocaleString('en-IN')}.`); }
  window.OnboardingValidation = { validatePAN, validateEmail, validatePhone, validateAadhaar, validatePincode, validateDOB, validateCurrency };
}());

const TradeValidation = (() => {
  const money = value => Number(value), required = value => String(value || '').trim() ? '' : 'This field is required.';
  const positive = value => !Number.isFinite(money(value)) || money(value) <= 0 ? 'Enter an amount greater than zero.' : '';
  const precision = value => /^\d+(\.\d{1,2})?$/.test(String(value)) ? '' : 'Use no more than two decimal places.';
  const minimum = (value, min = 500) => money(value) < min ? `Minimum amount is ₹${min}.` : '';
  const cash = (value, balance) => money(value) > balance ? 'Amount exceeds available cash balance.' : '';
  const units = (value, holding) => money(value) > holding.value ? 'Redemption amount exceeds available holding value.' : '';
  const futureDate = value => !value || new Date(`${value}T00:00:00`) < new Date(new Date().toDateString()) ? 'Choose today or a future date.' : '';
  return { required, positive, precision, minimum, cash, units, futureDate, amount: (value, min) => required(value) || positive(value) || precision(value) || minimum(value, min) };
})();
