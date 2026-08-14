"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, type AuthResponse } from './api';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Synchronously read from localStorage — no async needed
    try {
      const savedUser = authApi.getUser();
      if (savedUser) {
        setUser(savedUser);
      }
    } catch {
      // corrupted storage — ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response: AuthResponse = await authApi.login({ email, password });
    if (!response.token) throw new Error('Login did not return an access token');
    authApi.saveAuth(response.token, response.user);
    setUser(response.user);
    toast({ title: 'Welcome back!', description: `Signed in as ${response.user.email}` });
    router.push('/dashboard');
  };

  const register = async (email: string, password: string, name: string) => {
    const response: AuthResponse = await authApi.register({ email, password, name });
    if (!response.token) {
      toast({ title: 'Check your email', description: response.message || 'Confirm your account before signing in.' });
      return;
    }
    authApi.saveAuth(response.token, response.user);
    setUser(response.user);
    toast({ title: 'Account created!', description: `Welcome, ${response.user.name}` });
    router.push('/dashboard');
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    router.push('/');
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    // Also update localStorage
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, logout, updateUser }}>
      {isLoading ? (
        // Block render until we know auth state — prevents Guest flash
        <div className="min-h-screen bg-background" />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
