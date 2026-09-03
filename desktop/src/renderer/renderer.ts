export {};

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  message?: string;
}

declare global {
  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      login: (email: string, password: string) => Promise<AuthStatus>;
      logout: () => Promise<AuthStatus>;
    };
  }
}

function show(viewId: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    '#loading-view, #login-view, #status-view',
  )) {
    el.hidden = el.id !== viewId;
  }
}

function showLoggedIn(email: string): void {
  document.getElementById('status-email')!.textContent = email;
  show('status-view');
}

function showLoginForm(message?: string): void {
  const errorEl = document.getElementById('login-error')!;
  errorEl.hidden = !message;
  errorEl.textContent = message ?? '';
  show('login-view');
}

async function init(): Promise<void> {
  const status = await window.api.getStatus();
  if (status.loggedIn && status.email) {
    showLoggedIn(status.email);
  } else {
    showLoginForm();
  }
}

document.getElementById('login-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const email = (form.elements.namedItem('email') as HTMLInputElement).value;
  const password = (form.elements.namedItem('password') as HTMLInputElement).value;

  void window.api.login(email, password).then((result) => {
    if (result.loggedIn && result.email) {
      showLoggedIn(result.email);
    } else {
      showLoginForm(result.message ?? 'Login failed.');
    }
  });
});

document.getElementById('logout-button')!.addEventListener('click', () => {
  void window.api.logout().then(() => showLoginForm());
});

void init();
