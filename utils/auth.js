import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const USERS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/users.json');

function ensureUsersFile() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function generateToken() {
  return 'ZERO_USR_' + crypto.randomBytes(12).toString('hex').toUpperCase();
}

export function loadUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveUsers(users) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function registerUser(username, password) {
  const users = loadUsers();
  
  const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    throw new Error('Questo nome utente è già registrato.');
  }
  
  const token = generateToken();
  const newUser = {
    username,
    password: hashPassword(password),
    token,
    active: true,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  return { username, token };
}

export function loginUser(username, password) {
  const users = loadUsers();
  const hashedPassword = hashPassword(password);
  
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === hashedPassword);
  if (!user) {
    throw new Error('Nome utente o password non corretti.');
  }
  
  if (!user.active) {
    throw new Error('Il tuo account o token è stato disattivato.');
  }
  
  return { username: user.username, token: user.token };
}

export function verifyUserToken(token) {
  const adminToken = config.accessTokens.find(t => t.token === token && t.active);
  if (adminToken) {
    return { token, label: adminToken.label, isAdmin: true };
  }
  
  const users = loadUsers();
  const user = users.find(u => u.token === token && u.active);
  if (user) {
    return { token, label: user.username, isAdmin: false };
  }
  
  return null;
}
