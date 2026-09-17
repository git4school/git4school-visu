import { Injectable } from "@angular/core";
import { GitProviderType } from "@models/Account.model";

export interface StoredTokenEnvelope {
  v: number;
  iv: string;
  data: string;
  sig: string;
  exp: number | null;
  rm: boolean;
}

export interface StoredTokenPayload {
  token: string;
  provider: GitProviderType;
  createdAt: number;
  expiresAt: number | null;
}

@Injectable({
  providedIn: "root",
})
export class TokenStorageService {
  private readonly storagePrefix = "g4s_auth_v1_";
  private readonly userPrefix = "g4s_user_v1_";
  private readonly deviceSeedKey = "g4s_device_seed";

  constructor() {}

  saveToken(provider: GitProviderType, token: string, rememberMe: boolean, expiresInSeconds?: number): void {
    if (!token) {
      this.clearToken(provider);
      return;
    }

    const now = Date.now();
    const expiresAt = typeof expiresInSeconds === "number" && !isNaN(expiresInSeconds) ? now + expiresInSeconds * 1000 : null;

    const payload: StoredTokenPayload = {
      token,
      provider,
      createdAt: now,
      expiresAt,
    };

    const envelope = this.encryptPayload(payload, rememberMe);
    const key = this.getTokenKey(provider);

    // Always clear both storages first to prevent stale contradictory states
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);

    const targetStorage = rememberMe ? localStorage : sessionStorage;
    this.setStorageItem(targetStorage, key, JSON.stringify(envelope));
  }

  getToken(provider: GitProviderType): string | null {
    const key = this.getTokenKey(provider);

    // 1. Check sessionStorage first (active session)
    let raw = this.getStorageItem(sessionStorage, key);
    let isFromSession = true;

    // 2. Fall back to localStorage (remembered device)
    if (!raw) {
      raw = this.getStorageItem(localStorage, key);
      isFromSession = false;
    }

    if (!raw) {
      return null;
    }

    try {
      const envelope: StoredTokenEnvelope = JSON.parse(raw);

      // Check envelope expiration
      if (envelope.exp !== null && Date.now() > envelope.exp) {
        this.clearToken(provider);
        return null;
      }

      const payload = this.decryptPayload(envelope);
      if (!payload || payload.provider !== provider) {
        this.clearToken(provider);
        return null;
      }

      // Check inner payload expiration if present
      if (payload.expiresAt !== null && Date.now() > payload.expiresAt) {
        this.clearToken(provider);
        return null;
      }

      return payload.token;
    } catch {
      // If parsing or decrypting fails (e.g. data tampering), clear corrupt entry
      if (isFromSession) {
        this.removeStorageItem(sessionStorage, key);
      } else {
        this.removeStorageItem(localStorage, key);
      }
      return null;
    }
  }

  clearToken(provider: GitProviderType): void {
    const key = this.getTokenKey(provider);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);
  }

  saveUserData(provider: GitProviderType, data: any, rememberMe: boolean): void {
    const key = this.getUserKey(provider);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);

    if (data === null || data === undefined) {
      return;
    }

    const raw = JSON.stringify(data);
    const targetStorage = rememberMe ? localStorage : sessionStorage;
    this.setStorageItem(targetStorage, key, raw);
  }

  getUserData<T>(provider: GitProviderType): T | null {
    const key = this.getUserKey(provider);
    let raw = this.getStorageItem(sessionStorage, key);
    if (!raw) {
      raw = this.getStorageItem(localStorage, key);
    }
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  clearUserData(provider: GitProviderType): void {
    const key = this.getUserKey(provider);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);
  }

  clearAll(provider: GitProviderType): void {
    this.clearToken(provider);
    this.clearUserData(provider);
  }

  isRemembered(provider: GitProviderType): boolean {
    const key = this.getTokenKey(provider);
    const raw = this.getStorageItem(localStorage, key);
    if (!raw) {
      return false;
    }
    try {
      const envelope: StoredTokenEnvelope = JSON.parse(raw);
      return Boolean(envelope.rm);
    } catch {
      return false;
    }
  }

  private getTokenKey(provider: GitProviderType): string {
    return `${this.storagePrefix}${provider}`;
  }

  private getUserKey(provider: GitProviderType): string {
    return `${this.userPrefix}${provider}`;
  }

  private encryptPayload(payload: StoredTokenPayload, rememberMe: boolean): StoredTokenEnvelope {
    const jsonStr = JSON.stringify(payload);
    const iv = this.generateRandomHex(16);
    const keyStream = this.deriveKeystream(iv, jsonStr.length);
    const cipherChars: string[] = [];

    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ keyStream[i];
      cipherChars.push(String.fromCharCode(charCode));
    }

    const data = this.encodeBase64(cipherChars.join(""));
    const sig = this.computeSignature(iv, jsonStr, payload.expiresAt);

    return {
      v: 1,
      iv,
      data,
      sig,
      exp: payload.expiresAt,
      rm: rememberMe,
    };
  }

  private decryptPayload(envelope: StoredTokenEnvelope): StoredTokenPayload | null {
    if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.data || !envelope.sig) {
      return null;
    }

    const cipherStr = this.decodeBase64(envelope.data);
    if (!cipherStr) {
      return null;
    }

    const keyStream = this.deriveKeystream(envelope.iv, cipherStr.length);
    const plainChars: string[] = [];

    for (let i = 0; i < cipherStr.length; i++) {
      const charCode = cipherStr.charCodeAt(i) ^ keyStream[i];
      plainChars.push(String.fromCharCode(charCode));
    }

    const jsonStr = plainChars.join("");
    const expectedSig = this.computeSignature(envelope.iv, jsonStr, envelope.exp);

    if (expectedSig !== envelope.sig) {
      return null;
    }

    return JSON.parse(jsonStr) as StoredTokenPayload;
  }

  private deriveKeystream(iv: string, length: number): number[] {
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "git4school-app";
    const seedString = `${origin}:${this.getDeviceSeed()}:${iv}`;
    let hash = this.fnv1a(seedString);

    const stream: number[] = new Array(length);
    for (let i = 0; i < length; i++) {
      // Linear congruential generator (LCG) derived from hash
      hash = (Math.imul(hash, 1664525) + 1013904223) | 0;
      stream[i] = (hash >>> 16) & 0xff;
    }
    return stream;
  }

  private computeSignature(iv: string, plaintext: string, exp: number | null): string {
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "git4school-app";
    const seed = this.getDeviceSeed();
    const content = `${origin}:${seed}:${iv}:${plaintext}:${exp ?? "none"}`;
    const hash1 = this.fnv1a(content);
    const hash2 = this.fnv1a(`${hash1}:${content.length}:${seed}`);
    return `${(hash1 >>> 0).toString(16).padStart(8, "0")}${(hash2 >>> 0).toString(16).padStart(8, "0")}`;
  }

  private getDeviceSeed(): string {
    let seed = this.getStorageItem(localStorage, this.deviceSeedKey);
    if (!seed) {
      seed = this.getStorageItem(sessionStorage, this.deviceSeedKey);
    }
    if (!seed) {
      seed = this.generateRandomHex(32);
      this.setStorageItem(localStorage, this.deviceSeedKey, seed);
      this.setStorageItem(sessionStorage, this.deviceSeedKey, seed);
    }
    return seed;
  }

  private fnv1a(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash | 0;
  }

  private generateRandomHex(length: number): string {
    const bytes = new Uint8Array(length);
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  private encodeBase64(str: string): string {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    } catch {
      return btoa(str);
    }
  }

  private decodeBase64(b64: string): string {
    try {
      const decoded = atob(b64);
      return decodeURIComponent(Array.from(decoded, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    } catch {
      try {
        return atob(b64);
      } catch {
        return "";
      }
    }
  }

  private getStorageItem(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  private setStorageItem(storage: Storage, key: string, value: string): void {
    try {
      storage.setItem(key, value);
    } catch (e) {
      console.warn("[TokenStorageService] Storage quota exceeded or blocked:", e);
    }
  }

  private removeStorageItem(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
