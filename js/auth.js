const mockUsers = [
  { username: 'deepak', password: 'Password@123', role: 'Investor' },
  { username: 'rm01', password: 'RM@123', role: 'Relationship Manager' },
  { username: 'comp01', password: 'Compliance@123', role: 'Compliance Officer' },
  { username: 'admin', password: 'Admin@123', role: 'Admin' }
];

const storageKeys = {
  session: 'finverse-user-session',
  remembered: 'finverse-remembered-user'
};

const loginForm = document.getElementById('login-form');
const loginCard = document.querySelector('[data-testid="login-card"]');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const roleInput = document.getElementById('user-role');
const rememberInput = document.getElementById('remember-me');
const loginButton = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const toast = document.getElementById('toast');
const forgotPasswordButton = document.querySelector('[data-testid="forgot-password"]');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const passwordToggle = document.querySelector('[data-testid="password-toggle"]');
const rememberUsername = localStorage.getItem(storageKeys.remembered);

function clearError(fieldName) {
  const field = document.getElementById(fieldName);
  const errorTarget = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (field) {
    field.classList.remove('invalid');
  }

  if (errorTarget) {
    errorTarget.textContent = '';
  }
}

function setError(fieldName, message) {
  const field = document.getElementById(fieldName);
  const errorTarget = document.querySelector(`[data-error-for="${fieldName}"]`);

  if (field) {
    field.classList.add('invalid');
  }

  if (errorTarget) {
    errorTarget.textContent = message;
  }
}

function showToast(message, type = 'info') {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('success', 'error', 'info');
  toast.classList.add(type);
  toast.classList.add('show');

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function validateLoginForm() {
  let isValid = true;
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  clearError('username');
  clearError('password');
  if (loginError) {
    loginError.textContent = '';
  }

  if (!username) {
    setError('username', 'Username is required.');
    isValid = false;
  }

  if (!password) {
    setError('password', 'Password is required.');
    isValid = false;
  }

  return isValid;
}

function setLoadingState(isLoading) {
  if (!loginButton) return;

  const buttonText = loginButton.querySelector('.btn-text');
  const spinner = loginButton.querySelector('.spinner');

  loginButton.disabled = isLoading;

  if (isLoading) {
    loginButton.classList.add('is-loading');
    if (buttonText) {
      buttonText.textContent = 'Signing In...';
    }
    if (spinner) {
      spinner.classList.remove('hidden');
    }
  } else {
    loginButton.classList.remove('is-loading');
    if (buttonText) {
      buttonText.textContent = 'Sign In Securely';
    }
    if (spinner) {
      spinner.classList.add('hidden');
    }
  }
}

function handleLoginSuccess(user) {
  const session = {
    username: user.username,
    role: user.role
  };

  localStorage.setItem(storageKeys.session, JSON.stringify(session));

  if (rememberInput.checked) {
    localStorage.setItem(storageKeys.remembered, user.username);
  } else {
    localStorage.removeItem(storageKeys.remembered);
  }

  window.location.href = 'dashboard.html';
}

function handleLoginFailure() {
  if (!loginCard) return;

  loginCard.classList.remove('shake');
  void loginCard.offsetWidth;
  loginCard.classList.add('shake');

  usernameInput.classList.add('invalid');
  passwordInput.classList.add('invalid');

  if (loginError) {
    loginError.textContent = 'Invalid username or password.';
  }

  showToast('Invalid username or password.', 'error');
}

function authenticateUser(username, password, role) {
  return mockUsers.find(
    (user) => user.username === username && user.password === password && user.role === role
  );
}

function initializeRememberedUser() {
  if (rememberUsername) {
    usernameInput.value = rememberUsername;
    rememberInput.checked = true;
  }
}

if (rememberInput) {
  rememberInput.checked = !!rememberUsername;
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!validateLoginForm()) {
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const role = roleInput.value;
    const matchedUser = authenticateUser(username, password, role);

    if (!matchedUser) {
      handleLoginFailure();
      return;
    }

    setLoadingState(true);

    setTimeout(() => {
      handleLoginSuccess(matchedUser);
    }, 1500);
  });
}

if (passwordToggle) {
  passwordToggle.addEventListener('click', () => {
    const isPasswordHidden = passwordInput.type === 'password';
    passwordInput.type = isPasswordHidden ? 'text' : 'password';
    passwordToggle.textContent = isPasswordHidden ? '🙈' : '👁️';
    passwordToggle.setAttribute('aria-label', isPasswordHidden ? 'Hide password' : 'Show password');
  });
}

if (forgotPasswordButton) {
  forgotPasswordButton.addEventListener('click', () => {
    if (forgotPasswordModal) {
      forgotPasswordModal.classList.remove('hidden');
    }
  });
}

if (forgotPasswordModal) {
  const closeModalButton = forgotPasswordModal.querySelector('.close-modal');
  const cancelButton = forgotPasswordModal.querySelector('[data-testid="modal-cancel"]');

  const closeModal = () => {
    forgotPasswordModal.classList.add('hidden');
    forgotPasswordForm.reset();
  };

  closeModalButton?.addEventListener('click', closeModal);
  cancelButton?.addEventListener('click', closeModal);

  forgotPasswordModal.addEventListener('click', (event) => {
    if (event.target === forgotPasswordModal) {
      closeModal();
    }
  });
}

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const usernameField = document.getElementById('fp-username');
    const emailField = document.getElementById('fp-email');
    const username = usernameField.value.trim();
    const email = emailField.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let isValid = true;

    usernameField.classList.remove('invalid');
    emailField.classList.remove('invalid');

    if (!username) {
      usernameField.classList.add('invalid');
      isValid = false;
    }

    if (!email || !emailRegex.test(email)) {
      emailField.classList.add('invalid');
      isValid = false;
    }

    if (!isValid) {
      showToast('Please enter a valid username and email.', 'error');
      return;
    }

    showToast('OTP has been sent to your registered email.', 'success');
    forgotPasswordForm.reset();

    if (forgotPasswordModal) {
      forgotPasswordModal.classList.add('hidden');
    }
  });
}

initializeRememberedUser();
