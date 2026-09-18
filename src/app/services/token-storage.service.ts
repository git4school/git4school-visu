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
  instanceHost?: string;
  createdAt: number;
  expiresAt: number | null;
  refreshToken?: string | null;
}

@Injectable({
  providedIn: "root",
})
export class TokenStorageService {
  private readonly storagePrefix = "g4s_auth_v1_";
  private readonly userPrefix = "g4s_user_v1_";
  private readonly deviceSeedKey = "g4s_device_seed";

  constructor() {}

  saveToken(
    provider: GitProviderType,
    token: string,
    rememberMe: boolean,
    expiresInSeconds?: number,
    refreshToken?: string,
    instanceHost?: string,
  ): void {
    if (!token) {
      this.clearToken(provider, instanceHost);
      return;
    }

    const now = Date.now();
    const expiresAt = typeof expiresInSeconds === "number" && !isNaN(expiresInSeconds) ? now + expiresInSeconds * 1000 : null;

    // If refreshToken is not explicitly provided, preserve existing refreshToken if one was stored
    const existingRefreshToken = this.getRefreshToken(provider, instanceHost);
    const effectiveRefreshToken = refreshToken !== undefined ? refreshToken : existingRefreshToken;

    const payload: StoredTokenPayload = {
      token,
      provider,
      instanceHost: instanceHost || (provider === "gitlab" ? "gitlab.com" : "github.com"),
      createdAt: now,
      expiresAt,
      refreshToken: effectiveRefreshToken || null,
    };

    // If a refresh token is present, do not expire the envelope itself upon access token expiration
    const envelopeExp = effectiveRefreshToken ? null : expiresAt;
    const envelope = this.encryptPayload(payload, rememberMe, envelopeExp);
    const key = this.getTokenKey(provider, instanceHost);

    // Always clear both storages first to prevent stale contradictory states
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);

    const targetStorage = rememberMe ? localStorage : sessionStorage;
    this.setStorageItem(targetStorage, key, JSON.stringify(envelope));
  }

  getToken(provider: GitProviderType, instanceHost?: string): string | null {
    const entry = this.getDecryptedEntry(provider, instanceHost);
    if (!entry) {
      return null;
    }

    const { payload } = entry;
    if (payload.expiresAt !== null && Date.now() > payload.expiresAt) {
      // Clear token completely only if there is no refresh token available
      if (!payload.refreshToken) {
        this.clearToken(provider, instanceHost);
      }
      return null;
    }

    return payload.token;
  }

  getRefreshToken(provider: GitProviderType, instanceHost?: string): string | null {
    const entry = this.getDecryptedEntry(provider, instanceHost);
    return entry?.payload.refreshToken || null;
  }

  getAccessTokenExpiresAt(provider: GitProviderType, instanceHost?: string): number | null {
    const entry = this.getDecryptedEntry(provider, instanceHost);
    return entry?.payload.expiresAt ?? null;
  }

  isTokenExpired(provider: GitProviderType, marginSeconds = 0, instanceHost?: string): boolean {
    const entry = this.getDecryptedEntry(provider, instanceHost);
    if (!entry) {
      return true;
    }
    if (entry.payload.expiresAt === null) {
      return false;
    }
    return Date.now() + marginSeconds * 1000 >= entry.payload.expiresAt;
  }

  clearToken(provider: GitProviderType, instanceHost?: string): void {
    const key = this.getTokenKey(provider, instanceHost);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);
  }

  saveUserData(provider: GitProviderType, data: any, rememberMe: boolean, instanceHost?: string): void {
    const key = this.getUserKey(provider, instanceHost);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);

    if (data === null || data === undefined) {
      return;
    }

    const raw = JSON.stringify(data);
    const targetStorage = rememberMe ? localStorage : sessionStorage;
    this.setStorageItem(targetStorage, key, raw);
  }

  getUserData<T>(provider: GitProviderType, instanceHost?: string): T | null {
    const key = this.getUserKey(provider, instanceHost);
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

  clearUserData(provider: GitProviderType, instanceHost?: string): void {
    const key = this.getUserKey(provider, instanceHost);
    this.removeStorageItem(sessionStorage, key);
    this.removeStorageItem(localStorage, key);
  }

  clearAll(provider: GitProviderType, instanceHost?: string): void {
    this.clearToken(provider, instanceHost);
    this.clearUserData(provider, instanceHost);
  }

  isRemembered(provider: GitProviderType, instanceHost?: string): boolean {
    const key = this.getTokenKey(provider, instanceHost);
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

  getCustomGitlabHosts(): string[] {
    const prefix = `${this.storagePrefix}gitlab:`;
    const hosts = new Set<string>();

    const scanStorage = (storage: Storage) => {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(prefix)) {
            const host = key.substring(prefix.length).trim();
            if (host) {
              hosts.add(host);
            }
          }
        }
      } catch {
        /* Storage restricted or unavailable */
      }
    };

    scanStorage(sessionStorage);
    scanStorage(localStorage);

    return Array.from(hosts);
  }

  private getDecryptedEntry(
    provider: GitProviderType,
    instanceHost?: string,
  ): { envelope: StoredTokenEnvelope; payload: StoredTokenPayload } | null {
    const key = this.getTokenKey(provider, instanceHost);
    let raw = this.getStorageItem(sessionStorage, key);
    let isFromSession = true;

    if (!raw) {
      raw = this.getStorageItem(localStorage, key);
      isFromSession = false;
    }

    if (!raw) {
      return null;
    }

    try {
      const envelope: StoredTokenEnvelope = JSON.parse(raw);

      if (envelope.exp !== null && Date.now() > envelope.exp) {
        this.clearToken(provider, instanceHost);
        return null;
      }

      const payload = this.decryptPayload(envelope);
      if (!payload || payload.provider !== provider) {
        this.clearToken(provider, instanceHost);
        return null;
      }

      return { envelope, payload };
    } catch {
      if (isFromSession) {
        this.removeStorageItem(sessionStorage, key);
      } else {
        this.removeStorageItem(localStorage, key);
      }
      return null;
    }
  }

  private getTokenKey(provider: GitProviderType, instanceHost?: string): string {
    if (provider === "gitlab" && instanceHost && instanceHost !== "gitlab.com") {
      return `${this.storagePrefix}${provider}:${instanceHost}`;
    }
    return `${this.storagePrefix}${provider}`;
  }

  private getUserKey(provider: GitProviderType, instanceHost?: string): string {
    if (provider === "gitlab" && instanceHost && instanceHost !== "gitlab.com") {
      return `${this.userPrefix}${provider}:${instanceHost}`;
    }
    return `${this.userPrefix}${provider}`;
  }

  private encryptPayload(
    payload: StoredTokenPayload,
    rememberMe: boolean,
    envelopeExp: number | null = payload.expiresAt,
  ): StoredTokenEnvelope {
    const jsonStr = JSON.stringify(payload);
    const iv = this.generateRandomHex(16);
    const keyStream = this.deriveKeystream(iv, jsonStr.length);
    const cipherChars: string[] = [];

    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ keyStream[i];
      cipherChars.push(String.fromCharCode(charCode));
    }

    const data = this.encodeBase64(cipherChars.join(""));
    const sig = this.computeSignature(iv, jsonStr, envelopeExp);

    return {
      v: 1,
      iv,
      data,
      sig,
      exp: envelopeExp,
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
