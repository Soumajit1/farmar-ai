// --- Role selection ---
const roleButtons = document.querySelectorAll('.role-btn');
let selectedRole = 'farmer';

roleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    roleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRole = btn.dataset.role;

    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btn.style.transform = 'scale(1)';
    }, 150);
  });
});

// --- Login form handling ---
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

if (loginForm) {
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorMsg) {
      errorMsg.textContent = '';
      errorMsg.style.opacity = '0';
    }

    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    if (!identifier || !password) {
      showError('Please fill in all fields.');
      return;
    }

    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Signing In...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: identifier,
          password,
          role: selectedRole
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.');
      }

      localStorage.setItem('agrilink_user', data.user.name);
      localStorage.setItem('agrilink_user_id', String(data.user.id));
      localStorage.setItem('agrilink_email', data.user.email);
      localStorage.setItem('agrilink_role', data.user.role);

      const redirects = {
        farmer: 'dashboard-farmer.html',
        buyer: 'dashboard-buyer.html',
        fpo: 'dashboard-fpo.html',
        admin: 'dashboard-admin.html'
      };

      window.location.href = redirects[data.user.role] || 'index.html';

    } catch (error) {
      console.error('Login error:', error);
      showError(error.message || 'Unable to connect to backend.');
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.disabled = false;
    }
  });
}

function showError(msg) {
  if (!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.style.transition = 'opacity 0.3s ease';
  errorMsg.style.opacity = '1';
}
