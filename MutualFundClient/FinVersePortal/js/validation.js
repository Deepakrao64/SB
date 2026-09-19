(function () {
  function result(valid, message = '') {
    return { valid, message };
  }

  function validatePAN(value) {
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value).trim().toUpperCase()) ? result(true) : result(false, 'Invalid PAN Number. Use ABCDE1234F.');
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? result(true) : result(false, 'Enter a valid email address.');
  }

  function validatePhone(value) {
    return /^\d{10}$/.test(String(value).replace(/\D/g, '')) ? result(true) : result(false, 'Mobile number must contain exactly 10 digits.');
  }

  function validateAadhaar(value) {
    return /^\d{12}$/.test(String(value).replace(/\s/g, '')) ? result(true) : result(false, 'Aadhaar number must contain 12 digits.');
  }

  function validatePincode(value) {
    return /^[1-9][0-9]{5}$/.test(String(value).trim()) ? result(true) : result(false, 'Enter a valid 6-digit pincode.');
  }

  function validateDOB(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return result(false, 'Date of birth is required.');
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const month = today.getMonth() - date.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < date.getDate())) age -= 1;
    return age >= 18 && age <= 100 ? result(true) : result(false, 'Investor age must be between 18 and 100 years.');
  }

  function validateCurrency(value, minimum = 0) {
    const amount = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isFinite(amount) && amount >= minimum ? result(true) : result(false, `Amount must be at least ₹${minimum.toLocaleString('en-IN')}.`);
  }

  window.OnboardingValidation = { validatePAN, validateEmail, validatePhone, validateAadhaar, validatePincode, validateDOB, validateCurrency };
}());
