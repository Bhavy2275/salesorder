/**
 * authStore.js — Demo auth with hardcoded users, localStorage session
 */

const DEMO_USERS = [
  { id: 'u1', name: 'Admin',         email: 'admin',     passwordHash: 'YWRtaW4xMjM=',  role: 'admin',       avatar: '👑' },
  { id: 'u2', name: 'Rahul Sharma',  email: 'rahul',     passwordHash: 'c2FsZXMxMjM=',  role: 'salesperson', avatar: '🧑‍💼' },
  { id: 'u3', name: 'Priya Mehta',   email: 'priya',     passwordHash: 'c2FsZXMxMjM=',  role: 'salesperson', avatar: '👩‍💼' },
  { id: 'u4', name: 'Warehouse Team',email: 'warehouse', passwordHash: 'd2gxMjM=',     role: 'warehouse',   avatar: '📦' },
];

export const authStore = {
  login(email, password) {
    const user = DEMO_USERS.find(
      (u) => u.email === email.toLowerCase().trim() && window.atob(u.passwordHash) === password
    );
    if (!user) return { success: false, error: 'Invalid username or password.' };
    const session = { ...user };
    delete session.passwordHash;
    localStorage.setItem('so_session', JSON.stringify(session));
    return { success: true, user: session };
  },

  logout() {
    localStorage.removeItem('so_session');
  },

  getUser() {
    try {
      const raw = localStorage.getItem('so_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return Boolean(this.getUser());
  },
};
